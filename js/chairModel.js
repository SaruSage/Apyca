/**
 * Converte as entradas do usuario na lista de barras 3D da cadeira.
 * Nao sabe nada de tela: devolve apenas paralelepipedos em milimetros.
 *
 * Sistema de eixos: x para a direita, y para o fundo, z para cima.
 * O encosto fica em y = 0 (lado mais distante da camera isometrica).
 *
 * Regras de ancoragem — todas as pernas usam o MESMO criterio:
 * faces externas fixas em x = 0 / x = L e y = 0 / y = L.
 * A espessura cresce sempre para dentro do pe.
 */

import { CADEIRA } from './constantes.js';

function barra(x, y, z, dx, dy, dz) {
  return { x, y, z, dx, dy, dz };
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

  // --- Pernas dianteiras: do piso ate a face inferior do assento ---
  barras.push(barra(0, L - t, 0, t, t, H));      // frente esquerda
  barras.push(barra(L - t, L - t, 0, t, t, H));  // frente direita

  // --- Pernas traseiras: divididas na altura do assento ---
  // A divisao impede que a perna atravesse o tampo. Com volume compartilhado
  // a ordenacao por profundidade troca de resultado conforme t varia.
  barras.push(barra(0, 0, 0, t, t, H));      // tras esq., abaixo do assento
  barras.push(barra(L - t, 0, 0, t, t, H));  // tras dir., abaixo do assento

  const hPoste = zTopoEncosto - zTopoAssento;
  barras.push(barra(0, 0, zTopoAssento, t, t, hPoste));      // tras esq., acima
  barras.push(barra(L - t, 0, zTopoAssento, t, t, hPoste));  // tras dir., acima

  // --- Assento: sobrepasse identico nos quatro lados ---
  barras.push(
    barra(-folga, -folga, H, L + 2 * folga, L + 2 * folga, tAssento)
  );

  // --- Encosto: chapa atras dos postes, largura total ---
  // A posicao em y NAO depende de t: fica ancorada no plano de tras dos postes.
  // Antes ela acompanhava t e o painel deslizava para frente ao engrossar a perna.
  const altPainel = zTopoEncosto - zBaseEncosto;
  if (altPainel > 0) {
    barras.push(barra(0, -tEncosto, zBaseEncosto, L, tEncosto, altPainel));
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