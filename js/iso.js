/**
 * Faces em 3D, culling por normal e projecao isometrica.
 *
 * MUDANCA ESTRUTURAL
 * Antes as faces saiam do gerador ja projetadas, e o culling acontecia na
 * criacao (nx + ny <= 0). Isso so funciona com pecas alinhadas aos eixos.
 * Agora cada face nasce com a normal em 3D e o culling e feito DEPOIS da
 * transformacao de cada quadro — sem isso, uma peca girada mostraria as
 * faces de tras.
 *
 * Com pecas paradas o resultado e identico ao anterior: das 6 faces de uma
 * caixa, exatamente 3 apontam para a camera (1,1,1).
 *
 * VEIOS E ROTACAO
 * Só a face de topo de uma CAIXA carrega o campo `caixa`, e projetarFaces o
 * preserva ate o montarSVG, que desenha o veio da madeira. O veio, porem, e
 * calculado a partir das coordenadas da caixa SEM rotacao.
 *
 * Por isso `transformar` anula o `caixa`: uma caixa alinhada aos eixos nao
 * representa um solido girado, e manter o campo faria o veio descolar da
 * peca em movimento. Durante a ruina as pecas tombam rapido e o veio seria
 * ruido visual de qualquer forma.
 */
import { bboxPeca } from './chairModel.js';

const COS30 = Math.cos(Math.PI / 6);

const LADOS_COLUNA = 20;
const LADOS_CONE = 44;
const LADOS_TUBO = 28;

/* Direcao da luz, usada apenas no sombreamento durante a animacao. */
const LUZ = [0.44, 0.56, 0.70];

export function project([x, y, z], escala, origem){
  return [
    origem[0] + (x - y) * COS30 * escala,
    origem[1] + ((x + y) * 0.5 - z) * escala
  ];
}

function anel(cx, cy, r, z, lados){
  const pts = [];
  for (let j = 0; j < lados; j++) {
    const a = (2 * Math.PI * j) / lados;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
  }
  return pts;
}

/* ---------- Geracao de faces ---------- */
function facesDaCaixa(p){
  const X = p.x + p.dx, Y = p.y + p.dy, Z = p.z + p.dz;
  const x0 = p.x, y0 = p.y, z0 = p.z;

  return [
    { kind: 'top', luz: 1.16, normal: [0, 0, 1], caixa: p,
      quad: [[x0, y0, Z], [X, y0, Z], [X, Y, Z], [x0, Y, Z]] },

    { kind: 'front', luz: 0.94, normal: [0, 1, 0],
      quad: [[x0, Y, z0], [X, Y, z0], [X, Y, Z], [x0, Y, Z]] },

    { kind: 'side', luz: 0.70, normal: [1, 0, 0],
      quad: [[X, y0, z0], [X, Y, z0], [X, Y, Z], [X, y0, Z]] },

    /*
     * Duas faces compartilham o rotulo 'back': a de -X e a de -Y. Hoje e
     * inofensivo, porque o unico consumidor de `kind` e o montarSVG, que
     * testa apenas 'top'. Ficam registradas para quem for usar 'back' no
     * futuro distinguir as duas.
     */
    { kind: 'back', luz: 0.62, normal: [-1, 0, 0],
      quad: [[x0, y0, z0], [x0, Y, z0], [x0, Y, Z], [x0, y0, Z]] },

    { kind: 'back', luz: 0.62, normal: [0, -1, 0],
      quad: [[x0, y0, z0], [X, y0, z0], [X, y0, Z], [x0, y0, Z]] },

    { kind: 'bottom', luz: 0.52, normal: [0, 0, -1],
      quad: [[x0, y0, z0], [X, y0, z0], [X, Y, z0], [x0, Y, z0]] }
  ];
}

function facesDoCilindro(p, lados){
  const out = [];
  const z0 = p.z0, z1 = p.z0 + p.h;

  for (let i = 0; i < lados; i++) {
    const a0 = (2 * Math.PI * i) / lados;
    const a1 = (2 * Math.PI * (i + 1)) / lados;
    const am = (a0 + a1) / 2;

    const nx = Math.cos(am), ny = Math.sin(am);
    const x0 = p.cx + p.r * Math.cos(a0), y0 = p.cy + p.r * Math.sin(a0);
    const x1 = p.cx + p.r * Math.cos(a1), y1 = p.cy + p.r * Math.sin(a1);

    out.push({
      kind: 'side', suave: true, normal: [nx, ny, 0],
      luz: 0.70 + 0.26 * ((nx + ny) / Math.SQRT2),
      quad: [[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]]
    });
  }

  out.push({ kind: 'top', luz: 1.16, normal: [0, 0, 1],
    quad: anel(p.cx, p.cy, p.r, z1, lados) });

  out.push({ kind: 'bottom', luz: 0.52, normal: [0, 0, -1],
    quad: anel(p.cx, p.cy, p.r, z0, lados) });

  return out;
}

function facesDoCone(p, lados){
  const out = [];
  const z0 = p.z0, z1 = p.z0 + p.h;
  const dr = p.rBase - p.rTopo;

  for (let i = 0; i < lados; i++) {
    const a0 = (2 * Math.PI * i) / lados;
    const a1 = (2 * Math.PI * (i + 1)) / lados;
    const am = (a0 + a1) / 2;

    const nx = Math.cos(am), ny = Math.sin(am);
    const m = Math.hypot(p.h * nx, p.h * ny, dr) || 1;

    const xb0 = p.cx + p.rBase * Math.cos(a0), yb0 = p.cy + p.rBase * Math.sin(a0);
    const xb1 = p.cx + p.rBase * Math.cos(a1), yb1 = p.cy + p.rBase * Math.sin(a1);
    const xt0 = p.cx + p.rTopo * Math.cos(a0), yt0 = p.cy + p.rTopo * Math.sin(a0);
    const xt1 = p.cx + p.rTopo * Math.cos(a1), yt1 = p.cy + p.rTopo * Math.sin(a1);

    out.push({
      kind: 'side', suave: true,
      normal: [(p.h * nx) / m, (p.h * ny) / m, dr / m],
      luz: 0.70 + 0.26 * ((nx + ny) / Math.SQRT2),
      quad: [[xb0, yb0, z0], [xb1, yb1, z0], [xt1, yt1, z1], [xt0, yt0, z1]]
    });
  }

  if (p.rTopo > 0) {
    out.push({ kind: 'top', luz: 1.16, normal: [0, 0, 1],
      quad: anel(p.cx, p.cy, p.rTopo, z1, lados) });
  }

  out.push({ kind: 'bottom', luz: 0.52, normal: [0, 0, -1],
    quad: anel(p.cx, p.cy, p.rBase, z0, lados) });

  return out;
}

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
    const m = Math.hypot(p.h * nx, p.h * ny, dr) || 1;

    const b0 = base[i], b1 = base[j], t0 = topo[i], t1 = topo[j];

    out.push({
      kind: 'side', suave: false,
      normal: [(p.h * nx) / m, (p.h * ny) / m, dr / m],
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
    out.push({ kind: 'top', luz: 1.16, normal: [0, 0, 1],
      quad: topo.map(c => [p.cx + c[0], p.cy + c[1], z1]) });
  }

  out.push({ kind: 'bottom', luz: 0.52, normal: [0, 0, -1],
    quad: base.map(c => [p.cx + c[0], p.cy + c[1], z0]) });

  return out;
}

function facesDoTubo(p, lados){
  const out = [];
  const z0 = p.z0, z1 = p.z0 + p.h;
  const rExt = p.dim / 2;
  const rInt = Math.max(0.5, rExt - p.parede);

  if (p.redondo) {
    for (let i = 0; i < lados; i++) {
      const a0 = (2 * Math.PI * i) / lados;
      const a1 = (2 * Math.PI * (i + 1)) / lados;
      const am = (a0 + a1) / 2;

      const nx = Math.cos(am), ny = Math.sin(am);

      const xe0 = p.cx + rExt * Math.cos(a0), ye0 = p.cy + rExt * Math.sin(a0);
      const xe1 = p.cx + rExt * Math.cos(a1), ye1 = p.cy + rExt * Math.sin(a1);
      const xi0 = p.cx + rInt * Math.cos(a0), yi0 = p.cy + rInt * Math.sin(a0);
      const xi1 = p.cx + rInt * Math.cos(a1), yi1 = p.cy + rInt * Math.sin(a1);

      out.push({ kind: 'side', suave: true, normal: [nx, ny, 0],
        luz: 0.70 + 0.26 * ((nx + ny) / Math.SQRT2),
        quad: [[xe0, ye0, z0], [xe1, ye1, z0], [xe1, ye1, z1], [xe0, ye0, z1]] });

      out.push({ kind: 'interior', suave: true, normal: [-nx, -ny, 0],
        luz: 0.32,
        quad: [[xi0, yi0, z0], [xi1, yi1, z0], [xi1, yi1, z1], [xi0, yi0, z1]] });

      out.push({ kind: 'top', suave: true, normal: [0, 0, 1], luz: 1.16,
        quad: [[xe0, ye0, z1], [xe1, ye1, z1], [xi1, yi1, z1], [xi0, yi0, z1]] });

      out.push({ kind: 'bottom', suave: true, normal: [0, 0, -1], luz: 0.52,
        quad: [[xe0, ye0, z0], [xe1, ye1, z0], [xi1, yi1, z0], [xi0, yi0, z0]] });
    }

    out.push({ kind: 'interior', suave: true, normal: [0, 0, 1], luz: 0.24,
      quad: anel(p.cx, p.cy, rInt, z0, lados) });

  } else {
    const a = p.dim / 2;
    const ai = Math.max(0.5, a - p.parede);
    const base = [[a, a], [-a, a], [-a, -a], [a, -a]];
    const nrm = [[0, 1], [-1, 0], [0, -1], [1, 0]];

    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const nx = nrm[i][0], ny = nrm[i][1];
      const b0 = base[i], b1 = base[j];

      const P = (x, y, z) => [p.cx + x, p.cy + y, z];

      out.push({ kind: 'side', suave: false, normal: [nx, ny, 0],
        luz: 0.70 + 0.26 * ((nx + ny) / Math.SQRT2),
        quad: [P(b0[0], b0[1], z0), P(b1[0], b1[1], z0),
               P(b1[0], b1[1], z1), P(b0[0], b0[1], z1)] });

      out.push({ kind: 'interior', suave: false, normal: [-nx, -ny, 0],
        luz: 0.32,
        quad: [P(b0[0] * ai / a, b0[1] * ai / a, z0),
               P(b1[0] * ai / a, b1[1] * ai / a, z0),
               P(b1[0] * ai / a, b1[1] * ai / a, z1),
               P(b0[0] * ai / a, b0[1] * ai / a, z1)] });

      out.push({ kind: 'top', suave: false, normal: [0, 0, 1], luz: 1.12,
        quad: [P(b0[0], b0[1], z1), P(b1[0], b1[1], z1),
               P(b1[0] * ai / a, b1[1] * ai / a, z1),
               P(b0[0] * ai / a, b0[1] * ai / a, z1)] });

      out.push({ kind: 'bottom', suave: false, normal: [0, 0, -1], luz: 0.52,
        quad: [P(b0[0], b0[1], z0), P(b1[0], b1[1], z0),
               P(b1[0] * ai / a, b1[1] * ai / a, z0),
               P(b0[0] * ai / a, b0[1] * ai / a, z0)] });
    }

    out.push({ kind: 'interior', suave: false, normal: [0, 0, 1], luz: 0.24,
      quad: [[p.cx - ai, p.cy - ai, z0], [p.cx + ai, p.cy - ai, z0],
             [p.cx + ai, p.cy + ai, z0], [p.cx - ai, p.cy + ai, z0]] });
  }

  return out;
}

function facesDaPeca(p, lados){
  if (p.tipo === 'cilindro') return facesDoCilindro(p, lados.cilindro);
  if (p.tipo === 'cone') return facesDoCone(p, lados.cone);
  if (p.tipo === 'piramide') return facesDaPiramide(p);
  if (p.tipo === 'tubo') return facesDoTubo(p, lados.tubo);
  return facesDaCaixa(p);
}

/**
 * Todas as faces em 3D, sem culling.
 * detalhe reduz o numero de lados na animacao, que e orcamento de quadro.
 */
export function faces3D(barras, corBase, detalhe){
  const lados = detalhe
    ? { cilindro: detalhe, cone: detalhe, tubo: detalhe }
    : { cilindro: LADOS_COLUNA, cone: LADOS_CONE, tubo: LADOS_TUBO };

  const faces = [];

  for (const p of barras) {
    const bb = bboxPeca(p);
    const profPeca = bb.max[0] + bb.max[1] + bb.max[2];
    const meiaExt = ((bb.max[0] - bb.min[0]) +
                     (bb.max[1] - bb.min[1]) +
                     (bb.max[2] - bb.min[2])) / 2;

    const cor = p.cor || corBase;
    const grupo = p.grupo || 'corpo';
    const centro = [
      (bb.min[0] + bb.max[0]) / 2,
      (bb.min[1] + bb.max[1]) / 2,
      (bb.min[2] + bb.max[2]) / 2
    ];

    for (const f of facesDaPeca(p, lados)) {
      faces.push({
        quad: f.quad,
        normal: f.normal,
        luz: f.luz,
        suave: f.suave === true,
        kind: f.kind,
        caixa: f.caixa || null,
        camada: p.camada ?? 0,
        grupo,
        centro,
        profPeca,
        meiaExt,
        cor,
        tipo: p.tipo || 'caixa'
      });
    }
  }

  return faces;
}

/* ---------- Culling e ordenacao ---------- */
export function filtrarOrdenar(faces){
  const visiveis = [];

  for (const f of faces) {
    if (f.normal[0] + f.normal[1] + f.normal[2] <= 0.0001) continue;

    let s = 0;
    for (const pt of f.quad) s += pt[0] + pt[1] + pt[2];

    visiveis.push({
      ...f,
      profPeca: f.profPeca,
      profFace: s / f.quad.length
    });
  }

  visiveis.sort((a, b) =>
    (a.camada - b.camada) ||
    (a.profPeca - b.profPeca) ||
    (a.profFace - b.profFace)
  );

  return visiveis;
}

/* ---------- Projecao ---------- */
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

export function projetarFaces(faces, escala, origem, modo){
  return faces.map(f => {
    let luz = f.luz;

    if (modo === 'animado') {
      const d = f.normal[0] * LUZ[0] + f.normal[1] * LUZ[1] + f.normal[2] * LUZ[2];
      luz = Math.max(0.42, Math.min(1.26, 0.58 + 0.80 * Math.max(0, d)));
    }

    const fill = sombrear(f.cor, luz);

    return {
      tela: f.quad.map(pt => project(pt, escala, origem)),
      fill,
      contorno: f.suave ? fill : sombrear(f.cor, luz * 0.72),
      kind: f.kind,
      caixa: f.caixa,
      tipo: f.tipo
    };
  });
}

/* ---------- Enquadramento ---------- */
export function computeView(barras, largura, altura, margem = 48, folga = 1){
  /*
   * Guarda de lista vazia. Sem ela, os limites ficam em Infinity, a escala
   * vira NaN e a origem tambem — o SVG sai inutilizavel em vez de vazio.
   * O desenhoTecnico ja tem essa guarda; aqui ela faltava.
   */
  if (!Array.isArray(barras) || barras.length === 0) {
    return {
      escala: 1,
      origem: [largura / 2, altura / 2],
      bounds: { min: [0, 0, 0], max: [0, 0, 0] }
    };
  }

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

  const escala = Math.min(utilL / largProj, utilA / altProj) * folga;

  const origem = [
    margem + (utilL - largProj * escala) / 2 - Math.min(...xs) * escala,
    margem + (utilA - altProj * escala) / 2 - Math.min(...ys) * escala
  ];

  return { escala, origem, bounds: { min, max } };
}

/* ---------- Transformacao rigida ---------- */
export function matrizEuler(rx, ry, rz){
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

  return [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy,     cy * sx,                cy * cx
  ];
}

export function transformar(f, centro, R, desloc){
  const quad = f.quad.map(p => {
    const dx = p[0] - centro[0], dy = p[1] - centro[1], dz = p[2] - centro[2];
    return [
      R[0] * dx + R[1] * dy + R[2] * dz + centro[0] + desloc[0],
      R[3] * dx + R[4] * dy + R[5] * dz + centro[1] + desloc[1],
      R[6] * dx + R[7] * dy + R[8] * dz + centro[2] + desloc[2]
    ];
  });

  const normal = [
    R[0] * f.normal[0] + R[1] * f.normal[1] + R[2] * f.normal[2],
    R[3] * f.normal[0] + R[4] * f.normal[1] + R[5] * f.normal[2],
    R[6] * f.normal[0] + R[7] * f.normal[1] + R[8] * f.normal[2]
  ];

  const c = [
    centro[0] + desloc[0],
    centro[1] + desloc[1],
    centro[2] + desloc[2]
  ];

  return {
    ...f,
    quad,
    normal,
    centro: c,

    /*
     * O veio da madeira e calculado a partir do `caixa`, que fica nas
     * coordenadas originais. Numa peca girada isso faria o veio descolar da
     * superficie, entao o campo e anulado: peca em movimento nao desenha
     * veio. Sem esta linha, o assento gira e a madeira fica parada.
     */
    caixa: null,

    profPeca: c[0] + c[1] + c[2] + (f.meiaExt || 0)
  };
}