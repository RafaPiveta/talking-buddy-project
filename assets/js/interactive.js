// Demo local da seção "Experimente": simula o comportamento do projeto físico.
(function () {
  const canvas = document.getElementById("robot-canvas");
  const log = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const micBtn = document.getElementById("mic-btn");
  const voiceToggle = document.getElementById("voice-toggle");
  const statusEl = document.getElementById("bot-status");
  const errEl = document.getElementById("mic-err");

  if (!canvas || !log || !form || !input || !micBtn || !voiceToggle || !statusEl || !errEl) return;

  const defaultVoiceVolume = 0.8;
  const voiceSettingsVersion = "20260703-live-mute";

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

  ensureVoiceSettingsDefaults();
  const loadedVoiceVolume = loadVoiceVolume();
  const loadedVoiceMuted = loadVoiceMuted();
  const initialVoiceMuted = loadedVoiceMuted || loadedVoiceVolume <= 0;
  const initialVoiceVolume = initialVoiceMuted ? 0 : loadedVoiceVolume;

  const state = {
    listening: false,
    busy: false,
    recognition: null,
    memory: loadMemory(),
    chatHistory: [],
    responseMode: "Local",
    speechUnavailable: false,
    speechUnavailableReason: "",
    micPermissionGranted: loadMicPermissionSession(),
    voiceMuted: initialVoiceMuted,
    voiceVolume: initialVoiceVolume,
    speaking: false,
    speechTimer: null,
    currentUtterance: null,
    speechChunks: [],
    speechChunkIndex: 0,
    speechRunId: 0,
    activeSpeechChunkStartedAt: 0,
    activeSpeechChunkDuration: 0,
    activeSpeechChunkText: "",
    speechVoice: null,
    aiPrewarmStarted: false,
  };

  const aiConfig = {
    historyLimit: 8,
    timeoutMs: 180000,
  };

  let availableVoices = [];

  const localizedText = {
    pt: {
      thinking: "consultando base local...",
      thinkingAi: "Pensando...",
      aiFallback: "A IA local não conseguiu responder neste navegador; continuei com a base local da demo.",
      aiNotConfigured: "A IA local do navegador não está disponível aqui; respondi com a base local da demo.",
      aiStageLibrary: "Pensando...",
      aiStageModel: "Calculando...",
      aiStageDownload: "Carregando modelo local...",
      aiStageReady: "Respondendo...",
      memoryUpdatedName: "Memória curta atualizada: vou lembrar que você é {{name}}.",
      memoryUpdatedRoutine: "Memória curta atualizada: registrei essa informação de rotina nesta demo local.",
      nameKnown: "Você me disse que seu nome é {{name}}.",
      nameUnknown: "Ainda não sei seu nome. Diga algo como: meu nome é Ana.",
      rememberedFacts: "Nesta demo eu lembro de {{facts}}.",
      rememberedNone: "Ainda não guardei nenhum fato nesta sessão.",
      greeting: "Oi! Posso explicar o Talking Buddy por hardware, software, resultados, RAG, memória, tradução, testes ou também ajudar com perguntas gerais simples.",
      translateMode: "No protótipo físico eu entraria no modo tradutor e apenas traduziria, sem responder ao comando. Nesta demo estática eu simulo esse comportamento e explico a arquitetura.",
      calculationResult: "O resultado é {{value}}.",
      realtimeLimit: "Eu não tenho acesso à internet nem a dados em tempo real nesta demo local. Posso explicar o conceito por trás da pergunta, mas para fatos atuais é melhor conferir uma fonte atualizada.",
      reasoningFallback: "Posso responder por raciocínio geral: {{subject}} pode ser entendido olhando para causa, funcionamento e consequência. Se você trouxer mais contexto, eu deixo a resposta mais específica.",
      generalFallback: "Minha melhor resposta local é esta: {{subject}} parece ser o tema central da pergunta. Eu posso explicar o conceito, organizar passos, comparar opções ou relacionar isso ao Talking Buddy, mas fatos atuais precisam de uma fonte externa.",
      subjectFallback: "essa pergunta",
      noSpeech: "Não ouvi nada. Tente novamente.",
      permissionDenied: "Permissão de microfone negada. Libere o microfone para este site e tente novamente.",
      noMicAccess: "Não consegui acessar o microfone. Confira se ele não está em uso por outro aplicativo.",
      networkError: "O navegador liberou o microfone, mas não conseguiu transformar sua fala em texto. Para usar por voz, tente Chrome, Edge ou Safari; se preferir, continue digitando.",
      transcriptionGeneric: "Não consegui transformar o áudio em texto neste navegador. Tente novamente ou digite a pergunta.",
      insecureContext: "O microfone precisa de HTTPS ou localhost para funcionar.",
      unsupportedSpeech: "Este navegador não consegue transformar fala em texto nesta demo. Use Chrome, Edge ou Safari, ou continue digitando.",
      braveSpeech: "Neste navegador, a demo pode não conseguir transformar fala em texto. Para usar o microfone, abra no Chrome, Edge ou Safari; por aqui, continue pelo campo de texto.",
      micUnavailable: "Microfone indisponível neste navegador",
      speak: "Falar",
      muteVoice: "Mutar voz",
      unmuteVoice: "Ativar voz",
      textFallbackPlaceholder: "Digite sua pergunta sobre o Talking Buddy...",
      defaultPlaceholder: "Pergunte sobre o Talking Buddy...",
      startFail: "Não consegui iniciar a escuta por voz.",
    },
    en: {
      thinking: "checking the local base...",
      thinkingAi: "Thinking...",
      aiFallback: "Local AI could not answer in this browser; I continued with the demo's local base.",
      aiNotConfigured: "Browser-local AI is not available here; I answered with the demo's local base.",
      aiStageLibrary: "Thinking...",
      aiStageModel: "Calculating...",
      aiStageDownload: "Loading local model...",
      aiStageReady: "Answering...",
      memoryUpdatedName: "Short memory updated: I will remember that you are {{name}}.",
      memoryUpdatedRoutine: "Short memory updated: I saved that routine detail in this local demo.",
      nameKnown: "You told me your name is {{name}}.",
      nameUnknown: "I do not know your name yet. Say something like: my name is Ana.",
      rememberedFacts: "In this demo I remember {{facts}}.",
      rememberedNone: "I have not stored any facts in this session yet.",
      greeting: "Hi! I can explain Talking Buddy by hardware, software, results, RAG, memory, translation, tests, or help with simple general questions.",
      translateMode: "In the physical prototype I would enter translator mode and only translate, without answering the command. In this static demo I simulate that behavior and explain the architecture.",
      calculationResult: "The result is {{value}}.",
      realtimeLimit: "I do not have internet access or real-time data in this local demo. I can explain the concept behind the question, but current facts should be checked with an up-to-date source.",
      reasoningFallback: "I can answer with general reasoning: {{subject}} can be understood through cause, operation and consequence. If you add more context, I can make the answer more specific.",
      generalFallback: "My best local answer is this: {{subject}} seems to be the central topic. I can explain the concept, organize steps, compare options or relate it to Talking Buddy, but current facts need an external source.",
      subjectFallback: "this question",
      noSpeech: "I did not hear anything. Try again.",
      permissionDenied: "Microphone permission was denied. Allow the microphone for this site and try again.",
      noMicAccess: "I could not access the microphone. Check whether another app is using it.",
      networkError: "The browser allowed the microphone, but could not turn speech into text. For voice input, try Chrome, Edge or Safari; otherwise, keep typing.",
      transcriptionGeneric: "I could not turn the audio into text in this browser. Try again or type your question.",
      insecureContext: "The microphone needs HTTPS or localhost to work.",
      unsupportedSpeech: "This browser cannot turn speech into text in this demo. Use Chrome, Edge or Safari, or keep typing.",
      braveSpeech: "In this browser, the demo may not be able to turn speech into text. To use the microphone, open it in Chrome, Edge or Safari; here, keep using the text field.",
      micUnavailable: "Microphone unavailable in this browser",
      speak: "Speak",
      muteVoice: "Mute voice",
      unmuteVoice: "Unmute voice",
      textFallbackPlaceholder: "Type your question about Talking Buddy...",
      defaultPlaceholder: "Ask about Talking Buddy...",
      startFail: "I could not start voice listening.",
    },
    es: {
      thinking: "consultando la base local...",
      thinkingAi: "Pensando...",
      aiFallback: "La IA local no pudo responder en este navegador; continué con la base local de la demo.",
      aiNotConfigured: "La IA local del navegador no está disponible aquí; respondí con la base local de la demo.",
      aiStageLibrary: "Pensando...",
      aiStageModel: "Calculando...",
      aiStageDownload: "Cargando modelo local...",
      aiStageReady: "Respondiendo...",
      memoryUpdatedName: "Memoria corta actualizada: recordaré que eres {{name}}.",
      memoryUpdatedRoutine: "Memoria corta actualizada: guardé esa información de rutina en esta demo local.",
      nameKnown: "Me dijiste que tu nombre es {{name}}.",
      nameUnknown: "Todavía no sé tu nombre. Di algo como: mi nombre es Ana.",
      rememberedFacts: "En esta demo recuerdo {{facts}}.",
      rememberedNone: "Todavía no guardé ningún dato en esta sesión.",
      greeting: "¡Hola! Puedo explicar Talking Buddy por hardware, software, resultados, RAG, memoria, traducción, pruebas o ayudar con preguntas generales simples.",
      translateMode: "En el prototipo físico entraría en modo traductor y solo traduciría, sin responder al comando. En esta demo estática simulo ese comportamiento y explico la arquitectura.",
      calculationResult: "El resultado es {{value}}.",
      realtimeLimit: "No tengo acceso a internet ni a datos en tiempo real en esta demo local. Puedo explicar el concepto detrás de la pregunta, pero los datos actuales deben verificarse en una fuente actualizada.",
      reasoningFallback: "Puedo responder con razonamiento general: {{subject}} puede entenderse mirando causa, funcionamiento y consecuencia. Si agregas más contexto, hago la respuesta más específica.",
      generalFallback: "Mi mejor respuesta local es esta: {{subject}} parece ser el tema central. Puedo explicar el concepto, ordenar pasos, comparar opciones o relacionarlo con Talking Buddy, pero los datos actuales necesitan una fuente externa.",
      subjectFallback: "esta pregunta",
      noSpeech: "No escuché nada. Inténtalo de nuevo.",
      permissionDenied: "Permiso de micrófono denegado. Habilita el micrófono para este sitio e inténtalo de nuevo.",
      noMicAccess: "No pude acceder al micrófono. Comprueba si otra aplicación lo está usando.",
      networkError: "El navegador permitió el micrófono, pero no pudo convertir tu voz en texto. Para usar voz, prueba Chrome, Edge o Safari; si prefieres, continúa escribiendo.",
      transcriptionGeneric: "No pude convertir el audio en texto en este navegador. Inténtalo de nuevo o escribe la pregunta.",
      insecureContext: "El micrófono necesita HTTPS o localhost para funcionar.",
      unsupportedSpeech: "Este navegador no puede convertir voz en texto en esta demo. Usa Chrome, Edge o Safari, o continúa escribiendo.",
      braveSpeech: "En este navegador, la demo puede no lograr convertir voz en texto. Para usar el micrófono, abre en Chrome, Edge o Safari; aquí, continúa usando el campo de texto.",
      micUnavailable: "Micrófono no disponible en este navegador",
      speak: "Hablar",
      muteVoice: "Silenciar voz",
      unmuteVoice: "Activar voz",
      textFallbackPlaceholder: "Escribe tu pregunta sobre Talking Buddy...",
      defaultPlaceholder: "Pregunta sobre Talking Buddy...",
      startFail: "No pude iniciar la escucha por voz.",
    },
  };

  const knowledgeBase = [
    {
      title: "Resumo do projeto",
      terms: ["resumo", "o que é", "talking buddy", "projeto", "objetivo", "tcc"],
      answer:
        "O Talking Buddy é um assistente de voz offline que escuta, transforma fala em texto, interpreta a pergunta e responde por voz no próprio protótipo. A ideia central é preservar privacidade sem depender de uma nuvem para conversar.",
      detail:
        "O objetivo do TCC foi validar se um fluxo conversacional completo poderia rodar localmente em hardware acessível, preservando privacidade e mantendo uma experiência multimodal aceitável.",
    },
    {
      title: "Pipeline de IA",
      terms: ["pipeline", "stt", "tts", "llm", "whisper", "gemma", "supertonic", "ollama", "modelo"],
      answer:
        "O fluxo de IA funciona em camadas: o assistente detecta o comando 'hey buddy', grava apenas a fala útil, transforma áudio em texto, gera a resposta com um modelo de linguagem e depois converte o texto em voz.",
      detail:
        "A resposta é enviada em partes: quando frases completas aparecem, o motor de voz já pode começar a falar antes de todo o texto final terminar.",
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
        "O RFID permite uma troca física de perfil. Ao aproximar um cartão, o sistema carrega usuário, idioma, histórico e preferências no banco de dados local.",
      detail:
        "Nos testes, a troca validou isolamento de contexto: um usuário não herda conversa ou preferências de outro.",
    },
    {
      title: "RAG",
      terms: ["rag", "especialização", "especializacao", "base", "documento", "conhecimento", "busca"],
      answer:
        "O RAG permite especializar um perfil com uma base de conhecimento. Antes de responder, o sistema busca trechos relevantes e entrega esse contexto ao modelo de linguagem.",
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
        "Esse modo ignora bases de conhecimento e memória para reduzir latência e manter a tarefa estritamente como tradução.",
    },
    {
      title: "Resultados",
      terms: ["resultado", "teste", "latência", "latencia", "ttft", "rtf", "autonomia", "temperatura", "desempenho"],
      answer:
        "Os testes mediram ativação por voz, fluxo conversacional, troca por cartão, autonomia, tempo de transcrição, tempo de resposta do modelo, geração de voz, estabilidade térmica e consulta ao banco de dados.",
      detail:
        "Alguns marcos: o modelo escolhido teve melhor equilíbrio entre qualidade e consistência de idioma, a bateria chegou a 222 minutos e o banco de dados ficou abaixo da meta de 50 ms nos piores casos observados.",
    },
    {
      title: "Limitações",
      terms: ["limitação", "limitacao", "problema", "dificuldade", "latência", "lento", "gargalo", "futuro"],
      answer:
        "Como protótipo local, o Talking Buddy precisou equilibrar privacidade, custo e tempo de resposta. A validação mostrou que a arquitetura funciona, mas também apontou caminhos de melhoria para versões futuras.",
      detail:
        "Os próximos passos sugeridos são armazenamento mais rápido, aceleração dedicada para IA e, depois, visão computacional local com uma câmera dedicada.",
    },
    {
      title: "Software",
      terms: ["software", "flask", "python", "interface", "kiosk", "admin", "banco", "arquitetura"],
      answer:
        "O software foi organizado em módulos Python, com uma interface web local em tela cheia. O sistema coordena rotas, eventos, banco de dados local, histórico, perfis e preferências do usuário.",
      detail:
        "A interface evoluiu de telas administrativas simples para chat, avatar animado, teclado virtual, bases de conhecimento, tradutor e gestão de usuários.",
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
        "No Talking Buddy, a ideia foi combinar modelos especializados em um fluxo local: ativação por voz, transcrição, resposta textual e voz sintetizada, em vez de depender de uma única API na nuvem.",
    },
    {
      title: "Eletrônica e prototipagem",
      terms: ["eletronica", "circuito", "sensor", "raspberry", "arduino", "protoboard", "bateria", "tensao", "corrente"],
      answer:
        "Em prototipagem eletrônica, vale separar alimentação, sinais e comunicação. Primeiro confirme tensões, depois corrente disponível e por fim compatibilidade lógica dos módulos.",
      detail:
        "No projeto, essa lógica aparece na escolha do módulo de energia, conversores, amplificador de áudio, RFID e tela touch compatíveis com a placa principal.",
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
        "Por isso o projeto enfatiza IA local: áudio, histórico e preferências permanecem no equipamento em vez de serem enviados a servidores externos.",
    },
    {
      title: "Explicação simples",
      terms: ["explique", "explica", "como funciona", "o que significa", "me ajuda", "ajuda"],
      answer:
        "Posso explicar de forma simples. Um bom caminho é quebrar o assunto em três partes: o que é, para que serve e como funciona na prática.",
      detail:
        "Se você me disser o tema exato, eu tento responder nesse formato, usando exemplos curtos e conectando com o projeto quando fizer sentido.",
    },
    {
      title: "GitHub Pages",
      terms: ["github pages", "github.io", "publicar", "deploy", "repositorio", "dominio"],
      answer:
        "No GitHub Pages, um site de projeto normalmente fica em usuario.github.io/repositorio. Para uma URL raiz, use um repositório usuario.github.io ou configure um domínio próprio.",
      detail:
        "Como este site usa caminhos relativos para assets, ele tende a funcionar tanto em um site de projeto quanto em um site raiz.",
    },
    {
      title: "Ciência básica",
      terms: ["ceu azul", "céu azul", "fotossintese", "fotossíntese", "gravidade", "energia", "luz"],
      answer:
        "Em ciência básica, a resposta costuma depender do fenômeno físico ou biológico envolvido. Por exemplo: o céu parece azul porque a atmosfera espalha mais a luz azul, e a fotossíntese transforma luz, água e CO2 em energia química para a planta.",
      detail:
        "Se a pergunta for específica, eu consigo explicar em camadas: versão curta, analogia e detalhe técnico.",
    },
    {
      title: "História e Brasil",
      terms: ["brasil", "cabral", "descobriu", "independencia", "capital", "brasilia"],
      answer:
        "Para referências gerais do Brasil: a capital é Brasília; a chegada portuguesa de 1500 costuma ser associada a Pedro Álvares Cabral, lembrando que povos indígenas já habitavam o território.",
      detail:
        "Para datas, personagens ou interpretações históricas mais específicas, vale conferir uma fonte atualizada e confiável.",
    },
    {
      title: "Organização de resposta",
      terms: ["compare", "comparar", "vantagem", "desvantagem", "passo a passo", "roteiro", "lista"],
      answer:
        "Posso organizar a resposta em passos: primeiro defina o objetivo, depois liste restrições, compare alternativas e escolha a opção que reduz risco sem complicar a manutenção.",
      detail:
        "Esse formato combina bem com engenharia, porque separa decisão técnica de preferência estética ou conveniência.",
    },
    {
      title: "Matemática básica",
      terms: ["matematica", "matemática", "porcentagem", "percentual", "regra de tres", "regra de três", "media", "média", "formula"],
      answers: {
        pt: "Para matemática básica, eu resolvo melhor quando a pergunta traz os números. Por exemplo: porcentagem é parte dividida pelo todo; média é soma dos valores dividida pela quantidade; regra de três compara duas proporções.",
        en: "For basic math, I work best when the question includes the numbers. For example: percentage is part divided by total; average is the sum of values divided by the count; rule of three compares two proportions.",
        es: "Para matemática básica, funciono mejor cuando la pregunta trae los números. Por ejemplo: porcentaje es parte dividida por el total; promedio es suma de valores dividida por cantidad; regla de tres compara dos proporciones.",
      },
    },
    {
      title: "Porcentagem",
      terms: ["quanto e 10", "quanto é 10", "desconto", "aumento percentual", "por cento", "%"],
      answers: {
        pt: "Para porcentagem, transforme o percentual em decimal e multiplique. Exemplo: 10% de 80 é 0,10 x 80 = 8. Para desconto, subtraia esse valor do preço original.",
        en: "For percentages, turn the percentage into a decimal and multiply. Example: 10% of 80 is 0.10 x 80 = 8. For a discount, subtract that value from the original price.",
        es: "Para porcentajes, convierte el porcentaje en decimal y multiplica. Ejemplo: 10% de 80 es 0,10 x 80 = 8. Para descuento, resta ese valor del precio original.",
      },
    },
    {
      title: "Git e GitHub",
      terms: ["git", "commit", "branch", "push", "pull request", "merge", "clone", "versionamento"],
      answers: {
        pt: "Git guarda o histórico do código. Um fluxo simples é: criar uma branch, alterar arquivos, fazer commit com uma mensagem clara, testar e enviar com push. No GitHub, o pull request organiza revisão e merge.",
        en: "Git stores code history. A simple flow is: create a branch, change files, commit with a clear message, test and push. On GitHub, a pull request organizes review and merge.",
        es: "Git guarda el historial del código. Un flujo simple es: crear una rama, cambiar archivos, hacer commit con un mensaje claro, probar y enviar con push. En GitHub, el pull request organiza revisión y merge.",
      },
    },
    {
      title: "HTML, CSS e JavaScript",
      terms: ["html", "css", "javascript", "responsivo", "layout", "frontend", "dom", "botao", "botão"],
      answers: {
        pt: "Em uma página estática, HTML define a estrutura, CSS define aparência e responsividade, e JavaScript cuida de comportamento: carrossel, chat, animações, troca de idioma e lightbox.",
        en: "In a static page, HTML defines structure, CSS defines appearance and responsiveness, and JavaScript handles behavior: carousel, chat, animations, language switching and lightbox.",
        es: "En una página estática, HTML define la estructura, CSS define apariencia y responsividad, y JavaScript maneja comportamiento: carrusel, chat, animaciones, cambio de idioma y lightbox.",
      },
    },
    {
      title: "APIs",
      terms: ["api", "rest", "endpoint", "json", "requisição", "requisicao", "fetch", "backend"],
      answers: {
        pt: "Uma API é uma ponte entre sistemas. Em web, o frontend envia uma requisição para um endpoint, geralmente recebe JSON e usa essa resposta para atualizar a interface.",
        en: "An API is a bridge between systems. On the web, the frontend sends a request to an endpoint, usually receives JSON and uses that response to update the interface.",
        es: "Una API es un puente entre sistemas. En web, el frontend envía una solicitud a un endpoint, normalmente recibe JSON y usa esa respuesta para actualizar la interfaz.",
      },
    },
    {
      title: "Banco de dados",
      terms: ["banco de dados", "database", "sqlite", "sql", "tabela", "consulta", "query", "indice", "índice"],
      answers: {
        pt: "Banco de dados organiza informação em estruturas consultáveis. No Talking Buddy, ele guarda perfis, histórico e preferências localmente, reduzindo dependência externa e mantendo a aplicação simples.",
        en: "A database organizes information into queryable structures. In Talking Buddy, it stores profiles, history and preferences locally, reducing external dependency and keeping the app simple.",
        es: "Una base de datos organiza información en estructuras consultables. En Talking Buddy, guarda perfiles, historial y preferencias localmente, reduciendo dependencia externa y manteniendo la aplicación simple.",
      },
    },
    {
      title: "Redes",
      terms: ["rede", "wifi", "ip", "porta", "localhost", "http", "https", "dns", "roteador"],
      answers: {
        pt: "Em redes, IP identifica o dispositivo, porta identifica o serviço, DNS traduz nomes em endereços e HTTPS protege a comunicação. Localhost aponta para a própria máquina.",
        en: "In networking, IP identifies the device, port identifies the service, DNS translates names into addresses and HTTPS protects communication. Localhost points to the same machine.",
        es: "En redes, IP identifica el dispositivo, puerto identifica el servicio, DNS traduce nombres a direcciones y HTTPS protege la comunicación. Localhost apunta a la propia máquina.",
      },
    },
    {
      title: "Segurança digital",
      terms: ["segurança", "seguranca", "senha", "criptografia", "permissao", "permissão", "vulnerabilidade", "ataque"],
      answers: {
        pt: "Segurança digital combina prevenção e redução de impacto: use senhas fortes, atualizações, permissões mínimas, HTTPS e logs sem dados sensíveis. Processamento local ajuda, mas não substitui boas práticas.",
        en: "Digital security combines prevention and impact reduction: use strong passwords, updates, minimal permissions, HTTPS and logs without sensitive data. Local processing helps, but does not replace good practices.",
        es: "La seguridad digital combina prevención y reducción de impacto: usa contraseñas fuertes, actualizaciones, permisos mínimos, HTTPS y registros sin datos sensibles. El procesamiento local ayuda, pero no reemplaza buenas prácticas.",
      },
    },
    {
      title: "Raspberry Pi",
      terms: ["raspberry pi", "raspberry", "gpio", "linux embarcado", "single board", "placa unica", "placa única"],
      answers: {
        pt: "Raspberry Pi é um computador de placa única. No projeto, ele centraliza interface, áudio, RFID, banco local e modelos de IA, funcionando como o cérebro do protótipo.",
        en: "Raspberry Pi is a single-board computer. In the project, it centralizes interface, audio, RFID, local database and AI models, acting as the prototype's brain.",
        es: "Raspberry Pi es un computador de placa única. En el proyecto, centraliza interfaz, audio, RFID, base local y modelos de IA, funcionando como el cerebro del prototipo.",
      },
    },
    {
      title: "Linux",
      terms: ["linux", "terminal", "serviço", "servico", "systemd", "permissões linux", "shell", "bash"],
      answers: {
        pt: "No Linux, o terminal permite instalar pacotes, executar scripts, verificar logs e automatizar serviços. Em protótipos embarcados, systemd ajuda a iniciar o software junto com o sistema.",
        en: "On Linux, the terminal lets you install packages, run scripts, check logs and automate services. In embedded prototypes, systemd helps start the software with the system.",
        es: "En Linux, la terminal permite instalar paquetes, ejecutar scripts, revisar logs y automatizar servicios. En prototipos embebidos, systemd ayuda a iniciar el software junto con el sistema.",
      },
    },
    {
      title: "Impressão 3D",
      terms: ["impressao 3d", "impressão 3d", "pla", "filamento", "fatiamento", "slicer", "camada", "suporte"],
      answers: {
        pt: "Na impressão 3D, o modelo CAD vira camadas por um slicer. PLA é fácil de imprimir e bom para protótipos, mas acabamento, tolerâncias e ventilação precisam ser considerados no desenho do case.",
        en: "In 3D printing, the CAD model becomes layers through a slicer. PLA is easy to print and good for prototypes, but finishing, tolerances and ventilation must be considered in the case design.",
        es: "En impresión 3D, el modelo CAD se convierte en capas mediante un slicer. PLA es fácil de imprimir y bueno para prototipos, pero acabado, tolerancias y ventilación deben considerarse en el diseño del case.",
      },
    },
    {
      title: "CAD e modelagem",
      terms: ["cad", "solidworks", "modelagem", "desenho tecnico", "desenho técnico", "dimensoes", "dimensões", "encaixe"],
      answers: {
        pt: "Em CAD, o ideal é começar por dimensões reais dos componentes, prever folgas, pontos de fixação, ventilação e acesso a portas. Depois vêm estética e refinamento.",
        en: "In CAD, it is best to start from the real dimensions of components, plan clearances, mounting points, ventilation and port access. Aesthetics and refinement come after that.",
        es: "En CAD, lo ideal es empezar por dimensiones reales de los componentes, prever holguras, puntos de fijación, ventilación y acceso a puertos. Luego vienen estética y refinamiento.",
      },
    },
    {
      title: "Áudio",
      terms: ["audio", "áudio", "microfone", "alto falante", "alto-falante", "amplificador", "ruido", "ruído", "volume"],
      answers: {
        pt: "Em sistemas de voz, a cadeia de áudio importa muito: captura limpa no microfone, processamento estável, amplificação adequada e alto-falante compatível reduzem falhas de escuta e melhoram a percepção do usuário.",
        en: "In voice systems, the audio chain matters a lot: clean microphone capture, stable processing, proper amplification and a compatible speaker reduce listening failures and improve user perception.",
        es: "En sistemas de voz, la cadena de audio importa mucho: captura limpia en el micrófono, procesamiento estable, amplificación adecuada y altavoz compatible reducen fallas de escucha y mejoran la percepción del usuario.",
      },
    },
    {
      title: "Energia e bateria",
      terms: ["bateria", "energia", "autonomia", "ups", "18650", "corrente", "tensao", "tensão", "consumo"],
      answers: {
        pt: "Para energia, confira tensão, corrente e consumo real. No Talking Buddy, o UPS Hat com células 18650 dá mobilidade, enquanto a autonomia foi validada em operação contínua.",
        en: "For power, check voltage, current and real consumption. In Talking Buddy, the UPS Hat with 18650 cells provides mobility, while autonomy was validated under continuous operation.",
        es: "Para energía, verifica tensión, corriente y consumo real. En Talking Buddy, el UPS Hat con celdas 18650 da movilidad, mientras la autonomía fue validada en operación continua.",
      },
    },
    {
      title: "Wake word",
      terms: ["wake word", "hey buddy", "ativacao por voz", "ativação por voz", "palavra de ativacao", "palavra de ativação"],
      answers: {
        pt: "Wake word é a palavra de ativação que mantém o assistente em espera até ouvir o comando. No projeto, openWakeWord detecta 'hey buddy' antes de iniciar a captura da fala.",
        en: "Wake word is the activation phrase that keeps the assistant waiting until it hears the command. In the project, openWakeWord detects 'hey buddy' before starting speech capture.",
        es: "Wake word es la palabra de activación que mantiene al asistente esperando hasta oír el comando. En el proyecto, openWakeWord detecta 'hey buddy' antes de iniciar la captura de voz.",
      },
    },
    {
      title: "STT, LLM e TTS",
      terms: ["stt", "tts", "llm", "transcricao", "transcrição", "sintese de voz", "síntese de voz", "modelo de linguagem"],
      answers: {
        pt: "Transcrição transforma fala em texto, o modelo de linguagem interpreta e gera resposta, e a síntese de voz transforma texto em áudio. O Talking Buddy junta essas etapas localmente para criar a conversa completa.",
        en: "Transcription turns speech into text, the language model interprets and generates an answer, and speech synthesis turns text into audio. Talking Buddy joins these steps locally to create the full conversation.",
        es: "La transcripción convierte voz en texto, el modelo de lenguaje interpreta y genera respuesta, y la síntesis de voz convierte texto en audio. Talking Buddy une estas etapas localmente para crear la conversación completa.",
      },
    },
    {
      title: "Modelos quantizados",
      terms: ["quantizado", "quantizacao", "quantização", "q4", "modelo pequeno", "edge ai", "inferência local", "inferencia local"],
      answers: {
        pt: "Quantização reduz o tamanho e o custo computacional do modelo, trocando um pouco de precisão por viabilidade em hardware menor. É uma técnica importante para Edge AI.",
        en: "Quantization reduces model size and computational cost, trading a bit of precision for feasibility on smaller hardware. It is an important technique for Edge AI.",
        es: "La cuantización reduce el tamaño y el costo computacional del modelo, cambiando algo de precisión por viabilidad en hardware menor. Es una técnica importante para Edge AI.",
      },
    },
    {
      title: "RAG explicado",
      terms: ["o que e rag", "o que é rag", "retrieval", "base de conhecimento", "documentos", "embeddings"],
      answers: {
        pt: "RAG significa geração aumentada por recuperação. Antes de responder, o sistema busca trechos relevantes em uma base e entrega esse contexto ao modelo, reduzindo respostas genéricas.",
        en: "RAG means retrieval-augmented generation. Before answering, the system searches relevant excerpts in a knowledge base and gives that context to the model, reducing generic answers.",
        es: "RAG significa generación aumentada por recuperación. Antes de responder, el sistema busca fragmentos relevantes en una base y entrega ese contexto al modelo, reduciendo respuestas genéricas.",
      },
    },
    {
      title: "Testes de software",
      terms: ["teste de software", "caixa branca", "caixa preta", "validacao", "validação", "qa", "bug"],
      answers: {
        pt: "Teste de caixa preta avalia comportamento visível ao usuário. Teste de caixa branca observa partes internas, como latência, consumo, banco e módulos. Juntos, eles dão uma validação mais completa.",
        en: "Black-box testing evaluates behavior visible to the user. White-box testing observes internal parts, such as latency, consumption, database and modules. Together, they provide broader validation.",
        es: "La prueba de caja negra evalúa el comportamiento visible al usuario. La prueba de caja blanca observa partes internas, como latencia, consumo, base de datos y módulos. Juntas, dan una validación más completa.",
      },
    },
    {
      title: "Escrita técnica",
      terms: ["escrita tecnica", "escrita técnica", "relatorio", "relatório", "abnt", "introducao", "introdução", "conclusao", "conclusão"],
      answers: {
        pt: "Em escrita técnica, seja direto: apresente problema, objetivo, método, implementação, resultados e conclusão. Evite prometer mais do que foi testado e conecte cada afirmação a evidências.",
        en: "In technical writing, be direct: present problem, objective, method, implementation, results and conclusion. Avoid promising more than was tested and connect each claim to evidence.",
        es: "En escritura técnica, sé directo: presenta problema, objetivo, método, implementación, resultados y conclusión. Evita prometer más de lo probado y conecta cada afirmación con evidencias.",
      },
    },
    {
      title: "Apresentação",
      terms: ["apresentacao", "apresentação", "slides", "banca", "pitch", "defesa", "demo"],
      answers: {
        pt: "Para apresentar o projeto, conte a história: problema de privacidade, proposta local, arquitetura, protótipo físico, software, testes e resultados. A demo deve aparecer cedo para prender atenção.",
        en: "To present the project, tell the story: privacy problem, local proposal, architecture, physical prototype, software, tests and results. The demo should appear early to capture attention.",
        es: "Para presentar el proyecto, cuenta la historia: problema de privacidad, propuesta local, arquitectura, prototipo físico, software, pruebas y resultados. La demo debe aparecer temprano para captar atención.",
      },
    },
    {
      title: "Metodologia",
      terms: ["metodologia", "metodo", "método", "experimento", "medicao", "medição", "amostra", "criterio", "critério"],
      answers: {
        pt: "Uma metodologia boa define o que será medido, em quais condições, com qual critério de sucesso e como os dados serão registrados. Isso torna o resultado defensável.",
        en: "A good methodology defines what will be measured, under which conditions, with which success criteria and how data will be recorded. That makes the result defensible.",
        es: "Una buena metodología define qué será medido, en qué condiciones, con qué criterio de éxito y cómo se registrarán los datos. Eso hace defendible el resultado.",
      },
    },
    {
      title: "Estatística básica",
      terms: ["estatistica", "estatística", "media", "mediana", "desvio", "percentil", "p95", "amostra"],
      answers: {
        pt: "Média resume tendência geral, mediana reduz efeito de extremos, desvio indica variação e P95 mostra um limite que 95% dos casos ficam abaixo. Em desempenho, P95 costuma ser mais útil que só média.",
        en: "Mean summarizes general tendency, median reduces the effect of outliers, deviation indicates variation and P95 shows a limit below which 95% of cases fall. In performance, P95 is often more useful than mean alone.",
        es: "Media resume tendencia general, mediana reduce efecto de extremos, desviación indica variación y P95 muestra un límite bajo el cual queda el 95% de los casos. En desempeño, P95 suele ser más útil que solo la media.",
      },
    },
    {
      title: "Física básica",
      terms: ["fisica", "física", "gravidade", "forca", "força", "velocidade", "calor", "temperatura"],
      answers: {
        pt: "Na física, força altera movimento, energia descreve capacidade de realizar trabalho, calor é transferência de energia térmica e temperatura indica agitação média das partículas.",
        en: "In physics, force changes motion, energy describes capacity to do work, heat is transfer of thermal energy and temperature indicates average particle agitation.",
        es: "En física, fuerza altera movimiento, energía describe capacidad de realizar trabajo, calor es transferencia de energía térmica y temperatura indica agitación media de las partículas.",
      },
    },
    {
      title: "Biologia básica",
      terms: ["biologia", "celula", "célula", "dna", "fotossintese", "fotossíntese", "evolucao", "evolução"],
      answers: {
        pt: "Na biologia, células são unidades básicas da vida, DNA armazena informação genética, fotossíntese converte luz em energia química e evolução explica mudanças nas populações ao longo do tempo.",
        en: "In biology, cells are basic units of life, DNA stores genetic information, photosynthesis converts light into chemical energy and evolution explains changes in populations over time.",
        es: "En biología, células son unidades básicas de la vida, ADN almacena información genética, fotosíntesis convierte luz en energía química y evolución explica cambios en poblaciones a lo largo del tiempo.",
      },
    },
    {
      title: "Química básica",
      terms: ["quimica", "química", "atomo", "átomo", "molecula", "molécula", "ph", "reacao", "reação"],
      answers: {
        pt: "Química estuda matéria e transformações. Átomos formam moléculas, reações reorganizam ligações e pH indica acidez ou basicidade de uma solução.",
        en: "Chemistry studies matter and transformations. Atoms form molecules, reactions reorganize bonds and pH indicates acidity or basicity of a solution.",
        es: "La química estudia materia y transformaciones. Átomos forman moléculas, reacciones reorganizan enlaces y pH indica acidez o basicidad de una solución.",
      },
    },
    {
      title: "Geografia",
      terms: ["geografia", "capital", "pais", "país", "continente", "mapa", "franca", "frança", "japao", "japão"],
      answers: {
        pt: "Posso responder referências geográficas comuns: França tem capital Paris, Japão tem capital Tóquio, Brasil tem capital Brasília e Argentina tem capital Buenos Aires.",
        en: "I can answer common geography references: France's capital is Paris, Japan's capital is Tokyo, Brazil's capital is Brasília and Argentina's capital is Buenos Aires.",
        es: "Puedo responder referencias geográficas comunes: Francia tiene capital París, Japón tiene capital Tokio, Brasil tiene capital Brasilia y Argentina tiene capital Buenos Aires.",
      },
    },
    {
      title: "História geral",
      terms: ["historia geral", "história geral", "segunda guerra", "revolucao industrial", "revolução industrial", "idade media", "idade média"],
      answers: {
        pt: "Em história, vale separar contexto, causas, evento e consequências. A Revolução Industrial mudou produção e trabalho; a Segunda Guerra Mundial redesenhou política, economia e tecnologia no século XX.",
        en: "In history, separate context, causes, event and consequences. The Industrial Revolution changed production and work; World War II reshaped politics, economics and technology in the 20th century.",
        es: "En historia, separa contexto, causas, evento y consecuencias. La Revolución Industrial cambió producción y trabajo; la Segunda Guerra Mundial rediseñó política, economía y tecnología en el siglo XX.",
      },
    },
    {
      title: "Português",
      terms: ["portugues", "português", "gramatica", "gramática", "crase", "virgula", "vírgula", "redacao", "redação"],
      answers: {
        pt: "Para revisar português, observe clareza, concordância, pontuação e repetição. Crase normalmente aparece quando há preposição 'a' mais artigo feminino 'a'. Vírgula organiza termos, mas não deve separar sujeito e verbo.",
        en: "For Portuguese review, check clarity, agreement, punctuation and repetition. Crase usually appears when preposition 'a' combines with feminine article 'a'. Commas organize terms, but should not separate subject and verb.",
        es: "Para revisar portugués, observa claridad, concordancia, puntuación y repetición. La crasis aparece normalmente cuando la preposición 'a' se une al artículo femenino 'a'. La coma organiza términos, pero no separa sujeto y verbo.",
      },
    },
    {
      title: "Inglês",
      terms: ["ingles", "inglês", "english", "traduzir para ingles", "traduza para ingles", "verbo to be"],
      answers: {
        pt: "Em inglês básico, comece por sujeito, verbo e complemento. O verbo 'to be' vira am, is ou are no presente. Para tradução, mande a frase específica que eu tento adaptar.",
        en: "In basic English, start with subject, verb and complement. The verb 'to be' becomes am, is or are in the present. For translation, send the specific sentence and I will try to adapt it.",
        es: "En inglés básico, empieza por sujeto, verbo y complemento. El verbo 'to be' se vuelve am, is o are en presente. Para traducción, envía la frase específica e intento adaptarla.",
      },
    },
    {
      title: "Espanhol",
      terms: ["espanhol", "español", "spanish", "traduzir para espanhol", "traduza para espanhol"],
      answers: {
        pt: "Em espanhol básico, muitas palavras parecem português, mas cuidado com falsos cognatos. Para uma tradução simples, mande a frase e eu devolvo uma versão natural.",
        en: "In basic Spanish, many words look like Portuguese, but beware of false cognates. For a simple translation, send the sentence and I will return a natural version.",
        es: "En español básico, muchas palabras se parecen al portugués, pero cuidado con falsos cognados. Para una traducción simple, envía la frase y devuelvo una versión natural.",
      },
    },
    {
      title: "Ética em IA",
      terms: ["etica", "ética", "ia responsavel", "ia responsável", "vies", "viés", "privacidade", "transparencia"],
      answers: {
        pt: "Ética em IA envolve privacidade, transparência, redução de vieses, segurança e responsabilidade. O Talking Buddy toca principalmente no ponto de privacidade ao manter dados e processamento no dispositivo.",
        en: "AI ethics involves privacy, transparency, bias reduction, safety and responsibility. Talking Buddy mainly addresses privacy by keeping data and processing on the device.",
        es: "La ética en IA incluye privacidad, transparencia, reducción de sesgos, seguridad y responsabilidad. Talking Buddy aborda principalmente privacidad al mantener datos y procesamiento en el dispositivo.",
      },
    },
    {
      title: "Produtividade",
      terms: ["produtividade", "organizar", "prioridade", "prioridades", "foco", "rotina", "planejamento"],
      answers: {
        pt: "Para produtividade, escolha poucas prioridades, quebre tarefas grandes em passos pequenos, defina um próximo gesto claro e revise o progresso no fim do dia.",
        en: "For productivity, choose a few priorities, break big tasks into small steps, define a clear next action and review progress at the end of the day.",
        es: "Para productividad, elige pocas prioridades, divide tareas grandes en pasos pequeños, define una próxima acción clara y revisa el progreso al final del día.",
      },
    },
    {
      title: "Comunicação",
      terms: ["comunicacao", "comunicação", "explicar", "mensagem", "email profissional", "argumento", "clareza"],
      answers: {
        pt: "Boa comunicação começa pelo objetivo da mensagem. Diga o contexto, o que você precisa, por que importa e qual é o próximo passo esperado.",
        en: "Good communication starts with the goal of the message. State the context, what you need, why it matters and what next step is expected.",
        es: "Buena comunicación empieza por el objetivo del mensaje. Di el contexto, lo que necesitas, por qué importa y cuál es el próximo paso esperado.",
      },
    },
    {
      title: "Economia básica",
      terms: ["economia", "inflacao", "inflação", "juros", "oferta", "demanda", "preco", "preço"],
      answers: {
        pt: "Economia básica observa escolhas sob recursos limitados. Oferta e demanda influenciam preços; inflação é aumento generalizado de preços; juros representam custo do dinheiro no tempo.",
        en: "Basic economics studies choices under limited resources. Supply and demand influence prices; inflation is a general rise in prices; interest represents the cost of money over time.",
        es: "Economía básica observa elecciones con recursos limitados. Oferta y demanda influyen precios; inflación es aumento generalizado de precios; interés representa costo del dinero en el tiempo.",
      },
    },
    {
      title: "Saúde e segurança",
      terms: ["saude", "saúde", "remedio", "remédio", "dor", "diagnostico", "diagnóstico", "emergencia", "emergência"],
      answers: {
        pt: "Posso explicar conceitos gerais de saúde, mas não substituo orientação médica. Em sintomas fortes, risco imediato ou dúvida sobre remédio, procure um profissional ou serviço de emergência.",
        en: "I can explain general health concepts, but I do not replace medical guidance. For strong symptoms, immediate risk or medication questions, seek a professional or emergency service.",
        es: "Puedo explicar conceptos generales de salud, pero no reemplazo orientación médica. Ante síntomas fuertes, riesgo inmediato o dudas sobre medicamento, busca un profesional o servicio de emergencia.",
      },
    },
    {
      title: "Perguntas atuais",
      terms: ["noticia", "notícia", "hoje", "agora", "atual", "cotacao", "cotação", "previsao do tempo", "previsão do tempo"],
      answers: {
        pt: "Para notícias, cotação, clima e fatos atuais, eu preciso de uma fonte em tempo real. Nesta demo local eu posso explicar o conceito, mas não confirmar dados atualizados.",
        en: "For news, exchange rates, weather and current facts, I need a real-time source. In this local demo I can explain the concept, but cannot confirm updated data.",
        es: "Para noticias, cotización, clima y hechos actuales, necesito una fuente en tiempo real. En esta demo local puedo explicar el concepto, pero no confirmar datos actualizados.",
      },
    },
    {
      title: "Albert Einstein",
      terms: ["einstein", "relatividade", "relatividade geral", "fisico famoso", "físico famoso"],
      answers: {
        pt: "Albert Einstein foi um físico teórico associado à relatividade restrita e geral. Suas ideias mudaram a forma como entendemos espaço, tempo, gravidade e energia.",
        en: "Albert Einstein was a theoretical physicist associated with special and general relativity. His ideas changed how we understand space, time, gravity and energy.",
        es: "Albert Einstein fue un físico teórico asociado con la relatividad especial y general. Sus ideas cambiaron cómo entendemos espacio, tiempo, gravedad y energía.",
      },
    },
    {
      title: "Capitais comuns",
      terms: ["capital da franca", "capital da frança", "capital do japao", "capital do japão", "capital dos estados unidos", "capital da argentina", "capital do brasil"],
      answers: {
        pt: "Algumas capitais comuns: França é Paris, Japão é Tóquio, Estados Unidos é Washington, D.C., Argentina é Buenos Aires e Brasil é Brasília.",
        en: "Some common capitals: France is Paris, Japan is Tokyo, the United States is Washington, D.C., Argentina is Buenos Aires and Brazil is Brasília.",
        es: "Algunas capitales comunes: Francia es París, Japón es Tokio, Estados Unidos es Washington, D.C., Argentina es Buenos Aires y Brasil es Brasilia.",
      },
    },
    {
      title: "Céu azul",
      terms: ["ceu azul", "céu azul", "por que o ceu", "por que o céu", "espalhamento", "rayleigh"],
      answers: {
        pt: "O céu parece azul porque moléculas da atmosfera espalham mais a luz azul do Sol do que as cores de maior comprimento de onda. Esse fenômeno é chamado espalhamento de Rayleigh.",
        en: "The sky looks blue because molecules in the atmosphere scatter blue sunlight more than longer-wavelength colors. This phenomenon is called Rayleigh scattering.",
        es: "El cielo parece azul porque moléculas de la atmósfera dispersan más la luz azul del Sol que colores de mayor longitud de onda. Este fenómeno se llama dispersión de Rayleigh.",
      },
    },
    {
      title: "Água ferve",
      terms: ["agua ferve", "água ferve", "ponto de ebulicao", "ponto de ebulição", "100 graus", "100°"],
      answers: {
        pt: "Ao nível do mar, a água pura ferve perto de 100 °C porque sua pressão de vapor se iguala à pressão atmosférica. Em maior altitude, a pressão cai e a fervura ocorre em temperatura menor.",
        en: "At sea level, pure water boils near 100 °C because its vapor pressure equals atmospheric pressure. At higher altitude, pressure drops and boiling happens at a lower temperature.",
        es: "Al nivel del mar, el agua pura hierve cerca de 100 °C porque su presión de vapor iguala la presión atmosférica. A mayor altitud, la presión baja y hierve a menor temperatura.",
      },
    },
    {
      title: "Ajuda com decisão",
      terms: ["qual escolher", "o que escolher", "melhor opcao", "melhor opção", "decidir", "escolha"],
      answers: {
        pt: "Para decidir, compare critérios: objetivo, custo, tempo, risco, manutenção e impacto. A melhor opção costuma ser a que atende ao objetivo com menos risco e complexidade desnecessária.",
        en: "To decide, compare criteria: goal, cost, time, risk, maintenance and impact. The best option is usually the one that meets the goal with less risk and unnecessary complexity.",
        es: "Para decidir, compara criterios: objetivo, costo, tiempo, riesgo, mantenimiento e impacto. La mejor opción suele ser la que cumple el objetivo con menos riesgo y complejidad innecesaria.",
      },
    },
    {
      title: "Como estudar",
      terms: ["como estudar", "estudar melhor", "aprender", "memorizar", "prova", "revisao", "revisão"],
      answers: {
        pt: "Para estudar melhor, faça ciclos curtos: leia, tente explicar sem olhar, resolva exercícios e revise depois de um intervalo. A parte ativa importa mais do que só reler.",
        en: "To study better, use short cycles: read, try to explain without looking, solve exercises and review after an interval. Active recall matters more than just rereading.",
        es: "Para estudiar mejor, usa ciclos cortos: lee, intenta explicar sin mirar, resuelve ejercicios y revisa después de un intervalo. La parte activa importa más que solo releer.",
      },
    },
    {
      title: "Resumo de texto",
      terms: ["resumir", "resuma", "resumo de texto", "sintetizar", "principais pontos"],
      answers: {
        pt: "Para resumir um texto, eu procuraria tese central, argumentos principais, evidências e conclusão. Se você colar o trecho, posso transformar em tópicos curtos.",
        en: "To summarize a text, I would look for the central thesis, main arguments, evidence and conclusion. If you paste the excerpt, I can turn it into short bullet points.",
        es: "Para resumir un texto, buscaría tesis central, argumentos principales, evidencias y conclusión. Si pegas el fragmento, puedo convertirlo en puntos cortos.",
      },
    },
    {
      title: "Explicação por analogia",
      terms: ["analogia", "explique como se eu", "simples", "facil", "fácil", "crianca", "criança"],
      answers: {
        pt: "Uma analogia útil para IA local: é como ter uma pequena oficina dentro do próprio aparelho. Ela não precisa mandar cada pedido para fora, mas trabalha com as ferramentas que cabem ali dentro.",
        en: "A useful analogy for local AI: it is like having a small workshop inside the device itself. It does not need to send every request outside, but works with the tools that fit inside.",
        es: "Una analogía útil para IA local: es como tener un pequeño taller dentro del propio dispositivo. No necesita enviar cada pedido afuera, pero trabaja con las herramientas que caben allí.",
      },
    },
  ];

  const replyTranslations = {
    en: {
      "O Talking Buddy é um assistente de voz offline baseado em Edge AI. Ele usa um Raspberry Pi 5 para coordenar reconhecimento de fala, modelo de linguagem, síntese de voz, interface touch, RFID e banco SQLite local.": "Talking Buddy is an offline voice assistant based on Edge AI. It uses a Raspberry Pi 5 to coordinate speech recognition, a language model, speech synthesis, the touch interface, RFID and a local SQLite database.",
      "O pipeline é: openWakeWord detecta 'hey buddy', o VAD grava a fala útil, Whisper.cpp transcreve, Gemma 3:1B via Ollama gera a resposta e Supertonic 2 sintetiza a voz.": "The pipeline is: openWakeWord detects 'hey buddy', VAD records useful speech, Whisper.cpp transcribes it, Gemma 3:1B through Ollama generates the answer and Supertonic 2 synthesizes the voice.",
      "O hardware central é um Raspberry Pi 5 de 8 GB. Ele conversa com microfone USB, tela touch de 7 polegadas, leitor RFID MFRC522, UPS Hat com baterias 18650, extrator HDMI, amplificador PAM8610 e alto-falante.": "The central hardware is an 8 GB Raspberry Pi 5. It connects to a USB microphone, 7-inch touch screen, MFRC522 RFID reader, UPS Hat with 18650 batteries, HDMI audio extractor, PAM8610 amplifier and speaker.",
      "O RFID simula uma troca física de perfil. Ao aproximar um cartão, o sistema carrega usuário, idioma, personalidade, histórico e preferências no SQLite.": "RFID simulates a physical profile switch. When a card is placed near the reader, the system loads the user, language, personality, history and preferences from SQLite.",
      "O RAG permite especializar um perfil com uma base de conhecimento. Quando a intenção pede consulta, o sistema busca trechos relevantes e injeta esse contexto no prompt do LLM.": "RAG allows a profile to be specialized with a knowledge base. When the intent requires retrieval, the system finds relevant excerpts and injects that context into the LLM prompt.",
      "A memória combina histórico recente e fatos estruturados. O sistema recupera as últimas mensagens e também pode guardar fatos do usuário em segundo plano para consultas futuras.": "Memory combines recent history and structured facts. The system retrieves the latest messages and can also store user facts in the background for future queries.",
      "O modo tradutor transforma o assistente em ponte entre português, inglês e espanhol. Ele transcreve a fala, traduz sem responder ao conteúdo e mostra os dois lados da conversa.": "Translator mode turns the assistant into a bridge between Portuguese, English and Spanish. It transcribes speech, translates without answering the content and shows both sides of the conversation.",
      "Os testes mediram wake word, fluxo conversacional, troca RFID, autonomia, latência de STT, inferência do LLM, RTF do TTS, telemetria térmica e consulta SQLite.": "The tests measured wake word, conversational flow, RFID switching, autonomy, STT latency, LLM inference, TTS RTF, thermal telemetry and SQLite queries.",
      "A limitação principal foi a latência de uma solução totalmente local rodando só em CPU. O protótipo provou viabilidade, mas não esconde esse trade-off.": "The main limitation was the latency of a fully local solution running only on CPU. The prototype proved feasibility, while keeping that trade-off visible.",
      "O software foi organizado em módulos Python, com interface web local em modo kiosk. Flask/Werkzeug coordenam rotas e eventos, enquanto SQLite armazena perfis, histórico e preferências.": "The software was organized into Python modules with a local web interface in kiosk mode. Flask/Werkzeug coordinate routes and events, while SQLite stores profiles, history and preferences.",
      "O gabinete foi modelado em SolidWorks e impresso em PLA. Ele acomoda tela, alto-falante, ventilação, alça, Raspberry Pi, UPS, RFID e acessos externos.": "The enclosure was modeled in SolidWorks and printed in PLA. It fits the screen, speaker, ventilation, handle, Raspberry Pi, UPS, RFID and external access ports.",
      "Posso ajudar com programação em nível conceitual. Para um site estático, a divisão mais simples é: HTML para estrutura, CSS para aparência e JavaScript para interação.": "I can help with programming at a conceptual level. For a static site, the simplest division is: HTML for structure, CSS for appearance and JavaScript for interaction.",
      "IA, nesse contexto, é o uso de modelos capazes de reconhecer padrões e gerar saídas úteis, como transcrever fala, responder texto ou sintetizar voz.": "AI, in this context, means using models that recognize patterns and generate useful outputs, such as transcribing speech, answering text or synthesizing voice.",
      "Em prototipagem eletrônica, vale separar alimentação, sinais e comunicação. Primeiro confirme tensões, depois corrente disponível e por fim compatibilidade lógica dos módulos.": "In electronics prototyping, it helps to separate power, signals and communication. First confirm voltages, then available current and finally the logic compatibility between modules.",
      "Para organizar um TCC técnico, uma estrutura boa é: problema, objetivo, arquitetura, implementação, metodologia de testes, resultados e limitações.": "To organize a technical final project, a good structure is: problem, objective, architecture, implementation, test methodology, results and limitations.",
      "Privacidade digital melhora quando menos dados sensíveis saem do dispositivo. Processamento local reduz exposição, mas ainda exige cuidado com armazenamento, permissões e logs.": "Digital privacy improves when less sensitive data leaves the device. Local processing reduces exposure, but still requires care with storage, permissions and logs.",
      "Posso explicar de forma simples. Um bom caminho é quebrar o assunto em três partes: o que é, para que serve e como funciona na prática.": "I can explain it simply. A good path is to break the subject into three parts: what it is, what it is for and how it works in practice.",
      "No GitHub Pages, um site de projeto normalmente fica em usuario.github.io/repositorio. Para uma URL raiz, use um repositório usuario.github.io ou configure um domínio próprio.": "On GitHub Pages, a project site usually lives at username.github.io/repository. For a root URL, use a username.github.io repository or configure a custom domain.",
      "Em ciência básica, a resposta costuma depender do fenômeno físico ou biológico envolvido. Por exemplo: o céu parece azul porque a atmosfera espalha mais a luz azul, e a fotossíntese transforma luz, água e CO2 em energia química para a planta.": "In basic science, the answer usually depends on the physical or biological phenomenon involved. For example: the sky looks blue because the atmosphere scatters blue light more, and photosynthesis turns light, water and CO2 into chemical energy for the plant.",
      "Para referências gerais do Brasil: a capital é Brasília; a chegada portuguesa de 1500 costuma ser associada a Pedro Álvares Cabral, lembrando que povos indígenas já habitavam o território.": "For general Brazil references: the capital is Brasília; the Portuguese arrival in 1500 is commonly associated with Pedro Álvares Cabral, remembering that Indigenous peoples already lived in the territory.",
      "Posso organizar a resposta em passos: primeiro defina o objetivo, depois liste restrições, compare alternativas e escolha a opção que reduz risco sem complicar a manutenção.": "I can organize the answer in steps: first define the goal, then list constraints, compare alternatives and choose the option that reduces risk without making maintenance harder.",
      "O Talking Buddy é um assistente de voz offline que escuta, transforma fala em texto, interpreta a pergunta e responde por voz no próprio protótipo. A ideia central é preservar privacidade sem depender de uma nuvem para conversar.": "Talking Buddy is an offline voice assistant that listens, turns speech into text, interprets the question and answers by voice inside the prototype itself. The central idea is to preserve privacy without depending on a cloud service to talk.",
      "O fluxo de IA funciona em camadas: o assistente detecta o comando 'hey buddy', grava apenas a fala útil, transforma áudio em texto, gera a resposta com um modelo de linguagem e depois converte o texto em voz.": "The AI flow works in layers: the assistant detects the 'hey buddy' command, records only useful speech, turns audio into text, generates an answer with a language model and then converts the text into voice.",
      "O RFID permite uma troca física de perfil. Ao aproximar um cartão, o sistema carrega usuário, idioma, histórico e preferências no banco de dados local.": "RFID enables physical profile switching. When a card is placed near the reader, the system loads the user, language, history and preferences from the local database.",
      "O RAG permite especializar um perfil com uma base de conhecimento. Antes de responder, o sistema busca trechos relevantes e entrega esse contexto ao modelo de linguagem.": "RAG lets a profile be specialized with a knowledge base. Before answering, the system searches for relevant excerpts and gives that context to the language model.",
      "Os testes mediram ativação por voz, fluxo conversacional, troca por cartão, autonomia, tempo de transcrição, tempo de resposta do modelo, geração de voz, estabilidade térmica e consulta ao banco de dados.": "The tests measured voice activation, conversation flow, card-based profile switching, autonomy, transcription time, model response time, voice generation, thermal stability and database queries.",
      "Como protótipo local, o Talking Buddy precisou equilibrar privacidade, custo e tempo de resposta. A validação mostrou que a arquitetura funciona, mas também apontou caminhos de melhoria para versões futuras.": "As a local prototype, Talking Buddy had to balance privacy, cost and response time. Validation showed that the architecture works, while also pointing to improvements for future versions.",
      "O software foi organizado em módulos Python, com uma interface web local em tela cheia. O sistema coordena rotas, eventos, banco de dados local, histórico, perfis e preferências do usuário.": "The software was organized into Python modules with a full-screen local web interface. The system coordinates routes, events, local database, history, profiles and user preferences.",
    },
    es: {
      "O Talking Buddy é um assistente de voz offline baseado em Edge AI. Ele usa um Raspberry Pi 5 para coordenar reconhecimento de fala, modelo de linguagem, síntese de voz, interface touch, RFID e banco SQLite local.": "Talking Buddy es un asistente de voz offline basado en Edge AI. Usa una Raspberry Pi 5 para coordinar reconocimiento de voz, modelo de lenguaje, síntesis de voz, interfaz táctil, RFID y una base SQLite local.",
      "O pipeline é: openWakeWord detecta 'hey buddy', o VAD grava a fala útil, Whisper.cpp transcreve, Gemma 3:1B via Ollama gera a resposta e Supertonic 2 sintetiza a voz.": "El pipeline es: openWakeWord detecta 'hey buddy', VAD graba la voz útil, Whisper.cpp la transcribe, Gemma 3:1B mediante Ollama genera la respuesta y Supertonic 2 sintetiza la voz.",
      "O hardware central é um Raspberry Pi 5 de 8 GB. Ele conversa com microfone USB, tela touch de 7 polegadas, leitor RFID MFRC522, UPS Hat com baterias 18650, extrator HDMI, amplificador PAM8610 e alto-falante.": "El hardware central es una Raspberry Pi 5 de 8 GB. Se conecta con micrófono USB, pantalla táctil de 7 pulgadas, lector RFID MFRC522, UPS Hat con baterías 18650, extractor HDMI, amplificador PAM8610 y altavoz.",
      "O RFID simula uma troca física de perfil. Ao aproximar um cartão, o sistema carrega usuário, idioma, personalidade, histórico e preferências no SQLite.": "El RFID simula un cambio físico de perfil. Al acercar una tarjeta, el sistema carga usuario, idioma, personalidad, historial y preferencias desde SQLite.",
      "O RAG permite especializar um perfil com uma base de conhecimento. Quando a intenção pede consulta, o sistema busca trechos relevantes e injeta esse contexto no prompt do LLM.": "El RAG permite especializar un perfil con una base de conocimiento. Cuando la intención requiere consulta, el sistema busca fragmentos relevantes e inyecta ese contexto en el prompt del LLM.",
      "A memória combina histórico recente e fatos estruturados. O sistema recupera as últimas mensagens e também pode guardar fatos do usuário em segundo plano para consultas futuras.": "La memoria combina historial reciente y datos estructurados. El sistema recupera los últimos mensajes y también puede guardar datos del usuario en segundo plano para consultas futuras.",
      "O modo tradutor transforma o assistente em ponte entre português, inglês e espanhol. Ele transcreve a fala, traduz sem responder ao conteúdo e mostra os dois lados da conversa.": "El modo traductor convierte al asistente en un puente entre portugués, inglés y español. Transcribe la voz, traduce sin responder al contenido y muestra ambos lados de la conversación.",
      "Os testes mediram wake word, fluxo conversacional, troca RFID, autonomia, latência de STT, inferência do LLM, RTF do TTS, telemetria térmica e consulta SQLite.": "Las pruebas midieron wake word, flujo conversacional, cambio RFID, autonomía, latencia de STT, inferencia del LLM, RTF del TTS, telemetría térmica y consultas SQLite.",
      "A limitação principal foi a latência de uma solução totalmente local rodando só em CPU. O protótipo provou viabilidade, mas não esconde esse trade-off.": "La principal limitación fue la latencia de una solución totalmente local ejecutándose solo en CPU. El prototipo demostró viabilidad sin ocultar ese compromiso.",
      "O software foi organizado em módulos Python, com interface web local em modo kiosk. Flask/Werkzeug coordenam rotas e eventos, enquanto SQLite armazena perfis, histórico e preferências.": "El software fue organizado en módulos Python, con interfaz web local en modo kiosk. Flask/Werkzeug coordina rutas y eventos, mientras SQLite almacena perfiles, historial y preferencias.",
      "O gabinete foi modelado em SolidWorks e impresso em PLA. Ele acomoda tela, alto-falante, ventilação, alça, Raspberry Pi, UPS, RFID e acessos externos.": "El gabinete fue modelado en SolidWorks e impreso en PLA. Aloja pantalla, altavoz, ventilación, asa, Raspberry Pi, UPS, RFID y accesos externos.",
      "Posso ajudar com programação em nível conceitual. Para um site estático, a divisão mais simples é: HTML para estrutura, CSS para aparência e JavaScript para interação.": "Puedo ayudar con programación a nivel conceptual. Para un sitio estático, la división más simple es: HTML para estructura, CSS para apariencia y JavaScript para interacción.",
      "IA, nesse contexto, é o uso de modelos capazes de reconhecer padrões e gerar saídas úteis, como transcrever fala, responder texto ou sintetizar voz.": "IA, en este contexto, es el uso de modelos capaces de reconocer patrones y generar salidas útiles, como transcribir voz, responder texto o sintetizar voz.",
      "Em prototipagem eletrônica, vale separar alimentação, sinais e comunicação. Primeiro confirme tensões, depois corrente disponível e por fim compatibilidade lógica dos módulos.": "En prototipado electrónico conviene separar alimentación, señales y comunicación. Primero confirma tensiones, luego corriente disponible y por último compatibilidad lógica entre módulos.",
      "Para organizar um TCC técnico, uma estrutura boa é: problema, objetivo, arquitetura, implementação, metodologia de testes, resultados e limitações.": "Para organizar un TCC técnico, una buena estructura es: problema, objetivo, arquitectura, implementación, metodología de pruebas, resultados y limitaciones.",
      "Privacidade digital melhora quando menos dados sensíveis saem do dispositivo. Processamento local reduz exposição, mas ainda exige cuidado com armazenamento, permissões e logs.": "La privacidad digital mejora cuando menos datos sensibles salen del dispositivo. El procesamiento local reduce exposición, pero aún exige cuidado con almacenamiento, permisos y registros.",
      "Posso explicar de forma simples. Um bom caminho é quebrar o assunto em três partes: o que é, para que serve e como funciona na prática.": "Puedo explicarlo de forma simple. Un buen camino es dividir el tema en tres partes: qué es, para qué sirve y cómo funciona en la práctica.",
      "No GitHub Pages, um site de projeto normalmente fica em usuario.github.io/repositorio. Para uma URL raiz, use um repositório usuario.github.io ou configure um domínio próprio.": "En GitHub Pages, un sitio de proyecto normalmente queda en usuario.github.io/repositorio. Para una URL raíz, usa un repositorio usuario.github.io o configura un dominio propio.",
      "Em ciência básica, a resposta costuma depender do fenômeno físico ou biológico envolvido. Por exemplo: o céu parece azul porque a atmosfera espalha mais a luz azul, e a fotossíntese transforma luz, água e CO2 em energia química para a planta.": "En ciencia básica, la respuesta suele depender del fenómeno físico o biológico. Por ejemplo: el cielo parece azul porque la atmósfera dispersa más la luz azul, y la fotosíntesis transforma luz, agua y CO2 en energía química para la planta.",
      "Para referências gerais do Brasil: a capital é Brasília; a chegada portuguesa de 1500 costuma ser associada a Pedro Álvares Cabral, lembrando que povos indígenas já habitavam o território.": "Para referencias generales de Brasil: la capital es Brasilia; la llegada portuguesa de 1500 suele asociarse con Pedro Álvares Cabral, recordando que pueblos indígenas ya habitaban el territorio.",
      "Posso organizar a resposta em passos: primeiro defina o objetivo, depois liste restrições, compare alternativas e escolha a opção que reduz risco sem complicar a manutenção.": "Puedo organizar la respuesta en pasos: primero define el objetivo, luego enumera restricciones, compara alternativas y elige la opción que reduce riesgo sin complicar el mantenimiento.",
      "O Talking Buddy é um assistente de voz offline que escuta, transforma fala em texto, interpreta a pergunta e responde por voz no próprio protótipo. A ideia central é preservar privacidade sem depender de uma nuvem para conversar.": "Talking Buddy es un asistente de voz offline que escucha, transforma voz en texto, interpreta la pregunta y responde por voz en el propio prototipo. La idea central es preservar privacidad sin depender de una nube para conversar.",
      "O fluxo de IA funciona em camadas: o assistente detecta o comando 'hey buddy', grava apenas a fala útil, transforma áudio em texto, gera a resposta com um modelo de linguagem e depois converte o texto em voz.": "El flujo de IA funciona por capas: el asistente detecta el comando 'hey buddy', graba solo la voz útil, transforma audio en texto, genera la respuesta con un modelo de lenguaje y luego convierte el texto en voz.",
      "O RFID permite uma troca física de perfil. Ao aproximar um cartão, o sistema carrega usuário, idioma, histórico e preferências no banco de dados local.": "RFID permite un cambio físico de perfil. Al acercar una tarjeta, el sistema carga usuario, idioma, historial y preferencias desde la base de datos local.",
      "O RAG permite especializar um perfil com uma base de conhecimento. Antes de responder, o sistema busca trechos relevantes e entrega esse contexto ao modelo de linguagem.": "RAG permite especializar un perfil con una base de conocimiento. Antes de responder, el sistema busca fragmentos relevantes y entrega ese contexto al modelo de lenguaje.",
      "Os testes mediram ativação por voz, fluxo conversacional, troca por cartão, autonomia, tempo de transcrição, tempo de resposta do modelo, geração de voz, estabilidade térmica e consulta ao banco de dados.": "Las pruebas midieron activación por voz, flujo conversacional, cambio por tarjeta, autonomía, tiempo de transcripción, tiempo de respuesta del modelo, generación de voz, estabilidad térmica y consulta a la base de datos.",
      "Como protótipo local, o Talking Buddy precisou equilibrar privacidade, custo e tempo de resposta. A validação mostrou que a arquitetura funciona, mas também apontou caminhos de melhoria para versões futuras.": "Como prototipo local, Talking Buddy tuvo que equilibrar privacidad, costo y tiempo de respuesta. La validación mostró que la arquitectura funciona, y también señaló mejoras para versiones futuras.",
      "O software foi organizado em módulos Python, com uma interface web local em tela cheia. O sistema coordena rotas, eventos, banco de dados local, histórico, perfis e preferências do usuário.": "El software fue organizado en módulos Python, con una interfaz web local en pantalla completa. El sistema coordina rutas, eventos, base de datos local, historial, perfiles y preferencias del usuario.",
    },
  };

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

  function loadVoiceVolume() {
    const savedRaw = localStorage.getItem("talkingBuddyVoiceVolume");
    if (savedRaw === null) return defaultVoiceVolume;
    const saved = Number(savedRaw);
    if (!Number.isFinite(saved)) return defaultVoiceVolume;
    return Math.min(1, Math.max(0, saved));
  }

  function loadVoiceMuted() {
    return localStorage.getItem("talkingBuddyVoiceMuted") === "true";
  }

  function loadMicPermissionSession() {
    try {
      return sessionStorage.getItem("talkingBuddyMicPermissionGranted") === "true";
    } catch (error) {
      return false;
    }
  }

  function saveMicPermissionSession(granted) {
    try {
      if (granted) {
        sessionStorage.setItem("talkingBuddyMicPermissionGranted", "true");
      } else {
        sessionStorage.removeItem("talkingBuddyMicPermissionGranted");
      }
    } catch (error) {
      // Session storage is optional; microphone control still works without it.
    }
  }

  function ensureVoiceSettingsDefaults() {
    if (localStorage.getItem("talkingBuddyVoiceSettingsVersion") === voiceSettingsVersion) return;
    localStorage.setItem("talkingBuddyVoiceVolume", String(defaultVoiceVolume));
    localStorage.setItem("talkingBuddyVoiceMuted", "false");
    localStorage.setItem("talkingBuddyVoiceSettingsVersion", voiceSettingsVersion);
  }

  function saveMemory() {
    localStorage.setItem("talkingBuddyDemoMemory", JSON.stringify(state.memory));
  }

  function saveVoiceSettings() {
    localStorage.setItem("talkingBuddyVoiceVolume", String(state.voiceVolume));
    localStorage.setItem("talkingBuddyVoiceMuted", state.voiceMuted ? "true" : "false");
    localStorage.setItem("talkingBuddyVoiceSettingsVersion", voiceSettingsVersion);
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

  function effectiveVoiceVolume() {
    return state.voiceMuted ? 0 : state.voiceVolume;
  }

  function updateVoiceUi() {
    const muted = state.voiceMuted || state.voiceVolume <= 0;
    const buttonLabel = localize(muted ? "unmuteVoice" : "muteVoice");

    voiceToggle.setAttribute("aria-pressed", muted ? "true" : "false");
    voiceToggle.setAttribute("aria-label", buttonLabel);
    voiceToggle.setAttribute("title", buttonLabel);
    voiceToggle.closest(".voice-control")?.classList.toggle("is-muted", muted);
  }

  function clearSpeechTimer() {
    if (!state.speechTimer) return;
    window.clearTimeout(state.speechTimer);
    state.speechTimer = null;
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
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function setThinkingMessage(element, text) {
    if (!element || !text) return;
    element.textContent = text;
    log.scrollTop = log.scrollHeight;
  }

  function currentLanguage() {
    return window.TalkingBuddyI18n?.getLanguage?.() || "pt";
  }

  function currentSpeechLanguage() {
    const lang = currentLanguage();
    if (lang === "en") return "en-US";
    if (lang === "es") return "es-ES";
    return "pt-BR";
  }

  function localize(key, variables = {}) {
    const lang = currentLanguage();
    const dictionary = localizedText[lang] || localizedText.pt;
    const template = dictionary[key] || localizedText.pt[key] || key;
    return template.replace(/\{\{(\w+)\}\}/g, (_, name) => variables[name] ?? "");
  }

  function translateReply(text) {
    const lang = currentLanguage();
    if (lang === "pt") return text;
    return replyTranslations[lang]?.[text] || translateUi(text);
  }

  function localizedAnswer(item) {
    if (!item) return "";
    const lang = currentLanguage();
    if (item.answers) return item.answers[lang] || item.answers.pt || "";
    return translateReply(item.answer || "");
  }

  function translateUi(text) {
    return window.TalkingBuddyI18n?.translate?.(text) || text;
  }

  function rememberConversation(role, content) {
    const cleanContent = String(content || "").replace(/\s+/g, " ").trim();
    if (!cleanContent) return;

    state.chatHistory.push({
      role: role === "assistant" ? "assistant" : "user",
      content: cleanContent.slice(0, 1800),
    });

    if (state.chatHistory.length > aiConfig.historyLimit) {
      state.chatHistory.splice(0, state.chatHistory.length - aiConfig.historyLimit);
    }
  }

  function aiStageFromStatus(status) {
    const normalized = normalize(status);
    if (normalized.includes("biblioteca") || normalized.includes("library")) return localize("aiStageLibrary");
    if (normalized.includes("download") || normalized.includes("baix") || normalized.includes("cargando") || normalized.includes("loading")) return localize("aiStageDownload");
    if (normalized.includes("prepar") || normalized.includes("modelo") || normalized.includes("model")) return localize("aiStageModel");
    if (normalized.includes("pronta") || normalized.includes("ready")) return localize("aiStageReady");
    return localize("aiStageModel");
  }

  function sanitizeAiReply(text) {
    let reply = String(text || "").trim();
    reply = reply
      .replace(/Como\s+(Rafael|Stefan),?\s*/gi, "")
      .replace(/,\s*como\s+(Rafael|Stefan),?\s*/gi, ", ")
      .replace(/Como\s+(Rafael|Stefan)\s+[^.?!]*[.?!]\s*/gi, "")
      .replace(/\bRafael(?:\s+Olivare(?:\s+Piveta)?)?\b/gi, "um dos autores")
      .replace(/\bStefan(?:\s+Benjamim(?:\s+Seixas(?:\s+Louren[cç]o(?:\s+Rodrigues)?)?)?)?\b/gi, "um dos autores")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.!?;:])/g, "$1")
      .trim();

    if (
      !reply ||
      /\b(como\s+)?(rafael|stefan)\b/i.test(reply) ||
      /\b(eu\s+sou|sou|como|estou\s+como|falo\s+como)\s+um\s+dos\s+autores\b/i.test(reply)
    ) {
      return localize("greeting");
    }

    return reply;
  }

  async function askAi(text, thinkingElement) {
    const browserAi = window.TalkingBuddyBrowserAI;
    if (!browserAi?.isConfigured?.() || !browserAi?.isSupported?.()) {
      throw new Error("Browser-local AI unavailable.");
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), aiConfig.timeoutMs);

    try {
      return await Promise.race([
        browserAi.ask({
          message: text,
          language: currentLanguage(),
          memory: state.memory,
          history: state.chatHistory.slice(-aiConfig.historyLimit),
          onStatus: (status) => setThinkingMessage(thinkingElement, aiStageFromStatus(status)),
        }),
        new Promise((_, reject) => {
          controller.signal.addEventListener("abort", () => reject(new Error("Browser-local AI timeout.")), { once: true });
        }),
      ]);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function scheduleAiPrewarm(reason = "near-demo") {
    const browserAi = window.TalkingBuddyBrowserAI;
    if (state.aiPrewarmStarted || !browserAi?.canPrewarm?.() || !browserAi?.prewarm) return;

    state.aiPrewarmStarted = true;
    browserAi.prewarm().catch((error) => {
      state.aiPrewarmStarted = false;
      console.info(`AI prewarm skipped (${reason}).`, error);
    });
  }

  function initAiPrewarm() {
    const demoSection = document.getElementById("experimente");
    const intentLinks = document.querySelectorAll('a[href="#experimente"]');

    intentLinks.forEach((link) => {
      link.addEventListener("pointerenter", () => scheduleAiPrewarm("intent"), { once: true });
      link.addEventListener("focus", () => scheduleAiPrewarm("intent"), { once: true });
      link.addEventListener("click", () => scheduleAiPrewarm("intent"), { once: true });
      link.addEventListener("touchstart", () => scheduleAiPrewarm("intent"), { once: true, passive: true });
    });

    if ("IntersectionObserver" in window && demoSection) {
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) return;
        scheduleAiPrewarm("near-demo");
        observer.disconnect();
      }, { rootMargin: "900px 0px", threshold: 0.01 });

      observer.observe(demoSection);
    }

    const compactTouchDevice =
      window.matchMedia?.("(max-width: 820px)")?.matches &&
      window.matchMedia?.("(pointer: coarse)")?.matches;

    if (!compactTouchDevice && window.TALKING_BUDDY_BROWSER_AI?.prewarmDesktopIdle !== false) {
      const idle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 2500));
      idle(() => scheduleAiPrewarm("idle"), { timeout: 5000 });
    }
  }

  function updateDynamicUi() {
    input.placeholder = state.speechUnavailable
      ? localize("textFallbackPlaceholder")
      : localize("defaultPlaceholder");

    const unavailable = state.speechUnavailable;
    micBtn.title = unavailable ? localize("micUnavailable") : localize("speak");
    micBtn.setAttribute("aria-label", unavailable ? localize("micUnavailable") : localize("speak"));

    if (unavailable && state.speechUnavailableReason) {
      showInfo(localize(state.speechUnavailableReason));
    }

    setStatus(state.listening ? "Escuta" : state.busy ? state.responseMode || "Processando" : "Pronto");
    updateVoiceUi();
  }

  function rememberFrom(text) {
    const normalized = normalize(text);
    const originalNameMatch = text.match(/\b(meu nome é|meu nome e|me chamo|sou o|sou a)\s+([A-Za-zÀ-ÿ0-9 ]{2,40})/i);
    const nameMatch = normalized.match(/\b(meu nome e|me chamo|sou o|sou a)\s+([a-z0-9 ]{2,40})/);
    if (nameMatch) {
      const originalName = originalNameMatch ? originalNameMatch[2] : nameMatch[2];
      state.memory.name = originalName.trim().split(" ").slice(0, 3).join(" ");
      saveMemory();
      return localize("memoryUpdatedName", { name: state.memory.name });
    }

    const medMatch = normalized.match(/\b(tomei|tomo|preciso tomar)\s+(.{3,80})/);
    if (medMatch) {
      state.memory.lastRoutine = medMatch[0];
      saveMemory();
      return localize("memoryUpdatedRoutine");
    }

    return "";
  }

  function answerMemoryQuestion(text) {
    const normalized = normalize(text);
    if (normalized.includes("qual meu nome") || normalized.includes("meu nome")) {
      if (state.memory.name) return localize("nameKnown", { name: state.memory.name });
      return localize("nameUnknown");
    }

    if (normalized.includes("o que voce lembra") || normalized.includes("lembra de mim")) {
      const facts = [];
      if (state.memory.name) facts.push(`nome: ${state.memory.name}`);
      if (state.memory.lastRoutine) facts.push(`rotina: ${state.memory.lastRoutine}`);
      return facts.length
        ? localize("rememberedFacts", { facts: facts.join("; ") })
        : localize("rememberedNone");
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
          if (!nTerm || !query.includes(nTerm)) return total;
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

  function buildReply(text, options = {}) {
    if (!options.skipMemory) {
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
    }

    const normalized = normalize(text);
    const words = new Set(normalized.split(" "));
    const hasGreeting =
      ["oi", "ola", "hello", "hi", "hola"].some((greet) => words.has(greet)) ||
      ["bom dia", "boa tarde", "boa noite"].some((greet) => normalized === greet || normalized.startsWith(`${greet} `));

    if (hasGreeting) {
      setResponseMode("Assistente");
      return localize("greeting");
    }

    if (normalized.includes("traduza")) {
      setResponseMode("Tradução");
      return localize("translateMode");
    }

    const calculation = answerSimpleCalculation(text);
    if (calculation) {
      setResponseMode("Cálculo");
      return calculation;
    }

    const item = retrieve(text);
    if (item) {
      setResponseMode(item.title);
      return localizedAnswer(item);
    }

    const generalItem = retrieveGeneral(text);
    if (generalItem) {
      setResponseMode(generalItem.title);
      return localizedAnswer(generalItem);
    }

    setResponseMode("Resposta local");
    return buildHelpfulFallback(text);
  }

  function answerSimpleCalculation(text) {
    const normalized = normalize(text);
    if (!/\b(quanto|calcule|calcular|conta|resultado|mais|menos|vezes|dividido|porcentagem|percentual|cento)\b|%/.test(normalized) && !text.includes("%")) return "";

    const percentageMatch = text
      .toLowerCase()
      .replace(/,/g, ".")
      .match(/(\d+(?:\.\d+)?)\s*(?:%|por cento)\s*(?:de|of|del|da|do)?\s*(\d+(?:\.\d+)?)/);

    if (percentageMatch) {
      const percent = Number(percentageMatch[1]);
      const total = Number(percentageMatch[2]);
      if (Number.isFinite(percent) && Number.isFinite(total)) {
        const value = (percent / 100) * total;
        return localize("calculationResult", {
          value: Number(value.toFixed(6)).toLocaleString(currentLanguage() === "pt" ? "pt-BR" : currentLanguage()),
        });
      }
    }

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
      return localize("calculationResult", {
        value: Number(value.toFixed(6)).toLocaleString(currentLanguage() === "pt" ? "pt-BR" : currentLanguage()),
      });
    } catch (error) {
      return "";
    }
  }

  function extractSubject(text) {
    const query = normalize(text);
    const stopwords = new Set([
      "o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das", "e", "ou", "que", "qual", "quais",
      "como", "porque", "por", "para", "pra", "me", "voce", "você", "explique", "explica", "sobre", "isso",
      "the", "a", "an", "what", "how", "why", "is", "are", "about", "me", "you", "please",
      "el", "la", "los", "las", "un", "una", "que", "como", "por", "para", "sobre",
    ]);
    const words = query.split(" ").filter((word) => word.length > 2 && !stopwords.has(word));
    return words.slice(0, 5).join(" ") || localize("subjectFallback");
  }

  function buildHelpfulFallback(text) {
    const normalized = normalize(text);
    const subject = extractSubject(text);

    if (/\b(hoje|agora|atual|noticia|preco|cotacao|presidente|clima)\b/.test(normalized)) {
      return localize("realtimeLimit");
    }

    if (/\b(como|porque|por que|explique|explica)\b/.test(normalized)) {
      return localize("reasoningFallback", { subject });
    }

    return localize("generalFallback", { subject });
  }

  async function buildReplyAsync(text, thinkingElement) {
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

    if (window.TalkingBuddyBrowserAI?.isConfigured?.()) {
      setResponseMode("IA local");
      try {
        return sanitizeAiReply(await askAi(text, thinkingElement));
      } catch (error) {
        console.warn(error);
        showInfo(localize("aiFallback"));
      }
    } else if (window.TalkingBuddyBrowserAI?.disabledReason?.() !== "weak-device") {
      showInfo(localize("aiNotConfigured"));
    }

    return buildReply(text, { skipMemory: true });
  }

  function sendMessage(rawText) {
    if (state.busy) return;
    const text = rawText.trim();
    if (!text) return;

    showError("");
    setBusy(true);
    scheduleAiPrewarm("question");
    addMessage(text, "user");
    rememberConversation("user", text);
    input.value = "";

    safeRobot(() => {
      robot.setState("thinking");
      robot.setEmotion("curious");
    });
    setStatus("Processando");
    const thinking = addMessage(localize(window.TalkingBuddyBrowserAI?.isConfigured?.() ? "thinkingAi" : "thinking"), "bot", { thinking: true });

    window.setTimeout(async () => {
      const reply = await buildReplyAsync(text, thinking);
      thinking.remove();
      addMessage(reply, "bot");
      rememberConversation("assistant", reply);
      speakReply(reply);
    }, 320);
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
    const target = currentSpeechLanguage().toLowerCase().split("-")[0];
    const maleHints = [
      "felipe",
      "daniel",
      "antonio",
      "joao",
      "thiago",
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
    if (lang === currentSpeechLanguage().toLowerCase()) score += 60;
    else if (lang.startsWith(target)) score += 42;
    else if (lang.startsWith("pt")) score += 6;

    if (maleHints.some((hint) => name.includes(hint))) score += 100;
    if (femaleHints.some((hint) => name.includes(hint))) score -= 80;
    if (voice.localService) score += 4;
    if (voice.default) score += 2;
    return score;
  }

  function preferredMasculineVoice() {
    const target = currentSpeechLanguage().toLowerCase().split("-")[0];
    return refreshVoices()
      .filter((voice) => (voice.lang || "").toLowerCase().startsWith(target))
      .sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
  }

  function splitSpeechText(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return [];

    const maxLength = 105;
    const chunks = [];
    let chunk = "";
    const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];

    sentences.forEach((sentence) => {
      const cleanSentence = sentence.trim();
      if (!cleanSentence) return;

      const candidate = chunk ? `${chunk} ${cleanSentence}` : cleanSentence;
      if (candidate.length <= maxLength) {
        chunk = candidate;
        return;
      }

      if (chunk) chunks.push(chunk);
      chunk = cleanSentence;

      while (chunk.length > maxLength) {
        const cutAt = bestSpeechCut(chunk, maxLength);
        chunks.push(chunk.slice(0, cutAt).trim());
        chunk = chunk.slice(cutAt).trim();
      }
    });

    if (chunk) chunks.push(chunk);
    return chunks;
  }

  function bestSpeechCut(text, maxLength) {
    const punctuationCuts = [", ", "; ", ": "];
    for (const separator of punctuationCuts) {
      const index = text.lastIndexOf(separator, maxLength);
      if (index > 38) return index + separator.length;
    }

    const phraseCuts = [" mas ", " porque ", " e "];
    for (const separator of phraseCuts) {
      const index = text.lastIndexOf(separator, maxLength);
      if (index > 38) return index + 1;
    }

    const spaceIndex = text.lastIndexOf(" ", maxLength);
    if (spaceIndex > 38) return spaceIndex + 1;
    return maxLength;
  }

  function estimateSpeechDuration(text) {
    const clean = String(text || "").trim();
    if (!clean) return 0;

    const words = clean.split(/\s+/).filter(Boolean).length;
    const punctuationPauses = (clean.match(/[,.!?;:]/g) || []).length * 90;
    return Math.max(720, Math.min(9000, words * 330 + punctuationPauses));
  }

  function currentSpeechChunkOffset() {
    if (!state.activeSpeechChunkDuration) return 0;
    return Math.min(
      state.activeSpeechChunkDuration,
      Math.max(0, performance.now() - state.activeSpeechChunkStartedAt)
    );
  }

  function speechTextFromOffset(text, offsetMs, durationMs) {
    const clean = String(text || "").trim();
    if (!clean) return "";
    if (!durationMs || offsetMs <= 120) return clean;

    const progress = Math.min(0.96, Math.max(0, offsetMs / durationMs));
    const roughIndex = Math.floor(clean.length * progress);
    const nextSpace = clean.indexOf(" ", roughIndex);
    const start = nextSpace > -1 ? nextSpace + 1 : roughIndex;
    return clean.slice(start).trim() || clean.split(/\s+/).slice(-4).join(" ");
  }

  function advanceSpeechChunk(runId) {
    if (runId !== state.speechRunId || !state.speaking) return;
    state.speechChunkIndex += 1;
    speakNextSpeechChunk(0);
  }

  function scheduleSilentSpeechChunk(runId, offsetMs) {
    clearSpeechTimer();

    const remainingMs = Math.max(90, state.activeSpeechChunkDuration - offsetMs);
    state.speechTimer = window.setTimeout(() => {
      state.speechTimer = null;
      advanceSpeechChunk(runId);
    }, remainingMs);
  }

  function speakNextSpeechChunk(offsetMs = 0) {
    if (!state.speaking) return;

    const chunk = state.speechChunks[state.speechChunkIndex];
    if (!chunk) {
      stopSpeaking();
      return;
    }

    const runId = state.speechRunId;
    state.activeSpeechChunkText = chunk;
    state.activeSpeechChunkDuration = estimateSpeechDuration(chunk);
    state.activeSpeechChunkStartedAt = performance.now() - offsetMs;

    if (offsetMs >= state.activeSpeechChunkDuration - 80) {
      advanceSpeechChunk(runId);
      return;
    }

    if (state.voiceMuted || state.voiceVolume <= 0 || !("speechSynthesis" in window)) {
      state.currentUtterance = null;
      scheduleSilentSpeechChunk(runId, offsetMs);
      return;
    }

    clearSpeechTimer();

    const textToSpeak = speechTextFromOffset(chunk, offsetMs, state.activeSpeechChunkDuration);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = currentSpeechLanguage();
    utterance.rate = 0.94;
    utterance.pitch = 0.72;
    utterance.volume = effectiveVoiceVolume();
    if (state.speechVoice) utterance.voice = state.speechVoice;

    state.currentUtterance = utterance;

    utterance.onend = () => {
      if (state.currentUtterance !== utterance) return;
      state.currentUtterance = null;
      advanceSpeechChunk(runId);
    };
    utterance.onerror = () => {
      if (state.currentUtterance !== utterance) return;
      state.currentUtterance = null;
      advanceSpeechChunk(runId);
    };

    window.speechSynthesis.speak(utterance);
  }

  function speakReply(text) {
    clearSpeechTimer();
    state.currentUtterance = null;

    state.speechRunId += 1;
    state.speaking = true;
    safeRobot(() => {
      robot.setState("speaking");
      robot.setEmotion("happy");
      robot.speakText(text);
    });
    setStatus(state.responseMode || "Resposta");

    state.speechChunks = splitSpeechText(text);
    state.speechChunkIndex = 0;
    state.speechVoice = preferredMasculineVoice();
    speakNextSpeechChunk(0);
  }

  function stopSpeaking() {
    clearSpeechTimer();
    state.speechRunId += 1;
    state.speaking = false;
    state.currentUtterance = null;
    state.speechChunks = [];
    state.speechChunkIndex = 0;
    state.activeSpeechChunkStartedAt = 0;
    state.activeSpeechChunkDuration = 0;
    state.activeSpeechChunkText = "";
    state.speechVoice = null;
    safeRobot(() => {
      if (typeof robot.stopSpeaking === "function") robot.stopSpeaking();
      else robot.setState("idle");
    });
    setBusy(false);
    setStatus("Pronto");
  }

  function cancelAudibleSpeechOnly() {
    if (!("speechSynthesis" in window)) return;
    state.currentUtterance = null;
    window.speechSynthesis.cancel();
  }

  function muteCurrentSpeechOutput() {
    if (!state.speaking || !state.activeSpeechChunkText) return;

    const runId = state.speechRunId;
    const offsetMs = currentSpeechChunkOffset();
    cancelAudibleSpeechOnly();
    scheduleSilentSpeechChunk(runId, offsetMs);
  }

  function unmuteCurrentSpeechOutput() {
    if (!state.speaking || !state.activeSpeechChunkText) return;

    const offsetMs = currentSpeechChunkOffset();
    clearSpeechTimer();
    speakNextSpeechChunk(offsetMs);
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
      showError(localize("noSpeech"));
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
      return localize("permissionDenied");
    }
    if (error === "no-speech") {
      return localize("noSpeech");
    }
    if (error === "audio-capture") {
      return localize("noMicAccess");
    }
    if (error === "network") {
      return localize("networkError");
    }
    return localize("transcriptionGeneric");
  }

  function setSpeechAvailability(messageKey) {
    state.speechUnavailable = !!messageKey;
    state.speechUnavailableReason = messageKey || "";
    micBtn.disabled = state.busy || state.speechUnavailable;
    micBtn.classList.toggle("is-unavailable", state.speechUnavailable);
    updateDynamicUi();

    if (state.speechUnavailable) {
      showInfo(localize(messageKey));
    }
  }

  async function refreshMicrophonePermission() {
    if (!navigator.permissions || !navigator.permissions.query) return "";

    try {
      const permission = await navigator.permissions.query({ name: "microphone" });
      setMicPermissionGranted(permission.state === "granted");
      permission.onchange = () => {
        setMicPermissionGranted(permission.state === "granted");
      };
      return permission.state;
    } catch (error) {
      return "";
    }
  }

  function setMicPermissionGranted(granted) {
    state.micPermissionGranted = granted;
    saveMicPermissionSession(granted);
  }

  async function canStartMicrophoneCapture() {
    if (state.micPermissionGranted) return true;

    const permissionState = await refreshMicrophonePermission();
    if (permissionState === "denied") {
      showError(localize("permissionDenied"));
      focusTextFallback();
      return false;
    }

    return true;
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
      return "insecureContext";
    }

    if (!SpeechRecognition) {
      return "unsupportedSpeech";
    }

    if (await isBraveBrowser()) {
      return "braveSpeech";
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

    if (!await canStartMicrophoneCapture()) return;

    const recognition = new SpeechRecognition();
    state.recognition = recognition;
    recognition.lang = currentSpeechLanguage();
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let submitted = false;
    let hadError = false;
    let interimTranscript = "";
    let finalTranscript = "";

    recognition.onstart = () => {
      setMicPermissionGranted(true);
      setListening(true);
    };

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
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicPermissionGranted(false);
      }
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

      showError(localize("noSpeech"));
      focusTextFallback();
    };

    try {
      recognition.start();
    } catch (error) {
      if (error && error.name === "NotAllowedError") setMicPermissionGranted(false);
      showError(localize("startFail"));
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

  voiceToggle.addEventListener("click", () => {
    const shouldUnmute = state.voiceMuted || state.voiceVolume <= 0;

    if (shouldUnmute) {
      state.voiceMuted = false;
      state.voiceVolume = defaultVoiceVolume;
    } else {
      state.voiceMuted = true;
      state.voiceVolume = 0;
    }

    if (state.speaking) {
      if (state.voiceMuted) muteCurrentSpeechOutput();
      else unmuteCurrentSpeechOutput();
    }

    saveVoiceSettings();
    updateVoiceUi();
  });

  micBtn.addEventListener("click", () => {
    if (state.busy) return;
    if (state.speechUnavailable) {
      showInfo(localize(state.speechUnavailableReason));
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
    await refreshMicrophonePermission();
  })();

  if ("speechSynthesis" in window) {
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }

  initAiPrewarm();
  updateVoiceUi();
  window.addEventListener("talkingbuddy:languagechange", updateDynamicUi);
})();
