import { MATERIAIS } from './materials.js';
import { calcular } from './solver.js';
import { construirBarras, dimensoesExternas } from './chairModel.js';
import { renderCadeira } from './render.js';
import { animarRuina, animarJoinhas } from './animacao.js';
import { gerarMemorial } from './memorial.js';

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
const campoPernas = document.getElementById('numPernas');
const painel = document.getElementById('resultado');
const palco = document.getElementById('palco');
const situacao = document.getElementById('situacao');

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

/* ---------- Select de materiais e valores iniciais ---------- */
const PADRAO = {
  material: 'madeira',
  espessuraCm: 4,
  alturaCm: 45,
  massaKg: 90,
  forma: 'quadrada',
  secao: 'macica',
  numPernas: 4,
  paredeMm: 3
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
campoPernas.value = String(PADRAO.numPernas);
campoParede.value = PADRAO.paredeMm;

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

/** Junta nomes em lista legível: "a, b e c". */
function listaHumana(itens){
  if (itens.length === 1) return itens[0];
  return itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];
}

/* ---------- Diagnóstico em linguagem simples ---------- */

/** Maior utilização entre todas as verificações. */
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
  if (r.forcas.levantou) {
    return 'A cadeira emborca: o peso na beirada levanta as pernas do lado oposto.';
  }
  if (r.estabilidade && r.estabilidade.tombou) {
    return 'A cadeira tomba: a base é pequena para peso tão fora do centro.';
  }
  return 'Configuração fora dos limites de segurança.';
}

function limparSituacao(){
  palco.classList.remove('palco--seguro', 'palco--risco');
  situacao.hidden = true;
  situacao.classList.remove('situacao--ok', 'situacao--risco', 'situacao--aviso');
  situacao.textContent = '';
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

  const lSecao = [
    linha('Formato', nomeForma),
    linha('Seção', nomeSecao),
    linha('Número de pernas', nomePernas)
  ];

  /* A legenda de dimensões saiu de baixo do desenho para liberar altura.
     A informação continua disponível aqui. */
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

  h += gaveta('esforcos', 'Esforços', [
    linha('Carga total (P)', n(r.forcas.P, 1) + ' N'),
    linha('Reação média por perna', n(r.forcas.Nmedio, 1) + ' N'),
    linha('Reação máxima (N)', n(r.forcas.Nmax, 1) + ' N'),
    linha('Momento na perna (M)', n(r.forcas.Mperna, 0) + ' N·mm')
  ], false);

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

  h += gaveta('assento', 'Assento em balanço', [
    linha('Balanço (a)', n(r.assento.a, 1) + ' mm'),
    linha('Momento no engaste (M)', n(r.assento.M, 0) + ' N·mm'),
    linha('Tensão de flexão', n(r.assento.sigma, 3) + ' MPa'),
    linha('Utilização (tensão)', n(r.assento.utilizacao * 100, 1) + '%'),
    linha('Flecha', n(r.assento.flecha, 3) + ' mm'),
    linha('Flecha limite', n(r.assento.flechaLimite, 3) + ' mm'),
    linha('Utilização (flecha)', n(r.assento.utilizacaoFlecha * 100, 1) + '%')
  ], false);

  if (r.assentoVao) {
    h += gaveta('vao', 'Assento entre apoios', [
      linha('Vão livre (L)', n(r.assentoVao.L, 0) + ' mm'),
      linha('Pressão uniforme (q)', n(r.assentoVao.q, 6) + ' N/mm²'),
      linha('Momento por largura', n(r.assentoVao.M, 2) + ' N·mm/mm'),
      linha('Tensão de flexão', n(r.assentoVao.sigma, 3) + ' MPa'),
      linha('Utilização (tensão)', n(r.assentoVao.utilizacao * 100, 1) + '%'),
      linha('Flecha', n(r.assentoVao.flecha, 3) + ' mm'),
      linha('Flecha limite', n(r.assentoVao.flechaLimite, 3) + ' mm'),
      linha('Utilização (flecha)', n(r.assentoVao.utilizacaoFlecha * 100, 1) + '%')
    ], false);
  }

  if (r.estabilidade) {
    h += gaveta('estabilidade', 'Estabilidade ao tombamento', [
      linha('Excentricidade (e)', n(r.estabilidade.e, 1) + ' mm'),
      linha('Braço de tombamento', n(r.estabilidade.braco, 1) + ' mm'),
      linha('Peso próprio da cadeira', n(r.estabilidade.pesoCadeira, 1) + ' N'),
      linha('Utilização', n(r.estabilidade.utilizacao * 100, 1) + '%')
    ], false);
  }

  h += gaveta('massa', 'Deformação e massa', [
    linha('Encurtamento axial', n(r.deformacao.deltaAxial, 4) + ' mm'),
    linha('Massa das pernas', n(r.massa.pernas, 2) + ' kg'),
    linha('Massa total', n(r.massa.total, 2) + ' kg')
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

/* ---------- Gavetas ---------- */
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

btnFecharMemorial.addEventListener('click', () => dialogMemorial.close());
btnImprimirMemorial.addEventListener('click', () => window.print());

/* ---------- Campo de parede ---------- */
function atualizarParede(){
  grupoParede.hidden = campoSecao.value !== 'tubular';
}

campoSecao.addEventListener('change', () => {
  atualizarParede();
  simular();
});

/* ---------- Leitura dos campos ---------- */
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

  return {
    faltando, materialId, espessuraCm, alturaCm, massaKg,
    forma, secao, numPernas, paredeMm
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

  ultimoResultado = null;
  ultimasBarras = null;
  ultimasDims = null;
}

/* ---------- Desenho estático ---------- */
function desenharEstatica(){
  if (!ultimoResultado || !ultimoResultado.ok || !ultimasBarras) return;

  renderCadeira(palco, ultimasBarras, ultimoResultado.entrada.material);
  ultimasDims = dimensoesExternas(ultimasBarras);
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

/* ---------- Simulação ao vivo ----------
 * Calcula, desenha, mostra parecer e aplica a cor de estado. Não anima:
 * a animação é exclusiva do botão. */
function simular(){
  if (pararAnimacao) { pararAnimacao(); pararAnimacao = null; }
  atualizarParede();

  const campos = lerCampos();

  if (campos.faltando.length > 0) {
    mostrarPendencia(campos.faltando);
    return null;
  }

  const r = calcular({
    materialId: campos.materialId,
    espessuraMm: campos.espessuraCm * 10,
    alturaMm: campos.alturaCm * 10,
    massaKg: campos.massaKg,
    forma: campos.forma,
    numPernas: campos.numPernas,
    vazada: campos.secao === 'tubular',
    paredeMm: campos.paredeMm
  });

  ultimoResultado = r;
  ultimasBarras = null;
  ultimasDims = null;

  if (!r.ok) {
    renderResultado(r, null);
    aplicarSituacao(r);
    palco.className = 'palco';
    palco.innerHTML = '<p class="palco__vazio">Revise os valores informados.</p>';
    return r;
  }

  ultimasBarras = construirBarras(
    r.entrada.t,
    r.entrada.H,
    r.entrada.material,
    r.entrada.forma,
    r.entrada.numPernas,
    r.entrada.vazada,
    r.entrada.parede
  );

  renderCadeira(palco, ultimasBarras, r.entrada.material);
  ultimasDims = dimensoesExternas(ultimasBarras);

  renderResultado(r, ultimasDims);
  aplicarSituacao(r);

  return r;
}

/* ---------- Botão Animar ----------
 * Aprovado  -> joinhas nas beiradas. A cadeira não é tocada.
 * Reprovado -> a cadeira desmonta e cai; depois volta ao estado íntegro. */
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

form.addEventListener('input', simular);

/* ---------- Início ---------- */
atualizarParede();
simular();