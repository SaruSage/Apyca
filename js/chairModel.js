/**
 * Converte as entradas na lista de pecas 3D da cadeira.
 * Nao sabe nada de tela: devolve primitivos em milimetros.
 *
 * Dois primitivos:
 *   caixa    — paralelepipedo alinhado aos eixos
 *   cilindro — prisma de eixo vertical (r, z0, h)
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

export function caixa(x, y, z, dx, dy, dz, camada, cor){
  return { tipo: 'caixa', x, y, z, dx, dy, dz, camada, cor };
}

export function cilindro(cx, cy, r, z0, h, camada, cor){
  return { tipo: 'cilindro', cx, cy, r, z0, h, camada, cor };
}

/** Caixa envolvente de uma peca, qualquer que seja o tipo. */
export function bboxPeca(p){
  if (p.tipo === 'cilindro') {
    return {
      min: [p.cx - p.r, p.cy - p.r, p.z0],
      max: [p.cx + p.r, p.cy + p.r, p.z0 + p.h]
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

export function construirBarras(espessura, altura, material, forma = 'quadrada'){
  const {
    L, folga, fracaoEspessuraAssento, fracaoEspessuraEncosto,
    alturaAbertura, alturaEncosto, espessuraMaxima
  } = CADEIRA;

  const render = (material && material.render) || RENDER_PADRAO;
  const redonda = forma === 'redonda';
  const t = Math.min(espessura, espessuraMaxima);
  const H = altura;

  const tAssento = fracaoEspessuraAssento * t;
  const tEnc = fracaoEspessuraEncosto * t;

  const zTopoAssento = H + tAssento;
  const zTopoEncosto = zTopoAssento + alturaEncosto;
  const zBaseEncosto = zTopoAssento + alturaAbertura;

  const barras = [];

  /*
   * Uma perna apoiada no canto (x, y) do pe, com base em z0 e altura h.
   *
   * Quadrada: ocupa o quadrado de lado t a partir de (x, y).
   * Redonda : circulo de diametro t INSCRITO nesse mesmo quadrado. O centro
   *           vai para (x + t/2, y + t/2), entao o envelope externo continua
   *           indo de 0 a L nos dois eixos e a cadeira nao muda de tamanho.
   */
  function perna(x, y, z0, h, camada){
    if (redonda) {
      barras.push(cilindro(x + t/2, y + t/2, t/2, z0, h, camada, render.pernas));
    } else {
      barras.push(caixa(x, y, z0, t, t, h, camada, render.pernas));
    }
  }

  // Camada 0: pernas abaixo do assento
  perna(0,     L - t, 0, H, 0);
  perna(L - t, L - t, 0, H, 0);
  perna(0,     0,     0, H, 0);
  perna(L - t, 0,     0, H, 0);

  // Camada 2: assento
  barras.push(caixa(-folga, -folga, H,
                    L + 2 * folga, L + 2 * folga, tAssento, 2, render.assento));

  // Camada 3: postes acima do assento
  const hPoste = zTopoEncosto - zTopoAssento;
  perna(0,     0, zTopoAssento, hPoste, 3);
  perna(L - t, 0, zTopoAssento, hPoste, 3);

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