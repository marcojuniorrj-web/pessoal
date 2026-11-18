import { describe, expect, it } from 'vitest';
import { diasAteOPrazo, formatarDataCurta, prazoDaTarefa, rotuloPrazo } from './prazo';

// São Paulo é UTC-3 (sem horário de verão desde 2019).
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe('diasAteOPrazo', () => {
  it('conta os dias em relação a hoje no fuso do Marco', () => {
    const agora = sp('2026-11-17T10:00:00');
    expect(diasAteOPrazo('2026-11-17', agora)).toBe(0);
    expect(diasAteOPrazo('2026-11-18', agora)).toBe(1);
    expect(diasAteOPrazo('2026-11-16', agora)).toBe(-1);
    expect(diasAteOPrazo('2026-12-01', agora)).toBe(14);
  });
  it('virada do dia: 23h59 ainda é hoje; 00h01 já é o dia seguinte (São Paulo)', () => {
    expect(diasAteOPrazo('2026-11-17', sp('2026-11-17T23:59:00'))).toBe(0);
    expect(diasAteOPrazo('2026-11-17', sp('2026-11-18T00:01:00'))).toBe(-1);
    expect(diasAteOPrazo('2026-11-18', sp('2026-11-17T23:59:00'))).toBe(1);
    expect(diasAteOPrazo('2026-11-18', sp('2026-11-18T00:01:00'))).toBe(0);
  });
  it('usa o fuso informado, não o do aparelho: 23h59 em SP já é o dia seguinte em UTC', () => {
    expect(diasAteOPrazo('2026-11-17', sp('2026-11-17T23:59:00'), 'UTC')).toBe(-1);
  });
  it('atravessa mês, ano e dia 29 de fevereiro', () => {
    expect(diasAteOPrazo('2027-01-01', sp('2026-12-31T20:00:00'))).toBe(1);
    expect(diasAteOPrazo('2028-02-29', sp('2028-02-28T12:00:00'))).toBe(1);
    expect(diasAteOPrazo('2028-03-01', sp('2028-02-28T12:00:00'))).toBe(2);
  });
});

describe('formatarDataCurta', () => {
  const agora = sp('2026-11-17T10:00:00');
  it('dia da semana e dd/mm; com o ano só se não for o de hoje', () => {
    expect(formatarDataCurta('2026-11-20', agora)).toBe('sex, 20/11');
    expect(formatarDataCurta('2026-12-05', agora)).toBe('sáb, 05/12');
    expect(formatarDataCurta('2027-11-14', agora)).toBe('dom, 14/11/2027');
  });
  it('não muda com o fuso do aparelho (a data é local, sem hora)', () => {
    expect(formatarDataCurta('2026-11-20', agora, 'Asia/Tokyo')).toBe('sex, 20/11');
  });
});

describe('rotuloPrazo', () => {
  it('Hoje, Amanhã, Ontem ou a data curta, e muda na virada do dia', () => {
    expect(rotuloPrazo('2026-11-17', sp('2026-11-17T23:59:00'))).toBe('Hoje');
    expect(rotuloPrazo('2026-11-17', sp('2026-11-18T00:01:00'))).toBe('Ontem');
    expect(rotuloPrazo('2026-11-18', sp('2026-11-17T23:59:00'))).toBe('Amanhã');
    expect(rotuloPrazo('2026-11-18', sp('2026-11-18T00:01:00'))).toBe('Hoje');
    expect(rotuloPrazo('2026-11-25', sp('2026-11-17T10:00:00'))).toBe('qua, 25/11');
  });
});

describe('prazoDaTarefa', () => {
  const agora = sp('2026-11-17T10:00:00');
  it('atrasada diz "Atrasada" com texto (não só cor); hoje e futuras seguem o rótulo', () => {
    expect(prazoDaTarefa('2026-11-16', agora)).toEqual({ texto: 'Atrasada · ontem', situacao: 'atrasada' });
    expect(prazoDaTarefa('2026-11-10', agora)).toEqual({ texto: 'Atrasada · ter, 10/11', situacao: 'atrasada' });
    expect(prazoDaTarefa('2026-11-17', agora)).toEqual({ texto: 'Hoje', situacao: 'hoje' });
    expect(prazoDaTarefa('2026-11-18', agora)).toEqual({ texto: 'Amanhã', situacao: 'futura' });
    expect(prazoDaTarefa('2026-11-20', agora)).toEqual({ texto: 'sex, 20/11', situacao: 'futura' });
  });
  it('a mesma tarefa de hoje vira atrasada à 00h01 do dia seguinte em São Paulo', () => {
    expect(prazoDaTarefa('2026-11-17', sp('2026-11-17T23:59:00')).situacao).toBe('hoje');
    expect(prazoDaTarefa('2026-11-17', sp('2026-11-18T00:01:00'))).toEqual({ texto: 'Atrasada · ontem', situacao: 'atrasada' });
  });
});
