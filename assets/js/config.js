// Browser-local AI is intentionally disabled. The demo uses only the local answer base.
window.TALKING_BUDDY_BROWSER_AI = {
  enabled: false,
  model: "auto",
  preferredModel: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  lightModel: "SmolLM2-360M-Instruct-q4f16_1-MLC",
  localBaseOnlyOnWeakDevices: true,
  minimumDeviceMemoryGB: 4,
  minimumHardwareConcurrency: 4,
  prewarm: false,
  prewarmDesktopIdle: false,
  cdn: "https://esm.run/@mlc-ai/web-llm",
};
