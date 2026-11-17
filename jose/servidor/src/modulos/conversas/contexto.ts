// Montador de contexto (dados.md, regra 1). Ordem fixa, para o cache funcionar:
//   sistema → memórias → metas → tarefas (até 50) → [ponto de cache] → data/hora → 20 mensagens em texto puro.
import { ROTULO_AREA, type AreaMemoria } from '@compartilhado/areas';
import { FUSO_PADRAO } from '@compartilhado/datas';
import type { MensagemIA } from '../../adaptadores/ia/tipos';
import type { Prompt } from '../../adaptadores/ia/prompt';

export const LIMITE_TAREFAS_CONTEXTO = 50;
export const LIMITE_MENSAGENS_CONTEXTO = 20;

export interface MemoriaCtx { texto: string; area: AreaMemoria }
export interface MetaCtx { titulo: string; area: AreaMemoria; prazo: string | null }
export interface TarefaCtx { titulo: string; area: AreaMemoria; prazo: string | null }
export interface SugestaoCtx { tipo: 'tarefa' | 'meta' | 'memoria'; conteudo: string; status: 'pendente' | 'salva' | 'descartada' }
export interface MensagemCtx { autor: 'marco' | 'jose'; texto: string; sugestoes?: SugestaoCtx[] }

export interface EntradaContexto {
  prompt: Prompt;
  /** Liga a seção de sugestões do prompt (ferramentas). */
  sugestoes: boolean;
  modo: 'padrao' | 'decidir';
  memorias: MemoriaCtx[];
  metas: MetaCtx[];
  /** Já na ordem da regra 5; o montador só corta em 50. */
  tarefas: TarefaCtx[];
  agora: Date;
  fuso?: string;
  /** Em ordem cronológica; o montador pega as 20 últimas. */
  mensagens: MensagemCtx[];
}

export interface ContextoMontado {
  sistemaEstavel: string;
  sistemaVolatil: string;
  mensagens: MensagemIA[];
}

const linhaPrazo = (prazo: string | null) => (prazo ? ` (prazo ${prazo})` : '');

/** Texto da linha-resumo de uma sugestão antiga: [sugeriu tarefa "X" — salva]. */
export function resumoSugestao(s: SugestaoCtx): string {
  let titulo = s.conteudo;
  try {
    const c = JSON.parse(s.conteudo) as { titulo?: string; texto?: string };
    titulo = c.titulo ?? c.texto ?? s.conteudo;
  } catch {
    /* mantém o conteúdo bruto */
  }
  return `[sugeriu ${s.tipo} "${titulo}" — ${s.status === 'pendente' ? 'ainda pendente' : s.status}]`;
}

/** "terça-feira, 17 de novembro de 2026, 14:20 (America/Sao_Paulo)". */
export function descreverAgora(agora: Date, fuso: string = FUSO_PADRAO): string {
  const data = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(agora);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(agora);
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  return `${data}, ${hora} (${fuso}). Hoje é ${iso}.`;
}

export function montarContexto(e: EntradaContexto): ContextoMontado {
  const partes: string[] = [e.prompt.base];
  if (e.sugestoes) partes.push(e.prompt.sugestoes);

  partes.push(
    e.memorias.length
      ? `O que você sabe sobre o Marco (memórias):\n${e.memorias.map((m) => `- [${ROTULO_AREA[m.area]}] ${m.texto}`).join('\n')}`
      : 'O que você sabe sobre o Marco (memórias): nada ainda.',
  );
  partes.push(
    e.metas.length
      ? `Metas ativas do Marco:\n${e.metas.map((m) => `- [${ROTULO_AREA[m.area]}] ${m.titulo}${linhaPrazo(m.prazo)}`).join('\n')}`
      : 'Metas ativas do Marco: nenhuma.',
  );
  const tarefas = e.tarefas.slice(0, LIMITE_TAREFAS_CONTEXTO);
  partes.push(
    tarefas.length
      ? `Tarefas pendentes do Marco (as mais urgentes primeiro):\n${tarefas.map((t) => `- [${ROTULO_AREA[t.area]}] ${t.titulo}${linhaPrazo(t.prazo)}`).join('\n')}`
      : 'Tarefas pendentes do Marco: nenhuma.',
  );

  // --- ponto de cache: tudo acima é estável entre mensagens; abaixo muda a cada chamada ---
  const volatil = [`Agora: ${descreverAgora(e.agora, e.fuso)}`];
  if (e.modo === 'decidir') volatil.push(e.prompt.decidir);

  const recentes = e.mensagens.slice(-LIMITE_MENSAGENS_CONTEXTO).map((m) => ({
    papel: (m.autor === 'marco' ? 'user' : 'assistant') as MensagemIA['papel'],
    texto: [m.texto, ...(m.sugestoes ?? []).map(resumoSugestao)].join('\n'),
  }));

  return { sistemaEstavel: partes.join('\n\n'), sistemaVolatil: volatil.join('\n\n'), mensagens: normalizarMensagens(recentes) };
}

/** A API exige começar em "user" e alternar papéis: junta vizinhas do mesmo papel e descarta "assistant" inicial. */
export function normalizarMensagens(msgs: MensagemIA[]): MensagemIA[] {
  const saida: MensagemIA[] = [];
  for (const m of msgs) {
    const ultima = saida[saida.length - 1];
    if (ultima && ultima.papel === m.papel) ultima.texto += `\n\n${m.texto}`;
    else saida.push({ ...m });
  }
  while (saida[0]?.papel === 'assistant') saida.shift();
  return saida;
}
