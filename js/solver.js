/**
 * Nucleo de calculo. Funcao pura: nao toca no DOM.
 *
 * A secao pode ser macica ou vazada, quadrada ou redonda.
 * Quando vazada, a espessura da parede vem em mm e e validada aqui.
 *
 * O encosto pode existir ou nao. Sem encosto a cadeira vira banco:
 * saem os postes e o painel, cai a altura total e cai o peso proprio.
 *
 * MASSA
 * A massa nao e mais um valor fixo. construirBarras gera a geometria de
 * cada peca e massasPorParte soma volume x densidade. Isso faz o peso
 * proprio acompanhar material, espessura, secao e existencia do encosto.
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
 *   travessas de apoio   viga biapoiada, M = q*Lt^2/8,
 *                        delta = 5q*Lt^4/(384EI) — so com 4 pernas
 *   tombamento           M_tomb/M_estab (so no pedestal)
 */

import { G, HIPOTESES, CADEIRA, TRAVESSAS } from './constantes.js';
import { getMaterial, tensaoAdmissivel } from './materials.js';
import { propriedadesSecao } from './geometry.js';
import { construirBarras, massasPorParte } from './chairModel.js';
import { verificarTravessas } from './travessas.js';

/** Menor braco resistente da base, em mm. */
function bracoEstabilidade(R, forma){
  if (forma === 'redonda') return R;
  return R * CADEIRA.fracaoLadoPiramide;
}

export function calcular({ materialId, espessuraMm, alturaMm, massaKg,
                           forma, numPernas, vazada, paredeMm, comEncosto }){
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
  const comEncostoFinal = comEncosto !== false;

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

  // ---------- Massa real, da geometria x densidade ----------
  const barras = construirBarras(t, H, material, formaFinal, n,
                                 vazadaFinal, paredeMm, comEncostoFinal);

  const massas = massasPorParte(barras, material);

  const massaTotal = massas.total;
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

  // ---------- Travessas de apoio do assento (so com 4 pernas) ----------
  /*
   * A carga do assento entra nas travessas e so entao chega as pernas. A
   * massa do assento conta aqui: sao elas que o sustentam.
   */
  let travessas = null;
  if (n === 4 && TRAVESSAS.ativa) {
    travessas = verificarTravessas({
      P,
      massaAssento: massas.assento,
      L,
      t,
      H,
      material
    });
  }

  // ---------- Tombamento ----------
  let estabilidade = null;
  if (n === 1) {
    const R_est = bracoEstabilidade(CADEIRA.coneRaioBase, formaFinal);
    const utTombamento = (P * e) / ((P + pesoCadeira) * R_est);
    estabilidade = {
      braco: R_est,
      raioCone: CADEIRA.coneRaioBase,
      e,
      pesoCadeira,
      massaCadeira: massaTotal,
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
    motivos.push('Assento em balanco: tensao de ' + fmt(sigmaAssento) +
                 ' MPa acima da admissivel de ' + fmt(sigmaAdm) + ' MPa.');
  }
  if (assento.utilizacaoFlecha > 1) {
    motivos.push('Assento em balanco: flecha de ' + fmt(flechaAssento) +
                 ' mm acima do limite de ' + fmt(flechaLimite) + ' mm.');
  }
  if (assentoVao && assentoVao.utilizacao > 1) {
    motivos.push('Assento entre apoios: tensao de ' + fmt(assentoVao.sigma) +
                 ' MPa acima da admissivel de ' + fmt(sigmaAdm) + ' MPa.');
  }
  if (assentoVao && assentoVao.utilizacaoFlecha > 1) {
    motivos.push('Assento entre apoios: flecha de ' + fmt(assentoVao.flecha) +
                 ' mm acima do limite de ' + fmt(assentoVao.flechaLimite) + ' mm.');
  }
  if (travessas && travessas.utilizacaoTensao > 1) {
    motivos.push('Travessa de apoio: tensao de ' + fmt(travessas.tensao) +
                 ' MPa acima da admissivel de ' + fmt(travessas.sigmaAdm) + ' MPa.');
  }
  if (travessas && travessas.utilizacaoFlecha > 1) {
    motivos.push('Travessa de apoio: flecha de ' + fmt(travessas.flecha) +
                 ' mm acima do limite de ' + fmt(travessas.flechaLimite) +
                 ' mm (L/' + travessas.divisorFlecha + ').');
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
      parede: vazadaFinal ? sec.parede : 0,
      comEncosto: comEncostoFinal
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
    travessas,
    estabilidade,
    tensoes: { sigmaAxial, sigmaFlexao, sigmaMax, sigmaAdm, utilizacao },
    flambagem: { K, lambda, Pcr, NcrAdm, utilizacaoFlambagem },
    flambagemLocal,
    deformacao: { deltaAxial },
    massa: {
      pernas: massas.pernas,
      pe: massas.pe,
      assento: massas.assento,
      postes: massas.postes,
      encosto: massas.encosto,
      travessas: massas.travessas,
      total: massas.total,
      volumeTotal: massas.volumeTotal
    },
    veredito: { aprovado: motivos.length === 0, motivos }
  };
}

function fmt(v){
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}