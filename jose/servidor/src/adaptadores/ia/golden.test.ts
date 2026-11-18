import { describe, expect, it } from 'vitest';
import { avaliarCaso, avaliarResposta, CASOS_GOLDEN } from './golden';
import { secaoSugestoes } from '../../modulos/conversas/contexto';
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
  it('SUGESTOES: com tarefa e meta ligadas descreve ação concreta, objetivo maior, prazo AAAA-MM-DD a partir de hoje e "nem tudo vira cartão"', () => {
    const t = secaoSugestoes(prompt.sugestoes, ['memoria', 'tarefa', 'meta']);
    expect(t).toMatch(/Tarefa é uma ação concreta/);
    expect(t).toMatch(/Meta é um objetivo maior/);
    expect(t).toMatch(/ação vira tarefa, não meta/);
    expect(t).toMatch(/AAAA-MM-DD/);
    expect(t).toMatch(/data de hoje que vem no contexto/);
    expect(t).toMatch(/Nunca invente prazo/);
    expect(t).toMatch(/Nem tudo vira cartão/);
    expect(t).toMatch(/preocupações ficam só no texto/);
    expect(t).toMatch(/No máximo 3 sugestões por resposta, somando todos os tipos/);
  });
  it('SUGESTOES: com só a memória ligada, nada de tarefa nem meta', () => {
    const t = secaoSugestoes(prompt.sugestoes, ['memoria']);
    expect(t).not.toMatch(/Tarefa é|Meta é|prazo|sugerir_tarefa/);
    expect(t).toMatch(/Memória é um fato duradouro/);
  });
  it('falha se uma seção sumir', () => {
    expect(() => lerPrompt('=== BASE ===\nx')).toThrow(/SUGESTOES/);
  });
});

describe('casos golden', () => {
  it('4 por momento do dia (onda 2) e 2 de memória (onda 4)', () => {
    expect(CASOS_GOLDEN.map((c) => c.id)).toEqual(['acordar', 'travado', 'decisao', 'noite', 'memoria-existente', 'memoria-nova']);
  });
});

describe('avaliarCaso (casos de memória, tarefa 4.4)', () => {
  const existente = CASOS_GOLDEN.find((c) => c.id === 'memoria-existente')!;
  const nova = CASOS_GOLDEN.find((c) => c.id === 'memoria-nova')!;
  const memoria = (texto: string) => ({ nome: 'sugerir_memoria', entrada: { texto, area: 'saude' } });

  it('o caso usa a memória "Acorda às 6h." e pergunta "O que faço hoje?"', () => {
    expect(existente.memorias).toEqual([{ texto: 'Acorda às 6h.', area: 'saude' }]);
    expect(existente.mensagem).toBe('O que faço hoje?');
  });
  it('aprova: usa a memória na resposta e não a sugere de novo', () => {
    const r = avaliarCaso(existente, { texto: 'Bom dia, Marco. Você acorda às 6h, então a manhã é sua.\nComece pela proposta do cliente: abra o arquivo agora.', sugestoes: [] });
    expect(r).toEqual({ ok: true, falhas: [], linhas: 2 });
  });
  it('reprova: não usou a memória', () => {
    const r = avaliarCaso(existente, { texto: 'Comece pela proposta do cliente. Abra o arquivo agora.', sugestoes: [] });
    expect(r.falhas).toContain('não usou a memória que já existe na resposta');
  });
  it('reprova: sugeriu de novo a memória que já existe (mesmo com outras palavras)', () => {
    for (const texto of ['Acorda às 6h.', 'Costuma acordar cedo, por volta das 6h', 'Levanta às seis']) {
      const r = avaliarCaso(existente, { texto: 'Você acorda às 6h. Comece pela proposta.', sugestoes: [memoria(texto)] });
      expect(r.ok, texto).toBe(false);
      expect(r.falhas.join()).toContain('sugeriu de novo a memória que já existe');
    }
  });
  it('reprova ferramenta fora de sugerir_memoria e mais de 3 sugestões', () => {
    expect(avaliarCaso(existente, { texto: 'Você acorda às 6h. Comece agora.', sugestoes: [{ nome: 'sugerir_tarefa', entrada: {} }] }).falhas).toContain('chamou ferramenta que não está ligada');
    const quatro = ['a', 'b', 'c', 'd'].map((t) => memoria(`Fato ${t}`));
    expect(avaliarCaso(nova, { texto: 'Anotado, Marco.', sugestoes: quatro }).falhas).toContain('mais de 3 sugestões (4)');
  });
  it('fato novo: precisa sugerir memória, com texto antes, sem repetir a que existe', () => {
    expect(avaliarCaso(nova, { texto: 'Anotado, Marco. Vou proteger suas manhãs.', sugestoes: [memoria('Rende melhor de manhã.'), memoria('Evita reuniões depois das 17h.')] }).ok).toBe(true);
    expect(avaliarCaso(nova, { texto: 'Anotado, Marco.', sugestoes: [] }).falhas).toContain('não sugeriu nenhuma memória');
    expect(avaliarCaso(nova, { texto: '', sugestoes: [memoria('Rende melhor de manhã.')] }).falhas).toContain('sugeriu memória sem escrever o texto antes');
    expect(avaliarCaso(nova, { texto: 'Anotado, Marco.', sugestoes: [memoria('Acorda às 6h.')] }).falhas.join()).toContain('sugeriu de novo');
  });
  it('casos antigos continuam valendo só pelas regras gerais', () => {
    const acordar = CASOS_GOLDEN[0]!;
    expect(avaliarCaso(acordar, { texto: 'Bom dia, Marco. Comece pela proposta do cliente Alfa.', sugestoes: [] }).ok).toBe(true);
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
