import { describe, expect, it } from 'vitest';
import { toqueValido } from './toque-confiavel';
import { JANELA_ABERTURA_MS } from './pressao-longa';

describe('toqueValido (clique fantasma do iOS)', () => {
  it('sem pointerdown não vale (clique solto, sem toque)', () => {
    expect(toqueValido(null, 1000)).toBe(false);
  });
  it('pointerdown anterior ao botão aparecer, ou dentro da janela de abertura, não vale', () => {
    expect(toqueValido(900, 1000)).toBe(false);
    expect(toqueValido(1000 + JANELA_ABERTURA_MS, 1000)).toBe(false);
  });
  it('pointerdown depois da janela vale', () => {
    expect(toqueValido(1000 + JANELA_ABERTURA_MS + 1, 1000)).toBe(true);
  });
});
