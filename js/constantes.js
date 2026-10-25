/**
 * Constantes fisicas e hipoteses de projeto.
 * Unidades internas: comprimento em mm, forca em N, tensao em MPa, massa em kg.
 */

export const G = 9.81;

export const HIPOTESES = {
  nPernas: 4,
  L: 400,
  e: 50,
  K: 1.0,
  KPedestal: 2.0,
  mAssento: 2.0
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