/**
 * Constantes físicas e hipóteses de projeto.
 * Unidades internas: comprimento em mm, força em N, tensão em MPa (N/mm²), massa em kg.
 * Toda hipótese aqui deve ser justificada no memorial de cálculo.
 */

export const G = 9.81; // m/s²

export const HIPOTESES = {
  // Numero de pernas da cadeira (premissa de projeto)
  nPernas: 4,

  // Lado do quadrado formado pelos eixos das pernas, em mm
  L: 400,

  // Excentricidade de projeto do centro de carga em relacao ao centro do assento, em mm.
  // Representa o usuario sentado fora do centro. Valor conservador a validar.
  e: 50,

  // Fator de comprimento efetivo da perna tratada como coluna (1.0 = biarticulada)
  K: 1.0,

  // Massa do assento + encosto, em kg (nao varia com as entradas do usuario)
  mAssento: 2.0,
};