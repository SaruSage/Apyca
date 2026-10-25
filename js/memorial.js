/**
 * Memorial de cálculo imprimível.
 *
 * Recebe o resultado do solver e devolve uma string HTML de documento.
 * Não faz cálculo estrutural: apenas formata o que o solver já produziu,
 * mostrando expressão, substituição e resultado de cada verificação.
 *
 * A numeração das seções é dinâmica: a flambagem local só existe na seção
 * vazada e a estabilidade só existe no pedestal. Numeração fixa deixaria
 * buracos na sequência do documento.
 *
 * A figura usa o MESMO código de desenho da tela, em fundo transparente.
 */

import { G, HIPOTESES, CADEIRA } from './constantes.js';
import { construirBarras, dimensoesExternas } from './chairModel.js';
import { svgCadeira } from './render.js';

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

const CABECALHO = '<thead><tr>' +
  '<th>Grandeza</th>' +
  '<th>Expressão</th>' +
  '<th>Substituição</th>' +
  '<th class="num">Resultado</th>' +
  '</tr></thead>';

function cl(grandeza, expressao, substituicao, valor, unidade){
  return '<tr><th>' + grandeza + '</th>' +
    '<td class="form">' + expressao + '</td>' +
    '<td class="subst">' + substituicao + '</td>' +
    '<td class="num">' + valor +
    (unidade ? ' <span class="un">' + unidade + '</span>' : '') +
    '</td></tr>';
}

function tabelaCalc(titulo, linhas){
  return '<table class="mem-tab"><caption>' + titulo + '</caption>' +
    CABECALHO + '<tbody>' + linhas.join('') + '</tbody></table>';
}

/**
 * Figura da cadeira. Fundo transparente: o SVG não desenha retângulo,
 * então no papel aparece apenas a peça e a sombra.
 */
function figuraCadeira(r){
  const material = r.entrada.material;

  const barras = construirBarras(
    r.entrada.t,
    r.entrada.H,
    material,
    r.entrada.forma,
    r.entrada.numPernas,
    r.entrada.vazada,
    r.entrada.parede
  );

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

  /* Numeração dinâmica: reinicia a cada geração do documento. */
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

  const t = r.entrada.t;
  const H = r.entrada.H;
  const m = r.entrada.m;

  const ep = r.secao.parede;
  const di = r.secao.interna;

  const estab = r.estabilidade;
  const as = r.assento;

  const Mtomb = estab ? r.forcas.P * estab.e : 0;
  const Mestab = estab ? (r.forcas.P + estab.pesoCadeira) * estab.braco : 0;

  const formaTxt = redonda ? 'Redonda — diâmetro t' : 'Quadrada — lado t';
  const secaoTxt = vaz ? 'Tubular (vazada)' : 'Maciça';
  const pernasTxt = n === 1 ? '1 — pedestal central' : '4 — quadro de pernas';

  let h = '';

  h += '<h1>Memorial de cálculo estrutural</h1>';
  h += '<p class="mem-sub">Cadeira A3 · ' + hoje + '</p>';

  h += figuraCadeira(r);

  /* ---------- 1. Dados de entrada ---------- */
  const linhasEntrada = [
    linha('Material', mat.nome),
    linha('Módulo de elasticidade (E)', num(mat.E, 0) + ' MPa'),
    linha('Tensão limite (σ<sub>lim</sub>)', num(mat.sigmaLimite, 1) + ' MPa'),
    linha('Massa específica (ρ)', num(mat.rho, 0) + ' kg/m³'),
    linha('Coeficiente de segurança (CS)', num(mat.CS, 2)),
    linha('Formato da seção', formaTxt),
    linha('Seção', secaoTxt),
    linha('Dimensão externa (t)', num(t, 1) + ' mm'),
    linha('Altura da perna (H)', num(H, 1) + ' mm'),
    linha('Massa do usuário (m)', num(m, 1) + ' kg'),
    linha('Número de pernas', pernasTxt)
  ];
  if (vaz) {
    linhasEntrada.push(linha('Parede da tubeira (e<sub>p</sub>)',
      num(ep, 2) + ' mm'));
  }
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
    linha('Massa de assento e encosto', num(HIPOTESES.mAssento, 1) + ' kg'),
    linha('Largura do assento (b)', num(as.b, 0) + ' mm'),
    linha('Espessura do assento (h)', num(as.h, 1) + ' mm'),
    linha('Fator de comprimento efetivo (K)', num(r.flambagem.K, 2) +
      (n === 1 ? ' — coluna engastada e livre' : ' — perna entre apoios'))
  ];
  if (n === 1) {
    linhasPrem.push(linha('Raio da base do pé',
      num(CADEIRA.coneRaioBase, 0) + ' mm'));
    linhasPrem.push(linha('Fração do lado da pirâmide',
      num(CADEIRA.fracaoLadoPiramide, 3) + ' do diâmetro do cone'));
  }
  h += sec('Premissas de projeto',
    tabelaSimples('Hipóteses adotadas', linhasPrem));

  /* ---------- 3. Propriedades da seção ---------- */
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
  h += sec('Propriedades da seção transversal',
    tabelaCalc('Área, inércia e resistência', linhasSecao));

  /* ---------- 4. Esforços ---------- */
  const linhasEsforcos = [
    cl('Carga do usuário (P)', 'm·g',
      num(m, 1) + '·' + num(G, 2), num(r.forcas.P, 2), 'N')
  ];

  if (n === 1) {
    linhasEsforcos.push(cl('Esforço normal (N)', 'P',
      num(r.forcas.P, 2), num(r.forcas.Nmax, 2), 'N'));
    linhasEsforcos.push(cl('Momento fletor (M)', 'P·e',
      num(r.forcas.P, 2) + '·' + num(HIPOTESES.e, 0),
      num(r.forcas.Mperna, 2), 'N·mm'));
  } else {
    linhasEsforcos.push(cl('Reação média por perna', 'P/n',
      num(r.forcas.P, 2) + '/4', num(r.forcas.Nmedio, 2), 'N'));
    linhasEsforcos.push(cl('Parcela da excentricidade (ΔN)', 'P·e/(2L)',
      num(r.forcas.P, 2) + '·' + num(HIPOTESES.e, 0) + '/(2·' +
      num(HIPOTESES.L, 0) + ')',
      num(r.forcas.dN, 2), 'N'));
    linhasEsforcos.push(cl('Reação máxima (N<sub>máx</sub>)', 'P/n + ΔN',
      num(r.forcas.Nmedio, 2) + ' + ' + num(r.forcas.dN, 2),
      num(r.forcas.Nmax, 2), 'N'));
    linhasEsforcos.push(cl('Reação mínima (N<sub>mín</sub>)', 'P/n − ΔN',
      num(r.forcas.Nmedio, 2) + ' − ' + num(r.forcas.dN, 2),
      num(r.forcas.Nmin, 2), 'N'));
    linhasEsforcos.push(cl('Momento por perna (M)', 'P·e/n',
      num(r.forcas.P, 2) + '·' + num(HIPOTESES.e, 0) + '/4',
      num(r.forcas.Mperna, 2), 'N·mm'));
  }
  h += sec('Ações e esforços solicitantes',
    tabelaCalc('Transmissão das cargas', linhasEsforcos));

  /* ---------- 5. Tensões na perna ---------- */
  h += sec('Verificação da tensão normal na perna',
    tabelaCalc('Flexo-compressão na seção', [
      cl('Tensão axial (σ<sub>a</sub>)', 'N/A',
        num(r.forcas.Nmax, 2) + '/' + num(r.secao.A, 2),
        num(r.tensoes.sigmaAxial, 3), 'MPa'),
      cl('Tensão de flexão (σ<sub>f</sub>)', 'M·c/I',
        num(r.forcas.Mperna, 2) + '·' + num(r.secao.c, 2) + '/' +
        num(r.secao.I, 2),
        num(r.tensoes.sigmaFlexao, 3), 'MPa'),
      cl('Tensão máxima (σ<sub>máx</sub>)', 'σ<sub>a</sub> + σ<sub>f</sub>',
        num(r.tensoes.sigmaAxial, 3) + ' + ' + num(r.tensoes.sigmaFlexao, 3),
        num(r.tensoes.sigmaMax, 3), 'MPa'),
      cl('Tensão admissível (σ<sub>adm</sub>)', 'σ<sub>lim</sub>/CS',
        num(mat.sigmaLimite, 1) + '/' + num(mat.CS, 2),
        num(r.tensoes.sigmaAdm, 3), 'MPa'),
      cl('Utilização', 'σ<sub>máx</sub>/σ<sub>adm</sub>',
        num(r.tensoes.sigmaMax, 3) + '/' + num(r.tensoes.sigmaAdm, 3),
        num(r.tensoes.utilizacao * 100, 1), '%')
    ]));

  /* ---------- 6. Flambagem global ---------- */
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
      cl('Utilização', 'N/N<sub>cr,adm</sub>',
        num(r.forcas.Nmax, 2) + '/' + num(r.flambagem.NcrAdm, 2),
        num(r.flambagem.utilizacaoFlambagem * 100, 1), '%')
    ]));

  /* ---------- 7. Flambagem local da parede (só vazada) ---------- */
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

  /* ---------- 8. Assento em balanço ---------- */
  h += sec('Verificação do assento em balanço',
    tabelaCalc(
      n === 1
        ? 'Placa em balanço a partir da face da coluna'
        : 'Sobrepasso do assento além das pernas',
      [
        cl('Comprimento do balanço (a)',
          n === 1 ? '(L/2 + folga) − t/2' : 'folga',
          n === 1
            ? '(' + num(CADEIRA.L / 2, 0) + ' + ' + num(CADEIRA.folga, 0) +
              ') − ' + num(t / 2, 1)
            : num(CADEIRA.folga, 0),
          num(as.a, 1), 'mm'),
        cl('Momento no engaste (M<sub>a</sub>)', 'P·a',
          num(r.forcas.P, 2) + '·' + num(as.a, 1),
          num(as.M, 2), 'N·mm'),
        cl('Módulo resistente (W<sub>a</sub>)', 'b·h²/6',
          num(as.b, 0) + '·' + num(as.h, 1) + '²/6',
          num(as.W, 2), 'mm³'),
        cl('Tensão de flexão (σ<sub>as</sub>)', 'M<sub>a</sub>/W<sub>a</sub>',
          num(as.M, 2) + '/' + num(as.W, 2),
          num(as.sigma, 3), 'MPa'),
        cl('Utilização à flexão', 'σ<sub>as</sub>/σ<sub>adm</sub>',
          num(as.sigma, 3) + '/' + num(r.tensoes.sigmaAdm, 3),
          num(as.utilizacao * 100, 1), '%'),
        cl('Momento de inércia (I<sub>a</sub>)', 'b·h³/12',
          num(as.b, 0) + '·' + num(as.h, 1) + '³/12',
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

  /* ---------- 9. Estabilidade ao tombamento (só no pedestal) ---------- */
  if (estab) {
    h += sec('Estabilidade ao tombamento',
      tabelaCalc('Equilíbrio em torno da borda da base', [
        cl('Momento de tombamento', 'P·e',
          num(r.forcas.P, 2) + '·' + num(estab.e, 0),
          num(Mtomb, 2), 'N·mm'),
        cl('Peso próprio da cadeira (W)', 'm<sub>total</sub>·g',
          num(r.massa.total, 2) + '·' + num(G, 2),
          num(estab.pesoCadeira, 2), 'N'),
        cl('Braço resistente (R<sub>est</sub>)',
          redonda ? 'raio do cone' : 'semiapótema da pirâmide',
          '—', num(estab.braco, 1), 'mm'),
        cl('Momento estabilizador', '(P + W)·R<sub>est</sub>',
          '(' + num(r.forcas.P, 2) + ' + ' + num(estab.pesoCadeira, 2) +
          ')·' + num(estab.braco, 1),
          num(Mestab, 2), 'N·mm'),
        cl('Utilização', 'M<sub>tomb</sub>/M<sub>estab</sub>',
          num(Mtomb, 2) + '/' + num(Mestab, 2),
          num(estab.utilizacao * 100, 1), '%')
      ]));
  }

  /* ---------- 10. Deformação axial ---------- */
  h += sec('Deformação axial da perna',
    tabelaCalc('Encurtamento elástico', [
      cl('Encurtamento (δ)', 'N·H/(A·E)',
        num(r.forcas.Nmax, 2) + '·' + num(H, 1) + '/(' +
        num(r.secao.A, 2) + '·' + num(mat.E, 0) + ')',
        num(r.deformacao.deltaAxial, 4), 'mm')
    ]));

  /* ---------- 11. Massa ---------- */
  h += sec('Massa e peso',
    tabelaSimples('Quantificação', [
      linha('Massa das pernas e do pé', num(r.massa.pernas, 3) + ' kg'),
      linha('Massa total da cadeira', num(r.massa.total, 3) + ' kg'),
      linha('Peso total', num(r.massa.total * G, 1) + ' N')
    ]));

  /* ---------- 12. Parecer ---------- */
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
    'A excentricidade de projeto é fixa em ' + num(HIPOTESES.e, 0) +
      ' mm e representa o deslocamento do centro de carga do usuário.',
    'A base é modelada como engastada no piso. Na prática ela apoia por ' +
      'contato; o efeito é coberto pela verificação de tombamento.',
    'O assento é verificado como faixa de largura b sob carga na borda. ' +
      'A placa real redistribui a carga em duas direções, de modo que o modelo ' +
      'é conservador quanto ao momento por unidade de largura.',
    'Com 4 pernas verifica-se apenas o sobrepasso externo do assento. A flexão ' +
      'da placa entre os apoios não é coberta por este modelo.',
    'O limite de flecha do assento é a/' + CADEIRA.divisorFlechaAssento +
      ', adotado como critério de serviço. Ajuste em constantes.js se o ' +
      'orientador exigir outro valor.',
    'Não são verificadas ligações, soldas nem parafusos.'
  ];
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
  notas.push('A flambagem global é verificada pela carga crítica de Euler, sem ' +
    'considerar imperfeições iniciais.');

  h += '<section class="mem-sec"><h2>Notas e limitações</h2>' +
    '<ul class="mem-notas">' +
    notas.map(nota => '<li>' + nota + '</li>').join('') + '</ul></section>';

  return h;
}