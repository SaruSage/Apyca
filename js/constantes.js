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

/**
 * Premissas construtivas. Todas em milimetros.
 * O pe da cadeira tem dimensao fixa; a espessura da perna cresce para dentro.
 * Assim a silhueta externa e o assento ficam parados quando t varia.
 */
export const CADEIRA = {
  L: 400,               // largura externa do pe (distancia entre faces externas)
  folga: 20,            // sobrepasse do assento em relacao ao pe, igual nos 4 lados
  tAssento: 20,         // espessura do tampo
  alturaAbertura: 90,   // vao livre entre o topo do assento e a base do encosto
  alturaEncosto: 320,   // do topo do assento ate o topo do encosto
  tEncosto: 20,         // espessura da chapa do encosto
  espessuraMaxima: 150, // acima disso as pernas se cruzam dentro do pe
};