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

function calcular(inp){
  var erros = [];
  if(!(inp.espessuraMm>0)) erros.push('A espessura deve ser maior que zero.');
  if(!(inp.alturaMm>0)) erros.push('A altura deve ser maior que zero.');
  if(!(inp.massaKg>0)) erros.push('A massa deve ser maior que zero.');
  var material = MATERIAIS[inp.materialId];
  if(!material) erros.push('Material desconhecido.');
  if(erros.length) return { ok:false, erros:erros };

  var forma = inp.forma === 'redonda' ? 'redonda' : 'quadrada';
  var n = inp.numPernas === 1 ? 1 : 4;

  var t = inp.espessuraMm, H = inp.alturaMm, m = inp.massaKg;
  var L = HIPOTESES.L, e = HIPOTESES.e, K = HIPOTESES.K;

  var sec = propriedadesSecao(t, forma);
  var A = sec.A, I = sec.I, c = sec.c, W = sec.W;

  var P = m*G;
  var Nmedio, dN, Nmax, Mperna, levantou = false;

  if(n === 1){
    /* Pedestal central: a coluna recebe a carga total e o momento total.
       Nao existe pegada de 4 apoios para distribuir a excentricidade. */
    Nmedio = P;
    dN = 0;
    Nmax = P;
    Mperna = P*e;
  } else {
    /* Quatro apoios num quadrado de lado L: N = P/4 +/- P*e/(2L).
       Cada perna recebe M = P*e/4. */
    Nmedio = P/n;
    dN = (P*e)/(2*L);
    Nmax = Nmedio + dN;
    Mperna = (P*e)/n;
    levantou = dN > Nmedio;
  }
  var Nmin = Math.max(0, Nmedio - dN);

  var sigmaAxial = Nmax/A;
  var sigmaFlexao = Mperna/W;
  var sigmaMax = sigmaAxial + sigmaFlexao;
  var sigmaAdm = material.sigmaLimite/material.CS;
  var utilizacao = sigmaMax/sigmaAdm;

  var lambda = (K*H)/sec.r;
  var Pcr = (Math.PI*Math.PI*material.E*I)/Math.pow(K*H,2);
  var NcrAdm = Pcr/material.CS;
  var utFlamb = Nmax/NcrAdm;

  var delta = (Nmax*H)/(A*material.E);

  var volPernas = (n*A*H)/1e9;
  var massaPernas = volPernas*material.rho;
  var massaTotal = massaPernas + HIPOTESES.mAssento;

  var motivos = [];
  if(utilizacao>1) motivos.push('Tensao normal '+fmt(sigmaMax)+' MPa acima da admissivel '+fmt(sigmaAdm)+' MPa.');
  if(utFlamb>1) motivos.push('Flambagem: '+fmt(Nmax)+' N acima de '+fmt(NcrAdm)+' N.');
  if(levantou) motivos.push('A excentricidade levanta as pernas do lado oposto.');

  return {
    ok:true,
    entrada:{ material:material, t:t, H:H, m:m, forma:forma, numPernas:n },
    secao:{ A:A, I:I, W:W, c:c, r:sec.r, lambda:lambda },
    forcas:{ P:P, Nmedio:Nmedio, dN:dN, Nmax:Nmax, Nmin:Nmin, Mperna:Mperna },
    tensoes:{ sigmaAxial:sigmaAxial, sigmaFlexao:sigmaFlexao, sigmaMax:sigmaMax,
              sigmaAdm:sigmaAdm, utilizacao:utilizacao },
    flambagem:{ lambda:lambda, Pcr:Pcr, NcrAdm:NcrAdm, utilizacao:utFlamb },
    deformacao:{ delta:delta },
    massa:{ pernas:massaPernas, total:massaTotal },
    veredito:{ aprovado: motivos.length===0, motivos:motivos }
  };
}

function fmt(valor) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}