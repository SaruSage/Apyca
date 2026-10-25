/**
 * Nucleo de calculo. Funcao pura: nao toca no DOM.
 *
 * REGIMES ESTRUTURAIS
 *
 * 4 PERNAS — quadrado de lado L.
 *   Nmax = P/4 + P*e/(2L)      cada perna recebe M = P*e/4
 *   Flambagem: perna entre apoios, K = 1,0.
 *   Risco: a excentricidade levanta as pernas do lado oposto.
 *
 * 1 PERNA — pedestal central.
 *   N = P                      M = P*e
 *   Flambagem: coluna engastada na base e livre no topo, K = 2,0.
 *   Risco: tombamento.
 *
 * PE DO PEDESTAL
 *   Redondo : tronco de cone de raio coneRaioBase.
 *   Quadrado: tronco de piramide de lado fracaoLadoPiramide * diametro.
 *   Volumes:
 *     V_cone     = (pi*h/3)(R^2 + R*rt + rt^2)
 *     V_piramide = (h/3)(A1 + A2 + raiz(A1*A2))
 *
 * TOMBAMENTO
 *   M_tomb  = P * e
 *   M_estab = (P + W) * R_est
 *
 *   R_est e o menor braco resistente da base:
 *     Cone     -> R (o raio, igual em toda direcao)
 *     Piramide -> ladoBase/2 (direcao perpendicular as faces)
 *                 nas diagonais o braco e maior, logo este e o pior caso
 *
 *   Usar o raio do CONE para a piramide seria nao conservador: seria
 *   superestimar a estabilidade em 1/fracaoLadoPiramide.
 *
 * Em ambos os casos:
 *   sigma = N/A + M*c/I
 *   delta = N*H/(A*E)
 */

import { G, HIPOTESES, CADEIRA } from './constantes.js';
import { getMaterial, tensaoAdmissivel } from './materials.js';
import { propriedadesSecao } from './geometry.js';

/** Volume do pe, em m³. Redondo: cone. Quadrado: piramide. */
function volumePe(h, R, t, forma){
  if (forma === 'redonda') {
    const rb = R, rt = t / 2;
    return ((Math.PI * h) / 3) * (rb * rb + rb * rt + rt * rt) / 1e9;
  }
  const lado = 2 * R * CADEIRA.fracaoLadoPiramide;
  const A1 = lado * lado;
  const A2 = t * t;
  return (h / 3) * (A1 + A2 + Math.sqrt(A1 * A2)) / 1e9;
}

/**
 * Menor braco resistente da base, em mm.
 * E este valor que entra no momento estabilizador do tombamento.
 */
function bracoEstabilidade(R, forma){
  if (forma === 'redonda') return R;
  return R * CADEIRA.fracaoLadoPiramide;
}

export function calcular({ materialId, espessuraMm, alturaMm, massaKg, forma, numPernas }) {
  const erros = [];
  if (!Number.isFinite(espessuraMm) || espessuraMm <= 0) {
    erros.push('A espessura da perna deve ser maior que zero.');
  }
  if (!Number.isFinite(alturaMm) || alturaMm <= 0) {
    erros.push('A altura da perna deve ser maior que zero.');
  }
  if (!Number.isFinite(massaKg) || massaKg <= 0) {
    erros.push('A massa do usuario deve ser maior que zero.');
  }

  let material;
  try {
    material = getMaterial(materialId);
  } catch (e) {
    erros.push('Material desconhecido.');
  }

  if (erros.length > 0) return { ok: false, erros };

  const formaFinal = forma === 'redonda' ? 'redonda' : 'quadrada';
  const n = numPernas === 1 ? 1 : 4;

  const t = espessuraMm;
  const H = alturaMm;
  const m = massaKg;
  const { L, e } = HIPOTESES;

  // Fator de flambagem conforme o regime de apoio.
  const K = n === 1 ? HIPOTESES.KPedestal : HIPOTESES.K;

  const sec = propriedadesSecao(t, formaFinal);
  const { A, I, W, c } = sec;

  const P = m * G;

  let Nmedio, dN, Nmax, Nmin, Mperna;
  let levantou = false;

  if (n === 1) {
    Nmedio = P;
    dN = 0;
    Nmax = P;
    Nmin = P;
    Mperna = P * e;
  } else {
    Nmedio = P / n;
    dN = (P * e) / (2 * L);
    Nmax = Nmedio + dN;
    Nmin = Math.max(0, Nmedio - dN);
    Mperna = (P * e) / n;
    levantou = dN > Nmedio;
  }

  // ---------- Massa: coluna prismatica + pe ----------
  const hPe = n === 1 ? Math.min(CADEIRA.coneAltura, H * 0.4) : 0;
  const hColuna = H - hPe;
  const R = CADEIRA.coneRaioBase;

  const volColuna = (n * A * hColuna) / 1e9;
  const volPe = n === 1 ? volumePe(hPe, R, t, formaFinal) : 0;

  const massaPernas = (volColuna + volPe) * material.rho;
  const massaTotal = massaPernas + HIPOTESES.mAssento;
  const pesoCadeira = massaTotal * G;

  // ---------- Tensoes ----------
  const sigmaAxial = Nmax / A;
  const sigmaFlexao = Mperna / W;
  const sigmaMax = sigmaAxial + sigmaFlexao;
  const sigmaAdm = tensaoAdmissivel(material);
  const utilizacao = sigmaMax / sigmaAdm;

  // ---------- Flambagem ----------
  const lambda = (K * H) / sec.r;
  const Pcr = (Math.PI ** 2 * material.E * I) / Math.pow(K * H, 2);
  const NcrAdm = Pcr / material.CS;
  const utilizacaoFlambagem = Nmax / NcrAdm;

  const deltaAxial = (Nmax * H) / (A * material.E);

  // ---------- Estabilidade ao tombamento (so no pedestal) ----------
  let estabilidade = null;
  if (n === 1) {
    const R_est = bracoEstabilidade(R, formaFinal);
    const utTombamento = (P * e) / ((P + pesoCadeira) * R_est);
    estabilidade = {
      braco: R_est,
      raioCone: R,
      e,
      pesoCadeira,
      volumePe: volPe,
      utilizacao: utTombamento,
      tombou: utTombamento > 1
    };
  }

  const motivos = [];
  if (utilizacao > 1) {
    motivos.push('Tensao ' + fmt(sigmaMax) + ' MPa acima da admissivel ' +
                 fmt(sigmaAdm) + ' MPa.');
  }
  if (utilizacaoFlambagem > 1) {
    motivos.push('Flambagem: ' + fmt(Nmax) + ' N acima de ' + fmt(NcrAdm) + ' N.');
  }
  if (levantou) {
    motivos.push('A excentricidade levanta as pernas do lado oposto.');
  }
  if (estabilidade && estabilidade.tombou) {
    motivos.push('A resultante cai fora da base do pedestal: tombamento.');
  }

  return {
    ok: true,
    entrada: { material, t, H, m, forma: formaFinal, numPernas: n },
    secao: { A, I, W, c, r: sec.r, lambda },
    forcas: { P, Nmedio, dN, Nmax, Nmin, Mperna, levantou },
    estabilidade,
    tensoes: { sigmaAxial, sigmaFlexao, sigmaMax, sigmaAdm, utilizacao },
    flambagem: { K, lambda, Pcr, NcrAdm, utilizacaoFlambagem },
    deformacao: { deltaAxial },
    massa: { pernas: massaPernas, total: massaTotal },
    veredito: { aprovado: motivos.length === 0, motivos }
  };
}

function fmt(v){
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}