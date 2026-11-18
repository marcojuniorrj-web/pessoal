// Montador de contexto (dados.md, regra 1). Ordem fixa, para o cache funcionar:
//   sistema → memórias → metas → tarefas (até 50) → [ponto de cache] → data/hora → 20 mensagens em texto puro.
import { ROTULO_AREA, type AreaMemoria } from '@compartilhado/areas';
import { FUSO_PADRAO } from '@compartilhado/datas';
import { grupoDaTarefa } from '@compartilhado/ordenacao';
import type { MensagemIA, TipoSugestao } from '../../adaptadores/ia/tipos';
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
  /** Tipos de sugestão ligados (ferramentas). Vazio: a seção de sugestões do prompt não entra. */
  sugestoes: TipoSugestao[];
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

const NOME_FERRAMENTA: Record<TipoSugestao, string> = { tarefa: 'sugerir_tarefa', meta: 'sugerir_meta', memoria: 'sugerir_memoria' };
const NOME_TIPO: Record<TipoSugestao, string> = { tarefa: 'tarefa', meta: 'meta', memoria: 'memória' };

const lista = (itens: string[], conector: string) => (itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} ${conector} ${itens.at(-1)}`);

/**
 * Monta a seção SUGESTOES só com o que está ligado: {{TIPOS}} e {{FERRAMENTAS}} viram a lista dos tipos ligados e
 * as linhas marcadas com {memoria} ou {tarefa,meta} só ficam se algum desses tipos estiver ligado.
 */
export function secaoSugestoes(modelo: string, ligados: TipoSugestao[]): string {
  const ordem = (['tarefa', 'meta', 'memoria'] as const).filter((t) => ligados.includes(t));
  return modelo
    .split('\n')
    .flatMap((linha) => {
      const m = /^\{([a-z,]+)\}\s*/.exec(linha);
      if (!m) return [linha];
      return m[1]!.split(',').some((t) => ligados.includes(t as TipoSugestao)) ? [`- ${linha.slice(m[0].length)}`] : [];
    })
    .join('\n')
    .replaceAll('{{TIPOS}}', lista(ordem.map((t) => NOME_TIPO[t]), 'ou'))
    .replaceAll('{{FERRAMENTAS}}', lista(ordem.map((t) => `\`${NOME_FERRAMENTA[t]}\``), 'ou'));
}

const linhaPrazo = (prazo: string | null) => (prazo ? ` (prazo ${prazo})` : '');

/** Tarefa com o prazo e, se for o caso, ATRASADA ou hoje (o modelo não calcula datas sozinho). Só muda à meia-noite do fuso do Marco. */
function linhaTarefa(t: TarefaCtx, agora: Date, fuso: string): string {
  const marca = { atrasada: ', ATRASADA', hoje: ', hoje', futura: '', sem_prazo: '' }[grupoDaTarefa(t.prazo, agora, fuso)];
  return `- [${ROTULO_AREA[t.area]}] ${t.titulo}${t.prazo ? ` (prazo ${t.prazo}${marca})` : ''}`;
}

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
  if (e.sugestoes.length) partes.push(secaoSugestoes(e.prompt.sugestoes, e.sugestoes));

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
      ? `Tarefas pendentes do Marco (as mais urgentes primeiro: atrasadas, de hoje, próximas, sem prazo):\n${tarefas.map((t) => linhaTarefa(t, e.agora, e.fuso ?? FUSO_PADRAO)).join('\n')}`
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
