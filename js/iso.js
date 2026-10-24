/**
 * Projecao isometrica e montagem de faces para o SVG.
 *
 * Projecao:
 *   x_tela = (x - y) * cos30
 *   y_tela = (x + y)/2 - z
 * com z positivo para cima e y da tela crescendo para baixo.
 *
 * A direcao (1,1,1) nao altera a posicao na tela, logo x + y + z e a
 * profundidade em relacao a camera. Ordenar por esse valor do menor para o
 * maior e o algoritmo do pintor: desenha longe primeiro, perto depois.
 */

const COS30 = Math.cos(Math.PI / 6);

// Iluminacao por orientacao da face
const SOMBRA = { top: 1.16, front: 0.94, side: 0.70 };

export function project([x, y, z], escala, origem) {
  return [
    origem[0] + (x - y) * COS30 * escala,
    origem[1] + ((x + y) * 0.5 - z) * escala,
  ];
}

/**
 * As tres faces visiveis de uma caixa alinhada aos eixos, para uma camera
 * em (1,1,1). As outras tres ficam sempre escondidas e nem sao geradas.
 */
function facesDaCaixa(p) {
  const X = p.x + p.dx;
  const Y = p.y + p.dy;
  const Z = p.z + p.dz;
  return [
    { kind: 'top',   quad: [[p.x, p.y, Z], [X, p.y, Z], [X, Y, Z], [p.x, Y, Z]] },
    { kind: 'front', quad: [[p.x, Y, p.z], [X, Y, p.z], [X, Y, Z], [p.x, Y, Z]] },
    { kind: 'side',  quad: [[X, p.y, p.z], [X, Y, p.z], [X, Y, Z], [X, p.y, Z]] },
  ];
}

export function computeView(barras, largura, altura, margem = 48) {
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

  // Projeta os 8 cantos da caixa envolvente com escala 1
  const cantos = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        cantos.push(project([x, y, z], 1, [0, 0]));
      }
    }
  }

  const xs = cantos.map((c) => c[0]);
  const ys = cantos.map((c) => c[1]);
  const largProj = Math.max(...xs) - Math.min(...xs);
  const altProj = Math.max(...ys) - Math.min(...ys);

  const utilL = largura - 2 * margem;
  const utilA = altura - 2 * margem;
  const escala = Math.min(utilL / largProj, utilA / altProj);

  const origem = [
    margem + (utilL - largProj * escala) / 2 - Math.min(...xs) * escala,
    margem + (utilA - altProj * escala) / 2 - Math.min(...ys) * escala,
  ];

  return { escala, origem, bounds: { min, max } };
}

function sombrear(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const canais = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return `rgb(${canais
    .map((v) => Math.max(0, Math.min(255, Math.round(v * k))))
    .join(',')})`;
}

export function buildFaces(barras, escala, origem, corBase) {
  const faces = [];

  for (const p of barras) {
    // Profundidade no canto mais proximo da camera.
    // Usada para ordenar pecas DENTRO da mesma camada, nunca entre camadas.
    const prof = (p.x + p.dx) + (p.y + p.dy) + (p.z + p.dz);

    for (const f of facesDaCaixa(p)) {
      const tela = f.quad.map((pt) => project(pt, escala, origem));
      const k = SOMBRA[f.kind];
      faces.push({
        kind: f.kind,
        tela,
        camada: p.camada ?? 0,
        prof,
        barras: p,
        fill: sombrear(corBase, k),
        contorno: sombrear(corBase, k * 0.72),
      });
    }
  }

  // Camada primeiro, profundidade depois.
  // Motivo: um par simetrico de pecas tem profundidades muito diferentes
  // (a peca da direita e sempre mais perto da camera). Com chave unica o par
  // era pintado em lados opostos do assento, e o resultado mudava com t.
  faces.sort((a, b) => (a.camada - b.camada) || (a.prof - b.prof));
  return faces;
}

  // Desenha longe primeiro. Todas as faces de uma mesma caixa compartilham
  // a chave, e como elas nao se sobrepoem entre si a ordem interna nao importa.
  faces.sort((a, b) => a.prof - b.prof);
  return faces;
}