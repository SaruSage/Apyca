/**
 * Nucleo de calculo. Funcao pura: nao toca no DOM.
 *
 * A secao pode ser macica ou vazada, quadrada ou redonda.
 * Quando vazada, a espessura da parede vem em mm e e validada aqui.
 *
 * REGIMES
 *   4 pernas: Nmax = P/4 + P*e/(2L), M = P*e/4, K = 1,0
 *   1 perna : N = P, M = P*e, K = 2,0 (balanco)
 *
 * VERIFICACOES
 *   tensao na perna      sigma = N/A + M*c/I
 *   flambagem global     Euler com K do regime
 *   flambagem local      (t-2ep)/ep contra 1,40*raiz(E/sigmaLim) — so vazada
 *   assento em balanco   Ma = P*a, delta = P*a^3/(3EI)
 *   assento entre apoios q = P/b^2, M = q*L^2/16, delta = 5q*L^4/(64Eh^3)
 *                        — so com 4 pernas
 *   tombamento           M_tomb/M_estab (so no pedestal)
 *
 * ASSENTO ENTRE APOIOS
 *   Metodo das faixas: a carga se divide em duas direcoes ortogonais e cada
 *   faixa de largura unitaria vence o vao L com carga uniforme q/2.
 *   O coeficiente 1/16 = 0,0625 e conservador frente a 0,0479 da solucao
 *   de placa simplesmente apoiada.
 */

import { G, HIPOTESES, CADEIRA } from './constantes.js';
import { getMaterial, tensaoAdmissivel } from './materials.js';
import { propriedadesSecao } from './geometry.js';

/** Volume do pe do pedestal, em m³. Sempre macico. */
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

/** Menor braco resistente da base, em mm. */
function bracoEstabilidade(R, forma){
  if (forma === 'redonda') return R;
  return R * CADEIRA.fracaoLadoPiramide;
}

export function calcular({ materialId, espessuraMm, alturaMm, massaKg,
                           forma, numPernas, vazada, paredeMm }){
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

  const vazadaFinal = vazada === true;

  if (vazadaFinal) {
    if (!Number.isFinite(paredeMm) || paredeMm <= 0) {
      erros.push('A parede do perfil tubular deve ser maior que zero.');
    } else if (Number.isFinite(espessuraMm) && paredeMm >= espessuraMm / 2) {
      erros.push('A parede deve ser menor que metade da dimensao externa ' +
                 '(t/2 = ' + (espessuraMm / 2).toLocaleString('pt-BR') +
                 ' mm). Acima disso o furo desaparece.');
    }
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

  const K = n === 1 ? HIPOTESES.KPedestal : HIPOTESES.K;

  const sec = propriedadesSecao(t, formaFinal, vazadaFinal, paredeMm);
  const { A, I, W, c } = sec;

  const P = m * G;

  let Nmedio, dN, Nmax, Nmin, Mperna;
  let levantou = false;

  if (n === 1) {
    Nmedio = P; dN = 0; Nmax = P; Nmin = P; Mperna = P * e;
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

  // ---------- Flambagem global ----------
  const lambda = (K * H) / sec.r;
  const Pcr = (Math.PI ** 2 * material.E * I) / Math.pow(K * H, 2);
  const NcrAdm = Pcr / material.CS;
  const utilizacaoFlambagem = Nmax / NcrAdm;

  // ---------- Flambagem local da parede ----------
  let flambagemLocal = null;
  if (vazadaFinal) {
    const lambdaLocal = sec.interna / sec.parede;
    const lambdaLimite = 1.40 * Math.sqrt(material.E / material.sigmaLimite);
    flambagemLocal = {
      lambdaLocal,
      lambdaLimite,
      utilizacao: lambdaLocal / lambdaLimite,
      esbelta: lambdaLocal > lambdaLimite
    };
  }

  const deltaAxial = (Nmax * H) / (A * material.E);

  // ---------- Assento: geometria comum ----------
  const bAssento = CADEIRA.L + 2 * CADEIRA.folga;
  const hAssento = CADEIRA.fracaoEspessuraAssento * t;

  const aBalanco = n === 1
    ? (CADEIRA.L / 2 + CADEIRA.folga) - t / 2
    : CADEIRA.folga;

  // ---------- Assento em balanco ----------
  const Ma = P * aBalanco;
  const Wa = (bAssento * hAssento * hAssento) / 6;
  const Ia = (bAssento * Math.pow(hAssento, 3)) / 12;

  const sigmaAssento = Ma / Wa;
  const flechaAssento = (P * Math.pow(aBalanco, 3)) / (3 * material.E * Ia);

  const flechaLimite = aBalanco / CADEIRA.divisorFlechaAssento;

  const assento = {
    a: aBalanco, b: bAssento, h: hAssento,
    M: Ma, W: Wa, I: Ia,
    sigma: sigmaAssento,
    flecha: flechaAssento,
    flechaLimite,
    utilizacao: sigmaAssento / sigmaAdm,
    utilizacaoFlecha: flechaAssento / flechaLimite
  };

  // ---------- Assento entre apoios (so com 4 pernas) ----------
  /*
   * Metodo das faixas: a carga P se distribui sobre a area do assento gerando
   * a pressao q. Cada uma das duas direcoes ortogonais leva metade, e a faixa
   * de largura unitaria vence o vao L. Daí M = q*L^2/16 por unidade de largura.
   *
   * Com 1 perna nao existe vao entre apoios: o balanco ja cobre o caso.
   */
  let assentoVao = null;
  if (n === 4) {
    const q = P / (bAssento * bAssento);
    const Mvao = (q * L * L) / 16;
    const Ivao = Math.pow(hAssento, 3) / 12;
    const sigmaVao = (6 * Mvao) / (hAssento * hAssento);
    const flechaVao = (5 * q * Math.pow(L, 4)) /
                      (64 * material.E * Math.pow(hAssento, 3));
    const flechaLimiteVao = L / CADEIRA.divisorFlechaVao;

    assentoVao = {
      L, h: hAssento, q,
      M: Mvao, I: Ivao,
      sigma: sigmaVao,
      flecha: flechaVao,
      flechaLimite: flechaLimiteVao,
      utilizacao: sigmaVao / sigmaAdm,
      utilizacaoFlecha: flechaVao / flechaLimiteVao
    };
  }

  // ---------- Tombamento ----------
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

  // ---------- Veredito ----------
  const motivos = [];
  if (utilizacao > 1) {
    motivos.push('Tensao de ' + fmt(sigmaMax) + ' MPa na perna acima da admissivel de ' +
                 fmt(sigmaAdm) + ' MPa.');
  }
  if (utilizacaoFlambagem > 1) {
    motivos.push('Flambagem global: ' + fmt(Nmax) + ' N acima de ' + fmt(NcrAdm) + ' N.');
  }
  if (flambagemLocal && flambagemLocal.esbelta) {
    motivos.push('Parede esbelta: relacao ' + fmt(flambagemLocal.lambdaLocal) +
                 ' acima do limite de ' + fmt(flambagemLocal.lambdaLimite) +
                 '. Aumente a parede ou reduza a dimensao externa.');
  }
  if (assento.utilizacao > 1) {
    motivos.push('Tensao de ' + fmt(sigmaAssento) + ' MPa no assento em balanco, ' +
                 'acima da admissivel de ' + fmt(sigmaAdm) + ' MPa.');
  }
  if (assento.utilizacaoFlecha > 1) {
    motivos.push('Flecha de ' + fmt(flechaAssento) + ' mm no assento em balanco, ' +
                 'acima do limite de ' + fmt(flechaLimite) + ' mm.');
  }
  if (assentoVao) {
    if (assentoVao.utilizacao > 1) {
      motivos.push('Tensao de ' + fmt(assentoVao.sigma) + ' MPa no assento entre ' +
                   'os apoios, acima da admissivel de ' + fmt(sigmaAdm) + ' MPa.');
    }
    if (assentoVao.utilizacaoFlecha > 1) {
      motivos.push('Flecha de ' + fmt(assentoVao.flecha) + ' mm no assento entre ' +
                   'os apoios, acima do limite de ' + fmt(assentoVao.flechaLimite) +
                   ' mm.');
    }
  }
  if (levantou) {
    motivos.push('A excentricidade levanta as pernas do lado oposto.');
  }
  if (estabilidade && estabilidade.tombou) {
    motivos.push('A resultante cai fora da base do pedestal: risco de tombamento.');
  }

  return {
    ok: true,
    entrada: {
      material, t, H, m,
      forma: formaFinal,
      numPernas: n,
      vazada: vazadaFinal,
      parede: vazadaFinal ? sec.parede : 0
    },
    secao: {
      A, I, W, c,
      r: sec.r,
      parede: sec.parede,
      interna: sec.interna,
      lambda
    },
    forcas: { P, Nmedio, dN, Nmax, Nmin, Mperna, levantou },
    assento,
    assentoVao,
    estabilidade,
    tensoes: { sigmaAxial, sigmaFlexao, sigmaMax, sigmaAdm, utilizacao },
    flambagem: { K, lambda, Pcr, NcrAdm, utilizacaoFlambagem },
    flambagemLocal,
    deformacao: { deltaAxial },
    massa: { pernas: massaPernas, total: massaTotal },
    veredito: { aprovado: motivos.length === 0, motivos }
  };
}

function fmt(v){
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}