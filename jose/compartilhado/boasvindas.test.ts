import { describe, expect, it } from 'vitest';
import { etapaBoasVindas, inserirNoCampo, PERGUNTAS_BOAS_VINDAS, proximoPasso, rotuloProgresso, TOTAL_PERGUNTAS } from './boasvindas';

const m = (...autores: Array<'marco' | 'jose'>) => autores.map((autor) => ({ autor }));

describe('as 5 perguntas fixas', () => {
  it('são 5, na ordem combinada (rotina, áreas, metas, o que trava, acordar e dormir)', () => {
    expect(PERGUNTAS_BOAS_VINDAS).toHaveLength(TOTAL_PERGUNTAS);
    const t = PERGUNTAS_BOAS_VINDAS.map((p) => p.texto.toLowerCase());
    expect(t[0]).toContain('rotina');
    expect(t[1]).toContain('áreas');
    expect(t[2]).toContain('metas');
    expect(t[3]).toContain('trava');
    expect(t[4]).toMatch(/acordar e dormir/);
  });
  it('têm respostas rápidas na 2, na 4 e na 5 (a 2 entra no campo; as outras enviam)', () => {
    expect(PERGUNTAS_BOAS_VINDAS.map((p) => p.respostasRapidas.length > 0)).toEqual([false, true, false, true, true]);
    expect(PERGUNTAS_BOAS_VINDAS[1]!.respostasRapidas.every((r) => r.modo === 'inserir')).toBe(true);
    expect(PERGUNTAS_BOAS_VINDAS[3]!.respostasRapidas.every((r) => r.modo === 'enviar')).toBe(true);
    expect(PERGUNTAS_BOAS_VINDAS[4]!.respostasRapidas.every((r) => r.modo === 'enviar')).toBe(true);
  });
});

describe('etapaBoasVindas: a etapa vem só das mensagens (retomada)', () => {
  it('conversa nova (só a 1ª pergunta): Pergunta 1 de 5', () => {
    const e = etapaBoasVindas(m('jose'));
    expect(e).toEqual({ fase: 'perguntando', numero: 1, respostas: 0 });
    expect(rotuloProgresso(e)).toBe('Pergunta 1 de 5');
  });
  it('fechou na pergunta 3 (2 respostas): reabre em Pergunta 3 de 5', () => {
    const e = etapaBoasVindas(m('jose', 'marco', 'jose', 'marco', 'jose'));
    expect(e).toEqual({ fase: 'perguntando', numero: 3, respostas: 2 });
    expect(rotuloProgresso(e)).toBe('Pergunta 3 de 5');
  });
  it('N conta as respostas do Marco: a resposta enviada já avança o número', () => {
    expect(etapaBoasVindas(m('jose', 'marco'))).toMatchObject({ fase: 'perguntando', numero: 2 });
  });
  it('na 5ª pergunta mostra "5 de 5"; nunca passa de 5 enquanto pergunta', () => {
    expect(rotuloProgresso(etapaBoasVindas(m('jose', 'marco', 'jose', 'marco', 'jose', 'marco', 'jose', 'marco', 'jose')))).toBe('Pergunta 5 de 5');
  });
  it('5 respostas e o José ainda não resumiu (ou falhou): resumindo, sem rótulo', () => {
    const msgs = m('jose', 'marco', 'jose', 'marco', 'jose', 'marco', 'jose', 'marco', 'jose', 'marco');
    const e = etapaBoasVindas(msgs);
    expect(e).toEqual({ fase: 'resumindo', respostas: 5 });
    expect(rotuloProgresso(e)).toBeNull();
  });
  it('5 respostas e o resumo do José pronto: revisando', () => {
    expect(etapaBoasVindas(m('jose', 'marco', 'jose', 'marco', 'jose', 'marco', 'jose', 'marco', 'jose', 'marco', 'jose'))).toEqual({ fase: 'revisando', respostas: 5 });
  });
  it('conversa vazia: pergunta 1', () => {
    expect(etapaBoasVindas([])).toEqual({ fase: 'perguntando', numero: 1, respostas: 0 });
  });
});

describe('proximoPasso (servidor): o que vem depois de gravar a resposta do Marco', () => {
  it('respostas 1 a 4 → pergunta de índice igual ao número de respostas', () => {
    for (const n of [1, 2, 3, 4]) expect(proximoPasso(n)).toEqual({ tipo: 'pergunta', indice: n });
  });
  it('5 → resumo pela IA; 6 ou mais → encerrada', () => {
    expect(proximoPasso(5)).toEqual({ tipo: 'resumo' });
    expect(proximoPasso(6)).toEqual({ tipo: 'encerrada' });
  });
});

describe('inserirNoCampo (respostas rápidas da pergunta 2)', () => {
  it('acrescenta separando por vírgula e não repete', () => {
    expect(inserirNoCampo('', 'Trabalho')).toBe('Trabalho');
    expect(inserirNoCampo('Trabalho', 'Finanças')).toBe('Trabalho, Finanças');
    expect(inserirNoCampo('Trabalho, Finanças', 'trabalho')).toBe('Trabalho, Finanças');
  });
});
