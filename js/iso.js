/**
 * Projecao isometrica e montagem de faces para o SVG.
 *
 *   x_tela = (x - y) * cos30
 *   y_tela = (x + y)/2 - z
 *
 * A direcao (1,1,1) nao move o ponto na tela, logo x + y + z e a profundidade.
 *
 * VISIBILIDADE
 * Uma face aparece quando a normal dela tem produto interno positivo com a
 * direcao da camera. Nao basta olhar a componente horizontal: num pe baixo a
 * normal e quase vertical, e a face de tras tambem aponta para a camera.
 *
 * ORDEM DE PINTURA em tres niveis: camada, profundidade da peca e profundidade
 * do centroide da face. O terceiro nivel ordena as faces de tras para frente
 * em corpos de revolucao.
 *
 * SUPERFICIE CURVA
 * Faces de corpos de revolucao nao levam contorno. O numero de faces e alto o
 * bastante para o degrau de sombreado nao aparecer como faixa.
 */

import { bboxPeca } from './chairModel.js';

const COS30 = Math.cos(Math.PI / 6);
const SOMBRA = { top: 1.16, front: 0.94, side: 0.70 };
const LADOS_COLUNA = 20;
const LADOS_CONE = 44;

/** Direcao da camera na projecao isometrica. */
const CAM = [1, 1, 1];

function visivel(nx, ny, nz){
  return nx * CAM[0] + ny * CAM[1] + nz * CAM[2] > 0;
}

export function project([x, y, z], escala, origem){
  return [
    origem[0] + (x - y) * COS30 * escala,
    origem[1] + ((x + y) * 0.5 - z) * escala
  ];
}

/** As tres faces visiveis de uma caixa alinhada aos eixos, camera em (1,1,1). */
function facesDaCaixa(p){
  const X = p.x + p.dx, Y = p.y + p.dy, Z = p.z + p.dz;
  return [
    { kind: 'top',   luz: 1.16, quad: [[p.x, p.y, Z], [X, p.y, Z], [X, Y, Z], [p.x, Y, Z]] },
    { kind: 'front', luz: 0.94, quad: [[p.x, Y, p.z], [X, Y, p.z], [X, Y, Z], [p.x, Y, Z]] },
    { kind: 'side',  luz: 0.70, quad: [[X, p.y, p.z], [X, Y, p.z], [X, Y, Z], [X, p.y, Z]] }
  ];
}

/** Anel de pontos em torno do eixo vertical, na altura z. */
function anel(cx, cy, r, z, lados){
  const pts = [];
  for (let j = 0; j < lados; j++) {
    const a = (2 * Math.PI * j) / lados;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
  }
  return pts;
}

/** Faces visiveis de um prisma vertical de secao circular. */
function facesDoCilindro(p, lados){
  const out = [];
  const z0 = p.z0, z1 = p.z0 + p.h;

  for (let i = 0; i < lados; i++) {
    const a0 = (2 * Math.PI * i) / lados;
    const a1 = (2 * Math.PI * (i + 1)) / lados;
    const am = (a0 + a1) / 2;
    const nx = Math.cos(am), ny = Math.sin(am);

    if (!visivel(nx, ny, 0)) continue;

    const x0 = p.cx + p.r * Math.cos(a0), y0 = p.cy + p.r * Math.sin(a0);
    const x1 = p.cx + p.r * Math.cos(a1), y1 = p.cy + p.r * Math.sin(a1);

    out.push({
      kind: 'side',
      suave: true,
      luz: 0.70 + 0.26 * ((nx + ny) / Math.SQRT2),
      quad: [[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]]
    });
  }

  out.push({ kind: 'top', luz: 1.16, quad: anel(p.cx, p.cy, p.r, z1, lados) });
  return out;
}

/** Faces visiveis de um tronco de cone de eixo vertical. */
function facesDoCone(p, lados){
  const out = [];
  const z0 = p.z0, z1 = p.z0 + p.h;
  const dr = p.rBase - p.rTopo;   // componente vertical da normal

  for (let i = 0; i < lados; i++) {
    const a0 = (2 * Math.PI * i) / lados;
    const a1 = (2 * Math.PI * (i + 1)) / lados;
    const am = (a0 + a1) / 2;
    const nx = Math.cos(am), ny = Math.sin(am);

    // Normal real: (h*cos, h*sin, rBase - rTopo).
    if (!visivel(p.h * nx, p.h * ny, dr)) continue;

    const xb0 = p.cx + p.rBase * Math.cos(a0), yb0 = p.cy + p.rBase * Math.sin(a0);
    const xb1 = p.cx + p.rBase * Math.cos(a1), yb1 = p.cy + p.rBase * Math.sin(a1);
    const xt0 = p.cx + p.rTopo * Math.cos(a0), yt0 = p.cy + p.rTopo * Math.sin(a0);
    const xt1 = p.cx + p.rTopo * Math.cos(a1), yt1 = p.cy + p.rTopo * Math.sin(a1);

    out.push({
      kind: 'side',
      suave: true,
      luz: 0.70 + 0.26 * ((nx + ny) / Math.SQRT2),
      quad: [[xb0, yb0, z0], [xb1, yb1, z0], [xt1, yt1, z1], [xt0, yt0, z1]]
    });
  }

  if (p.rTopo > 0) {
    out.push({ kind: 'top', luz: 1.16, quad: anel(p.cx, p.cy, p.rTopo, z1, lados) });
  }
  return out;
}

/**
 * Faces visiveis de um tronco de piramide de base quadrada.
 * Quatro faces planas: aqui o contorno e bem-vindo, porque a aresta existe.
 */
function facesDaPiramide(p){
  const out = [];
  const z0 = p.z0, z1 = p.z0 + p.h;
  const a = p.ladoBase / 2;
  const at = p.ladoTopo / 2;
  const dr = a - at;

  const base = [[a, a], [-a, a], [-a, -a], [a, -a]];
  const topo = [[at, at], [-at, at], [-at, -at], [at, -at]];
  const nrm = [[0, 1], [-1, 0], [0, -1], [1, 0]];

  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const nx = nrm[i][0], ny = nrm[i][1];

    if (!visivel(p.h * nx, p.h * ny, dr)) continue;

    const b0 = base[i], b1 = base[j], t0 = topo[i], t1 = topo[j];

    out.push({
      kind: 'side',
      suave: false,
      luz: 0.70 + 0.26 * ((nx + ny) / Math.SQRT2),
      quad: [
        [p.cx + b0[0], p.cy + b0[1], z0],
        [p.cx + b1[0], p.cy + b1[1], z0],
        [p.cx + t1[0], p.cy + t1[1], z1],
        [p.cx + t0[0], p.cy + t0[1], z1]
      ]
    });
  }

  if (p.ladoTopo > 0) {
    out.push({
      kind: 'top',
      luz: 1.16,
      quad: topo.map(c => [p.cx + c[0], p.cy + c[1], z1])
    });
  }
  return out;
}

export function computeView(barras, largura, altura, margem = 48){
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const b of barras) {
    const bb = bboxPeca(b);
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], bb.min[a]);
      max[a] = Math.max(max[a], bb.max[a]);
    }
  }

  const cantos = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]])
        cantos.push(project([x, y, z], 1, [0, 0]));

  const xs = cantos.map(c => c[0]);
  const ys = cantos.map(c => c[1]);
  const largProj = Math.max(...xs) - Math.min(...xs);
  const altProj = Math.max(...ys) - Math.min(...ys);

  const utilL = largura - 2 * margem;
  const utilA = altura - 2 * margem;
  const escala = Math.min(utilL / largProj, utilA / altProj);

  const origem = [
    margem + (utilL - largProj * escala) / 2 - Math.min(...xs) * escala,
    margem + (utilA - altProj * escala) / 2 - Math.min(...ys) * escala
  ];

  return { escala, origem, bounds: { min, max } };
}

function sombrear(hex, k){
  const s = hex.replace('#', '');
  const full = s.length === 3
    ? s[0] + s[0] + s[1] + s[1] + s[2] + s[2]
    : s;
  const n = parseInt(full, 16);
  const canais = [(n >> 16) & 255, (n >> 8) & 255, n & 255];

  return 'rgb(' + canais
    .map(v => Math.max(0, Math.min(255, Math.round(v * k))))
    .join(',') + ')';
}

function facesDaPeca(p){
  if (p.tipo === 'cilindro') return facesDoCilindro(p, LADOS_COLUNA);
  if (p.tipo === 'cone') return facesDoCone(p, LADOS_CONE);
  if (p.tipo === 'piramide') return facesDaPiramide(p);
  return facesDaCaixa(p);
}

/** Profundidade do centroide de uma face. Desempate dentro da mesma peca. */
function profFace(quad){
  let s = 0;
  for (const pt of quad) s += pt[0] + pt[1] + pt[2];
  return s / quad.length;
}

export function buildFaces(barras, escala, origem, corBase){
  const faces = [];

  for (const p of barras) {
    const bb = bboxPeca(p);
    const prof = bb.max[0] + bb.max[1] + bb.max[2];
    const cor = p.cor || corBase;

    for (const f of facesDaPeca(p)) {
      const k = f.luz !== undefined ? f.luz : SOMBRA[f.kind];
      const fill = sombrear(cor, k);

      faces.push({
        kind: f.kind,
        tela: f.quad.map(pt => project(pt, escala, origem)),
        camada: p.camada ?? 0,
        prof,
        profF: profFace(f.quad),
        barras: p,
        tipo: p.tipo || 'caixa',
        fill,
        contorno: f.suave ? fill : sombrear(cor, k * 0.72)
      });
    }
  }

  faces.sort((a, b) =>
    (a.camada - b.camada) ||
    (a.prof - b.prof) ||
    (a.profF - b.profF)
  );

  return faces;
}