import { describe, expect, it } from 'vitest';
import { msAteVirarODia } from './agora';

const sp = (iso: string) => new Date(`${iso}-03:00`);

describe('msAteVirarODia', () => {
  it('23h59min30s em São Paulo: 30 s + 1 s de folga até virar o dia', () => {
    expect(msAteVirarODia(sp('2026-11-17T23:59:30'))).toBe(31_000);
  });
  it('00h01 em São Paulo: quase um dia inteiro até a próxima virada (23h59 + folga)', () => {
    expect(msAteVirarODia(sp('2026-11-18T00:01:00'))).toBe((23 * 3600 + 59 * 60) * 1000 + 1000);
  });
  it('à meia-noite em ponto o dia que começa dura 24 h (+ folga)', () => {
    expect(msAteVirarODia(sp('2026-11-18T00:00:00'))).toBe(86_400_000 + 1000);
  });
  it('depois da virada o timer cai no dia novo (o "hoje" muda)', () => {
    const antes = sp('2026-11-17T23:59:30');
    const depois = new Date(antes.getTime() + msAteVirarODia(antes));
    expect(depois.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })).toBe('2026-11-18');
  });
  it('respeita o fuso informado e os milissegundos', () => {
    // 23h59min30s de SP = 02h59min30s UTC do dia seguinte: faltam 21 h até a meia-noite UTC
    expect(msAteVirarODia(sp('2026-11-17T23:59:30'), 'UTC')).toBe((21 * 3600 + 30) * 1000 + 1000);
    expect(msAteVirarODia(new Date(sp('2026-11-17T23:59:30').getTime() + 400))).toBe(31_000 - 400);
  });
});
