/**
 * Propriedades mecanicas dos materiais estruturais.
 * E e sigmaLimite em MPa; rho em kg/m³; CS e o coeficiente de seguranca.
 * Valores usuais de referencia. Confirmar e citar a fonte no memorial.
 */

export const MATERIAIS = {
  madeira: {
    id: 'madeira',
    nome: 'Madeira estrutural (dicotiledonea C-40)',
    E: 9500,
    sigmaLimite: 40,
    rho: 600,
    CS: 2.0,
    cor: '#a9713f',
  },
  aco: {
    id: 'aco',
    nome: 'Aco ASTM A36',
    E: 200000,
    sigmaLimite: 250,
    rho: 7850,
    CS: 1.5,
    cor: '#8a9099',
  },
  aluminio: {
    id: 'aluminio',
    nome: 'Aluminio 6061-T6',
    E: 69000,
    sigmaLimite: 240,
    rho: 2700,
    CS: 1.5,
    cor: '#c3c9cf',
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