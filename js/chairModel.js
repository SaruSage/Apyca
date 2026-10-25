/**
 * Converte as entradas na lista de pecas 3D da cadeira.
 *
 * Cada peca carrega um GRUPO. O grupo e o que permite animar uma peca sem
 * arrastar as outras: perna0..perna3, coluna, pe, assento, poste0, poste1,
 * encosto. Sem grupo, todas as pecas viram um bloco so.
 */

import { CADEIRA } from './constantes.js';

export function caixa(x, y, z, dx, dy, dz, camada, cor, grupo){
  return { tipo: 'caixa', x, y, z, dx, dy, dz, camada, cor, grupo };
}

export function cilindro(cx, cy, r, z0, h, camada, cor, grupo){
  return { tipo: 'cilindro', cx, cy, r, z0, h, camada, cor, grupo };
}

export function cone(cx, cy, rBase, rTopo, z0, h, camada, cor, grupo){
  return { tipo: 'cone', cx, cy, rBase, rTopo, z0, h, camada, cor, grupo };
}

export function piramide(cx, cy, ladoBase, ladoTopo, z0, h, camada, cor, grupo){
  return { tipo: 'piramide', cx, cy, ladoBase, ladoTopo, z0, h, camada, cor, grupo };
}

export function tubo(cx, cy, dim, parede, z0, h, redondo, camada, cor, grupo){
  return { tipo: 'tubo', cx, cy, dim, parede, z0, h, redondo, camada, cor, grupo };
}

export function bboxPeca(p){
  if (p.tipo === 'cilindro') {
    return {
      min: [p.cx - p.r, p.cy - p.r, p.z0],
      max: [p.cx + p.r, p.cy + p.r, p.z0 + p.h]
    };
  }
  if (p.tipo === 'cone') {
    return {
      min: [p.cx - p.rBase, p.cy - p.rBase, p.z0],
      max: [p.cx + p.rBase, p.cy + p.rBase, p.z0 + p.h]
    };
  }
  if (p.tipo === 'piramide') {
    const a = p.ladoBase / 2;
    return {
      min: [p.cx - a, p.cy - a, p.z0],
      max: [p.cx + a, p.cy + a, p.z0 + p.h]
    };
  }
  if (p.tipo === 'tubo') {
    const r = p.dim / 2;
    return {
      min: [p.cx - r, p.cy - r, p.z0],
      max: [p.cx + r, p.cy + r, p.z0 + p.h]
    };
  }
  return {
    min: [p.x, p.y, p.z],
    max: [p.x + p.dx, p.y + p.dy, p.z + p.dz]
  };
}

const RENDER_PADRAO = {
  pernas: '#a9713f',
  assento: '#a9713f',
  encosto: { tipo: 'painel', cor: '#a9713f' },
  veios: false
};

function encostoRipas(x0, y0, larg, zBase, alt, prof, cor, n, fracao){
  const unidade = alt / (2 * n - 1);
  const pRipa = fracao * prof;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(caixa(x0, y0, zBase + i * 2 * unidade, larg, pRipa, unidade,
                   3, cor, 'encosto'));
  }
  return out;
}

export function construirBarras(espessura, altura, material, forma = 'quadrada',
                                numPernas = 4, vazada = false, parede = 0){
  const {
    L, folga, fracaoEspessuraAssento, fracaoEspessuraEncosto,
    alturaAbertura, alturaEncosto, espessuraMaxima,
    coneRaioBase, coneAltura, fracaoLadoPiramide
  } = CADEIRA;

  const render = (material && material.render) || RENDER_PADRAO;
  const redonda = forma === 'redonda';
  const n = numPernas === 1 ? 1 : 4;
  const t = Math.min(espessura, espessuraMaxima);
  const H = altura;

  const tAssento = fracaoEspessuraAssento * t;
  const tEnc = fracaoEspessuraEncosto * t;

  const zTopoAssento = H + tAssento;
  const zTopoEncosto = zTopoAssento + alturaEncosto;
  const zBaseEncosto = zTopoAssento + alturaAbertura;

  const barras = [];

  const xCentro = L / 2 - t / 2;
  const cCentro = L / 2;

  function perna(x, y, z0, h, camada, grupo){
    if (h <= 0) return;
    const cx = x + t / 2;
    const cy = y + t / 2;

    if (vazada) {
      barras.push(tubo(cx, cy, t, parede, z0, h, redonda, camada,
                       render.pernas, grupo));
    } else if (redonda) {
      barras.push(cilindro(cx, cy, t / 2, z0, h, camada, render.pernas, grupo));
    } else {
      barras.push(caixa(x, y, z0, t, t, h, camada, render.pernas, grupo));
    }
  }

  // ---------- Camada 0: apoios ----------
  if (n === 4) {
    perna(0,     L - t, 0, H, 0, 'perna0');
    perna(L - t, L - t, 0, H, 0, 'perna1');
    perna(0,     0,     0, H, 0, 'perna2');
    perna(L - t, 0,     0, H, 0, 'perna3');
  } else {
    const hPe = Math.min(coneAltura, H * 0.4);
    const R = coneRaioBase;
    const corPe = render.assento || render.pernas;

    if (redonda) {
      barras.push(cone(cCentro, cCentro, R, t / 2, 0, hPe, 0, corPe, 'pe'));
    } else {
      const ladoBase = 2 * R * fracaoLadoPiramide;
      barras.push(piramide(cCentro, cCentro, ladoBase, t, 0, hPe, 0,
                           corPe, 'pe'));
    }

    perna(xCentro, xCentro, hPe, H - hPe, 0, 'coluna');
  }

  // ---------- Camada 2: assento ----------
  barras.push(caixa(-folga, -folga, H,
                    L + 2 * folga, L + 2 * folga, tAssento, 2,
                    render.assento, 'assento'));

  // ---------- Camada 3: conjunto superior traseiro ----------
  const hPoste = zTopoEncosto - zTopoAssento;
  perna(0,     0, zTopoAssento, hPoste, 3, 'poste0');
  perna(L - t, 0, zTopoAssento, hPoste, 3, 'poste1');

  const largPainel = L - 2 * t;
  const altPainel = zTopoEncosto - zBaseEncosto;
  const spec = render.encosto || RENDER_PADRAO.encosto;
  const corEnc = spec.cor || render.pernas;

  if (altPainel > 0 && largPainel > 0) {
    if (spec.tipo === 'ripas') {
      barras.push(...encostoRipas(t, 0, largPainel, zBaseEncosto, altPainel,
                                  tEnc, corEnc, spec.n || 3, spec.fracao || 0.2));
    } else {
      barras.push(caixa(t, 0, zBaseEncosto, largPainel, tEnc, altPainel, 3,
                        corEnc, 'encosto'));
    }
  }

  return barras;
}

export function dimensoesExternas(barras){
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const b of barras) {
    const bb = bboxPeca(b);
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], bb.min[a]);
      max[a] = Math.max(max[a], bb.max[a]);
    }
  }

  return {
    largura: max[0] - min[0],
    profundidade: max[1] - min[1],
    altura: max[2] - min[2]
  };
}