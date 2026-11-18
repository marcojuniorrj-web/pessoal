import { describe, expect, it } from 'vitest';
import { CHAVE_INSTALAR, deveMostrarFaixa, estaInstalado, fecharFaixaInstalar, lerEstadoInstalar, marcarFaixaPendente, modoInstalar } from './instalar';

const armazem = () => {
  const d = new Map<string, string>();
  return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v) };
};

describe('faixa "Instalar na tela inicial": uma única vez, depois das boas-vindas', () => {
  it('começa em "nunca": não aparece para quem não passou pelas boas-vindas', () => {
    const a = armazem();
    expect(lerEstadoInstalar(a)).toBe('nunca');
    expect(deveMostrarFaixa(lerEstadoInstalar(a), false)).toBe(false);
  });
  it('ao terminar as boas-vindas fica pendente e aparece', () => {
    const a = armazem();
    marcarFaixaPendente(a);
    expect(lerEstadoInstalar(a)).toBe('pendente');
    expect(deveMostrarFaixa('pendente', false)).toBe(true);
  });
  it('depois de fechada nunca volta, nem se as boas-vindas forem refeitas', () => {
    const a = armazem();
    marcarFaixaPendente(a);
    fecharFaixaInstalar(a);
    expect(lerEstadoInstalar(a)).toBe('fechada');
    marcarFaixaPendente(a); // refazer as boas-vindas
    expect(lerEstadoInstalar(a)).toBe('fechada');
    expect(deveMostrarFaixa('fechada', false)).toBe(false);
  });
  it('não aparece com o app já instalado (standalone)', () => {
    expect(deveMostrarFaixa('pendente', true)).toBe(false);
  });
  it('valor estranho no armazenamento vale como "nunca"', () => {
    const a = armazem();
    a.setItem(CHAVE_INSTALAR, 'qualquer coisa');
    expect(lerEstadoInstalar(a)).toBe('nunca');
  });
  it('sem armazenamento (modo privado) não quebra e nunca mostra', () => {
    expect(lerEstadoInstalar(null)).toBe('nunca');
    expect(() => marcarFaixaPendente(null)).not.toThrow();
    expect(() => fecharFaixaInstalar(null)).not.toThrow();
  });
});

describe('estaInstalado', () => {
  it('iPhone: navigator.standalone; outros: display-mode standalone', () => {
    expect(estaInstalado({ navigator: { standalone: true } })).toBe(true);
    expect(estaInstalado({ navigator: {}, matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }) })).toBe(true);
    expect(estaInstalado({ navigator: {}, matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(estaInstalado({})).toBe(false);
  });
});

describe('modoInstalar', () => {
  it('iPhone sempre mostra a instrução Compartilhar → Adicionar à Tela de Início; os outros, botão ou menu', () => {
    expect(modoInstalar(true, true)).toBe('ios');
    expect(modoInstalar(false, true)).toBe('botao');
    expect(modoInstalar(false, false)).toBe('menu');
  });
});
