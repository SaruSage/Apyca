/**
 * Nucleo de calculo. Funcao pura: nao toca no DOM.
 *
 * A secao da perna pode ser macica ou vazada, quadrada ou redonda.
 * Quando vazada, a espessura da parede vem em mm e e validada aqui.
 *
 * O assento tem dimensoes PROPRIAS (largura, profundidade, espessura) e uma
 * posicao de centro de carga PROPRIAS, ambas em ASSENTO.
 *
 * CENTRO DE CARGA BIAXIAL
 * A excentricidade e guardada como fracao de meia dimensao em cada eixo,
 * em [-1, +1]. O deslocamento em mm e derivado aqui:
 *
 *   eX = fracX * largura/2        eY = fracY * profundidade/2
 *
 * Com 4 pernas a placa rigida distribui a carga por flexao biaxial:
 *
 *   Ni = Ptotal/4 ± P*eX/(2b) ± P*eY/(2b)      com b = L - t
 *
 * O sinal de cada parcela depende do quadrante da perna. No pedestal o
 * momento resultante tem duas componentes, e a tensao na fibra extrema
 * depende da forma da secao.
 *
 * ORIENTACAO DOS EIXOS
 * O encosto fica em y = 0, logo +Y aponta para a FRENTE da cadeira e -Y para
 * tras. Quem rotular as reacoes por perna precisa respeitar isso: a perna do
 * quadrante (+X, +Y) e a da frente a direita.
 *
 * VERIFICACOES
 *   tensao na perna      sigma = N/A + M*c/I
 *   flambagem global     Euler com K do regime
 *   flambagem local      (t-2ep)/ep contra 1,40*raiz(E/sigmaLim) — so vazada
 *   assento em balanco   Ma = P*a, delta = P*a^3/(3EI)
 *   assento entre apoios q = P/(aL*aP), M = q*Lv^2/16,
 *                        delta = 5q*Lv^4/(32Eh^3) — so com 4 pernas,
 *                        com Lv = L - 2b (abertura do quadro de apoio)
 *   travessas de apoio   viga biapoiada, M = q*Lt^2/8,
 *                        delta = 5q*Lt^4/(384EI) — so com 4 pernas
 *   tombamento           M_tomb/M_estab (so no pedestal)
 */

import { G, HIPOTESES, CADEIRA, ASSENTO, TRAVESSAS } from './constantes.js';
import { getMaterial, tensaoAdmissivel } from './materials.js';
import { propriedadesSecao } from './geometry.js';
import { construirBarras, massasPorParte } from './chairModel.js';
import { verificarTravessas, secaoTravessa, dimensoesEsquadria } from './travessas.js';

/** Menor braco resistente da base, em mm. */
function bracoEstabilidade(R, forma){
  if (forma === 'redonda') return R;
  return R * CADEIRA.fracaoLadoPiramide;
}

export function calcular({ materialId, espessuraMm, alturaMm, massaKg,
                           forma, numPernas, vazada, paredeMm, comEncosto }){
  const erros = [];

  if (!Number.isFinite(espessuraMm) || espessuraMm <= 0) {
    erros.push('A espessura da perna deve ser maior que zero.');
  }
  if (!Number.isFinite(alturaMm) || alturaMm <= 0) {
    erros.push('A altura da perna deve ser maior que zero.');
  }
  if (!Number.isFinite(massaKg) || massaKg <= 0) {
    erros.push('A massa do usuario deve ser maior que zero.');
  }

  const vazadaFinal = vazada === true;
  const comEncostoFinal = comEncosto !== false;
  const nPernasFinal = numPernas === 1 ? 1 : 4;

  if (vazadaFinal) {
    if (!Number.isFinite(paredeMm) || paredeMm <= 0) {
      erros.push('A parede do perfil tubular deve ser maior que zero.');
    } else if (Number.isFinite(espessuraMm) && paredeMm >= espessuraMm / 2) {
      erros.push('A parede deve ser menor que metade da dimensao externa ' +
                 '(t/2 = ' + (espessuraMm / 2).toLocaleString('pt-BR') +
                 ' mm). Acima disso o furo desaparece.');
    }
  }

  /* Assento: dimensoes proprias. A comparacao com a esquadria formada pelas
   * pernas e travessas (Lx, Ly) entra como verificacao de suporte do projeto,
   * permitindo assentos menores que 40x40 cm desde que >= esquadria, e
   * reprovando com aviso de falta de suporte caso contrario. */
  if (!Number.isFinite(ASSENTO.largura) || ASSENTO.largura <= 0 ||
      !Number.isFinite(ASSENTO.profundidade) || ASSENTO.profundidade <= 0) {
    erros.push('A largura e a profundidade do assento devem ser maiores que zero.');
  }

  if (!Number.isFinite(ASSENTO.espessura) ||
      ASSENTO.espessura < ASSENTO.espessuraMinima) {
    erros.push('A espessura do assento deve ser de pelo menos ' +
               ASSENTO.espessuraMinima.toLocaleString('pt-BR') + ' mm.');
  }

  const esquadriaPrelim = Number.isFinite(espessuraMm) && espessuraMm > 0
    ? dimensoesEsquadria(espessuraMm, HIPOTESES.L)
    : { Lx: HIPOTESES.L, Ly: HIPOTESES.L, vaoX: HIPOTESES.L, vaoY: HIPOTESES.L };

  if (nPernasFinal === 4 &&
      (esquadriaPrelim.vaoX <= 0 || esquadriaPrelim.vaoY <= 0)) {
    erros.push('O comprimento das travessas deve ser maior que zero.');
  }

  /*
   * ---------- Centro de carga ----------
   * Fracao de meia dimensao em cada eixo, no intervalo [-1, +1].
   * 100% significa "na borda", qualquer que seja a dimensao do assento.
   */
  const aL = ASSENTO.largura;
  const aP = ASSENTO.profundidade;
  const fracX = ASSENTO.excentricidadeX;
  const fracY = ASSENTO.excentricidadeY;

  if (!Number.isFinite(fracX) || fracX < -1 || fracX > 1) {
    erros.push('A posicao do centro de carga em X deve ficar entre -100% e ' +
               '+100% da meia largura do assento.');
  }
  if (!Number.isFinite(fracY) || fracY < -1 || fracY > 1) {
    erros.push('A posicao do centro de carga em Y deve ficar entre -100% e ' +
               '+100% da meia profundidade do assento.');
  }

  const eX = Number.isFinite(fracX) ? fracX * aL / 2 : 0;
  const eY = Number.isFinite(fracY) ? fracY * aP / 2 : 0;
  const eRes = Math.hypot(eX, eY);

  let material;
  try {
    material = getMaterial(materialId);
  } catch (err) {
    erros.push('Material desconhecido.');
  }

  if (erros.length > 0) return { ok: false, erros };

  const formaFinal = forma === 'redonda' ? 'redonda' : 'quadrada';
  const n = nPernasFinal;
  const t = espessuraMm;
  const H = alturaMm;
  const m = massaKg;
  const { Lx, Ly, vaoX: vaoTravessaX, vaoY: vaoTravessaY } =
    n === 4
      ? dimensoesEsquadria(t, HIPOTESES.L)
      : { Lx: HIPOTESES.L, Ly: HIPOTESES.L, vaoX: 0, vaoY: 0 };
  const L = Math.max(Lx, Ly);
  const K = n === 1 ? HIPOTESES.KPedestal : HIPOTESES.K;

  const sec = propriedadesSecao(t, formaFinal, vazadaFinal, paredeMm);
  const { A, I, W, c } = sec;

  const P = m * G;

  const barras = construirBarras(t, H, material, formaFinal, n,
                                 vazadaFinal, paredeMm, comEncostoFinal);
  const massas = massasPorParte(barras, material);
  const massaTotal = massas.total;
  const pesoCadeira = massaTotal * G;
  const Ptotal = P + pesoCadeira;

  let Nmedio, dN, dNx, dNy, Nmax, Nmin, Mperna;
  let bracoBinario = 0;
  let levantou = false;

  /*
   * Reacao individual de cada perna, na ordem do desenho (chairModel):
   *   perna0 (-x,+y) · perna1 (+x,+y) · perna2 (-x,-y) · perna3 (+x,-y)
   * Serve aos graficos, que mostram as quatro reacoes separadas.
   *
   * `bruta` mantem o sinal — negativa significa perna tracionada, ou seja,
   * levantando. `valor` e limitado a zero para exibicao. Quem soma as quatro
   * precisa usar `bruta`, senao a soma nao fecha com a carga total.
   */
  let reacoesPernas = null;

  if (n === 1) {
    /*
     * Pedestal: a coluna e um balanco com carga fora do centro. O momento
     * resultante tem duas componentes, e a tensao na fibra extrema depende
     * da forma da secao:
     *
     *   quadrada  as duas parcelas se somam no canto.
     *   redonda   ha uma unica fibra extrema, na direcao resultante.
     *
     * Guarda-se o momento equivalente que reproduz essa tensao com um unico
     * W, para o resto do codigo nao precisar saber a forma da secao.
     */
    const Mx = P * eY;
    const My = P * eX;

    Mperna = formaFinal === 'redonda'
      ? Math.hypot(Mx, My)
      : Math.abs(Mx) + Math.abs(My);

    Nmedio = Ptotal; dN = 0; dNx = 0; dNy = 0;
    Nmax = Ptotal; Nmin = Ptotal;
    bracoBinario = 0;
  } else {
    /*
     * Quadro de quatro pernas: placa rigida sobre quatro apoios, com flexao
     * biaxial. A reacao em cada perna segue
     *
     *   Ni = Ptotal/4 + Mx*yi/Ix + My*xi/Iy
     *
     * e, com as pernas nos cantos de um quadrado de lado b = L - t, isso
     * reduz a  Ni = Ptotal/4 ± P*eX/(2b) ± P*eY/(2b).
     *
     * No caso uniaxial (eY = 0) a expressao volta exatamente a formula
     * anterior — a generalizacao e consistente, nao uma formula nova.
     */
    Nmedio = Ptotal / n;
    const bracoBinarioX = Math.max(Lx - t, 1);
    const bracoBinarioY = Math.max(Ly - t, 1);
    bracoBinario = Math.min(bracoBinarioX, bracoBinarioY);

    dNx = (P * Math.abs(eX)) / (2 * bracoBinarioX);
    dNy = (P * Math.abs(eY)) / (2 * bracoBinarioY);
    dN = dNx + dNy;

    Nmax = Nmedio + dN;
    Nmin = Math.max(0, Nmedio - dN);
    Mperna = 0;
    levantou = dN > Nmedio;

    const deltaNx = (P * eX) / (2 * bracoBinarioX);
    const deltaNy = (P * eY) / (2 * bracoBinarioY);

    const sinalX = [-1, +1, -1, +1];
    const sinalY = [+1, +1, -1, -1];

    reacoesPernas = sinalX.map((sx, i) => {
      const bruta = Nmedio + sx * deltaNx + sinalY[i] * deltaNy;
      return {
        indice: i + 1,
        sinalX: sx,
        sinalY: sinalY[i],
        bruta,
        valor: Math.max(0, bruta),
        levantou: bruta < 0
      };
    });
  }

  // ---------- Tensoes ----------
  const sigmaAxial = Nmax / A;
  const sigmaFlexao = Mperna / W;
  const sigmaMax = sigmaAxial + sigmaFlexao;
  const sigmaAdm = tensaoAdmissivel(material);
  const utilizacao = sigmaMax / sigmaAdm;

  // ---------- Flambagem global ----------
  const lambda = (K * H) / sec.r;
  const Pcr = (Math.PI ** 2 * material.E * I) / Math.pow(K * H, 2);
  const NcrAdm = Pcr / material.CS;
  const utilizacaoFlambagem = Nmax / NcrAdm;

  // ---------- Flambagem local da parede ----------
  let flambagemLocal = null;
  if (vazadaFinal) {
    const lambdaLocal = sec.interna / sec.parede;
    const lambdaLimite = 1.40 * Math.sqrt(material.E / material.sigmaLimite);

    flambagemLocal = {
      lambdaLocal,
      lambdaLimite,
      utilizacao: lambdaLocal / lambdaLimite,
      esbelta: lambdaLocal > lambdaLimite
    };
  }

  const deltaAxial = (Nmax * H) / (A * material.E);

  // ---------- Assento: geometria propria ----------
  const hAssento = ASSENTO.espessura;

  /*
   * Sobrepasso em cada eixo, ambos medidos contra o lado do quadro.
   * Usa L da hipotese, e nao CADEIRA.L: as duas constantes apontam hoje para
   * o mesmo valor, mas ler a mesma fonte que o resto do calculo elimina o
   * risco de divergirem sem aviso.
   */
  const folgaX = (aL - Lx) / 2;
  const folgaY = (aP - Ly) / 2;
  const semSuporteX = n === 4 ? (aL < Lx - 1e-6) : (aL < t - 1e-6);
  const semSuporteY = n === 4 ? (aP < Ly - 1e-6) : (aP < t - 1e-6);
  const semSuporte = semSuporteX || semSuporteY;

  /*
   * Faixa de placa: a MENOR dimensao do assento, que e o caso mais
   * desfavoravel — menor W, maior tensao.
   */
  const larguraFaixa = Math.min(aL, aP);

  const aBalanco = n === 1
    ? Math.max(0, aL / 2 - t / 2)
    : Math.max(0, folgaX, folgaY);

  // ---------- Assento em balanco ----------
  /*
   * O balanco e medido no ponto de carga, nao no centro: sentar na beirada
   * aumenta o braco. O acrescimo e a projecao da excentricidade na direcao
   * do balanco critico.
   */
  const aBalancoEfetivo = aBalanco +
    (n === 1 ? 0 : Math.max(Math.abs(eX), Math.abs(eY)));

  const Ma = P * aBalancoEfetivo;
  const Wa = (larguraFaixa * hAssento * hAssento) / 6;
  const Ia = (larguraFaixa * Math.pow(hAssento, 3)) / 12;

  const sigmaAssento = Ma / Wa;
  const flechaAssento = (P * Math.pow(aBalancoEfetivo, 3)) /
                        (3 * material.E * Ia);
  const flechaLimite = aBalancoEfetivo / CADEIRA.divisorFlechaAssento;

  /* Sem balanco (a = 0) nao ha flecha a verificar: evita 0/0 = NaN. */
  const utilizacaoFlechaBalanco = flechaLimite > 0
    ? flechaAssento / flechaLimite
    : 0;

  const assento = {
    a: aBalancoEfetivo,
    aNominal: aBalanco,
    b: aL,
    p: aP,
    h: hAssento,
    faixa: larguraFaixa,
    folgaX,
    folgaY,
    semSuporte,
    semSuporteX,
    semSuporteY,
    esquadriaX: n === 4 ? Lx : t,
    esquadriaY: n === 4 ? Ly : t,
    fracX,
    fracY,
    eX,
    eY,
    eRes,
    M: Ma, W: Wa, I: Ia,
    sigma: sigmaAssento,
    flecha: flechaAssento,
    flechaLimite,
    utilizacao: sigmaAssento / sigmaAdm,
    utilizacaoFlecha: utilizacaoFlechaBalanco
  };

  // ---------- Assento entre apoios (so com 4 pernas) ----------
  const bTravessa = (n === 4 && TRAVESSAS.ativa)
    ? secaoTravessa(t, H).b
    : 0;

  const vaoAssentoX = Math.max(Lx - 2 * bTravessa, 1);
  const vaoAssentoY = Math.max(Ly - 2 * bTravessa, 1);
  const vaoAssento = Math.max(vaoAssentoX, vaoAssentoY);

  let assentoVao = null;
  if (n === 4) {
    const areaAssento = aL * aP;
    const q = P / areaAssento;
    const Mvao = (q * vaoAssento * vaoAssento) / 16;
    const Ivao = Math.pow(hAssento, 3) / 12;
    const sigmaVao = (6 * Mvao) / (hAssento * hAssento);
    const flechaVao = (5 * q * Math.pow(vaoAssento, 4)) /
                      (32 * material.E * Math.pow(hAssento, 3));

    const flechaLimiteVao = vaoAssento / CADEIRA.divisorFlechaVao;

    assentoVao = {
      L: vaoAssento,
      vaoLivre: vaoAssento,
      vaoX: vaoAssentoX,
      vaoY: vaoAssentoY,
      ladoQuadro: L,
      ladoQuadroX: Lx,
      ladoQuadroY: Ly,
      bTravessa,
      area: areaAssento, h: hAssento, q,
      M: Mvao, I: Ivao,
      sigma: sigmaVao,
      flecha: flechaVao,
      flechaLimite: flechaLimiteVao,
      utilizacao: sigmaVao / sigmaAdm,
      utilizacaoFlecha: flechaVao / flechaLimiteVao
    };
  }

  // ---------- Travessas de apoio do assento (so com 4 pernas) ----------
  let travessas = null;
  if (n === 4 && TRAVESSAS.ativa) {
    travessas = verificarTravessas({
      P,
      massaAssento: massas.assento,
      L,
      t,
      H,
      material
    });
  }

  // ---------- Tombamento ----------
  /*
   * Declarada antes do ramo. A versao anterior usava `var` dentro dos dois
   * lados do if: funcionava por hoisting, mas dava a impressao de que a
   * variavel so existia dentro do bloco.
   */
  let estabilidade = null;

  if (n === 1) {
    const R_est = bracoEstabilidade(CADEIRA.coneRaioBase, formaFinal);

    /*
     * O tombamento e verificado com a excentricidade RESULTANTE, e o braco
     * resistente e o menor da base. A resultante pode estar em qualquer
     * direcao, e a distancia do centro ate a borda nessa direcao nunca e
     * menor que R_est — logo o resultado e conservador.
     */
    const utTombamento = (P * eRes) / ((P + pesoCadeira) * R_est);

    estabilidade = {
      braco: R_est,
      raioCone: CADEIRA.coneRaioBase,
      eX, eY, eRes,
      pesoCadeira,
      massaCadeira: massaTotal,
      utilizacao: utTombamento,
      tombou: utTombamento > 1
    };
  }

  // ---------- Veredito ----------
  const motivos = [];

  if (semSuporte) {
    if (n === 4) {
      motivos.push(
        'O assento não tem suporte: as medidas do assento (' +
        fmt(aL / 10) + ' × ' + fmt(aP / 10) + ' cm) são menores do que o ' +
        'tamanho da esquadria formada pelas pernas e travessas (' +
        fmt(Lx / 10) + ' × ' + fmt(Ly / 10) + ' cm).'
      );
    } else {
      motivos.push(
        'O assento não tem suporte: as medidas do assento (' +
        fmt(aL / 10) + ' × ' + fmt(aP / 10) + ' cm) são menores do que a ' +
        'coluna de apoio (' + fmt(t / 10) + ' × ' + fmt(t / 10) + ' cm).'
      );
    }
  }

  if (utilizacao > 1) {
    motivos.push('Tensao de ' + fmt(sigmaMax) + ' MPa na perna acima da admissivel de ' +
                 fmt(sigmaAdm) + ' MPa.');
  }
  if (utilizacaoFlambagem > 1) {
    motivos.push('Flambagem global: ' + fmt(Nmax) + ' N acima de ' + fmt(NcrAdm) + ' N.');
  }
  if (flambagemLocal && flambagemLocal.esbelta) {
    motivos.push('Parede esbelta: relacao ' + fmt(flambagemLocal.lambdaLocal) +
                 ' acima do limite de ' + fmt(flambagemLocal.lambdaLimite) +
                 '. Aumente a parede ou reduza a dimensao externa.');
  }
  if (assento.utilizacao > 1) {
    motivos.push('Assento em balanco: tensao de ' + fmt(sigmaAssento) +
                 ' MPa acima da admissivel de ' + fmt(sigmaAdm) + ' MPa.');
  }
  if (assento.utilizacaoFlecha > 1) {
    motivos.push('Assento em balanco: flecha de ' + fmt(flechaAssento) +
                 ' mm acima do limite de ' + fmt(flechaLimite) + ' mm.');
  }
  if (assentoVao && assentoVao.utilizacao > 1) {
    motivos.push('Assento entre apoios: tensao de ' + fmt(assentoVao.sigma) +
                 ' MPa acima da admissivel de ' + fmt(sigmaAdm) + ' MPa.');
  }
  if (assentoVao && assentoVao.utilizacaoFlecha > 1) {
    motivos.push('Assento entre apoios: flecha de ' + fmt(assentoVao.flecha) +
                 ' mm acima do limite de ' + fmt(assentoVao.flechaLimite) + ' mm.');
  }
  if (travessas && travessas.utilizacaoTensao > 1) {
    motivos.push('Travessa de apoio: tensao de ' + fmt(travessas.tensao) +
                 ' MPa acima da admissivel de ' + fmt(travessas.sigmaAdm) + ' MPa.');
  }
  if (travessas && travessas.utilizacaoFlecha > 1) {
    motivos.push('Travessa de apoio: flecha de ' + fmt(travessas.flecha) +
                 ' mm acima do limite de ' + fmt(travessas.flechaLimite) +
                 ' mm (L/' + travessas.divisorFlecha + ').');
  }
  if (levantou) {
    motivos.push('A carga esta fora da base de apoio: as pernas do lado ' +
                 'oposto perdem contato com o piso.');
  }
  if (estabilidade && estabilidade.tombou) {
    motivos.push('A resultante cai fora da base do pedestal: risco de tombamento.');
  }

  return {
    ok: true,
    entrada: {
      material, t, H, m,
      L, Lx, Ly,
      vaoTravessaX, vaoTravessaY,
      forma: formaFinal,
      numPernas: n,
      vazada: vazadaFinal,
      parede: vazadaFinal ? sec.parede : 0,
      comEncosto: comEncostoFinal,
      fracX, fracY, eX, eY, eRes
    },
    secao: {
      A, I, W, c,
      r: sec.r,
      parede: sec.parede,
      interna: sec.interna,
      lambda
    },
    forcas: {
      P, Nmedio, dN, dNx, dNy, bracoBinario,
      Nmax, Nmin, Mperna, levantou, reacoesPernas
    },
    assento,
    assentoVao,
    travessas,
    estabilidade,
    tensoes: { sigmaAxial, sigmaFlexao, sigmaMax, sigmaAdm, utilizacao },
    flambagem: { K, lambda, Pcr, NcrAdm, utilizacaoFlambagem },
    flambagemLocal,
    deformacao: { deltaAxial },
    massa: {
      pernas: massas.pernas,
      pe: massas.pe,
      assento: massas.assento,
      postes: massas.postes,
      encosto: massas.encosto,
      travessas: massas.travessas,
      total: massas.total,
      volumeTotal: massas.volumeTotal
    },
    veredito: { aprovado: motivos.length === 0, motivos }
  };
}

function fmt(v){
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}