# Talking Buddy — chat proxy (Cloudflare Worker)

Small backend for the website's live demo chat. The site is static (GitHub
Pages) and can't safely hold an API key, so this Worker holds the Groq key as a
server-side secret, rate-limits per IP, and forwards chat requests to Groq.

```
browser (site chat)  ->  this Worker (secret + rate limit)  ->  Groq API
```

The API key is **never** in this folder — it lives on Cloudflare, set once via
the CLI. This folder is safe to commit. (It is not published to the site; the
Pages workflow only copies `index.html` + `assets/`.)

## Files

- `wrangler.jsonc` — Worker config (name, entry point, rate-limit binding).
- `src/index.js` — the Worker: CORS, per-IP rate limit, Groq call.

## Deploy (from inside this folder)

All commands use `npx wrangler` — no global install needed (needs Wrangler 4.36+).

```bash
cd worker

# 1. Link the CLI to your Cloudflare account (opens a browser, one time).
npx wrangler login

# 2. Deploy. The FIRST deploy is interactive — it asks you to register a free
#    *.workers.dev subdomain. Accept it. It then prints your Worker URL, e.g.
#    https://talking-buddy-proxy.<your-subdomain>.workers.dev
npx wrangler deploy

# 3. Store your Groq key as a secret (prompts you to paste it; not echoed).
npx wrangler secret put GROQ_API_KEY

# 4. Redeploy is NOT needed after setting a secret — it's live immediately.
```

Sanity check: open the Worker URL in a browser — a GET returns a plain-text
"proxy is running" message.

## Local testing (optional)

```bash
# Put your key in worker/.dev.vars (gitignored):
echo 'GROQ_API_KEY=gsk_your_key_here' > .dev.vars

npx wrangler dev
# then POST to the local URL it prints, e.g.:
curl -X POST http://localhost:8787 \
  -H 'Content-Type: application/json' \
  -d '{"message":"Olá, o que é o Talking Buddy?","language":"pt"}'
```

## API

`POST` JSON:

```json
{ "message": "user text", "language": "pt|en|es", "history": [ {"role":"user|assistant","content":"..."} ] }
```

Response: `{ "reply": "..." }` on success, or `{ "error": "...", "fallback": true }`
on any failure (quota 429, upstream error, etc.). The website treats any
non-200 / `fallback` response as "use the local answer base instead."

## Tuning

- **Model** — `MODEL` in `src/index.js` (`llama-3.1-8b-instant` default; or
  `llama-3.3-70b-versatile` for quality).
- **Token budget** — `MAX_TOKENS`, `MAX_HISTORY_TURNS` in `src/index.js`. Kept
  small because the free tier is ~6K tokens/min for the 8b model.
- **Rate limit** — `ratelimits` in `wrangler.jsonc` (`limit` per `period`
  seconds; `period` must be 10 or 60). Per-IP.
- **Allowed origins** — `ALLOWED_ORIGINS` in `src/index.js`. Add a custom
  domain here if the site moves off `*.github.io`.
