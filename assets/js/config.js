// Public frontend configuration only. No API keys are needed for browser-local AI.
window.TALKING_BUDDY_BROWSER_AI = {
  enabled: true,
  model: "auto",
  preferredModel: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  lightModel: "SmolLM2-360M-Instruct-q4f16_1-MLC",
  prewarm: true,
  prewarmDesktopIdle: true,
  cdn: "https://esm.run/@mlc-ai/web-llm",
};
