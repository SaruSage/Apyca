/**
 * Nucleo de calculo. Funcao pura: nao toca no DOM.
 *
 * Modelo
 * ------
 * 1. Carga vertical P = m * g no assento.
 * 2. 4 pernas num quadrado de lado L. A excentricidade e gera M = P * e,
 *    distribuido pelo footprint: Nmax = P/4 + P*e/(2L).
 * 3. Cada perna recebe M = P*e/4, resistido por flexao.
 * 4. sigma = N/A + M*c/I.
 * 5. Flambagem pela carga critica de Euler.
 * 6. Deformacao axial: delta = N*H/(A*E).
 *
 * A secao pode ser quadrada ou redonda. Tudo que depende da forma da secao
 * (A, I, W, r) vem de propriedadesSecao: nenhuma formula e repetida aqui.
 */

import { G, HIPOTESES } from './constantes.js';
import { getMaterial, tensaoAdmissivel } from './materials.js';
import { propriedadesSecao } from './geometry.js';

export function calcular({ materialId, espessuraMm, alturaMm, massaKg, forma }) {
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

  const t = espessuraMm;
  const H = alturaMm;
  const m = massaKg;
  const { nPernas: n, L, e, K } = HIPOTESES;

  const sec = propriedadesSecao(t, formaFinal);
  const { A, I, W, c } = sec;

  const P = m * G;
  const Nmedio = P / n;
  const dN = (P * e) / (2 * L);
  const Nmax = Nmedio + dN;
  const Nmin = Math.max(0, Nmedio - dN);
  const levantou = dN > Nmedio;
  const Mperna = (P * e) / n;

  const sigmaAxial = Nmax / A;
  const sigmaFlexao = Mperna / W;
  const sigmaMax = sigmaAxial + sigmaFlexao;
  const sigmaAdm = tensaoAdmissivel(material);
  const utilizacao = sigmaMax / sigmaAdm;

  const lambda = (K * H) / sec.r;
  const Pcr = (Math.PI ** 2 * material.E * I) / Math.pow(K * H, 2);
  const NcrAdm = Pcr / material.CS;
  const utilizacaoFlambagem = Nmax / NcrAdm;

  const deltaAxial = (Nmax * H) / (A * material.E);

  const volPernasM3 = (n * A * H) / 1e9;
  const massaPernas = volPernasM3 * material.rho;
  const massaTotal = massaPernas + HIPOTESES.mAssento;

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

  return {
    ok: true,
    entrada: { material, t, H, m, forma: formaFinal },
    secao: { A, I, W, c, r: sec.r, lambda },
    forcas: { P, Nmedio, dN, Nmax, Nmin, Mperna, levantou },
    tensoes: { sigmaAxial, sigmaFlexao, sigmaMax, sigmaAdm, utilizacao },
    flambagem: { lambda, Pcr, NcrAdm, utilizacaoFlambagem },
    deformacao: { deltaAxial },
    massa: { pernas: massaPernas, total: massaTotal },
    veredito: { aprovado: motivos.length === 0, motivos }
  };
}

function fmt(v){
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}