// Casos "golden" do prompt do José: um por momento do dia (arquitetura.md §4) e a conferência automática.
// A execução real (npm run golden) precisa de ANTHROPIC_API_KEY; a conferência abaixo é testada sem rede.

export interface CasoGolden {
  id: string;
  momento: string;
  /** Instante simulado ("agora" do contexto). */
  agora: string;
  /** Texto da memória (área "sobre_mim") ou texto com a área. */
  memorias: Array<string | { texto: string; area: 'sobre_mim' | 'trabalho' | 'financas' | 'saude' | 'casa' }>;
  metas: string[];
  tarefas: string[];
  mensagem: string;
  modo?: 'padrao' | 'decidir';
  /** Conferências extras da onda 4 (memórias). Sem isto, só valem as regras gerais de tom e tamanho. */
  memoria?: {
    /** A resposta precisa mostrar que usou a memória que já existe (ex.: citar a hora de acordar). */
    usarNaResposta?: RegExp;
    /** Nenhuma sugestão de memória pode repetir o que já existe (testa o texto das sugestões que o modelo pediu). */
    naoRepetir?: RegExp;
    /** O José precisa sugerir de 1 a 3 memórias (o Marco contou algo novo e duradouro). */
    esperaSugestao?: boolean;
  };
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
  {
    // Tarefa 4.4: a memória já existe, então o José a USA e NÃO a sugere de novo.
    id: 'memoria-existente',
    momento: 'Memória que já existe: usar e não sugerir de novo',
    agora: '2026-11-18T06:30:00-03:00',
    memorias: [{ texto: 'Acorda às 6h.', area: 'saude' }],
    metas: [],
    tarefas: [],
    mensagem: 'O que faço hoje?',
    memoria: { usarNaResposta: /acord|\b6\s?h\b|\b6\s?horas\b|\bseis\b|cedo|manhã/i, naoRepetir: /acord|\b6\s?h\b|\bseis\b/i },
  },
  {
    // Tarefa 4.4: fato novo e duradouro → o José sugere memória (texto antes, no máximo 3).
    id: 'memoria-nova',
    momento: 'Fato novo e duradouro: sugerir memória',
    agora: '2026-11-18T09:10:00-03:00',
    memorias: [{ texto: 'Acorda às 6h.', area: 'saude' }],
    metas: [],
    tarefas: [],
    mensagem: 'Eu trabalho melhor de manhã e odeio reunião depois das 17h.',
    memoria: { esperaSugestao: true, naoRepetir: /acord|\b6\s?h\b|\bseis\b/i },
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

/** O que a IA produziu num caso: o texto e as chamadas de ferramenta brutas (antes dos filtros do servidor). */
export interface SaidaGolden {
  texto: string;
  sugestoes: Array<{ nome: string; entrada: unknown }>;
}

/** Confere o caso inteiro: regras gerais da resposta + as de memória do caso (se houver). */
export function avaliarCaso(caso: CasoGolden, saida: SaidaGolden): ResultadoGolden {
  const geral = avaliarResposta(saida.texto);
  const falhas = [...geral.falhas];
  const textosMemoria = saida.sugestoes
    .filter((s) => s.nome === 'sugerir_memoria')
    .map((s) => (s.entrada as { texto?: unknown } | null)?.texto)
    .filter((t): t is string => typeof t === 'string');
  if (saida.sugestoes.some((s) => s.nome !== 'sugerir_memoria')) falhas.push('chamou ferramenta que não está ligada');
  if (saida.sugestoes.length > 3) falhas.push(`mais de 3 sugestões (${saida.sugestoes.length})`);
  const m = caso.memoria;
  if (m?.usarNaResposta && !m.usarNaResposta.test(saida.texto)) falhas.push('não usou a memória que já existe na resposta');
  if (m?.naoRepetir) {
    const repetidas = textosMemoria.filter((t) => m.naoRepetir!.test(t));
    if (repetidas.length) falhas.push(`sugeriu de novo a memória que já existe (${repetidas.length})`);
  }
  if (m?.esperaSugestao) {
    if (textosMemoria.length === 0) falhas.push('não sugeriu nenhuma memória');
    if (!saida.texto.trim()) falhas.push('sugeriu memória sem escrever o texto antes');
  }
  return { ok: falhas.length === 0, falhas, linhas: geral.linhas };
}
