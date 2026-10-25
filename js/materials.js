/**
 * Propriedades mecânicas dos materiais.
 * E e sigmaLimite em MPa; rho em kg/m³; CS é o coeficiente de segurança.
 * O bloco "render" é apenas apresentação: nunca use em cálculo.
 */

export const CORES = {
  cinzaEscuro: '#4a4f55',
  vinhoEscuro: '#5c1f2b'
};

export const MATERIAIS = {
  madeira: {
    id: 'madeira',
    nome: 'Madeira estrutural (C-40)',
    E: 9500, sigmaLimite: 40, rho: 600, CS: 2.0, cor: '#a9713f',
    render: {
      pernas: '#a9713f',
      assento: '#a9713f',
      encosto: { tipo: 'painel', cor: '#a9713f' },
      veios: true
    }
  },
  aco: {
    id: 'aco',
    nome: 'Aço ASTM A36',
    E: 200000, sigmaLimite: 250, rho: 7850, CS: 1.5, cor: '#8a9099',
    render: {
      pernas: '#8a9099',
      assento: CORES.cinzaEscuro,
      encosto: { tipo: 'ripas', cor: '#8a9099', n: 3, fracao: 0.2 },
      veios: false
    }
  },
  aluminio: {
    id: 'aluminio',
    nome: 'Alumínio 6061-T6',
    E: 69000, sigmaLimite: 240, rho: 2700, CS: 1.5, cor: '#c3c9cf',
    render: {
      pernas: '#c3c9cf',
      assento: CORES.cinzaEscuro,
      encosto: { tipo: 'painel', cor: CORES.vinhoEscuro },
      veios: false
    }
  }
};

export function getMaterial(id) {
  const m = MATERIAIS[id];
  if (!m) throw new Error('Material desconhecido: ' + id);
  return m;
}

export function tensaoAdmissivel(material) {
  return material.sigmaLimite / material.CS;
}