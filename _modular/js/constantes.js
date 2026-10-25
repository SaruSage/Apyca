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
 */
export const CADEIRA = {
  L: 400,                        // largura externa do pe
  folga: 20,                     // sobrepasse do assento em relacao ao pe

  // Assento e encosto com METADE da espessura da perna. Mesma regra para os dois.
  fracaoEspessuraAssento: 0.5,
  fracaoEspessuraEncosto: 0.5,

  alturaAbertura: 90,            // vao livre entre o topo do assento e a base do encosto
  alturaEncosto: 320,            // do topo do assento ate o topo do encosto
  espessuraMaxima: 150,          // acima disso as pernas se cruzam dentro do pe
    // O poste acima do assento termina nesta fracao da altura do encosto.
  // 0,5 = apoia o encosto no meio da lateral. 1,0 = ate o topo (comportamento antigo).
  fracaoApoioEncosto:0.5,
};