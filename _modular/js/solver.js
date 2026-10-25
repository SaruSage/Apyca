/**
 * Nucleo de calculo. Funcao pura: recebe entradas, devolve resultados. Nao toca no DOM.
 *
 * Modelo adotado
 * --------------
 * 1. Carga vertical P = m * g aplicada no assento.
 * 2. As 4 pernas formam um footprint quadrado de lado L. A excentricidade de projeto e
 *    do ponto de carga gera um momento global M = P * e, distribuito pelo footprint:
 *        Nmax = P/4 + P*e/(2L)     Nmin = P/4 - P*e/(2L)
 * 3. Cada perna recebe ainda a parcela M/nPernas do momento global, resistida por flexao.
 * 4. Tensao normal na fibra mais solicitada da perna:
 *        sigma = N/A + M*c/I
 * 5. Flambagem verificada pela carga critica de Euler com coeficiente de seguranca.
 * 6. Deformacao axial elastica: delta = N*H/(A*E).
 */

import { G, HIPOTESES } from './constantes.js';
import { getMaterial, tensaoAdmissivel } from './materials.js';
import {
  area,
  inercia,
  distanciaFibra,
  moduloResistente,
  esbeltez,
  cargaCriticaEuler,
} from './geometry.js';

export function calcular({ materialId, espessuraMm, alturaMm, massaKg }) {
  const erros = [];
  if (!Number.isFinite(espessuraMm) || espessuraMm <= 0) erros.push('A espessura da perna deve ser maior que zero.');
  if (!Number.isFinite(alturaMm) || alturaMm <= 0) erros.push('A altura da perna deve ser maior que zero.');
  if (!Number.isFinite(massaKg) || massaKg <= 0) erros.push('A massa do usuario deve ser maior que zero.');

  let material;
  try {
    material = getMaterial(materialId);
  } catch {
    erros.push('Material desconhecido.');
  }

  if (erros.length > 0) {
    return { ok: false, erros };
  }

  const t = espessuraMm;
  const H = alturaMm;
  const m = massaKg;
  const { nPernas: n, L, e, K } = HIPOTESES;

  // === Secao ===
  const A = area(t);
  const I = inercia(t);
  const c = distanciaFibra(t);
  const W = moduloResistente(t);

  // === Forcas ===
  const P = m * G;                  // N
  const Nmedio = P / n;             // N
  const dN = (P * e) / (2 * L);     // N
  const Nmax = Nmedio + dN;         // N
  const Nmin = Math.max(0, Nmedio - dN); // perna nao resiste tracao: levanta
  const levantou = Nmin === 0 && dN > Nmedio;
  const Mperna = (P * e) / n;       // N.mm

  // === Tensoes ===
  const sigmaAxial = Nmax / A;      // MPa
  const sigmaFlexao = Mperna / W;   // MPa
  const sigmaMax = sigmaAxial + sigmaFlexao;
  const sigmaAdm = tensaoAdmissivel(material);
  const utilizacao = sigmaMax / sigmaAdm;

  // === Flambagem ===
  const lambda = esbeltez(H, t, K);
  const Pcr = cargaCriticaEuler(material.E, t, H, K);
  const NcrAdm = Pcr / material.CS;
  const utilizacaoFlambagem = Nmax / NcrAdm;

  // === Deformacao ===
  const deltaAxial = (Nmax * H) / (A * material.E); // mm

  // === Massa ===
  const volumePernasM3 = (n * A * H) / 1e9;
  const massaPernas = volumePernasM3 * material.rho;
  const massaTotal = massaPernas + HIPOTESES.mAssento;

  // === Veredito ===
  const motivos = [];
  if (utilizacao > 1) {
    motivos.push(`Tensao normal ${fmt(sigmaMax)} MPa acima da admissivel ${fmt(sigmaAdm)} MPa.`);
  }
  if (utilizacaoFlambagem > 1) {
    motivos.push(`Flambagem: carga ${fmt(Nmax)} N acima da admissivel ${fmt(NcrAdm)} N.`);
  }
  if (levantou) {
    motivos.push('A excentricidade e alta o bastante para levantar as pernas do lado oposto.');
  }

  return {
    ok: true,
    entrada: { material, t, H, m },
    secao: { A, I, W, c, lambda },
    forcas: { P, Nmedio, dN, Nmax, Nmin, Mperna, levantou },
    tensoes: { sigmaAxial, sigmaFlexao, sigmaMax, sigmaAdm, utilizacao },
    flambagem: { lambda, Pcr, NcrAdm, utilizacaoFlambagem },
    deformacao: { deltaAxial },
    massa: { pernas: massaPernas, total: massaTotal },
    veredito: { aprovado: motivos.length === 0, motivos },
  };
}

function fmt(valor) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}