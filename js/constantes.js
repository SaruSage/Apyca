/**
 * Constantes fisicas e hipoteses de projeto.
 * Unidades internas: comprimento em mm, forca em N, tensao em MPa, massa em kg.
 */

/*
 * Carimbo de versao. Serve para conferir, no navegador, QUAL arquivo foi
 * entregue: abra http://127.0.0.1:5500/js/constantes.js e procure esta
 * linha no fim do arquivo. Se ela nao aparecer, o servidor esta entregando
 * uma copia antiga (cache) e nenhuma alteracao feita aqui tera efeito.
 *
 * Ao mudar este arquivo, atualize a data abaixo. Custa nada e evita horas
 * de depuracao em codigo que estava certo desde o inicio.
 */
export const VERSAO = '2026-10-27-travessas';

export const G = 9.81;

export const HIPOTESES = {
  nPernas: 4,
  L: 400,
  e: 50,
  K: 1.0,
  KPedestal: 2.0
};

export const CADEIRA = {
  L: 400,
  folga: 20,
  fracaoEspessuraAssento: 0.5,
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
   * 300 significa flecha maxima = L/300. So se aplica com 4 pernas.
   */
  divisorFlechaVao: 300,

  /*
   * Parede do perfil vazado, em MILIMETROS.
   * Valor absoluto, nao fracao de t: e assim que o perfil e comprado.
   * A parede precisa ficar entre 0 e t/2 — o solver valida e reprova fora
   * dessa faixa em vez de corrigir em silencio.
   */
  paredePadrao: 3.0,
  paredeMinima: 0.5
};

/*
 * TRAVESSAS DE APOIO DO ASSENTO
 *
 * Quadro de quatro vigas que ligam as pernas logo abaixo do assento. Sao
 * elas que recebem o assento e o entregam as pernas.
 *
 * largura e altura sao os valores PEDIDOS pelo usuario e podem ser mudados
 * em tempo de execucao por definirTravessaSecao() (ver travessas.js).
 * secaoTravessa() aplica os limites: a largura nunca passa da dimensao
 * externa da perna, porque uma viga mais larga que a perna nao teria onde
 * encostar.
 *
 * A face EXTERNA da viga e alinhada com a face externa da perna. Nao e
 * detalhe estetico: centrada, a viga fica enterrada dentro da silhueta da
 * perna e desaparece no desenho quando a perna e grossa.
 */
export const TRAVESSAS = {
  ativa: true,
  nTravessas: 4,
  largura: 40,
  altura: 60,
  larguraMinima: 10,
  alturaMinima: 20,
  divisorFlecha: 300
};