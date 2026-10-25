import { MATERIAIS } from './materials.js';
import { calcular } from './solver.js';
import { construirBarras } from './chairModel.js';
import { renderCadeira } from './render.js';
import { gerarMemorial } from './memorial.js';

const form = document.getElementById('form-cadeira');
const selectMaterial = document.getElementById('material');
const campoEspessura = document.getElementById('espessura');
const campoAltura = document.getElementById('altura');
const campoMassa = document.getElementById('massa');
const campoForma = document.getElementById('forma');
const campoPernas = document.getElementById('numPernas');
const painel = document.getElementById('resultado');
const palco = document.getElementById('palco');

const dialogMemorial = document.getElementById('memorial-dialog');
const conteudoMemorial = document.getElementById('memorial-conteudo');
const btnAbrirMemorial = document.getElementById('abrir-memorial');
const btnFecharMemorial = document.getElementById('memorial-fechar');
const btnImprimirMemorial = document.getElementById('memorial-imprimir');

/*
 * Estado das gavetas. Precisa viver fora do HTML: o formulário dispara
 * "input" a cada tecla e o painel é reconstruído inteiro.
 */
const gavetasAbertas = new Map();

let ultimoResultado = null;
let ultimasDims = null;

for (const mat of Object.values(MATERIAIS)) {
  const opt = document.createElement('option');
  opt.value = mat.id;
  opt.textContent = mat.nome;
  selectMaterial.appendChild(opt);
}

/** Formata número no padrão brasileiro. */
function n(valor, casas = 2){
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

/** Uma linha do painel: rótulo à esquerda, valor à direita. */
function linha(rotulo, valor){
  return '<div class="linha">' +
    '<span class="rotulo">' + rotulo + '</span>' +
    '<span class="valor">' + valor + '</span>' +
    '</div>';
}

/** Uma gaveta recolhível com título e linhas. */
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

function renderResultado(r){
  if (!r.ok) {
    painel.innerHTML = '<div class="veredito veredito--erro">' +
      r.erros.join(' ') + '</div>';
    return;
  }

  const nomeForma = r.entrada.forma === 'redonda' ? 'Redonda' : 'Quadrada';
  const nomePernas = r.entrada.numPernas === 1 ? '1 (pedestal central)' : '4';

  let h = '';

  h += gaveta('secao', 'Seção e apoios', [
    linha('Formato', nomeForma),
    linha('Número de pernas', nomePernas),
    linha('Área (A)', n(r.secao.A, 0) + ' mm²'),
    linha('Inércia (I)', n(r.secao.I, 0) + ' mm⁴'),
    linha('Módulo resistente (W)', n(r.secao.W, 0) + ' mm³'),
    linha('Raio de giração (r)', n(r.secao.r, 3) + ' mm')
  ], true);

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

  h += gaveta('flambagem', 'Flambagem', [
    linha('K (comprimento efetivo)', n(r.flambagem.K, 2)),
    linha('Índice de esbeltez', n(r.flambagem.lambda, 1)),
    linha('Carga crítica (Pcr)', n(r.flambagem.Pcr / 1000, 2) + ' kN'),
    linha('Utilização', n(r.flambagem.utilizacaoFlambagem * 100, 1) + '%')
  ], false);

  h += gaveta('assento', 'Assento em balanço', [
    linha('Balanço (a)', n(r.assento.a, 1) + ' mm'),
    linha('Momento no engaste (M)', n(r.assento.M, 0) + ' N·mm'),
    linha('Tensão de flexão', n(r.assento.sigma, 3) + ' MPa'),
    linha('Utilização (tensão)', n(r.assento.utilizacao * 100, 1) + '%'),
    linha('Flecha', n(r.assento.flecha, 3) + ' mm'),
    linha('Flecha limite', n(r.assento.flechaLimite, 3) + ' mm'),
    linha('Utilização (flecha)', n(r.assento.utilizacaoFlecha * 100, 1) + '%')
  ], false);

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
      r.veredito.motivos.map(m => '<li>' + m + '</li>').join('') +
      '</ul></div>';
  }

  painel.innerHTML = h;
}

/* Delegação: um único listener que sobrevive a todos os re-renders. */
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

/* Memorial */
btnAbrirMemorial.addEventListener('click', () => {
  if (!ultimoResultado) return;
  conteudoMemorial.innerHTML = gerarMemorial(ultimoResultado, ultimasDims);
  if (!dialogMemorial.open) dialogMemorial.showModal();
});

btnFecharMemorial.addEventListener('click', () => dialogMemorial.close());
btnImprimirMemorial.addEventListener('click', () => window.print());

function simular(){
  const espessuraMm = parseFloat(campoEspessura.value) * 10;
  const alturaMm = parseFloat(campoAltura.value) * 10;
  const massaKg = parseFloat(campoMassa.value);

  const r = calcular({
    materialId: selectMaterial.value,
    espessuraMm,
    alturaMm,
    massaKg,
    forma: campoForma.value,
    numPernas: parseInt(campoPernas.value, 10)
  });

  renderResultado(r);
  ultimoResultado = r;
  ultimasDims = null;

  if (!r.ok) return r;

  const material = r.entrada.material;
  const barras = construirBarras(r.entrada.t, r.entrada.H, material,
                                 r.entrada.forma, r.entrada.numPernas);
  const dims = renderCadeira(palco, barras, material);
  ultimasDims = dims;

  const p = document.createElement('p');
  p.className = 'legenda';
  p.textContent = n(dims.altura / 10, 1) + ' × ' + n(dims.largura / 10, 1) +
    ' × ' + n(dims.profundidade / 10, 1) + ' cm · ' + material.nome;
  palco.appendChild(p);

  return r;
}

form.addEventListener('submit', ev => { ev.preventDefault(); simular(); });
form.addEventListener('input', simular);

simular();