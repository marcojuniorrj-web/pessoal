import { afterEach, describe, expect, it, vi } from 'vitest';
import { agruparPorPeriodo, atrasada, diaLocal, grupoHistorico, hoje, horaMensagem, rotuloDia, saudacao, separadoresDeDia } from './datas';

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

describe('horário das mensagens', () => {
  it('mostra HH:mm em 24 h no fuso do usuário', () => {
    expect(horaMensagem(sp('2026-11-17T14:32:10'))).toBe('14:32');
    expect(horaMensagem(sp('2026-11-17T00:05:00'))).toBe('00:05');
    expect(horaMensagem(sp('2026-11-17T23:59:59'))).toBe('23:59');
    expect(horaMensagem('2026-11-17T17:32:00.000Z')).toBe('14:32'); // ISO em UTC
    expect(horaMensagem('2026-11-17T17:32:00.000Z', 'UTC')).toBe('17:32');
    expect(horaMensagem('2026-11-17T17:32:00.000Z', 'America/New_York')).toBe('12:32');
  });

  it('o rótulo vira de "Hoje" para "Ontem" à meia-noite de São Paulo (23h59 → 00h01)', () => {
    const msg = sp('2026-11-17T23:58:00');
    expect(rotuloDia(msg, sp('2026-11-17T23:59:00'))).toBe('Hoje');
    expect(rotuloDia(msg, sp('2026-11-18T00:01:00'))).toBe('Ontem');
    expect(rotuloDia(msg, sp('2026-11-19T00:01:00'))).toBe('ter., 17 de nov.');
  });

  it('o dia da mensagem é o do fuso, não o do UTC', () => {
    // 01h UTC do dia 18 ainda é 22h do dia 17 em São Paulo
    const msg = '2026-11-18T01:00:00.000Z';
    const agora = new Date('2026-11-18T12:00:00.000Z');
    expect(rotuloDia(msg, agora)).toBe('Ontem');
    expect(rotuloDia(msg, agora, 'UTC')).toBe('Hoje');
  });

  it('data curta com dia da semana e mês abreviado, sem ano no ano corrente', () => {
    const agora = sp('2026-11-18T12:00:00');
    expect(rotuloDia(sp('2026-11-10T09:00:00'), agora)).toBe('ter., 10 de nov.');
    expect(rotuloDia(sp('2026-11-01T09:00:00'), agora)).toBe('dom., 1 de nov.');
    expect(rotuloDia(sp('2026-01-03T09:00:00'), agora)).toBe('sáb., 3 de jan.');
    expect(rotuloDia(sp('2025-11-17T09:00:00'), agora)).toBe('seg., 17 de nov. de 2025');
  });

  it('mensagem do futuro (relógio adiantado) conta como hoje', () => {
    expect(rotuloDia(sp('2026-11-18T10:00:00'), sp('2026-11-17T23:00:00'))).toBe('Hoje');
  });

  it('separadores: a 1ª mensagem sempre abre um dia; depois só quando o dia muda', () => {
    const agora = sp('2026-11-18T09:00:00');
    const r = separadoresDeDia(
      [sp('2026-11-17T22:00:00'), sp('2026-11-17T23:59:00'), sp('2026-11-18T00:01:00'), null, sp('2026-11-18T08:00:00')],
      agora,
    );
    expect(r).toEqual(['Ontem', null, 'Hoje', null, null]);
  });
});
