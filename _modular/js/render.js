/**
 * Desenha a cadeira num SVG. Recebe barras + material, devolve as dimensoes
 * externas para a legenda.
 */

import { buildFaces, computeView, project } from './iso.js';

const LARGURA = 860;
const ALTURA = 620;

function poly(pontos) {
  return pontos.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

/** Veio da madeira: linhas finas sobre as faces horizontais */
function veios(barras, escala, origem) {
  const menor = Math.min(barras.dx, barras.dy);
  const n = Math.min(7, Math.max(2, Math.round(menor / 14)));
  const z = barras.z + barras.dz;
  const linhas = [];

  for (let i = 1; i <= n; i++) {
    const k = i / (n + 1);
    const y = barras.y + barras.dy * k;
    const a = project([barras.x, y, z], escala, origem);
    const b = project([barras.x + barras.dx, y, z], escala, origem);
    const op = 0.08 + 0.05 * ((i * 37) % 5) / 4;

    linhas.push(
      `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" ` +
        `x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" ` +
        `stroke="#000" stroke-opacity="${op.toFixed(3)}" ` +
        `stroke-width="1.1" stroke-linecap="round"/>`
    );
  }
  return linhas.join('');
}

export function renderCadeira(container, barras, material) {
  const { escala, origem, bounds } = computeView(barras, LARGURA, ALTURA, 48);
  const faces = buildFaces(barras, escala, origem, material.cor);
  const mostrarVeios = material.render?.veios === true;

  const conteudo = [];

  // Sombra no piso, antes de tudo
  const m = 0.16 * (bounds.max[0] - bounds.min[0]);
  const sombra = [
    [bounds.min[0] - m, bounds.min[1] - m, 0],
    [bounds.max[0] + m, bounds.min[1] - m, 0],
    [bounds.max[0] + m, bounds.max[1] + m, 0],
    [bounds.min[0] - m, bounds.max[1] + m, 0],
  ].map((c) => project(c, escala, origem));

  conteudo.push(`<polygon points="${poly(sombra)}" fill="#000" fill-opacity="0.5" filter="url(#borrao)"/>`);

  // Faces, na ordem do algoritmo do pintor
  for (const f of faces) {
    conteudo.push(
      `<polygon points="${poly(f.tela)}" fill="${f.fill}" ` +
        `stroke="${f.contorno}" stroke-width="0.9" stroke-linejoin="round"/>`
    );
    if (mostrarVeios && f.kind === 'top') {
      conteudo.push(veios(f.barras, escala, origem));
    }
  }

  container.innerHTML = `
    <svg viewBox="0 0 ${LARGURA} ${ALTURA}" width="100%" role="img"
         aria-label="Vista isometrica da cadeira">
      <defs>
        <filter id="borrao" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="12"/>
        </filter>
      </defs>
      ${conteudo.join('')}
    </svg>`;

  return { largura: bounds.max[0] - bounds.min[0], profundidade: bounds.max[1] - bounds.min[1], altura: bounds.max[2] - bounds.min[2] };
}