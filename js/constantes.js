/**
 * Constantes fisicas e hipoteses de projeto.
 * Unidades internas: comprimento em mm, forca em N, tensao em MPa, massa em kg.
 */

export const G = 9.81;

export const HIPOTESES = {
  nPernas: 4,        // valor padrao quando o formulario nao informa
  L: 400,            // lado do quadrado formado pelos eixos das pernas, mm
  e: 50,             // excentricidade de projeto do centro de carga, mm

  // Fator de comprimento efetivo da flambagem.
  // 4 pernas: rotula-rotula nos extremos da perna.
  K: 1.0,
  // 1 perna: coluna engastada na base e livre no topo (balanco).
  KPedestal: 2.0,

  mAssento: 2.0      // massa do assento + encosto, kg
};

/**
 * Premissas construtivas. Todas em mm.
 * O pe da cadeira tem dimensao fixa; a espessura da perna cresce para dentro.
 * Assento e encosto tem METADE da espessura da perna.
 */
export const CADEIRA = {
  L: 400,                        // largura externa do pe
  folga: 20,                     // sobrepasse do assento em relacao ao pe
  fracaoEspessuraAssento: 0.5,   // assento = 0,5 * t
  fracaoEspessuraEncosto: 0.5,   // encosto = 0,5 * t
  alturaAbertura: 90,            // vao livre entre assento e base do encosto
  alturaEncosto: 320,            // do topo do assento ate o topo do encosto
  espessuraMaxima: 150,          // acima disso as pernas se cruzam no centro

  // Base do pedestal, usada apenas na cadeira de 1 perna.
  coneRaioBase: 200,             // raio do cone na base, mm
  coneAltura: 55,                // altura do pe, mm

  /*
   * Lado da base da piramide como FRACAO DO DIAMETRO do cone.
   * 1,0   -> lado 400 mm (mesmo diametro)
   * 2/3   -> lado ~266,7 mm
   */
  fracaoLadoPiramide: 2 / 3,

  /*
   * Limite de flecha do assento em balanco, como divisor do proprio balanco.
   * 150 significa flecha maxima = a/150.
   * Diminua para exigir mais rigidez (200, 300) ou aumente para relaxar.
   */
  divisorFlechaAssento: 150
};