/**
 * Talking Buddy — demo chat proxy (Cloudflare Worker)
 *
 * The website is a static site (GitHub Pages) and cannot safely hold an API
 * key. This Worker is the small backend that does: it holds GROQ_API_KEY as a
 * server-side secret, applies a per-IP rate limit, and forwards chat requests
 * to Groq. The browser only ever talks to this Worker — it never sees the key.
 *
 *   browser  ->  this Worker (secret + rate limit)  ->  Groq API  ->  reply
 */

// --- Config ---------------------------------------------------------------

// Groq model. llama-3.1-8b-instant is fast and has the most generous daily
// limit. Swap to "llama-3.3-70b-versatile" for higher quality (lower RPD).
const MODEL = "llama-3.1-8b-instant";

// Groq's OpenAI-compatible endpoint.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Keep the token budget small: llama-3.1-8b-instant is only 6K TPM on the
// free tier, so short prompts + short replies are what keep the demo alive
// under a couple of concurrent users.
const MAX_TOKENS = 300;
const MAX_MESSAGE_CHARS = 1000; // reject/trim overly long user input
const MAX_HISTORY_TURNS = 2; // only the last 2 exchanges are sent to Groq

// Origins allowed to call this Worker (CORS). Edit this list if the site
// moves to a custom domain. localhost entries are for local testing.
const ALLOWED_ORIGINS = [
  "https://rafapiveta.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

const LANGUAGE_NAMES = {
  pt: "Portuguese (Brazilian)",
  en: "English",
  es: "Spanish",
};

// --- CORS -----------------------------------------------------------------

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// --- Prompt building (server-side, so the browser can't inject it) --------

function systemPrompt(language) {
  const langName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.pt;
  return (
    'You are "Talking Buddy" — the friendly voice-assistant demo on this ' +
    "project's website. Talking Buddy is a fully offline, battery-powered " +
    "local voice assistant. Under the hood: openWakeWord spots the " +
    '"hey buddy" wake word, Whisper.cpp does speech-to-text, Gemma 3 (1B) ' +
    "via Ollama is the local LLM, and Supertonic 2 handles text-to-speech — " +
    "plus RFID user profiles, per-user memory, live translation and RAG, all " +
    "running on a single Raspberry Pi 5 with nothing in the cloud. " +
    "Personality: warm, upbeat and a little playful — a helpful buddy, not a " +
    "manual — but always clear. " +
    `Rules: always reply in ${langName}; keep it short (1-2 sentences unless ` +
    "the visitor asks for more detail); never invent specific hardware specs " +
    "or numbers you are unsure of (it's fine to say you're not certain); and " +
    "if asked something unrelated to Talking Buddy, answer briefly and kindly, " +
    "then gently steer the conversation back to the project."
  );
}

function buildMessages(message, language, history) {
  const messages = [{ role: "system", content: systemPrompt(language) }];

  if (Array.isArray(history)) {
    const recent = history.slice(-MAX_HISTORY_TURNS * 2); // 2 msgs per turn
    for (const item of recent) {
      const role = item && (item.role === "assistant" ? "assistant" : "user");
      const content = item && typeof item.content === "string" ? item.content : "";
      if (content) messages.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
    }
  }

  messages.push({ role: "user", content: message });
  return messages;
}

// --- Handler --------------------------------------------------------------

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    // CORS preflight — a JSON POST triggers this; it must succeed first.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Simple health check so you can eyeball the Worker in a browser.
    if (request.method === "GET") {
      return new Response(
        "Talking Buddy proxy is running. POST JSON { message, language, history } to chat.",
        { status: 200, headers: corsHeaders(origin) }
      );
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, origin);
    }

    // Per-IP rate limit (optional — skipped if the binding isn't configured).
    if (env.RATE_LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      try {
        const { success } = await env.RATE_LIMITER.limit({ key: ip });
        if (!success) {
          return jsonResponse(
            { error: "Rate limit exceeded. Try again shortly.", fallback: true },
            429,
            origin
          );
        }
      } catch (_) {
        // If the limiter errors, fail open — don't block the demo over it.
      }
    }

    if (!env.GROQ_API_KEY) {
      return jsonResponse({ error: "Server not configured.", fallback: true }, 500, origin);
    }

    // Parse and validate input.
    let payload;
    try {
      payload = await request.json();
    } catch (_) {
      return jsonResponse({ error: "Invalid JSON body.", fallback: true }, 400, origin);
    }

    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!message) {
      return jsonResponse({ error: "Missing 'message'.", fallback: true }, 400, origin);
    }
    const language = ["pt", "en", "es"].includes(payload.language) ? payload.language : "pt";
    const trimmedMessage = message.slice(0, MAX_MESSAGE_CHARS);

    // Call Groq.
    try {
      const groqRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: buildMessages(trimmedMessage, language, payload.history),
          max_tokens: MAX_TOKENS,
          temperature: 0.6,
        }),
      });

      if (!groqRes.ok) {
        // Includes Groq's own 429s (quota) — tell the frontend to fall back.
        return jsonResponse(
          { error: `Upstream error (${groqRes.status}).`, fallback: true },
          502,
          origin
        );
      }

      const data = await groqRes.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        return jsonResponse({ error: "Empty response.", fallback: true }, 502, origin);
      }

      return jsonResponse({ reply }, 200, origin);
    } catch (err) {
      return jsonResponse({ error: "Proxy failure.", fallback: true }, 502, origin);
    }
  },
};
