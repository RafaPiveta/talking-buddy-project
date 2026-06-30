// Demo local da seção "Experimente": simula o comportamento do projeto físico.
(function () {
  const canvas = document.getElementById("robot-canvas");
  const log = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const micBtn = document.getElementById("mic-btn");
  const statusEl = document.getElementById("bot-status");
  const errEl = document.getElementById("mic-err");

  if (!canvas || !log || !form || !input || !micBtn || !statusEl || !errEl) return;

  const robot = typeof RobotAvatar === "function" ? new RobotAvatar("robot-canvas") : null;
  if (robot) {
    window.robotAvatar = robot;
    const resizeRobot = () => safeRobot(() => robot.resizeCanvas());
    const parent = canvas.parentElement || canvas;

    if ("ResizeObserver" in window) {
      new ResizeObserver(resizeRobot).observe(parent);
    }

    requestAnimationFrame(resizeRobot);
    window.addEventListener("beforeunload", () => safeRobot(() => robot.destroy()));
  }

  const state = {
    listening: false,
    busy: false,
    recognition: null,
    memory: loadMemory(),
    responseMode: "Local",
    speechUnavailable: false,
    speechUnavailableReason: "",
  };

  let availableVoices = [];

  const knowledgeBase = [
    {
      title: "Resumo do projeto",
      terms: ["resumo", "o que é", "talking buddy", "projeto", "objetivo", "tcc"],
      answer:
        "O Talking Buddy é um assistente de voz offline baseado em Edge AI. Ele usa um Raspberry Pi 5 para coordenar reconhecimento de fala, modelo de linguagem, síntese de voz, interface touch, RFID e banco SQLite local.",
      detail:
        "O objetivo do TCC foi validar se um pipeline conversacional completo poderia rodar localmente em hardware acessível, preservando privacidade e mantendo uma experiência multimodal aceitável.",
    },
    {
      title: "Pipeline de IA",
      terms: ["pipeline", "stt", "tts", "llm", "whisper", "gemma", "supertonic", "ollama", "modelo"],
      answer:
        "O pipeline é: openWakeWord detecta 'hey buddy', o VAD grava a fala útil, Whisper.cpp transcreve, Gemma 3:1B via Ollama gera a resposta e Supertonic 2 sintetiza a voz.",
      detail:
        "A resposta é enviada em streaming: quando frases completas aparecem, o TTS já pode começar a falar antes de todo o texto final terminar.",
    },
    {
      title: "Hardware",
      terms: ["hardware", "raspberry", "pi 5", "bateria", "ups", "touch", "tela", "alto-falante", "amplificador", "microfone"],
      answer:
        "O hardware central é um Raspberry Pi 5 de 8 GB. Ele conversa com microfone USB, tela touch de 7 polegadas, leitor RFID MFRC522, UPS Hat com baterias 18650, extrator HDMI, amplificador PAM8610 e alto-falante.",
      detail:
        "A escolha favoreceu periféricos reconhecidos pelo Linux para reduzir integração customizada e manter o protótipo simples de manter.",
    },
    {
      title: "RFID e perfis",
      terms: ["rfid", "perfil", "usuário", "usuario", "cartão", "cartao", "personalidade", "idioma"],
      answer:
        "O RFID simula uma troca física de perfil. Ao aproximar um cartão, o sistema carrega usuário, idioma, personalidade, histórico e preferências no SQLite.",
      detail:
        "Nos testes, a troca validou isolamento de contexto: um usuário não herda conversa ou preferências de outro.",
    },
    {
      title: "RAG",
      terms: ["rag", "especialização", "especializacao", "base", "documento", "conhecimento", "busca"],
      answer:
        "O RAG permite especializar um perfil com uma base de conhecimento. Quando a intenção pede consulta, o sistema busca trechos relevantes e injeta esse contexto no prompt do LLM.",
      detail:
        "No projeto, isso foi usado para aproximar o assistente de domínios específicos sem precisar retreinar o modelo.",
    },
    {
      title: "Memória",
      terms: ["memória", "memoria", "lembrar", "lembra", "histórico", "historico", "sqlite", "contexto"],
      answer:
        "A memória combina histórico recente e fatos estruturados. O sistema recupera as últimas mensagens e também pode guardar fatos do usuário em segundo plano para consultas futuras.",
      detail:
        "O relatório descreve uma etapa síncrona de recuperação e uma etapa assíncrona de armazenamento, evitando travar a resposta falada.",
    },
    {
      title: "Tradução",
      terms: ["tradução", "traducao", "tradutor", "inglês", "ingles", "espanhol", "idioma"],
      answer:
        "O modo tradutor transforma o assistente em ponte entre português, inglês e espanhol. Ele transcreve a fala, traduz sem responder ao conteúdo e mostra os dois lados da conversa.",
      detail:
        "Esse modo ignora RAG e memória para reduzir latência e manter a tarefa estritamente como tradução.",
    },
    {
      title: "Resultados",
      terms: ["resultado", "teste", "latência", "latencia", "ttft", "rtf", "autonomia", "temperatura", "desempenho"],
      answer:
        "Os testes mediram wake word, fluxo conversacional, troca RFID, autonomia, latência de STT, inferência do LLM, RTF do TTS, telemetria térmica e consulta SQLite.",
      detail:
        "Alguns marcos: Gemma 3:1B teve melhor equilíbrio entre qualidade e consistência de idioma, a bateria chegou a 222 minutos e o SQLite ficou abaixo da meta de 50 ms no P95.",
    },
    {
      title: "Limitações",
      terms: ["limitação", "limitacao", "problema", "dificuldade", "latência", "lento", "gargalo", "futuro"],
      answer:
        "A limitação principal foi a latência de uma solução totalmente local rodando só em CPU. O protótipo provou viabilidade, mas não esconde esse trade-off.",
      detail:
        "Os próximos passos sugeridos são acelerador de IA, SSD NVMe e, depois, visão computacional local com uma câmera dedicada.",
    },
    {
      title: "Software",
      terms: ["software", "flask", "python", "interface", "kiosk", "admin", "banco", "arquitetura"],
      answer:
        "O software foi organizado em módulos Python, com interface web local em modo kiosk. Flask/Werkzeug coordenam rotas e eventos, enquanto SQLite armazena perfis, histórico e preferências.",
      detail:
        "A interface evoluiu de telas administrativas simples para chat, avatar animado, teclado virtual, RAG, tradutor e gestão de usuários.",
    },
    {
      title: "Case 3D",
      terms: ["case", "gabinete", "cad", "solidworks", "impressão", "impressao", "pla", "modelagem"],
      answer:
        "O gabinete foi modelado em SolidWorks e impresso em PLA. Ele acomoda tela, alto-falante, ventilação, alça, Raspberry Pi, UPS, RFID e acessos externos.",
      detail:
        "O case foi redesenhado depois que o empilhamento real de baterias e módulos não coube no invólucro inicial.",
    },
  ];

  const generalKnowledgeBase = [
    {
      title: "Programação e web",
      terms: ["programacao", "programar", "codigo", "html", "css", "javascript", "python", "bug", "site", "github", "repositorio"],
      answer:
        "Posso ajudar com programação em nível conceitual. Para um site estático, a divisão mais simples é: HTML para estrutura, CSS para aparência e JavaScript para interação.",
      detail:
        "Se a dúvida for um bug, descreva o comportamento esperado, o que aconteceu e o trecho de código. Aí eu consigo sugerir uma hipótese e um caminho de teste.",
    },
    {
      title: "Inteligência artificial",
      terms: ["ia", "inteligencia artificial", "machine learning", "deep learning", "modelo", "treinamento", "prompt", "chatgpt"],
      answer:
        "IA, nesse contexto, é o uso de modelos capazes de reconhecer padrões e gerar saídas úteis, como transcrever fala, responder texto ou sintetizar voz.",
      detail:
        "No Talking Buddy, a ideia foi combinar modelos especializados em um pipeline local: wake word, STT, LLM e TTS, em vez de depender de uma única API na nuvem.",
    },
    {
      title: "Eletrônica e prototipagem",
      terms: ["eletronica", "circuito", "sensor", "raspberry", "arduino", "protoboard", "bateria", "tensao", "corrente"],
      answer:
        "Em prototipagem eletrônica, vale separar alimentação, sinais e comunicação. Primeiro confirme tensões, depois corrente disponível e por fim compatibilidade lógica dos módulos.",
      detail:
        "No projeto, essa lógica aparece na escolha do UPS Hat, conversores, amplificador de áudio, RFID e tela touch compatíveis com o Raspberry Pi.",
    },
    {
      title: "Estudo e TCC",
      terms: ["estudo", "tcc", "relatorio", "apresentacao", "slide", "metodologia", "conclusao", "objetivo geral"],
      answer:
        "Para organizar um TCC técnico, uma estrutura boa é: problema, objetivo, arquitetura, implementação, metodologia de testes, resultados e limitações.",
      detail:
        "O Talking Buddy segue essa lógica: primeiro define a motivação de privacidade, depois mostra arquitetura offline, protótipo físico, software e validação experimental.",
    },
    {
      title: "Privacidade digital",
      terms: ["privacidade", "dados", "nuvem", "seguranca", "offline", "local"],
      answer:
        "Privacidade digital melhora quando menos dados sensíveis saem do dispositivo. Processamento local reduz exposição, mas ainda exige cuidado com armazenamento, permissões e logs.",
      detail:
        "Por isso o projeto enfatiza Edge AI: áudio, histórico e preferências permanecem no equipamento em vez de serem enviados a servidores externos.",
    },
    {
      title: "Explicação simples",
      terms: ["explique", "explica", "como funciona", "o que significa", "me ajuda", "ajuda"],
      answer:
        "Posso explicar de forma simples. Um bom caminho é quebrar o assunto em três partes: o que é, para que serve e como funciona na prática.",
      detail:
        "Se você me disser o tema exato, eu tento responder nesse formato, usando exemplos curtos e conectando com o projeto quando fizer sentido.",
    },
  ];

  function normalize(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function loadMemory() {
    try {
      return JSON.parse(localStorage.getItem("talkingBuddyDemoMemory") || "{}");
    } catch (error) {
      return {};
    }
  }

  function saveMemory() {
    localStorage.setItem("talkingBuddyDemoMemory", JSON.stringify(state.memory));
  }

  function safeRobot(fn) {
    try {
      if (robot) fn();
    } catch (error) {
      console.warn(error);
    }
  }

  function setStatus(text) {
    statusEl.textContent = translateUi(text);
  }

  function setBusy(active) {
    state.busy = active;
    input.disabled = active;
    micBtn.disabled = active || state.speechUnavailable;
    form.querySelector(".send").disabled = active;
  }

  function setResponseMode(mode) {
    state.responseMode = mode;
    setStatus(mode);
  }

  function showError(message) {
    errEl.classList.remove("exp__err--info");
    errEl.hidden = !message;
    errEl.textContent = message || "";
  }

  function showInfo(message) {
    errEl.classList.add("exp__err--info");
    errEl.hidden = !message;
    errEl.textContent = message || "";
  }

  function addMessage(text, who, options = {}) {
    const div = document.createElement("div");
    div.className = "msg " + who + (options.thinking ? " thinking" : "");
    div.textContent = translateUi(text);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function translateUi(text) {
    return window.TalkingBuddyI18n?.translate?.(text) || text;
  }

  function rememberFrom(text) {
    const normalized = normalize(text);
    const originalNameMatch = text.match(/\b(meu nome é|meu nome e|me chamo|sou o|sou a)\s+([A-Za-zÀ-ÿ0-9 ]{2,40})/i);
    const nameMatch = normalized.match(/\b(meu nome e|me chamo|sou o|sou a)\s+([a-z0-9 ]{2,40})/);
    if (nameMatch) {
      const originalName = originalNameMatch ? originalNameMatch[2] : nameMatch[2];
      state.memory.name = originalName.trim().split(" ").slice(0, 3).join(" ");
      saveMemory();
      return `Memória curta atualizada: vou lembrar que você é ${state.memory.name}.`;
    }

    const medMatch = normalized.match(/\b(tomei|tomo|preciso tomar)\s+(.{3,80})/);
    if (medMatch) {
      state.memory.lastRoutine = medMatch[0];
      saveMemory();
      return "Memória curta atualizada: registrei essa informação de rotina nesta demo local.";
    }

    return "";
  }

  function answerMemoryQuestion(text) {
    const normalized = normalize(text);
    if (normalized.includes("qual meu nome") || normalized.includes("meu nome")) {
      if (state.memory.name) return `Você me disse que seu nome é ${state.memory.name}.`;
      return "Ainda não sei seu nome. Diga algo como: meu nome é Rafael.";
    }

    if (normalized.includes("o que voce lembra") || normalized.includes("lembra de mim")) {
      const facts = [];
      if (state.memory.name) facts.push(`nome: ${state.memory.name}`);
      if (state.memory.lastRoutine) facts.push(`rotina: ${state.memory.lastRoutine}`);
      return facts.length ? `Nesta demo eu lembro de ${facts.join("; ")}.` : "Ainda não guardei nenhum fato nesta sessão.";
    }

    return "";
  }

  function retrieveFrom(base, text, minimumScore = 1) {
    const query = normalize(text);
    const genericTerms = new Set(["resumo", "o que e", "projeto", "objetivo", "tcc", "talking buddy"]);
    const scored = base
      .map((item) => {
        const score = item.terms.reduce((total, term) => {
          const nTerm = normalize(term);
          if (!query.includes(nTerm)) return total;
          const base = genericTerms.has(nTerm) ? 1 : 3;
          return total + base + nTerm.split(" ").length;
        }, 0);
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored[0].score >= minimumScore ? scored[0] : null;
  }

  function retrieve(text) {
    const query = normalize(text);
    const hasProjectSignal = [
      "talking buddy",
      "projeto",
      "tcc",
      "raspberry",
      "whisper",
      "gemma",
      "supertonic",
      "rfid",
      "rag",
      "sqlite",
      "wake word",
      "offline",
      "case",
      "gabinete",
    ].some((term) => query.includes(term));

    const item = retrieveFrom(knowledgeBase, text, hasProjectSignal ? 1 : 3);
    if (!hasProjectSignal && item?.title === "Resumo do projeto") return null;
    return item;
  }

  function retrieveGeneral(text) {
    return retrieveFrom(generalKnowledgeBase, text, 2);
  }

  function buildReply(text) {
    const stored = rememberFrom(text);
    if (stored) {
      setResponseMode("Memória");
      return stored;
    }

    const memoryAnswer = answerMemoryQuestion(text);
    if (memoryAnswer) {
      setResponseMode("Memória");
      return memoryAnswer;
    }

    const normalized = normalize(text);
    if (["oi", "ola", "bom dia", "boa tarde", "boa noite", "hello", "hi", "hola"].some((greet) => normalized.includes(greet))) {
      setResponseMode("Assistente");
      return "Oi! Posso explicar o Talking Buddy por hardware, software, resultados, RAG, memória, tradução, testes ou também ajudar com perguntas gerais simples.";
    }

    if (normalized.includes("traduza")) {
      setResponseMode("Tradução");
      return "No protótipo físico eu entraria no modo tradutor e apenas traduziria, sem responder ao comando. Nesta demo estática eu não faço tradução completa, mas simulo o comportamento e explico a arquitetura.";
    }

    const calculation = answerSimpleCalculation(text);
    if (calculation) {
      setResponseMode("Cálculo");
      return calculation;
    }

    const item = retrieve(text);
    if (item) {
      setResponseMode(item.title);
      return item.answer;
    }

    const generalItem = retrieveGeneral(text);
    if (generalItem) {
      setResponseMode(generalItem.title);
      return generalItem.answer;
    }

    setResponseMode("Resposta local");
    return buildHelpfulFallback(text);
  }

  function answerSimpleCalculation(text) {
    const normalized = normalize(text);
    if (!/\b(quanto|calcule|calcular|conta|resultado|mais|menos|vezes|dividido)\b/.test(normalized)) return "";

    const expression = text
      .toLowerCase()
      .replace(/,/g, ".")
      .replace(/quanto e|quanto é|calcule|calcular|qual o resultado de|resultado de/gi, "")
      .replace(/mais/g, "+")
      .replace(/menos/g, "-")
      .replace(/vezes|x/g, "*")
      .replace(/dividido por|dividido/g, "/")
      .match(/[0-9+\-*/().\s]+/)?.[0]
      ?.trim();

    if (!expression || !/^[0-9+\-*/().\s]+$/.test(expression) || !/[+\-*/]/.test(expression)) return "";

    try {
      const value = Function(`"use strict"; return (${expression});`)();
      if (!Number.isFinite(value)) return "";
      return `O resultado é ${Number(value.toFixed(6)).toLocaleString("pt-BR")}.`;
    } catch (error) {
      return "";
    }
  }

  function buildHelpfulFallback(text) {
    const normalized = normalize(text);

    if (/\b(hoje|agora|atual|noticia|preco|cotacao|presidente|clima)\b/.test(normalized)) {
      return "Eu não tenho acesso à internet nem a dados em tempo real nesta demo local. Posso explicar o conceito por trás da pergunta, mas para fatos atuais é melhor conferir uma fonte atualizada.";
    }

    if (/\b(como|porque|por que|explique|explica)\b/.test(normalized)) {
      return "Posso tentar por raciocínio geral: divida o tema em causa, funcionamento e consequência. Se você mandar a pergunta com um pouco mais de contexto, eu respondo de forma mais direta.";
    }

    return "Posso tentar ajudar, mas esta demo é local e não consulta uma API geral. Me dê um pouco mais de contexto ou pergunte em termos de hardware, software, IA, privacidade, TCC, testes ou programação.";
  }

  function sendMessage(rawText) {
    if (state.busy) return;
    const text = rawText.trim();
    if (!text) return;

    showError("");
    setBusy(true);
    addMessage(text, "user");
    input.value = "";

    safeRobot(() => {
      robot.setState("thinking");
      robot.setEmotion("curious");
    });
    setStatus("Processando");
    const thinking = addMessage("consultando base local...", "bot", { thinking: true });

    window.setTimeout(() => {
      const reply = buildReply(text);
      thinking.remove();
      addMessage(reply, "bot");
      speakReply(reply);
    }, 520);
  }

  function refreshVoices() {
    if (!("speechSynthesis" in window)) return [];
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) availableVoices = voices;
    return availableVoices;
  }

  function scoreVoice(voice) {
    const name = normalize(`${voice.name} ${voice.voiceURI || ""}`);
    const lang = (voice.lang || "").toLowerCase();
    const maleHints = [
      "felipe",
      "daniel",
      "antonio",
      "joao",
      "thiago",
      "rafael",
      "paulo",
      "bruno",
      "luciano",
      "jorge",
      "carlos",
      "male",
      "masculino",
      "homem",
      "man",
    ];
    const femaleHints = [
      "luciana",
      "joana",
      "maria",
      "helena",
      "francisca",
      "female",
      "feminino",
      "mulher",
      "woman",
    ];

    let score = 0;
    if (lang === "pt-br") score += 60;
    else if (lang.startsWith("pt")) score += 42;
    else if (lang.startsWith("en")) score += 6;

    if (maleHints.some((hint) => name.includes(hint))) score += 100;
    if (femaleHints.some((hint) => name.includes(hint))) score -= 80;
    if (voice.localService) score += 4;
    if (voice.default) score += 2;
    return score;
  }

  function preferredMasculineVoice() {
    return refreshVoices()
      .filter((voice) => (voice.lang || "").toLowerCase().startsWith("pt"))
      .sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
  }

  function speakReply(text) {
    safeRobot(() => {
      robot.setState("speaking");
      robot.setEmotion("happy");
      robot.speakText(text);
    });
    setStatus(state.responseMode || "Resposta");

    if (!("speechSynthesis" in window)) {
      window.setTimeout(stopSpeaking, Math.min(6500, text.length * 45));
      return;
    }

    const startedAt = performance.now();
    const minimumLockMs = Math.min(9000, Math.max(2200, text.length * 38));
    let finished = false;
    const finishAfterMinimum = () => {
      if (finished) return;
      finished = true;
      const elapsed = performance.now() - startedAt;
      window.setTimeout(stopSpeaking, Math.max(0, minimumLockMs - elapsed));
    };

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.94;
    utterance.pitch = 0.72;
    utterance.volume = 1;

    const voice = preferredMasculineVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = finishAfterMinimum;
    utterance.onerror = finishAfterMinimum;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    safeRobot(() => robot.setState("idle"));
    setBusy(false);
    setStatus("Pronto");
  }

  function setListening(active) {
    state.listening = active;
    micBtn.classList.toggle("listening", active);
    if (!state.busy) micBtn.disabled = state.speechUnavailable;

    if (active) {
      setStatus("Escuta");
      safeRobot(() => {
        robot.setState("listening");
        robot.setEmotion("curious");
      });
      return;
    }

    if (statusEl.textContent === "Escuta") setStatus("Pronto");
    safeRobot(() => {
      if (robot.state === "listening") robot.setState("idle");
    });
  }

  function focusTextFallback() {
    input.disabled = false;
    window.setTimeout(() => input.focus({ preventScroll: true }), 80);
  }

  function submitTranscript(transcript) {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) {
      showError("Não ouvi nada. Tente novamente.");
      focusTextFallback();
      return;
    }

    input.value = cleanTranscript;
    requestAnimationFrame(() => sendMessage(cleanTranscript));
  }

  function finishRecognition(recognition) {
    if (state.recognition === recognition) state.recognition = null;
    setListening(false);
  }

  function speechRecognitionErrorMessage(error) {
    if (error === "not-allowed" || error === "service-not-allowed") {
      return "Permissão de microfone negada. Libere o microfone para este site e tente novamente.";
    }
    if (error === "no-speech") {
      return "Não ouvi nada. Tente novamente.";
    }
    if (error === "audio-capture") {
      return "Não consegui acessar o microfone. Confira se ele não está em uso por outro aplicativo.";
    }
    if (error === "network") {
      return "O navegador liberou o microfone, mas não conseguiu transformar sua fala em texto. Tente abrir a demo no Chrome, Edge ou Safari, ou continue digitando sua pergunta.";
    }
    return "Não consegui transcrever o áudio neste navegador. Tente novamente ou digite a pergunta.";
  }

  function setSpeechAvailability(message) {
    state.speechUnavailable = !!message;
    state.speechUnavailableReason = message || "";
    micBtn.disabled = state.busy || state.speechUnavailable;
    micBtn.classList.toggle("is-unavailable", state.speechUnavailable);
    micBtn.title = state.speechUnavailable ? "Microfone indisponível neste navegador" : "Falar";
    micBtn.setAttribute("aria-label", state.speechUnavailable ? "Microfone indisponível neste navegador" : "Falar");

    if (state.speechUnavailable) {
      input.placeholder = "Digite sua pergunta sobre o Talking Buddy...";
      showInfo(message);
    }
  }

  async function isBraveBrowser() {
    try {
      return typeof navigator !== "undefined" && !!navigator.brave && await navigator.brave.isBrave();
    } catch (error) {
      return false;
    }
  }

  async function speechCompatibilityMessage(SpeechRecognition) {
    if (!window.isSecureContext) {
      return "Microfone requer HTTPS ou localhost.";
    }

    if (!SpeechRecognition) {
      return "Este navegador não consegue transformar sua fala em texto nesta demo. Abra no Chrome, Edge ou Safari, ou digite sua pergunta.";
    }

    if (await isBraveBrowser()) {
      return "Neste navegador, a fala pode não virar texto na demo. Para usar o microfone, abra no Chrome, Edge ou Safari; por aqui, continue pelo campo de texto.";
    }

    return "";
  }

  async function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (state.listening) return;

    const compatibilityMessage = await speechCompatibilityMessage(SpeechRecognition);
    if (compatibilityMessage) {
      setSpeechAvailability(compatibilityMessage);
      focusTextFallback();
      return;
    }

    const recognition = new SpeechRecognition();
    state.recognition = recognition;
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let submitted = false;
    let hadError = false;
    let interimTranscript = "";
    let finalTranscript = "";

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result && result[0] ? result[0].transcript.trim() : "";
        if (!transcript) continue;
        if (result.isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript = transcript;
        }
      }

      if (finalTranscript && !submitted) {
        submitted = true;
        finishRecognition(recognition);
        submitTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      hadError = true;
      finishRecognition(recognition);
      showError(speechRecognitionErrorMessage(event.error || ""));
      focusTextFallback();
    };

    recognition.onend = () => {
      finishRecognition(recognition);

      if (hadError || submitted) return;

      const transcript = finalTranscript || interimTranscript;
      if (transcript) {
        submitted = true;
        submitTranscript(transcript);
        return;
      }

      showError("Não ouvi nada. Tente novamente.");
      focusTextFallback();
    };

    try {
      recognition.start();
      setListening(true);
    } catch (error) {
      showError("Não consegui iniciar a escuta por voz.");
      setListening(false);
      focusTextFallback();
    }
  }

  function stopListening() {
    if (state.recognition) {
      try {
        state.recognition.stop();
      } catch (error) {
        console.warn(error);
      }
    }
    setListening(false);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  micBtn.addEventListener("click", () => {
    if (state.busy) return;
    if (state.speechUnavailable) {
      showInfo(state.speechUnavailableReason);
      focusTextFallback();
      return;
    }
    showError("");
    if (state.listening) {
      stopListening();
      return;
    }
    startListening();
  });

  (async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const compatibilityMessage = await speechCompatibilityMessage(SpeechRecognition);
    setSpeechAvailability(compatibilityMessage);
  })();

  if ("speechSynthesis" in window) {
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
})();
