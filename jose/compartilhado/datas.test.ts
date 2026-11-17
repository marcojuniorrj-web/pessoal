import { afterEach, describe, expect, it, vi } from 'vitest';
import { agruparPorPeriodo, atrasada, diaLocal, grupoHistorico, hoje, saudacao } from './datas';

// São Paulo é UTC-3 (sem horário de verão desde 2019).
const sp = (iso: string) => new Date(`${iso}-03:00`);

afterEach(() => vi.useRealTimers());

describe('hoje / diaLocal', () => {
  it('vira o dia à meia-noite de São Paulo, não à do UTC', () => {
    expect(hoje(sp('2026-11-17T23:59:00'))).toBe('2026-11-17');
    expect(hoje(sp('2026-11-18T00:01:00'))).toBe('2026-11-18');
    // 23h59 em SP já é 02h59 do dia seguinte em UTC
    expect(new Date(sp('2026-11-17T23:59:00')).toISOString()).toBe('2026-11-18T02:59:00.000Z');
  });
  it('funciona com o relógio fixo do Vitest', () => {
    vi.useFakeTimers();
    vi.setSystemTime(sp('2026-11-17T23:59:00'));
    expect(hoje(new Date())).toBe('2026-11-17');
    vi.setSystemTime(sp('2026-11-18T00:01:00'));
    expect(hoje(new Date())).toBe('2026-11-18');
  });
  it('aceita instantes em texto ISO UTC', () => {
    expect(diaLocal('2026-11-18T02:30:00.000Z')).toBe('2026-11-17');
    expect(diaLocal('2026-11-18T03:00:00.000Z')).toBe('2026-11-18');
  });
});

describe('atrasada', () => {
  it('só é atrasada se o prazo for antes de hoje', () => {
    const agora = sp('2026-11-17T23:59:00');
    expect(atrasada('2026-11-16', agora)).toBe(true);
    expect(atrasada('2026-11-17', agora)).toBe(false);
    expect(atrasada('2026-11-18', agora)).toBe(false);
    expect(atrasada(null, agora)).toBe(false);
  });
  it('muda na virada do dia', () => {
    expect(atrasada('2026-11-17', sp('2026-11-17T23:59:00'))).toBe(false);
    expect(atrasada('2026-11-17', sp('2026-11-18T00:01:00'))).toBe(true);
  });
});

describe('grupos do histórico', () => {
  const agora = sp('2026-11-17T10:00:00');
  it('classifica Hoje, Ontem, Esta semana e Mais antigas', () => {
    expect(grupoHistorico(sp('2026-11-17T00:00:00'), agora)).toBe('hoje');
    expect(grupoHistorico(sp('2026-11-16T23:59:00'), agora)).toBe('ontem');
    expect(grupoHistorico(sp('2026-11-15T12:00:00'), agora)).toBe('esta_semana');
    expect(grupoHistorico(sp('2026-11-11T12:00:00'), agora)).toBe('esta_semana');
    expect(grupoHistorico(sp('2026-11-10T12:00:00'), agora)).toBe('mais_antigas');
  });
  it('a virada do dia move a conversa de Hoje para Ontem', () => {
    const conversa = sp('2026-11-17T22:00:00');
    expect(grupoHistorico(conversa, sp('2026-11-17T23:59:00'))).toBe('hoje');
    expect(grupoHistorico(conversa, sp('2026-11-18T00:01:00'))).toBe('ontem');
  });
  it('agrupa em ordem e omite grupos vazios', () => {
    const itens = [
      { t: 'a', d: '2026-11-10T15:00:00.000Z' },
      { t: 'b', d: '2026-11-17T12:00:00.000Z' },
    ];
    const r = agruparPorPeriodo(itens, (i) => i.d, agora);
    expect(r.map((g) => g.rotulo)).toEqual(['Hoje', 'Mais antigas']);
  });
});

describe('saudação', () => {
  it('muda conforme o horário local', () => {
    expect(saudacao('Marco', sp('2026-11-17T04:59:00'))).toBe('Boa noite, Marco.');
    expect(saudacao('Marco', sp('2026-11-17T05:00:00'))).toBe('Bom dia, Marco.');
    expect(saudacao('Marco', sp('2026-11-17T11:59:00'))).toBe('Bom dia, Marco.');
    expect(saudacao('Marco', sp('2026-11-17T12:00:00'))).toBe('Boa tarde, Marco.');
    expect(saudacao('Marco', sp('2026-11-17T18:00:00'))).toBe('Boa noite, Marco.');
  });

  it('usa só o primeiro nome', () => {
    const t = sp('2026-11-17T09:00:00');
    expect(saudacao('Marco Silva', t)).toBe('Bom dia, Marco.');
    expect(saudacao('  Marco   Antonio  Silva ', t)).toBe('Bom dia, Marco.');
    expect(saudacao('', t)).toBe('Bom dia.');
    expect(saudacao('   ', t)).toBe('Bom dia.');
  });
});
