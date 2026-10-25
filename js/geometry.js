/**
 * Geometria da secao transversal da perna. Unidade: mm.
 *
 * 'quadrada' — quadrado macico de lado t
 *   A = t^2        I = t^4/12       c = t/2   W = t^3/6       r = t/raiz(12)
 * 'redonda'  — circulo macico de diametro t
 *   A = pi*t^2/4   I = pi*t^4/64    c = t/2   W = pi*t^3/32   r = t/4
 */

export function propriedadesSecao(t, forma = 'quadrada'){
  const c = t / 2;
  let A, I;

  if (forma === 'redonda') {
    A = (Math.PI * t * t) / 4;
    I = (Math.PI * Math.pow(t, 4)) / 64;
  } else {
    A = t * t;
    I = Math.pow(t, 4) / 12;
  }

  return { A, I, c, W: I / c, r: Math.sqrt(I / A) };
}

/* Atalhos de secao quadrada, mantidos para relatorios e testes. */
export function area(t){ return t * t; }
export function inercia(t){ return Math.pow(t, 4) / 12; }
export function distanciaFibra(t){ return t / 2; }
export function moduloResistente(t){ return inercia(t) / distanciaFibra(t); }
export function raioGiracao(t){ return t / Math.sqrt(12); }
export function esbeltez(H, t, K = 1){ return (K * H) / raioGiracao(t); }
export function cargaCriticaEuler(E, t, H, K = 1){
  return (Math.PI ** 2 * E * inercia(t)) / Math.pow(K * H, 2);
}