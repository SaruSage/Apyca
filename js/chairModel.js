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
    mostrarTravessas,
    fracaoTravessa,
    fracaoTravessaEsp,
  } = CADEIRA;

  const W = L + t;
  const D = L + t;
  const topoPerna = H;
  const topoEncosto = H + tAssento + alturaEncosto;

  const barras = [];

  // --- Pernas ---
  // As dianteiras terminam na face inferior do assento (z = H).
  // As traseiras sobem ate o topo do encosto e atravessam o assento,
  // o que e construtivamente normal: o assento encaixa entre elas.
  barras.push(barra(0,     D - t, 0, t, t, topoPerna));    // frente esquerda
  barras.push(barra(W - t, D - t, 0, t, t, topoPerna));    // frente direita
  barras.push(barra(0,     0,     0, t, t, topoEncosto));  // tras esquerda
  barras.push(barra(W - t, 0,     0, t, t, topoEncosto));  // tras direita

  // --- Assento ---
  barras.push(barra(-g, 0, H, W + 2 * g, D + g, tAssento));

  // --- Painel do encosto ---
  // Fica ENTRE os postes traseiros (x de t a W - t) e a face da frente
  // coincide com a face da frente das pernas (y = t). Assim o painel le
  // como parte da mesma estrutura, sem parecer peca solta ou recuada.
  const tEnc = Math.min(t, tEncosto);
  const zBasePainel = H + tAssento + alturaEncosto * fracaoBasePainel;
  const altPainel = topoEncosto - zBasePainel;

  if (altPainel > 0) {
    barras.push(barra(t, t - tEnc, zBasePainel, W - 2 * t, tEnc, altPainel));
  }

  // --- Travessas (opcionais) ---
  if (mostrarTravessas) {
    const zTrav = fracaoTravessa * H;
    const tTrav = Math.max(10, fracaoTravessaEsp * t);
    const off = (t - tTrav) / 2;

    // Laterais, ligando perna dianteira e traseira do mesmo lado
    barras.push(barra(off, t, zTrav, tTrav, D - 2 * t, tTrav));
    barras.push(barra(W - t + off, t, zTrav, tTrav, D - 2 * t, tTrav));

    // Frontal, entre as duas pernas dianteiras
    barras.push(barra(t, D - t + off, zTrav, W - 2 * t, tTrav, tTrav));
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