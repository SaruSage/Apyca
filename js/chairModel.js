/**
 * Converte as entradas do usuario na lista de barras 3D da cadeira.
 * Nao sabe nada de tela: devolve apenas paralelepipedos em milimetros.
 *
 * Sistema de eixos: x para a direita, y para o fundo, z para cima.
 * O encosto fica em y = 0 (lado mais distante da camera isometrica).
 */

import { CADEIRA } from './constantes.js';

function barra(x, y, z, dx, dy, dz) {
  return { x, y, z, dx, dy, dz };
}

export function construirBarras(espessura, altura) {
  const t = espessura;
  const H = altura;
  const {
    L,
    folgaAssento: g,
    tAssento,
    alturaEncosto,
    tEncosto,
    fracaoBasePainel,
    fracaoTravessa,
    fracaoTravessaEsp,
  } = CADEIRA;

  const W = L + t;
  const D = L + t;
  const topoFrente = H;
  const topoTras = H + tAssento + alturaEncosto;

  const barras = [];

  // --- Pernas ---
  barras.push(barra(0,     D - t, 0, t, t, topoFrente)); // frente esquerda
  barras.push(barra(W - t, D - t, 0, t, t, topoFrente)); // frente direita
  barras.push(barra(0,     0,     0, t, t, topoTras));   // tras esquerda
  barras.push(barra(W - t, 0,     0, t, t, topoTras));   // tras direita

  // --- Travessas laterais ---
  const zTrav = fracaoTravessa * H;
  const tTrav = Math.max(10, fracaoTravessaEsp * t);
  const centro = (t - tTrav) / 2;
  const compTrav = D - 2 * t;

  barras.push(barra(centro, t, zTrav, tTrav, compTrav, tTrav));
  barras.push(barra(W - t + centro, t, zTrav, tTrav, compTrav, tTrav));

  // --- Travessa frontal ---
  barras.push(barra(t, D - t + centro, zTrav, W - 2 * t, tTrav, tTrav));

  // --- Assento ---
  barras.push(barra(-g, 0, H, W + 2 * g, D + g, tAssento));

  // --- Painel do encosto ---
  const zBasePainel = H + tAssento + alturaEncosto * fracaoBasePainel;
  const altPainel = topoTras - zBasePainel;
  barras.push(barra(0, 0, zBasePainel, W, tEncosto, altPainel));

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