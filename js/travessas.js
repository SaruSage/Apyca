/**
 * Travessas de apoio do assento.
 *
 * Modelo: viga biapoiada com carga uniformemente distribuida.
 *   M = q*Lt^2/8          delta = 5*q*Lt^4/(384*E*I)
 *
 * SECAO
 * Macica ou tubular retangular, com parede ep. Para a secao b x h:
 *   macica : A = b*h                    I = b*h^3/12
 *   vazada : A = b*h - bi*hi            I = (b*h^3 - bi*hi^3)/12
 *            com bi = b - 2ep e hi = h - 2ep
 *
 * ORIENTACAO DOS EIXOS — mesma convencao do chairModel.js
 *
 *   +Y   FRENTE da cadeira (o lado para onde a pessoa olha)
 *   -Y   FUNDO, junto ao encosto, onde y = 0
 *
 * O encosto e construido em y = 0. Logo a viga em y = 0 e a TRASEIRA, do
 * lado do encosto, e a viga em y = L e a FRONTAL. A versao anterior deste
 * arquivo tinha os dois nomes trocados: chamava de "frontal" a viga do
 * fundo. O calculo sempre esteve certo — so o rotulo enganava quem lia o
 * painel ou o memorial.
 *
 * DISTRIBUICAO DA CARGA — FLEXAO BIAXIAL
 * Cada viga vence o vao entre duas pernas, e recebe do assento a carga da
 * sua borda. Com a carga centrada, as quatro recebem o mesmo. Deslocada, a
 * placa carrega mais a borda para onde a pessoa se move, pelo mesmo
 * criterio biaxial que o solver aplica as pernas:
 *
 *   viga traseira (borda y = 0, junto ao encosto)   Nbase - dNy
 *   viga frontal  (borda y = L, lado da frente)     Nbase + dNy
 *   viga esquerda (borda x = 0)                     Nbase - dNx
 *   viga direita  (borda x = L)                     Nbase + dNx
 *
 * com dNx = P*|eX|/(2*(L-t)) e dNy = P*|eY|/(2*(L-t)), o mesmo braco do
 * casal entre as pernas. A soma das quatro cargas fecha exatamente com o
 * peso que o quadro sustenta — assento mais as proprias vigas —, porque
 * (-dNy) + (+dNy) + (-dNx) + (+dNx) = 0.
 *
 * Cada viga e verificada com a SUA carga, uniformemente distribuida no seu
 * vao. A distribuicao uniforme e o envelope entre as formas lineares
 * (uniforme, trapezoidal e triangular): para o mesmo total, ela da o maior
 * momento — M = W*L/8 contra W*L/(9*raiz(3)) da triangular — e tambem a
 * maior flecha. So uma carga concentrada no meio do vao seria pior, e nao e
 * o caso: a placa pressiona a borda inteira.
 *
 * A carga de cada viga sofre piso em zero. Carga negativa significaria que
 * aquela borda perde contato com a viga, o que acontece no regime em que as
 * pernas do lado oposto ja levantam e o solver reporta.
 *
 * HIPOTESES
 *   - Apoio simples nas FACES INTERNAS das pernas (ligacao sem rigidez de
 *     momento). A viga encosta na perna e nao penetra nela, entao o apoio
 *     esta em x = t e x = L - t. O quadro real e continuo nos cantos, o que
 *     reduz a flecha; isso fica como folga nao contabilizada.
 *   - O vao de CALCULO e o vao livre entre as faces internas das pernas
 *     (L - 2t), que e tambem o COMPRIMENTO de cada viga: calculo, volume e
 *     massa usam a mesma medida. Medir o vao entre eixos (L - t) daria um
 *     vao maior que a propria peca.
 *   - A massa do assento entra na carga: sao as travessas que o sustentam.
 *   - O peso proprio das vigas tambem entra, porque e o proprio quadro que o
 *     carrega. As pernas e o encosto NAO entram: eles se apoiam direto nas
 *     pernas, sem passar pelo quadro.
 *
 * GEOMETRIA
 * geometriaTravessas() e a fonte unica das dimensoes do quadro. chairModel.js
 * desenha a partir dela e verificarTravessas() calcula a massa a partir dela,
 * de modo que desenho e numero nunca saem de sincronia.
 *
 * Unidades: mm, N, MPa, kg.
 */

import { G, TRAVESSAS, ASSENTO } from './constantes.js';

/**
 * Define a secao pedida pelo usuario. Chamado pelo app antes de calcular,
 * de modo que o solver, a geometria e o memorial usem o mesmo valor.
 */
export function definirTravessaSecao(larguraMm, alturaMm, vazada, paredeMm){
  if (Number.isFinite(larguraMm) && larguraMm > 0) {
    TRAVESSAS.largura = larguraMm;
  }
  if (Number.isFinite(alturaMm) && alturaMm > 0) {
    TRAVESSAS.altura = alturaMm;
  }
  if (typeof vazada === 'boolean') {
    TRAVESSAS.vazada = vazada;
  }
  if (Number.isFinite(paredeMm) && paredeMm > 0) {
    TRAVESSAS.parede = paredeMm;
  }
  return {
    largura: TRAVESSAS.largura,
    altura: TRAVESSAS.altura,
    vazada: TRAVESSAS.vazada,
    parede: TRAVESSAS.parede
  };
}

/**
 * Secao efetiva da travessa, em mm, ja com os limites aplicados.
 *
 * A largura nao passa da dimensao externa da perna: a viga precisa encostar
 * na perna, e uma viga mais larga que ela nao teria apoio. A altura nao passa
 * de metade da altura da perna, para o quadro nunca competir com o assento.
 * A parede, na secao vazada, nao passa de metade da menor dimensao da secao.
 */
export function secaoTravessa(t, H){
  const b = Math.min(Math.max(TRAVESSAS.largura, 1), t);
  const hMax = Math.max(1, H * 0.5);
  const h = Math.min(Math.max(TRAVESSAS.altura, 1), hMax);

  const vazada = TRAVESSAS.vazada === true;

  let parede = 0;
  if (vazada) {
    const limite = Math.min(b, h) / 2 - 0.1;
    parede = Math.min(Math.max(TRAVESSAS.parede, 0.1),
                      Math.max(0.1, limite));
  }

  const bi = vazada ? Math.max(0, b - 2 * parede) : 0;
  const hi = vazada ? Math.max(0, h - 2 * parede) : 0;

  const A = b * h - bi * hi;
  const I = (b * Math.pow(h, 3) - bi * Math.pow(hi, 3)) / 12;

  return { b, h, vazada, parede, bi, hi, A, I };
}

/**
 * Quadro das quatro travessas, encostado nas pernas.
 *
 * POSICIONAMENTO — a face externa de cada viga fica no MESMO plano da face
 * externa da perna:
 *
 *   traseira ocupa y de 0 a b        (face externa em y = 0, junto ao encosto)
 *   frontal  ocupa y de L-b a L      (face externa em y = L, lado da frente)
 *   esquerda ocupa x de 0 a b        (face externa em x = 0)
 *   direita  ocupa x de L-b a L      (face externa em x = L)
 *
 * Assim a viga fica coplanar com a superficie da perna e aparece como faixa
 * continua de uma perna a outra.
 *
 * As vigas correm entre as FACES INTERNAS das pernas e nao penetram nelas.
 * Cada viga encosta em duas pernas, de modo que a ligacao le como
 * perna | travessa | perna, sem vao e sem sobreposicao de volume.
 *
 * O topo da viga coincide com o topo da perna (z = H), que e onde o assento
 * apoia: o quadro fica plano contra a face inferior do assento.
 */
export function geometriaTravessas(L, t, H){
  const sec = secaoTravessa(t, H);

  const z = H - sec.h;
  const vao = L - 2 * t;          // comprimento de cada viga
  const ok = sec.b > 0 && sec.h > 0 && vao > 0;

  const b = sec.b;
  const h = sec.h;

  return {
    b, h, z, vao, ok,
    vazada: sec.vazada,
    parede: sec.parede,
    bi: sec.bi,
    hi: sec.hi,
    A: sec.A,
    I: sec.I,
    pecas: ok ? [
      /* Traseira: face externa em y = 0, junto ao encosto. */
      { x: t,      y: 0,       dx: vao, dy: b, dz: h },
      /* Frontal: face externa em y = L, lado da frente. */
      { x: t,      y: L - b,   dx: vao, dy: b, dz: h },
      /* Lateral esquerda: face externa em x = 0. */
      { x: 0,      y: t,       dx: b,   dy: vao, dz: h },
      /* Lateral direita: face externa em x = L. */
      { x: L - b,  y: t,       dx: b,   dy: vao, dz: h }
    ] : []
  };
}

export function verificarTravessas({ P, massaAssento, L, t, H, material }){
  const geo = geometriaTravessas(L, t, H);

  const b = geo.b;
  const h = geo.h;
  const A = geo.A;
  const I = geo.I;

  const n = TRAVESSAS.nTravessas;

  /* O vao de CALCULO e o vao livre entre as faces internas das pernas, que e
   * exatamente o comprimento da peca. A travessa nao penetra na perna: ela
   * encosta na face, entao o apoio esta em x = t e x = L - t.
   *
   * Antes usava-se L - t (eixo da perna), o que dava um vao de 360 mm para
   * uma peca de 320 mm — vao maior que a viga, inconsistente no memorial. */
  const vao = Math.max(L - 2 * t, 1);

  const E = material.E;
  const sigmaAdm = material.sigmaLimite / material.CS;

  /*
   * Limite de flecha, calculado UMA vez e ANTES da funcao viga().
   *
   * Ele era declarado depois da funcao e usado dentro dela. Como const nao
   * sobe, a primeira chamada caia na zona morta temporal e estourava com
   * "Cannot access 'flechaLimite' before initialization".
   */
  const flechaLimite = vao / TRAVESSAS.divisorFlecha;

  /* Braco do casal entre as pernas: o mesmo que o solver usa. */
  const braco = Math.max(L - t, 1);

  /*
   * Volume do quadro a partir da AREA da secao — macica ou vazada. As quatro
   * vigas tem o mesmo comprimento (vao livre), entao nao ha sobreposicao de
   * volume a descontar.
   */
  const volume = A * geo.vao * n;

  const massaTotal = (volume / 1e9) * material.rho;
  const massa = massaTotal / n;
  const pesoProprio = massa * G;

  const cargaAssento = P + massaAssento * G;

  /*
   * Carga de referencia: a que cada viga receberia com a carga centrada,
   * ja incluindo a parcela do proprio peso.
   */
  const Nbase = cargaAssento / n + pesoProprio;

  /* ---------- Centro de carga ----------
   * As mesmas fracoes e o mesmo braco que o solver usa nas pernas: as
   * travessas e as pernas fazem parte do mesmo quadro resistente, e o
   * desequilibrio de um lado acompanha o do outro. */
  const fracX = Number.isFinite(ASSENTO.excentricidadeX)
    ? ASSENTO.excentricidadeX : 0;
  const fracY = Number.isFinite(ASSENTO.excentricidadeY)
    ? ASSENTO.excentricidadeY : 0;

  const larg = Number.isFinite(ASSENTO.largura) ? ASSENTO.largura : 0;
  const prof = Number.isFinite(ASSENTO.profundidade) ? ASSENTO.profundidade : 0;

  const eX = fracX * larg / 2;
  const eY = fracY * prof / 2;

  const dNx = (P * Math.abs(eX)) / (2 * braco);
  const dNy = (P * Math.abs(eY)) / (2 * braco);

  /*
   * A placa nao traciona: carga negativa significa que aquela borda perde
   * contato com a viga, e ela nao recebe nada. Todas as grandezas de flexao
   * sao lineares na carga, entao aplicar o piso aqui propaga coerencia para
   * q, M, V, tensao, cisalhamento e flecha de uma vez.
   */
  function viga(nome, depende, carga){
    const semContato = carga < 0;
    const cargaEf = Math.max(0, carga);
    const q = cargaEf / vao;
    const M = (q * vao * vao) / 8;
    const V = (q * vao) / 2;

    const c = h / 2;
    const W = I / c;

    const tensao = M / W;

    /*
     * Solicitacao tangencial: na secao retangular macica o pico vale
     * 1,5*V/A. Na vazada a alma e fina e o pico sobe, chegando perto de
     * 2,0*V/A — valor adotado aqui.
     */
    const tau = ((geo.vazada ? 2.0 : 1.5) * V) / A;

    const flecha = (5 * q * Math.pow(vao, 4)) / (384 * E * I);

    const utilizacaoTensao = tensao / sigmaAdm;
    const utilizacaoFlecha = flecha / flechaLimite;

    return {
      nome, depende, carga, cargaEf, semContato,
      q, M, V, c, W,
      tensao, cisalhamento: tau,
      flecha,
      utilizacaoTensao, utilizacaoFlecha,
      utilizacao: Math.max(utilizacaoTensao, utilizacaoFlecha)
    };
  }

  /*
   * As vigas traseira e frontal respondem ao deslocamento em Y; as laterais,
   * ao deslocamento em X. Os sinais sao os mesmos do casal entre as pernas:
   * a borda para onde a carga se move recebe mais.
   *
   * Com +Y = frente, a viga em y = 0 e a traseira e recebe MENOS quando a
   * carga se desloca para a frente. Por isso Nbase - dNy nela.
   */
  const deltaNx = (P * eX) / (2 * braco);
  const deltaNy = (P * eY) / (2 * braco);

  const porViga = [
    viga('traseira', 'eY', Nbase - deltaNy),
    viga('frontal',  'eY', Nbase + deltaNy),
    viga('esquerda', 'eX', Nbase - deltaNx),
    viga('direita',  'eX', Nbase + deltaNx)
  ];

  const critica = porViga.reduce(
    (a, v) => (v.utilizacao > a.utilizacao ? v : a)
  );

  return {
    n, b, h, vao,
    comprimento: geo.vao,
    vazada: geo.vazada,
    parede: geo.parede,
    A, I,

    /* Geometria e massa do quadro */
    volume, massa,
    massaTotal,
    pesoProprio,
    cargaAssento,
    cargaQuadro: Nbase * n,

    /* Distribuicao biaxial */
    fracX, fracY, eX, eY,
    dNx, dNy,
    Nbase,
    porViga,
    vigaCritica: critica.nome,
    semContato: porViga.some(v => v.semContato),

    /* Verificacao — os campos abaixo sao da VIGA CRITICA, que governa */
    N: critica.cargaEf,
    Ncritica: critica.cargaEf,
    q: critica.q,
    M: critica.M,
    V: critica.V,
    c: critica.c,
    W: critica.W,
    tensao: critica.tensao,
    cisalhamento: critica.cisalhamento,
    sigmaAdm,
    flecha: critica.flecha,
    flechaLimite,
    divisorFlecha: TRAVESSAS.divisorFlecha,
    utilizacaoTensao: critica.utilizacaoTensao,
    utilizacaoFlecha: critica.utilizacaoFlecha,
    utilizacao: critica.utilizacao
  };
}