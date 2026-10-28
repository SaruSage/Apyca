/**
 * Testes de regressao da fisica. Rodar com:  node tests/fisica.test.mjs
 * Cada valor esperado e calculado aqui, a mao, a partir da formula do livro —
 * nunca copiado da saida do solver.
 */
import { calcular } from '../js/solver.js';
import { definirAssento, definirExcentricidade } from '../js/chairModel.js';

let passou = 0, falhou = 0;
const quase = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
function verificar(nome, ok, detalhe = ''){
  if (ok) { passou++; console.log('PASS  ' + nome); }
  else { falhou++; console.log('FAIL  ' + nome + (detalhe ? ' - ' + detalhe : '')); }
}

const G = 9.81;
const base = { materialId: 'madeira', espessuraMm: 40, alturaMm: 450, massaKg: 100 };
const P = 100 * G;

/*
 * As ancoras de excentricidade foram calculadas a mao com e = 50 mm. O padrao
 * agora e o centro do assento (e = 0), entao o cenario precisa ser declarado
 * explicitamente — senao todo dN vira zero e as ancoras perdem o sentido.
 */
definirExcentricidade(50);

const r = calcular(base);

/* ---- Binario da excentricidade: braco entre EIXOS das pernas (L - t) ---- */
const L = 400, t = 40, e = 50;
verificar('dN usa o braco entre eixos (L - t)',
  quase(r.forcas.dN, (P * e) / (2 * (L - t))), 'obtido ' + r.forcas.dN);
verificar('braco do binario exposto no resultado',
  quase(r.forcas.bracoBinario, L - t));
verificar('casal resistente fecha com P*e',
  quase(r.forcas.dN * 2 * r.forcas.bracoBinario, P * e));
const r60 = calcular({ ...base, espessuraMm: 60 });
verificar('perna mais grossa aproxima os eixos e aumenta dN',
  r60.forcas.dN > r.forcas.dN);

/* ---- Carga centrada: caso padrao do assento ---- */
definirExcentricidade(0);
const rc = calcular(base);
verificar('carga centrada: dN nulo', quase(rc.forcas.dN, 0),
  'obtido ' + rc.forcas.dN);
verificar('carga centrada: Nmax = Nmedio',
  quase(rc.forcas.Nmax, rc.forcas.Nmedio));
verificar('carga centrada: Nmin = Nmedio',
  quase(rc.forcas.Nmin, rc.forcas.Nmedio));
verificar('carga centrada: nao levanta', rc.forcas.levantou === false);
verificar('carga centrada: excentricidade exposta como 0',
  quase(rc.entrada.e, 0));
definirExcentricidade(50);

/* ---- Limite de excentricidade: fora da placa reprova ---- */
const rLim = (() => {
  definirExcentricidade(230);
  const x = calcular(base);
  definirExcentricidade(50);
  return x;
})();
verificar('excentricidade maior que meia placa reprova', rLim.ok === false);

/* ---- Assento entre apoios: vao = abertura do quadro ---- */
const asv = r.assentoVao;
const bTrav = r.travessas.b;
const vaoAnel = L - 2 * bTrav;
const q = P / (440 * 440), h = 20, E = 11000;
const Iunit = Math.pow(h, 3) / 12;

verificar('vao do assento = abertura livre do quadro (L - 2b)',
  quase(asv.L, vaoAnel), 'obtido ' + asv.L + ', esperado ' + vaoAnel);
verificar('vao do assento menor que o lado do quadro', asv.L < L);
verificar('flecha do vao = 5qLv^4/(384 E I) com I = h^3/12',
  quase(asv.flecha, (5 * q * Math.pow(vaoAnel, 4)) / (384 * E * Iunit)),
  'obtido ' + asv.flecha);
verificar('momento do vao = q Lv^2/16 (redistribuicao de placa)',
  quase(asv.M, (q * vaoAnel * vaoAnel) / 16));
verificar('com b = t, vao do assento = comprimento da travessa',
  quase(asv.L, r.travessas.comprimento));

/* ---- Assento sem balanco: nada de NaN ---- */
definirAssento(400, 400, 20);
const rz = calcular(base);
verificar('assento com largura = L calcula', rz.ok === true);
if (rz.ok) {
  verificar('balanco nulo nao gera NaN na utilizacao da flecha',
    Number.isFinite(rz.assento.utilizacaoFlecha) && rz.assento.utilizacaoFlecha === 0,
    'obtido ' + rz.assento.utilizacaoFlecha);
  verificar('balanco nulo nao gera NaN na tensao',
    Number.isFinite(rz.assento.utilizacao));
}
definirAssento(440, 440, 20);

/* ---- Travessas: viga biapoiada no vao livre (L - 2t) ---- */
const tv = r.travessas;
const vao = L - 2 * t;
verificar('vao da travessa = L - 2t (faces internas)', quase(tv.vao, vao));
verificar('vao de calculo = comprimento da peca', quase(tv.vao, tv.comprimento));
verificar('momento da travessa = q vao^2 / 8', quase(tv.M, (tv.q * vao * vao) / 8));
verificar('flecha da travessa = 5 q vao^4 / (384 E I)',
  quase(tv.flecha, (5 * tv.q * Math.pow(vao, 4)) / (384 * E * tv.I)));

console.log('\n' + passou + ' passaram, ' + falhou + ' falharam.');
process.exit(falhou === 0 ? 0 : 1);