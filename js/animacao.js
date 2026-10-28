/**
 * Animacao de ruina da cadeira.
 *
 * RUINA — usada quando a configuracao reprova.
 *   Cada grupo e um corpo rigido simples: gravidade, translacao e rotacao em
 *   torno do proprio centroide. O piso e corrigido a cada quadro.
 *
 *   DOIS DETALHES QUE FAZEM A DIFERENCA
 *   1. A direcao de tombamento de cada peca e radial, para fora do centro da
 *      cadeira. Perna nao gira no proprio eixo: tomba para fora, que e o que
 *      ela faria de verdade.
 *   2. O amortecimento de impacto so vale quando a peca esta DESCENDO. Se for
 *      aplicado em todo quadro de contato, a velocidade angular morre em
 *      poucos quadros e a perna fica parada em pe — era exatamente o defeito
 *      anterior.
 *
 *   CAMADA NEUTRALIZADA
 *   Na pose montada, filtrarOrdenar() usa a camada antes da profundidade, para
 *   o assento nao brigar com as pernas no ponto de contato. Durante a ruina as
 *   pecas se separam, e essa heuristica passa a errar: uma perna que girou para
 *   dentro e esta na FRENTE do assento continuaria sendo pintada primeiro, e o
 *   assento a cobriria. Por isso desenhar() zera a camada antes de ordenar,
 *   devolvendo a profundidade pura — criterio correto para corpos soltos.
 *
 * ESCOPO DESTE MODULO
 *   So a ruina. A animacao de aprovacao (joinhas) vive em joinhas.js, com as
 *   classes .camada-joinhas e .joinha-flutuante. A funcao animarJoinhas que
 *   existia aqui era duplicata da de la, com CSS diferente, e foi removida
 *   para nao deixar duas versoes do mesmo efeito.
 */

import {
  computeView, faces3D, filtrarOrdenar, projetarFaces, matrizEuler, transformar
} from './iso.js';
import { bboxPeca } from './chairModel.js';
import { montarSVG, sombraNoPiso } from './render.js';

const GRAVIDADE = 9810;        // mm/s²
const DURACAO_MAX = 3.2;       // s
const LADOS_ANIMACAO = 12;     // orcamento de quadro
const GIRO_MAX = 14;           // rad/s, evita peca girando como ventilador

function criarSorteio(semente){
  let s = Math.abs(Math.floor(semente)) % 2147483647 || 1;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function agrupar(faces){
  const mapa = new Map();

  for (const f of faces) {
    if (!mapa.has(f.grupo)) {
      mapa.set(f.grupo, { grupo: f.grupo, faces: [], centro: [0, 0, 0], n: 0 });
    }
    const g = mapa.get(f.grupo);
    g.faces.push(f);
    for (const p of f.quad) {
      g.centro[0] += p[0];
      g.centro[1] += p[1];
      g.centro[2] += p[2];
      g.n += 1;
    }
  }

  const saida = [];
  for (const g of mapa.values()) {
    g.centro = g.centro.map(v => v / g.n);
    saida.push(g);
  }
  return saida;
}

/** Centro horizontal da cadeira inteira, usado como origem do tombamento. */
function centroDaCadeira(barras){
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const b of barras) {
    const bb = bboxPeca(b);
    if (bb.min[0] < minX) minX = bb.min[0];
    if (bb.max[0] > maxX) maxX = bb.max[0];
    if (bb.min[1] < minY) minY = bb.min[1];
    if (bb.max[1] > maxY) maxY = bb.max[1];
  }

  /* Sem pecas, os limites ficam em Infinity e o centro vira NaN, que se
     propaga para a direcao de queda de todas as pecas. */
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return [0, 0];

  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

export function animarRuina(container, barras, material, opcoes = {}){
  /* Sem pecas nao ha o que animar: encerra na hora, para o chamador nao
     ficar esperando um callback que nunca viria. */
  if (!Array.isArray(barras) || barras.length === 0) {
    if (opcoes.aoTerminar) opcoes.aoTerminar();
    return function parar(){};
  }

  const largura = opcoes.largura || 860;
  const altura = opcoes.altura || 620;
  const idFiltro = 'borrao-anim';

  const faces = faces3D(barras, material.cor, LADOS_ANIMACAO);
  const vista = computeView(barras, largura, altura, 34, 0.76);
  const sombra = sombraNoPiso(vista.bounds, vista.escala, vista.origem);

  const grupos = agrupar(faces);
  const centro = centroDaCadeira(barras);
  const rnd = criarSorteio(opcoes.semente || Math.floor(Math.random() * 99991));

  const estados = grupos.map(g => {
    const dx = g.centro[0] - centro[0];
    const dy = g.centro[1] - centro[1];
    const d = Math.hypot(dx, dy);

    /*
     * Direcao de queda. Peca no eixo (coluna, pe, assento) nao tem direcao
     * preferida, entao cai para um lado qualquer.
     */
    let ux, uy;
    if (d < 25) {
      const a = rnd() * Math.PI * 2;
      ux = Math.cos(a);
      uy = Math.sin(a);
    } else {
      ux = dx / d;
      uy = dy / d;
    }

    /*
     * Eixo de rotacao que faz o topo da peca caminhar na direcao (ux, uy):
     * o produto vetorial de (ax, ay, 0) com (0, 0, 1) e (ay, -ax, 0).
     * Para isso ser paralelo a (ux, uy), precisamos ax = -uy e ay = ux.
     */
    const ax = -uy;
    const ay = ux;
    const impulso = 4.4 + rnd() * 2.4;

    return {
      g,
      ang: [0, 0, 0],
      velAng: [
        ax * impulso + (rnd() - 0.5) * 1.6,
        ay * impulso + (rnd() - 0.5) * 1.6,
        (rnd() - 0.5) * 1.4
      ],
      desloc: [0, 0, 0],
      vel: [
        ux * (90 + rnd() * 110) + (rnd() - 0.5) * 120,
        uy * (90 + rnd() * 110) + (rnd() - 0.5) * 120,
        60 + rnd() * 180
      ],
      dormindo: false
    };
  });

  let anterior = 0;
  let inicio = 0;
  let ativo = true;
  let terminou = false;
  let raf = 0;

  function blocosTransformados(){
    const blocos = [];

    for (const st of estados) {
      const R = matrizEuler(st.ang[0], st.ang[1], st.ang[2]);
      const fs = st.g.faces.map(f => transformar(f, st.g.centro, R, st.desloc));

      let minZ = Infinity;
      for (const f of fs) for (const p of f.quad) if (p[2] < minZ) minZ = p[2];

      blocos.push({ st, faces: fs, minZ });
    }
    return blocos;
  }

  function desenhar(blocos){
    const todas = [];
    for (const b of blocos) for (const f of b.faces) todas.push(f);

    /*
     * Camada neutralizada. Os objetos aqui vem de transformar(), que devolve
     * copias — mexer neles nao afeta st.g.faces, que guarda a pose original.
     *
     * Sem este laco, uma perna que girou para dentro e esta na frente do
     * assento seria desenhada antes dele e ficaria escondida.
     */
    for (const f of todas) f.camada = 0;

    const visiveis = projetarFaces(
      filtrarOrdenar(todas), vista.escala, vista.origem, 'animado'
    );

    container.innerHTML = montarSVG({
      largura,
      altura,
      idFiltro,
      sombra,
      opacidadeSombra: 0.42,
      faces: visiveis,
      veiosFn: null
    });
  }

  function finalizar(){
    if (terminou) return;
    terminou = true;
    ativo = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (opcoes.aoTerminar) opcoes.aoTerminar();
  }

  function quadro(agora){
    if (!ativo) return;
    if (!inicio) { inicio = agora; anterior = agora; }

    const dt = Math.min(0.05, (agora - anterior) / 1000);
    const t = (agora - inicio) / 1000;
    anterior = agora;

    // 1) Integracao de Euler semi-implicita
    for (const st of estados) {
      if (st.dormindo) continue;

      st.vel[2] -= GRAVIDADE * dt;

      for (let i = 0; i < 3; i++) {
        st.desloc[i] += st.vel[i] * dt;
        st.ang[i] += st.velAng[i] * dt;
        st.velAng[i] = Math.max(-GIRO_MAX, Math.min(GIRO_MAX, st.velAng[i]));
      }
    }

    // 2) Correcao de piso
    let blocos = blocosTransformados();

    for (const b of blocos) {
      const st = b.st;
      if (st.dormindo) continue;

      if (b.minZ < 0) {
        st.desloc[2] -= b.minZ;

        if (st.vel[2] < 0) {
          /* Impacto. So aqui a energia e dissipada. */
          st.vel[2] = -st.vel[2] * 0.18;
          st.vel[0] *= 0.62;
          st.vel[1] *= 0.62;
          st.velAng = st.velAng.map(v => v * 0.62);
        } else {
          /* Apoiada: atrito de deslizamento, por segundo e nao por quadro. */
          st.vel[2] = 0;
          const atrito = Math.pow(0.03, dt);
          const atritoAng = Math.pow(0.18, dt);
          st.vel[0] *= atrito;
          st.vel[1] *= atrito;
          st.velAng = st.velAng.map(v => v * atritoAng);
        }
      }

      const v = Math.hypot(st.vel[0], st.vel[1], st.vel[2]);
      const w = Math.hypot(st.velAng[0], st.velAng[1], st.velAng[2]);
      if (v < 24 && w < 0.35) st.dormindo = true;
    }

    blocos = blocosTransformados();
    desenhar(blocos);

    if (t > DURACAO_MAX || estados.every(s => s.dormindo)) {
      finalizar();
      return;
    }

    raf = requestAnimationFrame(quadro);
  }

  raf = requestAnimationFrame(quadro);

  return function parar(){
    ativo = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  };
}