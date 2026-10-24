import { MATERIAIS } from './materials.js';
import { calcular } from './solver.js';

const form = document.getElementById('form-cadeira');
const selectMaterial = document.getElementById('material');
const campoEspessura = document.getElementById('espessura');
const campoAltura = document.getElementById('altura');
const campoMassa = document.getElementById('massa');
const painel = document.getElementById('resultado');

// Popula o select de materiais
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

function renderizar(r) {
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
    linha('Reacao por perna (media)', `${n(r.forcas.Nmedio, 1)} N`),
    linha('Reacao maxima (N)', `${n(r.forcas.Nmax, 1)} N`),
    linha('Momento na perna (M)', `${n(r.forcas.Mperna, 0)} N·mm`),
  ]);

  const tensoes = grupo('Tensoes normais', [
    linha('Axial (N/A)', `${n(r.tensoes.sigmaAxial, 3)} MPa`),
    linha('Flexao (M·c/I)', `${n(r.tensoes.sigmaFlexao, 3)} MPa`),
    linha('Maxima (sigma)', `${n(r.tensoes.sigmaMax, 3)} MPa`),
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
  const resultado = calcular({
    materialId: selectMaterial.value,
    espessuraMm: parseFloat(campoEspessura.value) * 10,
    alturaMm: parseFloat(campoAltura.value) * 10,
    massaKg: parseFloat(campoMassa.value),
  });
  renderizar(resultado);
  return resultado;
}

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  simular();
});

// Recalcula ao digitar, para a resposta ficar imediata
form.addEventListener('input', simular);

simular();