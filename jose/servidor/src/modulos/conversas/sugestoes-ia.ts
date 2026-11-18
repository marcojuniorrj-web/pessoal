// Regras para as sugestões que a IA propõe por ferramenta (dados.md, regra 2): valida com Zod, limita a 3 por resposta,
// ignora ferramenta desligada e não repete memória que já existe. Função pura: quem chama grava e registra o log.
import { conteudoSugestaoSchema, prazoSchema } from '@compartilhado/schemas';
import type { TipoSugestao } from '../../adaptadores/ia/tipos';

export const MAX_SUGESTOES_POR_RESPOSTA = 3;

export const TIPO_FERRAMENTA: Record<string, TipoSugestao> = { sugerir_tarefa: 'tarefa', sugerir_meta: 'meta', sugerir_memoria: 'memoria' };

export interface Proposta {
  tipo: TipoSugestao;
  conteudo: unknown;
}

export type ResultadoSugestao =
  | { ok: true; proposta: Proposta }
  /** `campos`: só os nomes dos campos inválidos (o log nunca leva o conteúdo). */
  | { ok: false; motivo: 'ferramenta_desconhecida' | 'desligada' | 'invalida' | 'acima_do_limite' | 'memoria_repetida' | 'item_repetido'; campos?: string[] };

/** Minúsculas, sem acento e sem pontuação: "Acorda às 6h." e "acorda as 6h" são a mesma memória. */
export function normalizarTexto(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Prazo mal formado ("sexta", "2026-02-31") não derruba a sugestão: o cartão vem sem prazo e o Marco escolhe no seletor.
 * Só mexe em tarefa e meta, e só no prazo (o resto continua valendo como o Zod decidir).
 */
function semPrazoInvalido(tipo: TipoSugestao, entrada: unknown): unknown {
  if (tipo === 'memoria' || entrada === null || typeof entrada !== 'object' || Array.isArray(entrada)) return entrada;
  const { prazo, ...resto } = entrada as Record<string, unknown>;
  if (prazo === undefined || prazo === null) return entrada;
  return prazoSchema.safeParse(prazo).success ? entrada : resto;
}

export function avaliarSugestao(
  nome: string,
  entrada: unknown,
  ctx: { ligadas: TipoSugestao[]; memorias: Array<{ texto: string }>; tarefas?: Array<{ titulo: string }>; metas?: Array<{ titulo: string }>; aceitas: Proposta[]; /** Padrão 3; a chamada final das boas-vindas aceita mais. */ maximo?: number },
): ResultadoSugestao {
  const tipo = TIPO_FERRAMENTA[nome];
  if (!tipo) return { ok: false, motivo: 'ferramenta_desconhecida' };
  if (!ctx.ligadas.includes(tipo)) return { ok: false, motivo: 'desligada' };
  const valido = conteudoSugestaoSchema[tipo].safeParse(semPrazoInvalido(tipo, entrada));
  if (!valido.success) return { ok: false, motivo: 'invalida', campos: [...new Set(valido.error.issues.map((i) => i.path.join('.') || '(raiz)'))] };
  if (ctx.aceitas.length >= (ctx.maximo ?? MAX_SUGESTOES_POR_RESPOSTA)) return { ok: false, motivo: 'acima_do_limite' };
  if (tipo === 'memoria') {
    const texto = normalizarTexto((valido.data as { texto: string }).texto);
    const existentes = [...ctx.memorias.map((m) => m.texto), ...ctx.aceitas.filter((a) => a.tipo === 'memoria').map((a) => (a.conteudo as { texto: string }).texto)];
    if (existentes.some((e) => normalizarTexto(e) === texto)) return { ok: false, motivo: 'memoria_repetida' };
  }
  if (tipo === 'tarefa' || tipo === 'meta') {
    // Não repete o que já está na lista (pendente/ativa) nem o que já foi proposto nesta resposta.
    const titulo = normalizarTexto((valido.data as { titulo: string }).titulo);
    const existentes = [
      ...((tipo === 'tarefa' ? ctx.tarefas : ctx.metas) ?? []).map((i) => i.titulo),
      ...ctx.aceitas.filter((a) => a.tipo === tipo).map((a) => (a.conteudo as { titulo: string }).titulo),
    ];
    if (existentes.some((e) => normalizarTexto(e) === titulo)) return { ok: false, motivo: 'item_repetido' };
  }
  return { ok: true, proposta: { tipo, conteudo: valido.data } };
}
