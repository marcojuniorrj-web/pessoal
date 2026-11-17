import { describe, expect, it } from 'vitest';
import { ROTULO_AREA, memoriaEntradaSchema, sugestaoSchema, tarefaEntradaSchema, metaEntradaSchema, mensagemEntradaSchema } from './index';

describe('rótulos das áreas', () => {
  it('mapeia enum para rótulo', () => {
    expect(ROTULO_AREA).toEqual({
      sobre_mim: 'Sobre mim', trabalho: 'Trabalho', financas: 'Finanças', saude: 'Saúde e rotina', casa: 'Família e casa',
    });
  });
});

describe('tarefa e meta', () => {
  it('aceita título de 120 e rejeita 121 caracteres', () => {
    expect(tarefaEntradaSchema.safeParse({ titulo: 'a'.repeat(120), area: 'casa' }).success).toBe(true);
    expect(tarefaEntradaSchema.safeParse({ titulo: 'a'.repeat(121), area: 'casa' }).success).toBe(false);
    expect(metaEntradaSchema.safeParse({ titulo: 'a'.repeat(121), area: 'casa' }).success).toBe(false);
  });
  it('rejeita título vazio e área inválida (inclusive sobre_mim)', () => {
    expect(tarefaEntradaSchema.safeParse({ titulo: '  ', area: 'casa' }).success).toBe(false);
    expect(tarefaEntradaSchema.safeParse({ titulo: 'x', area: 'lazer' }).success).toBe(false);
    expect(metaEntradaSchema.safeParse({ titulo: 'x', area: 'sobre_mim' }).success).toBe(false);
  });
  it('valida o prazo como data local', () => {
    expect(tarefaEntradaSchema.safeParse({ titulo: 'x', area: 'casa', prazo: '2026-11-17' }).success).toBe(true);
    expect(tarefaEntradaSchema.safeParse({ titulo: 'x', area: 'casa', prazo: null }).success).toBe(true);
    expect(tarefaEntradaSchema.safeParse({ titulo: 'x', area: 'casa', prazo: '17/11/2026' }).success).toBe(false);
    expect(tarefaEntradaSchema.safeParse({ titulo: 'x', area: 'casa', prazo: '2026-02-30' }).success).toBe(false);
  });
});

describe('memória', () => {
  it('aceita 300 e rejeita 301 caracteres', () => {
    expect(memoriaEntradaSchema.safeParse({ texto: 'a'.repeat(300), area: 'sobre_mim' }).success).toBe(true);
    expect(memoriaEntradaSchema.safeParse({ texto: 'a'.repeat(301), area: 'sobre_mim' }).success).toBe(false);
  });
  it('rejeita área inválida', () => {
    expect(memoriaEntradaSchema.safeParse({ texto: 'x', area: 'lazer' }).success).toBe(false);
  });
});

describe('sugestões', () => {
  it('valida o conteúdo conforme o tipo', () => {
    expect(sugestaoSchema.safeParse({ tipo: 'tarefa', conteudo: { titulo: 'Ligar', area: 'trabalho' } }).success).toBe(true);
    expect(sugestaoSchema.safeParse({ tipo: 'memoria', conteudo: { texto: 'Acorda às 6h', area: 'sobre_mim' } }).success).toBe(true);
    expect(sugestaoSchema.safeParse({ tipo: 'tarefa', conteudo: { titulo: 'Ligar', area: 'sobre_mim' } }).success).toBe(false);
    expect(sugestaoSchema.safeParse({ tipo: 'outra', conteudo: {} }).success).toBe(false);
  });
});

describe('mensagem', () => {
  it('limita a 4000 caracteres', () => {
    expect(mensagemEntradaSchema.safeParse({ id: 'a', texto: 'a'.repeat(4000), origem: 'voz' }).success).toBe(true);
    expect(mensagemEntradaSchema.safeParse({ id: 'a', texto: 'a'.repeat(4001), origem: 'texto' }).success).toBe(false);
    expect(mensagemEntradaSchema.safeParse({ id: 'a', texto: '', origem: 'texto' }).success).toBe(false);
  });
});
