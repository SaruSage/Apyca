/**
 * Testes de regressao da fisica. Rodar com:  node tests/fisica.test.mjs
 * Cada valor esperado e calculado aqui, a mao, a partir da formula do livro —
 * nunca copiado da saida do solver.
 */
import { calcular } from '../js/solver.js';
import { definirAssento } from '../js/chairModel.js';

let passou = 0, falhou = 0;
const quase = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
function verificar(nome, ok, detalhe = ''){
  if (ok) { passou++; console.log('PASS  ' + nome); }
  else { falhou++; console.log('FAIL  ' + nome + (detalhe ? ' - ' + detalhe : '')); }
}

const G = 9.81;
const base = { materialId: 'madeira', espessuraMm: 40, alturaMm: 450, massaKg: 100 };
const r = calcular(base);
const P = 100 * G;

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

/* ---- Assento entre apoios: faixa biapoiada de largura unitaria ---- */
const asv = r.assentoVao;
const q = P / (440 * 440), h = 20, E = 11000;
const Iunit = Math.pow(h, 3) / 12;
verificar('flecha do vao = 5qL^4/(384 E I) com I = h^3/12',
  quase(asv.flecha, (5 * q * Math.pow(L, 4)) / (384 * E * Iunit)),
  'obtido ' + asv.flecha);
verificar('momento do vao = qL^2/16 (redistribuicao de placa)',
  quase(asv.M, (q * L * L) / 16));

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

