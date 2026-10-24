# Cadeira A3 — Simulador Estrutural

Simulador de dimensionamento de uma cadeira de quatro pernas.
Front-end puro: HTML, CSS, JavaScript (ES modules) e SVG. Sem build, sem banco de dados.

## Como rodar

Os modulos ES nao carregam via `file://`. Use uma das opcoes:

- VSCode: instale a extensao **Live Server**, clique com o botao direito em
  `index.html` e escolha *Open with Live Server*.
- Terminal: `python -m http.server 8000` e abra `http://localhost:8000`.

## Testes

Abra `tests/tests.html` com o Live Server. Todos os cartoes devem ficar verdes.

## Estrutura

- `js/constantes.js` — constantes fisicas e hipoteses de projeto
- `js/materials.js` — propriedades mecanicas dos materiais
- `js/geometry.js` — secao transversal, inercia, esbeltez, Euler
- `js/solver.js` — nucleo de calculo (funcao pura)
- `js/app.js` — ligacao com o formulario e a tela
- `tests/tests.html` — casos ancora calculados a mao