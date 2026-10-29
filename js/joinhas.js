/**
 * Animacao de aprovacao: joinhas que sobem flutuando e somem.
 *
 * Cada joinha e um elemento proprio, com atraso, tamanho, deriva lateral e
 * giro sorteados. Nao existe faixa nem barra: a camada e transparente e nao
 * captura cliques, para nao bloquear o palco.
 *
 * CSS NECESSARIO
 * Este modulo depende das classes .camada-joinhas e .joinha-flutuante e do
 * keyframe joinha-sobe, definidos em css/style.css. Sem eles os elementos
 * sao injetados sem posicionamento e ficam parados no canto do palco.
 * O <svg> tambem precisa de width/height 100% para preencher o <span>, e o
 * #palco precisa de position:relative para a camada cobrir a area certa.
 *
 * SUBSTITUI a versao que desenhava uma fila de joinhas em faixa e a versao
 * em DOM puro que vivia dentro de animacao.js. Aquela deve ser removida:
 * duas funcoes com o mesmo nome confundem qual CSS esta em uso.
 *
 * Nao depende de nada de animacao.js, de proposito: assim a ruina continua
 * intacta.
 */

const CAMADA = 'camada-joinhas';
const TOTAL = 18;
const JANELA_ENTRADA = 900;  // ms de espalhamento entre o primeiro e o ultimo
const DURACAO_BASE = 1600;   // ms de subida
const FOLGA = 1000;          // ms ate limpar a camada

const SVG_JOINHA =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ' +
    'style="display:block;width:100%;height:100%">' +
    '<rect x="2" y="10" width="4" height="11" rx="1.3" fill="currentColor"/>' +
    '<path d="M8 10.2 11.6 3.4a1.8 1.8 0 0 1 3.1 1.8L13.6 9.6h4.2a2.2 2.2 0 0 1 ' +
    '2.2 2.6l-1.1 6.2A2.2 2.2 0 0 1 16.7 21H8V10.2Z" fill="currentColor"/>' +
  '</svg>';

function aleatorio(min, max){
  return min + Math.random() * (max - min);
}

/**
 * Dispara a animacao no palco e devolve uma funcao que a interrompe.
 *
 * Aceita opcoes para nao quebrar quem ja chamava com argumento — a versao
 * anterior deste nome, em animacao.js, recebia { quantidade, duracao }.
 */
export function animarJoinhas(opcoes = {}){
  if (typeof document === 'undefined') return function(){};

  /* Acessibilidade: quem pediu menos movimento no sistema nao recebe a
     animacao. A versao anterior tinha esta guarda e ela se perdeu. */
  if (typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return function(){};
  }

  const palco = opcoes.palco || document.getElementById('palco');
  if (!palco) return function(){};

  const total = Number.isFinite(opcoes.quantidade)
    ? Math.max(1, Math.min(60, opcoes.quantidade))
    : TOTAL;

  const anterior = palco.querySelector('.' + CAMADA);
  if (anterior) anterior.remove();

  const camada = document.createElement('div');
  camada.className = CAMADA;
  camada.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < total; i++) {
    const el = document.createElement('span');
    el.className = 'joinha-flutuante';
    el.innerHTML = SVG_JOINHA;

    const tamanho = aleatorio(18, 34);
    const atraso = (i / total) * JANELA_ENTRADA + aleatorio(0, 160);
    const duracao = DURACAO_BASE + aleatorio(0, 700);

    el.style.left = aleatorio(4, 92).toFixed(1) + '%';
    el.style.width = tamanho.toFixed(1) + 'px';
    el.style.height = tamanho.toFixed(1) + 'px';
    el.style.animationDelay = atraso.toFixed(0) + 'ms';
    el.style.animationDuration = duracao.toFixed(0) + 'ms';

    el.style.setProperty('--deriva', aleatorio(-34, 34).toFixed(1) + 'px');
    el.style.setProperty('--giro', aleatorio(-26, 26).toFixed(1) + 'deg');

    camada.appendChild(el);
  }

  palco.appendChild(camada);

  let encerrado = false;
  const temporizador = window.setTimeout(function(){
    if (encerrado) return;
    encerrado = true;
    camada.remove();
  }, JANELA_ENTRADA + DURACAO_BASE + 700 + FOLGA);

  return function parar(){
    if (encerrado) return;
    encerrado = true;
    window.clearTimeout(temporizador);
    camada.remove();
  };
}