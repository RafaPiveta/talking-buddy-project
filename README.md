# Talking Buddy

Site estático do projeto Talking Buddy, feito apenas com HTML, CSS e JavaScript.

## Como rodar localmente

Abra o arquivo `index.html` direto no navegador ou use um servidor estático simples:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

O microfone do navegador normalmente exige HTTPS ou `localhost`, então a seção interativa funciona melhor usando o servidor local.

## Estrutura

```text
.
├── index.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── interactive.js
│   │   ├── main.js
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

## Notas de manutenção

- Não há dependências npm, Vite, React, TanStack ou Lovable.
- O chat da seção "Experimente" é uma demo local em JavaScript, sem backend.
- Para ligar uma IA real no futuro, o ponto de integração é `assets/js/interactive.js`.
