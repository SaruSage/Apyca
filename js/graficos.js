/**
 * Pagina de graficos e diagramas.
 *
 * UNIDADES: t e H chegam em CENTIMETROS; o solver trabalha em MILIMETROS.
 * unid=mm na URL desliga a conversao.
 *
 * DIAGRAMA DE CORPO LIVRE: geometria real — pernas, laje do assento com a
 * espessura do modelo e, quando existe, o encosto com postes e painel. A laje
 * usa espessura minima de 7 px para continuar visivel na escala do desenho.
 * Todos os rotulos levam halo, o que elimina a sobreposicao.
 *
 * DOIS CONJUNTOS DE REACOES: no piso e no assento. O segundo diagrama isola
 * a placa vista de cima, com os quatro apoios e as duas faixas verificadas.
 */

import { HIPOTESES, CADEIRA, G } from './constantes.js';
import { calcular } from './solver.js';
import { construirBarras, dimensoesExternas } from './chairModel.js';

const C = {
  grade:'#232b36', eixo:'#3a4658', texto:'#93a2b5', forte:'#e7edf5',
  azul:'#4fa3ff', verde:'#3ecf8e', vermelho:'#f2555a', ambar:'#f0b429',
  roxo:'#a78bfa', fundo:'#0e1218'
};

const LARG = 560;
const ALT = 262;
const FONTE = 11.5;

const n = (v, c = 1) => Number.isFinite(v)
  ? v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c })
  : '—';

const px = v => (Number.isFinite(v) ? v.toFixed(1) : '0');

function etiq(v){
  const a = Math.abs(v);
  let s;
  if (a < 1e-9) return '0';
  else if (a >= 1e6) s = (v / 1e6).toFixed(1) + 'M';
  else if (a >= 1e4) s = (v / 1e3).toFixed(0) + 'k';
  else if (a >= 1e3) s = (v / 1e3).toFixed(1) + 'k';
  else if (a >= 100) s = v.toFixed(0);
  else if (a >= 10) s = v.toFixed(a % 1 < 1e-6 ? 0 : 1);
  else if (a >= 1) s = v.toFixed(1);
  else s = v.toFixed(2);
  return s.replace('.', ',');
}

const ln = (x1, y1, x2, y2, cor, dash, w) =>
  `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" ` +
  `stroke="${cor || C.texto}" stroke-width="${w || 0.9}"` +
  (dash ? ` stroke-dasharray="${dash}"` : '') + '/>';

function halo(x, y, txt, cor, tam, anc, rot, peso){
  const tr = rot ? ` transform="rotate(${rot} ${px(x)} ${px(y)})"` : '';
  return `<text x="${px(x)}" y="${px(y)}"${tr} font-size="${tam || 11}" ` +
    `text-anchor="${anc || 'middle'}" fill="${cor}" stroke="${C.fundo}" ` +
    `stroke-width="3.6" paint-order="stroke" font-weight="${peso || 600}" ` +
    `font-family="system-ui,sans-serif">${txt}</text>`;
}

/* ---------- Gráfico de linhas ---------- */
function graficoLinha(op){
  const larg = LARG, alt = op.altura || ALT;
  const x0 = 74, x1 = larg - 20, y0 = 20, y1 = alt - 52;
  const { xmin, xmax } = op;
  const series = op.series || [], refs = op.linhasRef || [], marcas = op.marcas || [];

  let lo = Infinity, hi = -Infinity;
  for (const s of series) {
    for (let i = 0; i <= 90; i++) {
      const y = s.f(xmin + (xmax - xmin) * i / 90);
      if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    }
  }
  for (const r of refs) if (Number.isFinite(r.y)) { lo = Math.min(lo, r.y); hi = Math.max(hi, r.y); }
  for (const m of marcas) if (Number.isFinite(m.y)) { lo = Math.min(lo, m.y); hi = Math.max(hi, m.y); }
  if (!Number.isFinite(lo)) { lo = 0; hi = 1; }

  const ymin = op.ymin !== undefined ? op.ymin : Math.min(0, lo);
  let ymax = op.ymax;
  if (ymax === undefined) {
    const t = Math.max(hi, ymin + 1e-6);
    ymax = t + (t - ymin) * 0.18;
  }
  if (ymax - ymin < 1e-9) ymax = ymin + 1;

  const sx = x => x0 + (x - xmin) / (xmax - xmin) * (x1 - x0);
  const sy = y => y1 - (y - ymin) / (ymax - ymin) * (y1 - y0);

  let h = '';
  for (let i = 0; i <= 4; i++) {
    const val = ymin + (ymax - ymin) * i / 4, py = sy(val);
    h += `<line x1="${x0}" y1="${px(py)}" x2="${x1}" y2="${px(py)}" stroke="${C.grade}"/>`;
    h += `<text x="${x0 - 10}" y="${px(py + 4)}" font-size="${FONTE}" text-anchor="end" fill="${C.texto}" font-family="system-ui,sans-serif">${etiq(val)}</text>`;
  }
  for (let i = 0; i <= 4; i++) {
    const val = xmin + (xmax - xmin) * i / 4, qx = sx(val);
    h += `<line x1="${px(qx)}" y1="${y0}" x2="${px(qx)}" y2="${y1}" stroke="${C.grade}"/>`;
    h += `<text x="${px(qx)}" y="${y1 + 19}" font-size="${FONTE}" text-anchor="middle" fill="${C.texto}" font-family="system-ui,sans-serif">${etiq(val)}</text>`;
  }
  if (ymin < 0 && ymax > 0) h += ln(x0, sy(0), x1, sy(0), C.eixo, null, 1.3);

  h += ln(x0, y0, x0, y1, C.eixo, null, 1.5);
  h += ln(x0, y1, x1, y1, C.eixo, null, 1.5);

  for (const r of refs) {
    if (!Number.isFinite(r.y)) continue;
    const py = sy(r.y);
    h += `<line x1="${x0}" y1="${px(py)}" x2="${x1}" y2="${px(py)}" stroke="${r.cor || C.ambar}" stroke-width="1.4" stroke-dasharray="6 4"/>`;
    if (r.rotulo) h += halo(x1 - 4, py - 6, r.rotulo, r.cor || C.ambar, FONTE, 'end', 0, 500);
  }

  for (const s of series) {
    const pts = [];
    for (let i = 0; i <= 90; i++) {
      const x = xmin + (xmax - xmin) * i / 90, y = s.f(x);
      if (!Number.isFinite(y)) continue;
      pts.push(px(sx(x)) + ',' + px(sy(y)));
    }
    if (pts.length < 2) continue;
    if (s.area) {
      const base = sy(Math.max(ymin, Math.min(0, ymax)));
      h += `<polygon points="${pts.join(' ')} ${px(sx(xmax))},${px(base)} ${px(sx(xmin))},${px(base)}" fill="${s.cor || C.azul}" fill-opacity="0.14"/>`;
    }
    h += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.cor || C.azul}" stroke-width="${s.espessura || 2}" stroke-linejoin="round" stroke-linecap="round"${s.tracejada ? ' stroke-dasharray="6 4"' : ''}/>`;
  }

  for (const m of marcas) {
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
    const qx = sx(m.x), qy = sy(m.y);
    h += `<circle cx="${px(qx)}" cy="${px(qy)}" r="3.8" fill="${m.cor || C.verde}" stroke="${C.fundo}" stroke-width="1.4"/>`;
    if (m.rotulo) {
      const anc = qx > (x0 + x1) / 2 ? 'end' : 'start';
      h += halo(qx + (anc === 'end' ? -9 : 9), qy - 9, m.rotulo, m.cor || C.verde, FONTE, anc, 0, 500);
    }
  }

  if (op.legendaX) h += halo((x0 + x1) / 2, alt - 8, op.legendaX, C.texto, FONTE, 'middle', 0, 400);
  if (op.legendaY) h += halo(16, (y0 + y1) / 2, op.legendaY, C.texto, FONTE, 'middle', -90, 400);

  return `<svg viewBox="0 0 ${larg} ${alt}" width="100%" role="img" aria-label="${op.alt || 'grafico'}">${h}</svg>`;
}

/* ---------- Barras verticais ---------- */
function graficoBarras(op){
  const larg = LARG, alt = op.altura || ALT;
  const x0 = 74, x1 = larg - 20, y0 = 22, y1 = alt - 54;
  const itens = op.itens || [], refs = op.linhasRef || [];

  let hi = 0;
  for (const it of itens) hi = Math.max(hi, it.valor);
  for (const r of refs) hi = Math.max(hi, r.y);
  if (hi <= 0) hi = 1;

  const ymax = op.ymax !== undefined ? op.ymax : hi * 1.2;
  const sy = v => y1 - (v / ymax) * (y1 - y0);

  let h = '';
  for (let i = 0; i <= 4; i++) {
    const val = ymax * i / 4, py = sy(val);
    h += `<line x1="${x0}" y1="${px(py)}" x2="${x1}" y2="${px(py)}" stroke="${C.grade}"/>`;
    h += `<text x="${x0 - 10}" y="${px(py + 4)}" font-size="${FONTE}" text-anchor="end" fill="${C.texto}" font-family="system-ui,sans-serif">${etiq(val)}</text>`;
  }

  const faixa = (x1 - x0) / Math.max(itens.length, 1);
  const lb = Math.min(72, faixa * 0.54);

  itens.forEach((it, i) => {
    const cxb = x0 + faixa * (i + 0.5);
    const topo = sy(Math.max(0, it.valor));
    const cor = it.cor || C.azul;
    h += `<rect x="${px(cxb - lb / 2)}" y="${px(topo)}" width="${px(lb)}" height="${px(Math.max(1, y1 - topo))}" rx="2" fill="${cor}" fill-opacity="0.32" stroke="${cor}" stroke-width="1.3"/>`;
    if (it.valorTexto) h += halo(cxb, topo - 8, it.valorTexto, C.forte, FONTE, 'middle', 0, 600);
    h += halo(cxb, y1 + 19, it.rotulo, C.texto, FONTE, 'middle', 0, 400);
    if (it.sub) h += halo(cxb, y1 + 34, it.sub, C.texto, FONTE - 1, 'middle', 0, 400);
  });

  for (const r of refs) {
    const py = sy(r.y);
    h += `<line x1="${x0}" y1="${px(py)}" x2="${x1}" y2="${px(py)}" stroke="${r.cor || C.ambar}" stroke-width="1.4" stroke-dasharray="6 4"/>`;
    if (r.rotulo) h += halo(x1 - 4, py - 6, r.rotulo, r.cor || C.ambar, FONTE, 'end', 0, 500);
  }

  h += ln(x0, y0, x0, y1, C.eixo, null, 1.5);
  h += ln(x0, y1, x1, y1, C.eixo, null, 1.5);
  if (op.legendaY) h += halo(16, (y0 + y1) / 2, op.legendaY, C.texto, FONTE, 'middle', -90, 400);

  return `<svg viewBox="0 0 ${larg} ${alt}" width="100%" role="img" aria-label="${op.alt || 'barras'}">${h}</svg>`;
}

/* ---------- Barras horizontais ---------- */
function graficoBarrasH(op){
  const itens = op.itens || [];
  const larg = LARG + 60, linha = 30, topo = 30;
  const alt = topo + itens.length * linha + 14;
  const rotW = 178, x0 = rotW, x1 = larg - 60;

  const hi = op.ymax !== undefined ? op.ymax
    : Math.max(105, ...itens.map(i => i.valor)) * 1.12;
  const sx = v => x0 + (v / hi) * (x1 - x0);

  let h = '';
  for (let i = 0; i <= 4; i++) {
    const val = hi * i / 4, qx = sx(val);
    h += `<line x1="${px(qx)}" y1="${topo - 10}" x2="${px(qx)}" y2="${topo + itens.length * linha}" stroke="${C.grade}"/>`;
    h += `<text x="${px(qx)}" y="${topo - 16}" font-size="${FONTE}" text-anchor="middle" fill="${C.texto}" font-family="system-ui,sans-serif">${Math.round(val)}%</text>`;
  }

  const q100 = sx(100);
  h += `<line x1="${px(q100)}" y1="${topo - 10}" x2="${px(q100)}" y2="${topo + itens.length * linha}" stroke="${C.vermelho}" stroke-width="1.4" stroke-dasharray="6 4"/>`;
  h += halo(q100 + 6, topo - 16, 'limite', C.vermelho, FONTE, 'start', 0, 500);

  itens.forEach((it, i) => {
    const y = topo + i * linha + 5, hb = linha - 13;
    const v = Math.max(0, it.valor);
    const cor = v > 100 ? C.vermelho : (v > 80 ? C.ambar : C.verde);
    h += `<rect x="${x0}" y="${y}" width="${px(Math.max(2, sx(v) - x0))}" height="${hb}" rx="2" fill="${cor}" fill-opacity="0.30" stroke="${cor}" stroke-width="1.2"/>`;
    h += halo(rotW - 10, y + hb - 4, it.rotulo, C.texto, FONTE, 'end', 0, 400);
    h += halo(Math.min(sx(v) + 8, larg - 10), y + hb - 4, n(v, 1) + '%', C.forte, FONTE, 'start', 0, 600);
  });

  return `<svg viewBox="0 0 ${larg} ${alt}" width="100%" role="img" aria-label="${op.alt || 'utilizacao'}">${h}</svg>`;
}

/* ---------- Diagrama de corpo livre ----------
 * Geometria real: pernas, laje fina do assento e encosto em traço leve.
 * A carga P e o peso W descem sobre a superfície do assento. */
function dclSVG(r, dims){
  const L = HIPOTESES.L, e = HIPOTESES.e;
  const nEl = r.entrada.numPernas;
  const t = Math.min(r.entrada.t, CADEIRA.espessuraMaxima);
  const H = r.entrada.H;
  const temEncosto = r.entrada.comEncosto;
  const redonda = r.entrada.forma === 'redonda';

  const tAssMm = CADEIRA.fracaoEspessuraAssento * t;
  const zAssTopo = H + tAssMm;
  const zTotal = zAssTopo + (temEncosto ? CADEIRA.alturaEncosto : 0);
  const zAbertura = zAssTopo + CADEIRA.alturaAbertura;

  const larg = 560, alt = 480, chao = 396, cx = larg / 2;
  const s = Math.min(258 / zTotal, 232 / dims.largura);

  const yDe = z => chao - z * s;
  const yPernaTopo = yDe(H);
  const hAssPx = Math.max(7, tAssMm * s);
  const yAssTopo = yPernaTopo - hAssPx;
  const yEncTopo = yDe(zTotal);
  const yEncBase = yDe(Math.min(zAbertura, zTotal));

  const meiaPerna = (L / 2) * s;
  const xPEsq = cx - meiaPerna, xPDir = cx + meiaPerna;
  const tw = Math.max(4, t * s);
  const meiaAss = (dims.largura / 2) * s;
  const xAssEsq = cx - meiaAss, xAssDir = cx + meiaAss;

  const P = r.forcas.P, Wc = r.massa.total * G;

  let g = '';

  /* Piso */
  g += ln(24, chao, larg - 24, chao, C.eixo, null, 1.6);
  for (let i = 32; i < larg - 24; i += 14) {
    g += ln(i, chao, i - 9, chao + 9, C.grade, null, 1);
  }

  /* Encosto: postes e painel, em tom leve (é contexto, não objeto de estudo) */
  if (temEncosto && yEncTopo < yAssTopo) {
    const xPostEsq = xAssEsq, xPostDir = xAssDir - tw;
    const altPoste = yAssTopo - yEncTopo;
    g += `<rect x="${px(xPostEsq)}" y="${px(yEncTopo)}" width="${px(tw)}" height="${px(altPoste)}" fill="${C.azul}" fill-opacity="0.12" stroke="${C.azul}" stroke-opacity="0.45"/>`;
    g += `<rect x="${px(xPostDir)}" y="${px(yEncTopo)}" width="${px(tw)}" height="${px(altPoste)}" fill="${C.azul}" fill-opacity="0.12" stroke="${C.azul}" stroke-opacity="0.45"/>`;
    if (yEncBase < yAssTopo) {
      g += `<rect x="${px(xPostEsq + tw)}" y="${px(yEncTopo)}" width="${px(xPostDir - xPostEsq - tw)}" height="${px(yEncBase - yEncTopo)}" fill="${C.azul}" fill-opacity="0.06" stroke="${C.azul}" stroke-opacity="0.3" stroke-dasharray="4 4"/>`;
    }
  }

  /* Pernas / pedestal */
  if (nEl === 4) {
    g += `<rect x="${px(xPEsq)}" y="${px(yPernaTopo)}" width="${px(tw)}" height="${px(chao - yPernaTopo)}" fill="${C.azul}" fill-opacity="0.32" stroke="${C.azul}" stroke-width="1.3"/>`;
    g += `<rect x="${px(xPDir - tw)}" y="${px(yPernaTopo)}" width="${px(tw)}" height="${px(chao - yPernaTopo)}" fill="${C.azul}" fill-opacity="0.32" stroke="${C.azul}" stroke-width="1.3"/>`;
  } else {
    const hPe = Math.min(CADEIRA.coneAltura, H * 0.4);
    const yPe = yDe(hPe);
    const rBase = Math.max(tw, CADEIRA.coneRaioBase *
      (redonda ? 1 : CADEIRA.fracaoLadoPiramide) * s);
    g += `<polygon points="${px(cx - rBase)},${chao} ${px(cx + rBase)},${chao} ${px(cx + tw / 2)},${px(yPe)} ${px(cx - tw / 2)},${px(yPe)}" fill="${C.azul}" fill-opacity="0.32" stroke="${C.azul}" stroke-width="1.3"/>`;
    g += `<rect x="${px(cx - tw / 2)}" y="${px(yPernaTopo)}" width="${px(tw)}" height="${px(yPe - yPernaTopo)}" fill="${C.azul}" fill-opacity="0.32" stroke="${C.azul}" stroke-width="1.3"/>`;
  }

  /* Laje do assento */
  g += `<rect x="${px(xAssEsq)}" y="${px(yAssTopo)}" width="${px(xAssDir - xAssEsq)}" height="${px(hAssPx)}" fill="${C.azul}" fill-opacity="0.36" stroke="${C.azul}" stroke-width="1.5"/>`;

  /* Linha de centro */
  g += ln(cx, yAssTopo - 8, cx, chao, C.texto, '3 4');

  /* Cargas sobre a superfície do assento */
  const xP = cx + e * s;
  const yPonta = yAssTopo - 6, yCauda = yAssTopo - 84;

  g += ln(xP, yCauda, xP, yPonta - 10, C.vermelho, null, 2.4);
  g += `<polygon points="${px(xP)},${px(yPonta)} ${px(xP - 5)},${px(yPonta - 12)} ${px(xP + 5)},${px(yPonta - 12)}" fill="${C.vermelho}"/>`;
  g += ln(cx, yCauda, cx, yPonta - 10, C.ambar, null, 2.2);
  g += `<polygon points="${px(cx)},${px(yPonta)} ${px(cx - 4.5)},${px(yPonta - 11)} ${px(cx + 4.5)},${px(yPonta - 11)}" fill="${C.ambar}"/>`;

  /* Rótulos em zonas livres: W à esquerda, P à direita */
  g += ln(cx - 10, yCauda + 4, cx - 70, yCauda + 4, C.ambar, '2 3');
  g += halo(cx - 74, yCauda + 8, 'W = ' + n(Wc, 1) + ' N', C.ambar, 11.5, 'end');
  g += ln(xP + 10, yCauda + 4, cx + 70, yCauda + 4, C.vermelho, '2 3');
  g += halo(cx + 74, yCauda + 8, 'P = ' + n(P, 0) + ' N', C.vermelho, 11.5, 'start');

  /* Cota da excentricidade */
  const yE = yAssTopo - 20;
  g += ln(cx, yE, xP, yE, C.vermelho);
  g += ln(cx, yE - 5, cx, yE + 5, C.vermelho);
  g += ln(xP, yE - 5, xP, yE + 5, C.vermelho);
  g += halo(cx + 8, yE - 7, 'e = ' + n(e / 10, 1) + ' cm', C.vermelho, 10.5, 'start');

  /* Reações no piso */
  const comp = v => 13 + 20 * (v / Math.max(P, 1));
  function reacao(xc, valor, rot, cor){
    const c = comp(valor);
    let q = ln(xc, chao + c, xc, chao - 2, cor, null, 2.2);
    q += `<polygon points="${px(xc)},${chao - 3} ${px(xc - 5)},${chao + 9} ${px(xc + 5)},${chao + 9}" fill="${cor}"/>`;
    q += halo(xc, chao + c + 15, rot, cor, 11, 'middle');
    return q;
  }
  if (nEl === 4) {
    g += reacao(xPEsq + tw / 2, r.forcas.Nmin, 'R₁ = ' + n(r.forcas.Nmin, 0) + ' N', C.roxo);
    g += reacao(xPDir - tw / 2, r.forcas.Nmax, 'R₂ = ' + n(r.forcas.Nmax, 0) + ' N', C.verde);
  } else {
    g += reacao(cx, P + Wc, 'R = ' + n(P + Wc, 0) + ' N', C.verde);
  }

  /* Cota H, à esquerda */
  const xH = xAssEsq - 46;
  g += ln(xH, chao, xH, yPernaTopo, C.texto);
  g += ln(xH - 5, chao, xH + 5, chao, C.texto);
  g += ln(xH - 5, yPernaTopo, xH + 5, yPernaTopo, C.texto);
  g += halo(xH - 9, (chao + yPernaTopo) / 2, 'H = ' + n(H / 10, 1) + ' cm', C.texto, 11, 'middle', -90);

  /* Cota L, só quando existe quadro de pernas */
  if (nEl === 4) {
    const yL = chao - 46;
    g += ln(xPEsq + tw / 2, chao, xPEsq + tw / 2, yL + 6, C.texto, '3 4');
    g += ln(xPDir - tw / 2, chao, xPDir - tw / 2, yL + 6, C.texto, '3 4');
    g += ln(xPEsq + tw / 2, yL, xPDir - tw / 2, yL, C.texto);
    g += ln(xPEsq + tw / 2, yL - 5, xPEsq + tw / 2, yL + 5, C.texto);
    g += ln(xPDir - tw / 2, yL - 5, xPDir - tw / 2, yL + 5, C.texto);
    g += halo(cx, yL - 8, 'L = ' + n(L / 10, 1) + ' cm', C.texto, 11);
  }

  /* Marca do encosto, à direita */
  if (temEncosto) {
    const xEnc = xAssDir + 30;
    g += ln(xEnc - 12, yEncTopo, xEnc + 4, yEncTopo, C.texto, '2 3');
    g += halo(xEnc + 8, yEncTopo + 4, 'encosto', C.texto, 10, 'start', 0, 500);
  }

  return `<svg viewBox="0 0 ${larg} ${alt}" width="100%" role="img" aria-label="diagrama de corpo livre da cadeira">${g}</svg>`;
}

/* ---------- Assento isolado ----------
 * Vista de cima da placa. Mostra as reações que as pernas exercem no assento
 * (iguais e opostas às do piso), a carga fora do centro e as duas faixas que
 * a verificação usa: o balanço da beirada e o vão entre apoios. */
function assentoSVG(r){
  const b = r.assento.b, L = HIPOTESES.L, e = HIPOTESES.e;
  const folga = CADEIRA.folga;
  const t = Math.min(r.entrada.t, CADEIRA.espessuraMaxima);
  const nEl = r.entrada.numPernas;
  const P = r.forcas.P;

  const larg = 560, alt = 448;
  const s = Math.min(276 / b, 232 / b);
  const w = b * s;
  const x0 = (larg - w) / 2;
  const y0 = 74;

  const X = mm => x0 + mm * s;
  const Y = mm => y0 + mm * s;

  let g = '';

  /* Faixa em balanço */
  if (nEl === 4) {
    g += `<rect x="${px(X(folga + L))}" y="${px(y0)}" width="${px(folga * s)}" height="${px(w)}" fill="${C.vermelho}" fill-opacity="0.16"/>`;
    g += `<rect x="${px(X(folga + t))}" y="${px(y0)}" width="${px((L - 2 * t) * s)}" height="${px(w)}" fill="${C.roxo}" fill-opacity="0.10"/>`;
  }

  /* Placa */
  g += `<rect x="${px(x0)}" y="${px(y0)}" width="${px(w)}" height="${px(w)}" fill="${C.azul}" fill-opacity="0.10" stroke="${C.azul}" stroke-width="1.6"/>`;

  /* Apoios */
  if (nEl === 4) {
    const pos = [
      [folga, folga], [folga + L - t, folga],
      [folga, folga + L - t], [folga + L - t, folga + L - t]
    ];
    for (const p of pos) {
      g += `<rect x="${px(X(p[0]))}" y="${px(Y(p[1]))}" width="${px(t * s)}" height="${px(t * s)}" fill="${C.azul}" fill-opacity="0.55" stroke="${C.azul}" stroke-width="1.6"/>`;
    }
  } else {
    g += `<circle cx="${px(X(b / 2))}" cy="${px(Y(b / 2))}" r="${px(Math.max(9, CADEIRA.coneRaioBase * CADEIRA.fracaoLadoPiramide * s))}" fill="${C.azul}" fill-opacity="0.45" stroke="${C.azul}" stroke-width="1.6"/>`;
  }

  /* Carga P fora do centro */
  const xC = X(b / 2), yC = Y(b / 2), xP = X(b / 2 + e);
  g += `<circle cx="${px(xP)}" cy="${px(yC)}" r="6.4" fill="${C.vermelho}" stroke="${C.fundo}" stroke-width="1.6"/>`;
  g += halo(xP + 12, yC + 4, 'P = ' + n(P, 0) + ' N', C.vermelho, 11, 'start');

  /* Excentricidade */
  g += ln(xC, yC + 24, xP, yC + 24, C.vermelho);
  g += ln(xC, yC + 19, xC, yC + 29, C.vermelho);
  g += ln(xP, yC + 19, xP, yC + 29, C.vermelho);
  g += halo((xC + xP) / 2, yC + 38, 'e = ' + n(e / 10, 1) + ' cm', C.vermelho, 10);

  /* Rótulos das faixas */
  if (nEl === 4) {
    g += halo(X(folga + L + folga / 2), y0 - 14, 'balanço', C.vermelho, 10);
    g += halo(X(b / 2), y0 - 14, 'vão entre apoios', C.roxo, 10);
  }

  /* Cotas */
  const yCota = y0 + w + 30;
  g += ln(x0, y0 + w, x0, yCota, C.texto, '3 4');
  g += ln(x0 + w, y0 + w, x0 + w, yCota, C.texto, '3 4');
  g += ln(x0, yCota, x0 + w, yCota, C.texto);
  g += ln(x0, yCota - 5, x0, yCota + 5, C.texto);
  g += ln(x0 + w, yCota - 5, x0 + w, yCota + 5, C.texto);
  g += halo(x0 + w / 2, yCota - 8, 'b = ' + n(b / 10, 1) + ' cm', C.texto, 11);

  const xL = x0 - 30;
  g += ln(xL, y0, xL, y0 + w, C.texto);
  g += ln(xL - 5, y0, xL + 5, y0, C.texto);
  g += ln(xL - 5, y0 + w, xL + 5, y0 + w, C.texto);
  g += halo(xL - 9, y0 + w / 2, n(b / 10, 1) + ' cm', C.texto, 10.5, 'middle', -90);

  if (nEl === 4) {
    const xLL = X(folga) - 16;
    g += ln(xLL, Y(folga), xLL, Y(folga + L), C.roxo);
    g += halo(xLL - 9, Y(folga + L / 2), 'L = ' + n(L / 10, 1) + ' cm', C.roxo, 10, 'middle', -90);
  }

  g += halo(x0 + w / 2, yCota + 22,
    nEl === 4
      ? 'R₁ = ' + n(r.forcas.Nmin, 0) + ' N  ·  R₂ = ' + n(r.forcas.Nmax, 0) + ' N'
      : 'R = ' + n(P, 0) + ' N no centro',
    C.verde, 10.5);

  return `<svg viewBox="0 0 ${larg} ${alt}" width="100%" role="img" aria-label="assento isolado com reacoes">${g}</svg>`;
}

/* ---------- Glossário ---------- */
const GLOSS = {
  P:['Carga do usuário','Peso da pessoa, aplicado verticalmente no assento.'],
  m:['Massa do usuário','Massa informada no simulador.'],
  g:['Aceleração da gravidade','Constante de 9,81 m/s² usada em todo o cálculo.'],
  W:['Peso próprio','Peso da cadeira, somando volume × densidade de cada peça.'],
  e:['Excentricidade','Deslocamento horizontal do ponto de carga em relação ao centro do assento.'],
  L:['Lado do quadro de pernas','Distância entre pernas na direção da excentricidade.'],
  n:['Número de pernas','Quantidade de apoios verticais: 4 pernas ou 1 pedestal.'],
  Nmed:['Reação média por perna','Parcela da carga dividida igualmente entre as pernas.'],
  dN:['Parcela excêntrica','Acréscimo de carga causado pelo binário da excentricidade.'],
  Nmax:['Reação máxima','Reação na perna mais carregada. É ela que dimensiona a estrutura.'],
  Nmin:['Reação mínima','Reação na perna menos carregada.'],
  H:['Altura da perna','Distância do piso até a face inferior do assento.'],
  t:['Dimensão externa da perna','Lado do quadrado ou diâmetro da seção transversal.'],
  A:['Área da seção','Área de material resistente na seção transversal.'],
  I:['Momento de inércia','Resistência da seção à flexão e à flambagem.'],
  Ia:['Inércia da faixa do assento','Momento de inércia da faixa usada no cálculo do assento.'],
  c:['Distância à fibra extrema','Metade da dimensão externa: ponto de maior tensão.'],
  Wmod:['Módulo resistente','I dividido por c. Converte momento fletor em tensão normal.'],
  r:['Raio de giração','Raiz de I/A. Mede o quanto a seção é concentrada.'],
  E:['Módulo de elasticidade','Rigidez do material: quanto ele se deforma sob tensão.'],
  Mcrit:['Momento crítico','Momento fletor na base da perna, onde a seção é mais solicitada.'],
  F:['Força horizontal equivalente','Força no nível do assento que reproduz o momento crítico.'],
  V:['Esforço cortante','Força transversal que tende a cisalhar a seção.'],
  M:['Momento fletor','Esforço que tende a curvar a peça.'],
  y:['Coordenada vertical','Posição medida a partir do piso, subindo até o assento.'],
  x:['Coordenada do balanço','Posição medida a partir do apoio, indo até a borda livre.'],
  delta:['Flecha','Deslocamento transversal da peça sob carga.'],
  a:['Balanço do assento','Trecho do assento que avança além do apoio.'],
  b:['Largura do assento','Largura total da placa do assento.'],
  h:['Espessura do assento','Altura da seção da placa do assento.'],
  q:['Pressão uniforme','Carga do usuário distribuída sobre a área do assento.'],
  sigmaA:['Tensão axial','Parcela de compressão simples, calculada por N dividido por A.'],
  sigmaF:['Tensão de flexão','Parcela devida ao momento, calculada por M vezes c sobre I.'],
  sigma:['Tensão normal máxima','Soma das parcelas axial e de flexão na fibra extrema.'],
  sigmaAdm:['Tensão admissível','Limite do material dividido pelo coeficiente de segurança.'],
  CS:['Coeficiente de segurança','Fator que reduz a resistência do material.'],
  lambda:['Índice de esbeltez','K vezes H sobre r. Mede o quão esguia é a peça.'],
  K:['Fator de comprimento efetivo','Depende dos apoios: 1,0 entre apoios, 2,0 engastada e livre.'],
  Pcr:['Carga crítica de Euler','Carga que faz a peça flambar lateralmente.'],
  Nadm:['Normal admissível','A vezes sigma_adm. Capacidade à compressão simples.'],
  Madm:['Momento admissível','W vezes sigma_adm. Capacidade à flexão.'],
  Mtomb:['Momento de tombamento','P vezes e. O que empurra a cadeira para tombar.'],
  Mest:['Momento estabilizador','P mais W, vezes R. O que mantém a cadeira no chão.'],
  R:['Braço estabilizador','Menor distância do centro de carga à borda da base.'],
  util:['Utilização','Razão entre solicitação e capacidade. Acima de 100% reprova.']
};

const blocoSimbolos = lista => !lista || !lista.length ? '' :
  '<h3 class="graf-modal__sub">Símbolos</h3><table class="graf-simbolos"><thead><tr>' +
  '<th>Símbolo</th><th>Nome</th><th>Conceito</th><th>Valor</th></tr></thead><tbody>' +
  lista.map(it => {
    const gl = GLOSS[it[0]] || [it[0], '—'];
    return `<tr><td class="sim">${it[0]}</td><td>${gl[0]}</td><td class="conc">${gl[1]}</td><td class="val">${it[1] || '—'}</td></tr>`;
  }).join('') + '</tbody></table>';

const blocoPassos = lista => !lista || !lista.length ? '' :
  '<h3 class="graf-modal__sub">Cálculo passo a passo</h3><ol class="graf-passos">' +
  lista.map(p => `<li><span class="tit">${p[0]}</span>` +
    (p[1] ? `<code>${p[1]}</code>` : '') +
    (p[2] ? `<code class="sub">${p[2]}</code>` : '') +
    (p[3] ? `<span class="res">${p[3]}</span>` : '') + '</li>').join('') +
  '</ol>';

/* ---------- Trilha para leigos ---------- */
const INTRO_PASSOS = [
  ['Força é um empurrão',
   'Força é qualquer empurrão ou puxão, e se mede em newtons (N). O peso de uma pessoa é uma força apontando para baixo.',
   'Empurrar um carrinho cheio exige mais força que um vazio. O peso funciona igual.',
   'cartões 1 e 3',
   'P = m × g   →   90 kg × 9,81 = 883 N'],
  ['Ação e reação: por que a cadeira não afunda',
   'Se a pessoa empurra o assento para baixo, o assento empurra de volta para cima com a mesma força. O chão faz o mesmo com as pernas.',
   'Apoie a mão na mesa: a mesa empurra sua mão de volta. É isso que impede a mão de atravessar.',
   'cartões 1 e 2, e o assento isolado',
   'soma das reações = carga total'],
  ['Alavanca: por que sentar na beirada muda tudo',
   'Uma força aplicada fora do centro cria um giro, chamado momento. Ele vale a força multiplicada pela distância até o ponto de apoio.',
   'Abrir uma porta empurrando longe da dobradiça é mais fácil que empurrar perto dela.',
   'cartões 1, 4 e 7',
   'M = F × d   →   momento = força × distância'],
  ['O que o momento faz com a perna',
   'Uma perna sob momento entorta. Um lado fica comprimido e o outro tracionado, como uma régua dobrada.',
   'Segure uma régua pelos extremos e dobre: uma face encurta e a outra estica.',
   'cartões 4.3 e 9',
   'um lado comprime, o outro traciona'],
  ['Tensão e admissível: o mesmo esforço em área menor',
   'Tensão é força dividida por área. A mesma carga passando por uma perna mais fina gera mais tensão.',
   'Pisar de salto fino afunda na areia; com sapato largo, não. Mesmo peso, área diferente.',
   'cartão 9',
   'tensão = força / área   e comparar com o admissível'],
  ['Flambagem: o canudo',
   'Peça fina e comprida enverga lateralmente antes de esmagar. Isso se chama flambagem.',
   'Ficar de pé sobre um canudo de papel: ele dobra para o lado, não amassa.',
   'cartão 8',
   'carga crítica = π² × E × I / (K × H)²'],
  ['Flecha: por que o assento afunda',
   'Toda peça se deforma sob carga. Flecha é esse afundamento, medido em milímetros.',
   'Prancha de mergulho: quanto mais longa, mais afunda na ponta quando alguém salta.',
   'cartões 5.3 e 6.2',
   'flecha cresce com o cubo do comprimento'],
  ['Utilização: o medidor de 0 a 100%',
   'Para cada verificação, divide-se o que a peça recebe pelo que ela suporta. Acima de 100% reprova.',
   'Velocímetro: a faixa vermelha marca o limite. Se o ponteiro entra nela, parou de ser seguro.',
   'cartão 11',
   'utilização = solicitação / capacidade × 100%']
];

function blocoIntro(){
  return '<details class="graf-intro">' +
    '<summary>Comece por aqui — do zero ao entendimento das contas</summary>' +
    '<p class="graf-intro__lead">Oito passos em ordem de dificuldade. Cada um traz a ideia ' +
    'em uma frase, uma analogia do dia a dia, onde ela aparece nesta página e a fórmula ' +
    'traduzida. Lido na sequência, dá base para interpretar qualquer cartão acima.</p>' +
    '<ol class="graf-intro__lista">' +
    INTRO_PASSOS.map(p => `<li><span class="graf-intro__tit">${p[0]}</span>` +
      `<p class="graf-intro__ideia">${p[1]}</p>` +
      `<p class="graf-intro__analogia"><strong>Como pensar:</strong> ${p[2]}</p>` +
      `<p class="graf-intro__onde">Onde aparece: ${p[3]}</p>` +
      `<code>${p[4]}</code></li>`).join('') +
    '</ol></details>';
}

/* ---------- Cartões ---------- */
const CARDS = new Map();
let seq = 0;

function card(op){
  const id = 'g' + (++seq);
  CARDS.set(id, op);
  return `<section class="graf-card${op.largo ? ' graf-card--largo' : ''}" data-card="${id}">` +
    `<div class="graf-card__topo"><h2>${op.titulo}</h2>` +
    `<div class="graf-menu"><button type="button" class="graf-menu__botao" ` +
    `aria-haspopup="true" aria-expanded="false" aria-label="Opções do tema">⋮</button>` +
    `<div class="graf-menu__lista" hidden><button type="button" class="graf-menu__item" ` +
    `data-expandir="${id}">Expandir tema</button></div></div></div>` +
    (op.simples ? `<p class="graf-simples"><strong>Em palavras simples:</strong> ${op.simples}</p>` : '') +
    (op.cenario ? `<p class="graf-cenario">${op.cenario}</p>` : '') +
    (op.figura ? `<div class="graf-figura">${op.figura}</div>` : '') +
    (op.nota ? `<p class="graf-nota-figura">${op.nota}</p>` : '') +
    (op.formula ? `<pre class="graf-formula">${op.formula}</pre>` : '') +
    (op.leitura ? `<p class="graf-leitura">${op.leitura}</p>` : '') +
    '</section>';
}

/* ---------- Entrada ---------- */
const qs = new URLSearchParams(location.search);
const numQS = (k, d) => {
  const v = parseFloat(qs.get(k));
  return Number.isFinite(v) ? v : d;
};
const fator = qs.get('unid') === 'mm' ? 1 : 10;

const entrada = {
  materialId: qs.get('material') || 'madeira',
  espessuraMm: numQS('t', 4) * fator,
  alturaMm: numQS('H', 45) * fator,
  massaKg: numQS('m', 90),
  forma: qs.get('forma') === 'redonda' ? 'redonda' : 'quadrada',
  numPernas: parseInt(qs.get('n'), 10) === 1 ? 1 : 4,
  vazada: qs.get('secao') === 'tubular',
  paredeMm: numQS('parede', 3),
  comEncosto: qs.get('encosto') !== 'sem'
};

const conteudo = document.getElementById('graf-conteudo');
const sub = document.getElementById('graf-sub');
const modal = document.getElementById('graf-modal');
const tituloModal = document.getElementById('graf-modal-titulo');
const corpoModal = document.getElementById('graf-modal-corpo');

const r = calcular(entrada);

if (!r || !r.ok) {
  sub.textContent = '';
  conteudo.innerHTML = '<section class="graf-erro"><strong>Não foi possível gerar os ' +
    'gráficos</strong>' + ((r && r.erros) ? r.erros.join(' ') : 'Configuração inválida.') +
    '<br><br>Volte ao simulador, ajuste os dados e abra os gráficos de novo.</section>';
} else {
  desenhar();
}

function desenhar(){
  const mat = r.entrada.material;
  const P = r.forcas.P, H = r.entrada.H;
  const L = HIPOTESES.L, e = HIPOTESES.e;
  const nEl = r.entrada.numPernas;
  const A = r.secao.A, I = r.secao.I, W = r.secao.W, E = mat.E;
  const Wpeso = r.massa.total * G;
  const temEnc = r.entrada.comEncosto;

  const barras = construirBarras(r.entrada.t, r.entrada.H, mat, r.entrada.forma,
    r.entrada.numPernas, r.entrada.vazada, r.entrada.parede, r.entrada.comEncosto);
  const dims = dimensoesExternas(barras);

  sub.textContent = mat.nome + ' · ' + n(dims.altura / 10, 1) + ' × ' +
    n(dims.largura / 10, 1) + ' × ' + n(dims.profundidade / 10, 1) + ' cm · ' +
    (nEl === 1 ? 'pedestal' : '4 pernas') + ' · ' +
    (temEnc ? 'com encosto' : 'sem encosto');

  const Mcrit = r.forcas.Mperna;
  const Fh = Mcrit / H;
  const Nperna = r.forcas.Nmax;
  const Mperna = y => Fh * (H - y);
  const defPerna = y => (Fh * y * y * (3 * H - y)) / (6 * E * I);
  const a = r.assento.a, Ia = r.assento.I;
  const Mbal = x => P * (a - x);
  const defBal = x => (P * x * x * (3 * a - x)) / (6 * E * Ia);

  let out = blocoIntro();

  /* Cenário */
  out += card({
    largo: true,
    titulo: 'Cenário analisado',
    simples: 'estes são os dados da cadeira que você montou no simulador. Tudo nesta página sai deles.',
    cenario: 'Os diagramas abaixo usam a mesma configuração do simulador, recalculada com o ' +
      'mesmo solver nesta página. Abra o menu de três pontos de qualquer cartão para ver o ' +
      'gráfico ampliado, o significado de cada símbolo e o cálculo passo a passo.',
    figura: '<table class="graf-tabela"><tbody>' + [
      ['Material', mat.nome + ' — E = ' + n(E, 0) + ' MPa, σ_adm = ' + n(r.tensoes.sigmaAdm, 2) + ' MPa'],
      ['Seção', (r.entrada.vazada ? 'Tubular' : 'Maciça') + ' ' +
        (r.entrada.forma === 'redonda' ? 'redonda' : 'quadrada') + ', t = ' + n(r.entrada.t / 10, 1) + ' cm'],
      ['Apoios', nEl === 1 ? '1 perna (pedestal central)' : '4 pernas, L = ' + n(L / 10, 1) + ' cm'],
      ['Altura da perna', n(H / 10, 1) + ' cm'],
      ['Massa do usuário', n(r.entrada.m, 1) + ' kg'],
      ['Massa própria', n(r.massa.total, 2) + ' kg'],
      ['Encosto', temEnc ? 'presente' : 'ausente (banco)']
    ].map(l => `<tr><th>${l[0]}</th><td>${l[1]}</td></tr>`).join('') + '</tbody></table>',
    detalhe: {
      simbolos: [['P', n(P, 1) + ' N'], ['m', n(r.entrada.m, 1) + ' kg'],
        ['g', n(G, 2) + ' m/s²'], ['W', n(Wpeso, 1) + ' N'], ['e', n(e, 1) + ' mm'],
        ['L', n(L, 1) + ' mm'], ['H', n(H, 1) + ' mm'], ['t', n(r.entrada.t, 1) + ' mm'],
        ['E', n(E, 0) + ' MPa'], ['sigmaAdm', n(r.tensoes.sigmaAdm, 2) + ' MPa'],
        ['n', String(nEl)]],
      passos: [
        ['Carga do usuário', 'P = m · g', n(r.entrada.m, 1) + ' · ' + n(G, 2), n(P, 1) + ' N'],
        ['Peso próprio da cadeira', 'W = Σ (V · ρ) · g', n(r.massa.total, 3) + ' · ' + n(G, 2), n(Wpeso, 1) + ' N'],
        ['Carga vertical total', 'P + W', n(P, 1) + ' + ' + n(Wpeso, 1), n(P + Wpeso, 1) + ' N']
      ]
    }
  });

  /* 1. DCL do conjunto */
  out += card({
    largo: true,
    titulo: '1. Diagrama de corpo livre do conjunto',
    simples: 'a pessoa empurra o assento para baixo; o chão empurra as pernas para cima com a mesma força total.',
    cenario: 'Vista frontal da cadeira inteira. A carga <strong>P</strong> e o peso próprio ' +
      '<strong>W</strong> descem sobre a superfície do assento, e as reações sobem do piso em ' +
      'cada perna. O encosto aparece em traço leve porque aqui ele é contexto: massa, não ' +
      'estrutura verificada.',
    figura: dclSVG(r, dims),
    nota: 'Vista frontal. A laje do assento usa espessura mínima de leitura, para continuar visível na escala do desenho.',
    formula: `ΣFz = 0   →   ${nEl === 4 ? 'R₁ + R₂ + R₃ + R₄' : 'R'} = P + W\n` +
      `N_perna = P/n ± P·e/(2·(L−t))\nNeste caso: Nmáx = ${n(r.forcas.Nmax, 0)} N   Nmín = ${n(r.forcas.Nmin, 0)} N`,
    leitura: 'A reação maior fica do lado em que a carga está aplicada. Com e = ' + n(e / 10, 1) +
      ' cm e L = ' + n(L / 10, 1) + ' cm, a diferença entre as pernas é de <strong>' +
      n(r.forcas.dN, 0) + ' N</strong>, cerca de ' + n((r.forcas.dN / r.forcas.Nmedio) * 100, 0) +
      '% da reação média. ' + (r.forcas.levantou
        ? '<span class="graf-ruim">A excentricidade levanta as pernas do lado oposto.</span>'
        : 'Nenhuma perna perde contato com o piso.'),
    detalhe: {
      simbolos: [['P', n(P, 1) + ' N'], ['W', n(Wpeso, 1) + ' N'], ['e', n(e, 1) + ' mm'],
        ['L', n(L, 1) + ' mm'], ['H', n(H, 1) + ' mm'], ['Nmed', n(r.forcas.Nmedio, 1) + ' N'],
        ['dN', n(r.forcas.dN, 1) + ' N'], ['Nmax', n(r.forcas.Nmax, 1) + ' N'],
        ['Nmin', n(r.forcas.Nmin, 1) + ' N']],
      passos: [
        ['Carga do usuário', 'P = m · g', n(r.entrada.m, 1) + ' · ' + n(G, 2), n(P, 1) + ' N'],
        ['Reação média por perna', 'Nmed = P / n', n(P, 1) + ' / ' + nEl, n(r.forcas.Nmedio, 2) + ' N'],
        ['Parcela da excentricidade', 'dN = P · e / (2 · (L − t))',
          n(P, 1) + ' · ' + n(e, 0) + ' / (2 · ' + n(r.forcas.bracoBinario, 1) + ')', n(r.forcas.dN, 2) + ' N'],
        ['Reação máxima', 'Nmax = Nmed + dN',
          n(r.forcas.Nmedio, 2) + ' + ' + n(r.forcas.dN, 2), n(r.forcas.Nmax, 2) + ' N'],
        ['Reação mínima', 'Nmin = Nmed − dN',
          n(r.forcas.Nmedio, 2) + ' − ' + n(r.forcas.dN, 2), n(r.forcas.Nmin, 2) + ' N'],
        ['Conferência do equilíbrio', 'ΣR = n · Nmed', nEl + ' · ' + n(r.forcas.Nmedio, 2),
          n(nEl * r.forcas.Nmedio, 2) + ' N ≈ P']
      ]
    }
  });

  /* 2. Assento isolado */
  out += card({
    largo: true,
    titulo: '2. Reações no assento, com a placa isolada',
    simples: 'as pernas empurram o assento para cima. Cada ponta de perna vira um apoio da placa, e a carga cai fora do centro.',
    cenario: 'Existem dois conjuntos de reações, iguais e opostas: o do piso empurrando as ' +
      'pernas, e o das pernas empurrando o assento. Isolando a placa vista de cima, as quatro ' +
      'pontas das pernas viram os apoios dela. É este desenho que justifica as duas verificações ' +
      'de assento: a beirada em <strong>balanço</strong> e o <strong>vão</strong> entre apoios.',
    figura: assentoSVG(r),
    nota: 'Vista superior da placa. Vermelho é o balanço da beirada; roxo é o vão entre apoios.',
    formula: nEl === 4
      ? `balanço:  a = ${n(a, 1)} mm   →   M = P · a\nvão:       L = ${n(L, 0)} mm   →   q = P/b², M = q·L²/16`
      : `balanço:  a = ${n(a, 1)} mm   →   M = P · a\nsem vão: no pedestal a placa engasta na coluna`,
    leitura: nEl === 4
      ? 'Os quatro apoios são as pontas das pernas. A carga cai ' + n(e / 10, 1) +
        ' cm à direita do centro, o que carrega mais o par direito e menos o esquerdo — é a ' +
        'mesma diferença de ' + n(r.forcas.dN, 0) + ' N vista no cartão 1. A beirada trabalha ' +
        'em balanço e o meio trabalha entre apoios: duas contas diferentes sobre a mesma placa.'
      : 'No pedestal existe um apoio só, no centro. Toda a beirada trabalha em balanço em ' +
        'relação à coluna, e não há vão entre apoios porque não há duas linhas de apoio. ' +
        'Por isso a verificação de vão não aparece.',
    detalhe: {
      simbolos: [['b', n(r.assento.b, 0) + ' mm'], ['a', n(a, 1) + ' mm'],
        ['L', n(L, 0) + ' mm'], ['e', n(e, 1) + ' mm'],
        ['Nmax', n(r.forcas.Nmax, 1) + ' N'], ['Nmin', n(r.forcas.Nmin, 1) + ' N']],
      passos: [
        ['Apoios da placa', 'pontas das pernas', nEl === 1 ? '1 apoio central' : '4 apoios nos cantos',
          nEl === 1 ? 'reação R = ' + n(P, 0) + ' N' : 'iguais e opostas às do piso'],
        ['Balanço da beirada', 'a = folga além do apoio', n(a, 1) + ' mm', n(a / 10, 1) + ' cm'],
        ['Momento no balanço', 'M = P · a', n(P, 1) + ' · ' + n(a, 1), n(r.assento.M, 1) + ' N·mm'],
        ['Vão entre apoios', nEl === 4 ? 'L entre pernas' : 'não existe',
          nEl === 4 ? n(L, 0) + ' mm' : '—', nEl === 4 ? n(L / 10, 1) + ' cm' : 'apoio único'],
        ['Pressão sobre a placa', 'q = P / b²', n(P, 1) + ' / ' + n(r.assento.b, 0) + '²',
          nEl === 4 ? r.assentoVao.q.toFixed(6) + ' N/mm²' : '—']
      ]
    }
  });

  /* 3. Reações no piso */
  const itensReacao = nEl === 4
    ? [{ rotulo:'Pernas 1 e 2', sub:'lado oposto', valor:r.forcas.Nmin,
         valorTexto:n(r.forcas.Nmin, 0) + ' N', cor:C.roxo },
       { rotulo:'Pernas 3 e 4', sub:'lado carregado', valor:r.forcas.Nmax,
         valorTexto:n(r.forcas.Nmax, 0) + ' N', cor:C.verde }]
    : [{ rotulo:'Pedestal', valor:P, valorTexto:n(P, 0) + ' N', cor:C.verde }];

  out += card({
    titulo: '3. Distribuição das reações no piso',
    simples: 'a perna do lado em que a pessoa senta recebe bem mais carga que a do lado oposto.',
    cenario: nEl === 4
      ? 'As pernas não recebem a mesma carga. A excentricidade desloca o centro de carga e cria um binário: duas pernas ficam mais carregadas, duas menos.'
      : 'No pedestal, toda a carga passa por uma única coluna. A excentricidade não redistribui a força normal, mas gera momento.',
    figura: graficoBarras({ itens: itensReacao, legendaY: 'Reação (N)', alt: 'reacoes' }),
    formula: nEl === 4
      ? 'N = P/n ± P·e/(2·(L−t)) = ' + n(r.forcas.Nmedio, 0) + ' ± ' + n(r.forcas.dN, 0)
      : 'N = P = ' + n(P, 0) + ' N',
    leitura: 'É essa diferença que justifica verificar a perna mais carregada, não a média. Todo ' +
      'o cálculo seguinte usa <strong>N = ' + n(r.forcas.Nmax, 0) + ' N</strong>.',
    detalhe: {
      simbolos: [['n', String(nEl)], ['Nmed', n(r.forcas.Nmedio, 1) + ' N'],
        ['dN', n(r.forcas.dN, 1) + ' N'], ['Nmax', n(r.forcas.Nmax, 1) + ' N'],
        ['Nmin', n(r.forcas.Nmin, 1) + ' N']],
      passos: nEl === 4 ? [
        ['Dividir a carga entre as pernas', 'Nmed = P / 4', n(P, 1) + ' / 4', n(r.forcas.Nmedio, 2) + ' N'],
        ['Calcular o acréscimo excêntrico', 'dN = P · e / (2 · (L − t))',
          n(P, 1) + ' · ' + n(e, 0) + ' / (2 · ' + n(r.forcas.bracoBinario, 1) + ')', n(r.forcas.dN, 2) + ' N'],
        ['Somar na perna carregada', 'Nmax = Nmed + dN',
          n(r.forcas.Nmedio, 2) + ' + ' + n(r.forcas.dN, 2), n(r.forcas.Nmax, 2) + ' N'],
        ['Subtrair na perna oposta', 'Nmin = Nmed − dN',
          n(r.forcas.Nmedio, 2) + ' − ' + n(r.forcas.dN, 2), n(r.forcas.Nmin, 2) + ' N']
      ] : [['Toda a carga em uma coluna', 'N = P', n(P, 1), n(P, 2) + ' N']]
    }
  });

  /* 4. Esforços na perna */
  out += card({
    titulo: '4. Esforços na perna',
    simples: 'a carga fora do centro empurra o topo da perna para o lado. Isso vira uma força horizontal e um esforço de entortar.',
    cenario: 'O momento excêntrico é representado por uma força horizontal equivalente ' +
      '<strong>F</strong> no nível do assento, com a perna engastada na base e giro livre no topo.',
    formula: `F = M_crít / H = ${n(Mcrit, 0)} / ${n(H, 0)} = ${n(Fh, 2)} N\n` +
      `N(y) = −${n(Nperna, 0)} N        (compressão, constante)\n` +
      `V(y) = F = ${n(Fh, 2)} N\nM(y) = F·(H − y)   →   M(0) = ${n(Mcrit, 0)} N·mm`,
    leitura: 'O peso próprio já está incluído no esforço normal (peso total da cadeira ÷ n); a perna sozinha pesa ' +
      n(r.massa.pernas * G, 1) + ' N, cerca de ' + n((r.massa.pernas * G / P) * 100, 1) + '% de P.',
    detalhe: {
      simbolos: [['Mcrit', n(Mcrit, 0) + ' N·mm'], ['F', n(Fh, 2) + ' N'],
        ['H', n(H, 1) + ' mm'], ['Nmax', n(Nperna, 1) + ' N'], ['V', n(Fh, 2) + ' N'],
        ['M', n(Mcrit, 0) + ' N·mm']],
      passos: [
        ['Momento crítico na base', 'Mcrit = P · e / n', n(P, 1) + ' · ' + n(e, 0) + ' / ' + nEl, n(Mcrit, 2) + ' N·mm'],
        ['Força horizontal equivalente', 'F = Mcrit / H', n(Mcrit, 2) + ' / ' + n(H, 0), n(Fh, 3) + ' N'],
        ['Verificação do momento na base', 'M(0) = F · H', n(Fh, 3) + ' · ' + n(H, 0), n(Fh * H, 2) + ' N·mm'],
        ['Esforço normal constante', 'N(y) = −Nmax', '−' + n(Nperna, 1), n(Nperna, 1) + ' N em toda a altura']
      ]
    }
  });

  /* 4.1 N */
  out += card({
    titulo: '4.1 Esforço normal (N)',
    simples: 'a perna está apertada de cima para baixo, igual do começo ao fim.',
    cenario: 'Compressão pura, constante ao longo da perna.',
    figura: graficoLinha({
      xmin: 0, xmax: H, ymin: -Nperna * 1.2, ymax: 0,
      series: [{ f: () => -Nperna, cor: C.azul, area: true }],
      marcas: [{ x: 0, y: -Nperna, rotulo: 'N = ' + n(Nperna, 0) + ' N' }],
      legendaX: 'y a partir do piso (mm)', legendaY: 'N (N)', alt: 'esforco normal'
    }),
    leitura: 'A seção está inteira comprimida. É essa parcela que entra depois na soma com a flexão.',
    detalhe: {
      simbolos: [['Nmax', n(Nperna, 1) + ' N'], ['y', '0 a ' + n(H, 0) + ' mm']],
      passos: [
        ['Reação máxima na perna', 'Nmax = P/n + P·e/(2·(L−t))',
          n(r.forcas.Nmedio, 2) + ' + ' + n(r.forcas.dN, 2), n(Nperna, 2) + ' N'],
        ['Valor em qualquer altura', 'N(y) = −Nmax', '−' + n(Nperna, 2),
          'constante de y = 0 a y = ' + n(H, 0) + ' mm']
      ]
    }
  });

  /* 4.2 V */
  out += card({
    titulo: '4.2 Esforço cortante (V)',
    simples: 'o topo da perna é empurrado para o lado com a mesma força em toda a altura.',
    cenario: 'Uma única força transversal na ponta, então o cortante não varia com a altura.',
    figura: graficoLinha({
      xmin: 0, xmax: H, ymin: -Fh * 1.4, ymax: Fh * 1.4,
      series: [{ f: () => Fh, cor: C.vermelho, area: true }],
      marcas: [{ x: H / 2, y: Fh, rotulo: 'V = ' + n(Fh, 2) + ' N' }],
      legendaX: 'y a partir do piso (mm)', legendaY: 'V (N)', alt: 'cortante na perna'
    }),
    leitura: 'O cortante é a própria força horizontal equivalente. Ele não entra na tensão ' +
      'normal, mas é a causa do momento que cresce até a base.',
    detalhe: {
      simbolos: [['V', n(Fh, 2) + ' N'], ['F', n(Fh, 2) + ' N']],
      passos: [
        ['Força horizontal equivalente', 'F = Mcrit / H', n(Mcrit, 2) + ' / ' + n(H, 0), n(Fh, 3) + ' N'],
        ['Cortante em qualquer altura', 'V(y) = F', n(Fh, 3), 'constante ao longo da perna']
      ]
    }
  });

  /* 4.3 M */
  out += card({
    titulo: '4.3 Momento fletor (M)',
    simples: 'o esforço de entortar é zero no topo e máximo onde a perna encontra o chão.',
    cenario: 'O momento cresce linearmente do topo até o engastamento, onde atinge o valor crítico.',
    figura: graficoLinha({
      xmin: 0, xmax: H, ymin: 0, ymax: Mcrit * 1.22,
      series: [{ f: Mperna, cor: C.roxo, area: true }],
      marcas: [{ x: 0, y: Mcrit, rotulo: 'M = ' + n(Mcrit, 0) + ' N·mm' }],
      legendaX: 'y a partir do piso (mm)', legendaY: 'M (N·mm)', alt: 'momento na perna'
    }),
    leitura: 'Nulo no topo, máximo na base: é por isso que a <strong>seção crítica fica no engastamento</strong>.',
    detalhe: {
      simbolos: [['M', n(Mcrit, 0) + ' N·mm no máximo'], ['F', n(Fh, 2) + ' N'],
        ['H', n(H, 1) + ' mm'], ['y', '0 a ' + n(H, 0) + ' mm']],
      passos: [
        ['Expressão geral', 'M(y) = F · (H − y)', 'F = ' + n(Fh, 3) + ' N', 'reta decrescente'],
        ['No engastamento', 'M(0) = F · H', n(Fh, 3) + ' · ' + n(H, 0), n(Mcrit, 2) + ' N·mm'],
        ['No topo', 'M(H) = 0', '—', '0 N·mm']
      ]
    }
  });

  /* 4.4 Linha elástica */
  out += card({
    titulo: '4.4 Linha elástica da perna',
    simples: 'é o quanto o topo da perna se desloca para o lado. É o "balanço" que a pessoa sente ao sentar.',
    cenario: 'Flecha lateral como console com carga concentrada na ponta.',
    figura: graficoLinha({
      xmin: 0, xmax: H, ymin: 0, ymax: defPerna(H) * 1.25,
      series: [{ f: defPerna, cor: C.verde, area: true }],
      marcas: [{ x: H, y: defPerna(H), rotulo: 'δ = ' + n(defPerna(H), 3) + ' mm' }],
      legendaX: 'y a partir do piso (mm)', legendaY: 'δ (mm)', alt: 'linha elastica'
    }),
    formula: `δ(y) = F·y²·(3H − y) / (6·E·I)\nδ(H) = F·H³ / (3·E·I) = ${n(defPerna(H), 3)} mm`,
    leitura: 'A flecha cresce com o cubo do comprimento: dobrar a altura multiplica o ' +
      'deslocamento por oito. Contra ' + n(H, 0) + ' mm de altura, ela representa ' +
      n((defPerna(H) / H) * 100, 2) + '%.',
    detalhe: {
      simbolos: [['delta', n(defPerna(H), 3) + ' mm no topo'], ['F', n(Fh, 2) + ' N'],
        ['E', n(E, 0) + ' MPa'], ['I', n(I, 0) + ' mm⁴'], ['H', n(H, 1) + ' mm']],
      passos: [
        ['Rigidez à flexão', 'E · I', n(E, 0) + ' · ' + n(I, 0), n(E * I, 0) + ' N·mm²'],
        ['Flecha na ponta', 'δ = F · H³ / (3 · E · I)',
          n(Fh, 3) + ' · ' + n(H, 0) + '³ / (3 · ' + n(E * I, 0) + ')', n(defPerna(H), 4) + ' mm'],
        ['Flecha relativa à altura', 'δ / H', n(defPerna(H), 4) + ' / ' + n(H, 0),
          n((defPerna(H) / H) * 100, 2) + '%']
      ]
    }
  });

  /* 5. Assento em balanço */
  out += card({
    titulo: '5. Assento em balanço',
    simples: 'a beirada do assento avança além do apoio. Sentar ali é o pior caso, porque o giro é máximo.',
    cenario: 'O assento avança além do apoio e trabalha como placa em balanço. Considera-se ' +
      'uma faixa da largura do assento, com a carga na borda livre — a posição mais desfavorável.',
    formula: `a = ${n(a, 1)} mm        b = ${n(r.assento.b, 0)} mm        h = ${n(r.assento.h, 1)} mm\n` +
      `V(x) = P = ${n(P, 0)} N\nM(x) = P·(a − x)   →   M(0) = ${n(r.assento.M, 0)} N·mm`,
    leitura: 'Tensão no engaste: ' + n(r.assento.sigma, 3) + ' MPa, ou ' +
      n(r.assento.utilizacao * 100, 1) + '% da admissível. Flecha de ' +
      n(r.assento.flecha, 3) + ' mm contra limite de ' + n(r.assento.flechaLimite, 3) + ' mm.',
    detalhe: {
      simbolos: [['a', n(a, 1) + ' mm'], ['b', n(r.assento.b, 0) + ' mm'],
        ['h', n(r.assento.h, 1) + ' mm'], ['M', n(r.assento.M, 0) + ' N·mm'],
        ['Wmod', n(r.assento.W, 0) + ' mm³'], ['Ia', n(Ia, 0) + ' mm⁴'],
        ['sigma', n(r.assento.sigma, 3) + ' MPa'], ['delta', n(r.assento.flecha, 3) + ' mm']],
      passos: [
        ['Momento no engaste', 'Ma = P · a', n(P, 1) + ' · ' + n(a, 1), n(r.assento.M, 2) + ' N·mm'],
        ['Módulo resistente da faixa', 'Wa = b · h² / 6',
          n(r.assento.b, 0) + ' · ' + n(r.assento.h, 1) + '² / 6', n(r.assento.W, 2) + ' mm³'],
        ['Tensão de flexão', 'σ = Ma / Wa',
          n(r.assento.M, 2) + ' / ' + n(r.assento.W, 2), n(r.assento.sigma, 3) + ' MPa'],
        ['Utilização à tensão', 'σ / σ_adm',
          n(r.assento.sigma, 3) + ' / ' + n(r.tensoes.sigmaAdm, 3), n(r.assento.utilizacao * 100, 1) + '%'],
        ['Inércia da faixa', 'Ia = b · h³ / 12',
          n(r.assento.b, 0) + ' · ' + n(r.assento.h, 1) + '³ / 12', n(Ia, 2) + ' mm⁴'],
        ['Flecha na borda', 'δ = P · a³ / (3 · E · Ia)',
          n(P, 1) + ' · ' + n(a, 1) + '³ / (3 · ' + n(E, 0) + ' · ' + n(Ia, 2) + ')',
          n(r.assento.flecha, 4) + ' mm'],
        ['Limite de flecha', 'a / ' + CADEIRA.divisorFlechaAssento,
          n(a, 1) + ' / ' + CADEIRA.divisorFlechaAssento, n(r.assento.flechaLimite, 4) + ' mm']
      ]
    }
  });

  /* 5.1 Cortante no assento */
  out += card({
    titulo: '5.1 Cortante no assento',
    simples: 'a força vertical que o assento sente na beirada é a carga inteira da pessoa.',
    cenario: 'Só existe uma carga concentrada na ponta, então o cortante é constante em todo o balanço.',
    figura: graficoLinha({
      xmin: 0, xmax: a, ymin: 0, ymax: P * 1.3,
      series: [{ f: () => P, cor: C.vermelho, area: true }],
      marcas: [{ x: a / 2, y: P, rotulo: 'V = ' + n(P, 0) + ' N' }],
      legendaX: 'x a partir do apoio (mm)', legendaY: 'V (N)', alt: 'cortante no assento'
    }),
    leitura: 'O valor é a carga inteira do usuário, porque não há outra força vertical no trecho.',
    detalhe: {
      simbolos: [['V', n(P, 1) + ' N'], ['P', n(P, 1) + ' N'], ['x', '0 a ' + n(a, 0) + ' mm']],
      passos: [
        ['Cortante no trecho', 'V(x) = P', n(P, 1), n(P, 2) + ' N'],
        ['Integração do cortante', 'M(x) = ∫V dx = P · (a − x)',
          n(P, 1) + ' · (' + n(a, 0) + ' − x)', 'gera o diagrama de momento']
      ]
    }
  });

  /* 5.2 Momento no assento */
  out += card({
    titulo: '5.2 Momento no assento',
    simples: 'o giro é máximo onde o assento encontra o apoio e zero na beirada livre.',
    cenario: 'O momento cai linearmente do engaste até zero na borda livre.',
    figura: graficoLinha({
      xmin: 0, xmax: a, ymin: 0, ymax: r.assento.M * 1.2,
      series: [{ f: Mbal, cor: C.roxo, area: true }],
      marcas: [{ x: 0, y: r.assento.M, rotulo: 'M = ' + n(r.assento.M, 0) + ' N·mm' }],
      legendaX: 'x a partir do apoio (mm)', legendaY: 'M (N·mm)', alt: 'momento no assento'
    }),
    leitura: 'O engaste é a seção crítica do assento. É o ponto mais distante do apoio, na beirada.',
    detalhe: {
      simbolos: [['M', n(r.assento.M, 0) + ' N·mm'], ['P', n(P, 1) + ' N'],
        ['a', n(a, 1) + ' mm'], ['x', '0 a ' + n(a, 0) + ' mm']],
      passos: [
        ['Expressão geral', 'M(x) = P · (a − x)', n(P, 1) + ' · (' + n(a, 0) + ' − x)', 'reta decrescente'],
        ['No apoio', 'M(0) = P · a', n(P, 1) + ' · ' + n(a, 1), n(r.assento.M, 2) + ' N·mm'],
        ['Na borda livre', 'M(a) = 0', '—', '0 N·mm']
      ]
    }
  });

  /* 5.3 Flecha do assento */
  out += card({
    titulo: '5.3 Flecha do assento',
    simples: 'é o quanto a beirada afunda. A linha tracejada é o limite aceitável.',
    cenario: 'A curva verde é a flecha real; a tracejada vermelha é o limite de serviço adotado.',
    figura: graficoLinha({
      xmin: 0, xmax: a, ymin: 0,
      ymax: Math.max(defBal(a), r.assento.flechaLimite) * 1.25,
      series: [
        { f: defBal, cor: C.verde, area: true },
        { f: () => r.assento.flechaLimite, cor: C.vermelho, tracejada: true }
      ],
      marcas: [{ x: a, y: defBal(a), rotulo: 'δ = ' + n(defBal(a), 3) + ' mm' }],
      legendaX: 'x a partir do apoio (mm)', legendaY: 'δ (mm)', alt: 'flecha do assento'
    }),
    leitura: 'A flecha é de ' + n(defBal(a), 3) + ' mm contra limite de ' +
      n(r.assento.flechaLimite, 3) + ' mm — ' + n(r.assento.utilizacaoFlecha * 100, 1) + '% do permitido.',
    detalhe: {
      simbolos: [['delta', n(defBal(a), 3) + ' mm'], ['P', n(P, 1) + ' N'],
        ['E', n(E, 0) + ' MPa'], ['Ia', n(Ia, 0) + ' mm⁴']],
      passos: [
        ['Flecha na borda', 'δ = P · a³ / (3 · E · Ia)',
          n(P, 1) + ' · ' + n(a, 1) + '³ / (3 · ' + n(E, 0) + ' · ' + n(Ia, 0) + ')', n(defBal(a), 4) + ' mm'],
        ['Limite de serviço', 'a / ' + CADEIRA.divisorFlechaAssento,
          n(a, 0) + ' / ' + CADEIRA.divisorFlechaAssento, n(r.assento.flechaLimite, 4) + ' mm'],
        ['Utilização', 'δ / δ_lim', n(defBal(a), 4) + ' / ' + n(r.assento.flechaLimite, 4),
          n(r.assento.utilizacaoFlecha * 100, 1) + '%']
      ]
    }
  });

  /* 6. Assento entre apoios */
  if (r.assentoVao) {
    const q = r.assentoVao.q, Lv = r.assentoVao.L;
    const Mvao = x => (q * x * (Lv - x)) / 2;
    const Vvao = x => q * (Lv / 2 - x);
    const Mmax = (q * Lv * Lv) / 8;

    out += card({
      titulo: '6. Assento entre apoios',
      simples: 'entre as duas fileiras de pernas o assento funciona como uma ponte. Ele afunda e racha no meio.',
      cenario: 'Entre as pernas o assento trabalha como faixa biapoiada sob pressão uniforme do ' +
        'usuário. O modelo de faixa é o mais conservador.',
      formula: `q = P/b² = ${n(P, 0)}/${n(r.assento.b, 0)}² = ${q.toFixed(6)} N/mm²\n` +
        `M(x) = q·x·(L − x)/2   →   M(L/2) = q·L²/8 = ${n(Mmax, 2)} N·mm/mm\n` +
        `M adotado = q·L²/16 = ${n(r.assentoVao.M, 2)} N·mm/mm`,
      leitura: 'Tensão resultante: ' + n(r.assentoVao.sigma, 3) + ' MPa (' +
        n(r.assentoVao.utilizacao * 100, 1) + '% da admissível). Flecha de ' +
        n(r.assentoVao.flecha, 3) + ' mm contra limite de ' + n(r.assentoVao.flechaLimite, 3) + ' mm.',
      detalhe: {
        simbolos: [['q', q.toFixed(6) + ' N/mm²'], ['L', n(Lv, 0) + ' mm'],
          ['b', n(r.assento.b, 0) + ' mm'], ['M', n(r.assentoVao.M, 2) + ' N·mm/mm adotado'],
          ['h', n(r.assentoVao.h, 1) + ' mm']],
        passos: [
          ['Pressão uniforme', 'q = P / b²', n(P, 1) + ' / ' + n(r.assento.b, 0) + '²', q.toFixed(6) + ' N/mm²'],
          ['Momento da faixa biapoiada', 'M = q · L² / 8',
            q.toFixed(6) + ' · ' + n(Lv, 0) + '² / 8', n(Mmax, 3) + ' N·mm/mm'],
          ['Momento adotado no cálculo', 'M = q · L² / 16',
            q.toFixed(6) + ' · ' + n(Lv, 0) + '² / 16', n(r.assentoVao.M, 3) + ' N·mm/mm'],
          ['Razão entre adotado e faixa', 'M_adot / M_faixa',
            n(r.assentoVao.M, 3) + ' / ' + n(Mmax, 3), n((r.assentoVao.M / Mmax) * 100, 1) + '%']
        ]
      }
    });

    out += card({
      titulo: '6.1 Cortante no vão',
      simples: 'a força de cisalhamento é máxima nos apoios e zero no meio do vão.',
      cenario: 'Antissimétrico: máximo positivo em um apoio, máximo negativo no outro, zero no meio.',
      figura: graficoLinha({
        xmin: 0, xmax: Lv,
        ymin: -Math.abs(Vvao(0)) * 1.3, ymax: Math.abs(Vvao(0)) * 1.3,
        series: [{ f: Vvao, cor: C.vermelho, area: true }],
        legendaX: 'x entre apoios (mm)', legendaY: 'V (N/mm)', alt: 'cortante do vao'
      }),
      leitura: 'As reações das pernas aparecem como picos nos extremos. O esforço cai linearmente até anular no meio.',
      detalhe: {
        simbolos: [['V', n(Math.abs(Vvao(0)), 4) + ' N/mm no apoio'],
          ['q', q.toFixed(6) + ' N/mm²'], ['L', n(Lv, 0) + ' mm']],
        passos: [
          ['Cortante nos apoios', 'V(0) = q · L / 2',
            q.toFixed(6) + ' · ' + n(Lv, 0) + ' / 2', n(Math.abs(Vvao(0)), 4) + ' N/mm'],
          ['Cortante no meio', 'V(L/2) = 0', '—', '0 N/mm']
        ]
      }
    });

    out += card({
      titulo: '6.2 Momento no vão',
      simples: 'o esforço de entortar é máximo no meio do vão e zero nos apoios.',
      cenario: 'Parabólico, com pico no meio do vão. A linha tracejada marca o momento efetivamente usado no cálculo.',
      figura: graficoLinha({
        xmin: 0, xmax: Lv, ymin: 0, ymax: Mmax * 1.25,
        series: [{ f: Mvao, cor: C.roxo, area: true }],
        linhasRef: [{ y: r.assentoVao.M, rotulo: 'adotado qL²/16', cor: C.ambar }],
        marcas: [{ x: Lv / 2, y: Mmax, rotulo: 'qL²/8 = ' + n(Mmax, 2) }],
        legendaX: 'x entre apoios (mm)', legendaY: 'M (N·mm/mm)', alt: 'momento do vao'
      }),
      leitura: 'O cálculo usa <strong>' + n((r.assentoVao.M / Mmax) * 100, 0) + '%</strong> do ' +
        'valor da faixa, porque a placa redistribui a carga — a solução de placa dá cerca de ' +
        '0,0479·q·L², entre os dois.',
      detalhe: {
        simbolos: [['M', n(Mmax, 3) + ' N·mm/mm no pico'], ['q', q.toFixed(6) + ' N/mm²'],
          ['L', n(Lv, 0) + ' mm']],
        passos: [
          ['Momento no meio do vão', 'M = q · L² / 8',
            q.toFixed(6) + ' · ' + n(Lv, 0) + '² / 8', n(Mmax, 3) + ' N·mm/mm'],
          ['Momento adotado', 'M = q · L² / 16',
            q.toFixed(6) + ' · ' + n(Lv, 0) + '² / 16', n(r.assentoVao.M, 3) + ' N·mm/mm'],
          ['Referência de placa real', 'M ≈ 0,0479 · q · L²',
            '0,0479 · ' + q.toFixed(6) + ' · ' + n(Lv, 0) + '²',
            n(0.0479 * q * Lv * Lv, 3) + ' N·mm/mm']
        ]
      }
    });
  }

  /* 7. Interação N–M */
  const Nadm = A * r.tensoes.sigmaAdm, Madm = W * r.tensoes.sigmaAdm;
  const uN = r.forcas.Nmax / Nadm, uM = Mcrit / Madm;

  out += card({
    titulo: '7. Interação N–M na seção',
    simples: 'a perna sofre dois esforços ao mesmo tempo: aperto e entortamento. A soma dos dois não pode passar de 100%.',
    cenario: 'Compressão e flexão atuam juntas. A verificação soma as duas parcelas, o que ' +
      'equivale a uma fronteira linear no plano normal–momento.',
    figura: graficoLinha({
      xmin: 0, xmax: 1.2, ymin: 0, ymax: 1.2,
      series: [{ f: x => Math.max(0, 1 - x), cor: C.vermelho, espessura: 2.2 }],
      marcas: [{ x: uN, y: uM, rotulo: 'projeto', cor: C.verde }],
      legendaX: 'N / N_adm', legendaY: 'M / M_adm', alt: 'interacao N-M'
    }),
    formula: `N_adm = A·σ_adm = ${n(Nadm, 0)} N\nM_adm = W·σ_adm = ${n(Madm, 0)} N·mm\n` +
      `N/N_adm + M/M_adm = ${n(uN, 4)} + ${n(uM, 4)} = ${n(uN + uM, 4)}`,
    leitura: 'A soma vale <strong>' + n((uN + uM) * 100, 1) + '%</strong>. A reta de 100% é ' +
      'a fronteira: abaixo dela, aprovado. A flexão domina — a carga vertical sozinha usaria só ' +
      n(uN * 100, 1) + '% da seção.',
    detalhe: {
      simbolos: [['Nadm', n(Nadm, 1) + ' N'], ['Madm', n(Madm, 1) + ' N·mm'],
        ['A', n(A, 1) + ' mm²'], ['Wmod', n(W, 1) + ' mm³'],
        ['sigmaAdm', n(r.tensoes.sigmaAdm, 2) + ' MPa']],
      passos: [
        ['Capacidade à compressão', 'N_adm = A · σ_adm',
          n(A, 2) + ' · ' + n(r.tensoes.sigmaAdm, 3), n(Nadm, 1) + ' N'],
        ['Capacidade à flexão', 'M_adm = W · σ_adm',
          n(W, 1) + ' · ' + n(r.tensoes.sigmaAdm, 3), n(Madm, 1) + ' N·mm'],
        ['Parcela da compressão', 'N / N_adm', n(r.forcas.Nmax, 1) + ' / ' + n(Nadm, 1), n(uN, 4)],
        ['Parcela da flexão', 'M / M_adm', n(Mcrit, 1) + ' / ' + n(Madm, 1), n(uM, 4)],
        ['Soma das parcelas', 'N/N_adm + M/M_adm', n(uN, 4) + ' + ' + n(uM, 4),
          n(uN + uM, 4) + (uN + uM <= 1 ? ' — aprovado' : ' — reprovado')]
      ]
    }
  });

  /* 8. Flambagem */
  const lamD = r.flambagem.lambda;
  const lamMin = Math.max(5, lamD * 0.4), lamMax = Math.max(lamD * 2.4, 60);
  const Ncr = lam => (Math.PI * Math.PI * E * A) / (lam * lam);

  out += card({
    titulo: '8. Flambagem global',
    simples: 'peça fina e comprida enverga para o lado antes de esmagar. É o efeito canudo.',
    cenario: 'A carga crítica cai com o quadrado da esbeltez. A curva mostra a carga que faz a ' +
      'perna envergar; a horizontal é a carga aplicada.',
    figura: graficoLinha({
      xmin: lamMin, xmax: lamMax, ymin: 0,
      ymax: Math.max(Ncr(lamMin) * 1.1, r.forcas.Nmax * 3),
      series: [{ f: Ncr, cor: C.azul }],
      linhasRef: [
        { y: r.forcas.Nmax, rotulo: 'N = ' + n(r.forcas.Nmax, 0) + ' N', cor: C.verde },
        { y: r.flambagem.NcrAdm, rotulo: 'N_cr admissível', cor: C.ambar }
      ],
      marcas: [{ x: lamD, y: r.flambagem.Pcr, rotulo: 'λ = ' + n(lamD, 1) }],
      legendaX: 'índice de esbeltez λ = K·H/r', legendaY: 'Carga (N)', alt: 'flambagem'
    }),
    formula: `P_cr = π²·E·I/(K·H)² = ${n(r.flambagem.Pcr, 0)} N\n` +
      `λ = K·H/r = ${n(r.flambagem.K, 2)}·${n(H, 0)}/${n(r.secao.r, 3)} = ${n(lamD, 1)}\n` +
      `Utilização = N/P_cr,adm = ${n(r.flambagem.utilizacaoFlambagem * 100, 1)}%`,
    leitura: 'A perna trabalha a <strong>' + n(r.flambagem.utilizacaoFlambagem * 100, 1) +
      '%</strong> da carga crítica admissível. Com λ = ' + n(lamD, 1) + ', ela é curta e ' +
      'robusta: a flambagem não governa.',
    detalhe: {
      simbolos: [['lambda', n(lamD, 1)], ['K', n(r.flambagem.K, 2)],
        ['r', n(r.secao.r, 3) + ' mm'], ['Pcr', n(r.flambagem.Pcr, 1) + ' N'],
        ['CS', n(mat.CS, 2)], ['E', n(E, 0) + ' MPa'], ['I', n(I, 0) + ' mm⁴']],
      passos: [
        ['Índice de esbeltez', 'λ = K · H / r',
          n(r.flambagem.K, 2) + ' · ' + n(H, 0) + ' / ' + n(r.secao.r, 3), n(lamD, 2)],
        ['Carga crítica de Euler', 'Pcr = π² · E · I / (K·H)²',
          'π² · ' + n(E, 0) + ' · ' + n(I, 0) + ' / (' + n(r.flambagem.K, 2) + ' · ' + n(H, 0) + ')²',
          n(r.flambagem.Pcr, 1) + ' N'],
        ['Carga crítica admissível', 'Ncr,adm = Pcr / CS',
          n(r.flambagem.Pcr, 1) + ' / ' + n(mat.CS, 2), n(r.flambagem.NcrAdm, 1) + ' N'],
        ['Utilização', 'N / Ncr,adm', n(r.forcas.Nmax, 1) + ' / ' + n(r.flambagem.NcrAdm, 1),
          n(r.flambagem.utilizacaoFlambagem * 100, 1) + '%']
      ]
    }
  });

  /* 9. Tensões */
  out += card({
    titulo: '9. Composição das tensões',
    simples: 'a tensão é a força dividida pela área. Aperto e entortamento somam, e a soma é comparada ao limite do material.',
    cenario: 'A tensão normal tem duas parcelas: compressão simples (N/A) e flexão (M·c/I). ' +
      'A soma é comparada com a admissível do material.',
    figura: graficoBarras({
      itens: [
        { rotulo:'σ axial', valor:r.tensoes.sigmaAxial, valorTexto:n(r.tensoes.sigmaAxial, 2), cor:C.azul },
        { rotulo:'σ flexão', valor:r.tensoes.sigmaFlexao, valorTexto:n(r.tensoes.sigmaFlexao, 2), cor:C.roxo },
        { rotulo:'σ máxima', valor:r.tensoes.sigmaMax, valorTexto:n(r.tensoes.sigmaMax, 2), cor:C.ambar }
      ],
      linhasRef: [{ y: r.tensoes.sigmaAdm, rotulo: 'σ adm = ' + n(r.tensoes.sigmaAdm, 1) + ' MPa', cor: C.vermelho }],
      legendaY: 'Tensão (MPa)', alt: 'tensoes'
    }),
    formula: `σ = N/A + M·c/I = ${n(r.tensoes.sigmaAxial, 3)} + ${n(r.tensoes.sigmaFlexao, 3)} = ${n(r.tensoes.sigmaMax, 3)} MPa\n` +
      `σ_adm = σ_lim/CS = ${n(mat.sigmaLimite, 1)}/${n(mat.CS, 2)} = ${n(r.tensoes.sigmaAdm, 2)} MPa\n` +
      `Utilização = ${n(r.tensoes.utilizacao * 100, 1)}%`,
    leitura: 'A flexão responde por ' + n((r.tensoes.sigmaFlexao / r.tensoes.sigmaMax) * 100, 0) +
      '% da tensão total. O que dimensiona a perna é a excentricidade, não o peso do usuário.',
    detalhe: {
      simbolos: [['sigmaA', n(r.tensoes.sigmaAxial, 3) + ' MPa'],
        ['sigmaF', n(r.tensoes.sigmaFlexao, 3) + ' MPa'],
        ['sigma', n(r.tensoes.sigmaMax, 3) + ' MPa'],
        ['sigmaAdm', n(r.tensoes.sigmaAdm, 2) + ' MPa'], ['c', n(r.secao.c, 1) + ' mm']],
      passos: [
        ['Tensão axial', 'σa = N / A', n(r.forcas.Nmax, 1) + ' / ' + n(A, 2), n(r.tensoes.sigmaAxial, 3) + ' MPa'],
        ['Tensão de flexão', 'σf = M · c / I',
          n(Mcrit, 1) + ' · ' + n(r.secao.c, 1) + ' / ' + n(I, 1), n(r.tensoes.sigmaFlexao, 3) + ' MPa'],
        ['Tensão máxima', 'σ = σa + σf',
          n(r.tensoes.sigmaAxial, 3) + ' + ' + n(r.tensoes.sigmaFlexao, 3), n(r.tensoes.sigmaMax, 3) + ' MPa'],
        ['Tensão admissível', 'σ_adm = σ_lim / CS',
          n(mat.sigmaLimite, 1) + ' / ' + n(mat.CS, 2), n(r.tensoes.sigmaAdm, 3) + ' MPa'],
        ['Utilização', 'σ / σ_adm',
          n(r.tensoes.sigmaMax, 3) + ' / ' + n(r.tensoes.sigmaAdm, 3), n(r.tensoes.utilizacao * 100, 1) + '%']
      ]
    }
  });

  /* 10. Tombamento */
  if (r.estabilidade) {
    const Mt = P * r.estabilidade.e;
    const Me = (P + r.estabilidade.pesoCadeira) * r.estabilidade.braco;

    out += card({
      titulo: '10. Estabilidade ao tombamento',
      simples: 'a carga fora do centro tende a virar a cadeira. O peso próprio é o que segura ela no chão.',
      cenario: 'No pedestal, o peso próprio é o único elemento que resiste ao tombamento. A carga ' +
        'excêntrica empurra a resultante para fora do centro da base; o peso da cadeira a traz de volta.',
      figura: graficoBarras({
        itens: [
          { rotulo:'Tombamento', valor:Mt, valorTexto:n(Mt, 0), cor:C.vermelho },
          { rotulo:'Estabilizador', valor:Me, valorTexto:n(Me, 0), cor:C.verde }
        ],
        legendaY: 'Momento (N·mm)', alt: 'tombamento'
      }),
      formula: `M_tomb = P·e = ${n(P, 0)}·${n(r.estabilidade.e, 0)} = ${n(Mt, 0)} N·mm\n` +
        `M_estab = (P + W)·R = (${n(P, 0)} + ${n(r.estabilidade.pesoCadeira, 1)})·${n(r.estabilidade.braco, 1)} = ${n(Me, 0)} N·mm\n` +
        `Utilização = ${n(r.estabilidade.utilizacao * 100, 1)}%`,
      leitura: 'O braço resistente é o menor da base (' + n(r.estabilidade.braco, 1) + ' mm). Nas ' +
        'diagonais ele é maior, o que torna o resultado conservador. ' + (r.estabilidade.tombou
          ? '<span class="graf-ruim">A resultante cai fora da base: a cadeira tomba.</span>'
          : 'A cadeira permanece estável com margem de ' + n((1 - r.estabilidade.utilizacao) * 100, 0) + '%.'),
      detalhe: {
        simbolos: [['Mtomb', n(Mt, 1) + ' N·mm'], ['Mest', n(Me, 1) + ' N·mm'],
          ['R', n(r.estabilidade.braco, 1) + ' mm'], ['W', n(r.estabilidade.pesoCadeira, 1) + ' N'],
          ['e', n(r.estabilidade.e, 1) + ' mm']],
        passos: [
          ['Momento de tombamento', 'M_tomb = P · e',
            n(P, 1) + ' · ' + n(r.estabilidade.e, 0), n(Mt, 1) + ' N·mm'],
          ['Momento estabilizador', 'M_estab = (P + W) · R',
            '(' + n(P, 1) + ' + ' + n(r.estabilidade.pesoCadeira, 1) + ') · ' + n(r.estabilidade.braco, 1),
            n(Me, 1) + ' N·mm'],
          ['Utilização', 'M_tomb / M_estab', n(Mt, 1) + ' / ' + n(Me, 1),
            n(r.estabilidade.utilizacao * 100, 1) + '%']
        ]
      }
    });
  }

  /* 11. Quadro geral */
  const util = [
    { rotulo:'Tensão na perna', valor:r.tensoes.utilizacao * 100 },
    { rotulo:'Flambagem global', valor:r.flambagem.utilizacaoFlambagem * 100 }
  ];
  if (r.flambagemLocal) util.push({ rotulo:'Flambagem local', valor:r.flambagemLocal.utilizacao * 100 });
  util.push({ rotulo:'Assento — tensão', valor:r.assento.utilizacao * 100 });
  util.push({ rotulo:'Assento — flecha', valor:r.assento.utilizacaoFlecha * 100 });
  if (r.assentoVao) {
    util.push({ rotulo:'Vão — tensão', valor:r.assentoVao.utilizacao * 100 });
    util.push({ rotulo:'Vão — flecha', valor:r.assentoVao.utilizacaoFlecha * 100 });
  }
  if (r.estabilidade) util.push({ rotulo:'Tombamento', valor:r.estabilidade.utilizacao * 100 });

  const pior = util.reduce((x, y) => (y.valor > x.valor ? y : x));

  out += card({
    largo: true,
    titulo: '11. Quadro geral de utilização',
    simples: 'cada barra é uma verificação. Abaixo de 100% está aprovado. A barra mais alta é a que manda no projeto.',
    cenario: 'Cada barra é uma verificação independente. O valor é a razão entre solicitação e ' +
      'capacidade: abaixo de 100% está aprovado. A barra mais alta governa o dimensionamento.',
    figura: graficoBarrasH({ itens: util, alt: 'utilizacao' }),
    leitura: r.veredito.aprovado
      ? '<span class="graf-ok">Configuração aprovada.</span> A verificação mais solicitada é <strong>' +
        pior.rotulo + '</strong>, com ' + n(pior.valor, 1) + '%.'
      : '<span class="graf-ruim">Configuração reprovada.</span> ' + r.veredito.motivos.join(' '),
    detalhe: {
      simbolos: [['util', n(pior.valor, 1) + '% na verificação crítica']],
      passos: util.map(u => [u.rotulo, 'solicitação / capacidade', n(u.valor / 100, 4),
        n(u.valor, 1) + '%' + (u.valor > 100 ? ' — reprovado' : '')])
    }
  });

  /* Notas */
  out += '<section class="graf-card graf-card--largo"><div class="graf-card__topo">' +
    '<h2>Notas sobre os modelos</h2></div><p class="graf-cenario">' +
    'Os diagramas da perna adotam pórtico com binário horizontal: o momento excêntrico vira ' +
    'uma força equivalente no nível do assento, com a perna engastada na base. A ligação real ' +
    '(cola, parafuso ou encaixe) transmite parte do momento direto, o que reduziria o cortante ' +
    '— a hipótese adotada está do lado conservador.<br><br>' +
    'O peso próprio já está incluído no esforço normal (peso total da cadeira ÷ n). As pernas sozinhas pesam ' +
    n(r.massa.pernas * G, 1) + ' N, cerca de ' + n((r.massa.pernas * G / P) * 100, 1) +
    '% da carga do usuário.<br><br>' +
    'No assento entre apoios, o diagrama mostra o modelo de faixa biapoiada, com pico q·L²/8. ' +
    'O cálculo adota q·L²/16, apoiado na redistribuição bidimensional da placa. Ambas as soluções ' +
    'estão marcadas no gráfico.<br><br>' +
    'O encosto entra apenas como massa e geometria. A força horizontal de uma pessoa reclinada ' +
    'não é verificada neste modelo, e os postes do encosto não têm verificação de flexão.<br><br>' +
    'Não são representados diagramas de torção, porque o modelo não aplica momento torsor: a ' +
    'excentricidade é tratada em uma única direção.</p></section>';

  conteudo.innerHTML = out;
}

/* ---------- Menus ---------- */
function fecharMenus(){
  conteudo.querySelectorAll('.graf-menu__lista').forEach(l => { l.hidden = true; });
  conteudo.querySelectorAll('.graf-menu__botao').forEach(b => b.setAttribute('aria-expanded', 'false'));
}

conteudo.addEventListener('click', ev => {
  const btn = ev.target.closest('.graf-menu__botao');
  if (btn) {
    ev.stopPropagation();
    const lista = btn.parentElement.querySelector('.graf-menu__lista');
    const estavaFechado = lista.hidden;
    fecharMenus();
    lista.hidden = !estavaFechado;
    btn.setAttribute('aria-expanded', estavaFechado ? 'true' : 'false');
    return;
  }
  const item = ev.target.closest('.graf-menu__item');
  if (item) {
    fecharMenus();
    abrirModal(item.dataset.expandir);
  }
});

document.addEventListener('click', fecharMenus);
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') fecharMenus(); });

/* ---------- Modal ---------- */
function abrirModal(id){
  const op = CARDS.get(id);
  if (!op) return;

  tituloModal.textContent = op.titulo;

  let h = '';
  if (op.simples) h += `<p class="graf-simples"><strong>Em palavras simples:</strong> ${op.simples}</p>`;
  if (op.cenario) h += `<p class="graf-cenario">${op.cenario}</p>`;
  if (op.figura) h += `<div class="graf-figura graf-figura--ampla">${op.figura}</div>`;
  if (op.formula) h += `<pre class="graf-formula">${op.formula}</pre>`;
  if (op.detalhe) {
    h += blocoSimbolos(op.detalhe.simbolos);
    h += blocoPassos(op.detalhe.passos);
  }
  if (op.leitura) h += `<p class="graf-leitura">${op.leitura}</p>`;

  corpoModal.innerHTML = h;
  if (!modal.open) modal.showModal();
}

document.getElementById('graf-modal-fechar').addEventListener('click', () => modal.close());
modal.addEventListener('click', ev => { if (ev.target === modal) modal.close(); });

/* ---------- Topo ---------- */
document.getElementById('graf-imprimir').addEventListener('click', () => window.print());

document.getElementById('graf-voltar').addEventListener('click', () => {
  const origem = window.opener;

  if (origem && !origem.closed) {
    try { origem.focus(); } catch (e) { /* segue para o fechamento */ }
    window.close();
    window.setTimeout(() => { location.href = 'index.html'; }, 250);
    return;
  }

  location.href = 'index.html';
});