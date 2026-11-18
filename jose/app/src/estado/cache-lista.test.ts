// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { lerCacheLista, limparCachesDeListas, salvarCacheLista } from './cache-lista';

beforeEach(() => localStorage.clear());

describe('cache da última lista', () => {
  it('guarda e lê a lista por nome; sem cache devolve null', () => {
    expect(lerCacheLista('tarefas')).toBeNull();
    salvarCacheLista('tarefas', [{ id: 'a' }]);
    expect(lerCacheLista('tarefas')).toEqual([{ id: 'a' }]);
    expect(lerCacheLista('metas')).toBeNull();
  });
  it('conteúdo corrompido ou que não é lista vale como sem cache', () => {
    localStorage.setItem('jose:lista:tarefas', '{quebrado');
    expect(lerCacheLista('tarefas')).toBeNull();
    localStorage.setItem('jose:lista:tarefas', '{"a":1}');
    expect(lerCacheLista('tarefas')).toBeNull();
  });
  it('limpar remove só as listas (o resto do localStorage fica)', () => {
    salvarCacheLista('tarefas', [{ id: 'a' }]);
    salvarCacheLista('metas', [{ id: 'b' }]);
    localStorage.setItem('outra-coisa', 'x');
    limparCachesDeListas();
    expect(lerCacheLista('tarefas')).toBeNull();
    expect(lerCacheLista('metas')).toBeNull();
    expect(localStorage.getItem('outra-coisa')).toBe('x');
  });
});
