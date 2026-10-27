/**
 * Travessas de apoio do assento.
 *
 * Modelo: viga biapoiada com carga uniformemente distribuida.
 *   M = q*Lt^2/8          delta = 5*q*Lt^4/(384*E*I)
 *
 * HIPOTESES
 *   - Apoio simples nos eixos das pernas (ligacao parafusada, sem rigidez
 *     de momento). E a leitura conservadora: da a maior flecha possivel.
 *     O anel real e continuo nos cantos, o que reduz a flecha.
 *   - A carga do assento se divide igualmente entre as quatro travessas.
 *   - O vao de CALCULO e a distancia entre os eixos das pernas (L - t).
 *     O COMPRIMENTO de cada viga e o vao entre as faces internas (L - 2t),
 *     usado apenas para volume e massa.
 *   - A massa do assento entra na carga: sao as travessas que o sustentam.
 *
 * GEOMETRIA
 * geometriaTravessas() e a fonte unica das dimensoes do quadro. chairModel.js
 * desenha a partir dela e verificarTravessas() calcula a massa a partir dela,
 * de modo que desenho e numero nunca saem de sincronia.
 *
 * Unidades: mm, N, MPa, kg.
 */

import { G, TRAVESSAS } from './constantes.js';

/**
 * Define a secao pedida pelo usuario. Chamado pelo app antes de calcular,
 * de modo que o solver, a geometria e o memorial usem o mesmo valor.
 * Devolve a secao efetivamente gravada.
 */
export function definirTravessaSecao(larguraMm, alturaMm){
  if (Number.isFinite(larguraMm) && larguraMm > 0) {
    TRAVESSAS.largura = larguraMm;
  }
  if (Number.isFinite(alturaMm) && alturaMm > 0) {
    TRAVESSAS.altura = alturaMm;
  }
  return { largura: TRAVESSAS.largura, altura: TRAVESSAS.altura };
}

/**
 * Secao efetiva da travessa, em mm, ja com os limites aplicados.
 *
 * A largura nao passa da dimensao externa da perna: a viga precisa encostar
 * na perna, e uma viga mais larga que ela nao teria apoio. A altura nao passa
 * de metade da altura da perna, para o quadro nunca competir com o assento.
 */
export function secaoTravessa(t, H){
  const b = Math.min(Math.max(TRAVESSAS.largura, 1), t);
  const hMax = Math.max(1, H * 0.5);
  const h = Math.min(Math.max(TRAVESSAS.altura, 1), hMax);
  return { b, h };
}

/**
 * Quadro das quatro travessas, encostado nas pernas.
 *
 * POSICIONAMENTO — a face externa de cada viga fica no MESMO plano da face
 * externa da perna:
 *
 *   frontal  ocupa y de 0 a b        (face externa em y = 0)
 *   traseira ocupa y de L-b a L      (face externa em y = L)
 *   esquerda ocupa x de 0 a b        (face externa em x = 0)
 *   direita  ocupa x de L-b a L      (face externa em x = L)
 *
 * Assim a viga fica coplanar com a superficie da perna e aparece como faixa
 * continua de uma perna a outra. Centrada — como estava antes — ela entra
 * para dentro da silhueta e some quando a perna e grossa.
 *
 * As vigas correm entre as FACES INTERNAS das pernas e nao penetram nelas.
 * Cada viga encosta em duas pernas, de modo que a ligacao le como
 * perna | travessa | perna, sem vao e sem sobreposicao de volume.
 *
 * O topo da viga coincide com o topo da perna (z = H), que e onde o assento
 * apoia: o quadro fica plano contra a face inferior do assento.
 */
export function geometriaTravessas(L, t, H){
  const { b, h } = secaoTravessa(t, H);

  const z = H - h;
  const vao = L - 2 * t;          // comprimento de cada viga
  const ok = b > 0 && h > 0 && vao > 0;

  return {
    b, h, z, vao, ok,
    pecas: ok ? [
      /* Frontal: face externa em y = 0. */
      { x: t,      y: 0,       dx: vao, dy: b, dz: h },
      /* Traseira: face externa em y = L. */
      { x: t,      y: L - b,   dx: vao, dy: b, dz: h },
      /* Lateral esquerda: face externa em x = 0. */
      { x: 0,      y: t,       dx: b,   dy: vao, dz: h },
      /* Lateral direita: face externa em x = L. */
      { x: L - b,  y: t,       dx: b,   dy: vao, dz: h }
    ] : []
  };
}

export function verificarTravessas({ P, massaAssento, L, t, H, material }){
  const geo = geometriaTravessas(L, t, H);

  const b = geo.b;
  const h = geo.h;

  const n = TRAVESSAS.nTravessas;
  const vao = Math.max(L - t, 1);

  const E = material.E;
  const sigmaAdm = material.sigmaLimite / material.CS;

  /* Volume do quadro, sem sobreposicao: cada viga e contada uma unica vez. */
  const volume = geo.pecas.reduce((s, p) => s + p.dx * p.dy * p.dz, 0);

  const massaTotal = (volume / 1e9) * material.rho;
  const massa = massaTotal / n;
  const pesoProprio = massa * G;

  const cargaAssento = P + massaAssento * G;
  const N = cargaAssento / n + pesoProprio;

  const q = N / vao;
  const M = (q * vao * vao) / 8;
  const V = (q * vao) / 2;

  const I = (b * Math.pow(h, 3)) / 12;
  const c = h / 2;
  const W = I / c;

  const tensao = M / W;
  const cisalhamento = (1.5 * V) / (b * h);
  const flecha = (5 * q * Math.pow(vao, 4)) / (384 * E * I);
  const flechaLimite = vao / TRAVESSAS.divisorFlecha;

  const utilizacaoTensao = tensao / sigmaAdm;
  const utilizacaoFlecha = flecha / flechaLimite;

  return {
    n, b, h, vao,
    comprimento: geo.vao,
    volume, massa,
    massaTotal,
    pesoProprio,
    cargaAssento, N, q,
    M, V, I, c, W,
    tensao, cisalhamento,
    sigmaAdm,
    flecha, flechaLimite,
    divisorFlecha: TRAVESSAS.divisorFlecha,
    utilizacaoTensao,
    utilizacaoFlecha,
    utilizacao: Math.max(utilizacaoTensao, utilizacaoFlecha)
  };
}