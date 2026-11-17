import { describe, expect, it } from 'vitest';
import { voltarSeguro } from './voltar';

describe('voltarSeguro', () => {
  it('aceita caminhos internos', () => {
    expect(voltarSeguro('/ajustes')).toBe('/ajustes');
    expect(voltarSeguro('/a?b=1')).toBe('/a?b=1');
  });
  it('rejeita o resto', () => {
    for (const v of ['//x', '//evil.com', '/\\x', 'https://evil.com', 'x', '', null, undefined]) expect(voltarSeguro(v)).toBe('/');
  });
});
