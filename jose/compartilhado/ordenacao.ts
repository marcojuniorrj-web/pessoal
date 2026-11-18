// Ordenação das tarefas (dados.md, regra 5). Função pura: o servidor e o app usam a mesma, com "agora" e fuso injetados.
//   1. atrasadas (prazo antes de hoje);  2. de hoje;  3. prazo futuro, do mais próximo ao mais distante;  4. sem prazo.
// Em empate (mesmo grupo, ou mesmo prazo futuro), a mais nova vem primeiro (criada_em decrescente).
// A ordenação é estável: se a entrada já vem com a mais nova primeiro (ex.: rowid decrescente), um empate total mantém essa ordem.
import { FUSO_PADRAO, hoje } from './datas';

export type GrupoTarefa = 'atrasada' | 'hoje' | 'futura' | 'sem_prazo';

export function grupoDaTarefa(prazo: string | null | undefined, agora: Date, fuso: string = FUSO_PADRAO): GrupoTarefa {
  if (!prazo) return 'sem_prazo';
  const dia = hoje(agora, fuso);
  if (prazo < dia) return 'atrasada';
  return prazo === dia ? 'hoje' : 'futura';
}

const POSICAO: Record<GrupoTarefa, number> = { atrasada: 0, hoje: 1, futura: 2, sem_prazo: 3 };

const instante = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/** Pendentes na ordem da regra 5 (não altera o array recebido). */
export function ordenarPendentes<T extends { prazo: string | null; criada_em: string }>(tarefas: readonly T[], agora: Date, fuso: string = FUSO_PADRAO): T[] {
  const dia = hoje(agora, fuso);
  const chave = (t: T) => POSICAO[!t.prazo ? 'sem_prazo' : t.prazo < dia ? 'atrasada' : t.prazo === dia ? 'hoje' : 'futura'];
  return [...tarefas].sort((a, b) => {
    const g = chave(a) - chave(b);
    if (g !== 0) return g;
    // Só as futuras se ordenam pelo prazo (mais próximo primeiro).
    if (chave(a) === POSICAO.futura && a.prazo !== b.prazo) return a.prazo! < b.prazo! ? -1 : 1;
    return instante(b.criada_em) - instante(a.criada_em);
  });
}

/** Concluídas: a mais recente primeiro (`concluida_em` decrescente; empate: a criada por último primeiro). */
export function ordenarConcluidas<T extends { concluida_em: string | null; criada_em: string }>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => instante(b.concluida_em ?? '') - instante(a.concluida_em ?? '') || instante(b.criada_em) - instante(a.criada_em));
}
