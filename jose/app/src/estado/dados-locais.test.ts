// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { limparDadosLocais } from './dados-locais';
import { salvarCacheLista } from './cache-lista';
import { salvarRascunho } from './rascunho';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('limparDadosLocais', () => {
  it('remove usuário, listas em cache, rascunhos e a flag de instalar; mantém chaves de outros apps', () => {
    localStorage.setItem('jose:eu', '{"nome":"Marco"}');
    salvarCacheLista('tarefas', [{ id: 't1' }]);
    salvarRascunho('c1', 'texto digitado');
    salvarRascunho(null, 'outro');
    localStorage.setItem('jose:instalar', 'pendente');
    localStorage.setItem('outro-app:x', '1');
    sessionStorage.setItem('qualquer', '1');
    limparDadosLocais();
    expect(Object.keys(localStorage)).toEqual(['outro-app:x']);
    expect(sessionStorage.length).toBe(0);
  });
});
