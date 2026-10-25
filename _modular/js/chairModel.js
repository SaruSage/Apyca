/**
 * Converte as entradas do usuario na lista de barras 3D da cadeira.
 * Nao sabe nada de tela: devolve apenas paralelepipedos em milimetros.
 *
 * Sistema de eixos: x para a direita, y para o fundo, z para cima.
 * O encosto fica em y = 0 (lado mais distante da camera isometrica).
 *
 * CAMADAS DE PINTURA — ordem de montagem, do fundo para a frente:
 *   0 = pernas abaixo do assento
 *   1 = reservado
 *   2 = assento
 *   3 = conjunto superior traseiro: postes E encosto
 *
 * Cada barra leva uma "cor" propria. Sem cor, o render usa a cor do material.
 */

import { CADEIRA } from './constantes.js';

function caixa(x,y,z,dx,dy,dz,camada,cor){
  return {tipo:'caixa', x:x,y:y,z:z,dx:dx,dy:dy,dz:dz,camada:camada,cor:cor};
}
function cilindro(cx,cy,r,z0,h,camada,cor){
  return {tipo:'cilindro', cx:cx,cy:cy,r:r,z0:z0,h:h,camada:camada,cor:cor};
}
function bboxPeca(p){
  if(p.tipo === 'cilindro'){
    return { min:[p.cx-p.r, p.cy-p.r, p.z0], max:[p.cx+p.r, p.cy+p.r, p.z0+p.h] };
  }
  return { min:[p.x,p.y,p.z], max:[p.x+p.dx,p.y+p.dy,p.z+p.dz] };
}

function encostoRipas(x0, larg, zBase, alt, prof, cor, n, fracao){
  var unidade = alt/(2*n-1);
  var pRipa = fracao*prof;
  var out = [];
  for(var i=0;i<n;i++){
    out.push(caixa(x0, 0, zBase+i*2*unidade, larg, pRipa, unidade, 3, cor));
  }
  return out;
}

function construirBarras(espessura, altura, material, forma, numPernas){
  var L = CADEIRA.L, folga = CADEIRA.folga;
  var render = (material && material.render) || MATERIAIS.madeira.render;
  var redonda = forma === 'redonda';
  var n = numPernas === 1 ? 1 : 4;

  var t = Math.min(espessura, CADEIRA.espessuraMaxima);
  var H = altura;

  var tAssento = CADEIRA.fracaoEspessuraAssento*t;
  var tEnc = CADEIRA.fracaoEspessuraEncosto*t;

  var zTopoAssento = H + tAssento;
  var zTopoEncosto = zTopoAssento + CADEIRA.alturaEncosto;
  var zBaseEncosto = zTopoAssento + CADEIRA.alturaAbertura;

  var b = [];

  function perna(x, y, z0, h, camada){
    if(redonda){
      b.push(cilindro(x + t/2, y + t/2, t/2, z0, h, camada, render.pernas));
    } else {
      b.push(caixa(x, y, z0, t, t, h, camada, render.pernas));
    }
  }

  /* Pernas abaixo do assento. O envelope externo continua sendo 0..L. */
  if(n === 4){
    perna(0,   L-t, 0, H, 0);
    perna(L-t, L-t, 0, H, 0);
    perna(0,   0,   0, H, 0);
    perna(L-t, 0,   0, H, 0);
  } else {
    perna(L/2-t/2, L/2-t/2, 0, H, 0);
  }

  /* Assento */
  b.push(caixa(-folga, -folga, H, L+2*folga, L+2*folga, tAssento, 2, render.assento));

  /* Postes acima do assento: terminam no MEIO da altura do encosto. */
  var altPainel = zTopoEncosto - zBaseEncosto;
  var zTopoPoste = zBaseEncosto + altPainel*CADEIRA.fracaoApoioEncosto;
  var hPoste = zTopoPoste - zTopoAssento;

  if(n === 4){
    perna(0,   0, zTopoAssento, hPoste, 3);
    perna(L-t, 0, zTopoAssento, hPoste, 3);
  } else {
    perna(L/2-t/2, L/2-t/2, zTopoAssento, hPoste, 3);
  }

  /* Encosto */
  var largPainel = L - 2*t;
  var spec = render.encosto || { tipo:'painel', cor:render.pernas };
  var corEnc = spec.cor || render.pernas;

  if(altPainel>0 && largPainel>0){
    if(spec.tipo === 'ripas'){
      var ripas = encostoRipas(t, largPainel, zBaseEncosto, altPainel,
                               tEnc, corEnc, spec.n||3, spec.fracao||0.2);
      for(var k=0;k<ripas.length;k++) b.push(ripas[k]);
    } else {
      b.push(caixa(t, 0, zBaseEncosto, largPainel, tEnc, altPainel, 3, corEnc));
    }
  }

  return b;
}

function dimensoesExternas(barras){
  var min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  for(var i=0;i<barras.length;i++){
    var bb = bboxPeca(barras[i]);
    for(var a=0;a<3;a++){
      if(bb.min[a]<min[a]) min[a]=bb.min[a];
      if(bb.max[a]>max[a]) max[a]=bb.max[a];
    }
  }
  return { largura:max[0]-min[0], profundidade:max[1]-min[1], altura:max[2]-min[2] };
}

const RENDER_PADRAO = {
  pernas: '#a9713f',
  assento: '#a9713f',
  encosto: { tipo: 'painel', cor: '#a9713f', n: 3, fracao: 0.2 },
  veios: false,
};

/** Encosto em painel unico. */
function encostoPainel(x0, largura, zBase, alt, tEnc, cor) {
  return [barra(x0, 0, zBase, largura, tEnc, alt, 3, cor)];
}

/**
 * Encosto em ripas horizontais.
 * n ripas de altura unitaria separadas por vaos da mesma altura, com
 * unitaria = alt / (2n - 1). Assim n ripas + (n - 1) vaos fecham a altura.
 * A profundidade de cada ripa e fracao * tEnc.
 */
function encostoRipas(x0, largura, zBase, alt, tEnc, cor, n, fracao) {
  const unidade = alt / (2 * n - 1);
  const tRipa = fracao * tEnc;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(
      barra(x0, 0, zBase + i * 2 * unidade, largura, tRipa, unidade, 3, cor)
    );
  }
  return out;
}

export function construirBarras(espessura, altura, material) {
  const {
    L,
    folga,
    fracaoEspessuraAssento,
    fracaoEspessuraEncosto,
    alturaAbertura,
    alturaEncosto,
    espessuraMaxima,
  } = CADEIRA;

  const render = material?.render ?? RENDER_PADRAO;

  const t = Math.min(espessura, espessuraMaxima);
  const H = altura;

  const tAssento = fracaoEspessuraAssento * t;
  const tEnc = fracaoEspessuraEncosto * t;

  const zTopoAssento = H + tAssento;
  const zTopoEncosto = zTopoAssento + alturaEncosto;
  const zBaseEncosto = zTopoAssento + alturaAbertura;

  const barras = [];

  // --- Camada 0: pernas abaixo do assento ---
  barras.push(barra(0, L - t, 0, t, t, H, 0, render.pernas));
  barras.push(barra(L - t, L - t, 0, t, t, H, 0, render.pernas));
  barras.push(barra(0, 0, 0, t, t, H, 0, render.pernas));
  barras.push(barra(L - t, 0, 0, t, t, H, 0, render.pernas));

  // --- Camada 2: assento ---
  barras.push(
    barra(-folga, -folga, H, L + 2 * folga, L + 2 * folga, tAssento, 2, render.assento)
  );

  // --- Camada 3: conjunto superior traseiro ---
  const hPoste = zTopoEncosto - zTopoAssento;
  barras.push(barra(0, 0, zTopoAssento, t, t, hPoste, 3, render.pernas));
  barras.push(barra(L - t, 0, zTopoAssento, t, t, hPoste, 3, render.pernas));

  // Encosto: painel unico ou ripas horizontais, conforme o material.
  const largPainel = L - 2 * t;
  const altPainel = zTopoEncosto - zBaseEncosto;
  const spec = render.encosto ?? RENDER_PADRAO.encosto;

  if (altPainel > 0 && largPainel > 0) {
    const corEnc = spec.cor ?? render.pernas;

    if (spec.tipo === 'ripas') {
      barras.push(
        ...encostoRipas(
          t, largPainel, zBaseEncosto, altPainel, tEnc,
          corEnc, spec.n ?? 3, spec.fracao ?? 0.2
        )
      );
    } else {
      barras.push(...encostoPainel(t, largPainel, zBaseEncosto, altPainel, tEnc, corEnc));
    }
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