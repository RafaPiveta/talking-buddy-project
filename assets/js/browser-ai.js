// Browser-only AI layer. It runs an open model in the user's browser through WebLLM/WebGPU.
(function () {
  const DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
  const DEFAULT_LIGHT_MODEL = "SmolLM2-360M-Instruct-q4f16_1-MLC";
  const DEFAULT_CDN = "https://esm.run/@mlc-ai/web-llm";

  const PROJECT_CONTEXTS = {
    pt: `
Talking Buddy e um prototipo de assistente conversacional desenvolvido como TCC de Engenharia da Computacao na PUCPR.
O projeto valida uma arquitetura local/offline para voz e IA, com foco em privacidade, hardware acessivel e experiencia multimodal.
Componentes principais: Raspberry Pi 5, microfone USB, tela touch de 7 polegadas, leitor RFID MFRC522, UPS Hat com baterias 18650, extrator HDMI, amplificador PAM8610, alto-falante e case impresso em 3D.
Fluxo tecnico do prototipo: wake word "hey buddy", VAD, STT, LLM, TTS, banco de dados local, perfis por RFID, memoria, traducao e RAG.
Resultados do TCC incluem autonomia de 222 minutos, resposta do modelo ja carregado em cerca de 2,09 segundos, meta de voz abaixo de 0,2 RTF e consultas ao banco abaixo de 50 ms.
`,
    en: `
Talking Buddy is a conversational assistant prototype developed as a Computer Engineering final project at PUCPR.
The project validates a local/offline voice and AI architecture focused on privacy, accessible hardware and a multimodal user experience.
Main components: Raspberry Pi 5, USB microphone, 7-inch touch screen, MFRC522 RFID reader, UPS Hat with 18650 batteries, HDMI audio extractor, PAM8610 amplifier, speaker and 3D-printed case.
Technical flow: "hey buddy" wake word, VAD, STT, LLM, TTS, local database, RFID profiles, memory, translation and RAG.
Reported results include 222 minutes of battery autonomy, around 2.09 seconds for warm model response, a voice target below 0.2 RTF and local database queries below 50 ms.
`,
    es: `
Talking Buddy es un prototipo de asistente conversacional desarrollado como trabajo final de Ingenieria de Computacion en PUCPR.
El proyecto valida una arquitectura local/offline de voz e IA, con foco en privacidad, hardware accesible y experiencia multimodal.
Componentes principales: Raspberry Pi 5, microfono USB, pantalla tactil de 7 pulgadas, lector RFID MFRC522, UPS Hat con baterias 18650, extractor de audio HDMI, amplificador PAM8610, altavoz y carcasa impresa en 3D.
Flujo tecnico: wake word "hey buddy", VAD, STT, LLM, TTS, base de datos local, perfiles por RFID, memoria, traduccion y RAG.
Los resultados del TCC incluyen 222 minutos de autonomia, respuesta del modelo ya cargado en cerca de 2,09 segundos, meta de voz por debajo de 0,2 RTF y consultas a la base de datos local por debajo de 50 ms.
`,
  };

  const state = {
    engine: null,
    loading: null,
    model: "",
    lastStatus: "",
    statusListeners: new Set(),
  };

  function prefersLightModel() {
    const memory = Number(navigator.deviceMemory || 0);
    const cores = Number(navigator.hardwareConcurrency || 0);

    return Boolean(
      (memory && memory <= 4) ||
      (cores && cores <= 4)
    );
  }

  function isCompactTouchDevice() {
    return Boolean(
      window.matchMedia?.("(max-width: 920px)")?.matches &&
      window.matchMedia?.("(pointer: coarse)")?.matches
    );
  }

  function shouldUseLocalBaseOnly(userConfig = window.TALKING_BUDDY_BROWSER_AI || {}) {
    const memory = Number(navigator.deviceMemory || 0);
    const cores = Number(navigator.hardwareConcurrency || 0);
    const minMemory = Number(userConfig.minimumDeviceMemoryGB || 4);
    const minCores = Number(userConfig.minimumHardwareConcurrency || 4);

    return Boolean(
      userConfig.localBaseOnlyOnWeakDevices !== false &&
      (
        isCompactTouchDevice() ||
        (memory && memory < minMemory) ||
        (cores && cores < minCores)
      )
    );
  }

  function config() {
    const userConfig = window.TALKING_BUDDY_BROWSER_AI || {};
    const preferredModel = userConfig.preferredModel || DEFAULT_MODEL;
    const lightModel = userConfig.lightModel || DEFAULT_LIGHT_MODEL;
    const modelSetting = userConfig.model || "auto";
    const localBaseOnly = shouldUseLocalBaseOnly(userConfig);

    return {
      enabled: userConfig.enabled !== false && !localBaseOnly,
      disabledReason: localBaseOnly ? "weak-device" : "",
      model: modelSetting === "auto" ? (prefersLightModel() ? lightModel : preferredModel) : modelSetting,
      prewarm: userConfig.prewarm !== false,
      prewarmDesktopIdle: userConfig.prewarmDesktopIdle !== false,
      cdn: userConfig.cdn || DEFAULT_CDN,
    };
  }

  function hasWebGpu() {
    return Boolean(window.isSecureContext && navigator.gpu);
  }

  function languageInstruction(language) {
    if (language === "en") {
      return "The site's active language is English. Reply ONLY in English. Do not answer in Portuguese or Spanish unless the user explicitly asks for translation.";
    }
    if (language === "es") {
      return "El idioma activo del sitio es espanol. Responde SOLO en espanol. No respondas en portugues ni en ingles, salvo que el usuario pida una traduccion.";
    }
    return "O idioma ativo do site e portugues do Brasil. Responda SOMENTE em portugues do Brasil, salvo se o usuario pedir uma traducao.";
  }

  function projectContext(language) {
    return PROJECT_CONTEXTS[language] || PROJECT_CONTEXTS.pt;
  }

  function systemRules(language) {
    if (language === "en") {
      return [
        "You are Talking Buddy in a public web demo.",
        "Always speak as the Talking Buddy assistant. Never say you are one of the authors, a student or a project developer.",
        "Do not use the authors' proper names in the answer. If authorship is relevant, use generic terms such as 'the authors' or 'the project team'.",
        "Be helpful, natural, polite and concise. Answer general questions, not only questions about the project.",
        "When the question is about Talking Buddy, use the project context below and do not invent details that contradict the final project report.",
        "If the question requires real-time current information, be transparent about that limitation if you are not sure.",
      ];
    }
    if (language === "es") {
      return [
        "Eres Talking Buddy en una demo web publica.",
        "Habla siempre como el asistente Talking Buddy. Nunca digas que eres uno de los autores, un alumno o un desarrollador del proyecto.",
        "No uses nombres propios de los autores en la respuesta. Si la autoria es relevante, usa terminos genericos como 'los autores' o 'el equipo del proyecto'.",
        "Se util, natural, educado y objetivo. Responde preguntas generales, no solo preguntas sobre el proyecto.",
        "Cuando la pregunta sea sobre Talking Buddy, usa el contexto del proyecto abajo y no inventes datos que contradigan el informe final.",
        "Si la pregunta requiere informacion actual en tiempo real, se transparente sobre esa limitacion si no estas seguro.",
      ];
    }
    return [
      "Voce e o Talking Buddy em uma demo web publica.",
      "Fale sempre como o assistente Talking Buddy. Nunca diga que voce e um dos autores, aluno ou desenvolvedor do projeto.",
      "Nao use nomes proprios dos autores na resposta. Se precisar falar de autoria, use termos genericos como 'os autores' ou 'a equipe do projeto'.",
      "Seja util, natural, educado e objetivo. Responda perguntas gerais, nao apenas perguntas sobre o projeto.",
      "Quando a pergunta for sobre o Talking Buddy, use o contexto do projeto abaixo e nao invente dados que contradigam o TCC.",
      "Se a pergunta exigir informacao atual em tempo real, seja transparente sobre a limitacao caso voce nao tenha certeza.",
    ];
  }

  function cleanText(text, limit = 1800) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function userMessageForLanguage(message, language) {
    if (language === "en") {
      return `The site is currently in English. Answer only in English, even if the question is written in another language.\n\nUser question: ${message}`;
    }
    if (language === "es") {
      return `El sitio esta actualmente en espanol. Responde solo en espanol, aunque la pregunta este escrita en otro idioma.\n\nPregunta del usuario: ${message}`;
    }
    return `O site esta atualmente em portugues do Brasil. Responda somente em portugues do Brasil, mesmo que a pergunta esteja em outro idioma.\n\nPergunta do usuario: ${message}`;
  }

  function buildSystemPrompt(language, memory = {}) {
    const memoryLines = [];
    if (language === "en") {
      if (memory.name) memoryLines.push(`Remembered user name: ${cleanText(memory.name, 120)}.`);
      if (memory.lastRoutine) memoryLines.push(`Remembered routine information: ${cleanText(memory.lastRoutine, 180)}.`);
    } else if (language === "es") {
      if (memory.name) memoryLines.push(`Nombre recordado del usuario: ${cleanText(memory.name, 120)}.`);
      if (memory.lastRoutine) memoryLines.push(`Informacion de rutina recordada: ${cleanText(memory.lastRoutine, 180)}.`);
    } else {
      if (memory.name) memoryLines.push(`Nome lembrado do usuario: ${cleanText(memory.name, 120)}.`);
      if (memory.lastRoutine) memoryLines.push(`Informacao lembrada da rotina: ${cleanText(memory.lastRoutine, 180)}.`);
    }

    return [
      ...systemRules(language),
      languageInstruction(language),
      memoryLines.length ? memoryLines.join(" ") : "",
      language === "en" ? "Project context:" : language === "es" ? "Contexto del proyecto:" : "Contexto do projeto:",
      projectContext(language),
      languageInstruction(language),
    ].filter(Boolean).join("\n\n");
  }

  function sanitizeHistory(history) {
    if (!Array.isArray(history)) return [];
    return history
      .slice(-6)
      .map((item) => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        content: cleanText(item?.content),
      }))
      .filter((item) => item.content);
  }

  function watchStatus(onStatus) {
    if (typeof onStatus !== "function") return () => {};
    state.statusListeners.add(onStatus);
    if (state.lastStatus) onStatus(state.lastStatus);
    return () => state.statusListeners.delete(onStatus);
  }

  function report(text) {
    if (!text) return;
    state.lastStatus = text;
    state.statusListeners.forEach((listener) => {
      try {
        listener(text);
      } catch (error) {
        console.warn(error);
      }
    });
  }

  async function ensureEngine(onStatus) {
    const stopWatching = watchStatus(onStatus);
    const currentConfig = config();
    let createdLoading = false;

    try {
      if (!currentConfig.enabled) throw new Error("Browser AI disabled.");
      if (!hasWebGpu()) throw new Error("WebGPU unavailable.");
      if (state.engine && state.model === currentConfig.model) {
        report("IA local pronta.");
        return state.engine;
      }
      if (state.loading) return await state.loading;

      state.model = currentConfig.model;
      createdLoading = true;
      state.loading = (async () => {
        report("carregando biblioteca de IA local...");
        const webllm = await import(currentConfig.cdn);
        report("preparando modelo local no navegador...");

        const engine = await webllm.CreateMLCEngine(currentConfig.model, {
          initProgressCallback: (progress) => {
            report(progress?.text || "baixando modelo local...");
          },
        });

        state.engine = engine;
        report("IA local pronta.");
        return engine;
      })();

      return await state.loading;
    } finally {
      if (createdLoading) state.loading = null;
      stopWatching();
    }
  }

  function canPrewarm() {
    const currentConfig = config();
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return Boolean(currentConfig.enabled && currentConfig.prewarm && hasWebGpu() && !connection?.saveData);
  }

  async function prewarm({ onStatus } = {}) {
    if (!canPrewarm()) return false;
    await ensureEngine(onStatus);
    return true;
  }

  async function ask({ message, language = "pt", memory = {}, history = [], onStatus } = {}) {
    const engine = await ensureEngine(onStatus);
    const cleanMessage = cleanText(message, 2400);
    if (!cleanMessage) throw new Error("Empty message.");

    const response = await engine.chat.completions.create({
      messages: [
        { role: "system", content: buildSystemPrompt(language, memory) },
        ...sanitizeHistory(history),
        { role: "user", content: userMessageForLanguage(cleanMessage, language) },
      ],
      temperature: 0.7,
      max_tokens: 450,
    });

    return cleanText(response?.choices?.[0]?.message?.content, 2600);
  }

  window.TalkingBuddyBrowserAI = {
    isConfigured: () => config().enabled,
    isSupported: hasWebGpu,
    canPrewarm,
    disabledReason: () => config().disabledReason,
    model: () => config().model,
    prewarm,
    ask,
  };
})();
