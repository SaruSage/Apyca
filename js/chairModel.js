/**
 * Converte as entradas na lista de pecas 3D da cadeira.
 * Nao sabe nada de tela: devolve primitivos em milimetros.
 *
 * Primitivos:
 *   caixa    — paralelepipedo alinhado aos eixos
 *   cilindro — prisma de eixo vertical (r, z0, h)
 *   cone     — tronco de cone de eixo vertical (rBase, rTopo, z0, h)
 *   piramide — tronco de piramide de base quadrada (ladoBase, ladoTopo, z0, h)
 *
 * Eixos: x para a direita, y para o fundo, z para cima.
 * O encosto fica em y = 0 (lado mais distante da camera isometrica).
 *
 * CAMADAS DE PINTURA:
 *   0 = pernas abaixo do assento (e pe da base)
 *   2 = assento
 *   3 = conjunto superior traseiro: postes E encosto
 *
 * PE DO PEDESTAL
 *   perna redonda -> tronco de cone, raio da base = coneRaioBase
 *   perna quadrada -> tronco de piramide, LADO da base = 2 * coneRaioBase
 *                     (mesmo diametro do cone, como pedido)
 *   Em ambos os casos o pe recebe a COR DO ASSENTO do material.
 *
 * IMPORTANTE — 1 PERNA
 * O conjunto acima do assento e IDENTICO ao da cadeira de 4 pernas: dois
 * postes traseiros nos cantos, painel do encosto entre eles. O assento e que
 * sustenta o encosto, por balanco. A coluna central nao toca o encosto.
 */

import { CADEIRA } from './constantes.js';

export function caixa(x, y, z, dx, dy, dz, camada, cor){
  return { tipo: 'caixa', x, y, z, dx, dy, dz, camada, cor };
}

export function cilindro(cx, cy, r, z0, h, camada, cor){
  return { tipo: 'cilindro', cx, cy, r, z0, h, camada, cor };
}

export function cone(cx, cy, rBase, rTopo, z0, h, camada, cor){
  return { tipo: 'cone', cx, cy, rBase, rTopo, z0, h, camada, cor };
}

export function piramide(cx, cy, ladoBase, ladoTopo, z0, h, camada, cor){
  return { tipo: 'piramide', cx, cy, ladoBase, ladoTopo, z0, h, camada, cor };
}

/** Caixa envolvente de uma peca, qualquer que seja o tipo. */
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

/** Encosto em ripas horizontais: n ripas + (n-1) vaos fecham a altura. */
function encostoRipas(x0, y0, larg, zBase, alt, prof, cor, n, fracao){
  const unidade = alt / (2 * n - 1);
  const pRipa = fracao * prof;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(caixa(x0, y0, zBase + i * 2 * unidade, larg, pRipa, unidade, 3, cor));
  }
  return out;
}

export function construirBarras(espessura, altura, material, forma = 'quadrada', numPernas = 4){
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

  const xCentro = L / 2 - t / 2;   // canto inferior esquerdo da perna central
  const cCentro = L / 2;           // eixo do pedestal

  /** Perna apoiada no canto (x, y) do pe, com base em z0 e altura h. */
  function perna(x, y, z0, h, camada){
    if (h <= 0) return;
    if (redonda) {
      barras.push(cilindro(x + t / 2, y + t / 2, t / 2, z0, h, camada, render.pernas));
    } else {
      barras.push(caixa(x, y, z0, t, t, h, camada, render.pernas));
    }
  }

  // ---------- Camada 0: apoios ----------
  if (n === 4) {
    perna(0,     L - t, 0, H, 0);
    perna(L - t, L - t, 0, H, 0);
    perna(0,     0,     0, H, 0);
    perna(L - t, 0,     0, H, 0);
  } else {
    /*
     * Pe do pedestal: cone ou piramide, na cor do assento.
     * A base da piramide tem lado 2 * coneRaioBase, ou seja, o mesmo
     * diametro do cone. O envelope externo nao muda em nenhum eixo.
     */
    const hPe = Math.min(coneAltura, H * 0.4);
    const R = coneRaioBase;
    const corPe = render.assento || render.pernas;

    if (redonda) {
      barras.push(cone(cCentro, cCentro, R, t / 2, 0, hPe, 0, corPe));
    } else {
      // Lado da base = fracao * diametro do cone. O topo tem o tamanho da perna.
      const ladoBase = 2 * R * fracaoLadoPiramide;
      barras.push(piramide(cCentro, cCentro, ladoBase, t, 0, hPe, 0, corPe));
    }

    perna(xCentro, xCentro, hPe, H - hPe, 0);
  }

  // ---------- Camada 2: assento ----------
  barras.push(caixa(-folga, -folga, H,
                    L + 2 * folga, L + 2 * folga, tAssento, 2, render.assento));

  // ---------- Camada 3: conjunto superior traseiro ----------
  const hPoste = zTopoEncosto - zTopoAssento;
  perna(0,     0, zTopoAssento, hPoste, 3);
  perna(L - t, 0, zTopoAssento, hPoste, 3);

  const largPainel = L - 2 * t;
  const altPainel = zTopoEncosto - zBaseEncosto;
  const spec = render.encosto || RENDER_PADRAO.encosto;
  const corEnc = spec.cor || render.pernas;

  if (altPainel > 0 && largPainel > 0) {
    if (spec.tipo === 'ripas') {
      barras.push(...encostoRipas(t, 0, largPainel, zBaseEncosto, altPainel,
                                  tEnc, corEnc, spec.n || 3, spec.fracao || 0.2));
    } else {
      barras.push(caixa(t, 0, zBaseEncosto, largPainel, tEnc, altPainel, 3, corEnc));
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