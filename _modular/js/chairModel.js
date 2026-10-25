/**
 * Converte as entradas do usuario na lista de barras 3D da cadeira.
 * Nao sabe nada de tela: devolve apenas paralelepipedos em milimetros.
 *
 * Sistema de eixos: x para a direita, y para o fundo, z para cima.
 * O encosto fica em y = 0 (lado mais distante da camera isometrica).
 *
 * CAMADAS DE PINTURA — ordem de montagem, do fundo para a frente:
 *   0 = pernas abaixo do assento
 *   1 = reservado
 *   2 = assento
 *   3 = conjunto superior traseiro: postes E encosto
 *
 * Cada barra leva uma "cor" propria. Sem cor, o render usa a cor do material.
 */

import { CADEIRA } from './constantes.js';

function barra(x, y, z, dx, dy, dz, camada, cor) {
  return { x, y, z, dx, dy, dz, camada, cor };
}

const RENDER_PADRAO = {
  pernas: '#a9713f',
  assento: '#a9713f',
  encosto: { tipo: 'painel', cor: '#a9713f', n: 3, fracao: 0.2 },
  veios: false,
};

/** Encosto em painel unico. */
function encostoPainel(x0, largura, zBase, alt, tEnc, cor) {
  return [barra(x0, 0, zBase, largura, tEnc, alt, 3, cor)];
}

/**
 * Encosto em ripas horizontais.
 * n ripas de altura unitaria separadas por vaos da mesma altura, com
 * unitaria = alt / (2n - 1). Assim n ripas + (n - 1) vaos fecham a altura.
 * A profundidade de cada ripa e fracao * tEnc.
 */
function encostoRipas(x0, largura, zBase, alt, tEnc, cor, n, fracao) {
  const unidade = alt / (2 * n - 1);
  const tRipa = fracao * tEnc;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(
      barra(x0, 0, zBase + i * 2 * unidade, largura, tRipa, unidade, 3, cor)
    );
  }
  return out;
}

export function construirBarras(espessura, altura, material) {
  const {
    L,
    folga,
    fracaoEspessuraAssento,
    fracaoEspessuraEncosto,
    alturaAbertura,
    alturaEncosto,
    espessuraMaxima,
  } = CADEIRA;

  const render = material?.render ?? RENDER_PADRAO;

  const t = Math.min(espessura, espessuraMaxima);
  const H = altura;

  const tAssento = fracaoEspessuraAssento * t;
  const tEnc = fracaoEspessuraEncosto * t;

  const zTopoAssento = H + tAssento;
  const zTopoEncosto = zTopoAssento + alturaEncosto;
  const zBaseEncosto = zTopoAssento + alturaAbertura;

  const barras = [];

  // --- Camada 0: pernas abaixo do assento ---
  barras.push(barra(0, L - t, 0, t, t, H, 0, render.pernas));
  barras.push(barra(L - t, L - t, 0, t, t, H, 0, render.pernas));
  barras.push(barra(0, 0, 0, t, t, H, 0, render.pernas));
  barras.push(barra(L - t, 0, 0, t, t, H, 0, render.pernas));

  // --- Camada 2: assento ---
  barras.push(
    barra(-folga, -folga, H, L + 2 * folga, L + 2 * folga, tAssento, 2, render.assento)
  );

  // --- Camada 3: conjunto superior traseiro ---
  const hPoste = zTopoEncosto - zTopoAssento;
  barras.push(barra(0, 0, zTopoAssento, t, t, hPoste, 3, render.pernas));
  barras.push(barra(L - t, 0, zTopoAssento, t, t, hPoste, 3, render.pernas));

  // Encosto: painel unico ou ripas horizontais, conforme o material.
  const largPainel = L - 2 * t;
  const altPainel = zTopoEncosto - zBaseEncosto;
  const spec = render.encosto ?? RENDER_PADRAO.encosto;

  if (altPainel > 0 && largPainel > 0) {
    const corEnc = spec.cor ?? render.pernas;

    if (spec.tipo === 'ripas') {
      barras.push(
        ...encostoRipas(
          t, largPainel, zBaseEncosto, altPainel, tEnc,
          corEnc, spec.n ?? 3, spec.fracao ?? 0.2
        )
      );
    } else {
      barras.push(...encostoPainel(t, largPainel, zBaseEncosto, altPainel, tEnc, corEnc));
    }
  }

  return barras;
}

/** Dimensoes externas do modelo, em mm, uteis para legendas */
export function dimensoesExternas(barras) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const b of barras) {
    min[0] = Math.min(min[0], b.x);
    min[1] = Math.min(min[1], b.y);
    min[2] = Math.min(min[2], b.z);
    max[0] = Math.max(max[0], b.x + b.dx);
    max[1] = Math.max(max[1], b.y + b.dy);
    max[2] = Math.max(max[2], b.z + b.dz);
  }
  return {
    largura: max[0] - min[0],
    profundidade: max[1] - min[1],
    altura: max[2] - min[2],
  };
}