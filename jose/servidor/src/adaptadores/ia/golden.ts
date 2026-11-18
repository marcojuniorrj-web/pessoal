// Casos "golden" do prompt do José: um por momento do dia (arquitetura.md §4) e a conferência automática.
// A execução real (npm run golden) precisa de ANTHROPIC_API_KEY; a conferência abaixo é testada sem rede.
import { LIMITE_MEMORIA } from '@compartilhado/schemas';
import { MAX_SUGESTOES_BOAS_VINDAS } from '@compartilhado/boasvindas';
import { normalizarTexto } from '../../modulos/conversas/sugestoes-ia';
import type { TipoSugestao } from './tipos';

/** Ferramentas ligadas no app (onda 5): memória, tarefa e meta. */
export const SUGESTOES_LIGADAS: TipoSugestao[] = ['memoria', 'tarefa', 'meta'];
const NOME_FERRAMENTA: Record<TipoSugestao, string> = { tarefa: 'sugerir_tarefa', meta: 'sugerir_meta', memoria: 'sugerir_memoria' };

export interface TarefaGolden {
  titulo: string;
  /** AAAA-MM-DD */
  prazo?: string;
  area?: 'trabalho' | 'financas' | 'saude' | 'casa';
}

export interface CasoGolden {
  id: string;
  momento: string;
  /** Instante simulado ("agora" do contexto). */
  agora: string;
  /** Texto da memória (área "sobre_mim") ou texto com a área. */
  memorias: Array<string | { texto: string; area: 'sobre_mim' | 'trabalho' | 'financas' | 'saude' | 'casa' }>;
  metas: string[];
  tarefas: Array<string | TarefaGolden>;
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
  /** Conferências da onda 5 (tarefas e metas). */
  cartoes?: {
    /** Quantas chamadas de sugerir_tarefa são esperadas (e, se houver `prazo`, ao menos uma precisa trazer exatamente essa data). */
    tarefas?: { min?: number; max?: number; prazo?: string };
    /** `espera`: ao menos um sugerir_meta; `nenhuma`: nenhum. `prazo`: se a meta trouxer prazo, ele precisa bater. */
    meta?: { quantidade: 'espera' | 'nenhuma'; prazo?: RegExp };
    /** Nenhum cartão (de nenhum tipo) pode ter título/texto que bata (ex.: preocupação virando cartão, tarefa que já existe). */
    semCartaoDe?: { padrao: RegExp; motivo: string };
  };
  /** A resposta precisa citar `primeiro` antes de qualquer um de `depois` (ex.: a tarefa atrasada antes das outras). */
  prioridade?: { primeiro: RegExp; depois: RegExp[] };
  /** Mensagens que já existem na conversa antes de `mensagem` (ex.: as perguntas e respostas das boas-vindas). */
  historico?: Array<{ autor: 'marco' | 'jose'; texto: string }>;
  /**
   * Chamada final das boas-vindas (6.1): só `sugerir_memoria` fica ligada, com até 8 sugestões. Cada padrão de `cobrir` precisa
   * aparecer em ao menos uma memória (coerência com as respostas); nenhuma memória pode repetir uma existente.
   */
  boasVindas?: { min: number; cobrir: RegExp[] };
}

export const CASOS_GOLDEN: CasoGolden[] = [
  {
    id: 'acordar',
    momento: 'Ao acordar: planejar o dia',
    agora: '2026-11-17T07:40:00-03:00',
    memorias: ['Acorda às 7h e começa a trabalhar às 9h.', 'Trabalha como gerente comercial.'],
    metas: ['Fechar a meta de vendas do trimestre'],
    tarefas: [{ titulo: 'Enviar proposta para o cliente Alfa', prazo: '2026-11-17' }, 'Revisar relatório de vendas', 'Pagar o condomínio'],
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
    tarefas: [{ titulo: 'Enviar proposta para o cliente Alfa', prazo: '2026-11-17' }],
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
  {
    // Tarefa 5.4: com 3 tarefas e uma atrasada, "o que faço hoje?" começa pela atrasada (a lista vem marcada ATRASADA no contexto).
    id: 'tarefa-atrasada',
    momento: 'O que faço hoje? com uma tarefa atrasada: prioriza a atrasada',
    agora: '2026-11-17T07:40:00-03:00',
    memorias: ['Acorda às 7h e começa a trabalhar às 9h.'],
    metas: [],
    tarefas: [
      { titulo: 'Enviar a proposta para o cliente Alfa', prazo: '2026-11-14' },
      { titulo: 'Revisar o relatório de vendas', prazo: '2026-11-20' },
      { titulo: 'Pagar o condomínio' },
    ],
    mensagem: 'O que faço hoje?',
    prioridade: { primeiro: /proposta|alfa/i, depois: [/relat[óo]rio/i, /condom[ií]nio/i] },
    cartoes: { semCartaoDe: { padrao: /proposta|alfa|relat[óo]rio|condom[ií]nio/i, motivo: 'sugeriu de novo uma tarefa que já está na lista' } },
  },
  {
    // Tarefa 5.1: "sexta" vira AAAA-MM-DD a partir da data de hoje do contexto (terça, 17/11 → sexta, 20/11).
    id: 'tarefa-prazo-relativo',
    momento: 'Tarefa com prazo relativo: "até sexta" vira a data de sexta',
    agora: '2026-11-17T09:00:00-03:00',
    memorias: ['Trabalha como gerente comercial.'],
    metas: [],
    tarefas: [],
    mensagem: 'Preciso enviar a proposta para o cliente Alfa até sexta.',
    cartoes: { tarefas: { min: 1, max: 1, prazo: '2026-11-20' }, meta: { quantidade: 'nenhuma' } },
  },
  {
    // Tarefa 5.1: objetivo maior vira meta (não tarefa do dia).
    id: 'meta',
    momento: 'Objetivo maior: sugere meta',
    agora: '2026-11-17T20:00:00-03:00',
    memorias: [],
    metas: [],
    tarefas: [],
    mensagem: 'Quero correr uma meia-maratona ano que vem.',
    cartoes: { meta: { quantidade: 'espera', prazo: /^2027-\d{2}-\d{2}$/ } },
  },
  {
    // Ajuste de coaching: "travei" usa pergunta focada na solução, 1 por vez, sem caçar a causa nem dar ordem.
    id: 'travado-solucao',
    momento: 'Travado: pergunta focada na solução (ajuste de coaching)',
    agora: '2026-11-18T10:40:00-03:00',
    memorias: ['Foco em resultados: direto, competitivo e rápido; não gosta de ser controlado.', 'Tende a analisar demais antes de agir.'],
    metas: [],
    tarefas: ['Montar a apresentação do lançamento'],
    mensagem: 'travei na apresentação do lançamento, fico pensando em como começar e não saio do lugar',
  },
  {
    // Ajuste de coaching: objetivo em forma de queixa vira meta positiva.
    id: 'meta-positiva',
    momento: 'Objetivo como queixa: reformula de forma positiva (ajuste de coaching)',
    agora: '2026-11-18T20:00:00-03:00',
    memorias: [],
    metas: [],
    tarefas: [],
    mensagem: 'Quero parar de perder cliente por demorar a responder. Anota isso como meta.',
    cartoes: {
      meta: { quantidade: 'espera' },
      semCartaoDe: { padrao: /^\s*(parar de|deixar de|evitar)\b/i, motivo: 'a meta ficou negativa (parar de/deixar de/evitar); deve ser positiva e concreta' },
    },
  },
  {
    // Tarefa 5.7 (jornada "À noite"): só ações viram cartão (no máximo 3); ideias e preocupações ficam só no texto.
    id: 'descarregar',
    momento: 'À noite: descarregar a cabeça (no máximo 3 cartões; preocupação só no texto)',
    agora: '2026-11-17T22:30:00-03:00',
    memorias: ['Dorme por volta das 23h.'],
    metas: [],
    tarefas: [],
    mensagem: 'Descarregar a cabeça: ligar pro banco, revisar a proposta do cliente até sexta, quero correr uma meia-maratona ano que vem, tô preocupado com o caixa.',
    cartoes: {
      tarefas: { min: 1, max: 3, prazo: '2026-11-20' },
      semCartaoDe: { padrao: /preocup|ansios|medo|caixa/i, motivo: 'transformou a preocupação em cartão (ideias e preocupações ficam só no texto)' },
    },
  },
  {
    // Tarefa 6.1: fim das boas-vindas (refazendo, com memórias que já existem). As 5 respostas viram memórias coerentes,
    // sem repetir "Acorda às 6h." e "Trabalha como gerente comercial.": só o que é novo ou mudou (dormir às 22h30, a meia-maratona, o que trava).
    id: 'boasvindas-memorias',
    momento: 'Fim das boas-vindas: as 5 respostas viram memórias (sem repetir as que já existem)',
    agora: '2026-11-18T19:30:00-03:00',
    memorias: [{ texto: 'Acorda às 6h.', area: 'saude' }, { texto: 'Trabalha como gerente comercial.', area: 'trabalho' }],
    metas: [],
    tarefas: [],
    historico: [
      { autor: 'jose', texto: 'Oi, Marco, eu sou o José. Vou fazer 5 perguntas rápidas para te conhecer. Primeira: como é um dia normal da sua rotina?' },
      { autor: 'marco', texto: 'Acordo às 6h, treino e às 8h já estou trabalhando. Fecho o dia às 19h e fico com a família.' },
      { autor: 'jose', texto: 'Quais áreas da sua vida você quer organizar comigo? Pode escolher mais de uma.' },
      { autor: 'marco', texto: 'Trabalho, saúde e rotina, família e casa' },
      { autor: 'jose', texto: 'Quais são as suas metas principais para os próximos meses?' },
      { autor: 'marco', texto: 'Bater a meta de vendas do trimestre e correr uma meia-maratona em 2027.' },
      { autor: 'jose', texto: 'O que mais trava você hoje?' },
      { autor: 'marco', texto: 'Começar o que é grande demais: fico enrolando.' },
      { autor: 'jose', texto: 'Última: que horas você costuma acordar e dormir?' },
    ],
    mensagem: 'Acordo às 6h e durmo às 22h30.',
    boasVindas: { min: 2, cobrir: [/22\s?h\s?30|22:30/, /meia[- ]maratona/i, /come[çc]ar|enrol|grande demais|trav/i] },
  },
];

/** Conferências da chamada final das boas-vindas sobre os textos das memórias sugeridas. */
function conferirBoasVindas(caso: CasoGolden, textos: string[]): string[] {
  const falhas: string[] = [];
  const b = caso.boasVindas!;
  if (textos.length < b.min) falhas.push(`sugeriu ${textos.length} memória(s), esperava ao menos ${b.min}`);
  if (textos.some((t) => t.length > LIMITE_MEMORIA)) falhas.push(`memória com mais de ${LIMITE_MEMORIA} caracteres`);
  const normais = textos.map(normalizarTexto);
  if (new Set(normais).size < normais.length) falhas.push('memórias repetidas entre si');
  const existentes = caso.memorias.map((m) => normalizarTexto(typeof m === 'string' ? m : m.texto));
  const repetidas = normais.filter((t) => existentes.includes(t));
  if (repetidas.length) falhas.push(`sugeriu de novo memória que já existe (${repetidas.length})`);
  for (const padrao of b.cobrir) if (!textos.some((t) => padrao.test(t))) falhas.push(`nenhuma memória cobre ${padrao.source}`);
  return falhas;
}

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

/** Texto (título ou memória) de uma chamada de ferramenta. */
const textoDe = (s: { entrada: unknown }): string => {
  const e = s.entrada as { titulo?: unknown; texto?: unknown } | null;
  return typeof e?.titulo === 'string' ? e.titulo : typeof e?.texto === 'string' ? e.texto : '';
};

/** Confere o caso inteiro: regras gerais da resposta + as de memória, tarefa e meta do caso (se houver). */
export function avaliarCaso(caso: CasoGolden, saida: SaidaGolden): ResultadoGolden {
  const geral = avaliarResposta(saida.texto);
  const falhas = [...geral.falhas];
  const textosMemoria = saida.sugestoes.filter((s) => s.nome === NOME_FERRAMENTA.memoria).map(textoDe).filter(Boolean);
  const permitidas = (caso.boasVindas ? (['memoria'] as TipoSugestao[]) : SUGESTOES_LIGADAS).map((t) => NOME_FERRAMENTA[t]);
  if (saida.sugestoes.some((s) => !permitidas.includes(s.nome))) falhas.push('chamou ferramenta que não está ligada');
  const limite = caso.boasVindas ? MAX_SUGESTOES_BOAS_VINDAS : 3;
  if (saida.sugestoes.length > limite) falhas.push(`mais de ${limite} sugestões (${saida.sugestoes.length})`);
  if (caso.boasVindas) falhas.push(...conferirBoasVindas(caso, textosMemoria));
  if (saida.sugestoes.length && !saida.texto.trim()) falhas.push('sugeriu sem escrever o texto antes');
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

  const c = caso.cartoes;
  const tarefas = saida.sugestoes.filter((s) => s.nome === NOME_FERRAMENTA.tarefa);
  const metas = saida.sugestoes.filter((s) => s.nome === NOME_FERRAMENTA.meta);
  if (c?.tarefas) {
    const { min, max, prazo } = c.tarefas;
    if (min !== undefined && tarefas.length < min) falhas.push(`sugeriu ${tarefas.length} tarefa(s), esperava ao menos ${min}`);
    if (max !== undefined && tarefas.length > max) falhas.push(`sugeriu ${tarefas.length} tarefa(s), esperava no máximo ${max}`);
    if (prazo && !tarefas.some((t) => (t.entrada as { prazo?: unknown } | null)?.prazo === prazo)) falhas.push(`nenhuma tarefa com o prazo ${prazo}`);
  }
  if (c?.meta?.quantidade === 'espera' && metas.length === 0) falhas.push('não sugeriu nenhuma meta');
  if (c?.meta?.quantidade === 'nenhuma' && metas.length > 0) falhas.push(`sugeriu meta (${metas.length}) para uma ação do dia`);
  if (c?.meta?.prazo) {
    const ruins = metas.map((x) => (x.entrada as { prazo?: unknown } | null)?.prazo).filter((p) => typeof p === 'string' && !c.meta!.prazo!.test(p));
    if (ruins.length) falhas.push(`prazo da meta fora do esperado (${ruins.join(', ')})`);
  }
  if (c?.semCartaoDe) {
    const ruins = saida.sugestoes.filter((s) => c.semCartaoDe!.padrao.test(textoDe(s)));
    if (ruins.length) falhas.push(`${c.semCartaoDe.motivo} (${ruins.length})`);
  }
  const p = caso.prioridade;
  if (p) {
    const alvo = saida.texto.search(p.primeiro);
    if (alvo < 0) falhas.push('não citou a tarefa atrasada');
    else for (const outra of p.depois) {
      const i = saida.texto.search(outra);
      if (i >= 0 && i < alvo) falhas.push(`citou outra tarefa antes da atrasada (${outra.source})`);
    }
  }
  return { ok: falhas.length === 0, falhas, linhas: geral.linhas };
}
