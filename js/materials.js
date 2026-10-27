/**
 * Propriedades mecânicas dos materiais.
 *
 * FONTE DOS VALORES
 * E, tensão limite e massa específica vêm da tabela de propriedades
 * mecânicas médias de materiais de engenharia típicos, no apêndice de
 * Hibbeler — Resistência dos Materiais. O polipropileno não consta dessa
 * tabela: os valores vêm de Callister — Ciência e Engenharia de Materiais.
 *
 * NOMENCLATURA
 * Os nomes abaixo seguem a designação da liga ou classe usada na própria
 * fonte, para que a conferência no livro seja direta e sem tradução de
 * meio. Onde a fonte identifica a espécie ou a norma, isso aparece no nome.
 *
 * UNIDADES
 * E e tensões em MPa; rho em kg/m³; CS adimensional.
 *
 * SIGMA LIMITE E A REGRA DO MATERIAL
 * O solver usa um único valor de referência, sigmaLimite. A regra adotada:
 *   material dúctil -> vale o ESCOAMENTO (a peça se deforma em definitivo)
 *   material frágil -> vale a RUPTURA    (a peça se parte sem aviso)
 * As duas tensões ficam registradas em sigmaEscoamento e sigmaRuptura para
 * exibição e conferência. Quem entra no cálculo é sigmaLimite.
 *
 * COEFICIENTE DE SEGURANÇA
 * Hibbeler traz propriedade de material, não valor de projeto: o CS não vem
 * dele. Os valores abaixo são decisão deste simulador, justificados material
 * por material no comentário de cada bloco.
 *
 * ATENÇÃO — CAMPO cor
 * cor e render.*.cor são só apresentação, mas NUNCA podem ser string vazia:
 * sombrear() em iso.js faz parseInt('') -> NaN e o desenho inteiro
 * desaparece. Se você já tem hexadecimais que gosta, mantenha os seus.
 */

export const CORES = {
  cinzaEscuro: '#7f858c',
  vinhoEscuro: '#6e3b45'
};

export const MATERIAIS = {
  madeira: {
    id: 'madeira',
    nome: 'Madeira — pinho (conífera)',
    fonte: 'Hibbeler, apêndice — propriedades médias',
    E: 11000,
    sigmaEscoamento: null,   // madeira não tem escoamento definido
    sigmaRuptura: 40,        // compressão paralela às fibras
    sigmaLimite: 40,
    rho: 500,
    CS: 2.0,                 // variabilidade natural do material
    cor: '#b07f4e',
    render: {
      pernas: '#b07f4e',
      assento: '#b98a58',
      encosto: { tipo: 'painel', cor: '#b07f4e' },
      veios: true
    }
  },

  aco: {
    id: 'aco',
    nome: 'Aço estrutural A36',
    fonte: 'Hibbeler, apêndice — propriedades médias',
    E: 200000,
    sigmaEscoamento: 250,
    sigmaRuptura: 400,
    sigmaLimite: 250,        // dúctil: governa o escoamento
    rho: 7850,
    CS: 1.5,                 // prática usual em estruturas metálicas
    cor: '#7f858c',
    render: {
      pernas: '#7f858c',
      assento: CORES.cinzaEscuro,
      encosto: { tipo: 'ripas', cor: '#6f757c', n: 3, fracao: 0.2 },
      veios: false
    }
  },

  aluminio: {
    id: 'aluminio',
    nome: 'Alumínio 6061-T6',
    fonte: 'Hibbeler, apêndice — propriedades médias',
    E: 70000,
    sigmaEscoamento: 255,
    sigmaRuptura: 310,
    sigmaLimite: 255,        // dúctil: governa o escoamento
    rho: 2700,
    CS: 1.5,
    cor: '#c2c8cf',
    render: {
      pernas: '#c2c8cf',
      assento: CORES.cinzaEscuro,
      encosto: { tipo: 'painel', cor: CORES.vinhoEscuro },
      veios: false
    }
  },

  plastico: {
    id: 'plastico',
    nome: 'Polipropileno (PP)',
    fonte: 'Callister — Ciência e Engenharia de Materiais',
    E: 1500,
    sigmaEscoamento: 35,
    sigmaRuptura: 35,
    sigmaLimite: 35,
    rho: 900,
    CS: 3.0,                 // fluência e forte variação entre lotes
    cor: '#c4bfb6',
    render: {
      pernas: '#c4bfb6',
      assento: '#cdc8bf',
      encosto: { tipo: 'painel', cor: '#c4bfb6' },
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