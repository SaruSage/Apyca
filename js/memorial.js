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
 * vazada, a estabilidade so existe no pedestal e as travessas so existem no
 * quadro de quatro pernas. Numeracao fixa deixaria buracos na sequencia.
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

  const Mtomb = estab ? r.forcas.P * estab.e : 0;
  const Mestab = estab ? (r.forcas.P + estab.pesoCadeira) * estab.braco : 0;

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
    linha('Espessura do assento (h<sub>as</sub>)', num(aEsp, 1) + ' mm')
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
    linha('Excentricidade de projeto (e)', num(HIPOTESES.e, 0) + ' mm'),
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
    linhasEsforcos.push(cl('Momento fletor (M)', 'P·e',
      num(r.forcas.P, 2) + '·' + num(HIPOTESES.e, 0),
      num(r.forcas.Mperna, 2), 'N·mm'));
  } else {
    linhasEsforcos.push(cl('Reação média por perna', '(P + W<sub>c</sub>)/n',
      '(' + num(r.forcas.P, 2) + ' + ' + num(r.massa.total * G, 2) +
      ')/4', num(r.forcas.Nmedio, 2), 'N'));
    linhasEsforcos.push(cl('Parcela da excentricidade (ΔN)', 'P·e/(2L)',
      num(r.forcas.P, 2) + '·' + num(HIPOTESES.e, 0) + '/(2·' +
      num(HIPOTESES.L, 0) + ')',
      num(r.forcas.dN, 2), 'N'));
    linhasEsforcos.push(cl('Reação máxima (N<sub>máx</sub>)', 'N<sub>méd</sub> + ΔN',
      num(r.forcas.Nmedio, 2) + ' + ' + num(r.forcas.dN, 2),
      num(r.forcas.Nmax, 2), 'N'));
    linhasEsforcos.push(cl('Reação mínima (N<sub>mín</sub>)', 'N<sub>méd</sub> − ΔN',
      num(r.forcas.Nmedio, 2) + ' − ' + num(r.forcas.dN, 2),
      num(r.forcas.Nmin, 2), 'N'));
  }

  h += sec('Ações e esforços solicitantes',
    tabelaCalc('Transmissão das cargas', linhasEsforcos));

  /* ---------- 6b. Casal de equilíbrio (quadro de 4 pernas) ---------- */
  if (n === 4 && r.forcas.Mperna === 0) {
    h += sec('Equilíbrio do momento de excentricidade',
      tabelaCalc('Casal entre as pernas', [
        cl('Momento de tombamento da carga', 'P·e',
          num(r.forcas.P, 2) + '·' + num(HIPOTESES.e, 0),
          num(r.forcas.P * HIPOTESES.e, 2), 'N·mm'),
        cl('Casal resistente', 'ΔN·(2L)',
          num(r.forcas.dN, 2) + '·(2·' + num(HIPOTESES.L, 0) + ')',
          num(r.forcas.dN * 2 * HIPOTESES.L, 2), 'N·mm'),
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
  h += sec('Verificação do assento em balanço',
    tabelaCalc(
      n === 1
        ? 'Placa em balanço a partir da face da coluna'
        : 'Sobrepasso do assento além das pernas',
      [
        cl('Dimensões do assento (a<sub>L</sub> × a<sub>P</sub> × h<sub>as</sub>)',
          'configuradas em separado da perna', '—',
          num(aLarg, 0) + ' × ' + num(aProf, 0) + ' × ' + num(aEsp, 1),
          'mm'),
        cl('Comprimento do balanço (a)',
          n === 1 ? 'a<sub>L</sub>/2 − t/2' : 'máx[(a<sub>L</sub>−L)/2 , (a<sub>P</sub>−L)/2]',
          n === 1
            ? num(aLarg / 2, 0) + ' − ' + num(t / 2, 1)
            : 'máx[' + num(fX, 1) + ' ; ' + num(fY, 1) + ']',
          num(as.a, 1), 'mm'),
        cl('Sobrepasso em X', '(a<sub>L</sub> − L)/2',
          '(' + num(aLarg, 0) + ' − ' + num(CADEIRA.L, 0) + ')/2',
          num(fX, 1), 'mm'),
        cl('Sobrepasso em Y', '(a<sub>P</sub> − L)/2',
          '(' + num(aProf, 0) + ' − ' + num(CADEIRA.L, 0) + ')/2',
          num(fY, 1), 'mm'),
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
      ]));

  /* ---------- 11. Assento entre apoios (só com 4 pernas) ---------- */
  if (r.assentoVao) {
    const asv = r.assentoVao;
    h += sec('Verificação do assento entre apoios',
      tabelaCalc('Flexão da placa entre as pernas', [
        cl('Vão livre (L)', 'distância entre eixos das pernas',
          '—', num(asv.L, 0), 'mm'),
        cl('Área carregada (A<sub>as</sub>)', 'a<sub>L</sub>·a<sub>P</sub>',
          num(aLarg, 0) + '·' + num(aProf, 0),
          num(asv.area, 0), 'mm²'),
        cl('Pressão uniforme (q)', 'P/A<sub>as</sub>',
          num(r.forcas.P, 2) + '/' + num(asv.area, 0),
          num(asv.q, 6), 'N/mm²'),
        cl('Momento por unidade de largura', 'q·L²/16',
          num(asv.q, 6) + '·' + num(asv.L, 0) + '²/16',
          num(asv.M, 3), 'N·mm/mm'),
        cl('Tensão de flexão (σ<sub>vão</sub>)', '6·M/h<sub>as</sub>²',
          '6·' + num(asv.M, 3) + '/' + num(asv.h, 1) + '²',
          num(asv.sigma, 3), 'MPa'),
        cl('Utilização à flexão', 'σ<sub>vão</sub>/σ<sub>adm</sub>',
          num(asv.sigma, 3) + '/' + num(r.tensoes.sigmaAdm, 3),
          num(asv.utilizacao * 100, 1), '%'),
        cl('Flecha (δ<sub>vão</sub>)', '5·q·L⁴/(64·E·h<sub>as</sub>³)',
          '5·' + num(asv.q, 6) + '·' + num(asv.L, 0) + '⁴/(64·' +
          num(mat.E, 0) + '·' + num(asv.h, 1) + '³)',
          num(asv.flecha, 4), 'mm'),
        cl('Flecha limite', 'L/' + CADEIRA.divisorFlechaVao,
          num(asv.L, 0) + '/' + CADEIRA.divisorFlechaVao,
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
        cl('Momento de tombamento', 'P·e',
          num(r.forcas.P, 2) + '·' + num(estab.e, 0),
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
      cl('Carga do assento', 'P + m<sub>as</sub>·g',
        num(r.forcas.P, 2) + ' + ' + num(r.massa.assento, 3) + '·' + num(G, 2),
        num(tv.cargaAssento, 2), 'N'),
      cl('Carga por travessa (N)', 'carga/4 + peso próprio',
        num(tv.cargaAssento, 2) + '/4 + ' + num(tv.pesoProprio, 2),
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
      'perna grossa não implica assento grosso.',

    'A excentricidade de projeto é fixa em ' + num(HIPOTESES.e, 0) +
      ' mm e representa o deslocamento do centro de carga do usuário.',

    'A base é modelada como engastada no piso. Na prática ela apoia por ' +
      'contato; o efeito é coberto pela verificação de tombamento.',

    'O assento é verificado como faixa de largura mín(a_L, a_P) na direção ' +
      'da carga. A placa real redistribui a carga em duas direções, de modo ' +
      'que o modelo é conservador quanto ao momento por unidade de largura.',

    'Com 4 pernas o assento é verificado no sobrepasso externo e no vão entre ' +
      'as pernas, pelo método das faixas. O coeficiente 1/16 é conservador ' +
      'frente aos 0,0479 da solução de placa simplesmente apoiada.',

    'O vão livre adotado na verificação do assento é a distância entre eixos ' +
      'das pernas, que é maior que a abertura interna do quadro de travessas. ' +
      'A flecha calculada é, portanto, superior à real.',

    'O limite de flecha do assento é a/' + CADEIRA.divisorFlechaAssento +
      ', adotado como critério de serviço. Ajuste em constantes.js se o ' +
      'orientador exigir outro valor.'
  ];

  if (r.travessas) {
    notas.push('As travessas são modeladas como vigas biapoiadas nas faces ' +
      'internas das pernas, com carga uniformemente distribuída. O vão de ' +
      'cálculo é o comprimento da própria peça, porque a viga encosta na ' +
      'perna sem penetrar nela.');

    notas.push('A ligação real entre travessa e perna tem alguma rigidez de ' +
      'momento, o que reduz a flecha; a hipótese de rótula é conservadora. ' +
      'O quadro também enrijece o conjunto de pernas, mas essa redução do ' +
      'comprimento de flambagem não é aproveitada no cálculo.');

    notas.push('As travessas são as peças que materializam o apoio contínuo ' +
      'nas quatro bordas do assento, hipótese já adotada na verificação do ' +
      'assento entre apoios. Sem elas, o assento estaria apoiado apenas nos ' +
      'quatro topos de perna.');

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

  if (n === 4) {
    notas.push('No quadro de quatro pernas o momento de excentricidade é ' +
      'resistido pelo casal entre as pernas, que já satisfaz o equilíbrio. ' +
      'Nenhuma flexão é somada à perna, para não contar o mesmo momento duas ' +
      'vezes. A parcela que o anel das travessas transmite às pernas é um ' +
      'efeito hiperestático que este modelo não resolve, e fica de fora.');
  }

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
    notas.push('O braço de tombamento adotado é o menor da base: o semiapótema, ' +
      'na direção perpendicular às faces. Nas diagonais o braço é maior, ' +
      'de modo que o resultado é conservador.');
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

  h += '<section class="mem-sec"><h2>Notas e limitações</h2>' +
    '<ul class="mem-notas">' +
    notas.map(nota => '<li>' + nota + '</li>').join('') + '</ul></section>';

  return h;
}