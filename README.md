# Talking Buddy

Site estático do projeto Talking Buddy, feito apenas com HTML, CSS e JavaScript.

## Como rodar localmente

Use um servidor estático simples:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

A seção "Experimente" tenta rodar um modelo de IA diretamente no navegador com WebGPU. Na primeira pergunta, o navegador pode baixar um modelo local. Se o navegador não suportar WebGPU ou não conseguir carregar o modelo, o chat cai para a base local da demo.

O microfone do navegador normalmente exige HTTPS ou `localhost`, então a seção interativa funciona melhor usando algum servidor local.

## Estrutura

```text
.
├── index.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── browser-ai.js
│   │   ├── config.js
│   │   ├── interactive.js
│   │   ├── main.js
│   │   ├── i18n.js
│   │   └── robot_animation.js
│   └── images/
│       ├── Apresentacao/
│       ├── Case3D/
│       ├── HardwareDev/
│       ├── HardwareFinal/
│       ├── SoftwareDev/
│       ├── SoftwareFinal/
│       └── Testes/
└── README.md
```

## Publicação no GitHub Pages

1. Suba estes arquivos para um repositório GitHub.
2. Em `Settings > Pages`, escolha a branch principal e a pasta `/`.
3. O site será servido diretamente pela raiz do repositório.

## IA no navegador

O arquivo `assets/js/browser-ai.js` usa WebLLM para carregar um modelo local no navegador do visitante. A configuração pública fica em `assets/js/config.js`.

```js
window.TALKING_BUDDY_BROWSER_AI = {
  enabled: true,
  model: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  cdn: "https://esm.run/@mlc-ai/web-llm",
};
```

Esse modo não usa chave, backend ou proxy. O custo computacional fica no computador do visitante, então a primeira carga pode demorar e navegadores sem WebGPU usam a base local da demo.

## Notas de manutenção

- Não há dependências npm, Vite, React, TanStack ou Lovable.
- O chat da seção "Experimente" tenta usar IA local no navegador.
- A base local em `assets/js/interactive.js` fica como fallback para navegadores sem WebGPU.
