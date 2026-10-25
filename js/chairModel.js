/**
 * Converte as entradas na lista de barras 3D da cadeira.
 * Nao sabe nada de tela: devolve paralelepipedos em milimetros.
 *
 * Eixos: x para a direita, y para o fundo, z para cima.
 * O encosto fica em y = 0 (lado mais distante da camera isometrica).
 *
 * Ancoragem: faces externas das pernas fixas em x = 0 / x = L e y = 0 / y = L.
 * A espessura cresce sempre para dentro do pe.
 *
 * CAMADAS DE PINTURA — ordem de montagem:
 *   0 = pernas abaixo do assento
 *   2 = assento
 *   3 = conjunto superior traseiro: postes E encosto
 *
 * Postes e encosto na MESMA camada: a profundidade decide qual fica na frente,
 * e a perna esquerda cai atras do encosto enquanto a direita fica a frente.
 */

import { CADEIRA } from './constantes.js';

function barra(x, y, z, dx, dy, dz, camada, cor){
  return { x, y, z, dx, dy, dz, camada, cor };
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
    out.push(barra(x0, y0, zBase + i * 2 * unidade, larg, pRipa, unidade, 3, cor));
  }
  return out;
}

export function construirBarras(espessura, altura, material){
  const {
    L, folga, fracaoEspessuraAssento, fracaoEspessuraEncosto,
    alturaAbertura, alturaEncosto, espessuraMaxima
  } = CADEIRA;

  const render = (material && material.render) || RENDER_PADRAO;
  const t = Math.min(espessura, espessuraMaxima);
  const H = altura;

  const tAssento = fracaoEspessuraAssento * t;
  const tEnc = fracaoEspessuraEncosto * t;

  const zTopoAssento = H + tAssento;
  const zTopoEncosto = zTopoAssento + alturaEncosto;
  const zBaseEncosto = zTopoAssento + alturaAbertura;

  const barras = [];

  // Camada 0: pernas abaixo do assento
  barras.push(barra(0,     L - t, 0, t, t, H, 0, render.pernas));
  barras.push(barra(L - t, L - t, 0, t, t, H, 0, render.pernas));
  barras.push(barra(0,     0,     0, t, t, H, 0, render.pernas));
  barras.push(barra(L - t, 0,     0, t, t, H, 0, render.pernas));

  // Camada 2: assento
  barras.push(barra(-folga, -folga, H,
                    L + 2 * folga, L + 2 * folga, tAssento, 2, render.assento));

  // Camada 3: postes acima do assento
  const hPoste = zTopoEncosto - zTopoAssento;
  barras.push(barra(0,     0, zTopoAssento, t, t, hPoste, 3, render.pernas));
  barras.push(barra(L - t, 0, zTopoAssento, t, t, hPoste, 3, render.pernas));

  // Camada 3: encosto, entre as pernas, face de tras fixa em y = 0
  const largPainel = L - 2 * t;
  const altPainel = zTopoEncosto - zBaseEncosto;
  const spec = render.encosto || RENDER_PADRAO.encosto;
  const corEnc = spec.cor || render.pernas;

  if (altPainel > 0 && largPainel > 0) {
    if (spec.tipo === 'ripas') {
      barras.push(...encostoRipas(t, 0, largPainel, zBaseEncosto, altPainel,
                                  tEnc, corEnc, spec.n || 3, spec.fracao || 0.2));
    } else {
      barras.push(barra(t, 0, zBaseEncosto, largPainel, tEnc, altPainel, 3, corEnc));
    }
  }

  return barras;
}

/** Dimensoes externas do modelo, em mm. */
export function dimensoesExternas(barras){
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const b of barras) {
    min[0] = Math.min(min[0], b.x);        max[0] = Math.max(max[0], b.x + b.dx);
    min[1] = Math.min(min[1], b.y);        max[1] = Math.max(max[1], b.y + b.dy);
    min[2] = Math.min(min[2], b.z);        max[2] = Math.max(max[2], b.z + b.dz);
  }
  return {
    largura: max[0] - min[0],
    profundidade: max[1] - min[1],
    altura: max[2] - min[2]
  };
}