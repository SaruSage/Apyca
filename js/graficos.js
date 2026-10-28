/**
 * Pagina de graficos e diagramas.
 *
 * UNIDADES: t, H e assento chegam em CENTIMETROS; o solver trabalha em
 * MILIMETROS. unid=mm na URL desliga a conversao.
 *
 * ORIENTACAO DOS EIXOS — mesma convencao do chairModel.js
 *
 *   +X   direita da cadeira
 *   +Y   FRENTE — o lado para onde a pessoa sentada olha
 *   -Y   fundo  — o lado do encosto, onde y = 0
 *
 * O encosto e construido em y = 0. Logo a perna com sinalY NEGATIVO e uma
 * perna do FUNDO, e a com sinalY POSITIVO e da FRENTE. Todo rotulo desta
 * pagina segue essa convencao. A versao anterior tinha os rotulos invertidos
 * e mostrava a reacao das pernas do fundo como se fossem as da frente.
 *
 * APOIO DO ASSENTO — configuracao coplanar
 * O assento apoia no QUADRO: os quatro topos de perna nos cantos, mais as
 * quatro travessas no vao entre elas. Pernas e travessas tem o topo na mesma
 * cota z = H, de modo que o quadro e uma moldura plana e continua.
 * A abertura interna da moldura e Lv = L - 2b.
 *
 * CENTRO DE CARGA BIAXIAL
 * A excentricidade vem de ASSENTO via r.entrada, como FRACAO de meia
 * dimensao em cada eixo (fracX/fracY) e como deslocamento em mm (eX/eY).
 * O padrao e 0 nos dois eixos: carga centrada, reacoes iguais, sem casal.
 * Com 4 pernas a placa rigida distribui por flexao biaxial:
 *   Ni = Ptotal/4 ± P·eX/(2b) ± P·eY/(2b),  com b = L - t.
 *
 * MODELO DA PERNA: no quadro de quatro pernas o momento e resistido pelo
 * casal entre as pernas e a perna recebe apenas esforco axial. Os diagramas
 * de V, M e linha elastica aparecem como VERIFICACAO DE SENSIBILIDADE. No
 * pedestal o momento e real.
 */

import { HIPOTESES, CADEIRA, G } from './constantes.js';
import { calcular } from './solver.js';
import { construirBarras, dimensoesExternas, definirAssento,
         definirExcentricidade } from './chairModel.js';
import { definirTravessaSecao } from './travessas.js';

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

function rotuloExcentDirecao(pct, eixo){
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.05) return 'centro';
  const abs = Math.abs(pct);
  const numTxt = Math.abs(abs - Math.round(abs)) < 0.05
    ? String(Math.round(abs))
    : abs.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (eixo === 'y') {
    return numTxt + '% para ' + (pct > 0 ? 'a frente' : 'o fundo');
  }
  return numTxt + '% para a ' + (pct > 0 ? 'direita' : 'esquerda');
}

function rotuloCmDirecao(cm, eixo){
  if (!Number.isFinite(cm) || Math.abs(cm) < 0.005) return '0 cm (centro)';
  const abs = Math.abs(cm).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  });
  if (eixo === 'y') {
    return abs + ' cm para ' + (cm > 0 ? 'a frente' : 'o fundo');
  }
  return abs + ' cm para a ' + (cm > 0 ? 'direita' : 'esquerda');
}

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
 * Geometria real, configuracao COPLANAR: o topo das pernas e o topo das
 * travessas estao na MESMA cota z = H, e o assento apoia nos dois.
 *
 * A travessa e desenhada do topo da perna para BAIXO. Desenha-la para cima a
 * colocava acima do assento, e ela aparecia como barra flutuando sobre a laje.
 *
 * A carga se desloca no eixo X, que e o plano do papel. O deslocamento em Y
 * (para dentro/fora da vista) nao aparece aqui: ele diferencia as pernas da
 * frente e as de tras, e quem mostra isso e o cartao 2 e o cartao 3.
 *
 * QUAIS PERNAS APARECEM — esta vista e frontal, logo mostra as pernas da
 * FRENTE, que sao as de sinalY = +1: perna0 (esquerda) e perna1 (direita).
 * As pernas2 e 3 ficam em y = 0, atras do encosto, e nao sao visiveis. Usar
 * os indices 2 e 3 aqui desenhava a reacao das pernas do fundo com rotulo de
 * frente — o desenho mostrava o numero errado no lugar errado.
 */
function dclSVG(r, dims){
  const L = HIPOTESES.L, e = r.entrada.eX;
  const nEl = r.entrada.numPernas;
  const t = Math.min(r.entrada.t, CADEIRA.espessuraMaxima);
  const H = r.entrada.H;
  const temEncosto = r.entrada.comEncosto;
  const redonda = r.entrada.forma === 'redonda';
  const tAssMm = r.assento.h;
  const zAssTopo = H + tAssMm;
  const zTotal = zAssTopo + (temEncosto ? CADEIRA.alturaEncosto : 0);
  const zAbertura = zAssTopo + CADEIRA.alturaAbertura;
  const larg = 620, alt = 560, chao = 440, cx = larg / 2;
  const largAss = r.assento.b;

  /*
   * Escala: acomoda o que for mais largo — o assento ou o quadro de pernas —
   * com margem de 15%. Calcular a largura a partir do assento sozinho cortava
   * as pernas nas laterais quando o assento era menor que o quadro.
   */
  const largDesenho = Math.max(largAss, L) * 1.15;
  const s = Math.min(300 / zTotal, 250 / largDesenho);
  const yDe = z => chao - z * s;
  const yPernaTopo = yDe(H);

  /* Espessura de leitura: a laje real tem 20 mm, que na escala daria 7 px. */
  const hAssPx = Math.max(8, tAssMm * s);
  const yAssTopo = yPernaTopo - hAssPx;
  const yEncTopo = yDe(zTotal);
  const yEncBase = yDe(Math.min(zAbertura, zTotal));

  const meiaPerna = (L / 2) * s;
  const xPEsq = cx - meiaPerna, xPDir = cx + meiaPerna;
  const tw = Math.max(5, t * s);
  const meiaAss = (largAss / 2) * s;
  const xAssEsq = cx - meiaAss, xAssDir = cx + meiaAss;

  const P = r.forcas.P, Wc = r.massa.total * G;
  const Ptotal = P + Wc;
  const centrada = Math.abs(r.entrada.fracX) < 0.005 &&
                   Math.abs(r.entrada.fracY) < 0.005;

  /*
   * Comprimento de seta proporcional a RAIZ da forca, com piso.
   * Escala linear deixaria a seta de W com 4 px ao lado da de P e ela sumiria.
   */
  const compSeta = v => {
    const razao = Math.sqrt(Math.max(v, 0) / Math.max(Ptotal, 1));
    return 34 + 52 * razao;
  };

  let g = '';

  /* Piso */
  g += ln(24, chao, larg - 24, chao, C.eixo, null, 1.6);
  for (let i = 32; i < larg - 24; i += 14) {
    g += ln(i, chao, i - 9, chao + 9, C.grade, null, 1);
  }

  /* Encosto */
  if (temEncosto && yEncTopo < yAssTopo) {
    const xPostEsq = xAssEsq;
    const xPostDir = xAssDir - tw;
    const altPoste = yAssTopo - yEncTopo;
    g += `<rect x="${px(xPostEsq)}" y="${px(yEncTopo)}" width="${px(tw)}" ` +
      `height="${px(altPoste)}" fill="${C.azul}" fill-opacity="0.22" ` +
      `stroke="${C.azul}" stroke-opacity="0.6" stroke-width="1"/>`;
    g += `<rect x="${px(xPostDir)}" y="${px(yEncTopo)}" width="${px(tw)}" ` +
      `height="${px(altPoste)}" fill="${C.azul}" fill-opacity="0.22" ` +
      `stroke="${C.azul}" stroke-opacity="0.6" stroke-width="1"/>`;
    if (yEncBase < yAssTopo) {
      g += `<rect x="${px(xPostEsq + tw)}" y="${px(yEncTopo)}" ` +
        `width="${px(xPostDir - xPostEsq - tw)}" ` +
        `height="${px(yEncBase - yEncTopo)}" fill="${C.azul}" ` +
        `fill-opacity="0.09" stroke="${C.azul}" stroke-opacity="0.4" ` +
        `stroke-dasharray="4 4"/>`;
    }
  }

  /* Pernas / pedestal */
  if (nEl === 4) {
    g += `<rect x="${px(xPEsq)}" y="${px(yPernaTopo)}" width="${px(tw)}" ` +
      `height="${px(chao - yPernaTopo)}" fill="${C.azul}" ` +
      `fill-opacity="0.38" stroke="${C.azul}" stroke-width="1.4"/>`;
    g += `<rect x="${px(xPDir - tw)}" y="${px(yPernaTopo)}" width="${px(tw)}" ` +
      `height="${px(chao - yPernaTopo)}" fill="${C.azul}" ` +
      `fill-opacity="0.38" stroke="${C.azul}" stroke-width="1.4"/>`;
  } else {
    const hPe = Math.min(CADEIRA.coneAltura, H * 0.4);
    const yPe = yDe(hPe);
    const rBase = Math.max(tw, CADEIRA.coneRaioBase *
      (redonda ? 1 : CADEIRA.fracaoLadoPiramide) * s);
    g += `<polygon points="${px(cx - rBase)},${chao} ${px(cx + rBase)},${chao} ` +
      `${px(cx + tw / 2)},${px(yPe)} ${px(cx - tw / 2)},${px(yPe)}" ` +
      `fill="${C.azul}" fill-opacity="0.38" stroke="${C.azul}" stroke-width="1.4"/>`;
    g += `<rect x="${px(cx - tw / 2)}" y="${px(yPernaTopo)}" width="${px(tw)}" ` +
      `height="${px(yPe - yPernaTopo)}" fill="${C.azul}" ` +
      `fill-opacity="0.38" stroke="${C.azul}" stroke-width="1.4"/>`;
  }

  /* Travessa: topo coplanar ao topo da perna, corpo para baixo */
  if (nEl === 4 && r.travessas) {
    const hTv = Math.max(4, r.travessas.h * s);
    const xTvEsq = xPEsq + tw;
    const xTvDir = xPDir - tw;
    g += `<rect x="${px(xTvEsq)}" y="${px(yPernaTopo)}" ` +
      `width="${px(Math.max(0, xTvDir - xTvEsq))}" height="${px(hTv)}" ` +
      `fill="${C.roxo}" fill-opacity="0.34" stroke="${C.roxo}" ` +
      `stroke-opacity="0.85" stroke-width="1.1"/>`;
    g += halo(xTvDir - 6, yPernaTopo + hTv + 12, 'travessa',
      C.roxo, 9.5, 'end', 0, 500);
  }

  /* Laje do assento: apoia no topo das pernas E no topo das travessas */
  g += `<rect x="${px(xAssEsq)}" y="${px(yAssTopo)}" ` +
    `width="${px(xAssDir - xAssEsq)}" height="${px(hAssPx)}" ` +
    `fill="${C.azul}" fill-opacity="0.42" stroke="${C.azul}" stroke-width="1.6"/>`;

  /* Linha de centro */
  g += ln(cx, yAssTopo - 8, cx, chao, C.texto, '3 4');

  /*
   * Cargas. Com carga centrada nos dois eixos as duas forcas caem no mesmo
   * ponto e se sobreporiam: nesse caso desenha-se uma seta unica com a
   * resultante.
   */
  const xP = cx + e * s;
  const yPonta = yAssTopo - 5;

  if (!centrada) {
    const lenP = compSeta(P);
    const lenW = compSeta(Wc);
    const yCaudaP = yPonta - 11 - lenP;
    const yCaudaW = yPonta - 11 - lenW;

    g += ln(cx, yCaudaW, cx, yPonta - 11, C.ambar, null, 2.2);
    g += `<polygon points="${px(cx)},${px(yPonta)} ${px(cx - 4.5)},${px(yPonta - 11)} ` +
      `${px(cx + 4.5)},${px(yPonta - 11)}" fill="${C.ambar}"/>`;

    /* Flecha semitransparente em cor roxa representando o vetor de forca P */
    g += `<polygon points="${px(xP - 3.2)},${px(yCaudaP)} ${px(xP + 3.2)},${px(yCaudaP)} ` +
      `${px(xP + 3.2)},${px(yPonta - 12)} ${px(xP + 7.5)},${px(yPonta - 12)} ` +
      `${px(xP)},${px(yPonta)} ${px(xP - 7.5)},${px(yPonta - 12)} ` +
      `${px(xP - 3.2)},${px(yPonta - 12)}" fill="#9333ea" fill-opacity="0.58" ` +
      `stroke="#e9d5ff" stroke-width="1.2" stroke-opacity="0.88"/>`;

    g += ln(cx - 11, yCaudaW + 4, cx - 74, yCaudaW + 4, C.ambar, '2 3');
    g += halo(cx - 78, yCaudaW + 8, 'W = ' + n(Wc, 1) + ' N', C.ambar, 11, 'end');

    g += ln(xP + 11, yCaudaP + 4, cx + 74, yCaudaP + 4, C.roxo, '2 3');
    g += halo(cx + 78, yCaudaP + 8, 'P = ' + n(P, 0) + ' N', C.roxo, 11, 'start');

    /* Cota da excentricidade em X, so quando existe deslocamento no papel */
    if (Math.abs(e) > 0.5) {
      const yE = yAssTopo - 24;
      g += ln(cx, yE, xP, yE, C.roxo);
      g += ln(cx, yE - 5, cx, yE + 5, C.roxo);
      g += ln(xP, yE - 5, xP, yE + 5, C.roxo);
      g += halo(cx + 8, yE - 7, 'eX = ' + rotuloCmDirecao(e / 10, 'x'),
        C.roxo, 10.5, 'start');
    } else {
      const yE = yAssTopo - 24;
      g += halo(cx, yE - 6,
        'eX = 0 cm — deslocamento em Y (' + rotuloCmDirecao(r.entrada.eY / 10, 'y') + ')',
        C.roxo, 10, 'middle');
    }
  } else {
    const lenR = compSeta(Ptotal);
    const yCaudaR = yPonta - 11 - lenR;

    g += `<polygon points="${px(cx - 3.2)},${px(yCaudaR)} ${px(cx + 3.2)},${px(yCaudaR)} ` +
      `${px(cx + 3.2)},${px(yPonta - 12)} ${px(cx + 7.5)},${px(yPonta - 12)} ` +
      `${px(cx)},${px(yPonta)} ${px(cx - 7.5)},${px(yPonta - 12)} ` +
      `${px(cx - 3.2)},${px(yPonta - 12)}" fill="#9333ea" fill-opacity="0.58" ` +
      `stroke="#e9d5ff" stroke-width="1.2" stroke-opacity="0.88"/>`;
    g += ln(cx + 11, yCaudaR + 4, cx + 78, yCaudaR + 4, C.roxo, '2 3');
    g += halo(cx + 82, yCaudaR + 8, 'P + W = ' + n(Ptotal, 0) + ' N',
      C.roxo, 11, 'start');
  }

  /*
   * Reacoes no piso. A vista frontal mostra 2 das 4 pernas: as da FRENTE,
   * que sao perna0 e perna1 (sinalY = +1). Com carga biaxial, frente-esquerda
   * e frente-direita NAO sao iguais — cada uma vem da reacao calculada para
   * aquela perna, nao da media.
   */
  const compReacao = v => 20 + 42 * (v / Math.max(r.forcas.Nmax, 1));

  function reacao(xc, valor, rot, cor){
    const c = compReacao(valor);
    let q = ln(xc, chao + c, xc, chao - 2, cor, null, 2.2);
    q += `<polygon points="${px(xc)},${chao - 3} ${px(xc - 5)},${chao + 9} ` +
      `${px(xc + 5)},${chao + 9}" fill="${cor}"/>`;
    q += halo(xc, chao + c + 15, rot, cor, 9.5, 'middle');
    return q;
  }

  if (nEl === 4 && r.forcas.reacoesPernas) {
    const esq = r.forcas.reacoesPernas[0];
    const dir = r.forcas.reacoesPernas[1];
    g += reacao(xPEsq + tw / 2, esq.valor,
      'frente-esq. ' + n(esq.valor, 0) + ' N', C.roxo);
    g += reacao(xPDir - tw / 2, dir.valor,
      'frente-dir. ' + n(dir.valor, 0) + ' N', C.verde);
  } else if (nEl === 4) {
    g += reacao(xPEsq + tw / 2, r.forcas.Nmin,
      'R min = ' + n(r.forcas.Nmin, 0) + ' N', C.roxo);
    g += reacao(xPDir - tw / 2, r.forcas.Nmax,
      'R max = ' + n(r.forcas.Nmax, 0) + ' N', C.verde);
  } else {
    g += reacao(cx, Ptotal, 'R = ' + n(Ptotal, 0) + ' N', C.verde);
  }

  /* Cota H, a esquerda */
  const xH = xAssEsq - 46;
  g += ln(xH, chao, xH, yPernaTopo, C.texto);
  g += ln(xH - 5, chao, xH + 5, chao, C.texto);
  g += ln(xH - 5, yPernaTopo, xH + 5, yPernaTopo, C.texto);
  g += halo(xH - 9, (chao + yPernaTopo) / 2, 'H = ' + n(H / 10, 1) + ' cm',
    C.texto, 11, 'middle', -90);

  /* Cota L, so quando existe quadro de pernas */
  if (nEl === 4) {
    const yL = chao - 52;
    g += ln(xPEsq + tw / 2, chao, xPEsq + tw / 2, yL + 6, C.texto, '3 4');
    g += ln(xPDir - tw / 2, chao, xPDir - tw / 2, yL + 6, C.texto, '3 4');
    g += ln(xPEsq + tw / 2, yL, xPDir - tw / 2, yL, C.texto);
    g += ln(xPEsq + tw / 2, yL - 5, xPEsq + tw / 2, yL + 5, C.texto);
    g += ln(xPDir - tw / 2, yL - 5, xPDir - tw / 2, yL + 5, C.texto);
    g += halo(cx, yL - 8, 'L = ' + n(L / 10, 1) + ' cm', C.texto, 11);
  }

  /* Marca do encosto */
  if (temEncosto) {
    const xEnc = xAssDir + 26;
    g += ln(xEnc - 10, yEncTopo, xEnc + 4, yEncTopo, C.texto, '2 3');
    g += halo(xEnc + 8, yEncTopo + 4, 'encosto', C.texto, 9.5, 'start', 0, 500);
  }

  return `<svg viewBox="0 0 ${larg} ${alt}" width="100%" role="img" ` +
    `aria-label="diagrama de corpo livre da cadeira">${g}</svg>`;
}

/* ---------- Assento isolado ----------
 * Vista de cima da placa. O apoio e o QUADRO inteiro: os quatro topos de
 * perna nos cantos, mais as quatro travessas no vao entre elas, todos
 * coplanares em z = H.
 *
 * A travessa ocupa apenas o vao entre as FACES INTERNAS das pernas. Como sua
 * largura nunca passa de t, a abertura interna e Lv = L - 2b.
 *
 * A carga e posicionada nos DOIS eixos: e o cartao que mostra onde a pessoa
 * senta no plano da placa. Em Y, +1 e a borda da FRENTE e -1 a do FUNDO,
 * junto ao encosto.
 */
function assentoSVG(r){
  const nEl = r.entrada.numPernas;
  const L = HIPOTESES.L;
  const P = r.forcas.P;
  const eX = r.entrada.eX, eY = r.entrada.eY;
  const centrada = Math.abs(r.entrada.fracX) < 0.005 &&
                   Math.abs(r.entrada.fracY) < 0.005;
  const aL = r.assento.b;
  const aP = Number.isFinite(r.assento.p) ? r.assento.p : r.assento.b;
  const fX = Number.isFinite(r.assento.folgaX) ? r.assento.folgaX : (aL - L) / 2;
  const fY = Number.isFinite(r.assento.folgaY) ? r.assento.folgaY : (aP - L) / 2;
  const tPerna = Math.min(r.entrada.t, CADEIRA.espessuraMaxima);
  const bTV = (r.assentoVao && Number.isFinite(r.assentoVao.bTravessa))
    ? r.assentoVao.bTravessa
    : (r.travessas ? r.travessas.b : 0);
  const vaoLivre = r.assentoVao ? r.assentoVao.L : L;

  const larg = 560, alt = 470;
  const s = Math.min(238 / aL, 238 / aP);
  const w = aL * s, hh = aP * s;
  const x0 = (larg - w) / 2;
  const y0 = 74;
  const X = mm => x0 + mm * s;
  const Y = mm => y0 + mm * s;

  const caixa = (x, y, ww, h2, cor, op, dash) =>
    `<rect x="${px(x)}" y="${px(y)}" width="${px(Math.max(0, ww))}" ` +
    `height="${px(Math.max(0, h2))}" fill="${cor}" fill-opacity="${op}" ` +
    `stroke="${cor}" stroke-width="1.3"` +
    (dash ? ` stroke-dasharray="${dash}"` : '') + '/>';

  let g = '';

  /* Placa do assento */
  g += `<rect x="${px(x0)}" y="${px(y0)}" width="${px(w)}" height="${px(hh)}" ` +
    `fill="${C.azul}" fill-opacity="0.07" stroke="${C.azul}" stroke-width="1.6"/>`;

  if (nEl === 4) {
    /* Sobrepasso em balanco, fora do quadro */
    g += caixa(x0, y0, fX * s, hh, C.vermelho, 0.13);
    g += caixa(X(fX + L), y0, fX * s, hh, C.vermelho, 0.13);
    g += caixa(X(fX), y0, L * s, fY * s, C.vermelho, 0.13);
    g += caixa(X(fX), Y(fY + L), L * s, fY * s, C.vermelho, 0.13);

    /* Abertura interna do quadro */
    g += caixa(X(fX + bTV), Y(fY + bTV), vaoLivre * s, vaoLivre * s,
      C.roxo, 0.14, '5 4');

    /* Travessas: SO no vao entre as faces internas das pernas */
    if (bTV > 0) {
      const compTv = Math.max(0, L - 2 * tPerna) * s;
      g += caixa(X(fX + tPerna), Y(fY), compTv, bTV * s, C.ambar, 0.42);
      g += caixa(X(fX + tPerna), Y(fY + L - bTV), compTv, bTV * s, C.ambar, 0.42);
      g += caixa(X(fX), Y(fY + tPerna), bTV * s, compTv, C.ambar, 0.42);
      g += caixa(X(fX + L - bTV), Y(fY + tPerna), bTV * s, compTv, C.ambar, 0.42);
    }

    /* Topos das pernas: os apoios dos cantos, por cima de tudo */
    const tp = tPerna * s;
    g += caixa(X(fX), Y(fY), tp, tp, C.azul, 0.62);
    g += caixa(X(fX + L - tPerna), Y(fY), tp, tp, C.azul, 0.62);
    g += caixa(X(fX), Y(fY + L - tPerna), tp, tp, C.azul, 0.62);
    g += caixa(X(fX + L - tPerna), Y(fY + L - tPerna), tp, tp, C.azul, 0.62);
  }

  /* Apoio central do pedestal */
  if (nEl === 1) {
    const rc = Math.max(9, CADEIRA.coneRaioBase * CADEIRA.fracaoLadoPiramide * s);
    g += `<circle cx="${px(X(aL / 2))}" cy="${px(Y(aP / 2))}" r="${px(rc)}" ` +
      `fill="${C.azul}" fill-opacity="0.45" stroke="${C.azul}" stroke-width="1.6"/>`;
  }

  /* Indicadores de orientacao da placa (fundo = y=0 no topo, frente = +Y embaixo) */
  g += halo(x0 + w / 2, y0 - 12, 'FUNDO (encosto, −Y)', C.texto, 9.5, 'middle', 0, 500);
  g += halo(x0 + w / 2, y0 + hh + 13, 'FRENTE (+Y)', C.texto, 9.5, 'middle', 0, 500);

  /* Eixos de referencia que passam pelo centro geometrico */
  const xC = X(aL / 2), yC = Y(aP / 2);
  g += ln(x0 - 6, yC, x0 + w + 6, yC, C.texto, '2 4', 0.8);
  g += ln(xC, y0 - 6, xC, y0 + hh + 6, C.texto, '2 4', 0.8);

  /* Carga P: vetor e ponto de aplicacao em roxo semitransparente */
  const xP = X(aL / 2 + eX);
  const yP = Y(aP / 2 + eY);
  if (!centrada) {
    g += ln(xC, yP, xP, yP, C.roxo, '4 3', 1.4);
    g += ln(xP, yC, xP, yP, C.roxo, '4 3', 1.4);
    if (Math.abs(eX) > 0.5) {
      g += halo((xC + xP) / 2, yP - 8,
        'eX = ' + n(eX / 10, 1) + ' cm', C.roxo, 9.5);
    }
    if (Math.abs(eY) > 0.5) {
      g += halo(xP + 10, (yC + yP) / 2,
        'eY = ' + n(eY / 10, 1) + ' cm', C.roxo, 9.5, 'start');
    }
  } else {
    g += halo(xP + 14, yP + 20, 'centro do assento', C.roxo, 9.5, 'start');
  }

  /* Alvo e flecha semitransparente roxa indicando o vetor P sobre o banco */
  g += `<circle cx="${px(xP)}" cy="${px(yP)}" r="10.5" fill="#9333ea" fill-opacity="0.28" ` +
    `stroke="#e9d5ff" stroke-width="1.3" stroke-opacity="0.85"/>`;
  g += `<circle cx="${px(xP)}" cy="${px(yP)}" r="5.2" fill="#9333ea" fill-opacity="0.72" ` +
    `stroke="${C.fundo}" stroke-width="1.4"/>`;
  g += halo(xP + 14, yP - 8, 'P = ' + n(P, 0) + ' N', '#d8b4fe', 11, 'start');

  /* Cota da largura do assento */
  const yCota = y0 + hh + 26;
  g += ln(x0, y0 + hh, x0, yCota, C.texto, '3 4');
  g += ln(x0 + w, y0 + hh, x0 + w, yCota, C.texto, '3 4');
  g += ln(x0, yCota, x0 + w, yCota, C.texto);
  g += ln(x0, yCota - 5, x0, yCota + 5, C.texto);
  g += ln(x0 + w, yCota - 5, x0 + w, yCota + 5, C.texto);
  g += halo(x0 + w / 2, yCota - 7, 'a_L = ' + n(aL / 10, 1) + ' cm', C.texto, 10.5);

  /* Cota da profundidade */
  const xCota = x0 - 28;
  g += ln(xCota, y0, xCota, y0 + hh, C.texto);
  g += ln(xCota - 5, y0, xCota + 5, y0, C.texto);
  g += ln(xCota - 5, y0 + hh, xCota + 5, y0 + hh, C.texto);
  g += halo(xCota - 8, y0 + hh / 2, 'a_P = ' + n(aP / 10, 1) + ' cm',
    C.texto, 10, 'middle', -90);

  /* Legenda */
  const yLeg = yCota + 34;
  g += caixa(x0, yLeg - 9, 11, 11, C.azul, 0.62);
  g += halo(x0 + 16, yLeg, 'topo da perna', C.texto, 10, 'start', 0, 500);
  if (nEl === 4) {
    g += caixa(x0 + 130, yLeg - 9, 11, 11, C.ambar, 0.42);
    g += halo(x0 + 146, yLeg, 'travessa (no vão)', C.texto, 10, 'start', 0, 500);
    g += caixa(x0 + 288, yLeg - 9, 11, 11, C.roxo, 0.14, '3 2');
    g += halo(x0 + 304, yLeg,
      'vão livre ' + n(vaoLivre, 0) + ' mm', C.texto, 10, 'start', 0, 500);
  }
  g += halo(x0 + w / 2, yLeg + 20,
    centrada
      ? 'carga no centro — quatro reações iguais'
      : 'vetor P aplicado em: X ' +
        rotuloExcentDirecao(r.entrada.fracX * 100, 'x') + ' · Y ' +
        rotuloExcentDirecao(r.entrada.fracY * 100, 'y'),
    C.roxo, 10.5);

  return `<svg viewBox="0 0 ${larg} ${alt}" width="100%" role="img" ` +
    `aria-label="assento isolado com centro de carga deslocado">${g}</svg>`;
}

/* ---------- Glossário ---------- */
const GLOSS = {
  P:['Carga do usuário','Peso da pessoa, aplicado verticalmente no assento.'],
  m:['Massa do usuário','Massa informada no simulador.'],
  g:['Aceleração da gravidade','Constante de 9,81 m/s² usada em todo o cálculo.'],
  W:['Peso próprio','Peso da cadeira, somando volume × densidade de cada peça.'],
  eX:['Deslocamento em X','Posição do centro de carga ao longo da largura do assento, em mm.'],
  eY:['Deslocamento em Y','Posição do centro de carga ao longo da profundidade do assento, em mm.'],
  fracX:['Posição em X','Deslocamento em X como fração de meia largura: 0 centro, 100% a borda.'],
  fracY:['Posição em Y','Deslocamento em Y como fração de meia profundidade: 0 centro, 100% a borda.'],
  L:['Lado do quadro de pernas','Distância entre as faces externas das pernas opostas.'],
  n:['Número de pernas','Quantidade de apoios verticais: 4 pernas ou 1 pedestal.'],
  Nmed:['Reação média por perna','Carga total, usuário mais cadeira, dividida entre as pernas.'],
  dN:['Parcela excêntrica','Soma das parcelas de X e de Y que a excentricidade acrescenta.'],
  dNx:['Parcela em X','P·eX/(2·(L−t)): quanto a excentricidade em X desiguala as pernas.'],
  dNy:['Parcela em Y','P·eY/(2·(L−t)): quanto a excentricidade em Y desiguala as pernas.'],
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
  a:['Balanço do assento','Trecho do assento que avança além do quadro de apoio.'],
  b:['Largura do assento','Largura total da placa do assento.'],
  aL:['Largura do assento','Dimensão do assento na direção do eixo X.'],
  aP:['Profundidade do assento','Dimensão do assento na direção do eixo Y.'],
  Lv:['Vão livre do assento','Abertura interna do quadro de apoio: L − 2·b.'],
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
  Mtomb:['Momento de tombamento','P vezes a excentricidade resultante. Empurra a cadeira para tombar.'],
  Mest:['Momento estabilizador','P mais W, vezes R. Mantém a cadeira no chão.'],
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
  ['Ação e reação: o caminho da carga',
   'A pessoa empurra o assento para baixo. O assento entrega essa carga ao quadro — topos das pernas e travessas —, e o quadro entrega às pernas, que entregam ao chão. O chão empurra tudo de volta para cima.',
   'Apoie a mão na mesa: a mesa empurra sua mão de volta. É isso que impede a mão de atravessar.',
   'cartões 1 e 2, e o assento isolado',
   'soma das reações = carga total'],
  ['Alavanca: por que sentar na beirada muda tudo',
   'Uma força aplicada fora do centro cria um giro, chamado momento. Ele vale a força multiplicada pela distância até o ponto de apoio. Sentar no canto desloca a carga em duas direções ao mesmo tempo.',
   'Abrir uma porta empurrando longe da dobradiça é mais fácil que empurrar perto dela.',
   'cartões 1, 2 e 4',
   'M = F × d   →   momento = força × distância'],
  ['Quem resiste ao giro no quadro de pernas',
   'Com quatro pernas, o giro da carga é resistido pelo par de pernas de um lado contra o par do outro. Um deslocamento em duas direções carrega mais o canto para onde a pessoa se move.',
   'Dois amigos empurrando uma gangorra em sentidos opostos equilibram o brinquedo sem dobrar o eixo.',
   'cartões 3 e 4',
   'Ni = P/4 ± P·eX/(2b) ± P·eY/(2b)'],
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
   'Toda peça se deforma sob carga. Flecha é esse afundamento, medido em milímetros. O assento afunda mais no meio do vão entre apoios.',
   'Prancha de mergulho: quanto mais longa, mais afunda na ponta quando alguém salta.',
   'cartões 5 e 6',
   'flecha cresce com a quarta potência do vão'],
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

/*
 * O app envia assento, travessa e centro de carga na URL. Antes esta pagina
 * ignorava assento e travessa e calculava sempre com os padroes — o desenho
 * e os numeros nao batiam com o simulador.
 */
if (qs.has('assentoB') || qs.has('assentoP') || qs.has('assentoH')) {
  definirAssento(
    numQS('assentoB', 44) * fator,
    numQS('assentoP', 44) * fator,
    numQS('assentoH', 2) * fator
  );
}

if (qs.has('travessaB') || qs.has('travessaH')) {
  definirTravessaSecao(
    numQS('travessaB', 4) * fator,
    numQS('travessaH', 6) * fator,
    qs.get('travessaSecao') === 'tubular',
    numQS('travessaParede', 2)
  );
}

/*
 * Centro de carga em DOIS eixos. O app envia percentual (-100 a +100);
 * o solver trabalha com fracao de meia dimensao (-1 a +1).
 * Sem os parametros, mantem o padrao de constantes.js: carga centrada.
 */
if (qs.has('excentX') || qs.has('excentY')) {
  definirExcentricidade(
    numQS('excentX', 0) / 100,
    numQS('excentY', 0) / 100
  );
}

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
  const L = HIPOTESES.L;
  const nEl = r.entrada.numPernas;
  const A = r.secao.A, I = r.secao.I, W = r.secao.W, E = mat.E;
  const Wpeso = r.massa.total * G;
  const temEnc = r.entrada.comEncosto;
  const eX = r.entrada.eX, eY = r.entrada.eY, eRes = r.entrada.eRes;
  const fracX = r.entrada.fracX, fracY = r.entrada.fracY;
  const centrada = Math.abs(fracX) < 0.005 && Math.abs(fracY) < 0.005;

  const barras = construirBarras(r.entrada.t, r.entrada.H, mat, r.entrada.forma,
    r.entrada.numPernas, r.entrada.vazada, r.entrada.parede, r.entrada.comEncosto);
  const dims = dimensoesExternas(barras);

  sub.textContent = mat.nome + ' · ' + n(dims.altura / 10, 1) + ' × ' +
    n(dims.largura / 10, 1) + ' × ' + n(dims.profundidade / 10, 1) + ' cm · ' +
    (nEl === 1 ? 'pedestal' : '4 pernas') + ' · ' +
    (temEnc ? 'com encosto' : 'sem encosto') + ' · ' +
    (centrada ? 'carga centrada' : 'carga fora do centro');

  /*
   * ---------- Modelo da perna ----------
   * No quadro de quatro pernas o momento e resistido pelo CASAL entre as
   * pernas, que ja fecha o equilibrio estatico. A perna recebe apenas
   * esforco axial, e o solver devolve Mperna = 0.
   *
   * Os cartoes de V, M e linha elastica mostram a HIPOTESE RIGIDA: o momento
   * que existiria se a ligacao com o quadro transmitisse a parcela a perna.
   * E verificacao de sensibilidade — prova que, mesmo nessa hipotese, a
   * perna esta folgada.
   */
  const axialPuro = nEl === 4;
  const McritReal = r.forcas.Mperna;
  const Msens = (P * eRes) / nEl;
  const Mcrit = axialPuro ? Msens : McritReal;
  const Fh = Mcrit / H;
  const Nperna = r.forcas.Nmax;

  const Mperna = y => Fh * (H - y);
  const defPerna = y => (Fh * y * y * (3 * H - y)) / (6 * E * I);

  const a = r.assento.a;
  const aNom = Number.isFinite(r.assento.aNominal) ? r.assento.aNominal : a;
  const Ia = r.assento.I;
  const aFaixa = Number.isFinite(r.assento.faixa) ? r.assento.faixa : r.assento.b;
  const Mbal = x => P * (a - x);
  const defBal = x => (P * x * x * (3 * a - x)) / (6 * E * Ia);

  const rotSens = axialPuro ? 'Sensibilidade · ' : '';

  const bTV = (r.assentoVao && Number.isFinite(r.assentoVao.bTravessa))
    ? r.assentoVao.bTravessa
    : (r.travessas ? r.travessas.b : 0);
  const vaoLivre = r.assentoVao ? r.assentoVao.L : L;
  const tPerna = r.entrada.t;

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
      ['Seção da perna', (r.entrada.vazada ? 'Tubular' : 'Maciça') + ' ' +
        (r.entrada.forma === 'redonda' ? 'redonda' : 'quadrada') + ', t = ' + n(tPerna / 10, 1) + ' cm'],
      ['Apoios', nEl === 1 ? '1 perna (pedestal central)' : '4 pernas, L = ' + n(L / 10, 1) + ' cm'],
      ['Altura da perna', n(H / 10, 1) + ' cm'],
      ['Assento', n(r.assento.b / 10, 1) + ' × ' + n((r.assento.p || r.assento.b) / 10, 1) +
        ' × ' + n(r.assento.h / 10, 1) + ' cm'],
      ['Travessas', r.travessas
        ? n(r.travessas.b / 10, 1) + ' × ' + n(r.travessas.h / 10, 1) + ' cm, ' +
          (r.travessas.vazada ? 'tubular' : 'maciça') + ' — comprimento ' + n(r.travessas.comprimento, 0) + ' mm'
        : 'não se aplica ao pedestal'],
      ['Apoio do assento', nEl === 4
        ? 'quadro: 4 topos de perna + 4 travessas, coplanares'
        : 'topo da coluna, apoio central'],
      ['Centro de carga', centrada
        ? 'no centro do assento'
        : 'X: ' + rotuloExcentDirecao(fracX * 100, 'x') +
          ' · Y: ' + rotuloExcentDirecao(fracY * 100, 'y')],
      ['Deslocamento', rotuloCmDirecao(eX / 10, 'x') + ' (' + n(eX, 1) + ' mm) · ' +
        rotuloCmDirecao(eY / 10, 'y') + ' (' + n(eY, 1) + ' mm)'],
      ['Massa do usuário', n(r.entrada.m, 1) + ' kg'],
      ['Massa própria', n(r.massa.total, 2) + ' kg'],
      ['Encosto', temEnc ? 'presente' : 'ausente (banco)']
    ].map(l => `<tr><th>${l[0]}</th><td>${l[1]}</td></tr>`).join('') + '</tbody></table>',
    detalhe: {
      simbolos: [['P', n(P, 1) + ' N'], ['m', n(r.entrada.m, 1) + ' kg'],
        ['g', n(G, 2) + ' m/s²'], ['W', n(Wpeso, 1) + ' N'],
        ['eX', n(eX / 10, 2) + ' cm (' + n(eX, 1) + ' mm)'],
        ['eY', n(eY / 10, 2) + ' cm (' + n(eY, 1) + ' mm)'],
        ['fracX', rotuloExcentDirecao(fracX * 100, 'x')],
        ['fracY', rotuloExcentDirecao(fracY * 100, 'y')],
        ['L', n(L, 1) + ' mm'], ['H', n(H, 1) + ' mm'], ['t', n(tPerna, 1) + ' mm'],
        ['E', n(E, 0) + ' MPa'], ['sigmaAdm', n(r.tensoes.sigmaAdm, 2) + ' MPa'],
        ['n', String(nEl)]],
      passos: [
        ['Carga do usuário', 'P = m · g', n(r.entrada.m, 1) + ' · ' + n(G, 2), n(P, 1) + ' N'],
        ['Peso próprio da cadeira', 'W = Σ (V · ρ) · g', n(r.massa.total, 3) + ' · ' + n(G, 2), n(Wpeso, 1) + ' N'],
        ['Carga vertical total', 'P + W', n(P, 1) + ' + ' + n(Wpeso, 1), n(P + Wpeso, 1) + ' N'],
        ['Deslocamento em X', 'eX = fracX · a_L/2',
          n(fracX, 3) + ' · ' + n(r.assento.b / 2, 1), n(eX, 2) + ' mm'],
        ['Deslocamento em Y', 'eY = fracY · a_P/2',
          n(fracY, 3) + ' · ' + n((r.assento.p || r.assento.b) / 2, 1), n(eY, 2) + ' mm']
      ]
    }
  });

  /* 1. DCL do conjunto */
  out += card({
    largo: true,
    titulo: '1. Diagrama de corpo livre do conjunto',
    simples: 'a pessoa empurra o assento para baixo; o chão empurra as pernas para cima com a mesma força total.',
    cenario: 'Vista frontal da cadeira inteira. A carga <strong>P</strong> e o peso próprio ' +
      '<strong>W</strong> descem sobre a superfície do assento; o assento entrega tudo ao ' +
      '<strong>quadro</strong> — os topos das pernas e as travessas, que estão no mesmo plano —, ' +
      'e o quadro entrega às pernas, que entregam ao piso. A faixa roxa é a travessa, que ocupa ' +
      'só o vão entre as faces internas das pernas. O encosto está em traço leve porque aqui é ' +
      'contexto: massa, não estrutura verificada.',
    figura: dclSVG(r, dims),
    nota: 'Vista frontal, com 2 das 4 pernas: as da frente, que são as que ficam do lado oposto ' +
      'ao encosto. O deslocamento em X aparece no papel; o deslocamento em Y ocorre para dentro ' +
      'ou para fora da vista e por isso não aparece aqui — ele é o que diferencia as pernas da ' +
      'frente das de trás, e quem mostra isso é o cartão 3. A travessa tem o topo coplanar ao ' +
      'topo da perna e aparece em roxo logo abaixo da laje. A laje usa espessura mínima de ' +
      'leitura e as setas guardam a proporção em raiz da força, para que a carga menor continue ' +
      'visível; os valores impressos são exatos.',
    formula: centrada
      ? `ΣFz = 0   →   ${nEl === 4 ? 'R₁ + R₂ + R₃ + R₄' : 'R'} = P + W\n` +
        `carga centrada: eX = eY = 0, reações iguais\n` +
        `N = (P + W)/n = ${n(r.forcas.Nmedio, 0)} N em cada perna`
      : `ΣFz = 0   →   ${nEl === 4 ? 'R₁ + R₂ + R₃ + R₄' : 'R'} = P + W\n` +
        (nEl === 4
          ? `Ni = (P + W)/4 ± P·eX/(2·(L−t)) ± P·eY/(2·(L−t))\n`
          : `M = P · e_resultante   (duas componentes)\n`) +
        `Neste caso: Nmáx = ${n(r.forcas.Nmax, 0)} N   Nmín = ${n(r.forcas.Nmin, 0)} N`,
    leitura: centrada
      ? 'Com a carga no centro, o momento de excentricidade é nulo e as quatro pernas recebem ' +
        'exatamente a mesma reação. É o caso de referência: qualquer projeto que reprove aqui ' +
        'reprova também com a carga deslocada.'
      : (nEl === 4
        ? 'A perna do canto para onde a carga se desloca recebe as duas parcelas somadas. ' +
          'Com eX = ' + n(eX / 10, 1) + ' cm e eY = ' + n(eY / 10, 1) + ' cm, a diferença ' +
          'entre a perna mais e a menos carregada é de <strong>' + n(2 * r.forcas.dN, 0) +
          ' N</strong>. ' +
          (r.forcas.levantou
            ? '<span class="graf-ruim">A excentricidade levanta as pernas do canto oposto.</span>'
            : 'Nenhuma perna perde contato com o piso.')
        : 'O momento resultante vale P·' + n(eRes, 1) + ' mm e tem duas componentes: ' +
          n(P * eY, 0) + ' N·mm em torno de X e ' + n(P * eX, 0) + ' N·mm em torno de Y.'),
    detalhe: {
      simbolos: [['P', n(P, 1) + ' N'], ['W', n(Wpeso, 1) + ' N'],
        ['eX', n(eX, 1) + ' mm'], ['eY', n(eY, 1) + ' mm'],
        ['L', n(L, 1) + ' mm'], ['H', n(H, 1) + ' mm'], ['Nmed', n(r.forcas.Nmedio, 1) + ' N'],
        ['dNx', n(r.forcas.dNx, 1) + ' N'], ['dNy', n(r.forcas.dNy, 1) + ' N'],
        ['Nmax', n(r.forcas.Nmax, 1) + ' N'], ['Nmin', n(r.forcas.Nmin, 1) + ' N']],
      passos: [
        ['Carga do usuário', 'P = m · g', n(r.entrada.m, 1) + ' · ' + n(G, 2), n(P, 1) + ' N'],
        ['Reação média por perna', nEl === 4 ? 'Nmed = (P + W)/n' : 'Nmed = P + W',
          nEl === 4
            ? '(' + n(P, 1) + ' + ' + n(Wpeso, 1) + ')/4'
            : n(P, 1) + ' + ' + n(Wpeso, 1),
          n(r.forcas.Nmedio, 2) + ' N'],
        ['Parcela da excentricidade em X', 'dNx = P · |eX| / (2 · (L − t))',
          nEl === 4
            ? n(P, 1) + ' · ' + n(Math.abs(eX), 1) + ' / (2 · ' + n(r.forcas.bracoBinario, 1) + ')'
            : '—',
          n(r.forcas.dNx, 2) + ' N'],
        ['Parcela da excentricidade em Y', 'dNy = P · |eY| / (2 · (L − t))',
          nEl === 4
            ? n(P, 1) + ' · ' + n(Math.abs(eY), 1) + ' / (2 · ' + n(r.forcas.bracoBinario, 1) + ')'
            : '—',
          n(r.forcas.dNy, 2) + ' N'],
        ['Reação máxima', 'Nmax = Nmed + dNx + dNy',
          n(r.forcas.Nmedio, 2) + ' + ' + n(r.forcas.dNx, 2) + ' + ' + n(r.forcas.dNy, 2),
          n(r.forcas.Nmax, 2) + ' N'],
        ['Reação mínima', 'Nmin = Nmed − dNx − dNy',
          n(r.forcas.Nmedio, 2) + ' − ' + n(r.forcas.dNx, 2) + ' − ' + n(r.forcas.dNy, 2),
          n(r.forcas.Nmin, 2) + ' N'],
        ['Conferência do equilíbrio', 'ΣR = n · Nmed', nEl + ' · ' + n(r.forcas.Nmedio, 2),
          n(nEl * r.forcas.Nmedio, 2) + ' N ≈ P + W']
      ]
    }
  });

  /* 2. Assento isolado */
  out += card({
    largo: true,
    titulo: '2. Reações no assento, com a placa isolada',
    simples: nEl === 4
      ? 'o assento apoia no quadro inteiro: nos quatro topos das pernas e nas travessas, que ficam no vão entre elas. O ponto onde a pessoa senta pode estar em qualquer lugar da placa.'
      : 'no pedestal existe um apoio só, no centro. Toda a beirada do assento trabalha em balanço.',
    cenario: nEl === 4
      ? 'Existem dois conjuntos de reações, iguais e opostas: o do piso empurrando as pernas, e ' +
        'do quadro empurrando o assento. Os apoios são os <strong>quatro topos de perna</strong> ' +
        'nos cantos mais as <strong>quatro travessas</strong>, que ocupam o vão entre elas. Vista ' +
        'de cima, o quadro é uma moldura plana cuja abertura interna mede L − 2·b: é essa ' +
        'abertura que a placa vence no meio. O ponto vermelho é onde a carga de fato atua.'
      : 'Isolando a placa vista de cima, o apoio é o topo da coluna, no centro. Não há duas linhas ' +
        'de apoio, então não existe vão entre apoios: toda a beirada trabalha em balanço, e o ' +
        'braço cresce quando a carga se afasta do centro.',
    figura: assentoSVG(r),
    nota: 'Vista superior da placa. Azul é o topo da perna; âmbar é a travessa, restrita ao vão entre as pernas; o tracejado roxo interno é a abertura do quadro; vermelho claro é o sobrepasso em balanço; e o alvo roxo semitransparente marca a posição de aplicação do vetor de força P. A borda superior do desenho é o fundo da cadeira (lado do encosto, −Y) e a inferior é a frente (+Y).',
    formula: nEl === 4
      ? `apoios: 4 topos (${n(tPerna, 0)} × ${n(tPerna, 0)}) + 4 travessas (comprimento ${n(L - 2 * tPerna, 0)})\n` +
        `centro de carga: X ${rotuloExcentDirecao(fracX * 100, 'x')}  ·  Y ${rotuloExcentDirecao(fracY * 100, 'y')}\n` +
        `deslocamento: eX = ${n(eX / 10, 2)} cm (${n(eX, 1)} mm)  ·  eY = ${n(eY / 10, 2)} cm (${n(eY, 1)} mm)\n` +
        `balanço nominal: a = ${n(aNom, 1)} mm   →   balanço com carga = ${n(a, 1)} mm\n` +
        `vão livre: Lv = L − 2·b = ${n(L, 0)} − 2·${n(bTV, 0)} = ${n(vaoLivre, 0)} mm`
      : `centro de carga: X ${rotuloExcentDirecao(fracX * 100, 'x')}  ·  Y ${rotuloExcentDirecao(fracY * 100, 'y')}\n` +
        `deslocamento: eX = ${n(eX / 10, 2)} cm (${n(eX, 1)} mm)  ·  eY = ${n(eY / 10, 2)} cm (${n(eY, 1)} mm)\n` +
        `balanço: a = a_L/2 − t/2 + |eX| = ${n(a, 1)} mm\n` +
        `sem vão: no pedestal a placa engasta na coluna`,
    leitura: nEl === 4
      ? 'O quadro entrega a carga às pernas ao longo das quatro bordas da placa. ' +
        (centrada
          ? 'Com a carga centrada a distribuição é simétrica: metade para cada par de pernas. '
          : 'A carga está deslocada em X (' + rotuloCmDirecao(eX / 10, 'x') + ') e em Y (' +
            rotuloCmDirecao(eY / 10, 'y') + '), o que ' +
            'carrega mais o canto para onde ela se desloca. ') +
        'A beirada trabalha em balanço e o buraco do quadro trabalha entre apoios: duas contas ' +
        'diferentes sobre a mesma placa.'
      : 'Por ter um apoio único, o assento do pedestal é bem mais solicitado que o de quatro ' +
        'pernas: o balanço é de ' + n(a, 1) + ' mm contra ' +
        n(Math.max(0, r.assento.folgaX || 0), 1) + ' mm do quadro.',
    detalhe: {
      simbolos: [['aL', n(r.assento.b, 0) + ' mm'],
        ['aP', n((r.assento.p || r.assento.b), 0) + ' mm'],
        ['a', n(a, 1) + ' mm'], ['L', n(L, 0) + ' mm'],
        ['Lv', n(vaoLivre, 0) + ' mm'], ['eX', n(eX, 1) + ' mm'],
        ['eY', n(eY, 1) + ' mm'],
        ['Nmax', n(r.forcas.Nmax, 1) + ' N'], ['Nmin', n(r.forcas.Nmin, 1) + ' N']],
      passos: nEl === 4 ? [
        ['Apoios da placa', 'topos de perna + travessas',
          '4 × ' + n(tPerna, 0) + ' mm + 4 vigas', 'apoio contínuo nas 4 bordas'],
        ['Comprimento da travessa', 'Lt = L − 2·t',
          n(L, 0) + ' − 2·' + n(tPerna, 0), n(L - 2 * tPerna, 0) + ' mm'],
        ['Abertura interna do quadro', 'Lv = L − 2·b',
          n(L, 0) + ' − 2·' + n(bTV, 0), n(vaoLivre, 0) + ' mm'],
        ['Balanço nominal', 'a = folga além do quadro',
          n(aNom, 1) + ' mm', n(aNom / 10, 2) + ' cm'],
        ['Balanço com a carga deslocada', 'a + máx(|eX|, |eY|)',
          n(aNom, 1) + ' + ' +
          n(Math.max(Math.abs(eX), Math.abs(eY)), 1), n(a, 1) + ' mm'],
        ['Pressão sobre a placa', 'q = P / (a_L · a_P)',
          n(P, 1) + ' / (' + n(r.assento.b, 0) + ' · ' + n((r.assento.p || r.assento.b), 0) + ')',
          n(r.assentoVao.q, 6) + ' N/mm²']
      ] : [
        ['Apoio da placa', 'topo da coluna', '1 apoio central',
          'reação R = ' + n(P + Wpeso, 0) + ' N'],
        ['Balanço com a carga', 'a = a_L/2 − t/2 + |eX|',
          n(aNom, 1) + ' + ' + n(Math.abs(eX), 1), n(a, 1) + ' mm'],
        ['Momento no engaste', 'M = P · a', n(P, 1) + ' · ' + n(a, 1),
          n(r.assento.M, 1) + ' N·mm'],
        ['Vão entre apoios', 'não existe', '—', 'apoio único']
      ]
    }
  });

  /* 3. Reações no piso — quatro pernas separadas */
  /*
   * ORIENTACAO DOS EIXOS: sinalY > 0 e a FRENTE, sinalY < 0 e o FUNDO, junto
   * ao encosto. O rotulo anterior invertia os dois e mandava o usuario olhar
   * a perna errada ao identificar qual levanta.
   */
  const itensReacao = nEl === 1
    ? [{ rotulo:'Pedestal', valor:P + Wpeso,
         valorTexto:n(P + Wpeso, 0) + ' N', cor:C.verde }]
    : (r.forcas.reacoesPernas || []).map(p => ({
        rotulo: 'P' + p.indice,
        sub: (p.sinalX > 0 ? 'dir.' : 'esq.') + ' · ' +
             (p.sinalY > 0 ? 'frente' : 'fundo'),
        valor: p.valor,
        valorTexto: n(p.valor, 0) + ' N',
        cor: p.levantou ? C.vermelho
           : (p.valor > r.forcas.Nmedio * 1.05 ? C.ambar : C.verde)
      }));

  out += card({
    titulo: '3. Distribuição das reações no piso',
    simples: nEl === 1
      ? 'toda a carga da cadeira passa por uma única coluna.'
      : centrada
        ? 'com a pessoa sentada no meio, as quatro pernas recebem a mesma carga.'
        : 'a perna do canto para onde a pessoa se desloca recebe bem mais carga que a do canto oposto.',
    cenario: nEl === 1
      ? 'No pedestal, toda a carga passa por uma única coluna. A excentricidade não redistribui a força normal, mas gera momento.'
      : 'As pernas não recebem a mesma carga. A placa rígida transmite a carga por flexão biaxial, e cada perna responde ao seu quadrante: <strong>Ni = P/4 ± P·eX/(2b) ± P·eY/(2b)</strong>. A perna do canto carregado soma as duas parcelas; a do canto oposto subtrai as duas. A frente é o lado oposto ao encosto.',
    figura: graficoBarras({ itens: itensReacao, legendaY: 'Reação (N)', alt: 'reacoes' }),
    formula: nEl === 1
      ? 'N = P + W = ' + n(P + Wpeso, 0) + ' N'
      : 'Ni = ' + n(r.forcas.Nmedio, 0) + ' ± ' + n(r.forcas.dNx, 0) +
        ' ± ' + n(r.forcas.dNy, 0) + ' N\n' +
        'Nmáx = ' + n(r.forcas.Nmax, 0) + ' N   Nmín = ' + n(r.forcas.Nmin, 0) + ' N',
    leitura: 'Todo o cálculo seguinte usa <strong>N = ' + n(r.forcas.Nmax, 0) + ' N</strong>' +
      (centrada
        ? ' — que, com a carga centrada, é a própria média.'
        : ' — a perna mais carregada, não a média. É essa diferença que justifica verificar o ' +
          'canto mais solicitado.') +
      (r.forcas.levantou
        ? ' <span class="graf-ruim">Pelo menos uma perna perde contato com o piso.</span>'
        : ''),
    detalhe: {
      simbolos: [['n', String(nEl)], ['W', n(Wpeso, 1) + ' N'],
        ['Nmed', n(r.forcas.Nmedio, 1) + ' N'],
        ['dNx', n(r.forcas.dNx, 1) + ' N'], ['dNy', n(r.forcas.dNy, 1) + ' N'],
        ['Nmax', n(r.forcas.Nmax, 1) + ' N'], ['Nmin', n(r.forcas.Nmin, 1) + ' N']],
      passos: nEl === 4 ? [
        ['Somar a carga total', 'P + W', n(P, 1) + ' + ' + n(Wpeso, 1), n(P + Wpeso, 1) + ' N'],
        ['Dividir a carga entre as pernas', 'Nmed = (P + W)/4',
          '(' + n(P, 1) + ' + ' + n(Wpeso, 1) + ')/4', n(r.forcas.Nmedio, 2) + ' N'],
        ['Acréscimo excêntrico em X', 'dNx = P · |eX| / (2 · (L − t))',
          n(P, 1) + ' · ' + n(Math.abs(eX), 1) + ' / (2 · ' + n(r.forcas.bracoBinario, 1) + ')',
          n(r.forcas.dNx, 2) + ' N'],
        ['Acréscimo excêntrico em Y', 'dNy = P · |eY| / (2 · (L − t))',
          n(P, 1) + ' · ' + n(Math.abs(eY), 1) + ' / (2 · ' + n(r.forcas.bracoBinario, 1) + ')',
          n(r.forcas.dNy, 2) + ' N'],
        ['Perna mais carregada', 'Nmax = Nmed + dNx + dNy',
          n(r.forcas.Nmedio, 2) + ' + ' + n(r.forcas.dNx, 2) + ' + ' + n(r.forcas.dNy, 2),
          n(r.forcas.Nmax, 2) + ' N'],
        ['Perna oposta', 'Nmin = Nmed − dNx − dNy',
          n(r.forcas.Nmedio, 2) + ' − ' + n(r.forcas.dNx, 2) + ' − ' + n(r.forcas.dNy, 2),
          n(r.forcas.Nmin, 2) + ' N']
      ] : [['Toda a carga em uma coluna', 'N = P + W',
        n(P, 1) + ' + ' + n(Wpeso, 1), n(r.forcas.Nmedio, 2) + ' N']]
    }
  });

  /*
   * Numeracao dos sub-cartoes da perna. Como os de V, M e linha elastica so
   * existem quando ha flexao, um contador evita buraco na sequencia.
   */
  let subPerna = 0;
  const subTit = txt => '4.' + (++subPerna) + ' ' + txt;
  const temFlexao = Mcrit > 1e-9;

  /* 4. Esforços na perna */
  out += card({
    titulo: '4. ' + rotSens + 'Esforços na perna',
    simples: axialPuro
      ? 'no quadro de quatro pernas a perna só é apertada de cima para baixo. A parte de entortar fica resistida pelo conjunto.'
      : 'a carga fora do centro empurra o topo da perna para o lado. Isso vira uma força horizontal e um esforço de entortar.',
    cenario: axialPuro
      ? 'No quadro de quatro pernas o momento excêntrico é resistido pelo casal entre as ' +
        'pernas, que já fecha o equilíbrio: a perna recebe apenas esforço axial.' +
        (temFlexao
          ? ' Os itens seguintes mostram a <strong>hipótese rígida</strong> — o que aconteceria ' +
            'se a ligação com o quadro transmitisse o momento à perna — como verificação de ' +
            'sensibilidade.'
          : ' Com a carga centrada não há momento algum, nem mesmo na hipótese rígida, e os ' +
            'diagramas de cortante, momento e linha elástica não se aplicam.')
      : 'O momento excêntrico é representado por uma força horizontal equivalente ' +
        '<strong>F</strong> no nível do assento, com a perna engastada na base e giro livre no topo.',
    formula: axialPuro
      ? (temFlexao
        ? `momento real na perna = 0  (resistido pelo casal entre as pernas)\n` +
          `hipótese rígida:  F = (P·e_resultante/n) / H = ${n(Msens, 0)} / ${n(H, 0)} = ${n(Fh, 2)} N\n` +
          `N(y) = −${n(Nperna, 0)} N        (compressão, constante)`
        : `momento real na perna = 0  (carga centrada, sem excentricidade)\n` +
          `N(y) = −${n(Nperna, 0)} N        (compressão, constante)`)
      : `F = M_crít / H = ${n(McritReal, 0)} / ${n(H, 0)} = ${n(Fh, 2)} N\n` +
        `N(y) = −${n(Nperna, 0)} N        (compressão, constante)\n` +
        `V(y) = F = ${n(Fh, 2)} N\n` +
        `M(y) = F·(H − y)   →   M(0) = ${n(McritReal, 0)} N·mm`,
    leitura: axialPuro
      ? (temFlexao
        ? 'O casal entre as pernas fecha exatamente o momento externo P·e = ' +
          n(P * eRes, 0) + ' N·mm. Nada sobra para a perna. O peso próprio já está incluído ' +
          'em N: as pernas sozinhas pesam ' + n(r.massa.pernas * G, 1) + ' N.'
        : 'Sem excentricidade não há momento a resistir: a perna é uma coluna de compressão ' +
          'pura. O peso próprio já está incluído em N; as pernas sozinhas pesam ' +
          n(r.massa.pernas * G, 1) + ' N.')
      : 'O peso próprio já está incluído no esforço normal (peso total da cadeira ÷ n); a ' +
        'perna sozinha pesa ' + n(r.massa.pernas * G, 1) + ' N, cerca de ' +
        n((r.massa.pernas * G / P) * 100, 1) + '% de P.',
    detalhe: {
      simbolos: [['Mcrit', n(McritReal, 0) + ' N·mm'], ['F', n(Fh, 2) + ' N'],
        ['H', n(H, 1) + ' mm'], ['Nmax', n(Nperna, 1) + ' N'], ['V', n(Fh, 2) + ' N'],
        ['M', n(Mcrit, 0) + ' N·mm']],
      passos: axialPuro ? [
        ['Momento externo da carga', 'P · e_resultante',
          n(P, 1) + ' · ' + n(eRes, 1), n(P * eRes, 2) + ' N·mm'],
        ['Parcela em torno de X', 'M_y = P · eY',
          n(P, 1) + ' · ' + n(eY, 1), n(P * eY, 2) + ' N·mm'],
        ['Parcela em torno de Y', 'M_x = P · eX',
          n(P, 1) + ' · ' + n(eX, 1), n(P * eX, 2) + ' N·mm'],
        ['Momento que sobra para a perna', 'P·e − casal', '—', '0 N·mm'],
        ['Hipótese rígida (sensibilidade)', 'M = P · e / n',
          n(P, 1) + ' · ' + n(eRes, 1) + ' / ' + nEl, n(Msens, 2) + ' N·mm'],
        ['Força horizontal equivalente', 'F = M / H',
          n(Msens, 2) + ' / ' + n(H, 0), n(Fh, 3) + ' N']
      ] : [
        ['Momento em torno de X', 'M_y = P · eY',
          n(P, 1) + ' · ' + n(eY, 1), n(P * eY, 2) + ' N·mm'],
        ['Momento em torno de Y', 'M_x = P · eX',
          n(P, 1) + ' · ' + n(eX, 1), n(P * eX, 2) + ' N·mm'],
        ['Momento equivalente', r.entrada.forma === 'redonda'
          ? '[(M_x)² + (M_y)²]^0,5' : '|M_x| + |M_y|',
          '—', n(McritReal, 2) + ' N·mm'],
        ['Força horizontal equivalente', 'F = Mcrit / H',
          n(McritReal, 2) + ' / ' + n(H, 0), n(Fh, 3) + ' N'],
        ['Esforço normal constante', 'N(y) = −Nmax', '−' + n(Nperna, 1),
          n(Nperna, 1) + ' N em toda a altura']
      ]
    }
  });

  /* 4.x N — sempre presente */
  out += card({
    titulo: subTit('Esforço normal (N)'),
    simples: 'a perna está apertada de cima para baixo, igual do começo ao fim.',
    cenario: 'Compressão pura, constante ao longo da perna, e o único esforço real na perna do quadro de quatro pernas.',
    figura: graficoLinha({
      xmin: 0, xmax: H, ymin: -Nperna * 1.2, ymax: 0,
      series: [{ f: () => -Nperna, cor: C.azul, area: true }],
      marcas: [{ x: 0, y: -Nperna, rotulo: 'N = ' + n(Nperna, 0) + ' N' }],
      legendaX: 'y a partir do piso (mm)', legendaY: 'N (N)', alt: 'esforco normal'
    }),
    leitura: 'A seção está inteira comprimida. É essa parcela, sozinha, que dimensiona a perna no quadro.',
    detalhe: {
      simbolos: [['Nmax', n(Nperna, 1) + ' N'], ['y', '0 a ' + n(H, 0) + ' mm']],
      passos: [
        ['Reação máxima na perna', 'Nmax = Nmed + dNx + dNy',
          n(r.forcas.Nmedio, 2) + ' + ' + n(r.forcas.dNx, 2) + ' + ' + n(r.forcas.dNy, 2),
          n(Nperna, 2) + ' N'],
        ['Valor em qualquer altura', 'N(y) = −Nmax', '−' + n(Nperna, 2),
          'constante de y = 0 a y = ' + n(H, 0) + ' mm']
      ]
    }
  });

  /* 4.x V, M, linha elástica — só quando existe flexão */
  if (temFlexao) {
    out += card({
      titulo: subTit(rotSens + 'Esforço cortante (V)'),
      simples: axialPuro
        ? 'no quadro, o cortante na perna é zero. O que aparece aqui é a hipótese rígida, só para comparação.'
        : 'o topo da perna é empurrado para o lado com a mesma força em toda a altura.',
      cenario: 'Uma única força transversal na ponta, então o cortante não varia com a altura. ' +
        (axialPuro ? 'Valor indicativo: na ligação real com o quadro, o cortante na perna é nulo.' : ''),
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
          ['Força horizontal equivalente', 'F = M / H', n(Mcrit, 2) + ' / ' + n(H, 0), n(Fh, 3) + ' N'],
          ['Cortante em qualquer altura', 'V(y) = F', n(Fh, 3), 'constante ao longo da perna']
        ]
      }
    });

    out += card({
      titulo: subTit(rotSens + 'Momento fletor (M)'),
      simples: 'o esforço de entortar é zero no topo e máximo onde a perna encontra o chão.',
      cenario: axialPuro
        ? 'Momento hipotético da ligação rígida: cresce linearmente do topo até a base. Não é o ' +
          'que ocorre no modelo — serve para mostrar que, mesmo assim, a folga seria grande.'
        : 'O momento cresce linearmente do topo até o engastamento, onde atinge o valor crítico.',
      figura: graficoLinha({
        xmin: 0, xmax: H, ymin: 0, ymax: Math.max(Mcrit * 1.22, 1),
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

    const dTopo = defPerna(H);
    out += card({
      titulo: subTit(rotSens + 'Linha elástica da perna'),
      simples: 'é o quanto o topo da perna se desloca para o lado. É o "balanço" que a pessoa sente ao sentar.',
      cenario: 'Flecha lateral como console com carga concentrada na ponta.' +
        (axialPuro ? ' Calculada com o momento da hipótese rígida — na ligação real ela é praticamente nula.' : ''),
      figura: graficoLinha({
        xmin: 0, xmax: H, ymin: 0, ymax: Math.max(dTopo * 1.25, 1e-6),
        series: [{ f: defPerna, cor: C.verde, area: true }],
        marcas: [{ x: H, y: dTopo, rotulo: 'δ = ' + n(dTopo, 3) + ' mm' }],
        legendaX: 'y a partir do piso (mm)', legendaY: 'δ (mm)', alt: 'linha elastica'
      }),
      formula: `δ(y) = F·y²·(3H − y) / (6·E·I)\nδ(H) = F·H³ / (3·E·I) = ${n(dTopo, 3)} mm`,
      leitura: 'A flecha cresce com o cubo do comprimento: dobrar a altura multiplica o ' +
        'deslocamento por oito. Contra ' + n(H, 0) + ' mm de altura, ela representa ' +
        n((dTopo / H) * 100, 2) + '%.',
      detalhe: {
        simbolos: [['delta', n(dTopo, 3) + ' mm no topo'], ['F', n(Fh, 2) + ' N'],
          ['E', n(E, 0) + ' MPa'], ['I', n(I, 0) + ' mm⁴'], ['H', n(H, 1) + ' mm']],
        passos: [
          ['Rigidez à flexão', 'E · I', n(E, 0) + ' · ' + n(I, 0), n(E * I, 0) + ' N·mm²'],
          ['Flecha na ponta', 'δ = F · H³ / (3 · E · I)',
            n(Fh, 3) + ' · ' + n(H, 0) + '³ / (3 · ' + n(E * I, 0) + ')', n(dTopo, 4) + ' mm'],
          ['Flecha relativa à altura', 'δ / H', n(dTopo, 4) + ' / ' + n(H, 0),
            n((dTopo / H) * 100, 2) + '%']
        ]
      }
    });
  }

  /* 5. Assento em balanço */
  out += card({
    titulo: '5. Assento em balanço',
    simples: 'a beirada do assento avança além do apoio. Sentar ali é o pior caso, porque o giro é máximo.',
    cenario: 'O assento avança além do quadro de apoio e trabalha como placa em balanço. ' +
      'Considera-se uma faixa da largura do assento, com a carga na borda livre — a posição ' +
      'mais desfavorável. Quando a carga se desloca em X ou em Y, o braço do balanço cresce: ' +
      'o cálculo soma a projeção do deslocamento ao sobrepasso nominal, que aqui é de ' +
      n(aNom, 1) + ' mm.',
    formula: `a_nominal = ${n(aNom, 1)} mm     balanço com a carga = ${n(a, 1)} mm\n` +
      `b_f = ${n(aFaixa, 0)} mm        h = ${n(r.assento.h, 1)} mm\n` +
      `V(x) = P = ${n(P, 0)} N\nM(x) = P·(a − x)   →   M(0) = ${n(r.assento.M, 0)} N·mm`,
    leitura: 'Tensão no engaste: ' + n(r.assento.sigma, 3) + ' MPa, ou ' +
      n(r.assento.utilizacao * 100, 1) + '% da admissível. Flecha de ' +
      n(r.assento.flecha, 3) + ' mm contra limite de ' + n(r.assento.flechaLimite, 3) + ' mm.',
    detalhe: {
      simbolos: [['a', n(a, 1) + ' mm'], ['b', n(aFaixa, 0) + ' mm'],
        ['h', n(r.assento.h, 1) + ' mm'], ['M', n(r.assento.M, 0) + ' N·mm'],
        ['Wmod', n(r.assento.W, 0) + ' mm³'], ['Ia', n(Ia, 0) + ' mm⁴'],
        ['sigma', n(r.assento.sigma, 3) + ' MPa'], ['delta', n(r.assento.flecha, 3) + ' mm']],
      passos: [
        ['Balanço com a carga deslocada', 'a = a_nominal + máx(|eX|, |eY|)',
          n(aNom, 1) + ' + ' + n(Math.max(Math.abs(eX), Math.abs(eY)), 1),
          n(a, 1) + ' mm'],
        ['Momento no engaste', 'Ma = P · a', n(P, 1) + ' · ' + n(a, 1), n(r.assento.M, 2) + ' N·mm'],
        ['Módulo resistente da faixa', 'Wa = b_f · h² / 6',
          n(aFaixa, 0) + ' · ' + n(r.assento.h, 1) + '² / 6', n(r.assento.W, 2) + ' mm³'],
        ['Tensão de flexão', 'σ = Ma / Wa',
          n(r.assento.M, 2) + ' / ' + n(r.assento.W, 2), n(r.assento.sigma, 3) + ' MPa'],
        ['Utilização à tensão', 'σ / σ_adm',
          n(r.assento.sigma, 3) + ' / ' + n(r.tensoes.sigmaAdm, 3),
          n(r.assento.utilizacao * 100, 1) + '%'],
        ['Inércia da faixa', 'Ia = b_f · h³ / 12',
          n(aFaixa, 0) + ' · ' + n(r.assento.h, 1) + '³ / 12', n(Ia, 2) + ' mm⁴'],
        ['Flecha na borda', 'δ = P · a³ / (3 · E · Ia)',
          n(P, 1) + ' · ' + n(a, 1) + '³ / (3 · ' + n(E, 0) + ' · ' + n(Ia, 2) + ')',
          n(r.assento.flecha, 4) + ' mm'],
        ['Limite de flecha', 'a / ' + CADEIRA.divisorFlechaAssento,
          n(a, 1) + ' / ' + CADEIRA.divisorFlechaAssento,
          n(r.assento.flechaLimite, 4) + ' mm']
      ]
    }
  });

  /* 5.1 Cortante no assento */
  out += card({
    titulo: '5.1 Cortante no assento',
    simples: 'a força vertical que o assento sente na beirada é a carga inteira da pessoa.',
    cenario: 'Só existe uma carga concentrada na ponta, então o cortante é constante em todo o balanço.',
    figura: graficoLinha({
      xmin: 0, xmax: Math.max(a, 1), ymin: 0, ymax: P * 1.3,
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
      xmin: 0, xmax: Math.max(a, 1), ymin: 0, ymax: Math.max(r.assento.M * 1.2, 1),
      series: [{ f: Mbal, cor: C.roxo, area: true }],
      marcas: [{ x: 0, y: r.assento.M, rotulo: 'M = ' + n(r.assento.M, 0) + ' N·mm' }],
      legendaX: 'x a partir do apoio (mm)', legendaY: 'M (N·mm)', alt: 'momento no assento'
    }),
    leitura: 'O engaste é a seção crítica do assento. É o ponto mais distante do apoio, na beirada.',
    detalhe: {
      simbolos: [['M', n(r.assento.M, 0) + ' N·mm'], ['P', n(P, 1) + ' N'],
        ['a', n(a, 1) + ' mm'], ['x', '0 a ' + n(a, 0) + ' mm']],
      passos: [
        ['Expressão geral', 'M(x) = P · (a − x)',
          n(P, 1) + ' · (' + n(a, 0) + ' − x)', 'reta decrescente'],
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
      xmin: 0, xmax: Math.max(a, 1), ymin: 0,
      ymax: Math.max(defBal(a), r.assento.flechaLimite, 1e-6) * 1.25,
      series: [
        { f: defBal, cor: C.verde, area: true },
        { f: () => r.assento.flechaLimite, cor: C.vermelho, tracejada: true }
      ],
      marcas: [{ x: a, y: defBal(a), rotulo: 'δ = ' + n(defBal(a), 3) + ' mm' }],
      legendaX: 'x a partir do apoio (mm)', legendaY: 'δ (mm)', alt: 'flecha do assento'
    }),
    leitura: 'A flecha é de ' + n(defBal(a), 3) + ' mm contra limite de ' +
      n(r.assento.flechaLimite, 3) + ' mm — ' +
      n(r.assento.utilizacaoFlecha * 100, 1) + '% do permitido.',
    detalhe: {
      simbolos: [['delta', n(defBal(a), 3) + ' mm'], ['P', n(P, 1) + ' N'],
        ['E', n(E, 0) + ' MPa'], ['Ia', n(Ia, 0) + ' mm⁴']],
      passos: [
        ['Flecha na borda', 'δ = P · a³ / (3 · E · Ia)',
          n(P, 1) + ' · ' + n(a, 1) + '³ / (3 · ' + n(E, 0) + ' · ' + n(Ia, 0) + ')',
          n(defBal(a), 4) + ' mm'],
        ['Limite de serviço', 'a / ' + CADEIRA.divisorFlechaAssento,
          n(a, 0) + ' / ' + CADEIRA.divisorFlechaAssento,
          n(r.assento.flechaLimite, 4) + ' mm'],
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
      simples: 'entre as bordas do quadro o assento funciona como uma ponte. Ele afunda e racha no meio do buraco.',
      cenario: 'A placa apoia no quadro — topos de perna nos cantos e travessas nas bordas — e ' +
        'vence a abertura interna, de lado ' + n(Lv, 0) + ' mm. Não é o lado de ' + n(L, 0) +
        ' mm entre as faces externas das pernas, porque as travessas ocupam ' + n(bTV, 0) +
        ' mm de cada borda. Trabalha como faixa biapoiada sob pressão uniforme do usuário.',
      formula: `Lv = L − 2·b = ${n(L, 0)} − 2·${n(bTV, 0)} = ${n(Lv, 0)} mm\n` +
        `q = P/(a_L · a_P) = ${n(P, 0)}/(${n(r.assento.b, 0)} · ${n((r.assento.p || r.assento.b), 0)}) = ${q.toFixed(6)} N/mm²\n` +
        `M(x) = q·x·(Lv − x)/2   →   M(Lv/2) = q·Lv²/8 = ${n(Mmax, 2)} N·mm/mm\n` +
        `M adotado = q·Lv²/16 = ${n(r.assentoVao.M, 2)} N·mm/mm`,
      leitura: 'Tensão resultante: ' + n(r.assentoVao.sigma, 3) + ' MPa (' +
        n(r.assentoVao.utilizacao * 100, 1) + '% da admissível). Flecha de ' +
        n(r.assentoVao.flecha, 3) + ' mm contra limite de ' +
        n(r.assentoVao.flechaLimite, 3) + ' mm.',
      detalhe: {
        simbolos: [['q', q.toFixed(6) + ' N/mm²'], ['Lv', n(Lv, 0) + ' mm'],
          ['b', n(r.assento.b, 0) + ' mm'], ['M', n(r.assentoVao.M, 2) + ' N·mm/mm adotado'],
          ['h', n(r.assentoVao.h, 1) + ' mm']],
        passos: [
          ['Abertura interna do quadro', 'Lv = L − 2·b',
            n(L, 0) + ' − 2·' + n(bTV, 0), n(Lv, 0) + ' mm'],
          ['Pressão uniforme', 'q = P / (a_L · a_P)',
            n(P, 1) + ' / (' + n(r.assento.b, 0) + ' · ' + n((r.assento.p || r.assento.b), 0) + ')',
            q.toFixed(6) + ' N/mm²'],
          ['Momento da faixa biapoiada', 'M = q · Lv² / 8',
            q.toFixed(6) + ' · ' + n(Lv, 0) + '² / 8', n(Mmax, 3) + ' N·mm/mm'],
          ['Momento adotado no cálculo', 'M = q · Lv² / 16',
            q.toFixed(6) + ' · ' + n(Lv, 0) + '² / 16', n(r.assentoVao.M, 3) + ' N·mm/mm'],
          ['Razão entre adotado e faixa', 'M_adot / M_faixa',
            n(r.assentoVao.M, 3) + ' / ' + n(Mmax, 3),
            n((r.assentoVao.M / Mmax) * 100, 1) + '%']
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
      leitura: 'As reações do quadro aparecem como picos nos extremos. O esforço cai linearmente até anular no meio.',
      detalhe: {
        simbolos: [['V', n(Math.abs(Vvao(0)), 4) + ' N/mm no apoio'],
          ['q', q.toFixed(6) + ' N/mm²'], ['Lv', n(Lv, 0) + ' mm']],
        passos: [
          ['Cortante nos apoios', 'V(0) = q · Lv / 2',
            q.toFixed(6) + ' · ' + n(Lv, 0) + ' / 2', n(Math.abs(Vvao(0)), 4) + ' N/mm'],
          ['Cortante no meio', 'V(Lv/2) = 0', '—', '0 N/mm']
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
        linhasRef: [{ y: r.assentoVao.M, rotulo: 'adotado qLv²/16', cor: C.ambar }],
        marcas: [{ x: Lv / 2, y: Mmax, rotulo: 'qLv²/8 = ' + n(Mmax, 2) }],
        legendaX: 'x entre apoios (mm)', legendaY: 'M (N·mm/mm)', alt: 'momento do vao'
      }),
      leitura: 'O cálculo usa <strong>' + n((r.assentoVao.M / Mmax) * 100, 0) + '%</strong> do ' +
        'valor da faixa, porque a placa redistribui a carga — a solução de placa dá cerca de ' +
        '0,0479·q·Lv², entre os dois.',
      detalhe: {
        simbolos: [['M', n(Mmax, 3) + ' N·mm/mm no pico'], ['q', q.toFixed(6) + ' N/mm²'],
          ['Lv', n(Lv, 0) + ' mm']],
        passos: [
          ['Momento no meio do vão', 'M = q · Lv² / 8',
            q.toFixed(6) + ' · ' + n(Lv, 0) + '² / 8', n(Mmax, 3) + ' N·mm/mm'],
          ['Momento adotado', 'M = q · Lv² / 16',
            q.toFixed(6) + ' · ' + n(Lv, 0) + '² / 16', n(r.assentoVao.M, 3) + ' N·mm/mm'],
          ['Referência de placa real', 'M ≈ 0,0479 · q · Lv²',
            '0,0479 · ' + q.toFixed(6) + ' · ' + n(Lv, 0) + '²',
            n(0.0479 * q * Lv * Lv, 3) + ' N·mm/mm']
        ]
      }
    });
  }

  /* 7. Interação N–M */
  const Nadm = A * r.tensoes.sigmaAdm, Madm = W * r.tensoes.sigmaAdm;
  const uN = r.forcas.Nmax / Nadm;
  const uM = McritReal / Madm;
  const uMsens = Msens / Madm;

  out += card({
    titulo: '7. Interação N–M na seção',
    simples: axialPuro
      ? 'no quadro de quatro pernas a perna só recebe aperto. O entortamento fica com o conjunto, não com ela.'
      : 'a perna sofre dois esforços ao mesmo tempo: aperto e entortamento. A soma dos dois não pode passar de 100%.',
    cenario: 'Compressão e flexão atuam juntas. A verificação soma as duas parcelas, o que ' +
      'equivale a uma fronteira linear no plano normal–momento. ' +
      (axialPuro
        ? 'Com a perna axial, o ponto de projeto cai sobre o eixo vertical: só a compressão conta.'
        : ''),
    figura: graficoLinha({
      xmin: 0, xmax: 1.2, ymin: 0, ymax: 1.2,
      series: [{ f: x => Math.max(0, 1 - x), cor: C.vermelho, espessura: 2.2 }],
      marcas: [{ x: uN, y: uM, rotulo: 'projeto', cor: C.verde }],
      legendaX: 'N / N_adm', legendaY: 'M / M_adm', alt: 'interacao N-M'
    }),
    formula: `N_adm = A·σ_adm = ${n(Nadm, 0)} N\n` +
      `M_adm = W·σ_adm = ${n(Madm, 0)} N·mm\n` +
      `N/N_adm + M/M_adm = ${n(uN, 4)} + ${n(uM, 4)} = ${n(uN + uM, 4)}` +
      (axialPuro && temFlexao
        ? `\nhipótese rígida:  ${n(uN, 4)} + ${n(uMsens, 4)} = ${n(uN + uMsens, 4)}`
        : ''),
    leitura: axialPuro
      ? (temFlexao
        ? 'A soma real vale <strong>' + n((uN + uM) * 100, 1) + '%</strong>, toda ela de ' +
          'compressão. Mesmo na hipótese rígida, com o momento inteiro na perna, a soma iria a ' +
          n((uN + uMsens) * 100, 1) + '% — ainda aprovado. É a prova de que a perna está com ' +
          'folga frente aos esforços que realmente recebe.'
        : 'A soma vale <strong>' + n((uN + uM) * 100, 1) + '%</strong>, toda ela de compressão. ' +
          'Sem excentricidade não existe parcela de flexão a somar: a perna é coluna pura.')
      : 'A soma vale <strong>' + n((uN + uM) * 100, 1) + '%</strong>. A reta de 100% é ' +
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
        ['Parcela da compressão', 'N / N_adm',
          n(r.forcas.Nmax, 1) + ' / ' + n(Nadm, 1), n(uN, 4)],
        ['Parcela da flexão', axialPuro ? 'M = 0 (perna axial)' : 'M / M_adm',
          axialPuro ? '—' : n(McritReal, 1) + ' / ' + n(Madm, 1), n(uM, 4)],
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
          'π² · ' + n(E, 0) + ' · ' + n(I, 0) + ' / (' +
          n(r.flambagem.K, 2) + ' · ' + n(H, 0) + ')²', n(r.flambagem.Pcr, 1) + ' N'],
        ['Carga crítica admissível', 'Ncr,adm = Pcr / CS',
          n(r.flambagem.Pcr, 1) + ' / ' + n(mat.CS, 2), n(r.flambagem.NcrAdm, 1) + ' N'],
        ['Utilização', 'N / Ncr,adm',
          n(r.forcas.Nmax, 1) + ' / ' + n(r.flambagem.NcrAdm, 1),
          n(r.flambagem.utilizacaoFlambagem * 100, 1) + '%']
      ]
    }
  });

  /* 9. Tensões */
  const pctFlex = r.tensoes.sigmaMax > 0
    ? (r.tensoes.sigmaFlexao / r.tensoes.sigmaMax) * 100
    : 0;

  out += card({
    titulo: '9. Composição das tensões',
    simples: 'a tensão é a força dividida pela área. Aperto e entortamento somam, e a soma é comparada ao limite do material.',
    cenario: 'A tensão normal tem duas parcelas: compressão simples (N/A) e flexão (M·c/I). ' +
      'A soma é comparada com a admissível do material.' +
      (axialPuro ? ' Na perna do quadro de quatro pernas a parcela de flexão é nula.' : ''),
    figura: graficoBarras({
      itens: [
        { rotulo:'σ axial', valor:r.tensoes.sigmaAxial,
          valorTexto:n(r.tensoes.sigmaAxial, 2), cor:C.azul },
        { rotulo:'σ flexão', valor:r.tensoes.sigmaFlexao,
          valorTexto:n(r.tensoes.sigmaFlexao, 2), cor:C.roxo },
        { rotulo:'σ máxima', valor:r.tensoes.sigmaMax,
          valorTexto:n(r.tensoes.sigmaMax, 2), cor:C.ambar }
      ],
      linhasRef: [{ y: r.tensoes.sigmaAdm,
        rotulo: 'σ adm = ' + n(r.tensoes.sigmaAdm, 1) + ' MPa', cor: C.vermelho }],
      legendaY: 'Tensão (MPa)', alt: 'tensoes'
    }),
    formula: `σ = N/A + M·c/I = ${n(r.tensoes.sigmaAxial, 3)} + ` +
      `${n(r.tensoes.sigmaFlexao, 3)} = ${n(r.tensoes.sigmaMax, 3)} MPa\n` +
      `σ_adm = σ_lim/CS = ${n(mat.sigmaLimite, 1)}/${n(mat.CS, 2)} = ` +
      `${n(r.tensoes.sigmaAdm, 2)} MPa\n` +
      `Utilização = ${n(r.tensoes.utilizacao * 100, 1)}%`,
    leitura: axialPuro
      ? (temFlexao
        ? 'A flexão real é zero: a perna é axial. Na hipótese rígida ela somaria ' +
          n(Msens / W, 3) + ' MPa, levando a tensão a ' +
          n(r.tensoes.sigmaAxial + Msens / W, 3) + ' MPa — ainda ' +
          n(((r.tensoes.sigmaAxial + Msens / W) / r.tensoes.sigmaAdm) * 100, 1) +
          '% da admissível. É a folga que a envolvente do casal garante.'
        : 'A flexão real é zero e não há hipótese rígida a avaliar, porque a carga está centrada. ' +
          'Toda a tensão é de compressão simples, e é essa parcela que dimensiona a perna.')
      : 'A flexão responde por ' + n(pctFlex, 0) + '% da tensão total. O que dimensiona a perna ' +
        'é a excentricidade, não o peso do usuário.',
    detalhe: {
      simbolos: [['sigmaA', n(r.tensoes.sigmaAxial, 3) + ' MPa'],
        ['sigmaF', n(r.tensoes.sigmaFlexao, 3) + ' MPa'],
        ['sigma', n(r.tensoes.sigmaMax, 3) + ' MPa'],
        ['sigmaAdm', n(r.tensoes.sigmaAdm, 2) + ' MPa'], ['c', n(r.secao.c, 1) + ' mm']],
      passos: [
        ['Tensão axial', 'σa = N / A',
          n(r.forcas.Nmax, 1) + ' / ' + n(A, 2), n(r.tensoes.sigmaAxial, 3) + ' MPa'],
        ['Tensão de flexão', axialPuro ? 'σf = 0 (perna axial)' : 'σf = M · c / I',
          axialPuro ? '—' : n(McritReal, 1) + ' · ' + n(r.secao.c, 1) + ' / ' + n(I, 1),
          n(r.tensoes.sigmaFlexao, 3) + ' MPa'],
        ['Tensão máxima', 'σ = σa + σf',
          n(r.tensoes.sigmaAxial, 3) + ' + ' + n(r.tensoes.sigmaFlexao, 3),
          n(r.tensoes.sigmaMax, 3) + ' MPa'],
        ['Tensão admissível', 'σ_adm = σ_lim / CS',
          n(mat.sigmaLimite, 1) + ' / ' + n(mat.CS, 2), n(r.tensoes.sigmaAdm, 3) + ' MPa'],
        ['Utilização', 'σ / σ_adm',
          n(r.tensoes.sigmaMax, 3) + ' / ' + n(r.tensoes.sigmaAdm, 3),
          n(r.tensoes.utilizacao * 100, 1) + '%']
      ]
    }
  });

  /* 10. Tombamento */
  if (r.estabilidade) {
    const Mt = P * r.estabilidade.eRes;
    const Me = (P + r.estabilidade.pesoCadeira) * r.estabilidade.braco;

    out += card({
      titulo: '10. Estabilidade ao tombamento',
      simples: 'a carga fora do centro tende a virar a cadeira. O peso próprio é o que segura ela no chão.',
      cenario: 'No pedestal, o peso próprio é o único elemento que resiste ao tombamento. A carga ' +
        'excêntrica empurra a resultante para fora do centro da base; o peso da cadeira a traz de ' +
        'volta. A verificação usa a excentricidade RESULTANTE das duas componentes, e o braço ' +
        'resistente é o menor da base — o que torna o resultado conservador em qualquer direção.' +
        (centrada ? ' Com a carga centrada não há momento de tombamento: a resultante passa pelo eixo.' : ''),
      figura: graficoBarras({
        itens: [
          { rotulo:'Tombamento', valor:Mt, valorTexto:n(Mt, 0), cor:C.vermelho },
          { rotulo:'Estabilizador', valor:Me, valorTexto:n(Me, 0), cor:C.verde }
        ],
        legendaY: 'Momento (N·mm)', alt: 'tombamento'
      }),
      formula: `e_resultante = [(eX)² + (eY)²]^0,5 = ${n(eRes, 1)} mm\n` +
        `M_tomb = P·e_res = ${n(P, 0)}·${n(eRes, 1)} = ${n(Mt, 0)} N·mm\n` +
        `M_estab = (P + W)·R = (${n(P, 0)} + ${n(r.estabilidade.pesoCadeira, 1)})·` +
        `${n(r.estabilidade.braco, 1)} = ${n(Me, 0)} N·mm\n` +
        `Utilização = ${n(r.estabilidade.utilizacao * 100, 1)}%`,
      leitura: 'O braço resistente é o menor da base (' + n(r.estabilidade.braco, 1) + ' mm). Nas ' +
        'diagonais ele é maior, o que torna o resultado conservador. ' +
        (r.estabilidade.tombou
          ? '<span class="graf-ruim">A resultante cai fora da base: a cadeira tomba.</span>'
          : 'A cadeira permanece estável com margem de ' +
            n((1 - r.estabilidade.utilizacao) * 100, 0) + '%.'),
      detalhe: {
        simbolos: [['Mtomb', n(Mt, 1) + ' N·mm'], ['Mest', n(Me, 1) + ' N·mm'],
          ['R', n(r.estabilidade.braco, 1) + ' mm'],
          ['W', n(r.estabilidade.pesoCadeira, 1) + ' N'],
          ['eX', n(eX, 1) + ' mm'], ['eY', n(eY, 1) + ' mm']],
        passos: [
          ['Excentricidade resultante', 'e_res = [(eX)² + (eY)²]^0,5',
            '[(' + n(eX, 1) + ')² + (' + n(eY, 1) + ')²]^0,5', n(eRes, 2) + ' mm'],
          ['Momento de tombamento', 'M_tomb = P · e_res',
            n(P, 1) + ' · ' + n(eRes, 1), n(Mt, 1) + ' N·mm'],
          ['Momento estabilizador', 'M_estab = (P + W) · R',
            '(' + n(P, 1) + ' + ' + n(r.estabilidade.pesoCadeira, 1) + ') · ' +
            n(r.estabilidade.braco, 1), n(Me, 1) + ' N·mm'],
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
  if (r.flambagemLocal) {
    util.push({ rotulo:'Flambagem local', valor:r.flambagemLocal.utilizacao * 100 });
  }
  util.push({ rotulo:'Assento — tensão', valor:r.assento.utilizacao * 100 });
  util.push({ rotulo:'Assento — flecha', valor:r.assento.utilizacaoFlecha * 100 });
  if (r.assentoVao) {
    util.push({ rotulo:'Vão — tensão', valor:r.assentoVao.utilizacao * 100 });
    util.push({ rotulo:'Vão — flecha', valor:r.assentoVao.utilizacaoFlecha * 100 });
  }
  if (r.travessas) {
    util.push({ rotulo:'Travessa — tensão', valor:r.travessas.utilizacaoTensao * 100 });
    util.push({ rotulo:'Travessa — flecha', valor:r.travessas.utilizacaoFlecha * 100 });
  }
  if (r.estabilidade) {
    util.push({ rotulo:'Tombamento', valor:r.estabilidade.utilizacao * 100 });
  }
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
    'O apoio do assento é o <strong>quadro</strong>: os quatro topos de perna nos cantos, mais as ' +
    'quatro travessas ao longo das bordas, todos com o topo na mesma cota z = H. Vista de cima, ' +
    'esse quadro é uma moldura plana. A travessa ocupa só o vão entre as faces internas das ' +
    'pernas, e sua largura nunca passa de t; por isso a abertura interna é governada pela face ' +
    'interna da travessa, Lv = L − 2·b = ' + n(L, 0) + ' − 2·' + n(bTV, 0) + ' = ' +
    n(vaoLivre, 0) + ' mm. Adotar o lado L superestimaria o momento em (L/Lv)² e a flecha em ' +
    '(L/Lv)⁴.<br><br>' +
    'A orientação dos eixos é fixa: <strong>+Y aponta para a frente</strong>, o lado oposto ao ' +
    'encosto, e o encosto fica em y = 0. Por isso a perna com deslocamento positivo em Y é da ' +
    'frente, e a com deslocamento negativo é do fundo, junto ao encosto. Todo rótulo de frente e ' +
    'fundo nesta página segue essa convenção.<br><br>' +
    (centrada
      ? 'O centro de carga está no centro do assento. A carga distribuída equivale, para o ' +
        'equilíbrio global, a uma resultante única no centroide — e com distribuição uniforme o ' +
        'centroide é o centro geométrico. Por isso as quatro reações ficam iguais e não há casal.'
      : 'O centro de carga está em X (' + rotuloExcentDirecao(fracX * 100, 'x') + ') e Y (' +
        rotuloExcentDirecao(fracY * 100, 'y') + ') da meia dimensão do assento, o que corresponde a ' +
        n(eX / 10, 2) + ' cm (' + n(eX, 1) + ' mm) em X e ' +
        n(eY / 10, 2) + ' cm (' + n(eY, 1) + ' mm) em Y. A carga distribuída equivale a uma resultante única no centroide ' +
        'da distribuição; deslocada do centro, ela gera um momento em duas direções, e a placa ' +
        'rígida transmite isso às pernas como flexão biaxial.') +
    '<br><br>' +
    'No quadro de quatro pernas as reações verticais são estaticamente determinadas. O equilíbrio ' +
    'de forças e de momentos fecha o sistema, e a única solução inclui o casal que equilibra o ' +
    'momento externo. Depois disso, o momento já está equilibrado: somar flexão à perna contaria ' +
    'o mesmo momento duas vezes. Por isso a perna é tratada como coluna de carga axial, e os ' +
    'diagramas de V, M e linha elástica da perna aparecem como <strong>verificação de ' +
    'sensibilidade</strong>, com o momento que existiria se a ligação com o quadro fosse rígida. ' +
    'No pedestal o momento é real, com duas componentes, e esses diagramas são o cálculo de ' +
    'projeto.<br><br>' +
    'No pedestal a combinação das duas componentes depende da forma da seção: na quadrada as ' +
    'duas parcelas se somam no canto, e o momento equivalente é |M_x| + |M_y|; na redonda há uma ' +
    'única fibra extrema, na direção resultante, e o equivalente é a raiz da soma dos quadrados.' +
    '<br><br>' +
    'O deslocamento do centro de carga aumenta o braço do balanço do assento. O cálculo soma ao ' +
    'sobrepasso nominal a projeção da excentricidade, o que representa a pessoa sentada na ' +
    'beirada: o ponto de carga fica mais longe do apoio e o momento cresce.' +
    '<br><br>' +
    'O peso próprio já está incluído no esforço normal, dividido pelo número de pernas. As pernas ' +
    'sozinhas pesam ' + n(r.massa.pernas * G, 1) + ' N, cerca de ' +
    n((r.massa.pernas * G / P) * 100, 1) + '% da carga do usuário.<br><br>' +
    (r.assentoVao
        ? 'A carga de cada travessa segue o mesmo critério biaxial das pernas: ' +
        'as vigas frontal e traseira respondem ao deslocamento em Y, as ' +
        'laterais ao deslocamento em X, e a borda para onde a carga se move ' +
        'recebe mais. A verificação usa a viga mais solicitada, e a soma das ' +
        'quatro fecha com o peso que o quadro sustenta — assento mais as ' +
        'próprias vigas.' +
        '<br><br>' +
        'No assento entre apoios, o diagrama mostra o modelo de faixa biapoiada, com pico q·Lv²/8. ' +
        'O cálculo adota q·Lv²/16, apoiado na redistribuição bidimensional da placa. Ambas as ' +
        'soluções estão marcadas no gráfico.<br><br>'
      : 'No pedestal o assento engasta na coluna e trabalha apenas em balanço.<br><br>') +
    'O encosto entra apenas como massa e geometria. A força horizontal de uma pessoa reclinada ' +
    'não é verificada neste modelo, e os postes do encosto não têm verificação de flexão.<br><br>' +
    'Não são representados diagramas de torção: o modelo trata o deslocamento em dois eixos como ' +
    'flexão biaxial, sem momento torsor aplicado.</p></section>';

  conteudo.innerHTML = out;
}

/* ---------- Menus ---------- */
function fecharMenus(){
  conteudo.querySelectorAll('.graf-menu__lista').forEach(l => { l.hidden = true; });
  conteudo.querySelectorAll('.graf-menu__botao').forEach(b => {
    b.setAttribute('aria-expanded', 'false');
  });
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

/* ---------- Modal ----------
 * A nota da figura tambem entra aqui. Ela existia no cartao mas ficava de
 * fora do modal — justamente onde o leitor vai ler a figura com mais atencao
 * e precisa da ressalva ("vista frontal, 2 das 4 pernas", por exemplo).
 */
function abrirModal(id){
  const op = CARDS.get(id);
  if (!op) return;

  tituloModal.textContent = op.titulo;
  let h = '';

  if (op.simples) {
    h += `<p class="graf-simples"><strong>Em palavras simples:</strong> ${op.simples}</p>`;
  }
  if (op.cenario) h += `<p class="graf-cenario">${op.cenario}</p>`;
  if (op.figura) h += `<div class="graf-figura graf-figura--ampla">${op.figura}</div>`;
  if (op.nota) h += `<p class="graf-nota-figura">${op.nota}</p>`;
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