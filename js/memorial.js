/**
 * Memorial de cálculo imprimível.
 *
 * Recebe o resultado do solver e devolve uma string HTML de documento.
 * Não faz cálculo estrutural: apenas formata o que o solver já produziu,
 * mostrando expressão, substituição e resultado de cada verificação.
 *
 * A figura da cadeira é gerada aqui, com o MESMO código do desenho da tela,
 * sobre fundo transparente e com sombra clara — o papel é branco.
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

function secao(titulo, corpo){
  return '<section class="mem-sec"><h2>' + titulo + '</h2>' + corpo + '</section>';
}

/**
 * Figura da cadeira.
 *
 * Fundo transparente: o SVG não desenha retângulo de fundo, então no papel
 * aparece apenas a peça e a sombra. A sombra vai a 0,16 porque no branco o
 * preto a 50% do painel escuro leria como mancha.
 */
function figuraCadeira(r){
  const material = r.entrada.material;
  const barras = construirBarras(r.entrada.t, r.entrada.H, material,
                                 r.entrada.forma, r.entrada.numPernas);
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

  const mat = r.entrada.material;
  const forma = r.entrada.forma === 'redonda'
    ? 'Redonda — diâmetro t'
    : 'Quadrada — lado t';
  const pernas = r.entrada.numPernas === 1
    ? '1 — pedestal central'
    : '4 — quadro de pernas';

  const t = r.entrada.t;
  const H = r.entrada.H;
  const m = r.entrada.m;
  const n = r.entrada.numPernas;

  const estab = r.estabilidade;
  const Mtomb = estab ? r.forcas.P * estab.e : 0;
  const Mestab = estab ? (r.forcas.P + estab.pesoCadeira) * estab.braco : 0;

  let h = '';

  h += '<h1>Memorial de cálculo estrutural</h1>';
  h += '<p class="mem-sub">Cadeira A3 · ' + hoje + '</p>';

  /* ---------- Figura ---------- */
  h += figuraCadeira(r);

  /* ---------- 1. Entrada ---------- */
  const linhasEntrada = [
    linha('Material', mat.nome),
    linha('Módulo de elasticidade (E)', num(mat.E, 0) + ' MPa'),
    linha('Tensão limite (σ<sub>lim</sub>)', num(mat.sigmaLimite, 1) + ' MPa'),
    linha('Massa específica (ρ)', num(mat.rho, 0) + ' kg/m³'),
    linha('Coeficiente de segurança (CS)', num(mat.CS, 2)),
    linha('Formato da seção', forma),
    linha('Espessura da perna (t)', num(t, 1) + ' mm'),
    linha('Altura da perna (H)', num(H, 1) + ' mm'),
    linha('Massa do usuário (m)', num(m, 1) + ' kg'),
    linha('Número de pernas', pernas)
  ];
  if (dimsExternas) {
    linhasEntrada.push(linha('Dimensões externas',
      num(dimsExternas.altura / 10, 1) + ' × ' +
      num(dimsExternas.largura / 10, 1) + ' × ' +
      num(dimsExternas.profundidade / 10, 1) + ' cm'));
  }
  h += secao('1. Dados de entrada',
    tabelaSimples('Configuração analisada', linhasEntrada));

  /* ---------- 2. Premissas ---------- */
  let linhasPrem = [
    linha('Aceleração da gravidade (g)', num(G, 2) + ' m/s²'),
    linha('Lado do quadro de pernas (L)', num(HIPOTESES.L, 0) + ' mm'),
    linha('Excentricidade de projeto (e)', num(HIPOTESES.e, 0) + ' mm'),
    linha('Massa de assento e encosto', num(HIPOTESES.mAssento, 1) + ' kg'),
    linha('Fator de comprimento efetivo (K)', num(r.flambagem.K, 2) +
      (n === 1 ? ' — coluna engastada e livre' : ' — perna entre apoios'))
  ];
  if (n === 1) {
    linhasPrem.push(linha('Raio da base do pé', num(CADEIRA.coneRaioBase, 0) + ' mm'));
    linhasPrem.push(linha('Fração do lado da pirâmide',
      num(CADEIRA.fracaoLadoPiramide, 3) + ' do diâmetro do cone'));
  }
  h += secao('2. Premissas de projeto',
    tabelaSimples('Hipóteses adotadas', linhasPrem));

  /* ---------- 3. Propriedades da seção ---------- */
  const exprA = r.entrada.forma === 'redonda' ? 'π·t²/4' : 't²';
  const exprI = r.entrada.forma === 'redonda' ? 'π·t⁴/64' : 't⁴/12';

  h += secao('3. Propriedades da seção transversal',
    tabelaCalc('Área, inércia e resistência', [
      cl('Área (A)', exprA,
        r.entrada.forma === 'redonda'
          ? 'π·' + num(t, 1) + '²/4'
          : num(t, 1) + '²',
        num(r.secao.A, 2), 'mm²'),
      cl('Momento de inércia (I)', exprI,
        r.entrada.forma === 'redonda'
          ? 'π·' + num(t, 1) + '⁴/64'
          : num(t, 1) + '⁴/12',
        num(r.secao.I, 2), 'mm⁴'),
      cl('Distância à fibra extrema (c)', 't/2',
        num(t, 1) + '/2', num(r.secao.c, 2), 'mm'),
      cl('Módulo resistente (W)', 'I/c',
        num(r.secao.I, 2) + '/' + num(r.secao.c, 2),
        num(r.secao.W, 2), 'mm³'),
      cl('Raio de giração (r)', '√(I/A)',
        '√(' + num(r.secao.I, 2) + '/' + num(r.secao.A, 2) + ')',
        num(r.secao.r, 3), 'mm')
    ]));

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
  h += secao('4. Ações e esforços solicitantes',
    tabelaCalc('Transmissão das cargas', linhasEsforcos));

  /* ---------- 5. Tensões ---------- */
  h += secao('5. Verificação da tensão normal',
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

  /* ---------- 6. Flambagem ---------- */
  h += secao('6. Verificação da flambagem',
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

  /* ---------- 7. Estabilidade ---------- */
  if (estab) {
    h += secao('7. Estabilidade ao tombamento',
      tabelaCalc('Equilíbrio em torno da borda da base', [
        cl('Momento de tombamento', 'P·e',
          num(r.forcas.P, 2) + '·' + num(estab.e, 0),
          num(Mtomb, 2), 'N·mm'),
        cl('Peso próprio da cadeira (W)', 'm<sub>total</sub>·g',
          num(r.massa.total, 2) + '·' + num(G, 2),
          num(estab.pesoCadeira, 2), 'N'),
        cl('Momento estabilizador', '(P + W)·R',
          '(' + num(r.forcas.P, 2) + ' + ' + num(estab.pesoCadeira, 2) +
          ')·' + num(estab.braco, 1),
          num(Mestab, 2), 'N·mm'),
        cl('Utilização', 'M<sub>tomb</sub>/M<sub>estab</sub>',
          num(Mtomb, 2) + '/' + num(Mestab, 2),
          num(estab.utilizacao * 100, 1), '%')
      ]));
  }

  /* ---------- 8. Deformação ---------- */
  h += secao('8. Deformação axial',
    tabelaCalc('Encurtamento elástico', [
      cl('Encurtamento (δ)', 'N·H/(A·E)',
        num(r.forcas.Nmax, 2) + '·' + num(H, 1) + '/(' +
        num(r.secao.A, 2) + '·' + num(mat.E, 0) + ')',
        num(r.deformacao.deltaAxial, 4), 'mm')
    ]));

  /* ---------- 9. Massa ---------- */
  h += secao('9. Massa e peso',
    tabelaSimples('Quantificação', [
      linha('Massa das pernas e do pé', num(r.massa.pernas, 3) + ' kg'),
      linha('Massa total da cadeira', num(r.massa.total, 3) + ' kg'),
      linha('Peso total', num(r.massa.total * G, 1) + ' N')
    ]));

  /* ---------- 10. Parecer ---------- */
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
  h += secao('10. Parecer técnico', parecer);

  /* ---------- Notas ---------- */
  const notas = [
    'A excentricidade de projeto é fixa em ' + num(HIPOTESES.e, 0) +
      ' mm e representa o deslocamento do centro de carga do usuário.',
    'A base é modelada como engastada no piso. Na prática ela apoia por contato; ' +
      'o efeito é coberto pela verificação de tombamento.',
    'Não são verificadas ligações, soldas, parafusos nem o assento em balanço. ' +
      'O assento é tratado como elemento rígido de transmissão.'
  ];
  if (estab) {
    notas.push('O braço de tombamento adotado é o menor da base: o semiapótema, ' +
      'na direção perpendicular às faces. Nas diagonais o braço é maior, ' +
      'de modo que o resultado é conservador.');
  }
  notas.push('A flambagem é verificada pela carga crítica de Euler, sem ' +
    'considerar imperfeições iniciais nem flambagem local das paredes.');

  h += secao('Notas e limitações',
    '<ul class="mem-notas">' +
    notas.map(nota => '<li>' + nota + '</li>').join('') + '</ul>');

  return h;
}