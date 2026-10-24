/**
 * Converte as entradas do usuario na lista de barras 3D da cadeira.
 * Nao sabe nada de tela: devolve apenas paralelepipedos em milimetros.
 *
 * Sistema de eixos: x para a direita, y para o fundo, z para cima.
 * O encosto fica em y = 0 (lado mais distante da camera isometrica).
 *
 * Ancoragem: faces externas fixas em x = 0 / x = L e y = 0 / y = L.
 * A espessura cresce sempre para dentro do pe.
 *
 * CAMADAS DE PINTURA — resolvem a ordem de desenho por montagem, nao por
 * profundidade. Sem isso, o par simetrico de postes era pintado em lados
 * diferentes do assento e o resultado dependia de t.
 *   0 = pernas abaixo do assento
 *   1 = painel do encosto (atras de tudo, acima do assento)
 *   2 = assento
 *   3 = postes acima do assento
 */

import { CADEIRA } from './constantes.js';

function barra(x, y, z, dx, dy, dz, camada) {
  return { x, y, z, dx, dy, dz, camada };
}

export function construirBarras(espessura, altura) {
  const {
    L,
    folga,
    tAssento,
    alturaAbertura,
    alturaEncosto,
    tEncosto,
    espessuraMaxima,
  } = CADEIRA;

  const t = Math.min(espessura, espessuraMaxima);
  const H = altura;

  const zTopoAssento = H + tAssento;
  const zTopoEncosto = zTopoAssento + alturaEncosto;
  const zBaseEncosto = zTopoAssento + alturaAbertura;

  const barras = [];

  // --- Camada 0: pernas abaixo do assento ---
  // Todas com a face externa no perimetro do pe. O pe mede L x L.
  barras.push(barra(0, L - t, 0, t, t, H, 0));      // frente esquerda
  barras.push(barra(L - t, L - t, 0, t, t, H, 0));  // frente direita
  barras.push(barra(0, 0, 0, t, t, H, 0));          // tras esquerda
  barras.push(barra(L - t, 0, 0, t, t, H, 0));      // tras direita

  // --- Camada 1: painel do encosto ---
  // Ancorado no plano de tras dos postes (y = 0), recuado de tEncosto.
  // A posicao NAO depende de t.
  const altPainel = zTopoEncosto - zBaseEncosto;
  if (altPainel > 0) {
    barras.push(barra(0, -tEncosto, zBaseEncosto, L, tEncosto, altPainel, 1));
  }

  // --- Camada 2: assento ---
  // Sobrepasse identico nos quatro lados.
  barras.push(
    barra(-folga, -folga, H, L + 2 * folga, L + 2 * folga, tAssento, 2)
  );

  // --- Camada 3: postes acima do assento ---
  // Sempre pintados depois do assento, em qualquer espessura.
  const hPoste = zTopoEncosto - zTopoAssento;
  barras.push(barra(0, 0, zTopoAssento, t, t, hPoste, 3));          // tras esq.
  barras.push(barra(L - t, 0, zTopoAssento, t, t, hPoste, 3));      // tras dir.

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