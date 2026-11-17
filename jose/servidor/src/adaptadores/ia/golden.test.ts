import { describe, expect, it } from 'vitest';
import { avaliarResposta, CASOS_GOLDEN } from './golden';
import { lerPrompt, prompt } from './prompt';

describe('prompt-jose.md', () => {
  it('tem as quatro seções e as regras de arquitetura.md §4', () => {
    expect(Object.keys(prompt).sort()).toEqual(['base', 'decidir', 'sugestoes', 'titulo']);
    expect(prompt.base).toContain('no máximo 5 linhas');
    expect(prompt.base).toContain('1 próximo passo');
    expect(prompt.base).toMatch(/aconselhamento médico, jurídico nem financeiro/);
    expect(prompt.sugestoes).toContain('No máximo 3 sugestões');
    expect(prompt.sugestoes).toContain('Não sugira uma memória que já está');
    expect(prompt.decidir).toMatch(/até 3 perguntas/);
    expect(prompt.decidir).toMatch(/prós e contras/);
    expect(prompt.decidir).toMatch(/recomendação/);
    expect(prompt.titulo).toContain('6 palavras');
  });
  it('falha se uma seção sumir', () => {
    expect(() => lerPrompt('=== BASE ===\nx')).toThrow(/SUGESTOES/);
  });
});

describe('casos golden', () => {
  it('são 4, um por momento do dia', () => {
    expect(CASOS_GOLDEN.map((c) => c.id)).toEqual(['acordar', 'travado', 'decisao', 'noite']);
  });
});

describe('avaliarResposta', () => {
  it('aprova resposta curta com 1 próximo passo', () => {
    const r = avaliarResposta('Bom dia, Marco. Hoje o mais importante é a proposta do cliente Alfa.\nComece abrindo o arquivo e escrevendo só o primeiro parágrafo. Leva 5 minutos.');
    expect(r).toEqual({ ok: true, falhas: [], linhas: 2 });
  });
  it('reprova texto longo, lista e muitas perguntas', () => {
    const longo = ['a', 'b', 'c', 'd', 'e', 'f'].join('\n');
    expect(avaliarResposta(longo).falhas.join()).toContain('mais de 5 linhas');
    expect(avaliarResposta('Faça:\n1. um\n2. dois').falhas.join()).toContain('lista com 2 itens');
    expect(avaliarResposta('Quer isso? E aquilo?').falhas.join()).toContain('2 perguntas');
    expect(avaliarResposta('').ok).toBe(false);
  });
  it('reprova conselho médico, financeiro e jurídico', () => {
    expect(avaliarResposta('Tome 10 mg de ritalina.').ok).toBe(false);
    expect(avaliarResposta('Você tem depressão.').falhas.join()).toContain('diagnóstico');
    expect(avaliarResposta('Invista em ações da Petrobras.').falhas.join()).toContain('investimento');
    expect(avaliarResposta('Processe a empresa.').falhas.join()).toContain('jurídico');
  });
});
