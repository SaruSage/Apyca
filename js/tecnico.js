/**
 * Desenho tecnico: vistas ortograficas cotadas, em linhas pretas.
 *
 * As quatro vistas (frontal, lateral, superior e inferior) saem numa unica
 * prancha, com escala unica, alinhadas por coluna e por linha: frontal e
 * superior dividem a largura, frontal e lateral dividem a altura.
 *
 * ARESTAS OCULTAS
 * Cada peca e desenhada como poligono de preenchimento branco e contorno
 * preto, na ordem da mais distante para a mais proxima do observador. O
 * branco de uma peca da frente cobre as arestas das pecas de tras. E o
 * mesmo principio de pintor usado na vista isometrica, aplicado aqui a
 * projecao ortogonal.
 *
 * COTAS
 * Em centimetros, com linha de cota fina, linha de chamada e seta cheia.
 * Abaixo da vista frontal as cotas sao empilhadas por nivel, do detalhe
 * para o conjunto: espessura da perna por dentro, largura total por fora.
 * No pedestal cotam-se a base e a altura do pe, alem da espessura da coluna.
 *
 * LIMITACAO DO PEDESTAL
 * A coluna nasce no topo do pe, nao no piso. Por isso a cota da espessura
 * da coluna tem origem no topo do pe, e suas linhas de chamada descem
 * cruzando o trapezio do pe. E a solucao usual quando a peca esta dentro
 * de outra: a linha de chamada parte do contorno real da peca cotada.
 */

import { bboxPeca } from './chairModel.js';

const VBW = 900;              // largura do viewBox, em px
const MARGEM = 44;            // margem externa, em px
const FONTE = 13;             // corpo das cotas e rotulos, em px
const SETA = 7;
const SETA_W = 2.4;
const TRACO_FINO = 0.55;
const TRACO_GROSSO = 1.2;
const VBH_MAX = 1260;

const NIVEL_A = 13;           // cota de detalhe (espessura)
const NIVEL_B = 31;           // cota intermediaria (base do pe)
const NIVEL_C = 49;           // cota de conjunto (largura total)

function coord(v){
  return v.toFixed(1);
}

function cm(mm){
  return (mm / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function centroBbox(p, idx){
  const bb = bboxPeca(p);
  return (bb.min[idx] + bb.max[idx]) / 2;
}

/* Converte milimetros do modelo em px dentro de uma vista. */
function pxDe(v, u, s){
  return v.x + (u - v.uMin) * s;
}

function pyDe(v, valor, s){
  return v.vParaBaixo
    ? v.y + (valor - v.vMin) * s
    : v.y + (v.vMax - valor) * s;
}

/* ---------- Primitivas de desenho ---------- */

function linha(x1, y1, x2, y2, w){
  return '<line x1="' + coord(x1) + '" y1="' + coord(y1) +
    '" x2="' + coord(x2) + '" y2="' + coord(y2) +
    '" stroke="#000" stroke-width="' + (w || TRACO_FINO) + '"/>';
}

function setaH(x, y, dir){
  const p = dir > 0
    ? coord(x) + ',' + coord(y) + ' ' +
      coord(x - SETA) + ',' + coord(y - SETA_W) + ' ' +
      coord(x - SETA) + ',' + coord(y + SETA_W)
    : coord(x) + ',' + coord(y) + ' ' +
      coord(x + SETA) + ',' + coord(y - SETA_W) + ' ' +
      coord(x + SETA) + ',' + coord(y + SETA_W);
  return '<polygon points="' + p + '" fill="#000"/>';
}

function setaV(x, y, dir){
  const p = dir > 0
    ? coord(x) + ',' + coord(y) + ' ' +
      coord(x - SETA_W) + ',' + coord(y - SETA) + ' ' +
      coord(x + SETA_W) + ',' + coord(y - SETA)
    : coord(x) + ',' + coord(y) + ' ' +
      coord(x - SETA_W) + ',' + coord(y + SETA) + ' ' +
      coord(x + SETA_W) + ',' + coord(y + SETA);
  return '<polygon points="' + p + '" fill="#000"/>';
}

/* O halo branco impede que a linha de cota atravesse o numero. */
function textoCota(x, y, txt, rot){
  const t = rot
    ? ' transform="rotate(' + rot + ' ' + coord(x) + ' ' + coord(y) + ')"'
    : '';
  return '<text x="' + coord(x) + '" y="' + coord(y) + '"' + t +
    ' font-size="' + FONTE + '" text-anchor="middle" fill="#000"' +
    ' stroke="#fff" stroke-width="3.2" paint-order="stroke"' +
    ' font-family="system-ui,-apple-system,sans-serif">' + txt + '</text>';
}

function rotulo(x, y, txt){
  return '<text x="' + coord(x) + '" y="' + coord(y) +
    '" font-size="' + (FONTE - 1) + '" text-anchor="middle" fill="#000"' +
    ' font-family="system-ui,-apple-system,sans-serif" ' +
    'letter-spacing="0.6">' + txt + '</text>';
}

/* ---------- Cotas ---------- */

function cotaH(x1, x2, yCota, yOrigem, txt){
  const paraBaixo = yCota > yOrigem;
  const fim = paraBaixo ? yCota + 5 : yCota - 5;

  let h = '';
  h += linha(x1, yOrigem, x1, fim);
  h += linha(x2, yOrigem, x2, fim);
  h += linha(x1, yCota, x2, yCota);
  h += setaH(x1, yCota, -1);
  h += setaH(x2, yCota, 1);
  h += textoCota((x1 + x2) / 2, yCota - 4, txt);
  return h;
}

function cotaV(y1, y2, xCota, xOrigem, txt){
  const paraDireita = xCota > xOrigem;
  const fim = paraDireita ? xCota + 5 : xCota - 5;

  let h = '';
  h += linha(xOrigem, y1, fim, y1);
  h += linha(xOrigem, y2, fim, y2);
  h += linha(xCota, y1, xCota, y2);
  h += setaV(xCota, y1, -1);
  h += setaV(xCota, y2, 1);
  h += textoCota(xCota - 5, (y1 + y2) / 2, txt, -90);
  return h;
}

/* ---------- Projecao de uma peca ---------- */

function desenharPeca(p, v, s){
  const bb = bboxPeca(p);
  const uIdx = v.uIdx, vIdx = v.vIdx;
  const u0 = bb.min[uIdx], u1 = bb.max[uIdx];
  const v0 = bb.min[vIdx], v1 = bb.max[vIdx];
  const uc = (u0 + u1) / 2;
  const T = p.tipo;

  const ponto = (u, vv) => {
    const px = v.x + (u - v.uMin) * s;
    const py = v.vParaBaixo
      ? v.y + (vv - v.vMin) * s
      : v.y + (v.vMax - vv) * s;
    return [px, py];
  };

  /* Planta: pecas de revolucao viram circulo. */
  if (v.plano && (T === 'cilindro' || T === 'cone' ||
                  (T === 'tubo' && p.redondo))) {
    const c = ponto(uc, (v0 + v1) / 2);
    return { t: 'circle', cx: c[0], cy: c[1], r: ((u1 - u0) / 2) * s };
  }

  /* Cone e piramide truncada: largura varia com a altura. */
  if ((T === 'cone' || T === 'piramide') && !v.plano) {
    const hb = (u1 - u0) / 2;
    const ht = T === 'cone' ? p.rTopo : p.ladoTopo / 2;
    const a = ponto(uc - hb, v0), b = ponto(uc + hb, v0);
    const c = ponto(uc + ht, v1), d = ponto(uc - ht, v1);
    return { t: 'poly', pts: [a, b, c, d] };
  }

  const a = ponto(u0, v0), b = ponto(u1, v0);
  const c = ponto(u1, v1), d = ponto(u0, v1);
  return { t: 'poly', pts: [a, b, c, d] };
}

function svgDaForma(f){
  if (f.t === 'circle'){
    return '<circle cx="' + coord(f.cx) + '" cy="' + coord(f.cy) +
      '" r="' + coord(f.r) + '" fill="#fff" stroke="#000" stroke-width="' +
      TRACO_GROSSO + '"/>';
  }
  const pts = f.pts.map(q => coord(q[0]) + ',' + coord(q[1])).join(' ');
  return '<polygon points="' + pts + '" fill="#fff" stroke="#000" ' +
    'stroke-width="' + TRACO_GROSSO + '"/>';
}

/* ---------- Prancha ---------- */

export function desenhoTecnico(barras){
  if (!Array.isArray(barras) || barras.length === 0) return '';

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const p of barras) {
    const bb = bboxPeca(p);
    for (let a = 0; a < 3; a++) {
      if (bb.min[a] < min[a]) min[a] = bb.min[a];
      if (bb.max[a] > max[a]) max[a] = bb.max[a];
    }
  }

  const W = max[0] - min[0];
  const D = max[1] - min[1];
  const H = max[2] - min[2];

  if (!Number.isFinite(W) || !Number.isFinite(D) || !Number.isFinite(H)) {
    return '';
  }
  if (W <= 0 || D <= 0 || H <= 0) return '';

  /* Altura do assento: topo da peca do assento. */
  let topoAssento = min[2];
  let temEncosto = false;

  for (const p of barras) {
    if (p.grupo === 'assento') {
      const bb = bboxPeca(p);
      if (bb.max[2] > topoAssento) topoAssento = bb.max[2];
    }
    if (p.grupo === 'poste0' || p.grupo === 'encosto') temEncosto = true;
  }

  /* Pecas de referencia para as cotas de detalhe. */
  const pecaPe = barras.find(p => p.grupo === 'pe') || null;
  const ehPedestal = pecaPe !== null;
  const bbPe = ehPedestal ? bboxPeca(pecaPe) : null;

  const pecaColuna = ehPedestal
    ? (barras.find(p => p.grupo === 'coluna') || null)
    : (barras.find(p => p.grupo === 'perna0') || null);
  const bbColuna = pecaColuna ? bboxPeca(pecaColuna) : null;

  /*
   * O espaco entre a vista frontal e a superior precisa acomodar as cotas
   * empilhadas mais o rotulo. 36% da maior dimensao da conta.
   */
  const gap = 0.36 * Math.max(W, D);
  const colW2 = Math.max(W, D);
  const totalW = W + gap + colW2;
  const totalH = H + gap + D;

  const utilW = VBW - 2 * MARGEM;
  let s = utilW / totalW;
  let vbh = Math.round(totalH * s + 2 * MARGEM + 32);

  if (vbh > VBH_MAX) {
    s = (VBH_MAX - 2 * MARGEM - 32) / totalH;
    vbh = VBH_MAX;
  }

  const offX = (VBW - totalW * s) / 2;
  const offY = MARGEM;

  const col2 = offX + (W + gap) * s;
  const lin2 = offY + (H + gap) * s;

  const vistas = [
    { nome: 'VISTA FRONTAL', x: offX, y: offY,
      uIdx: 0, vIdx: 2, profIdx: 1, asc: true, plano: false, vParaBaixo: false,
      uMin: min[0], uMax: max[0], vMin: min[2], vMax: max[2] },

    { nome: 'VISTA LATERAL', x: col2, y: offY,
      uIdx: 1, vIdx: 2, profIdx: 0, asc: false, plano: false, vParaBaixo: false,
      uMin: min[1], uMax: max[1], vMin: min[2], vMax: max[2] },

    { nome: 'VISTA SUPERIOR', x: offX, y: lin2,
      uIdx: 0, vIdx: 1, profIdx: 2, asc: true, plano: true, vParaBaixo: true,
      uMin: min[0], uMax: max[0], vMin: min[1], vMax: max[1] },

    { nome: 'VISTA INFERIOR', x: col2, y: lin2,
      uIdx: 0, vIdx: 1, profIdx: 2, asc: false, plano: true, vParaBaixo: true,
      uMin: min[0], uMax: max[0], vMin: min[1], vMax: max[1] }
  ];

  /* ---------- Corpo das vistas ---------- */
  let corpo = '';

  for (const v of vistas) {
    const ordenadas = barras.slice().sort((a, b) => {
      const ca = centroBbox(a, v.profIdx);
      const cb = centroBbox(b, v.profIdx);
      return v.asc ? ca - cb : cb - ca;
    });

    for (const p of ordenadas) {
      corpo += svgDaForma(desenharPeca(p, v, s));
    }
  }

  /* ---------- Cotas ---------- */
  const f = vistas[0], lat = vistas[1], sup = vistas[2], inf = vistas[3];

  const fL = (f.uMax - f.uMin) * s;
  const fA = (f.vMax - f.vMin) * s;
  const fX0 = f.x, fX1 = f.x + fL, fYA = f.y, fYB = f.y + fA;

  const lL = (lat.uMax - lat.uMin) * s;
  const lX0 = lat.x, lX1 = lat.x + lL;

  const sA = (sup.vMax - sup.vMin) * s;
  const sX0 = sup.x, sYA = sup.y, sYB = sup.y + sA;

  const iL = (inf.uMax - inf.uMin) * s;
  const iA = (inf.vMax - inf.vMin) * s;
  const iX0 = inf.x, iX1 = inf.x + iL, iYA = inf.y, iYB = inf.y + iA;

  const pyAssento = f.y + (f.vMax - topoAssento) * s;

  let cotas = '';

  /* Frontal: altura total, largura e altura do assento. */
  cotas += cotaV(fYA, fYB, fX0 - 28, fX0, cm(H));
  cotas += cotaH(fX0, fX1, fYB + NIVEL_C, fYB, cm(W));
  cotas += cotaV(pyAssento, fYB, fX1 + (ehPedestal ? 44 : 26), fX1,
                 cm(topoAssento - min[2]));

  /* Lateral: profundidade e altura do encosto. */
  cotas += cotaH(lX0, lX1, fYB + NIVEL_B, fYB, cm(D));
  if (temEncosto && topoAssento < max[2]) {
    cotas += cotaV(fYA, pyAssento, lX1 + 26, lX1, cm(max[2] - topoAssento));
  }

  /* Superior: profundidade. */
  cotas += cotaV(sYA, sYB, sX0 - 28, sX0, cm(D));

  /* Inferior: largura e profundidade. */
  cotas += cotaH(iX0, iX1, iYB + 26, iYB, cm(W));
  cotas += cotaV(iYA, iYB, iX0 - 28, iX0, cm(D));

  /* ---------- Cotas de detalhe ----------
   * Espessura da perna (4 pernas) ou da coluna (pedestal). No pedestal a
   * origem da cota e o topo do pe, porque e ali que a coluna comeca. */
  if (bbColuna) {
    const e1 = pxDe(f, bbColuna.min[0], s);
    const e2 = pxDe(f, bbColuna.max[0], s);
    const yOrigemEsp = ehPedestal
      ? pyDe(f, bbPe.max[2], s)
      : fYB;

    cotas += cotaH(e1, e2, fYB + NIVEL_A, yOrigemEsp,
                   cm(bbColuna.max[0] - bbColuna.min[0]));
  }

  /* Base e altura do pe, so no pedestal. A largura do assento no nivel C
     ja existe para os dois casos. */
  if (ehPedestal && bbPe) {
    const b1 = pxDe(f, bbPe.min[0], s);
    const b2 = pxDe(f, bbPe.max[0], s);

    cotas += cotaH(b1, b2, fYB + NIVEL_B, fYB,
                   cm(bbPe.max[0] - bbPe.min[0]));

    cotas += cotaV(pyDe(f, bbPe.max[2], s), fYB, fX1 + 24, fX1,
                   cm(bbPe.max[2] - bbPe.min[2]));
  }

  /* ---------- Rotulos ---------- */
  const yRotFrontal = fYB + NIVEL_A + (ehPedestal ? 54 : 36) + 12;

  let rotulos = '';
  rotulos += rotulo((fX0 + fX1) / 2, yRotFrontal, vistas[0].nome);
  rotulos += rotulo((lX0 + lX1) / 2, fYB + 52, vistas[1].nome);
  rotulos += rotulo((sX0 + sX0 + (sup.uMax - sup.uMin) * s) / 2, sYB + 40,
                    vistas[2].nome);
  rotulos += rotulo((iX0 + iX1) / 2, iYB + 52, vistas[3].nome);

  return '<svg viewBox="0 0 ' + VBW + ' ' + vbh + '" width="100%" ' +
    'role="img" aria-label="Desenho tecnico com vistas ortograficas cotadas">' +
    '<rect x="0" y="0" width="' + VBW + '" height="' + vbh + '" fill="#fff"/>' +
    corpo + cotas + rotulos +
    '</svg>';
}