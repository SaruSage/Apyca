/**
 * Converte as entradas na lista de pecas 3D da cadeira.
 *
 * Cada peca carrega um GRUPO. O grupo e o que permite animar uma peca sem
 * arrastar as outras e somar a massa por parte.
 *
 * MASSA
 * volumePeca() le as dimensoes de cada peca e devolve o volume em mm3.
 * Peças de secao vazada carregam as marcas vazada/parede e tem o furo
 * descontado — vale para a perna tubular e para a travessa tubular.
 *
 * CAMADAS E ORDEM DE PINTURA
 * A camada decide quem e desenhado por ultimo, e em iso.js ela e consultada
 * ANTES da profundidade. Por isso ela nao pode ser usada como agrupamento
 * tematico: e uma decisao de desenho.
 *
 *   0  pernas e travessas   mesma camada, ordem por profundidade
 *   2  assento              fica acima de tudo
 *   3  encosto              fica acima do assento
 */

import { CADEIRA, ASSENTO, TRAVESSAS } from './constantes.js';
import { geometriaTravessas } from './travessas.js';

export function caixa(x, y, z, dx, dy, dz, camada, cor, grupo){
  return { tipo: 'caixa', x, y, z, dx, dy, dz, camada, cor, grupo };
}

export function cilindro(cx, cy, r, z0, h, camada, cor, grupo){
  return { tipo: 'cilindro', cx, cy, r, z0, h, camada, cor, grupo };
}

export function cone(cx, cy, rBase, rTopo, z0, h, camada, cor, grupo){
  return { tipo: 'cone', cx, cy, rBase, rTopo, z0, h, camada, cor, grupo };
}

export function piramide(cx, cy, ladoBase, ladoTopo, z0, h, camada, cor, grupo){
  return { tipo: 'piramide', cx, cy, ladoBase, ladoTopo, z0, h, camada, cor, grupo };
}

export function tubo(cx, cy, dim, parede, z0, h, redondo, camada, cor, grupo){
  return { tipo: 'tubo', cx, cy, dim, parede, z0, h, redondo, camada, cor, grupo };
}

/* ---------- Configuracao do assento ---------- */

/**
 * Grava as dimensoes do assento antes do calculo. Chamado pelo app, de modo
 * que solver, geometria e memorial leiam o mesmo valor.
 */
export function definirAssento(larguraMm, profundidadeMm, espessuraMm){
  if (Number.isFinite(larguraMm) && larguraMm > 0) {
    ASSENTO.largura = larguraMm;
  }
  if (Number.isFinite(profundidadeMm) && profundidadeMm > 0) {
    ASSENTO.profundidade = profundidadeMm;
  }
  if (Number.isFinite(espessuraMm) && espessuraMm > 0) {
    ASSENTO.espessura = espessuraMm;
  }
  return {
    largura: ASSENTO.largura,
    profundidade: ASSENTO.profundidade,
    espessura: ASSENTO.espessura
  };
}

/* ---------- Volume de uma peca, em mm³ ---------- */

export function volumePeca(p){
  if (p.tipo === 'cilindro') {
    return Math.PI * p.r * p.r * p.h;
  }

  if (p.tipo === 'cone') {
    const { rBase, rTopo, h } = p;
    return (Math.PI * h / 3) * (rBase * rBase + rBase * rTopo + rTopo * rTopo);
  }

  if (p.tipo === 'piramide') {
    const A1 = p.ladoBase * p.ladoBase;
    const A2 = p.ladoTopo * p.ladoTopo;
    return (p.h / 3) * (A1 + A2 + Math.sqrt(A1 * A2));
  }

  if (p.tipo === 'tubo') {
    /* Tubo vazado: subtrai o furo, que e a mesma secao reduzida da parede. */
    if (p.redondo) {
      const re = p.dim / 2;
      const ri = Math.max(0, re - p.parede);
      return Math.PI * p.h * (re * re - ri * ri);
    }
    const di = Math.max(0, p.dim - 2 * p.parede);
    return p.h * (p.dim * p.dim - di * di);
  }

  /*
   * Caixa de secao vazada: a travessa tubular e desenhada como caixa (de
   * fora a aparencia e identica a de um bloco macico), mas a massa precisa
   * descontar o furo. O eixo da barra e a maior dimensao; as outras duas
   * formam a secao transversal.
   */
  if (p.tipo === 'caixa' && p.vazada === true && p.parede > 0) {
    const dims = [p.dx, p.dy, p.dz];
    const maior = Math.max(dims[0], dims[1], dims[2]);
    const eixo = dims.indexOf(maior);

    const s1 = dims[(eixo + 1) % 3];
    const s2 = dims[(eixo + 2) % 3];

    const limite = Math.min(s1, s2) / 2 - 0.01;
    const ep = Math.min(p.parede, Math.max(0.01, limite));

    const i1 = Math.max(0, s1 - 2 * ep);
    const i2 = Math.max(0, s2 - 2 * ep);

    return maior * (s1 * s2 - i1 * i2);
  }

  return p.dx * p.dy * p.dz;
}

/* ---------- Massa por parte ---------- */

const PARTES = {
  pernas: ['perna0', 'perna1', 'perna2', 'perna3', 'coluna'],
  pe: ['pe'],
  assento: ['assento'],
  postes: ['poste0', 'poste1'],
  encosto: ['encosto'],
  travessas: ['travessa0', 'travessa1', 'travessa2', 'travessa3']
};

export function massasPorParte(barras, material){
  const rho = (material && Number.isFinite(material.rho)) ? material.rho : 0;

  const volume = { pernas: 0, pe: 0, assento: 0, postes: 0, encosto: 0,
                   travessas: 0 };
  let volumeTotal = 0;

  for (const p of barras) {
    const v = volumePeca(p);
    volumeTotal += v;

    for (const chave of Object.keys(PARTES)) {
      if (PARTES[chave].indexOf(p.grupo) >= 0) {
        volume[chave] += v;
        break;
      }
    }
  }

  /* mm³ -> m³ -> kg */
  const massa = (mm3) => (mm3 / 1e9) * rho;

  return {
    pernas: massa(volume.pernas),
    pe: massa(volume.pe),
    assento: massa(volume.assento),
    postes: massa(volume.postes),
    encosto: massa(volume.encosto),
    travessas: massa(volume.travessas),
    total: massa(volumeTotal),
    volumeTotal,
    volume
  };
}

/* ---------- Caixa envolvente ---------- */

export function bboxPeca(p){
  if (p.tipo === 'cilindro') {
    return {
      min: [p.cx - p.r, p.cy - p.r, p.z0],
      max: [p.cx + p.r, p.cy + p.r, p.z0 + p.h]
    };
  }
  if (p.tipo === 'cone') {
    return {
      min: [p.cx - p.rBase, p.cy - p.rBase, p.z0],
      max: [p.cx + p.rBase, p.cy + p.rBase, p.z0 + p.h]
    };
  }
  if (p.tipo === 'piramide') {
    const a = p.ladoBase / 2;
    return {
      min: [p.cx - a, p.cy - a, p.z0],
      max: [p.cx + a, p.cy + a, p.z0 + p.h]
    };
  }
  if (p.tipo === 'tubo') {
    const r = p.dim / 2;
    return {
      min: [p.cx - r, p.cy - r, p.z0],
      max: [p.cx + r, p.cy + r, p.z0 + p.h]
    };
  }
  return {
    min: [p.x, p.y, p.z],
    max: [p.x + p.dx, p.y + p.dy, p.z + p.dz]
  };
}

const RENDER_PADRAO = {
  pernas: '',
  assento: '',
  encosto: { tipo: 'painel', cor: '' },
  veios: false
};

function encostoRipas(x0, y0, larg, zBase, alt, prof, cor, n, fracao){
  const unidade = alt / (2 * n - 1);
  const pRipa = fracao * prof;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(caixa(x0, y0, zBase + i * 2 * unidade, larg, pRipa, unidade,
                   3, cor, 'encosto'));
  }
  return out;
}

/**
 * comEncosto = false monta um banco: sem postes e sem painel.
 * A altura total cai para H + espessura do assento, e a massa correspondente
 * some.
 */
export function construirBarras(espessura, altura, material, forma = 'quadrada',
                                numPernas = 4, vazada = false, parede = 0,
                                comEncosto = true){
  const {
    L, fracaoEspessuraEncosto,
    alturaAbertura, alturaEncosto, espessuraMaxima,
    coneRaioBase, coneAltura, fracaoLadoPiramide
  } = CADEIRA;

  const render = (material && material.render) || RENDER_PADRAO;
  const redonda = forma === 'redonda';
  const n = numPernas === 1 ? 1 : 4;
  const t = Math.min(espessura, espessuraMaxima);
  const H = altura;
  const temEncosto = comEncosto !== false;

  /*
   * O assento NAO deriva da perna: usa as dimensoes de ASSENTO, que sao
   * configuradas em separado.
   */
  const aL = ASSENTO.largura;
  const aP = ASSENTO.profundidade;
  const tAssento = ASSENTO.espessura;

  const tEnc = fracaoEspessuraEncosto * t;

  const zTopoAssento = H + tAssento;
  const zTopoEncosto = zTopoAssento + alturaEncosto;
  const zBaseEncosto = zTopoAssento + alturaAbertura;

  const barras = [];

  const xCentro = L / 2 - t / 2;
  const cCentro = L / 2;

  /*
   * A perna tubular recebe `redonda` — a variavel do escopo. `redondo` e o
   * nome do PARAMETRO dentro de tubo(); usa-lo aqui era ReferenceError em
   * toda secao tubular.
   */
  function perna(x, y, z0, h, camada, grupo){
    if (h <= 0) return;
    const cx = x + t / 2;
    const cy = y + t / 2;

    if (vazada) {
      barras.push(tubo(cx, cy, t, parede, z0, h, redonda, camada,
                       render.pernas, grupo));
    } else if (redonda) {
      barras.push(cilindro(cx, cy, t / 2, z0, h, camada, render.pernas, grupo));
    } else {
      barras.push(caixa(x, y, z0, t, t, h, camada, render.pernas, grupo));
    }
  }

  // ---------- Camada 0: apoios ----------
  if (n === 4) {
    perna(0,     L - t, 0, H, 0, 'perna0');
    perna(L - t, L - t, 0, H, 0, 'perna1');
    perna(0,     0,     0, H, 0, 'perna2');
    perna(L - t, 0,     0, H, 0, 'perna3');
  } else {
    const hPe = Math.min(coneAltura, H * 0.4);
    const R = coneRaioBase;
    const corPe = render.assento || render.pernas;

    if (redonda) {
      barras.push(cone(cCentro, cCentro, R, t / 2, 0, hPe, 0, corPe, 'pe'));
    } else {
      const ladoBase = 2 * R * fracaoLadoPiramide;
      barras.push(piramide(cCentro, cCentro, ladoBase, t, 0, hPe, 0,
                           corPe, 'pe'));
    }

    perna(xCentro, xCentro, hPe, H - hPe, 0, 'coluna');
  }

  // ---------- Camada 0: travessas de apoio do assento ----------
  /*
   * O quadro vem pronto de geometriaTravessas(). A peca e desenhada como
   * caixa mesmo quando a secao e tubular: por fora, um tubo retangular e um
   * bloco macico de mesma secao sao indistinguiveis — o furo so apareceria
   * nas faces de topo, enterradas nas pernas. As marcas vazada/parede
   * existem para volumePeca() descontar o furo da massa.
   */
  if (n === 4 && TRAVESSAS.ativa) {
    const geo = geometriaTravessas(L, t, H);

    if (geo.ok) {
      geo.pecas.forEach((p, i) => {
        const peca = caixa(p.x, p.y, geo.z, p.dx, p.dy, p.dz,
                           0, render.pernas, 'travessa' + i);
        peca.vazada = geo.vazada;
        peca.parede = geo.parede;
        barras.push(peca);
      });
    }
  }

  // ---------- Camada 2: assento ----------
  /*
   * Centrado no quadro de pernas: com largura igual a L as bordas coincidem
   * com as faces externas das pernas; maior que L, sobra sobrepasso dos dois
   * lados.
   */
  barras.push(caixa((L - aL) / 2, (L - aP) / 2, H,
                    aL, aP, tAssento, 2,
                    render.assento, 'assento'));

  // ---------- Camada 3: conjunto superior traseiro ----------
  if (temEncosto) {
    const hPoste = zTopoEncosto - zTopoAssento;
    perna(0,     0, zTopoAssento, hPoste, 3, 'poste0');
    perna(L - t, 0, zTopoAssento, hPoste, 3, 'poste1');

    const largPainel = L - 2 * t;
    const altPainel = zTopoEncosto - zBaseEncosto;
    const spec = render.encosto || RENDER_PADRAO.encosto;
    const corEnc = spec.cor || render.pernas;

    if (altPainel > 0 && largPainel > 0) {
      if (spec.tipo === 'ripas') {
        barras.push(...encostoRipas(t, 0, largPainel, zBaseEncosto, altPainel,
                                    tEnc, corEnc, spec.n || 3,
                                    spec.fracao || 0.2));
      } else {
        barras.push(caixa(t, 0, zBaseEncosto, largPainel, tEnc, altPainel, 3,
                          corEnc, 'encosto'));
      }
    }
  }

  return barras;
}

export function dimensoesExternas(barras){
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const b of barras) {
    const bb = bboxPeca(b);
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], bb.min[a]);
      max[a] = Math.max(max[a], bb.max[a]);
    }
  }

  return {
    largura: max[0] - min[0],
    profundidade: max[1] - min[1],
    altura: max[2] - min[2]
  };
}