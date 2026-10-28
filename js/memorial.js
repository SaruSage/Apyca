/**
 * Memorial de calculo imprimivel.
 *
 * Recebe o resultado do solver e devolve uma string HTML de documento.
 * Nao faz calculo estrutural: apenas formata o que o solver ja produziu,
 * mostrando expressao, substituicao e resultado de cada verificacao.
 *
 * FORMATO DAS TABELAS
 * Todas as tabelas usam DUAS colunas: rotulo a esquerda, resultado a direita.
 * A expressao e a substituicao aparecem numa linha secundaria, em fonte mono
 * menor, abaixo do item. Quatro colunas lado a lado estrangulam o texto no
 * papel; assim o documento respira e a leitura fica em duas camadas — valor
 * primeiro, conta depois, para quem quiser conferir.
 *
 * A numeracao das secoes e dinamica: a flambagem local so existe na secao
 * vazada, a estabilidade so existe no pedestal, o casal so existe com carga
 * excentrica e as travessas so existem no quadro de quatro pernas. Numeracao
 * fixa deixaria buracos na sequencia.
 *
 * CENTRO DE CARGA BIAXIAL
 * A posicao do centro de carga vem de ASSENTO via r.entrada, em dois eixos:
 * fracX/fracY (fracao de meia dimensao, -1 a +1) e eX/eY (deslocamento em
 * mm). O padrao e 0 nos dois eixos. Com 4 pernas a placa rigida distribui a
 * carga por flexao biaxial, e cada perna responde ao seu quadrante.
 *
 * O mesmo criterio se aplica as travessas: as vigas frontal e traseira
 * respondem ao deslocamento em Y, as laterais ao deslocamento em X.
 *
 * As pecas sao geradas UMA vez, no inicio do documento, e reaproveitadas na
 * figura isometrica, no desenho tecnico e na secao de massa.
 */

import { G, HIPOTESES, CADEIRA } from './constantes.js';
import { construirBarras, dimensoesExternas, volumePeca } from './chairModel.js';
import { svgCadeira } from './render.js';
import { desenhoTecnico } from './tecnico.js';

function num(v, casas = 2){
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function linha(rotulo, valor){
  return '<tr><th>' + rotulo + '</th><td class="num">' + valor + '</td></tr>';
}

function tabelaSimples(titulo, linhas){
  return '<table class="mem-tab"><caption>' + titulo + '</caption>' +
    '<tbody>' + linhas.join('') + '</tbody></table>';
}

/**
 * Item de calculo: rotulo e resultado na linha principal, expressao e
 * substituicao numa segunda linha, em fonte mono discreta.
 */
function cl(grandeza, expressao, substituicao, valor, unidade){
  const temSubst = substituicao && substituicao !== '—';

  return '<tr class="mem-item">' +
      '<th scope="row">' + grandeza + '</th>' +
      '<td class="num">' + valor +
        (unidade ? ' <span class="un">' + unidade + '</span>' : '') +
      '</td>' +
    '</tr>' +
    '<tr class="mem-item__calc">' +
      '<td colspan="2">' +
        '<span class="form">' + expressao + '</span>' +
        (temSubst
          ? ' <span class="sep">=</span> <span class="subst">' + substituicao + '</span>'
          : '') +
      '</td>' +
    '</tr>';
}

function tabelaCalc(titulo, linhas){
  return '<table class="mem-tab mem-tab--calculo"><caption>' + titulo +
    '</caption><tbody>' + linhas.join('') + '</tbody></table>';
}

/**
 * Figura isometrica. Fundo transparente: o SVG nao desenha retangulo, entao
 * no papel aparece apenas a peca e a sombra.
 */
function figuraCadeira(r, barras){
  const material = r.entrada.material;
  const dims = dimensoesExternas(barras);

  const svg = svgCadeira(barras, material, {
    largura: 860,
    altura: 620,
    margem: 40,
    idFiltro: 'borrao-memorial',
    opacidadeSombra: 0.16
  });

  const legenda = num(dims.largura / 10, 1) + ' × ' +
                  num(dims.profundidade / 10, 1) + ' × ' +
                  num(dims.altura / 10, 1) + ' cm';

  return '<figure class="mem-figura">' +
    '<div class="mem-figura__palco">' + svg + '</div>' +
    '<figcaption class="mem-figura__legenda">' +
      '<strong>Figura 1</strong> — ' + legenda +
      ' <span class="mem-figura__eixos">(largura × profundidade × altura)</span>' +
    '</figcaption>' +
  '</figure>';
}

export function gerarMemorial(r, dimsExternas){
  const hoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  if (!r.ok) {
    return '<h1>Memorial de cálculo</h1>' +
      '<p class="mem-sub">' + hoje + '</p>' +
      '<p class="mem-alerta">Não foi possível gerar o memorial: ' +
      r.erros.join(' ') + '</p>';
  }

  /* Numeracao dinamica: reinicia a cada geracao do documento. */
  let numero = 0;
  function sec(titulo, corpo){
    numero += 1;
    return '<section class="mem-sec"><h2>' + numero + '. ' + titulo +
      '</h2>' + corpo + '</section>';
  }

  const mat = r.entrada.material;
  const redonda = r.entrada.forma === 'redonda';
  const vaz = r.entrada.vazada;
  const n = r.entrada.numPernas;
  const temEncosto = r.entrada.comEncosto;

  const t = r.entrada.t;
  const H = r.entrada.H;
  const m = r.entrada.m;

  /*
   * Centro de carga: fracao de meia dimensao em cada eixo, e o deslocamento
   * em mm que dela deriva. eRes e a resultante, usada no tombamento.
   */
  const fracX = r.entrada.fracX;
  const fracY = r.entrada.fracY;
  const eX = r.entrada.eX;
  const eY = r.entrada.eY;
  const eRes = r.entrada.eRes;

  const centrada = Math.abs(fracX) < 0.005 && Math.abs(fracY) < 0.005;

  const ep = r.secao.parede;
  const di = r.secao.interna;

  const estab = r.estabilidade;
  const as = r.assento;

  /*
   * Normalizacao defensiva das dimensoes do assento. O solver atual devolve
   * b, p, h, faixa, folgaX e folgaY. Se este documento for gerado com um
   * solver anterior, os campos ausentes caem nos valores derivados da
   * largura — o memorial nunca imprime NaN.
   */
  const aLarg = Number.isFinite(as.b) ? as.b : CADEIRA.L + 2 * CADEIRA.folga;
  const aProf = Number.isFinite(as.p) ? as.p : aLarg;
  const aEsp = Number.isFinite(as.h) ? as.h : as.h;
  const aFaixa = Number.isFinite(as.faixa) ? as.faixa : Math.min(aLarg, aProf);
  const fX = Number.isFinite(as.folgaX) ? as.folgaX : (aLarg - CADEIRA.L) / 2;
  const fY = Number.isFinite(as.folgaY) ? as.folgaY : (aProf - CADEIRA.L) / 2;

  /* Balanco efetivo (com o deslocamento somado) e o nominal, sem ele. */
  const aNom = Number.isFinite(as.aNominal) ? as.aNominal : as.a;

  const Mtomb = estab ? r.forcas.P * estab.eRes : 0;
  const Mestab = estab ? (r.forcas.P + estab.pesoCadeira) * estab.braco : 0;

  /* Momentos externos, decompostos nos dois eixos. */
  const Mx = r.forcas.P * eY;   // momento em torno de X, gerado pelo deslocamento em Y
  const My = r.forcas.P * eX;   // momento em torno de Y, gerado pelo deslocamento em X

  const formaTxt = redonda ? 'Redonda — diâmetro t' : 'Quadrada — lado t';
  const secaoTxt = vaz ? 'Tubular (vazada)' : 'Maciça';
  const pernasTxt = n === 1 ? '1 — pedestal central' : '4 — quadro de pernas';

  let h = '';

  h += '<h1>Memorial de cálculo estrutural</h1>';
  h += '<p class="mem-sub">Apyca · ' + hoje + '</p>';
  h += '<p class="mem-fonte">Fonte das propriedades dos materiais: ' +
    mat.fonte + '. Coeficiente de segurança adotado: ' + num(mat.CS, 1) +
    ', decisão de projeto e não valor de tabela.</p>';

  /* As pecas sao geradas uma unica vez e reaproveitadas na figura, no
     desenho tecnico e na secao de massa. */
  const barras = construirBarras(
    t, H, mat, r.entrada.forma, n, vaz, ep, temEncosto
  );

  h += figuraCadeira(r, barras);

  /* ---------- 1. Dados de entrada ---------- */
  const linhasEntrada = [
    linha('Material', mat.nome),
    linha('Módulo de elasticidade (E)', num(mat.E, 0) + ' MPa'),
    linha('Massa específica (ρ)', num(mat.rho, 0) + ' kg/m³'),
    linha('Coeficiente de segurança (CS)', num(mat.CS, 2))
  ];

  if (Number.isFinite(mat.sigmaEscoamento)) {
    linhasEntrada.push(linha('Tensão de escoamento (σ<sub>e</sub>)',
      num(mat.sigmaEscoamento, 1) + ' MPa'));
  }
  if (Number.isFinite(mat.sigmaRuptura)) {
    linhasEntrada.push(linha('Tensão de ruptura (σ<sub>r</sub>)',
      num(mat.sigmaRuptura, 1) + ' MPa'));
  }

  linhasEntrada.push(
    linha('Tensão limite adotada (σ<sub>lim</sub>)',
      num(mat.sigmaLimite, 1) + ' MPa'),
    linha('Formato da seção da perna', formaTxt),
    linha('Seção da perna', secaoTxt),
    linha('Encosto', temEncosto ? 'Presente' : 'Ausente — configuração de banco'),
    linha('Dimensão externa da perna (t)', num(t, 1) + ' mm'),
    linha('Altura da perna (H)', num(H, 1) + ' mm'),
    linha('Massa do usuário (m)', num(m, 1) + ' kg'),
    linha('Número de pernas', pernasTxt)
  );

  if (vaz) {
    linhasEntrada.push(linha('Parede da tubeira (e<sub>p</sub>)',
      num(ep, 2) + ' mm'));
  }

  linhasEntrada.push(
    linha('Largura do assento (a<sub>L</sub>)', num(aLarg, 0) + ' mm'),
    linha('Profundidade do assento (a<sub>P</sub>)', num(aProf, 0) + ' mm'),
    linha('Espessura do assento (h<sub>as</sub>)', num(aEsp, 1) + ' mm'),
    linha('Centro de carga — eixo X',
      num(fracX * 100, 0) + '% da meia largura'),
    linha('Centro de carga — eixo Y',
      num(fracY * 100, 0) + '% da meia profundidade'),
    linha('Deslocamento do centro de carga',
      num(eX, 1) + ' mm em X · ' + num(eY, 1) + ' mm em Y' +
      (centrada ? ' — carga centrada' : ''))
  );

  if (dimsExternas) {
    linhasEntrada.push(linha('Dimensões externas',
      num(dimsExternas.altura / 10, 1) + ' × ' +
      num(dimsExternas.largura / 10, 1) + ' × ' +
      num(dimsExternas.profundidade / 10, 1) + ' cm'));
  }

  h += sec('Dados de entrada',
    tabelaSimples('Configuração analisada', linhasEntrada));

  /* ---------- 2. Premissas ---------- */
  const linhasPrem = [
    linha('Aceleração da gravidade (g)', num(G, 2) + ' m/s²'),
    linha('Lado do quadro de pernas (L)', num(HIPOTESES.L, 0) + ' mm'),
    linha('Centro de carga — eixo X', num(fracX * 100, 0) + '%'),
    linha('Centro de carga — eixo Y', num(fracY * 100, 0) + '%'),
    linha('Fator de comprimento efetivo (K)', num(r.flambagem.K, 2) +
      (n === 1 ? ' — coluna engastada e livre' : ' — perna entre apoios')),
    linha('Massa própria da cadeira', num(r.massa.total, 2) +
      ' kg — calculada da geometria')
  ];

  if (n === 1) {
    linhasPrem.push(linha('Raio da base do pé',
      num(CADEIRA.coneRaioBase, 0) + ' mm'));
    linhasPrem.push(linha('Fração do lado da pirâmide',
      num(CADEIRA.fracaoLadoPiramide, 3) + ' do diâmetro do cone'));
  }
  if (r.travessas) {
    linhasPrem.push(linha('Quadro de travessas',
      '4 vigas, seção ' + num(r.travessas.b, 1) + ' × ' +
      num(r.travessas.h, 1) + ' mm, ' +
      (r.travessas.vazada
        ? 'tubular com parede ' + num(r.travessas.parede, 2) + ' mm'
        : 'maciça')));
  }

  h += sec('Premissas de projeto',
    tabelaSimples('Hipóteses adotadas', linhasPrem));

  /* ---------- 3. Desenho técnico ---------- */
  h += sec('Desenho técnico',
    '<figure class="mem-figura mem-figura--tecnico">' +
      '<div class="mem-figura__prancha">' + desenhoTecnico(barras) + '</div>' +
      '<figcaption class="mem-figura__legenda">' +
        '<strong>Figura 2</strong> — Vistas ortográficas na mesma escala, ' +
        'com cotas em cm: dimensões externas, altura do assento, espessura ' +
        'das pernas e, no pedestal, a base e a altura do pé.' +
      '</figcaption>' +
    '</figure>');

  /* ---------- 4. Propriedades da seção da perna ---------- */
  let exprA, substA, exprI, substI;

  if (vaz) {
    exprA = redonda ? 'π/4·[t² − (t−2e<sub>p</sub>)²]' : 't² − (t−2e<sub>p</sub>)²';
    exprI = redonda ? 'π/64·[t⁴ − (t−2e<sub>p</sub>)⁴]' : '[t⁴ − (t−2e<sub>p</sub>)⁴]/12';
    substA = redonda
      ? 'π/4·[' + num(t, 1) + '² − ' + num(di, 2) + '²]'
      : num(t, 1) + '² − ' + num(di, 2) + '²';
    substI = redonda
      ? 'π/64·[' + num(t, 1) + '⁴ − ' + num(di, 2) + '⁴]'
      : '[' + num(t, 1) + '⁴ − ' + num(di, 2) + '⁴]/12';
  } else {
    exprA = redonda ? 'π·t²/4' : 't²';
    exprI = redonda ? 'π·t⁴/64' : 't⁴/12';
    substA = redonda ? 'π·' + num(t, 1) + '²/4' : num(t, 1) + '²';
    substI = redonda ? 'π·' + num(t, 1) + '⁴/64' : num(t, 1) + '⁴/12';
  }

  const linhasSecao = [
    cl('Área (A)', exprA, substA, num(r.secao.A, 2), 'mm²'),
    cl('Momento de inércia (I)', exprI, substI, num(r.secao.I, 2), 'mm⁴'),
    cl('Distância à fibra extrema (c)', 't/2',
      num(t, 1) + '/2', num(r.secao.c, 2), 'mm'),
    cl('Módulo resistente (W)', 'I/c',
      num(r.secao.I, 2) + '/' + num(r.secao.c, 2),
      num(r.secao.W, 2), 'mm³'),
    cl('Raio de giração (r)', '√(I/A)',
      '√(' + num(r.secao.I, 2) + '/' + num(r.secao.A, 2) + ')',
      num(r.secao.r, 3), 'mm')
  ];

  if (vaz) {
    linhasSecao.splice(1, 0,
      cl('Dimensão interna (d<sub>i</sub>)', 't − 2·e<sub>p</sub>',
        num(t, 1) + ' − 2·' + num(ep, 2),
        num(di, 2), 'mm'));
  }

  h += sec('Propriedades da seção transversal da perna',
    tabelaCalc('Área, inércia e resistência', linhasSecao));

  /* ---------- 5. Massa por parte ---------- */
  const somaVolume = (grupos) => barras
    .filter(p => grupos.indexOf(p.grupo) >= 0)
    .reduce((s, p) => s + volumePeca(p), 0);

  const volPernas = somaVolume(['perna0', 'perna1', 'perna2', 'perna3', 'coluna']);
  const volPe = somaVolume(['pe']);
  const volAssento = somaVolume(['assento']);
  const volPostes = somaVolume(['poste0', 'poste1']);
  const volEncosto = somaVolume(['encosto']);
  const volTravessas = somaVolume(['travessa0', 'travessa1', 'travessa2', 'travessa3']);

  const mDe = (mm3) => (mm3 / 1e9) * mat.rho;

  const linhasMassa = [
    cl('Pernas', 'V · ρ',
      num(volPernas / 1e9, 6) + ' · ' + num(mat.rho, 0),
      num(mDe(volPernas), 3), 'kg')
  ];

  if (n === 1) {
    linhasMassa.push(cl('Pé do pedestal', 'V · ρ',
      num(volPe / 1e9, 6) + ' · ' + num(mat.rho, 0),
      num(mDe(volPe), 3), 'kg'));
  }

  linhasMassa.push(cl('Assento', 'V · ρ',
    num(volAssento / 1e9, 6) + ' · ' + num(mat.rho, 0),
    num(mDe(volAssento), 3), 'kg'));

  if (r.travessas) {
    linhasMassa.push(cl('Travessas do assento', 'V · ρ',
      num(volTravessas / 1e9, 6) + ' · ' + num(mat.rho, 0),
      num(mDe(volTravessas), 3), 'kg'));
  }

  if (temEncosto) {
    linhasMassa.push(cl('Postes do encosto', 'V · ρ',
      num(volPostes / 1e9, 6) + ' · ' + num(mat.rho, 0),
      num(mDe(volPostes), 3), 'kg'));
    linhasMassa.push(cl('Painel do encosto', 'V · ρ',
      num(volEncosto / 1e9, 6) + ' · ' + num(mat.rho, 0),
      num(mDe(volEncosto), 3), 'kg'));
  }

  linhasMassa.push(cl('Massa total', 'Σ V · ρ', '—',
    num(r.massa.total, 3), 'kg'));

  h += sec('Massa e peso próprio',
    tabelaCalc('Volume de cada parte e massa resultante', linhasMassa));

  /* ---------- 6. Esforços ---------- */
  const linhasEsforcos = [
    cl('Carga do usuário (P)', 'm·g',
      num(m, 1) + '·' + num(G, 2), num(r.forcas.P, 2), 'N'),
    cl('Peso próprio da cadeira (W<sub>c</sub>)', 'm<sub>cad</sub>·g',
      num(r.massa.total, 3) + '·' + num(G, 2),
      num(r.massa.total * G, 2), 'N')
  ];

  if (n === 1) {
    linhasEsforcos.push(cl('Esforço normal (N)', 'P + W<sub>c</sub>',
      num(r.forcas.P, 2) + ' + ' + num(r.massa.total * G, 2),
      num(r.forcas.Nmax, 2), 'N'));
    linhasEsforcos.push(cl('Momento em torno de X', 'M<sub>x</sub> = P·e<sub>Y</sub>',
      num(r.forcas.P, 2) + '·' + num(eY, 1),
      num(Mx, 2), 'N·mm'));
    linhasEsforcos.push(cl('Momento em torno de Y', 'M<sub>y</sub> = P·e<sub>X</sub>',
      num(r.forcas.P, 2) + '·' + num(eX, 1),
      num(My, 2), 'N·mm'));
    linhasEsforcos.push(cl('Momento equivalente na seção',
      redonda ? '[(M<sub>x</sub>)² + (M<sub>y</sub>)²]<sup>1/2</sup>'
              : '|M<sub>x</sub>| + |M<sub>y</sub>|',
      redonda
        ? '[(' + num(Mx, 2) + ')² + (' + num(My, 2) + ')²]<sup>1/2</sup>'
        : num(Math.abs(Mx), 2) + ' + ' + num(Math.abs(My), 2),
      num(r.forcas.Mperna, 2), 'N·mm'));
  } else {
    linhasEsforcos.push(cl('Reação média por perna', '(P + W<sub>c</sub>)/n',
      '(' + num(r.forcas.P, 2) + ' + ' + num(r.massa.total * G, 2) +
      ')/4', num(r.forcas.Nmedio, 2), 'N'));
    linhasEsforcos.push(cl('Parcela da excentricidade em X',
      'ΔN<sub>x</sub> = P·|e<sub>X</sub>|/(2·(L − t))',
      num(r.forcas.P, 2) + '·' + num(Math.abs(eX), 1) + '/(2·' +
      num(r.forcas.bracoBinario, 1) + ')',
      num(r.forcas.dNx, 2), 'N'));
    linhasEsforcos.push(cl('Parcela da excentricidade em Y',
      'ΔN<sub>y</sub> = P·|e<sub>Y</sub>|/(2·(L − t))',
      num(r.forcas.P, 2) + '·' + num(Math.abs(eY), 1) + '/(2·' +
      num(r.forcas.bracoBinario, 1) + ')',
      num(r.forcas.dNy, 2), 'N'));
    linhasEsforcos.push(cl('Reação máxima (N<sub>máx</sub>)',
      'N<sub>méd</sub> + ΔN<sub>x</sub> + ΔN<sub>y</sub>',
      num(r.forcas.Nmedio, 2) + ' + ' + num(r.forcas.dNx, 2) +
      ' + ' + num(r.forcas.dNy, 2),
      num(r.forcas.Nmax, 2), 'N'));
    linhasEsforcos.push(cl('Reação mínima (N<sub>mín</sub>)',
      'N<sub>méd</sub> − ΔN<sub>x</sub> − ΔN<sub>y</sub>',
      num(r.forcas.Nmedio, 2) + ' − ' + num(r.forcas.dNx, 2) +
      ' − ' + num(r.forcas.dNy, 2),
      num(r.forcas.Nmin, 2), 'N'));
  }

  h += sec('Ações e esforços solicitantes',
    tabelaCalc('Transmissão das cargas', linhasEsforcos));

  /* ---------- 6b. Casal de equilíbrio (só com carga excêntrica) ---------- */
  if (n === 4 && r.forcas.Mperna === 0 && !centrada) {
    h += sec('Equilíbrio do momento de excentricidade',
      tabelaCalc('Casal entre as pernas', [
        cl('Momento em torno de X', 'M<sub>x</sub> = P·e<sub>Y</sub>',
          num(r.forcas.P, 2) + '·' + num(eY, 1),
          num(Mx, 2), 'N·mm'),
        cl('Momento em torno de Y', 'M<sub>y</sub> = P·e<sub>X</sub>',
          num(r.forcas.P, 2) + '·' + num(eX, 1),
          num(My, 2), 'N·mm'),
        cl('Momento resultante', 'P·e<sub>res</sub>',
          num(r.forcas.P, 2) + '·' + num(eRes, 1),
          num(r.forcas.P * eRes, 2), 'N·mm'),
        cl('Casal resistente nas pernas', 'ΔN·(2·(L − t))',
          num(r.forcas.dN, 2) + '·(2·' + num(r.forcas.bracoBinario, 1) + ')',
          num(r.forcas.dN * 2 * r.forcas.bracoBinario, 2), 'N·mm'),
        cl('Momento fletor na perna', 'nulo — resistido pelo casal',
          '—', num(0, 2), 'N·mm')
      ]));
  }

  /* ---------- 7. Tensões na perna ---------- */
  const linhasPerna = [
    cl('Tensão axial (σ<sub>a</sub>)', 'N<sub>máx</sub>/A',
      num(r.forcas.Nmax, 2) + '/' + num(r.secao.A, 2),
      num(r.tensoes.sigmaAxial, 3), 'MPa')
  ];

  if (r.forcas.Mperna > 0) {
    linhasPerna.push(cl('Tensão de flexão (σ<sub>f</sub>)', 'M·c/I',
      num(r.forcas.Mperna, 2) + '·' + num(r.secao.c, 2) + '/' +
      num(r.secao.I, 2),
      num(r.tensoes.sigmaFlexao, 3), 'MPa'));
  } else {
    linhasPerna.push(cl('Tensão de flexão (σ<sub>f</sub>)',
      'nula — perna de quadro, sem momento aplicado', '—',
      num(0, 3), 'MPa'));
  }

  linhasPerna.push(
    cl('Tensão máxima (σ<sub>máx</sub>)', 'σ<sub>a</sub> + σ<sub>f</sub>',
      num(r.tensoes.sigmaAxial, 3) + ' + ' + num(r.tensoes.sigmaFlexao, 3),
      num(r.tensoes.sigmaMax, 3), 'MPa'),
    cl('Tensão admissível (σ<sub>adm</sub>)', 'σ<sub>lim</sub>/CS',
      num(mat.sigmaLimite, 1) + '/' + num(mat.CS, 2),
      num(r.tensoes.sigmaAdm, 3), 'MPa'),
    cl('Utilização', 'σ<sub>máx</sub>/σ<sub>adm</sub>',
      num(r.tensoes.sigmaMax, 3) + '/' + num(r.tensoes.sigmaAdm, 3),
      num(r.tensoes.utilizacao * 100, 1), '%')
  );

  h += sec('Verificação da tensão normal na perna',
    tabelaCalc('Flexo-compressão na seção', linhasPerna));

  /* ---------- 8. Flambagem global ---------- */
  h += sec('Verificação da flambagem global',
    tabelaCalc('Estabilidade da coluna', [
      cl('Índice de esbeltez (λ)', 'K·H/r',
        num(r.flambagem.K, 2) + '·' + num(H, 1) + '/' + num(r.secao.r, 3),
        num(r.flambagem.lambda, 1), '—'),
      cl('Carga crítica (P<sub>cr</sub>)', 'π²·E·I/(K·H)²',
        'π²·' + num(mat.E, 0) + '·' + num(r.secao.I, 2) + '/(' +
        num(r.flambagem.K, 2) + '·' + num(H, 1) + ')²',
        num(r.flambagem.Pcr, 2), 'N'),
      cl('Carga crítica admissível', 'P<sub>cr</sub>/CS',
        num(r.flambagem.Pcr, 2) + '/' + num(mat.CS, 2),
        num(r.flambagem.NcrAdm, 2), 'N'),
      cl('Utilização', 'N<sub>máx</sub>/N<sub>cr,adm</sub>',
        num(r.forcas.Nmax, 2) + '/' + num(r.flambagem.NcrAdm, 2),
        num(r.flambagem.utilizacaoFlambagem * 100, 1), '%')
    ]));

  /* ---------- 9. Flambagem local (só vazada) ---------- */
  if (r.flambagemLocal) {
    const fl = r.flambagemLocal;
    h += sec('Verificação da flambagem local da parede',
      tabelaCalc('Esbeltez da parede do perfil tubular', [
        cl('Parede (e<sub>p</sub>)', 'informada no projeto',
          '—', num(ep, 2), 'mm'),
        cl('Dimensão interna (d<sub>i</sub>)', 't − 2·e<sub>p</sub>',
          num(t, 1) + ' − 2·' + num(ep, 2),
          num(di, 2), 'mm'),
        cl('Relação d<sub>i</sub>/e<sub>p</sub>', 'd<sub>i</sub>/e<sub>p</sub>',
          num(di, 2) + '/' + num(ep, 2),
          num(fl.lambdaLocal, 2), '—'),
        cl('Limite', '1,40·√(E/σ<sub>lim</sub>)',
          '1,40·√(' + num(mat.E, 0) + '/' + num(mat.sigmaLimite, 1) + ')',
          num(fl.lambdaLimite, 2), '—'),
        cl('Utilização', 'λ<sub>local</sub>/λ<sub>lim</sub>',
          num(fl.lambdaLocal, 2) + '/' + num(fl.lambdaLimite, 2),
          num(fl.utilizacao * 100, 1), '%')
      ]));
  }

  /* ---------- 10. Assento em balanço ---------- */
  const linhasBalanco = [
    cl('Dimensões do assento (a<sub>L</sub> × a<sub>P</sub> × h<sub>as</sub>)',
      'configuradas em separado da perna', '—',
      num(aLarg, 0) + ' × ' + num(aProf, 0) + ' × ' + num(aEsp, 1),
      'mm'),
    cl('Sobrepasso nominal (a<sub>n</sub>)',
      n === 1 ? 'a<sub>L</sub>/2 − t/2' : 'máx[(a<sub>L</sub>−L)/2 , (a<sub>P</sub>−L)/2]',
      n === 1
        ? num(aLarg / 2, 0) + ' − ' + num(t / 2, 1)
        : 'máx[' + num(fX, 1) + ' ; ' + num(fY, 1) + ']',
      num(aNom, 1), 'mm'),
    cl('Sobrepasso em X', '(a<sub>L</sub> − L)/2',
      '(' + num(aLarg, 0) + ' − ' + num(CADEIRA.L, 0) + ')/2',
      num(fX, 1), 'mm'),
    cl('Sobrepasso em Y', '(a<sub>P</sub> − L)/2',
      '(' + num(aProf, 0) + ' − ' + num(CADEIRA.L, 0) + ')/2',
      num(fY, 1), 'mm')
  ];

  if (n === 4) {
    linhasBalanco.push(cl('Balanço de cálculo com a carga deslocada',
      'a = a<sub>n</sub> + máx(|e<sub>X</sub>|, |e<sub>Y</sub>|)',
      num(aNom, 1) + ' + ' + num(Math.max(Math.abs(eX), Math.abs(eY)), 1),
      num(as.a, 1), 'mm'));
  } else {
    linhasBalanco.push(cl('Balanço de cálculo',
      'a<sub>L</sub>/2 − t/2 (já é a condição de borda)',
      '—', num(as.a, 1), 'mm'));
  }

  linhasBalanco.push(
    cl('Largura da faixa (b<sub>f</sub>)', 'mín(a<sub>L</sub>, a<sub>P</sub>)',
      'mín(' + num(aLarg, 0) + ' ; ' + num(aProf, 0) + ')',
      num(aFaixa, 0), 'mm'),
    cl('Momento no engaste (M<sub>a</sub>)', 'P·a',
      num(r.forcas.P, 2) + '·' + num(as.a, 1),
      num(as.M, 2), 'N·mm'),
    cl('Módulo resistente (W<sub>a</sub>)', 'b<sub>f</sub>·h<sub>as</sub>²/6',
      num(aFaixa, 0) + '·' + num(aEsp, 1) + '²/6',
      num(as.W, 2), 'mm³'),
    cl('Tensão de flexão (σ<sub>as</sub>)', 'M<sub>a</sub>/W<sub>a</sub>',
      num(as.M, 2) + '/' + num(as.W, 2),
      num(as.sigma, 3), 'MPa'),
    cl('Utilização à flexão', 'σ<sub>as</sub>/σ<sub>adm</sub>',
      num(as.sigma, 3) + '/' + num(r.tensoes.sigmaAdm, 3),
      num(as.utilizacao * 100, 1), '%'),
    cl('Momento de inércia (I<sub>a</sub>)', 'b<sub>f</sub>·h<sub>as</sub>³/12',
      num(aFaixa, 0) + '·' + num(aEsp, 1) + '³/12',
      num(as.I, 2), 'mm⁴'),
    cl('Flecha (δ<sub>a</sub>)', 'P·a³/(3·E·I<sub>a</sub>)',
      num(r.forcas.P, 2) + '·' + num(as.a, 1) + '³/(3·' +
      num(mat.E, 0) + '·' + num(as.I, 2) + ')',
      num(as.flecha, 4), 'mm'),
    cl('Flecha limite', 'a/' + CADEIRA.divisorFlechaAssento,
      num(as.a, 1) + '/' + CADEIRA.divisorFlechaAssento,
      num(as.flechaLimite, 4), 'mm'),
    cl('Utilização à flecha', 'δ<sub>a</sub>/δ<sub>lim</sub>',
      num(as.flecha, 4) + '/' + num(as.flechaLimite, 4),
      num(as.utilizacaoFlecha * 100, 1), '%')
  );

  h += sec('Verificação do assento em balanço',
    tabelaCalc(
      n === 1
        ? 'Placa em balanço a partir da face da coluna'
        : 'Sobrepasso do assento além do quadro de apoios',
      linhasBalanco));

  /* ---------- 11. Assento entre apoios (só com 4 pernas) ---------- */
  /*
   * O assento apoia no QUADRO: os quatro topos de perna nos cantos mais as
   * quatro travessas no vao entre elas, todos coplanares em z = H. A abertura
   * interna dessa moldura e L - 2b, e e esse o vao que a placa vence.
   *
   * Normalizacao defensiva: se este documento for gerado por um solver
   * anterior, que devolvia apenas L, o bTravessa e reconstruido a partir da
   * diferenca para que a substituicao impressa nunca minta.
   */
  if (r.assentoVao) {
    const asv = r.assentoVao;

    const vaoAss = Number.isFinite(asv.vaoLivre) ? asv.vaoLivre : asv.L;
    const bTv = Number.isFinite(asv.bTravessa)
      ? asv.bTravessa
      : (CADEIRA.L - vaoAss) / 2;
    const ladoQ = Number.isFinite(asv.ladoQuadro) ? asv.ladoQuadro : CADEIRA.L;

    h += sec('Verificação do assento entre apoios',
      tabelaCalc('Flexão da placa sobre o quadro de apoio', [
        cl('Lado do quadro de pernas (L)', 'entre faces externas',
          '—', num(ladoQ, 0), 'mm'),
        cl('Apoios da placa', 'topos de perna + travessas',
          '4 topos de ' + num(t, 1) + ' mm + 4 vigas', 'apoio contínuo', ''),
        cl('Largura da travessa (b)', 'seção transversal da viga',
          '—', num(bTv, 1), 'mm'),
        cl('Vão livre do assento (L<sub>v</sub>)', 'L − 2·b',
          num(ladoQ, 0) + ' − 2·' + num(bTv, 1),
          num(vaoAss, 0), 'mm'),
        cl('Área carregada (A<sub>as</sub>)', 'a<sub>L</sub>·a<sub>P</sub>',
          num(aLarg, 0) + '·' + num(aProf, 0),
          num(asv.area, 0), 'mm²'),
        cl('Pressão uniforme (q)', 'P/A<sub>as</sub>',
          num(r.forcas.P, 2) + '/' + num(asv.area, 0),
          num(asv.q, 6), 'N/mm²'),
        cl('Momento por unidade de largura', 'q·L<sub>v</sub>²/16',
          num(asv.q, 6) + '·' + num(vaoAss, 0) + '²/16',
          num(asv.M, 3), 'N·mm/mm'),
        cl('Tensão de flexão (σ<sub>vão</sub>)', '6·M/h<sub>as</sub>²',
          '6·' + num(asv.M, 3) + '/' + num(asv.h, 1) + '²',
          num(asv.sigma, 3), 'MPa'),
        cl('Utilização à flexão', 'σ<sub>vão</sub>/σ<sub>adm</sub>',
          num(asv.sigma, 3) + '/' + num(r.tensoes.sigmaAdm, 3),
          num(asv.utilizacao * 100, 1), '%'),
        cl('Flecha (δ<sub>vão</sub>)', '5·q·L<sub>v</sub>⁴/(32·E·h<sub>as</sub>³)',
          '5·' + num(asv.q, 6) + '·' + num(vaoAss, 0) + '⁴/(32·' +
          num(mat.E, 0) + '·' + num(asv.h, 1) + '³)',
          num(asv.flecha, 4), 'mm'),
        cl('Flecha limite', 'L<sub>v</sub>/' + CADEIRA.divisorFlechaVao,
          num(vaoAss, 0) + '/' + CADEIRA.divisorFlechaVao,
          num(asv.flechaLimite, 4), 'mm'),
        cl('Utilização à flecha', 'δ<sub>vão</sub>/δ<sub>lim</sub>',
          num(asv.flecha, 4) + '/' + num(asv.flechaLimite, 4),
          num(asv.utilizacaoFlecha * 100, 1), '%')
      ]));
  }

  /* ---------- 12. Estabilidade ao tombamento (só no pedestal) ---------- */
  if (estab) {
    h += sec('Estabilidade ao tombamento',
      tabelaCalc('Equilíbrio em torno da borda da base', [
        cl('Excentricidade resultante', 'e<sub>res</sub> = [(e<sub>X</sub>)² + (e<sub>Y</sub>)²]<sup>1/2</sup>',
          '[(' + num(eX, 1) + ')² + (' + num(eY, 1) + ')²]<sup>1/2</sup>',
          num(eRes, 2), 'mm'),
        cl('Momento de tombamento', 'P·e<sub>res</sub>',
          num(r.forcas.P, 2) + '·' + num(eRes, 1),
          num(Mtomb, 2), 'N·mm'),
        cl('Massa própria da cadeira (m<sub>cad</sub>)',
          'da geometria', '—', num(estab.massaCadeira, 3), 'kg'),
        cl('Peso próprio (W<sub>c</sub>)', 'm<sub>cad</sub>·g',
          num(estab.massaCadeira, 3) + '·' + num(G, 2),
          num(estab.pesoCadeira, 2), 'N'),
        cl('Braço resistente (R<sub>est</sub>)',
          redonda ? 'raio do cone' : 'semiapótema da pirâmide',
          '—', num(estab.braco, 1), 'mm'),
        cl('Momento estabilizador', '(P + W<sub>c</sub>)·R<sub>est</sub>',
          '(' + num(r.forcas.P, 2) + ' + ' + num(estab.pesoCadeira, 2) +
          ')·' + num(estab.braco, 1),
          num(Mestab, 2), 'N·mm'),
        cl('Utilização', 'M<sub>tomb</sub>/M<sub>estab</sub>',
          num(Mtomb, 2) + '/' + num(Mestab, 2),
          num(estab.utilizacao * 100, 1), '%')
      ]));
  }

  /* ---------- 13. Deformação axial ---------- */
  h += sec('Deformação axial da perna',
    tabelaCalc('Encurtamento elástico', [
      cl('Encurtamento (δ)', 'N·H/(A·E)',
        num(r.forcas.Nmax, 2) + '·' + num(H, 1) + '/(' +
        num(r.secao.A, 2) + '·' + num(mat.E, 0) + ')',
        num(r.deformacao.deltaAxial, 4), 'mm')
    ]));

  /* ---------- 14. Travessas de apoio do assento (só com 4 pernas) ---------- */
  if (r.travessas) {
    const tv = r.travessas;

    const linhasDist = [
      linha('Carga do assento (P + m<sub>as</sub>·g)',
        num(tv.cargaAssento, 2) + ' N'),
      linha('Peso próprio das quatro vigas',
        num(tv.massaTotal * G, 2) + ' N'),
      linha('Carga de referência por viga (centrada)',
        num(tv.Nbase, 2) + ' N'),
      linha('Centro de carga — eixo X', num(tv.fracX * 100, 0) + '%'),
      linha('Centro de carga — eixo Y', num(tv.fracY * 100, 0) + '%'),
      linha('Desequilíbrio em X (ΔN<sub>x</sub>)',
        num(tv.dNx, 2) + ' N'),
      linha('Desequilíbrio em Y (ΔN<sub>y</sub>)',
        num(tv.dNy, 2) + ' N')
    ];

    const linhasVigas = tv.porViga.map(v =>
      linha(
        v.nome.charAt(0).toUpperCase() + v.nome.slice(1) +
        ' (responde a ' + v.depende + ')',
        num(v.cargaEf, 2) + ' N' +
        (v.semContato ? ' — sem contato com a placa' : '') +
        ' · ' + num(v.utilizacao * 100, 1) + '%'
      ));

    const nomeCritica = tv.vigaCritica.charAt(0).toUpperCase() +
      tv.vigaCritica.slice(1);

    const linhasTv = [
      cl('Número de travessas', 'quadro de quatro vigas', '—',
        num(tv.n, 0), 'un'),
      cl('Tipo de seção', 'maciça ou tubular', '—',
        tv.vazada
          ? 'Tubular, parede ' + num(tv.parede, 2) + ' mm'
          : 'Maciça',
        ''),
      cl('Seção da travessa (b × h)', 'b × h', '—',
        num(tv.b, 1) + ' × ' + num(tv.h, 1), 'mm'),
      cl('Área da seção (A)',
        tv.vazada ? 'b·h − b<sub>i</sub>·h<sub>i</sub>' : 'b·h', '—',
        num(tv.A, 1), 'mm²'),
      cl('Comprimento da peça (L<sub>t</sub>)', 'L − 2·t',
        num(CADEIRA.L, 0) + ' − 2·' + num(t, 1),
        num(tv.comprimento, 1), 'mm'),
      cl('Vão de cálculo', 'L<sub>t</sub> (apoio nas faces internas)',
        num(tv.vao, 1), num(tv.vao, 1), 'mm'),
      cl('Carga na viga crítica (' + nomeCritica + ')',
        'N<sub>base</sub> + desequilíbrio',
        num(tv.Nbase, 2) + ' + ' +
        num(Math.abs(tv.N - tv.Nbase), 2),
        num(tv.N, 2), 'N'),
      cl('Carga distribuída (q)', 'N/L<sub>t</sub>',
        num(tv.N, 2) + '/' + num(tv.vao, 1),
        num(tv.q, 4), 'N/mm'),
      cl('Momento máximo (M)', 'q·L<sub>t</sub>²/8',
        num(tv.q, 4) + '·' + num(tv.vao, 1) + '²/8',
        num(tv.M, 2), 'N·mm'),
      cl('Reação em cada ponta (V)', 'q·L<sub>t</sub>/2',
        num(tv.q, 4) + '·' + num(tv.vao, 1) + '/2',
        num(tv.V, 2), 'N'),
      cl('Momento de inércia (I)',
        tv.vazada ? '(b·h³ − b<sub>i</sub>·h<sub>i</sub>³)/12' : 'b·h³/12',
        num(tv.I, 2), num(tv.I, 2), 'mm⁴'),
      cl('Módulo resistente (W)', 'I/c',
        num(tv.I, 2) + '/' + num(tv.c, 1),
        num(tv.W, 2), 'mm³'),
      cl('Tensão de flexão (σ<sub>tv</sub>)', 'M/W',
        num(tv.M, 2) + '/' + num(tv.W, 2),
        num(tv.tensao, 3), 'MPa'),
      cl('Utilização à flexão', 'σ<sub>tv</sub>/σ<sub>adm</sub>',
        num(tv.tensao, 3) + '/' + num(tv.sigmaAdm, 3),
        num(tv.utilizacaoTensao * 100, 1), '%'),
      cl('Tensão de cisalhamento (τ)',
        (tv.vazada ? '2,0' : '1,5') + '·V/A',
        (tv.vazada ? '2,0' : '1,5') + '·' + num(tv.V, 2) + '/' + num(tv.A, 1),
        num(tv.cisalhamento, 3), 'MPa'),
      cl('Flecha (δ<sub>tv</sub>)', '5·q·L<sub>t</sub>⁴/(384·E·I)',
        '5·' + num(tv.q, 4) + '·' + num(tv.vao, 1) + '⁴/(384·' +
        num(mat.E, 0) + '·' + num(tv.I, 2) + ')',
        num(tv.flecha, 4), 'mm'),
      cl('Flecha limite', 'L<sub>t</sub>/' + tv.divisorFlecha,
        num(tv.vao, 1) + '/' + tv.divisorFlecha,
        num(tv.flechaLimite, 4), 'mm'),
      cl('Utilização à flecha', 'δ<sub>tv</sub>/δ<sub>lim</sub>',
        num(tv.flecha, 4) + '/' + num(tv.flechaLimite, 4),
        num(tv.utilizacaoFlecha * 100, 1), '%'),
      cl('Massa das quatro travessas', 'V · ρ', '—',
        num(tv.massaTotal, 3), 'kg')
    ];

    h += sec('Distribuição da carga entre as travessas',
      tabelaSimples('Carga de referência e desequilíbrio', linhasDist) +
      tabelaSimples('Carga e utilização de cada viga', linhasVigas));

    h += sec('Verificação das travessas de apoio do assento',
      tabelaCalc('Viga biapoiada sob carga uniformemente distribuída',
        linhasTv));
  }

  /* ---------- 15. Parecer ---------- */
  let parecer;
  if (r.veredito.aprovado) {
    parecer = '<p class="mem-parecer mem-parecer--ok">' +
      'Configuração aprovada em todos os critérios verificados.</p>';
  } else {
    parecer = '<p class="mem-parecer mem-parecer--erro">' +
      'Configuração reprovada.<ul>' +
      r.veredito.motivos.map(motivo => '<li>' + motivo + '</li>').join('') +
      '</ul></p>';
  }
  h += sec('Parecer técnico', parecer);

  /* ---------- Notas ---------- */
  const notas = [
    'A massa de cada parte é obtida do volume da própria geometria ' +
      'multiplicado pela massa específica do material. Não há valor fixo ' +
      'arbitrado para assento ou encosto, e o furo do perfil tubular é ' +
      'descontado do volume.',

    'O assento tem dimensões próprias — largura, profundidade e espessura — ' +
      'e não deriva da dimensão da perna. As duas peças são independentes: ' +
      'perna grossa não implica assento grosso.'
  ];

  if (centrada) {
    notas.push('O centro de carga está no centro geométrico do assento. A ' +
      'carga distribuída equivale, para o equilíbrio global, a uma ' +
      'resultante única no centroide da distribuição — e, com distribuição ' +
      'uniforme, o centroide é o centro geométrico. Por isso as quatro ' +
      'reações ficam iguais, o momento de excentricidade é nulo e não há ' +
      'casal a equilibrar. A checagem do casal fica inativa por ausência de ' +
      'solicitação, não por simplificação do modelo.');
  } else {
    notas.push('O centro de carga está em X ' + num(fracX * 100, 0) + '% e Y ' +
      num(fracY * 100, 0) + '% da meia dimensão do assento, o que corresponde ' +
      'a ' + num(eX, 1) + ' mm e ' + num(eY, 1) + ' mm de deslocamento. A ' +
      'posição é dada em fração de meia dimensão, e não em milímetros, para ' +
      'que 100% signifique sempre a borda da placa, qualquer que seja o ' +
      'tamanho do assento. A carga distribuída equivale a uma resultante ' +
      'única no centroide da distribuição; deslocada do centro, ela gera ' +
      'momento em duas direções.');
  }

  notas.push(
    'A base é modelada como engastada no piso. Na prática ela apoia por ' +
      'contato; o efeito é coberto pela verificação de tombamento.',

    'O assento é verificado como faixa de largura mín(a_L, a_P) na direção ' +
      'da carga. A placa real redistribui a carga em duas direções, de modo ' +
      'que o modelo é conservador quanto ao momento por unidade de largura.',

    'Com 4 pernas o assento é verificado em duas situações distintas: o ' +
      'sobrepasso externo, como placa em balanço, e o vão central, pelo ' +
      'método das faixas. O coeficiente 1/16 é conservador frente aos 0,0479 ' +
      'da solução de placa simplesmente apoiada.'
  );

  if (!centrada && n === 4) {
    notas.push(
      'No quadro de quatro pernas, a placa rígida distribui a carga por ' +
      'flexão biaxial. Com as pernas nos quatro cantos de um quadrado de ' +
      'lado b = L − t, a reação de cada uma segue ' +
      'Ni = P/4 ± P·e_X/(2b) ± P·e_Y/(2b), e o sinal depende do quadrante: ' +
      'a perna do canto carregado soma as duas parcelas, a do canto oposto ' +
      'subtrai as duas. No caso uniaxial a expressão se reduz à fórmula ' +
      'anterior — a generalização é consistente, não um modelo novo.',

      'O casal resistente nas pernas vale ΔN·(2·(L − t)) = ' +
      num(r.forcas.dN * 2 * r.forcas.bracoBinario, 0) + ' N·mm, que ' +
      'corresponde a P·(|e_X| + |e_Y|) — a soma dos módulos das duas ' +
      'componentes. É essa a condição de equilíbrio do canto carregado, e ' +
      'ela é maior ou igual ao momento resultante P·e_res = ' +
      num(r.forcas.P * eRes, 0) + ' N·mm. Depois de fechado o equilíbrio, o ' +
      'momento externo já está resistido: somar flexão à perna contaria o ' +
      'mesmo momento duas vezes.'
    );
  }

  notas.push(
    'O apoio do assento é o quadro formado pelos quatro topos de perna nos ' +
      'cantos mais as quatro travessas no vão entre elas, todos com o topo na ' +
      'mesma cota z = H. Vista de cima, a abertura interna dessa moldura mede ' +
      'L − 2·b, e é esse o vão que a placa vence no meio. Adotar o lado L do ' +
      'quadro superestimaria o momento em (L/L_v)² e a flecha em (L/L_v)⁴.',

    'O limite de flecha do assento é a/' + CADEIRA.divisorFlechaAssento +
      ', adotado como critério de serviço. Ajuste em constantes.js se o ' +
      'orientador exigir outro valor.'
  );

  if (r.travessas) {
    notas.push('As travessas são modeladas como vigas biapoiadas nas faces ' +
      'internas das pernas, com carga uniformemente distribuída. O vão de ' +
      'cálculo é o comprimento da própria peça, porque a viga encosta na ' +
      'perna sem penetrar nela.');

    notas.push('A ligação real entre travessa e perna tem alguma rigidez de ' +
      'momento, o que reduz a flecha; a hipótese de rótula é conservadora. ' +
      'O quadro também enrijece o conjunto de pernas, mas essa redução do ' +
      'comprimento de flambagem não é aproveitada no cálculo.');

    notas.push('As travessas ocupam o vão entre as faces internas das pernas ' +
      'e têm o topo no mesmo plano do topo das pernas. Elas completam o apoio ' +
      'do assento ao longo das bordas, ligando um topo de perna ao outro: o ' +
      'caminho de carga do assento é quadro → pernas → piso.');

    notas.push('A carga de cada travessa segue o mesmo critério biaxial das ' +
      'pernas: as vigas frontal e traseira respondem ao deslocamento em Y, ' +
      'as laterais ao deslocamento em X, e a borda para onde a carga se ' +
      'move recebe mais. Com a carga centrada as quatro recebem o mesmo ' +
      'valor. A soma das quatro fecha exatamente com o peso que o quadro ' +
      'sustenta — assento mais as próprias vigas —, porque as parcelas de ' +
      'desequilíbrio se cancelam duas a duas.');

    notas.push('A verificação usa a viga mais solicitada, não a média. Cada ' +
      'viga é calculada com a sua carga uniformemente distribuída no seu ' +
      'vão, que é o envelope entre as formas lineares: para o mesmo total, ' +
      'a distribuição uniforme dá o maior momento e a maior flecha. Só uma ' +
      'carga concentrada no meio do vão seria mais severa, e não é o caso — ' +
      'a placa pressiona a borda inteira.');

    notas.push('O peso próprio das vigas entra na carga do quadro, porque é ' +
      'ele que as carrega. As pernas e o encosto não entram: eles se apoiam ' +
      'direto nas pernas, sem passar pelas travessas. É por isso que a soma ' +
      'das quatro vigas é menor que a soma das quatro reações nas pernas.');

    if (r.travessas.vazada) {
      notas.push('Na travessa tubular a área e a inércia descontam o furo da ' +
        'seção. A solicitação tangencial adota 2,0·V/A, valor que se aproxima ' +
        'do pico na alma fina; na seção maciça o pico é 1,5·V/A.');
    }
  }

  notas.push('A massa do assento entra na carga das travessas, porque são ' +
    'elas que o sustentam. Na verificação do vão do assento entra apenas a ' +
    'carga do usuário. Com assento em ' + num(r.massa.assento, 2) + ' kg, ' +
    'isso representa cerca de ' +
    num((r.massa.assento * G / r.forcas.P) * 100, 1) +
    '% do peso do usuário.');

  if (vaz) {
    notas.push('A flambagem local é verificada pela relação entre a dimensão ' +
      'interna e a parede, comparada a 1,40·√(E/σ<sub>lim</sub>). O critério ' +
      'indica esbeltez excessiva da parede, não a ruína do perfil.');
    notas.push('A parede é tratada como uniforme em toda a seção e sem ' +
      'arredondamento de canto. Perfis comerciais têm raio de canto, o que ' +
      'aumenta ligeiramente a área e a inércia.');
  } else {
    notas.push('O pé do pedestal é sempre maciço, mesmo quando a coluna é ' +
      'tubular, para garantir rigidez na transição com o piso.');
  }

  if (estab) {
    notas.push('No pedestal o momento resultante tem duas componentes. ' +
      'Na seção quadrada as duas parcelas se somam no canto, e o momento ' +
      'equivalente é |M_x| + |M_y|. Na seção redonda há uma única fibra ' +
      'extrema, na direção resultante, e o equivalente é a raiz da soma dos ' +
      'quadrados. A tensão de flexão é calculada com esse momento ' +
      'equivalente e um único módulo resistente.',

      'O braço de tombamento adotado é o menor da base: o semiapótema, ' +
      'na direção perpendicular às faces. A verificação usa a excentricidade ' +
      'resultante, e a distância do centro à borda em qualquer direção nunca ' +
      'é menor que esse braço — logo o resultado é conservador.');
  }

  if (!temEncosto) {
    notas.push('Sem encosto, a cadeira não possui postes nem painel: a altura ' +
      'total cai e o peso próprio diminui, o que reduz a resistência ao ' +
      'tombamento. Não é considerada força horizontal de encosto em nenhum ' +
      'dos dois casos, porque esse esforço não faz parte do modelo.');
  } else {
    notas.push('O encosto entra no cálculo apenas como massa e como posição ' +
      'geométrica. A força horizontal de uma pessoa reclinada não é verificada ' +
      'neste modelo, e os postes do encosto não têm verificação de flexão. ' +
      'Com H = 100 N aplicados a ' + num(CADEIRA.alturaEncosto, 0) + ' mm ' +
      'acima do assento, o momento nos postes seria da ordem de ' +
      '16 kN·mm por poste — folgado, mas não nulo.');
  }

  notas.push('A flambagem global é verificada pela carga crítica de Euler, sem ' +
    'considerar imperfeições iniciais.');

  notas.push('As vistas ortográficas são desenhadas em projeção paralela, com ' +
    'arestas visíveis em traço contínuo e cotas em cm. As arestas ocultas não ' +
    'são representadas: o desenho prioriza a leitura das dimensões externas.');

  notas.push('As propriedades dos materiais vêm da tabela de propriedades ' +
    'médias de ' + mat.fonte + '. O coeficiente de segurança é decisão de ' +
    'projeto deste simulador, não valor de tabela.');

  notas.push('O deslocamento do centro de carga aumenta o braço do balanço do ' +
    'assento. O cálculo soma ao sobrepasso nominal a projeção da ' +
    'excentricidade, o que representa a pessoa sentada na beirada: o ponto ' +
    'de carga fica mais longe do apoio e o momento cresce.');

  h += '<section class="mem-sec"><h2>Notas e limitações</h2>' +
    '<ul class="mem-notas">' +
    notas.map(nota => '<li>' + nota + '</li>').join('') + '</ul></section>';

  return h;
}