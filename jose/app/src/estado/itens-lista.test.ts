import { describe, expect, it } from 'vitest';
import type { MetaDto } from '../api/metas';
import type { TarefaDto } from '../api/tarefas';
import { separarMetas, separarTarefas } from './itens-lista';

const sp = (iso: string) => new Date(`${iso}-03:00`);
const t = (id: string, prazo: string | null, criada: string, extra: Partial<TarefaDto> = {}): TarefaDto => ({
  id, titulo: id, area: 'trabalho', prazo, concluida: false, concluida_em: null, origem: 'manual', criada_em: criada, ...extra,
});
const m = (id: string, criada: string, extra: Partial<MetaDto> = {}): MetaDto => ({ id, titulo: id, area: 'saude', prazo: null, status: 'ativa', concluida_em: null, origem: 'manual', criada_em: criada, ...extra });
const ids = (l: Array<{ id: string }>) => l.map((x) => x.id);

describe('separarTarefas', () => {
  const lista = [
    t('sem', null, '2026-11-01T00:00:00Z'),
    t('futura', '2026-11-25', '2026-11-01T00:00:00Z'),
    t('hoje', '2026-11-17', '2026-11-01T00:00:00Z'),
    t('atrasada', '2026-11-10', '2026-11-01T00:00:00Z'),
    t('feita-1', null, '2026-11-01T00:00:00Z', { concluida: true, concluida_em: '2026-11-15T10:00:00Z' }),
    t('feita-2', null, '2026-11-01T00:00:00Z', { concluida: true, concluida_em: '2026-11-16T10:00:00Z' }),
  ];
  it('pendentes na ordem da regra 5 e concluídas da mais recente para a mais antiga', () => {
    const r = separarTarefas(lista, sp('2026-11-17T10:00:00'));
    expect(ids(r.pendentes)).toEqual(['atrasada', 'hoje', 'futura', 'sem']);
    expect(ids(r.concluidas)).toEqual(['feita-2', 'feita-1']);
  });
  it('a ordem muda quando o dia vira (23h59 → 00h01 em São Paulo): a de hoje passa a atrasada e entra na disputa pela mais nova', () => {
    const l = [t('a-amanha', '2026-11-18', '2026-11-01T00:00:00Z'), t('b-hoje', '2026-11-17', '2026-11-09T00:00:00Z'), t('c-ontem', '2026-11-16', '2026-11-02T00:00:00Z')];
    expect(ids(separarTarefas(l, sp('2026-11-17T23:59:00')).pendentes)).toEqual(['c-ontem', 'b-hoje', 'a-amanha']);
    expect(ids(separarTarefas(l, sp('2026-11-18T00:01:00')).pendentes)).toEqual(['b-hoje', 'c-ontem', 'a-amanha']);
  });
  it('desfazer a conclusão devolve a tarefa ao lugar certo (pela data, não pela posição no array)', () => {
    const l = [t('a', '2026-11-10', '2026-11-01T00:00:00Z', { concluida: true, concluida_em: '2026-11-16T10:00:00Z' }), t('b', null, '2026-11-02T00:00:00Z')];
    expect(ids(separarTarefas(l, sp('2026-11-17T10:00:00')).pendentes)).toEqual(['b']);
    const reaberta = l.map((x) => (x.id === 'a' ? { ...x, concluida: false, concluida_em: null } : x));
    expect(ids(separarTarefas(reaberta, sp('2026-11-17T10:00:00')).pendentes)).toEqual(['a', 'b']);
  });
});

describe('separarMetas', () => {
  it('ativas, a mais nova primeiro; concluídas da mais recente para a mais antiga', () => {
    const r = separarMetas([
      m('velha', '2026-11-01T00:00:00Z'), m('nova', '2026-11-05T00:00:00Z'),
      m('feita-1', '2026-11-01T00:00:00Z', { status: 'concluida', concluida_em: '2026-11-10T00:00:00Z' }),
      m('feita-2', '2026-11-01T00:00:00Z', { status: 'concluida', concluida_em: '2026-11-12T00:00:00Z' }),
    ]);
    expect(ids(r.pendentes)).toEqual(['nova', 'velha']);
    expect(ids(r.concluidas)).toEqual(['feita-2', 'feita-1']);
  });
});
