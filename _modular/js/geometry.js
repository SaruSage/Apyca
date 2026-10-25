/**
 * Propriedades geometricas da secao transversal da perna.
 * A perna e tratada como barra de secao quadrada macica de lado t (mm).
 * A = t² ; I = t⁴/12 ; c = t/2 ; W = I/c = t³/6 ; r = t/√12
 */

export function area(t) {
  return t * t;
}

export function inercia(t) {
  return Math.pow(t, 4) / 12;
}

export function distanciaFibra(t) {
  return t / 2;
}

export function moduloResistente(t) {
  return inercia(t) / distanciaFibra(t);
}

export function raioGiracao(t) {
  return t / Math.sqrt(12);
}

export function esbeltez(H, t, K = 1) {
  return (K * H) / raioGiracao(t);
}

/** Carga critica de flambagem elastica de Euler, em N */
export function cargaCriticaEuler(E, t, H, K = 1) {
  return (Math.PI ** 2 * E * inercia(t)) / Math.pow(K * H, 2);
}