import { describe, expect, it } from 'vitest';
import { grupoDaTarefa, ordenarConcluidas, ordenarPendentes } from './ordenacao';

// São Paulo é UTC-3 (sem horário de verão desde 2019).
const sp = (iso: string) => new Date(`${iso}-03:00`);
const t = (id: string, prazo: string | null, criada_em: string) => ({ id, prazo, criada_em });
const ids = (l: Array<{ id: string }>) => l.map((x) => x.id);
const AGORA = sp('2026-11-17T10:00:00'); // terça-feira; hoje = 2026-11-17

describe('grupoDaTarefa', () => {
  it('atrasada (antes de hoje), hoje, futura e sem prazo', () => {
    expect(grupoDaTarefa('2026-11-16', AGORA)).toBe('atrasada');
    expect(grupoDaTarefa('2026-11-17', AGORA)).toBe('hoje');
    expect(grupoDaTarefa('2026-11-18', AGORA)).toBe('futura');
    expect(grupoDaTarefa(null, AGORA)).toBe('sem_prazo');
    expect(grupoDaTarefa(undefined, AGORA)).toBe('sem_prazo');
  });
  it('vira à meia-noite de São Paulo: 23h59 ainda é hoje; 00h01 já é o dia seguinte', () => {
    expect(grupoDaTarefa('2026-11-17', sp('2026-11-17T23:59:00'))).toBe('hoje');
    expect(grupoDaTarefa('2026-11-17', sp('2026-11-18T00:01:00'))).toBe('atrasada');
    expect(grupoDaTarefa('2026-11-18', sp('2026-11-17T23:59:00'))).toBe('futura');
    expect(grupoDaTarefa('2026-11-18', sp('2026-11-18T00:01:00'))).toBe('hoje');
  });
  it('usa o fuso do usuário, não o do servidor (UTC)', () => {
    // 23h30 em SP de 17/11 já é 02h30 de 18/11 em UTC e 11h30 de 18/11 em Tóquio
    const noite = sp('2026-11-17T23:30:00');
    expect(grupoDaTarefa('2026-11-17', noite, 'America/Sao_Paulo')).toBe('hoje');
    expect(grupoDaTarefa('2026-11-17', noite, 'UTC')).toBe('atrasada');
    expect(grupoDaTarefa('2026-11-17', noite, 'Asia/Tokyo')).toBe('atrasada');
  });
});

describe('ordenarPendentes (regra 5)', () => {
  it('atrasadas, de hoje, futuras (mais próxima primeiro) e sem prazo', () => {
    const l = [t('sem', null, '2026-11-01T00:00:00Z'), t('longe', '2026-12-25', '2026-11-01T00:00:00Z'), t('hoje', '2026-11-17', '2026-11-01T00:00:00Z'), t('perto', '2026-11-18', '2026-11-01T00:00:00Z'), t('atrasada', '2026-11-10', '2026-11-01T00:00:00Z')];
    expect(ids(ordenarPendentes(l, AGORA))).toEqual(['atrasada', 'hoje', 'perto', 'longe', 'sem']);
  });
  it('empate entre atrasadas: a mais nova primeiro (criada_em decrescente), seja qual for o prazo', () => {
    const l = [t('velha-prazo-antigo', '2026-11-01', '2026-11-02T00:00:00Z'), t('nova-prazo-recente', '2026-11-16', '2026-11-05T00:00:00Z'), t('meio', '2026-11-10', '2026-11-03T00:00:00Z')];
    expect(ids(ordenarPendentes(l, AGORA))).toEqual(['nova-prazo-recente', 'meio', 'velha-prazo-antigo']);
  });
  it('empate entre as de hoje: a mais nova primeiro', () => {
    const l = [t('a', '2026-11-17', '2026-11-10T08:00:00Z'), t('c', '2026-11-17', '2026-11-12T08:00:00Z'), t('b', '2026-11-17', '2026-11-11T08:00:00Z')];
    expect(ids(ordenarPendentes(l, AGORA))).toEqual(['c', 'b', 'a']);
  });
  it('futuras com o mesmo prazo: a mais nova primeiro; prazos diferentes: o mais próximo antes, mesmo que seja a mais velha', () => {
    const l = [t('x-velha', '2026-11-20', '2026-11-01T00:00:00Z'), t('y-nova-longe', '2026-11-25', '2026-11-15T00:00:00Z'), t('x-nova', '2026-11-20', '2026-11-09T00:00:00Z')];
    expect(ids(ordenarPendentes(l, AGORA))).toEqual(['x-nova', 'x-velha', 'y-nova-longe']);
  });
  it('sem prazo: a mais nova primeiro', () => {
    const l = [t('a', null, '2026-11-01T00:00:00Z'), t('b', null, '2026-11-03T00:00:00Z'), t('c', null, '2026-11-02T00:00:00Z')];
    expect(ids(ordenarPendentes(l, AGORA))).toEqual(['b', 'c', 'a']);
  });
  it('empate total (mesmo grupo e mesma criada_em): mantém a ordem recebida (estável)', () => {
    const l = [t('1', null, '2026-11-01T00:00:00Z'), t('2', null, '2026-11-01T00:00:00Z'), t('3', null, '2026-11-01T00:00:00Z')];
    expect(ids(ordenarPendentes(l, AGORA))).toEqual(['1', '2', '3']);
  });
  it('compara os instantes, não o texto (com e sem milissegundos)', () => {
    const l = [t('sem-ms', null, '2026-11-01T10:00:00Z'), t('com-ms', null, '2026-11-01T10:00:00.500Z')];
    expect(ids(ordenarPendentes(l, AGORA))).toEqual(['com-ms', 'sem-ms']);
  });
  it('virada do dia: a mesma tarefa de "hoje" passa a atrasada à 00h01 e muda de posição', () => {
    const l = [t('futura', '2026-11-18', '2026-11-01T00:00:00Z'), t('do-dia-17', '2026-11-17', '2026-11-01T00:00:00Z'), t('sem', null, '2026-11-01T00:00:00Z')];
    expect(ids(ordenarPendentes(l, sp('2026-11-17T23:59:00')))).toEqual(['do-dia-17', 'futura', 'sem']);
    const depois = ordenarPendentes(l, sp('2026-11-18T00:01:00'));
    expect(ids(depois)).toEqual(['do-dia-17', 'futura', 'sem']); // a do dia 17 virou atrasada (continua no topo) e a futura virou "hoje"
    expect(depois.map((x) => grupoDaTarefa(x.prazo, sp('2026-11-18T00:01:00')))).toEqual(['atrasada', 'hoje', 'sem_prazo']);
  });
  it('não altera o array recebido', () => {
    const l = [t('b', null, '2026-11-01T00:00:00Z'), t('a', '2026-11-16', '2026-11-01T00:00:00Z')];
    ordenarPendentes(l, AGORA);
    expect(ids(l)).toEqual(['b', 'a']);
  });
});

describe('ordenarConcluidas', () => {
  it('a concluída mais recentemente primeiro; empate: a criada por último', () => {
    const l = [
      { id: 'a', concluida_em: '2026-11-15T10:00:00Z', criada_em: '2026-11-01T00:00:00Z' },
      { id: 'b', concluida_em: '2026-11-17T09:00:00Z', criada_em: '2026-11-01T00:00:00Z' },
      { id: 'c', concluida_em: '2026-11-15T10:00:00Z', criada_em: '2026-11-05T00:00:00Z' },
    ];
    expect(ids(ordenarConcluidas(l))).toEqual(['b', 'c', 'a']);
  });
});
