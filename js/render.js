/**
 * Montagem do SVG da cadeira.
 *
 * montarSVG e o nivel baixo: recebe faces JA projetadas e devolve a string.
 * svgCadeira e o nivel alto, usado na tela e no memorial.
 * A animacao usa montarSVG diretamente, um quadro por vez.
 *
 * ID DO FILTRO DE SOMBRA
 * O id e sufixado com um contador de modulo. Sem isso, dois desenhos na mesma
 * pagina declaram o mesmo id, e a referencia url(#...) resolve sempre para o
 * PRIMEIRO na ordem do documento.
 *
 * VETOR DE FORCA (FLECHA ROXA SEMITRANSPARENTE)
 * Quando opcoes.vetorForca = { ativo: true, eX, eY, P } e fornecido, desenha
 * sobre o assento a flecha roxa semitransparente indicando o ponto exato de
 * aplicacao da carga P e as guias isometricas de deslocamento a partir da
 * centroide do assento.
 */

import { computeView, faces3D, filtrarOrdenar, projetarFaces, project } from './iso.js';
import { dimensoesExternas } from './chairModel.js';

const LARGURA = 860;
const ALTURA = 620;

/* Contador de instancias: garante id de filtro unico por desenho. */
let instancias = 0;

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

/**
 * Desenha a flecha roxa semitransparente representando o vetor de forca P
 * sobre a superficie superior do assento na posicao (xCentro + eX, yCentro + eY).
 */
export function svgVetorForca(barras, vista, vetorForca){
  if (!vetorForca || !vetorForca.ativo || !Array.isArray(barras)) return '';

  const assento = barras.find(b => b.grupo === 'assento');
  if (!assento) return '';

  const { escala, origem } = vista;
  const xCentro = assento.x + assento.dx / 2;
  const yCentro = assento.y + assento.dy / 2;
  const zTopo = assento.z + assento.dz;

  const eX = Number.isFinite(vetorForca.eX) ? vetorForca.eX : 0;
  const eY = Number.isFinite(vetorForca.eY) ? vetorForca.eY : 0;

  const xP = xCentro + eX;
  const yP = yCentro + eY;

  const ptCentro = project([xCentro, yCentro, zTopo], escala, origem);
  const ptMeioX = project([xP, yCentro, zTopo], escala, origem);
  const ptAplic = project([xP, yP, zTopo], escala, origem);

  const partes = ['<g class="vetor-forca" aria-label="Vetor de força aplicada">'];

  /* Guias tracejadas isometricas da centroide ate o ponto de aplicacao */
  const deslocado = Math.abs(eX) > 0.5 || Math.abs(eY) > 0.5;
  if (deslocado) {
    partes.push(
      '<circle cx="' + ptCentro[0].toFixed(1) + '" cy="' + ptCentro[1].toFixed(1) + '" ' +
      'r="3.2" fill="#c084fc" fill-opacity="0.65"/>'
    );
    if (Math.abs(eX) > 0.5) {
      partes.push(
        '<line x1="' + ptCentro[0].toFixed(1) + '" y1="' + ptCentro[1].toFixed(1) + '" ' +
        'x2="' + ptMeioX[0].toFixed(1) + '" y2="' + ptMeioX[1].toFixed(1) + '" ' +
        'stroke="#c084fc" stroke-opacity="0.68" stroke-width="1.6" stroke-dasharray="4 3"/>'
      );
    }
    if (Math.abs(eY) > 0.5) {
      partes.push(
        '<line x1="' + ptMeioX[0].toFixed(1) + '" y1="' + ptMeioX[1].toFixed(1) + '" ' +
        'x2="' + ptAplic[0].toFixed(1) + '" y2="' + ptAplic[1].toFixed(1) + '" ' +
        'stroke="#c084fc" stroke-opacity="0.68" stroke-width="1.6" stroke-dasharray="4 3"/>'
      );
    }
  }

  /* Anel isometrico no plano do assento marcando o ponto de contato */
  const ladosAnel = 24;
  const rExtMm = 18;
  const rIntMm = 6.5;
  const ptsAnelExt = [];
  const ptsAnelInt = [];
  for (let i = 0; i < ladosAnel; i++) {
    const ang = (2 * Math.PI * i) / ladosAnel;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    ptsAnelExt.push(project([xP + rExtMm * ca, yP + rExtMm * sa, zTopo], escala, origem));
    ptsAnelInt.push(project([xP + rIntMm * ca, yP + rIntMm * sa, zTopo], escala, origem));
  }

  partes.push(
    '<polygon points="' + poly(ptsAnelExt) + '" ' +
    'fill="#a855f7" fill-opacity="0.26" stroke="#d8b4fe" stroke-opacity="0.82" stroke-width="1.3"/>'
  );
  partes.push(
    '<polygon points="' + poly(ptsAnelInt) + '" ' +
    'fill="#9333ea" fill-opacity="0.58"/>'
  );

  /* Flecha vertical semitransparente em cor roxa apontando para o ponto */
  const px = ptAplic[0];
  const py = ptAplic[1];
  const compSeta = Math.max(62, Math.min(96, 150 * escala));
  const yTopo = Math.max(20, py - compSeta);
  const yPonta = py - 2;
  const yBasePonta = Math.max(yTopo + 16, yPonta - 23);
  const meiaLargHaste = 4.6;
  const meiaLargPonta = 12.5;

  const contornoFlecha = [
    [px - meiaLargHaste, yTopo],
    [px + meiaLargHaste, yTopo],
    [px + meiaLargHaste, yBasePonta],
    [px + meiaLargPonta, yBasePonta],
    [px, yPonta],
    [px - meiaLargPonta, yBasePonta],
    [px - meiaLargHaste, yBasePonta]
  ];

  const brilhoEsq = [
    [px - meiaLargHaste, yTopo],
    [px, yTopo],
    [px, yPonta],
    [px - meiaLargPonta, yBasePonta],
    [px - meiaLargHaste, yBasePonta]
  ];

  partes.push(
    '<polygon points="' + poly(contornoFlecha) + '" ' +
    'fill="#9333ea" fill-opacity="0.56" stroke="#e9d5ff" stroke-opacity="0.88" ' +
    'stroke-width="1.4" stroke-linejoin="round"/>'
  );
  partes.push(
    '<polygon points="' + poly(brilhoEsq) + '" ' +
    'fill="#d8b4fe" fill-opacity="0.22" stroke="none"/>'
  );

  /* Rotulo da forca P no topo da flecha */
  const textoP = Number.isFinite(vetorForca.P) && vetorForca.P > 0
    ? 'P = ' + Math.round(vetorForca.P) + ' N'
    : 'P';
  const yRotulo = Math.max(13, yTopo - 7);
  partes.push(
    '<text x="' + px.toFixed(1) + '" y="' + yRotulo.toFixed(1) + '" ' +
    'text-anchor="middle" font-family="system-ui,sans-serif" font-size="11.5" ' +
    'font-weight="600" fill="#e9d5ff" fill-opacity="0.92" ' +
    'stroke="#0b0f14" stroke-width="3" paint-order="stroke">' + textoP + '</text>'
  );

  partes.push('</g>');
  return partes.join('');
}

export function montarSVG({ largura, altura, idFiltro, sombra,
                            opacidadeSombra, faces, veiosFn, extraSvg }){
  const partes = [];

  /*
   * Sufixo por instancia. Tudo que referencia o filtro usa idFinal — o
   * <filter> do defs e o url(#...) do poligono da sombra. Se um dos dois
   * ficasse com o id cru, a referencia apontaria para o desenho errado.
   */
  const idFinal = (idFiltro || 'borrao') + '-' + (++instancias);

  if (sombra) {
    partes.push('<polygon points="' + poly(sombra) + '" fill="#000" ' +
      'fill-opacity="' + opacidadeSombra + '" filter="url(#' + idFinal + ')"/>');
  }

  for (const f of faces) {
    partes.push('<polygon points="' + poly(f.tela) + '" fill="' + f.fill + '" ' +
      'stroke="' + f.contorno + '" stroke-width="0.9" stroke-linejoin="round"/>');

    if (veiosFn && f.kind === 'top' && f.caixa) {
      partes.push(veiosFn(f.caixa));
    }
  }

  if (extraSvg) {
    partes.push(extraSvg);
  }

  return '<svg viewBox="0 0 ' + largura + ' ' + altura + '" width="100%" ' +
    'role="img" aria-label="Vista isométrica da cadeira">' +
      '<defs><filter id="' + idFinal + '" x="-40%" y="-40%" ' +
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

  const extraSvg = opcoes.vetorForca
    ? svgVetorForca(barras, vista, opcoes.vetorForca)
    : '';

  return montarSVG({
    largura, altura, idFiltro, sombra, opacidadeSombra, faces, veiosFn, extraSvg
  });
}

/** Injeta o desenho no palco da pagina e devolve as dimensoes externas. */
export function renderCadeira(container, barras, material, opcoes = {}){
  container.innerHTML = svgCadeira(barras, material, {
    largura: LARGURA,
    altura: ALTURA,
    margem: 48,
    idFiltro: 'borrao',
    opacidadeSombra: 0.5,
    vetorForca: opcoes.vetorForca || null
  });

  return dimensoesExternas(barras);
}
