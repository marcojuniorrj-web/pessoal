import { describe, expect, it } from 'vitest';
import type { MemoriaDto } from '../api/memorias';
import { agruparMemorias, formatarDataMemoria, maisNovaPrimeiro } from './memorias';

const m = (id: string, area: MemoriaDto['area'], criada_em: string, texto = id): MemoriaDto => ({ id, texto, area, origem: 'manual', criada_em, atualizada_em: null });

describe('agruparMemorias', () => {
  it('agrupa por área na ordem da tela, esconde áreas vazias e põe as mais novas primeiro', () => {
    const grupos = agruparMemorias([
      m('a', 'casa', '2026-11-01T10:00:00Z'),
      m('b', 'sobre_mim', '2026-11-02T10:00:00Z'),
      m('c', 'casa', '2026-11-03T10:00:00Z'),
      m('d', 'saude', '2026-11-04T10:00:00Z'),
    ]);
    expect(grupos.map((g) => [g.area, g.rotulo, g.itens.map((i) => i.id)])).toEqual([
      ['sobre_mim', 'Sobre mim', ['b']],
      ['saude', 'Saúde e rotina', ['d']],
      ['casa', 'Família e casa', ['c', 'a']],
    ]);
  });
  it('lista vazia → nenhum grupo; empate de data desempata pelo id (mais novo primeiro)', () => {
    expect(agruparMemorias([])).toEqual([]);
    expect([m('1', 'casa', 'x'), m('2', 'casa', 'x')].sort(maisNovaPrimeiro).map((i) => i.id)).toEqual(['2', '1']);
  });
  it('não altera a lista recebida', () => {
    const lista = [m('a', 'casa', '2026-11-01T10:00:00Z'), m('b', 'casa', '2026-11-02T10:00:00Z')];
    agruparMemorias(lista);
    expect(lista.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('formatarDataMemoria', () => {
  it('usa o fuso do Marco: 02:00 UTC ainda é o dia anterior em São Paulo', () => {
    expect(formatarDataMemoria('2026-11-18T02:00:00Z', 'America/Sao_Paulo')).toBe('17/11/2026');
    expect(formatarDataMemoria('2026-11-18T12:00:00Z', 'America/Sao_Paulo')).toBe('18/11/2026');
    expect(formatarDataMemoria('2026-11-18T02:00:00Z', 'UTC')).toBe('18/11/2026');
  });
});
