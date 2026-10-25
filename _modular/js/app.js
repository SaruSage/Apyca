import { MATERIAIS } from './materials.js';
import { calcular } from './solver.js';
import { construirBarras } from './chairModel.js';
import { renderCadeira } from './render.js';

const form = document.getElementById('form-cadeira');
const selectMaterial = document.getElementById('material');
const campoEspessura = document.getElementById('espessura');
const campoAltura = document.getElementById('altura');
const campoMassa = document.getElementById('massa');
const painel = document.getElementById('resultado');
const palco = document.getElementById('palco');
const barras = construirBarras(r.entrada.t, r.entrada.H, material);

for (const mat of Object.values(MATERIAIS)) {
  const opt = document.createElement('option');
  opt.value = mat.id;
  opt.textContent = mat.nome;
  selectMaterial.appendChild(opt);
}

function n(valor, casas = 2) {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function linha(rotulo, valor) {
  return `<div class="linha"><span class="rotulo">${rotulo}</span><span class="valor">${valor}</span></div>`;
}

function grupo(titulo, linhas) {
  return `<div class="grupo"><h3>${titulo}</h3>${linhas.join('')}</div>`;
}

function renderizarResultado(r) {
  if (!r.ok) {
    painel.innerHTML = `<div class="veredito veredito--erro">${r.erros.join(' ')}</div>`;
    return;
  }

  const secao = grupo('Secao da perna', [
    linha('Area (A)', `${n(r.secao.A, 0)} mm²`),
    linha('Inercia (I)', `${n(r.secao.I, 0)} mm⁴`),
    linha('Modulo resistente (W)', `${n(r.secao.W, 0)} mm³`),
  ]);

  const forcas = grupo('Esforcos', [
    linha('Carga total (P)', `${n(r.forcas.P, 1)} N`),
    linha('Reacao media por perna', `${n(r.forcas.Nmedio, 1)} N`),
    linha('Reacao maxima (N)', `${n(r.forcas.Nmax, 1)} N`),
    linha('Momento na perna (M)', `${n(r.forcas.Mperna, 0)} N·mm`),
  ]);

  const tensoes = grupo('Tensoes normais', [
    linha('Axial (N/A)', `${n(r.tensoes.sigmaAxial, 3)} MPa`),
    linha('Flexao (M·c/I)', `${n(r.tensoes.sigmaFlexao, 3)} MPa`),
    linha('Maxima', `${n(r.tensoes.sigmaMax, 3)} MPa`),
    linha('Admissivel', `${n(r.tensoes.sigmaAdm, 3)} MPa`),
    linha('Utilizacao', `${n(r.tensoes.utilizacao * 100, 1)}%`),
  ]);

  const flambagem = grupo('Flambagem', [
    linha('Indice de esbeltez', n(r.flambagem.lambda, 1)),
    linha('Carga critica (Pcr)', `${n(r.flambagem.Pcr / 1000, 2)} kN`),
    linha('Utilizacao', `${n(r.flambagem.utilizacaoFlambagem * 100, 1)}%`),
  ]);

  const outros = grupo('Deformacao e massa', [
    linha('Encurtamento axial', `${n(r.deformacao.deltaAxial, 4)} mm`),
    linha('Massa das pernas', `${n(r.massa.pernas, 2)} kg`),
    linha('Massa total', `${n(r.massa.total, 2)} kg`),
  ]);

  const veredito = r.veredito.aprovado
    ? '<div class="veredito veredito--ok">Configuracao aprovada em todos os criterios.</div>'
    : `<div class="veredito veredito--erro">Configuracao reprovada.<ul>${r.veredito.motivos
        .map((m) => `<li>${m}</li>`)
        .join('')}</ul></div>`;

  painel.innerHTML = secao + forcas + tensoes + flambagem + outros + veredito;
}

function simular() {
  const espessuraMm = parseFloat(campoEspessura.value) * 10;
  const alturaMm = parseFloat(campoAltura.value) * 10;
  const massaKg = parseFloat(campoMassa.value);

  const r = calcular({
    materialId: selectMaterial.value,
    espessuraMm,
    alturaMm,
    massaKg,
  });

  renderizarResultado(r);

  if (r.ok) {
    const material = r.entrada.material;
    const barras = construirBarras(r.entrada.t, r.entrada.H);
    const dims = renderCadeira(palco, barras, material);

    palco.insertAdjacentHTML(
      'beforeend',
      `<p class="legenda">${n(dims.altura / 10, 1)} × ${n(dims.largura / 10, 1)} × ` +
        `${n(dims.profundidade / 10, 1)} cm &nbsp;·&nbsp; material: ${material.nome}</p>`
    );
  }

  return r;
}

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  simular();
});

form.addEventListener('input', simular);

simular();