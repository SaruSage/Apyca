/**
 * Constantes fisicas e hipoteses de projeto.
 * Unidades internas: comprimento em mm, forca em N, tensao em MPa, massa em kg.
 */

/*
 * Carimbo de versao. Serve para conferir, no navegador, QUAL arquivo foi
 * entregue: abra http://127.0.0.1:5500/js/constantes.js e procure esta linha.
 * Se ela nao aparecer, o servidor esta entregando uma copia antiga (cache) e
 * nenhuma alteracao feita aqui tera efeito.
 */
export const VERSAO = '2026-10-28-revisao-constantes';

export const G = 9.81;

/*
 * LADO DO QUADRO DE PERNAS — fonte unica.
 *
 * O valor existia duplicado em HIPOTESES.L e CADEIRA.L. Funcionava enquanto
 * os dois fossem iguais, mas a divergencia seria silenciosa: os testes leem
 * HIPOTESES.L, o chairModel le CADEIRA.L, e o travessas recebe L ja derivado
 * de CADEIRA.L. Mudar um lado so faria o vao de calculo sair de uma medida e
 * a verificacao de outra.
 *
 * Agora ha uma constante e as duas estruturas apontam para ela.
 */
const L_QUADRO = 400;

/*
 * HIPOTESES
 *
 * A excentricidade NAO esta aqui: ela descreve a posicao do centro de carga
 * sobre o plano do assento, e nao uma hipotese fixa de projeto. Mora em
 * ASSENTO, onde pode ser configurada em dois eixos.
 *
 * nPernas e um valor de referencia: o solver usa o que chega do formulario.
 */
export const HIPOTESES = {
  nPernas: 4,
  L: L_QUADRO,
  K: 1.0,
  KPedestal: 2.0
};

export const CADEIRA = {
  L: L_QUADRO,

  /*
   * Folga de referencia entre a face externa da perna e a borda do assento,
   * em mm. Continua em uso pelo memorial, que a utiliza como fallback quando
   * recebe um resultado de solver antigo sem as dimensoes do assento.
   *
   * Coerente com o padrao: L 400 + 2 x 20 = 440, que e a largura de ASSENTO.
   */
  folga: 20,

  /*
   * OBSOLETA. Ficou do tempo em que a espessura do assento era uma fracao da
   * dimensao da perna. Hoje o assento tem espessura propria em ASSENTO, e
   * nada deve ler esta constante. Mantida apenas para que um ponto de codigo
   * esquecido nao receba undefined — o resultado seria NaN silencioso.
   */
  fracaoEspessuraAssento: 0.5,

  /*
   * Espessura do painel do encosto como fracao da dimensao da perna.
   *
   * Com 0,5 e perna de 40 mm, o painel sai com 20 mm. E a base de calculo do
   * encosto em PAINEL (a profundidade da caixa) e, no encosto em RIPAS, a
   * espessura do montante de referencia.
   *
   * ATENCAO — as ripas nao usam esta fracao como base da espessura. Desde a
   * revisao do chairModel, pRipa = fracao * espessuraPerna, e a espessura do
   * painel deixou de entrar nessa conta. Com fracao 0,2 e perna de 40 mm, a
   * ripa sai com 8 mm.
   */
  fracaoEspessuraEncosto: 0.5,

  alturaAbertura: 90,
  alturaEncosto: 320,
  espessuraMaxima: 150,

  coneRaioBase: 200,
  coneAltura: 55,
  fracaoLadoPiramide: 2 / 3,

  divisorFlechaAssento: 150,

  /*
   * Limite de flecha do assento ENTRE os apoios, como divisor do vao.
   * 300 significa flecha maxima = Lv/300. So se aplica com 4 pernas.
   */
  divisorFlechaVao: 300,

  /*
   * Parede do perfil vazado, em MILIMETROS.
   * Valor absoluto, nao fracao de t: e assim que o perfil e comprado.
   * A parede precisa ficar entre 0 e t/2 — o solver valida e reprova fora
   * dessa faixa em vez de corrigir em silencio.
   *
   * NAO LIDA POR NINGUEM hoje. O app.js fixa a parede inicial em PADRAO
   * (paredeMm: 3) e o geometry.js protege com Math.max(paredeMm, 0.1). As
   * duas constantes ficam como referencia do valor pretendido: se o app
   * passar a importa-las, o padrao deixa de ser numero solto no app.
   */
  paredePadrao: 3.0,
  paredeMinima: 0.5
};

/*
 * ASSENTO
 *
 * Dimensoes PROPRIAS da placa e posicao do centro de carga. Nada aqui deriva
 * da perna: perna grossa nao implica assento grosso.
 *
 * A placa apoia no QUADRO de apoio — os quatro topos de perna nos cantos mais
 * as quatro travessas ao longo das bordas, todos coplanares em z = H.
 */
export const ASSENTO = {
  largura: 440,
  profundidade: 440,
  espessura: 20,

  /*
   * Espessura minima aceitavel da placa, em mm. Corresponde ao min do campo
   * no formulario (0,5 cm). Quem aplica o limite e o solver.
   */
  espessuraMinima: 5,

  /*
   * Posicao do CENTRO DE CARGA no plano do assento, como FRACAO de meia
   * dimensao em cada eixo. E o que a interface controla com dois seletores.
   *
   *   0      centro geometrico — carga centrada, reacoes iguais
   *   +1     borda direita (X) ou borda de tras (Y)
   *   -1     borda esquerda (X) ou borda da frente (Y)
   *
   * Fracao, e nao milimetros, porque nao depende da dimensao do assento:
   * aumentar a largura de 44 para 60 cm nao desloca a carga relativa, e 100%
   * continua significando "na borda". O deslocamento em mm e derivado no
   * solver, que conhece as dimensoes vigentes.
   *
   * Fora de [-1, +1] o centro de carga cai fora da placa: o solver valida e
   * reprova em vez de corrigir em silencio.
   */
  excentricidadeX: 0,
  excentricidadeY: 0
};

/*
 * TRAVESSAS DE APOIO DO ASSENTO
 *
 * Quadro de quatro vigas que ligam as pernas logo abaixo do assento. Sao
 * elas que completam o apoio da placa ao longo das bordas.
 *
 * largura e altura sao os valores PEDIDOS pelo usuario e podem ser mudados
 * em tempo de execucao por definirTravessaSecao() (ver travessas.js).
 * secaoTravessa() aplica os limites: a largura nunca passa da dimensao
 * externa da perna, porque uma viga mais larga que a perna nao teria onde
 * encostar. A altura nao passa de metade da altura da perna.
 *
 * A travessa ocupa apenas o vao entre as FACES INTERNAS das pernas, e sua
 * face externa e coplanar com a face externa da perna. O topo fica na mesma
 * cota do topo da perna (z = H), de modo que o quadro e uma moldura plana.
 */
export const TRAVESSAS = {
  ativa: true,
  nTravessas: 4,

  /*
   * Valores iniciais, tambem correspondentes ao padrao do formulario (4 e 6
   * cm). Com perna de 40 mm, a largura pedida iguala o limite superior de
   * secaoTravessa: a viga encosta na face da perna sem passar dela.
   */
  largura: 40,
  altura: 60,

  /*
   * Comprimento livre de cada par de travessas (entre faces internas das
   * pernas), em mm:
   *   comprimentoX : travessas frontal e traseira (eixo X)
   *   comprimentoY : travessas laterais de cada lado (eixo Y)
   * Quando null, deriva de L_QUADRO - 2*t (mantendo L = 400 mm por padrao).
   */
  comprimentoX: null,
  comprimentoY: null,

  vazada: false,
  parede: 2,

  /*
   * NAO LIDAS por secaoTravessa(). Ela aplica Math.max(valor, 1) e os tetos
   * de geometria (largura da perna, metade da altura da perna). Os limites
   * efetivos hoje vem do min/max dos campos no formulario, que por
   * coincidencia sao 10 e 20 mm.
   *
   * Ficam registradas como a faixa pretendida. Quem for centralizar a
   * validacao deve ler daqui, e nao repetir o numero no HTML.
   */
  larguraMinima: 10,
  alturaMinima: 20,

  divisorFlecha: 300
};