/**
 * Geometria da secao transversal da perna. Unidade: mm.
 *
 * t e sempre a dimensao EXTERNA: lado do quadrado ou diametro do circulo.
 * parede e a espessura da parede em mm, so usada quando vazada.
 *
 * MACICA
 *   quadrada: A = t^2        I = t^4/12
 *   redonda : A = pi*t^2/4   I = pi*t^4/64
 *
 * VAZADA (parede ep, dimensao interna di = t - 2ep)
 *   quadrada: A = t^2 - di^2          I = (t^4 - di^4)/12
 *   redonda : A = pi/4*(t^2 - di^2)   I = pi/64*(t^4 - di^4)
 *
 * Em ambos os casos c = t/2, W = I/c e r = raiz(I/A).
 */

export function propriedadesSecao(t, forma = 'quadrada', vazada = false, paredeMm = 0){
  const c = t / 2;
  const redonda = forma === 'redonda';

  let A, I;
  let parede = 0;
  let interna = 0;

  if (vazada) {
    /*
     * O solver ja validou a parede. O clamp aqui e protecao de ultimo
     * recurso para chamada direta: parede zero ou >= t/2 degeneraria o furo.
     */
    parede = Math.min(Math.max(paredeMm, 0.1), t / 2 - 0.01);
    interna = t - 2 * parede;

    if (redonda) {
      A = (Math.PI / 4) * (t * t - interna * interna);
      I = (Math.PI / 64) * (Math.pow(t, 4) - Math.pow(interna, 4));
    } else {
      A = t * t - interna * interna;
      I = (Math.pow(t, 4) - Math.pow(interna, 4)) / 12;
    }
  } else if (redonda) {
    A = (Math.PI * t * t) / 4;
    I = (Math.PI * Math.pow(t, 4)) / 64;
  } else {
    A = t * t;
    I = Math.pow(t, 4) / 12;
  }

  return { A, I, c, W: I / c, r: Math.sqrt(I / A), parede, interna };
}