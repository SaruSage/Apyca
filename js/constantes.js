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
 * Premissas construtivas da cadeira. Valem para qualquer material.
 * Todas em milimetros.
 */
export const CADEIRA = {
  L: 400,                  // distancia entre eixos das pernas
  folgaAssento: 12,        // balanco lateral e frontal do assento
  tAssento: 20,            // espessura do assento
  alturaEncosto: 320,      // altura do encosto acima do assento
  tEncosto: 20,            // espessura do painel do encosto
  fracaoBasePainel: 0.30,  // onde o painel do encosto comeca (fracao da altura)

  // Travessas entre as pernas. Desligadas: a cadeira fica com as quatro pernas
  // livres. Ligue para comparar os dois modelos na apresentacao.
  mostrarTravessas: false,
  fracaoTravessa: 0.25,
  fracaoTravessaEsp: 0.55,
};