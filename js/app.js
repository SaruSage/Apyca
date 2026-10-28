import { MATERIAIS } from './materials.js';
import { calcular } from './solver.js';
import { construirBarras, dimensoesExternas, definirAssento,
         definirExcentricidade } from './chairModel.js';
import { renderCadeira } from './render.js';
import { animarRuina } from './animacao.js';
import { animarJoinhas } from './joinhas.js';
import { gerarMemorial } from './memorial.js';
import { definirTravessaSecao } from './travessas.js';

/* ---------- Elementos ---------- */
const form = document.getElementById('form-cadeira');
const selectMaterial = document.getElementById('material');
const campoEspessura = document.getElementById('espessura');
const campoAltura = document.getElementById('altura');
const campoMassa = document.getElementById('massa');
const campoForma = document.getElementById('forma');
const campoSecao = document.getElementById('secao');
const campoParede = document.getElementById('parede');
const grupoParede = document.getElementById('grupo-parede');
const campoEncosto = document.getElementById('encosto');
const campoPernas = document.getElementById('numPernas');

/* Assento */
const campoAssentoLargura = document.getElementById('assento-largura');
const campoAssentoProfundidade = document.getElementById('assento-profundidade');
const campoAssentoEspessura = document.getElementById('assento-espessura');

/*
 * Centro de carga: dois controles deslizantes, em percentual de meia
 * dimensao. Campos opcionais — se o HTML ainda nao os tiver, o app funciona
 * com carga centrada em vez de estourar em null.
 */
const campoExcentX = document.getElementById('excent-x');
const campoExcentY = document.getElementById('excent-y');
const saidaExcentX = document.getElementById('saida-excent-x');
const saidaExcentY = document.getElementById('saida-excent-y');

/* Travessas */
const grupoTravessas = document.getElementById('grupo-travessas');
const campoLarguraTravessa = document.getElementById('travessa-largura');
const campoAlturaTravessa = document.getElementById('travessa-altura');
const campoTravessaSecao = document.getElementById('travessa-secao');
const campoTravessaParede = document.getElementById('travessa-parede');
const grupoParedeTravessa = document.getElementById('grupo-parede-travessa');

/* Gavetas */
const grupoPerna = document.getElementById('grupo-perna');
const grupoAssento = document.getElementById('grupo-assento');

const painel = document.getElementById('resultado');
const palco = document.getElementById('palco');
const situacao = document.getElementById('situacao');
const legenda = document.getElementById('legenda');
const menuBotao = document.getElementById('menu-botao');
const menuPainel = document.getElementById('menu-painel');
const itemGraficos = document.getElementById('item-graficos');
const dialogMemorial = document.getElementById('memorial-dialog');
const conteudoMemorial = document.getElementById('memorial-conteudo');
const btnAbrirMemorial = document.getElementById('abrir-memorial');
const btnFecharMemorial = document.getElementById('memorial-fechar');
const btnImprimirMemorial = document.getElementById('memorial-imprimir');

/* ---------- Estado ---------- */
const gavetasAbertas = new Map();
let ultimoResultado = null;
let ultimasDims = null;
let ultimasBarras = null;
let pararAnimacao = null;

/* ---------- Valores iniciais ---------- */
const PADRAO = {
  material: 'madeira',
  espessuraCm: 4,
  alturaCm: 45,
  massaKg: 90,
  forma: 'quadrada',
  secao: 'macica',
  encosto: 'com',
  numPernas: 4,
  paredeMm: 3,
  assentoLarguraCm: 44,
  assentoProfundidadeCm: 44,
  assentoEspessuraCm: 2,
  excentXPct: 0,
  excentYPct: 0,
  travessaLarguraCm: 4,
  travessaAlturaCm: 6,
  travessaSecao: 'macica',
  travessaParedeMm: 2
};

for (const mat of Object.values(MATERIAIS)) {
  const opt = document.createElement('option');
  opt.value = mat.id;
  opt.textContent = mat.nome;
  selectMaterial.appendChild(opt);
}

selectMaterial.value = MATERIAIS[PADRAO.material]
  ? PADRAO.material
  : Object.keys(MATERIAIS)[0];

campoEspessura.value = PADRAO.espessuraCm;
campoAltura.value = PADRAO.alturaCm;
campoMassa.value = PADRAO.massaKg;
campoForma.value = PADRAO.forma;
campoSecao.value = PADRAO.secao;
campoEncosto.value = PADRAO.encosto;
campoPernas.value = String(PADRAO.numPernas);
campoParede.value = PADRAO.paredeMm;
campoAssentoLargura.value = PADRAO.assentoLarguraCm;
campoAssentoProfundidade.value = PADRAO.assentoProfundidadeCm;
campoAssentoEspessura.value = PADRAO.assentoEspessuraCm;
if (campoExcentX) campoExcentX.value = PADRAO.excentXPct;
if (campoExcentY) campoExcentY.value = PADRAO.excentYPct;
campoLarguraTravessa.value = PADRAO.travessaLarguraCm;
campoAlturaTravessa.value = PADRAO.travessaAlturaCm;
campoTravessaSecao.value = PADRAO.travessaSecao;
campoTravessaParede.value = PADRAO.travessaParedeMm;

/* ---------- Formatação ---------- */
function n(valor, casas = 2){
  if (!Number.isFinite(valor)) return '—';
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function linha(rotulo, valor){
  return '<div class="linha">' +
    '<span class="rotulo">' + rotulo + '</span>' +
    '<span class="valor">' + valor + '</span>' +
    '</div>';
}

function gaveta(chave, titulo, linhas, abertaPorPadrao){
  if (!gavetasAbertas.has(chave)) {
    gavetasAbertas.set(chave, abertaPorPadrao);
  }
  const aberta = gavetasAbertas.get(chave);
  const idCorpo = 'gaveta-' + chave;

  return '<div class="gaveta' + (aberta ? ' is-aberta' : '') +
      '" data-chave="' + chave + '">' +
    '<button type="button" class="gaveta__cabecalho"' +
      ' aria-expanded="' + (aberta ? 'true' : 'false') + '"' +
      ' aria-controls="' + idCorpo + '">' +
      '<span class="gaveta__titulo">' + titulo + '</span>' +
      '<span class="gaveta__seta" aria-hidden="true"></span>' +
    '</button>' +
    '<div class="gaveta__corpo" id="' + idCorpo + '"' +
      (aberta ? '' : ' hidden') + '>' +
      linhas.join('') +
    '</div>' +
  '</div>';
}

function listaHumana(itens){
  if (itens.length === 1) return itens[0];
  return itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];
}

/* ---------- Centro de carga ----------
 * Os controles devolvem percentual (-100 a +100). O solver trabalha com
 * fracao de meia dimensao (-1 a +1): a conversao e dividir por 100.
 * Fracao, e nao mm, para que 100% signifique sempre "na borda", qualquer
 * que seja o tamanho do assento. */
function lerExcent(){
  const ler = (el) => {
    if (!el) return 0;
    const v = parseFloat(el.value);
    if (!Number.isFinite(v)) return 0;
    return Math.min(1, Math.max(-1, v / 100));
  };
  return { x: ler(campoExcentX), y: ler(campoExcentY) };
}

/* Rotulo do mostrador: "centro", "+45%" ou "−30%". */
function rotuloExcent(pct){
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.5) return 'centro';
  const sinal = pct > 0 ? '+' : '−';
  return sinal + Math.abs(Math.round(pct)) + '%';
}

function atualizarSaidasExcent(){
  const lerPct = (el) => {
    const v = el ? parseFloat(el.value) : 0;
    return Number.isFinite(v) ? v : 0;
  };
  if (saidaExcentX) saidaExcentX.textContent = rotuloExcent(lerPct(campoExcentX));
  if (saidaExcentY) saidaExcentY.textContent = rotuloExcent(lerPct(campoExcentY));
}

/* Verdadeiro quando a carga esta no centro geometrico da placa. */
function cargaCentrada(r){
  return Math.abs(r.entrada.fracX) < 0.005 && Math.abs(r.entrada.fracY) < 0.005;
}

/* ---------- Diagnóstico em linguagem simples ---------- */
function utilizacaoMaxima(r){
  const us = [
    r.tensoes.utilizacao,
    r.flambagem.utilizacaoFlambagem,
    r.assento.utilizacao,
    r.assento.utilizacaoFlecha
  ];
  if (r.flambagemLocal) us.push(r.flambagemLocal.utilizacao);
  if (r.assentoVao) {
    us.push(r.assentoVao.utilizacao, r.assentoVao.utilizacaoFlecha);
  }
  if (r.travessas) {
    us.push(r.travessas.utilizacaoTensao, r.travessas.utilizacaoFlecha);
  }
  if (r.estabilidade) us.push(r.estabilidade.utilizacao);
  return Math.max(...us);
}

function mensagemSegura(r){
  const u = utilizacaoMaxima(r);
  const folga = Math.max(0, (1 - u) * 100);
  return 'Estrutura aprovada. A peça mais solicitada trabalha a ' +
    (u * 100).toFixed(0) + '% do que o material suporta, então sobram ' +
    folga.toFixed(0) + '% de folga.';
}

function mensagemRisco(r){
  if (r.forcas.levantou) {
    return 'A carga está fora da base de apoio: as pernas do lado oposto ' +
           'levantam do chão.';
  }
  if (r.tensoes.utilizacao > 1) {
    return 'A perna entorta: o esforço passa do que o material aguenta.';
  }
  if (r.flambagem.utilizacaoFlambagem > 1) {
    return 'A perna enverga como um canudo: fina e alta demais para esse peso.';
  }
  if (r.flambagemLocal && r.flambagemLocal.esbelta) {
    return 'A parede do tubo é fina demais: ela amassa antes de a perna ceder.';
  }
  if (r.assento.utilizacao > 1) {
    return 'O assento quebra na beirada, no ponto mais longe do apoio.';
  }
  if (r.assento.utilizacaoFlecha > 1) {
    return 'O assento afunda demais na beirada — dá para sentir a cadeira ceder.';
  }
  if (r.assentoVao && r.assentoVao.utilizacao > 1) {
    return 'O assento racha no meio, entre as pernas.';
  }
  if (r.assentoVao && r.assentoVao.utilizacaoFlecha > 1) {
    return 'O assento afunda no meio, entre as pernas.';
  }
  if (r.travessas && r.travessas.utilizacaoTensao > 1) {
    return 'As travessas sob o assento quebram no meio: a viga é fina para a carga distribuída.';
  }
  if (r.travessas && r.travessas.utilizacaoFlecha > 1) {
    return 'As travessas sob o assento vergam: o vão entre as pernas é grande para a seção da viga.';
  }
  if (r.estabilidade && r.estabilidade.tombou) {
    return 'A cadeira tomba: a base é pequena para peso tão fora do centro.';
  }
  return 'Configuração fora dos limites de segurança.';
}

function aplicarSituacao(r){
  palco.classList.remove('palco--seguro', 'palco--risco');
  situacao.classList.remove('situacao--ok', 'situacao--risco', 'situacao--aviso');
  situacao.hidden = false;

  if (!r.ok) {
    palco.classList.add('palco--risco');
    situacao.classList.add('situacao--risco');
    situacao.textContent = r.erros[0];
    return;
  }

  if (r.veredito.aprovado) {
    palco.classList.add('palco--seguro');
    situacao.classList.add('situacao--ok');
    situacao.textContent = mensagemSegura(r);
  } else {
    palco.classList.add('palco--risco');
    situacao.classList.add('situacao--risco');
    situacao.textContent = mensagemRisco(r);
  }
}

/* ---------- Legenda de dimensões ---------- */
function atualizarLegenda(dims, material){
  if (!dims || !material) {
    legenda.textContent = '';
    return;
  }
  legenda.textContent =
    n(dims.altura / 10, 1) + ' × ' +
    n(dims.largura / 10, 1) + ' × ' +
    n(dims.profundidade / 10, 1) + ' cm · ' + material.nome;
}

/* ---------- Painel de resultados ---------- */
function renderResultado(r, dims){
  if (!r.ok) {
    painel.innerHTML = '<div class="veredito veredito--erro">' +
      r.erros.join(' ') + '</div>';
    return;
  }

  const nomeForma = r.entrada.forma === 'redonda' ? 'Redonda' : 'Quadrada';
  const nomeSecao = r.entrada.vazada ? 'Tubular (vazada)' : 'Maciça';
  const nomePernas = r.entrada.numPernas === 1 ? '1 (pedestal central)' : '4';
  const nomeEncosto = r.entrada.comEncosto ? 'Com encosto' : 'Sem encosto (banco)';

  const lSecao = [
    linha('Formato', nomeForma),
    linha('Seção', nomeSecao),
    linha('Encosto', nomeEncosto),
    linha('Número de pernas', nomePernas)
  ];

  if (dims) {
    lSecao.push(linha('Dimensões externas',
      n(dims.altura / 10, 1) + ' × ' + n(dims.largura / 10, 1) + ' × ' +
      n(dims.profundidade / 10, 1) + ' cm'));
  }

  lSecao.push(
    linha('Área (A)', n(r.secao.A, 0) + ' mm²'),
    linha('Inércia (I)', n(r.secao.I, 0) + ' mm⁴'),
    linha('Módulo resistente (W)', n(r.secao.W, 0) + ' mm³'),
    linha('Raio de giração (r)', n(r.secao.r, 3) + ' mm')
  );

  if (r.entrada.vazada) {
    lSecao.push(linha('Parede (ep)', n(r.secao.parede, 2) + ' mm'));
    lSecao.push(linha('Dimensão interna', n(r.secao.interna, 1) + ' mm'));
  }

  let h = '';
  h += gaveta('secao', 'Seção e apoios', lSecao, true);

  /* ---------- Massa por parte ---------- */
  const lMassa = [linha('Pernas', n(r.massa.pernas, 2) + ' kg')];
  if (r.massa.pe > 0) {
    lMassa.push(linha('Pé do pedestal', n(r.massa.pe, 2) + ' kg'));
  }
  lMassa.push(linha('Assento', n(r.massa.assento, 2) + ' kg'));
  if (r.massa.travessas > 0) {
    lMassa.push(linha('Travessas do assento', n(r.massa.travessas, 2) + ' kg'));
  }
  if (r.entrada.comEncosto) {
    lMassa.push(linha('Postes do encosto', n(r.massa.postes, 2) + ' kg'));
    lMassa.push(linha('Painel do encosto', n(r.massa.encosto, 2) + ' kg'));
  }
  lMassa.push(linha('Massa total', n(r.massa.total, 2) + ' kg'));
  lMassa.push(linha('Peso próprio', n(r.massa.total * 9.81, 1) + ' N'));
  h += gaveta('massa', 'Massa por parte', lMassa, false);

  /* ---------- Esforços ---------- */
  const centrada = cargaCentrada(r);

  const lEsforcos = [
    linha('Carga total (P)', n(r.forcas.P, 1) + ' N'),
    linha('Centro de carga',
      centrada
        ? 'no centro do assento'
        : 'X ' + rotuloExcent(r.entrada.fracX * 100) +
          ' · Y ' + rotuloExcent(r.entrada.fracY * 100)),
    linha('Deslocamento em X', n(r.entrada.eX, 1) + ' mm'),
    linha('Deslocamento em Y', n(r.entrada.eY, 1) + ' mm'),
    linha('Reação média por perna', n(r.forcas.Nmedio, 1) + ' N')
  ];

  if (r.entrada.numPernas === 4) {
    lEsforcos.push(
      linha('Parcela em X (ΔNx)', n(r.forcas.dNx, 1) + ' N'),
      linha('Parcela em Y (ΔNy)', n(r.forcas.dNy, 1) + ' N'),
      linha('Parcela total (ΔN)', n(r.forcas.dN, 1) + ' N')
    );
  }

  lEsforcos.push(
    linha('Reação máxima (N)', n(r.forcas.Nmax, 1) + ' N'),
    linha('Reação mínima (N)', n(r.forcas.Nmin, 1) + ' N'),
    linha('Momento na perna (M)', n(r.forcas.Mperna, 0) + ' N·mm')
  );

  if (r.forcas.levantou) {
    lEsforcos.push(linha('Atenção',
      'a carga saiu da base — há perna levantando'));
  }

  h += gaveta('esforcos', 'Esforços', lEsforcos, false);

  /* ---------- Reações por perna ---------- */
  if (r.forcas.reacoesPernas) {
    const lReacoes = r.forcas.reacoesPernas.map(p => {
      const lado = (p.sinalX > 0 ? 'direita' : 'esquerda') + ' / ' +
                   (p.sinalY > 0 ? 'trás' : 'frente');
      return linha('Perna ' + p.indice + ' (' + lado + ')',
        n(p.valor, 1) + ' N' + (p.levantou ? ' — levanta' : ''));
    });
    lReacoes.push(linha('Soma das quatro',
      n(r.forcas.reacoesPernas.reduce((s, p) => s + p.valor, 0), 1) + ' N'));
    h += gaveta('reacoes', 'Reações por perna', lReacoes, false);
  } else {
    h += gaveta('reacoes', 'Reações por perna', [
      linha('Pedestal', n(r.forcas.Nmax, 1) + ' N'),
      linha('Momento em X', n(r.entrada.eY * r.forcas.P, 0) + ' N·mm'),
      linha('Momento em Y', n(r.entrada.eX * r.forcas.P, 0) + ' N·mm'),
      linha('Momento equivalente', n(r.forcas.Mperna, 0) + ' N·mm')
    ], false);
  }

  h += gaveta('tensoes', 'Tensões normais', [
    linha('Axial (N/A)', n(r.tensoes.sigmaAxial, 3) + ' MPa'),
    linha('Flexão (M·c/I)', n(r.tensoes.sigmaFlexao, 3) + ' MPa'),
    linha('Máxima', n(r.tensoes.sigmaMax, 3) + ' MPa'),
    linha('Admissível', n(r.tensoes.sigmaAdm, 3) + ' MPa'),
    linha('Utilização', n(r.tensoes.utilizacao * 100, 1) + '%')
  ], false);

  h += gaveta('flambagem', 'Flambagem global', [
    linha('K (comprimento efetivo)', n(r.flambagem.K, 2)),
    linha('Índice de esbeltez', n(r.flambagem.lambda, 1)),
    linha('Carga crítica (Pcr)', n(r.flambagem.Pcr / 1000, 2) + ' kN'),
    linha('Utilização', n(r.flambagem.utilizacaoFlambagem * 100, 1) + '%')
  ], false);

  if (r.flambagemLocal) {
    h += gaveta('local', 'Flambagem local da parede', [
      linha('Relação (t − 2ep)/ep', n(r.flambagemLocal.lambdaLocal, 2)),
      linha('Limite 1,40√(E/σ)', n(r.flambagemLocal.lambdaLimite, 2)),
      linha('Utilização', n(r.flambagemLocal.utilizacao * 100, 1) + '%')
    ], false);
  }

  const lAssento = [
    linha('Dimensões (L × P × h)',
      n(r.assento.b, 0) + ' × ' + n(r.assento.p, 0) + ' × ' +
      n(r.assento.h, 1) + ' mm'),
    linha('Sobrepasso em X (a)', n(r.assento.folgaX, 1) + ' mm'),
    linha('Sobrepasso em Y (a)', n(r.assento.folgaY, 1) + ' mm')
  ];

  if (!centrada) {
    lAssento.push(linha('Balanço com a carga deslocada',
      n(r.assento.a, 1) + ' mm'));
  }

  lAssento.push(
    linha('Momento no engaste (M)', n(r.assento.M, 0) + ' N·mm'),
    linha('Tensão de flexão', n(r.assento.sigma, 3) + ' MPa'),
    linha('Utilização (tensão)', n(r.assento.utilizacao * 100, 1) + '%'),
    linha('Flecha', n(r.assento.flecha, 3) + ' mm'),
    linha('Flecha limite', n(r.assento.flechaLimite, 3) + ' mm'),
    linha('Utilização (flecha)', n(r.assento.utilizacaoFlecha * 100, 1) + '%')
  );

  h += gaveta('assento', 'Assento em balanço', lAssento, false);

  if (r.assentoVao) {
    h += gaveta('vao', 'Assento entre apoios', [
      linha('Vão livre (Lv)', n(r.assentoVao.L, 0) + ' mm'),
      linha('Área do assento', n(r.assentoVao.area, 0) + ' mm²'),
      linha('Pressão uniforme (q)', n(r.assentoVao.q, 6) + ' N/mm²'),
      linha('Momento por largura', n(r.assentoVao.M, 2) + ' N·mm/mm'),
      linha('Tensão de flexão', n(r.assentoVao.sigma, 3) + ' MPa'),
      linha('Utilização (tensão)', n(r.assentoVao.utilizacao * 100, 1) + '%'),
      linha('Flecha', n(r.assentoVao.flecha, 3) + ' mm'),
      linha('Flecha limite', n(r.assentoVao.flechaLimite, 3) + ' mm'),
      linha('Utilização (flecha)', n(r.assentoVao.utilizacaoFlecha * 100, 1) + '%')
    ], false);
  }

  if (r.travessas) {
    const lTrav = [
      linha('Seção', r.travessas.vazada
        ? 'Tubular — parede ' + n(r.travessas.parede, 2) + ' mm'
        : 'Maciça'),
      linha('Vão livre (entre faces internas)', n(r.travessas.vao, 1) + ' mm'),
      linha('Seção (b × h)', n(r.travessas.b, 1) + ' × ' +
        n(r.travessas.h, 1) + ' mm'),
      linha('Área da seção (A)', n(r.travessas.A, 1) + ' mm²'),
      linha('Inércia (I)', n(r.travessas.I, 0) + ' mm⁴'),
      linha('Carga distribuída (q)', n(r.travessas.q, 4) + ' N/mm'),
      linha('Momento máximo (M)', n(r.travessas.M, 0) + ' N·mm'),
      linha('Tensão de flexão', n(r.travessas.tensao, 3) + ' MPa'),
      linha('Utilização (tensão)', n(r.travessas.utilizacaoTensao * 100, 1) + '%'),
      linha('Cisalhamento (τ)', n(r.travessas.cisalhamento, 3) + ' MPa'),
      linha('Flecha', n(r.travessas.flecha, 3) + ' mm'),
      linha('Flecha limite', n(r.travessas.flechaLimite, 3) + ' mm'),
      linha('Utilização (flecha)', n(r.travessas.utilizacaoFlecha * 100, 1) + '%'),
      linha('Massa das 4 travessas', n(r.travessas.massaTotal, 2) + ' kg')
    ];
    h += gaveta('travessas', 'Travessas de apoio do assento', lTrav, false);
  }

  if (r.estabilidade) {
    h += gaveta('estabilidade', 'Estabilidade ao tombamento', [
      linha('Excentricidade (e)', n(r.estabilidade.eRes, 1) + ' mm'),
      linha('Deslocamento em X', n(r.estabilidade.eX, 1) + ' mm'),
      linha('Deslocamento em Y', n(r.estabilidade.eY, 1) + ' mm'),
      linha('Braço de tombamento', n(r.estabilidade.braco, 1) + ' mm'),
      linha('Massa própria da cadeira', n(r.estabilidade.massaCadeira, 2) + ' kg'),
      linha('Peso próprio da cadeira', n(r.estabilidade.pesoCadeira, 1) + ' N'),
      linha('Utilização', n(r.estabilidade.utilizacao * 100, 1) + '%')
    ], false);
  }

  h += gaveta('deformacao', 'Deformação', [
    linha('Encurtamento axial', n(r.deformacao.deltaAxial, 4) + ' mm')
  ], false);

  if (r.veredito.aprovado) {
    h += '<div class="veredito veredito--ok">' +
      'Configuração aprovada em todos os critérios.</div>';
  } else {
    h += '<div class="veredito veredito--erro">Configuração reprovada.<ul>' +
      r.veredito.motivos.map(motivo => '<li>' + motivo + '</li>').join('') +
      '</ul></div>';
  }

  painel.innerHTML = h;
}

/* ---------- Gavetas do painel de resultados ---------- */
painel.addEventListener('click', (ev) => {
  const cabecalho = ev.target.closest('.gaveta__cabecalho');
  if (!cabecalho) return;
  const gav = cabecalho.closest('.gaveta');
  if (!gav) return;
  const chave = gav.dataset.chave;
  const abrir = !gav.classList.contains('is-aberta');
  const corpo = document.getElementById('gaveta-' + chave);
  gav.classList.toggle('is-aberta', abrir);
  cabecalho.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  if (corpo) corpo.hidden = !abrir;
  gavetasAbertas.set(chave, abrir);
});

/* ---------- Memorial ---------- */
btnAbrirMemorial.addEventListener('click', () => {
  if (!ultimoResultado) return;
  conteudoMemorial.innerHTML = gerarMemorial(ultimoResultado, ultimasDims);
  if (!dialogMemorial.open) dialogMemorial.showModal();
});

btnFecharMemorial.addEventListener('click', () => {
  dialogMemorial.close();
  limparImpressao();
});

/* ---------- Impressão do memorial ----------
 * Copia o documento para #memorial-print, que fica fora do <dialog>. O
 * diálogo está na top layer do navegador, e ali a área de rolagem corta o
 * conteúdo: ao imprimir com a div rolada até a seção 5, o papel começava na
 * seção 5. Em fluxo normal de página, o documento inteiro é impresso. */
function prepararImpressao(){
  const alvo = document.getElementById('memorial-print');
  if (!alvo) return false;
  const html = conteudoMemorial.innerHTML.trim();
  if (!dialogMemorial.open || !html) {
    alvo.innerHTML = '';
    document.body.classList.remove('imprimindo-memorial');
    return false;
  }
  alvo.innerHTML = html;
  document.body.classList.add('imprimindo-memorial');
  return true;
}

function limparImpressao(){
  const alvo = document.getElementById('memorial-print');
  if (alvo) alvo.innerHTML = '';
  document.body.classList.remove('imprimindo-memorial');
}

btnImprimirMemorial.addEventListener('click', () => {
  prepararImpressao();
  window.print();
  window.setTimeout(limparImpressao, 400);
});

window.addEventListener('beforeprint', prepararImpressao);
window.addEventListener('afterprint', limparImpressao);

/* ---------- Visibilidade dos campos condicionais ----------
 * A parede da perna só existe no perfil tubular; a da travessa, idem. As
 * travessas só existem no quadro de quatro pernas: no pedestal central não
 * há duas pernas para ligar.
 *
 * Como a lista de campos rola dentro do formulário, um campo que aparece
 * pode nascer fora do campo de visão: por isso a gaveta é aberta na troca
 * de opção — nunca a cada tecla digitada. */
function atualizarParede(){
  const tubular = campoSecao.value === 'tubular';
  grupoParede.hidden = !tubular;
  if (tubular && grupoPerna) grupoPerna.open = true;
}

function atualizarParedeTravessa(){
  const vazada = campoTravessaSecao.value === 'tubular';
  grupoParedeTravessa.hidden = !vazada;
  if (vazada && grupoTravessas) grupoTravessas.open = true;
}

function atualizarTravessa(){
  const visivel = campoPernas.value !== '1';
  if (grupoTravessas) grupoTravessas.hidden = !visivel;
}

campoSecao.addEventListener('change', () => {
  atualizarParede();
  simular();
});

campoTravessaSecao.addEventListener('change', () => {
  atualizarParedeTravessa();
  simular();
});

campoPernas.addEventListener('change', () => {
  atualizarTravessa();
  simular();
});

/* ---------- Leitura dos campos ----------
 * Campos opcionais caem no padrão quando vêm vazios ou inválidos, em vez de
 * travar a simulação inteira por causa de um número apagado. */
function numOu(valor, padrao){
  const v = parseFloat(valor);
  return Number.isFinite(v) && v > 0 ? v : padrao;
}

function lerCampos(){
  const faltando = [];
  const materialId = selectMaterial.value;
  if (!materialId) faltando.push('material');

  const espessuraCm = parseFloat(campoEspessura.value);
  if (!Number.isFinite(espessuraCm) || espessuraCm <= 0) {
    faltando.push('dimensão externa da perna');
  }

  const alturaCm = parseFloat(campoAltura.value);
  if (!Number.isFinite(alturaCm) || alturaCm <= 0) {
    faltando.push('altura da perna');
  }

  const massaKg = parseFloat(campoMassa.value);
  if (!Number.isFinite(massaKg) || massaKg <= 0) {
    faltando.push('massa do usuário');
  }

  const forma = campoForma.value;
  if (!forma) faltando.push('formato da perna');

  const secao = campoSecao.value;
  if (!secao) faltando.push('seção');

  const numPernas = parseInt(campoPernas.value, 10);
  if (!Number.isFinite(numPernas)) faltando.push('número de pernas');

  const paredeMm = parseFloat(campoParede.value);
  if (secao === 'tubular' &&
      (!Number.isFinite(paredeMm) || paredeMm <= 0)) {
    faltando.push('parede do tubo');
  }

  const travessaSecao = campoTravessaSecao.value;
  const travessaParedeMm = parseFloat(campoTravessaParede.value);
  if (numPernas !== 1 && travessaSecao === 'tubular' &&
      (!Number.isFinite(travessaParedeMm) || travessaParedeMm <= 0)) {
    faltando.push('parede da travessa');
  }

  const excent = lerExcent();

  return {
    faltando, materialId, espessuraCm, alturaCm, massaKg,
    forma, secao, numPernas, paredeMm,
    assentoLarguraCm: numOu(campoAssentoLargura.value, PADRAO.assentoLarguraCm),
    assentoProfundidadeCm:
      numOu(campoAssentoProfundidade.value, PADRAO.assentoProfundidadeCm),
    assentoEspessuraCm:
      numOu(campoAssentoEspessura.value, PADRAO.assentoEspessuraCm),
    excentX: excent.x,
    excentY: excent.y,
    travessaLarguraCm:
      numOu(campoLarguraTravessa.value, PADRAO.travessaLarguraCm),
    travessaAlturaCm:
      numOu(campoAlturaTravessa.value, PADRAO.travessaAlturaCm),
    travessaVazada: travessaSecao === 'tubular',
    travessaParedeMm:
      numOu(campoTravessaParede.value, PADRAO.travessaParedeMm),
    comEncosto: campoEncosto.value !== 'sem'
  };
}

/* ---------- Pendência de dados ---------- */
function mostrarPendencia(faltando){
  palco.className = 'palco';
  palco.innerHTML = '<p class="palco__vazio">Faltam dados para calcular.</p>';
  situacao.hidden = false;
  situacao.classList.remove('situacao--ok', 'situacao--risco');
  situacao.classList.add('situacao--aviso');
  situacao.textContent = 'Informe ' + listaHumana(faltando) + ' para simular.';
  painel.innerHTML = '<p class="aviso-painel">A simulação precisa de todos os ' +
    'campos preenchidos.</p>';
  legenda.textContent = '';
  ultimoResultado = null;
  ultimasBarras = null;
  ultimasDims = null;
}

/* ---------- Desenho estático ---------- */
function desenharEstatica(){
  if (!ultimoResultado || !ultimoResultado.ok || !ultimasBarras) return;
  renderCadeira(palco, ultimasBarras, ultimoResultado.entrada.material);
  ultimasDims = dimensoesExternas(ultimasBarras);
  atualizarLegenda(ultimasDims, ultimoResultado.entrada.material);
}

/* ---------- Ruína ---------- */
function iniciarRuina(){
  if (!ultimoResultado || !ultimoResultado.ok || !ultimasBarras) return;
  if (pararAnimacao) { pararAnimacao(); pararAnimacao = null; }
  const alvo = ultimoResultado;
  pararAnimacao = animarRuina(
    palco,
    ultimasBarras,
    ultimoResultado.entrada.material,
    {
      largura: 860,
      altura: 620,
      aoTerminar: () => {
        pararAnimacao = null;
        window.setTimeout(() => {
          if (ultimoResultado === alvo) desenharEstatica();
        }, 800);
      }
    }
  );
}

/* ---------- Simulação ao vivo ---------- */
function simular(){
  if (pararAnimacao) { pararAnimacao(); pararAnimacao = null; }
  atualizarParede();
  atualizarParedeTravessa();
  atualizarTravessa();

  const campos = lerCampos();

  if (campos.faltando.length > 0) {
    mostrarPendencia(campos.faltando);
    return null;
  }

  /*
   * Assento, centro de carga e travessa sao CONFIGURACAO de projeto, nao
   * resultado: precisam ser gravados ANTES de calcular, porque tanto a massa
   * (chairModel) quanto as verificacoes (solver, travessas) leem deles.
   *
   * A excentricidade vai como FRACAO de meia dimensao: o controle ja entrega
   * percentual e lerExcent() divide por 100. Fracao, e nao mm, para que 100%
   * signifique sempre "na borda", qualquer que seja a dimensao do assento.
   */
  definirAssento(campos.assentoLarguraCm * 10,
                 campos.assentoProfundidadeCm * 10,
                 campos.assentoEspessuraCm * 10);

  definirExcentricidade(campos.excentX, campos.excentY);

  definirTravessaSecao(campos.travessaLarguraCm * 10,
                       campos.travessaAlturaCm * 10,
                       campos.travessaVazada,
                       campos.travessaParedeMm);

  const r = calcular({
    materialId: campos.materialId,
    espessuraMm: campos.espessuraCm * 10,
    alturaMm: campos.alturaCm * 10,
    massaKg: campos.massaKg,
    forma: campos.forma,
    numPernas: campos.numPernas,
    vazada: campos.secao === 'tubular',
    paredeMm: campos.paredeMm,
    comEncosto: campos.comEncosto
  });

  ultimoResultado = r;
  ultimasBarras = null;
  ultimasDims = null;

  if (!r.ok) {
    renderResultado(r, null);
    aplicarSituacao(r);
    palco.className = 'palco';
    palco.innerHTML = '<p class="palco__vazio">Revise os valores informados.</p>';
    legenda.textContent = '';
    return r;
  }

  ultimasBarras = construirBarras(
    r.entrada.t,
    r.entrada.H,
    r.entrada.material,
    r.entrada.forma,
    r.entrada.numPernas,
    r.entrada.vazada,
    r.entrada.parede,
    r.entrada.comEncosto
  );

  renderCadeira(palco, ultimasBarras, r.entrada.material);
  ultimasDims = dimensoesExternas(ultimasBarras);
  atualizarLegenda(ultimasDims, r.entrada.material);
  renderResultado(r, ultimasDims);
  aplicarSituacao(r);

  return r;
}

/* ---------- Botão Animar ---------- */
function acionarAnimar(){
  if (!ultimoResultado || !ultimoResultado.ok) return;
  if (ultimoResultado.veredito.aprovado) {
    animarJoinhas();
    return;
  }
  iniciarRuina();
}

form.addEventListener('submit', ev => {
  ev.preventDefault();
  acionarAnimar();
});

form.addEventListener('input', () => {
  atualizarSaidasExcent();
  simular();
});

/* ---------- Menu de opções ---------- */
function abrirMenu(abrir){
  menuPainel.hidden = !abrir;
  menuBotao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
}

menuBotao.addEventListener('click', (ev) => {
  ev.stopPropagation();
  abrirMenu(menuPainel.hidden);
});

document.addEventListener('click', (ev) => {
  if (menuPainel.hidden) return;
  if (ev.target.closest('.acoes-entrada')) return;
  if (ev.target.closest('.menu-lateral__painel')) return;
  abrirMenu(false);
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !menuPainel.hidden) abrirMenu(false);
});

/* ---------- Ir para Gráficos ----------
 * O centro de carga viaja como percentual, que e a unidade do controle. A
 * pagina de graficos converte para fracao antes de chamar o solver. */
function urlGraficos(){
  const q = new URLSearchParams();
  q.set('material', selectMaterial.value);
  q.set('t', campoEspessura.value);
  q.set('H', campoAltura.value);
  q.set('m', campoMassa.value);
  q.set('forma', campoForma.value);
  q.set('secao', campoSecao.value);
  q.set('parede', campoParede.value);
  q.set('n', campoPernas.value);
  q.set('encosto', campoEncosto.value);
  q.set('assentoB', campoAssentoLargura.value);
  q.set('assentoP', campoAssentoProfundidade.value);
  q.set('assentoH', campoAssentoEspessura.value);
  if (campoExcentX) q.set('excentX', campoExcentX.value);
  if (campoExcentY) q.set('excentY', campoExcentY.value);
  q.set('travessaB', campoLarguraTravessa.value);
  q.set('travessaH', campoAlturaTravessa.value);
  q.set('travessaSecao', campoTravessaSecao.value);
  q.set('travessaParede', campoTravessaParede.value);
  return 'graficos.html?' + q.toString();
}

itemGraficos.addEventListener('click', () => {
  abrirMenu(false);
  window.open(urlGraficos(), '_blank');
});

/* ---------- Início ---------- */
atualizarSaidasExcent();
atualizarParede();
atualizarParedeTravessa();
atualizarTravessa();
simular();