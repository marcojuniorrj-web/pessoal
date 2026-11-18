import { describe, expect, it } from 'vitest';
import { contadorTexto, lerConteudoMemoria, LIMITE_MEMORIA, validarMemoria } from './memoria-edicao';

describe('validarMemoria', () => {
  it('aceita de 1 a 300 caracteres e apara os espaços', () => {
    expect(validarMemoria('  Acorda às 6h.  ', 'saude')).toEqual({ ok: true, conteudo: { texto: 'Acorda às 6h.', area: 'saude' } });
    expect(validarMemoria('x'.repeat(LIMITE_MEMORIA), 'casa').ok).toBe(true);
  });
  it('recusa vazio, só espaços e mais de 300, com mensagem em português', () => {
    expect(validarMemoria('', 'casa')).toEqual({ ok: false, erro: 'Texto obrigatório' });
    expect(validarMemoria('    ', 'casa')).toEqual({ ok: false, erro: 'Texto obrigatório' });
    expect(validarMemoria('x'.repeat(301), 'casa')).toEqual({ ok: false, erro: 'Máximo de 300 caracteres' });
  });
});

describe('contadorTexto', () => {
  it('mostra N/300 e avisa a partir de 90%', () => {
    expect(contadorTexto('abc')).toEqual({ rotulo: '3/300', perto: false });
    expect(contadorTexto('x'.repeat(269)).perto).toBe(false);
    expect(contadorTexto('x'.repeat(270)).perto).toBe(true);
  });
});

describe('lerConteudoMemoria', () => {
  it('devolve o conteúdo válido e null para o que está fora do formato', () => {
    expect(lerConteudoMemoria({ texto: 'Oi', area: 'casa' })).toEqual({ texto: 'Oi', area: 'casa' });
    expect(lerConteudoMemoria({ titulo: 'tarefa', area: 'casa' })).toBeNull();
    expect(lerConteudoMemoria(null)).toBeNull();
    expect(lerConteudoMemoria({ texto: 'x', area: 'nada' })).toBeNull();
  });
});
