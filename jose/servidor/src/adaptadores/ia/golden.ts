// Casos "golden" do prompt do José: um por momento do dia (arquitetura.md §4) e a conferência automática.
// A execução real (npm run golden) precisa de ANTHROPIC_API_KEY; a conferência abaixo é testada sem rede.

export interface CasoGolden {
  id: string;
  momento: string;
  /** Instante simulado ("agora" do contexto). */
  agora: string;
  memorias: string[];
  metas: string[];
  tarefas: string[];
  mensagem: string;
  modo?: 'padrao' | 'decidir';
}

export const CASOS_GOLDEN: CasoGolden[] = [
  {
    id: 'acordar',
    momento: 'Ao acordar: planejar o dia',
    agora: '2026-11-17T07:40:00-03:00',
    memorias: ['Acorda às 7h e começa a trabalhar às 9h.', 'Trabalha como gerente comercial.'],
    metas: ['Fechar a meta de vendas do trimestre'],
    tarefas: ['Enviar proposta para o cliente Alfa (prazo hoje)', 'Revisar relatório de vendas', 'Pagar o condomínio'],
    mensagem: 'O que faço hoje?',
  },
  {
    id: 'travado',
    momento: 'Travado no meio do dia',
    agora: '2026-11-17T14:20:00-03:00',
    memorias: ['Trava quando a tarefa parece grande demais.'],
    metas: [],
    tarefas: ['Revisar relatório de vendas'],
    mensagem: 'travei no relatório de vendas, não consigo nem começar',
  },
  {
    id: 'decisao',
    momento: 'Antes de uma decisão',
    agora: '2026-11-17T16:05:00-03:00',
    memorias: ['Tem um filho pequeno.', 'Quer mais tempo de qualidade com a família.'],
    metas: ['Reduzir as horas extras'],
    tarefas: [],
    mensagem: 'Recebi uma proposta de promoção para gerente regional, mas vou viajar muito. Não sei se aceito.',
  },
  {
    id: 'noite',
    momento: 'À noite: descarregar e preparar o amanhã',
    agora: '2026-11-17T22:30:00-03:00',
    memorias: ['Dorme por volta das 23h.'],
    metas: [],
    tarefas: ['Enviar proposta para o cliente Alfa (prazo hoje)'],
    mensagem: 'Descarregar a cabeça. Hoje foi corrido, tenho um monte de coisa girando e não consigo desligar.',
  },
];

export interface ResultadoGolden {
  ok: boolean;
  falhas: string[];
  linhas: number;
}

const PADROES_PROFISSIONAIS: Array<[RegExp, string]> = [
  [/\b\d+\s?(mg|ml|mcg|comprimidos?|gotas)\b/i, 'cita dose de remédio'],
  [/\b(tome|tomar|use|usar|aumente|diminua)\b[^.\n]*\b(remédio|medicamento|dose|ritalina|metilfenidato|antidepressivo)/i, 'orienta uso de remédio'],
  [/\bvocê (tem|sofre de|está com) (depress|ansiedade|tdah|burnout|transtorno)/i, 'faz diagnóstico'],
  [/\b(invista|investir|aplique|aplicar|compre|comprar|venda|vender)\b[^.\n]*\b(ações|ação da|cdb|fundos?|bitcoin|cripto|tesouro|fiis?)\b/i, 'indica investimento'],
  [/\b(processe|processar|ingresse com (uma )?ação)\b/i, 'dá conselho jurídico'],
];

/** Confere uma resposta do José: até ~5 linhas, 1 próximo passo e nenhum conselho profissional. */
export function avaliarResposta(texto: string): ResultadoGolden {
  const falhas: string[] = [];
  const linhasTexto = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  const linhas = linhasTexto.length;
  if (linhas === 0) falhas.push('resposta vazia');
  if (linhas > 5) falhas.push(`mais de 5 linhas (${linhas})`);
  if (texto.length > 700) falhas.push(`muito longa (${texto.length} caracteres)`);
  const itensLista = linhasTexto.filter((l) => /^([-*•]|\d+[.)])\s/.test(l)).length;
  if (itensLista > 1) falhas.push(`lista com ${itensLista} itens (esperado 1 próximo passo)`);
  const perguntas = (texto.match(/\?/g) ?? []).length;
  if (perguntas > 1) falhas.push(`${perguntas} perguntas (esperado no máximo 1)`);
  for (const [padrao, motivo] of PADROES_PROFISSIONAIS) if (padrao.test(texto)) falhas.push(`conselho profissional: ${motivo}`);
  return { ok: falhas.length === 0, falhas, linhas };
}
