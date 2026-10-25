/**
 * Propriedades mecanicas dos materiais estruturais.
 * E e sigmaLimite em MPa; rho em kg/m³; CS e o coeficiente de seguranca.
 * O bloco "render" contem apenas apresentacao: cores por peca e tipo de encosto.
 * Nunca use o bloco render em calculo.
 */

export const CORES = {
  cinzaEscuro: '#4a4f55',   // assento de aco e de aluminio
  vinhoEscuro: '#5c1f2b',   // encosto de aluminio
};

export const MATERIAIS = {
  madeira: {
    id: 'madeira',
    nome: 'Madeira estrutural (dicotiledonea C-40)',
    E: 9500,
    sigmaLimite: 40,
    rho: 600,
    CS: 2.0,
    cor: '#a9713f',
    render: {
      pernas: '#a9713f',
      assento: '#a9713f',
      encosto: { tipo: 'painel', cor: '#a9713f' },
      veios: true,
    },
  },

  aco: {
    id: 'aco',
    nome: 'Aco ASTM A36',
    E: 200000,
    sigmaLimite: 250,
    rho: 7850,
    CS: 1.5,
    cor: '#8a9099',
    render: {
      pernas: '#8a9099',
      assento: CORES.cinzaEscuro,
      // Encosto em tres ripas horizontais da cor das pernas.
      // Cada ripa: 1/5 da altura e 1/5 da profundidade do encosto normal.
      // Vaos tambem de 1/5 da altura: 3 ripas + 2 vaos = 5/5 da altura.
      encosto: { tipo: 'ripas', cor: '#8a9099', n: 3, fracao: 0.2 },
      veios: false,
    },
  },

  aluminio: {
    id: 'aluminio',
    nome: 'Aluminio 6061-T6',
    E: 69000,
    sigmaLimite: 240,
    rho: 2700,
    CS: 1.5,
    cor: '#c3c9cf',
    render: {
      pernas: '#c3c9cf',
      assento: CORES.cinzaEscuro,
      encosto: { tipo: 'painel', cor: CORES.vinhoEscuro },
      veios: false,
    },
  },
};

export function getMaterial(id) {
  const material = MATERIAIS[id];
  if (!material) {
    throw new Error(`Material desconhecido: ${id}`);
  }
  return material;
}

export function tensaoAdmissivel(material) {
  return material.sigmaLimite / material.CS;
}