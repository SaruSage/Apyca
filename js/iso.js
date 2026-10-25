/**
 * Projecao isometrica e montagem de faces para o SVG.
 *
 *   x_tela = (x - y) * cos30
 *   y_tela = (x + y)/2 - z
 *
 * A direcao (1,1,1) nao move o ponto na tela, logo x + y + z e a profundidade.
 * Ordenar por camada e, dentro dela, por profundidade, resolve a sobreposicao.
 *
 * Caixas mostram 3 faces. Cilindros mostram as faces laterais cuja normal
 * aponta para a camera, mais o disco de topo. O sombreado de cada face lateral
 * acompanha a direcao da normal, o que da a leitura de superficie curva.
 */

import { bboxPeca } from './chairModel.js';

const COS30 = Math.cos(Math.PI / 6);
const SOMBRA = { top: 1.16, front: 0.94, side: 0.70 };
const LADOS_CILINDRO = 16;

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

/** Faces visiveis de um prisma de eixo vertical. */
function facesDoCilindro(p, lados){
  const out = [];
  const z0 = p.z0, z1 = p.z0 + p.h;

  for (let i = 0; i < lados; i++) {
    const a0 = (2 * Math.PI * i) / lados;
    const a1 = (2 * Math.PI * (i + 1)) / lados;
    const am = (a0 + a1) / 2;
    const nx = Math.cos(am), ny = Math.sin(am);

    if (nx + ny <= 0) continue;   // face virada para tras: nao aparece

    const x0 = p.cx + p.r * Math.cos(a0), y0 = p.cy + p.r * Math.sin(a0);
    const x1 = p.cx + p.r * Math.cos(a1), y1 = p.cy + p.r * Math.sin(a1);

    out.push({
      kind: 'side',
      luz: 0.70 + 0.26 * ((nx + ny) / Math.SQRT2),
      quad: [[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]]
    });
  }

  const topo = [];
  for (let j = 0; j < lados; j++) {
    const a = (2 * Math.PI * j) / lados;
    topo.push([p.cx + p.r * Math.cos(a), p.cy + p.r * Math.sin(a), z1]);
  }
  out.push({ kind: 'top', luz: 1.16, quad: topo });

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

export function buildFaces(barras, escala, origem, corBase){
  const faces = [];

  for (const p of barras) {
    const bb = bboxPeca(p);
    // Canto mais proximo da camera. Ordena pecas DENTRO da mesma camada.
    const prof = bb.max[0] + bb.max[1] + bb.max[2];
    const cor = p.cor || corBase;

    const fs = p.tipo === 'cilindro'
      ? facesDoCilindro(p, LADOS_CILINDRO)
      : facesDaCaixa(p);

    for (const f of fs) {
      const k = f.luz !== undefined ? f.luz : SOMBRA[f.kind];
      faces.push({
        kind: f.kind,
        tela: f.quad.map(pt => project(pt, escala, origem)),
        camada: p.camada ?? 0,
        prof,
        barras: p,
        tipo: p.tipo || 'caixa',
        fill: sombrear(cor, k),
        contorno: sombrear(cor, k * 0.72)
      });
    }
  }

  faces.sort((a, b) => (a.camada - b.camada) || (a.prof - b.prof));
  return faces;
}