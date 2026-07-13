// Public front-end config for the "Experimente" demo. No secrets here.

// Live chat proxy (Cloudflare Worker). It holds the Groq API key server-side
// and forwards chat requests; the browser only talks to this URL. Backend
// lives in /worker. Safe to edit and commit. If the site moves to a custom
// domain, also add that origin to ALLOWED_ORIGINS in worker/src/index.js.
window.TALKING_BUDDY_CHAT = {
  enabled: true,
  proxyUrl: "https://talking-buddy-proxy.waifuisalie.workers.dev",
  timeoutMs: 25000,
};

// Browser-local AI (WebLLM) is disabled — kept for reference only, not loaded.
window.TALKING_BUDDY_BROWSER_AI = {
  enabled: false,
  model: "auto",
  cdn: "https://esm.run/@mlc-ai/web-llm",
};
