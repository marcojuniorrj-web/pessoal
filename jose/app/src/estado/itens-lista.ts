// O que as listas da aba Tarefas mostram: pendentes (na ordem certa) e concluídas (as mais recentes primeiro).
import { FUSO_PADRAO } from '@compartilhado/datas';
import { ordenarConcluidas, ordenarMaisNovaPrimeiro, ordenarPendentes } from '@compartilhado/ordenacao';
import type { MetaDto } from '../api/metas';
import type { TarefaDto } from '../api/tarefas';

/** Tarefas: pendentes pela regra 5 (dados.md) com "hoje" no fuso do Marco; concluídas por `concluida_em` decrescente. */
export function separarTarefas(lista: TarefaDto[], agora: Date, fuso: string = FUSO_PADRAO) {
  return {
    pendentes: ordenarPendentes(lista.filter((t) => !t.concluida), agora, fuso),
    concluidas: ordenarConcluidas(lista.filter((t) => t.concluida)),
  };
}

/** Metas: ativas, a mais nova primeiro; concluídas por `concluida_em` decrescente. */
export function separarMetas(lista: MetaDto[]) {
  return {
    pendentes: ordenarMaisNovaPrimeiro(lista.filter((m) => m.status === 'ativa')),
    concluidas: ordenarConcluidas(lista.filter((m) => m.status === 'concluida')),
  };
}
