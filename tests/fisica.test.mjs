/**
 * Testes do motor de calculo — execucao no Node.
 *
 *   node tests/fisica.test.mjs
 *
 * Sai com codigo 1 se algum teste falhar, para servir de gate em script.
 *
 * CENTRO DE CARGA BIAXIAL
 * definirExcentricidade() recebe DUAS fracoes de meia dimensao, uma por eixo,
 * no intervalo [-1, +1]. Antes recebia um unico deslocamento em milimetros.
 *
 * As ancoras deste arquivo foram calculadas a mao com 50 mm em X numa placa
 * de 440 mm de largura. Como a funcao trabalha com fracao, a conversao fica
 * concentrada em excentMm(): 50 / 220 = 0,2273.
 *
 * Nada de constante de material cravada aqui: E, rho, sigmaLimite e CS vem
 * de materials.js. Se o material for corrigido, o teste acompanha.
 */

import { calcular } from '../js/solver.js';
import { construirBarras, definirAssento, definirExcentricidade }
  from '../js/chairModel.js';
import { desenhoTecnico } from '../js/tecnico.js';
import { svgCadeira } from '../js/render.js';
import { gerarMemorial } from '../js/memorial.js';
import { MATERIAIS } from '../js/materials.js';
import { G, CADEIRA, HIPOTESES, TRAVESSAS, ASSENTO }
  from '../js/constantes.js';

/* ---------- Bancada ---------- */
let passou = 0;
let falhou = 0;
const falhas = [];

function quase(real, esperado, tol = 1e-6){
  if (!Number.isFinite(real) || !Number.isFinite(esperado)) return false;
  const escala = Math.max(1, Math.abs(esperado));
  return Math.abs(real - esperado) <= tol * escala;
}

function verificar(nome, condicao, detalhe = ''){
  if (condicao) {
    passou += 1;
    console.log('  PASS  ' + nome);
  } else {
    falhou += 1;
    falhas.push(nome + (detalhe ? ' — ' + detalhe : ''));
    console.log('  FAIL  ' + nome + (detalhe ? ' — ' + detalhe : ''));
  }
}

function grupo(titulo){
  console.log('\n' + titulo);
}

/* ---------- Simbolos e valores derivados dos materiais ---------- */
const Lq = HIPOTESES.L;
const R12 = Math.sqrt(12);

const mat = id => MATERIAIS[id];
const adm = id => mat(id).sigmaLimite / mat(id).CS;

const PA = 100 * G;

/* A largura da travessa e limitada por t; e ela que define a abertura
   interna do quadro de apoio do assento. */
const bTrav = t => Math.min(TRAVESSAS.largura, t);
const vaoQuadro = t => Lq - 2 * bTrav(t);

/**
 * Grava o centro de carga a partir de deslocamentos em MILIMETROS, que e
 * como as ancoras foram calculadas a mao. A funcao de verdade trabalha com
 * fracao de meia dimensao, entao a conversao acontece aqui — num lugar so.
 */
function excentMm(mmX, mmY = 0){
  const aL = ASSENTO.largura;
  const aP = ASSENTO.profundidade;
  return definirExcentricidade(mmX / (aL / 2), mmY / (aP / 2));
}

/* Volta ao padrao entre grupos: um teste nao deve herdar estado do anterior. */
function reiniciar(){
  definirAssento(440, 440, 20);
  definirExcentricidade(0, 0);
}

const ENTRADA = {
  materialId: 'madeira',
  espessuraMm: 40,
  alturaMm: 450,
  massaKg: 100
};

/* ---------- Centro de carga: faixa e conversao ---------- */
grupo('Centro de carga — faixa e conversao');

reiniciar();

verificar('definirExcentricidade aceita os dois eixos',
  (() => {
    const r = definirExcentricidade(0.5, -0.5);
    return quase(r.x, 0.5) && quase(r.y, -0.5);
  })());

verificar('valor acima de 1 e ignorado',
  (() => {
    definirExcentricidade(0.5, -0.5);
    const r = definirExcentricidade(1.5, 0);
    return quase(r.x, 0.5) && quase(r.y, -0.5);
  })());

verificar('valor abaixo de -1 e ignorado',
  (() => {
    definirExcentricidade(0.5, -0.5);
    const r = definirExcentricidade(0, -3);
    return quase(r.x, 0.5) && quase(r.y, -0.5);
  })());

verificar('zero e valor valido, nao ausencia de dado',
  (() => {
    const r = definirExcentricidade(0, 0);
    return r.x === 0 && r.y === 0;
  })());

reiniciar();
excentMm(50);
verificar('50 mm viram fracao de meia largura',
  quase(ASSENTO.excentricidadeX, 50 / 220),
  'obtido ' + ASSENTO.excentricidadeX);

/* ---------- Madeira, 4 pernas: cadeia completa conferida a mao ---------- */
grupo('Madeira, 4 pernas — cadeia de forcas');

reiniciar();
excentMm(50);

const quatro = calcular(ENTRADA);

/*
 * Massa conferida a mao, peca por peca, com ASSENTO 440x440x20 e
 * travessas 40x60 no vao de 320:
 *   pernas      4 x 40x40x450   = 2.880.000 mm3
 *   assento     440x440x20      = 3.872.000 mm3
 *   travessas   4 x 40x60x320   = 3.072.000 mm3
 *   postes      2 x 40x40x320   = 1.024.000 mm3
 *   encosto     320x20x230      = 1.472.000 mm3
 *   total                       = 12.320.000 mm3
 *   12,32e-3 m3 x 500 kg/m3 = 6,16 kg
 */
const massaRef = 6.16;
const dNRef = PA * 50 / (2 * (Lq - 40));
const NmedRef = (PA + massaRef * G) / 4;
const NmaxRef = NmedRef + dNRef;

verificar('massa total da cadeira = 6,16 kg (conferida a mao)',
  quatro.ok && quase(quatro.massa.total, massaRef, 1e-3),
  'obtido ' + (quatro.ok ? quatro.massa.total : '-'));
verificar('area da perna = t^2', quatro.ok && quase(quatro.secao.A, 1600));
verificar('dNx = P*eX/(2*(L-t))',
  quatro.ok && quase(quatro.forcas.dNx, dNRef),
  'obtido ' + (quatro.ok ? quatro.forcas.dNx : '-'));
verificar('dNy nulo quando so ha deslocamento em X',
  quatro.ok && quase(quatro.forcas.dNy, 0));
verificar('dN e a soma das duas parcelas',
  quatro.ok && quase(quatro.forcas.dN,
    quatro.forcas.dNx + quatro.forcas.dNy));
verificar('braco do binario exposto = L - t',
  quatro.ok && quase(quatro.forcas.bracoBinario, Lq - 40));
verificar('Nmedio inclui o peso proprio',
  quatro.ok && quase(quatro.forcas.Nmedio, NmedRef),
  'obtido ' + (quatro.ok ? quatro.forcas.Nmedio : '-'));
verificar('Nmedio sem peso proprio nao fecha',
  quatro.ok && !quase(quatro.forcas.Nmedio, PA / 4));
verificar('Nmax = Nmedio + dN',
  quatro.ok && quase(quatro.forcas.Nmax, NmaxRef));
verificar('Nmin = Nmedio - dN',
  quatro.ok && quase(quatro.forcas.Nmin, NmedRef - dNRef));
verificar('casal resistente fecha com P*eX',
  quatro.ok && quase(quatro.forcas.dN * 2 * quatro.forcas.bracoBinario, PA * 50));
verificar('momento na perna nulo (perna axial)',
  quatro.ok && quase(quatro.forcas.Mperna, 0));
verificar('flexao nula na perna',
  quatro.ok && quase(quatro.tensoes.sigmaFlexao, 0));
verificar('tensao axial = Nmax/A',
  quatro.ok && quase(quatro.tensoes.sigmaAxial, NmaxRef / 1600),
  'obtido ' + (quatro.ok ? quatro.tensoes.sigmaAxial : '-'));
verificar('tensao maxima = axial (sem flexao)',
  quatro.ok && quase(quatro.tensoes.sigmaMax, NmaxRef / 1600));
verificar('utilizacao = sigmaMax/sigmaAdm',
  quatro.ok && quase(quatro.tensoes.utilizacao,
    (NmaxRef / 1600) / adm('madeira')));
verificar('esbeltez = K*H/r',
  quatro.ok && quase(quatro.flambagem.lambda, 450 / (40 / R12)));
verificar('carga critica de Euler',
  quatro.ok && quase(quatro.flambagem.Pcr,
    (Math.PI ** 2 * mat('madeira').E * (40 ** 4 / 12)) / (450 ** 2)));
verificar('encurtamento = N*H/(A*E)',
  quatro.ok && quase(quatro.deformacao.deltaAxial,
    (NmaxRef * 450) / (1600 * mat('madeira').E)));
verificar('madeira de 4 cm aprova',
  quatro.ok && quatro.veredito.aprovado === true);

/* ---------- Reacoes individuais ---------- */
grupo('Reacoes individuais nas quatro pernas');

const rp = quatro.ok ? quatro.forcas.reacoesPernas : null;

verificar('resultado expoe quatro reacoes', !!rp && rp.length === 4);
verificar('soma das quatro = carga total',
  !!rp && quase(rp.reduce((s, p) => s + p.bruta, 0), PA + massaRef * G));
verificar('maior reacao = Nmax',
  !!rp && quase(Math.max(...rp.map(p => p.bruta)), quatro.forcas.Nmax));
verificar('menor reacao = Nmin',
  !!rp && quase(Math.min(...rp.map(p => p.bruta)), quatro.forcas.Nmin));
verificar('perna do lado carregado recebe mais',
  !!rp && rp[3].bruta > rp[2].bruta,
  'perna3 ' + (rp ? rp[3].bruta.toFixed(2) : '-') +
  ' vs perna2 ' + (rp ? rp[2].bruta.toFixed(2) : '-'));
verificar('perna do lado carregado responde a +eX',
  !!rp && rp[3].sinalX === 1 && rp[2].sinalX === -1);

/* Quadrantes negativos: carga para a esquerda (-eX) e para tras (-eY) */
reiniciar();
excentMm(-50, 0);
const rEsq = calcular(ENTRADA);
const rpEsq = rEsq.ok ? rEsq.forcas.reacoesPernas : null;
verificar('-eX carrega as pernas da esquerda e alivia a direita',
  !!rpEsq && rpEsq[0].bruta > rpEsq[1].bruta && rpEsq[2].bruta > rpEsq[3].bruta);
verificar('-eX sobrecarrega a travessa esquerda frente a direita',
  rEsq.ok && rEsq.travessas.porViga[2].cargaEf > rEsq.travessas.porViga[3].cargaEf);

reiniciar();
excentMm(0, -50);
const rTras = calcular(ENTRADA);
const rpTras = rTras.ok ? rTras.forcas.reacoesPernas : null;
verificar('-eY carrega as pernas do fundo e alivia a frente',
  !!rpTras && rpTras[2].bruta > rpTras[0].bruta && rpTras[3].bruta > rpTras[1].bruta);
verificar('-eY sobrecarrega a travessa traseira frente a frontal',
  rTras.ok && rTras.travessas.porViga[0].cargaEf > rTras.travessas.porViga[1].cargaEf);

/* ---------- Carga centrada: caso padrao do assento ---------- */
grupo('Carga centrada — caso padrao');

reiniciar();
const centrada = calcular(ENTRADA);

verificar('centrada: fracao em X e zero',
  centrada.ok && quase(centrada.entrada.fracX, 0));
verificar('centrada: fracao em Y e zero',
  centrada.ok && quase(centrada.entrada.fracY, 0));
verificar('centrada: deslocamento em mm e zero',
  centrada.ok && quase(centrada.entrada.eX, 0) &&
  quase(centrada.entrada.eY, 0));
verificar('centrada: dN nulo',
  centrada.ok && quase(centrada.forcas.dN, 0),
  'obtido ' + (centrada.ok ? centrada.forcas.dN : '-'));
verificar('centrada: Nmax = Nmedio',
  centrada.ok && quase(centrada.forcas.Nmax, centrada.forcas.Nmedio));
verificar('centrada: Nmin = Nmedio',
  centrada.ok && quase(centrada.forcas.Nmin, centrada.forcas.Nmedio));
verificar('centrada: quatro reacoes iguais',
  centrada.ok && quase(4 * centrada.forcas.Nmedio,
    centrada.forcas.P + centrada.massa.total * G));
verificar('centrada: as quatro pernas recebem o mesmo',
  centrada.ok && centrada.forcas.reacoesPernas.every(
    p => quase(p.bruta, centrada.forcas.Nmedio)));
verificar('centrada: nao levanta',
  centrada.ok && centrada.forcas.levantou === false);

/* ---------- Carga biaxial ---------- */
grupo('Carga biaxial — deslocamento nos dois eixos');

reiniciar();
definirExcentricidade(50 / 220, 50 / 220);

const biaxial = calcular(ENTRADA);
const dNBi = PA * 50 / (2 * (Lq - 40));

verificar('biaxial: as duas parcelas sao iguais com placa quadrada',
  biaxial.ok && quase(biaxial.forcas.dNx, biaxial.forcas.dNy),
  'dNx ' + (biaxial.ok ? biaxial.forcas.dNx.toFixed(3) : '-') +
  ' dNy ' + (biaxial.ok ? biaxial.forcas.dNy.toFixed(3) : '-'));
verificar('biaxial: dN = dNx + dNy',
  biaxial.ok && quase(biaxial.forcas.dN, 2 * dNBi),
  'obtido ' + (biaxial.ok ? biaxial.forcas.dN : '-'));
verificar('biaxial: Nmax soma as duas parcelas',
  biaxial.ok && quase(biaxial.forcas.Nmax, NmedRef + 2 * dNBi));
verificar('biaxial: Nmin subtrai as duas parcelas',
  biaxial.ok && quase(biaxial.forcas.Nmin, NmedRef - 2 * dNBi));
verificar('biaxial: eRes e a resultante',
  biaxial.ok && quase(biaxial.entrada.eRes, Math.hypot(50, 50)));
verificar('biaxial: canto carregado soma as duas',
  biaxial.ok && quase(biaxial.forcas.reacoesPernas[1].bruta,
    biaxial.forcas.Nmax));
verificar('biaxial: canto oposto subtrai as duas',
  biaxial.ok && quase(biaxial.forcas.reacoesPernas[2].bruta,
    biaxial.forcas.Nmin));
verificar('biaxial: soma das quatro reacoes fecha',
  biaxial.ok && quase(
    biaxial.forcas.reacoesPernas.reduce((s, p) => s + p.bruta, 0),
    PA + biaxial.massa.total * G));

/* ---------- Limite de excentricidade ---------- */
grupo('Limite de excentricidade');

reiniciar();
definirExcentricidade(1, 0);

const noLimite = calcular(ENTRADA);

verificar('fracao 1 desloca meia largura (220 mm)',
  noLimite.ok && quase(noLimite.entrada.eX, 220),
  'obtido ' + (noLimite.ok ? noLimite.entrada.eX : '-'));
verificar('fracao 1 levanta as pernas opostas',
  noLimite.ok && noLimite.forcas.levantou === true);
verificar('fracao 1 reprova',
  noLimite.ok && noLimite.veredito.aprovado === false);
verificar('Nmin e zero quando levanta',
  noLimite.ok && quase(noLimite.forcas.Nmin, 0));
verificar('levantou aparece nos motivos',
  noLimite.ok &&
  noLimite.veredito.motivos.some(t => t.indexOf('fora da base') >= 0));

reiniciar();
ASSENTO.excentricidadeX = 1.8;
const foraDaFaixa = calcular(ENTRADA);
verificar('solver reprova fracao fora do intervalo',
  foraDaFaixa.ok === false);
ASSENTO.excentricidadeX = 0;

/* ---------- Assento em balanco ---------- */
grupo('Assento em balanco com carga deslocada');

reiniciar();
excentMm(50);
const bal = calcular(ENTRADA);

verificar('sobrepasso nominal = folga do quadro',
  bal.ok && quase(bal.assento.aNominal, 20),
  'obtido ' + (bal.ok ? bal.assento.aNominal : '-'));
verificar('balanco de calculo soma o deslocamento',
  bal.ok && quase(bal.assento.a, 20 + 50),
  'obtido ' + (bal.ok ? bal.assento.a : '-'));
verificar('balanco de calculo maior que o nominal',
  bal.ok && bal.assento.a > bal.assento.aNominal);

reiniciar();
const balCentrada = calcular(ENTRADA);
verificar('centrada: balanco de calculo = sobrepasso nominal',
  balCentrada.ok && quase(balCentrada.assento.a,
    balCentrada.assento.aNominal));
verificar('centrada: sobrepasso de 20 mm',
  balCentrada.ok && quase(balCentrada.assento.a, 20));

/* ---------- Assento entre apoios ---------- */
grupo('Assento entre apoios — vao igual a abertura do quadro');

reiniciar();
excentMm(50);
const comVao = calcular(ENTRADA);
const asv = comVao.ok ? comVao.assentoVao : null;

const LvA = vaoQuadro(40);
const qA = PA / (440 * 440);
const MA = (qA * LvA * LvA) / 16;
const flechaRefA = (5 * qA * Math.pow(LvA, 4)) /
                   (32 * mat('madeira').E * Math.pow(20, 3));

verificar('4 pernas tem verificacao do vao', comVao.ok && asv !== null);
verificar('vao do assento = L - 2b',
  comVao.ok && quase(asv.L, LvA),
  'obtido ' + (comVao.ok ? asv.L : '-') + ', esperado ' + LvA);
verificar('vao livre exposto no resultado',
  comVao.ok && quase(asv.vaoLivre, LvA));
verificar('lado do quadro preservado',
  comVao.ok && quase(asv.ladoQuadro, Lq));
verificar('bTravessa exposto',
  comVao.ok && quase(asv.bTravessa, bTrav(40)));
verificar('vao do assento e menor que o lado do quadro',
  comVao.ok && asv.L < Lq);
verificar('vao do assento = comprimento da travessa',
  comVao.ok && quase(asv.L, comVao.travessas.comprimento));
verificar('pressao q = P/(aL*aP)',
  comVao.ok && quase(asv.q, qA),
  'obtido ' + (comVao.ok ? asv.q : '-'));
verificar('momento = q*Lv^2/16',
  comVao.ok && quase(asv.M, MA),
  'obtido ' + (comVao.ok ? asv.M : '-'));
verificar('tensao = 6M/h^2',
  comVao.ok && quase(asv.sigma, (6 * MA) / 400));
verificar('flecha = 5qLv^4/(32 E h^3)',
  comVao.ok && quase(asv.flecha, flechaRefA),
  'obtido ' + (comVao.ok ? asv.flecha : '-'));
verificar('flecha limite = Lv/300',
  comVao.ok && quase(asv.flechaLimite, LvA / CADEIRA.divisorFlechaVao));
verificar('madeira de 4 cm aprova no vao',
  comVao.ok && asv.utilizacao < 1 && asv.utilizacaoFlecha < 1);
verificar('coeficiente 1/16 e conservador frente a 0,0479',
  quase((qA * LvA * LvA) / 16, 0.0625 * qA * LvA * LvA) && 0.0625 > 0.0479);

/* ---------- Travessas: distribuicao biaxial ---------- */
grupo('Travessas — distribuicao biaxial da carga');

const tv = comVao.ok ? comVao.travessas : null;
const vaoTv = Lq - 2 * 40;

verificar('quatro vigas no quadro', !!tv && tv.porViga.length === 4);
verificar('vao da travessa = L - 2t', !!tv && quase(tv.vao, vaoTv));
verificar('comprimento da peca = vao de calculo',
  !!tv && quase(tv.comprimento, vaoTv));

verificar('soma das quatro vigas = peso que o quadro sustenta',
  !!tv && quase(tv.porViga.reduce((s, v) => s + v.carga, 0),
    comVao.forcas.P + comVao.massa.assento * G + tv.massaTotal * G),
  'soma ' + (tv
    ? tv.porViga.reduce((s, v) => s + v.carga, 0).toFixed(2)
    : '-'));

verificar('viga critica e a do lado carregado',
  !!tv && tv.vigaCritica === 'direita',
  'obtido ' + (tv ? tv.vigaCritica : '-'));
verificar('viga do lado oposto recebe menos',
  !!tv && tv.porViga.find(v => v.nome === 'esquerda').carga <
    tv.porViga.find(v => v.nome === 'direita').carga);
verificar('vigas frontais nao dependem de eX',
  !!tv && quase(tv.porViga.find(v => v.nome === 'frontal').carga,
    tv.porViga.find(v => v.nome === 'traseira').carga));
verificar('tensao da travessa = M/W',
  !!tv && quase(tv.tensao, tv.M / tv.W));
verificar('cisalhamento macico = 1,5*V/A',
  !!tv && quase(tv.cisalhamento, (1.5 * tv.V) / tv.A));
verificar('flecha da travessa = 5qLt^4/(384 E I)',
  !!tv && quase(tv.flecha,
    (5 * tv.q * Math.pow(tv.vao, 4)) /
    (384 * mat('madeira').E * tv.I)));
verificar('travessas aprovam com folga',
  !!tv && tv.utilizacaoTensao < 0.2 && tv.utilizacaoFlecha < 0.2);

grupo('Travessas — caso centrado');

reiniciar();
const centradaTv = calcular(ENTRADA);
const tvC = centradaTv.ok ? centradaTv.travessas : null;

verificar('centrada: as quatro vigas recebem o mesmo',
  !!tvC && tvC.porViga.every(v => quase(v.carga, tvC.Nbase)),
  'Nbase ' + (tvC ? tvC.Nbase.toFixed(2) : '-'));
verificar('centrada: nenhuma viga perde contato',
  !!tvC && tvC.semContato === false);
verificar('centrada: Nbase = carga do assento/4 + peso proprio',
  !!tvC && quase(tvC.Nbase,
    (centradaTv.forcas.P + centradaTv.massa.assento * G) / 4 +
    tvC.pesoProprio));

/* ---------- Outros materiais, 4 pernas ---------- */
grupo('Outros materiais — 4 pernas');

function cadeiaQuatro(nome, entrada, areaEsperada, tPerna){
  reiniciar();
  excentMm(50);

  const r = calcular(entrada);
  const P = entrada.massaKg * G;
  const dN = P * 50 / (2 * (Lq - tPerna));
  const Nmed = (P + (r.ok ? r.massa.total : 0) * G) / 4;

  verificar(nome + ' · area', r.ok && quase(r.secao.A, areaEsperada),
    'obtido ' + (r.ok ? r.secao.A : '-'));
  verificar(nome + ' · dNx', r.ok && quase(r.forcas.dNx, dN));
  verificar(nome + ' · Nmedio com peso proprio',
    r.ok && quase(r.forcas.Nmedio, Nmed));
  verificar(nome + ' · Nmax = Nmedio + dN',
    r.ok && quase(r.forcas.Nmax, Nmed + dN));
  verificar(nome + ' · flexao nula', r.ok && quase(r.tensoes.sigmaFlexao, 0));
  verificar(nome + ' · tensao axial = Nmax/A',
    r.ok && quase(r.tensoes.sigmaAxial, (Nmed + dN) / areaEsperada));
  verificar(nome + ' · utilizacao',
    r.ok && quase(r.tensoes.utilizacao,
      (Nmed + dN) / areaEsperada / adm(entrada.materialId)));
  verificar(nome + ' · carga critica',
    r.ok && quase(r.flambagem.Pcr,
      (Math.PI ** 2 * mat(entrada.materialId).E * r.secao.I) / (450 ** 2)));
  verificar(nome + ' · aprovado', r.ok && r.veredito.aprovado === true);
  return r;
}

cadeiaQuatro('aco 20mm 120kg',
  { materialId: 'aco', espessuraMm: 20, alturaMm: 450, massaKg: 120 },
  400, 20);

cadeiaQuatro('aluminio 30mm 150kg',
  { materialId: 'aluminio', espessuraMm: 30, alturaMm: 450, massaKg: 150 },
  900, 30);

reiniciar();
excentMm(50);
const Ared = Math.PI * 30 * 30 / 4;
const alumRed = calcular({
  materialId: 'aluminio', espessuraMm: 30, alturaMm: 450,
  massaKg: 150, forma: 'redonda'
});
verificar('aluminio redondo · area = pi*d^2/4',
  alumRed.ok && quase(alumRed.secao.A, Ared),
  'obtido ' + (alumRed.ok ? alumRed.secao.A : '-'));
verificar('aluminio redondo · raio de giracao = d/4',
  alumRed.ok && quase(alumRed.secao.r, 30 / 4));
verificar('aluminio redondo · esbeltez',
  alumRed.ok && quase(alumRed.flambagem.lambda, 450 / (30 / 4)));

/* ---------- Pedestal central ---------- */
grupo('Pedestal central — momento biaxial');

reiniciar();
excentMm(50);
const ped = calcular({ ...ENTRADA, numPernas: 1 });
const pedRed = calcular({ ...ENTRADA, numPernas: 1, forma: 'redonda' });

const Wq40 = Math.pow(40, 3) / 6;

verificar('pedestal usa K = 2 (balanco)', ped.ok && ped.flambagem.K === 2);
verificar('4 pernas usa K = 1 (rotula-rotula)',
  quatro.ok && quatro.flambagem.K === 1);
verificar('momento no pedestal = P*|eX| (so X)',
  ped.ok && quase(ped.forcas.Mperna, PA * 50));
verificar('tensao axial do pedestal = (P+Wc)/A',
  ped.ok && quase(ped.tensoes.sigmaAxial,
    (PA + ped.massa.total * G) / 1600));
verificar('tensao de flexao do pedestal = M/W',
  ped.ok && quase(ped.tensoes.sigmaFlexao, (PA * 50) / Wq40));
verificar('carga critica do pedestal e 1/4 da de 4 pernas',
  ped.ok && quase(ped.flambagem.Pcr, quatro.flambagem.Pcr / 4));
verificar('4 pernas nao tem verificacao de tombamento',
  quatro.ok && quatro.estabilidade === null);
verificar('braco do cone e o raio cheio',
  pedRed.ok && quase(pedRed.estabilidade.braco, 200));
verificar('braco da piramide e o semiapotema',
  ped.ok && quase(ped.estabilidade.braco,
    200 * CADEIRA.fracaoLadoPiramide),
  'obtido ' + (ped.ok ? ped.estabilidade.braco : '-'));
verificar('piramide tomba mais que o cone',
  ped.ok && pedRed.ok &&
  ped.estabilidade.utilizacao > pedRed.estabilidade.utilizacao);
verificar('pedestal nao tem verificacao do vao',
  ped.ok && ped.assentoVao === null);

grupo('Pedestal — combinacao das duas componentes de momento');

reiniciar();
definirExcentricidade(50 / 220, 50 / 220);

const pedBi = calcular({ ...ENTRADA, numPernas: 1 });
const pedBiRed = calcular({ ...ENTRADA, numPernas: 1, forma: 'redonda' });

const MxRef = PA * 50;
const MyRef = PA * 50;

verificar('secao quadrada soma os modulos dos dois momentos',
  pedBi.ok && quase(pedBi.forcas.Mperna, MxRef + MyRef),
  'obtido ' + (pedBi.ok ? pedBi.forcas.Mperna : '-'));
verificar('secao redonda usa a resultante',
  pedBiRed.ok && quase(pedBiRed.forcas.Mperna, Math.hypot(MxRef, MyRef)),
  'obtido ' + (pedBiRed.ok ? pedBiRed.forcas.Mperna : '-'));
verificar('redonda e menos solicitada que quadrada',
  pedBi.ok && pedBiRed.ok &&
  pedBiRed.forcas.Mperna < pedBi.forcas.Mperna);
verificar('tombamento usa a excentricidade resultante',
  pedBi.ok && quase(pedBi.estabilidade.eRes, Math.hypot(50, 50)));
verificar('tombamento expoe eX e eY',
  pedBi.ok && quase(pedBi.estabilidade.eX, 50) &&
  quase(pedBi.estabilidade.eY, 50));

/* ---------- Assento em balanco do pedestal ---------- */
grupo('Assento em balanco do pedestal');

reiniciar();
excentMm(50);
const aPedRef = 440 / 2 - 40 / 2;
const MoRef = PA * aPedRef;
const WoRef = (440 * 20 * 20) / 6;
const IoRef = (440 * Math.pow(20, 3)) / 12;

const pedBal = calcular({ ...ENTRADA, numPernas: 1 });

verificar('assento: largura e espessura proprias',
  pedBal.ok && quase(pedBal.assento.b, 440) && quase(pedBal.assento.h, 20));
verificar('assento nao deriva da perna',
  pedBal.ok && quase(pedBal.assento.h, 20) && quase(pedBal.assento.b, 440));
verificar('assento do pedestal: balanco de 200 mm',
  pedBal.ok && quase(pedBal.assento.aNominal, aPedRef),
  'obtido ' + (pedBal.ok ? pedBal.assento.aNominal : '-'));
verificar('assento do pedestal: momento P*a',
  pedBal.ok && quase(pedBal.assento.M, MoRef));
verificar('assento do pedestal: modulo resistente',
  pedBal.ok && quase(pedBal.assento.W, WoRef));
verificar('assento do pedestal: tensao M/W',
  pedBal.ok && quase(pedBal.assento.sigma, MoRef / WoRef));
verificar('assento do pedestal: flecha',
  pedBal.ok && quase(pedBal.assento.flecha,
    (PA * Math.pow(aPedRef, 3)) / (3 * mat('madeira').E * IoRef)));
verificar('assento do pedestal: flecha limite = a/150',
  pedBal.ok && quase(pedBal.assento.flechaLimite, aPedRef / 150));
verificar('assento do pedestal aprova em tensao e flecha',
  pedBal.ok && pedBal.assento.utilizacao <= 1 &&
  pedBal.assento.utilizacaoFlecha <= 1);

/*
 * A razao entre as tensoes NAO e uma proporcao arbitraria: como a placa e a
 * mesma, o modulo resistente Wa se cancela e sobra a razao entre os bracos.
 *
 *   pedestal  a = aL/2 - t/2 = 200 mm   (sem acrescimo de excentricidade)
 *   4 pernas  a = folga + max(|eX|,|eY|) = 20 + 50 = 70 mm
 *
 * Logo sigma_ped / sigma_quatro = 200/70. A versao anterior deste teste
 * usava "5x", numero de estimativa que nao corresponde ao calculo.
 */
verificar('assento de 4 pernas e muito menos solicitado',
  pedBal.ok && quatro.ok &&
  quase(pedBal.assento.sigma / quatro.assento.sigma, 200 / 70),
  'razao ' + (pedBal.ok && quatro.ok
    ? (pedBal.assento.sigma / quatro.assento.sigma).toFixed(3)
    : '-'));

/* ---------- Assento fino: controlado por definirAssento ---------- */
grupo('Assento fino — reprovacao');

reiniciar();
definirAssento(440, 440, 5);
excentMm(50);

const pedFino = calcular({ ...ENTRADA, numPernas: 1 });
verificar('assento fino de pedestal reprova por tensao',
  pedFino.ok && pedFino.assento.utilizacao > 1,
  'util ' + (pedFino.ok ? pedFino.assento.utilizacao : '-'));
verificar('assento fino de pedestal reprova por flecha',
  pedFino.ok && pedFino.assento.utilizacaoFlecha > 1);

/*
 * Os motivos do solver comecam com maiuscula ('Assento em balanco: ...').
 * indexOf e sensivel a caixa, entao a comparacao desce para minusculas —
 * sem isso o teste nunca casa e acusa falha mesmo com o motivo presente.
 */
verificar('assento fino aparece nos motivos',
  pedFino.ok &&
  pedFino.veredito.motivos.some(
    t => t.toLowerCase().indexOf('assento') >= 0));

const quatroFino = calcular(ENTRADA);
verificar('assento fino reprova no vao por flecha',
  quatroFino.ok && quatroFino.assentoVao.utilizacaoFlecha > 1,
  'util ' + (quatroFino.ok
    ? quatroFino.assentoVao.utilizacaoFlecha : '-'));
verificar('assento fino aparece nos motivos do vao',
  quatroFino.ok &&
  quatroFino.veredito.motivos.some(
    t => t.toLowerCase().indexOf('entre apoios') >= 0));

reiniciar();
const pedGrosso = calcular({
  materialId: 'aco', espessuraMm: 60, alturaMm: 450,
  massaKg: 100, numPernas: 1
});
verificar('assento robusto aprova',
  pedGrosso.ok && pedGrosso.assento.utilizacao <= 1 &&
  pedGrosso.assento.utilizacaoFlecha <= 1);

const aposRestauro = calcular(ENTRADA);
verificar('definirAssento restaurado para 440x440x20',
  aposRestauro.ok && quase(aposRestauro.assento.b, 440) &&
  quase(aposRestauro.assento.h, 20));
verificar('definirExcentricidade restaurado para zero',
  aposRestauro.ok && quase(aposRestauro.entrada.fracX, 0) &&
  quase(aposRestauro.entrada.fracY, 0));

/* ---------- Desenho tecnico ---------- */
grupo('Desenho tecnico');

reiniciar();
excentMm(50);
const paraDesenho = calcular(ENTRADA);

const barrasQuatro = construirBarras(
  paraDesenho.entrada.t, paraDesenho.entrada.H,
  paraDesenho.entrada.material, paraDesenho.entrada.forma,
  paraDesenho.entrada.numPernas, paraDesenho.entrada.vazada,
  paraDesenho.entrada.parede, paraDesenho.entrada.comEncosto
);
const prancha = desenhoTecnico(barrasQuatro);

verificar('desenho tecnico gera svg', prancha.indexOf('<svg') === 0);
verificar('prancha tem as quatro vistas',
  prancha.indexOf('VISTA FRONTAL') > 0 &&
  prancha.indexOf('VISTA LATERAL') > 0 &&
  prancha.indexOf('VISTA SUPERIOR') > 0 &&
  prancha.indexOf('VISTA INFERIOR') > 0);
verificar('prancha cota a altura total em cm',
  prancha.indexOf('>79<') > 0, 'altura 790 mm deveria virar 79 cm');
verificar('prancha cota a largura em cm',
  prancha.indexOf('>44<') > 0, 'largura 440 mm deveria virar 44 cm');
verificar('prancha cota a espessura da perna',
  />4<\/text>/.test(prancha), 'esperado cota de 4 cm');
verificar('prancha tem contorno preto sobre branco',
  prancha.indexOf('stroke="#000"') > 0 &&
  prancha.indexOf('fill="#fff"') > 0);
verificar('nenhuma cota ficou fora do viewBox',
  prancha.indexOf('x1="-') < 0 && prancha.indexOf('y1="-') < 0);

const banco = calcular({ ...ENTRADA, comEncosto: false });
const pranchaBanco = desenhoTecnico(construirBarras(
  banco.entrada.t, banco.entrada.H, banco.entrada.material,
  banco.entrada.forma, banco.entrada.numPernas,
  banco.entrada.vazada, banco.entrada.parede,
  banco.entrada.comEncosto
));
verificar('banco tem prancha diferente da cadeira',
  banco.ok && pranchaBanco.length > 0 &&
  pranchaBanco.length !== prancha.length);

const barrasPed = construirBarras(
  pedBal.entrada.t, pedBal.entrada.H, pedBal.entrada.material,
  pedBal.entrada.forma, pedBal.entrada.numPernas,
  pedBal.entrada.vazada, pedBal.entrada.parede,
  pedBal.entrada.comEncosto
);
const pranchaPed = desenhoTecnico(barrasPed);
const basePeCm =
  (2 * CADEIRA.coneRaioBase * CADEIRA.fracaoLadoPiramide / 10)
    .toLocaleString('pt-BR', { maximumFractionDigits: 1 });

verificar('prancha do pedestal cota a base do pe',
  pranchaPed.indexOf('>' + basePeCm + '<') > 0,
  'esperado ' + basePeCm + ' cm');
verificar('pedestal recebe mais cotas que a cadeira de 4 pernas',
  pranchaPed.split('<text').length > prancha.split('<text').length,
  'pedestal ' + pranchaPed.split('<text').length +
  ' vs ' + prancha.split('<text').length);
verificar('prancha vazia nao quebra',
  desenhoTecnico([]) === '' && desenhoTecnico(null) === '');

/* ---------- Vetor de forca sobre o assento e direcoes ---------- */
grupo('Vetor de forca sobre o assento e direcoes');

const svgSemVetor = svgCadeira(barrasQuatro, paraDesenho.entrada.material);
verificar('svg padrao sem vetorForca ativo nao desenha flecha',
  svgSemVetor.indexOf('class="vetor-forca"') < 0);

const svgComVetorEsq = svgCadeira(barrasQuatro, paraDesenho.entrada.material, {
  vetorForca: { ativo: true, eX: -55, eY: -99, P: paraDesenho.forcas.P }
});
const svgComVetorDir = svgCadeira(barrasQuatro, paraDesenho.entrada.material, {
  vetorForca: { ativo: true, eX: 55, eY: 99, P: paraDesenho.forcas.P }
});
verificar('vetorForca ativo desenha flecha roxa semitransparente',
  svgComVetorEsq.indexOf('class="vetor-forca"') > 0 &&
  svgComVetorEsq.indexOf('fill="#9333ea"') > 0 &&
  svgComVetorEsq.indexOf('fill-opacity="0.56"') > 0);
verificar('mudar (eX, eY) desloca a posicao da flecha sobre o banco',
  svgComVetorEsq !== svgComVetorDir);

definirAssento(440, 440, 20);
definirExcentricidade(-0.25, -0.45);
const resDir = calcular(ENTRADA);
const htmlMem = gerarMemorial(resDir);
verificar('memorial exibe direcoes percentuais e deslocamentos em cm',
  htmlMem.indexOf('25% para a esquerda') > 0 &&
  htmlMem.indexOf('45% para o fundo') > 0 &&
  htmlMem.indexOf('5,5 cm para a esquerda') > 0 &&
  htmlMem.indexOf('9,9 cm para o fundo') > 0 &&
  htmlMem.indexOf('class="vetor-forca"') > 0);

/* ---------- Contorno ---------- */
grupo('Validacao de entradas e contorno');

reiniciar();
const ruim = calcular({
  materialId: 'madeira', espessuraMm: 10, alturaMm: 900, massaKg: 200
});
verificar('caso reprovado tem motivo', ruim.ok && !ruim.veredito.aprovado);

const inv = calcular({
  materialId: 'madeira', espessuraMm: 0, alturaMm: 450, massaKg: 90
});
verificar('espessura zero retorna erro', inv.ok === false);

const semMat = calcular({
  materialId: 'titanio', espessuraMm: 30, alturaMm: 450, massaKg: 90
});
verificar('material desconhecido retorna erro', semMat.ok === false);

const assentoCurto = calcular({
  materialId: 'madeira', espessuraMm: 40, alturaMm: 450, massaKg: 90
});
verificar('assento cobrindo o quadro aprova', assentoCurto.ok === true);

/* ---------- Resumo ---------- */
console.log('\n' + '='.repeat(56));

if (falhou === 0) {
  console.log('Todos os ' + passou + ' testes passaram.');
  process.exit(0);
}

console.log(passou + ' passaram, ' + falhou + ' falharam.\n');
falhas.forEach(f => console.log('  - ' + f));
process.exit(1);