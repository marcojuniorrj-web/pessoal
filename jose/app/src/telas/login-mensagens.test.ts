import { describe, expect, it } from 'vitest';
import { mensagemDeErro } from './login-mensagens';

describe('mensagens do Login', () => {
  it('mostra a mensagem conforme ?erro=', () => {
    expect(mensagemDeErro('falha')).toBe('Não foi possível entrar. Tente de novo.');
    expect(mensagemDeErro('negado')).toBe('Acesso negado — este app é pessoal.');
    expect(mensagemDeErro(null)).toBeNull();
    expect(mensagemDeErro('qualquer')).toBeNull();
  });
});
