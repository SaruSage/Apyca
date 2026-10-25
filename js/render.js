/**
 * Montagem do SVG da cadeira.
 *
 * montarSVG e o nivel baixo: recebe faces JA projetadas e devolve a string.
 * svgCadeira e o nivel alto, usado na tela e no memorial.
 * A animacao usa montarSVG diretamente, um quadro por vez.
 */

import { computeView, faces3D, filtrarOrdenar, projetarFaces, project } from './iso.js';
import { dimensoesExternas } from './chairModel.js';

const LARGURA = 860;
const ALTURA = 620;

function poly(pontos){
  return pontos.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
}

/** Veio da madeira sobre a face horizontal de uma CAIXA. */
function veios(caixa, escala, origem){
  const b = caixa;
  const menor = Math.min(b.dx, b.dy);
  const n = Math.min(7, Math.max(2, Math.round(menor / 14)));
  const z = b.z + b.dz;
  const linhas = [];

  for (let i = 1; i <= n; i++) {
    const k = i / (n + 1);
    const y = b.y + b.dy * k;
    const a = project([b.x, y, z], escala, origem);
    const c = project([b.x + b.dx, y, z], escala, origem);
    const op = 0.08 + 0.05 * ((i * 37) % 5) / 4;

    linhas.push(
      '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" ' +
      'x2="' + c[0].toFixed(1) + '" y2="' + c[1].toFixed(1) + '" ' +
      'stroke="#000" stroke-opacity="' + op.toFixed(3) + '" ' +
      'stroke-width="1.1" stroke-linecap="round"/>'
    );
  }
  return linhas.join('');
}

export function montarSVG({ largura, altura, idFiltro, sombra,
                            opacidadeSombra, faces, veiosFn }){
  const partes = [];

  if (sombra) {
    partes.push('<polygon points="' + poly(sombra) + '" fill="#000" ' +
      'fill-opacity="' + opacidadeSombra + '" filter="url(#' + idFiltro + ')"/>');
  }

  for (const f of faces) {
    partes.push('<polygon points="' + poly(f.tela) + '" fill="' + f.fill + '" ' +
      'stroke="' + f.contorno + '" stroke-width="0.9" stroke-linejoin="round"/>');

    if (veiosFn && f.kind === 'top' && f.caixa) {
      partes.push(veiosFn(f.caixa));
    }
  }

  return '<svg viewBox="0 0 ' + largura + ' ' + altura + '" width="100%" ' +
    'role="img" aria-label="Vista isometrica da cadeira">' +
      '<defs><filter id="' + idFiltro + '" x="-40%" y="-40%" ' +
      'width="180%" height="180%">' +
        '<feGaussianBlur stdDeviation="12"/>' +
      '</filter></defs>' +
      partes.join('') +
    '</svg>';
}

/** Poligono da sombra no piso, a partir dos limites da cadeira. */
export function sombraNoPiso(bounds, escala, origem, folga = 0.16){
  const m = folga * (bounds.max[0] - bounds.min[0]);
  return [
    [bounds.min[0] - m, bounds.min[1] - m, 0],
    [bounds.max[0] + m, bounds.min[1] - m, 0],
    [bounds.max[0] + m, bounds.max[1] + m, 0],
    [bounds.min[0] - m, bounds.max[1] + m, 0]
  ].map(c => project(c, escala, origem));
}

export function svgCadeira(barras, material, opcoes = {}){
  const largura = opcoes.largura || LARGURA;
  const altura = opcoes.altura || ALTURA;
  const margem = opcoes.margem === undefined ? 48 : opcoes.margem;
  const idFiltro = opcoes.idFiltro || 'borrao';
  const opacidadeSombra = opcoes.opacidadeSombra === undefined
    ? 0.5
    : opcoes.opacidadeSombra;
  const mostrarVeios = opcoes.veios === undefined
    ? (material.render && material.render.veios === true)
    : opcoes.veios;

  const vista = computeView(barras, largura, altura, margem);
  const faces = projetarFaces(
    filtrarOrdenar(faces3D(barras, material.cor)),
    vista.escala, vista.origem, 'estatico'
  );

  const sombra = sombraNoPiso(vista.bounds, vista.escala, vista.origem);

  const veiosFn = mostrarVeios
    ? (b) => veios(b, vista.escala, vista.origem)
    : null;

  return montarSVG({
    largura, altura, idFiltro, sombra, opacidadeSombra, faces, veiosFn
  });
}

/** Injeta o desenho no palco da pagina e devolve as dimensoes externas. */
export function renderCadeira(container, barras, material){
  container.innerHTML = svgCadeira(barras, material, {
    largura: LARGURA,
    altura: ALTURA,
    margem: 48,
    idFiltro: 'borrao',
    opacidadeSombra: 0.5
  });

  return dimensoesExternas(barras);
}