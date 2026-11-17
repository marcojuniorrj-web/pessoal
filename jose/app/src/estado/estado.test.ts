import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apagarComDesfazer, estaPendente, ESPERA_APAGAR_MS } from './apagar-com-desfazer';
import { criarFilaToast } from './fila-toast';
import { lerRascunho, limparRascunho, salvarRascunho } from './rascunho';

beforeEach(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('apagar com Desfazer', () => {
  const montar = () => {
    const api = vi.fn(async () => {});
    const falhou = vi.fn();
    const desfez = vi.fn();
    let acao: { aoTocar: () => void } | undefined;
    let duracao = 0;
    apagarComDesfazer({
      id: 'c1', mostrar: (_m, a, d) => { acao = a; duracao = d ?? 0; }, apagar: api, aoDesfazer: desfez, aoFalhar: falhou,
    });
    return { api, falhou, desfez, acao: () => acao!, duracao: () => duracao };
  };

  it('espera 5 s antes de chamar a API', async () => {
    const x = montar();
    expect(x.duracao()).toBe(ESPERA_APAGAR_MS);
    await vi.advanceTimersByTimeAsync(ESPERA_APAGAR_MS - 1);
    expect(x.api).not.toHaveBeenCalled();
    expect(estaPendente('c1')).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(x.api).toHaveBeenCalledTimes(1);
    expect(estaPendente('c1')).toBe(false);
  });
  it('Desfazer dentro dos 5 s: a API nunca é chamada', async () => {
    const x = montar();
    await vi.advanceTimersByTimeAsync(3000);
    x.acao().aoTocar();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(x.api).not.toHaveBeenCalled();
    expect(x.desfez).toHaveBeenCalledTimes(1);
    expect(estaPendente('c1')).toBe(false);
  });
  it('falha da API restaura o item', async () => {
    const x = montar();
    x.api.mockRejectedValueOnce(new Error('x'));
    await vi.advanceTimersByTimeAsync(ESPERA_APAGAR_MS);
    expect(x.falhou).toHaveBeenCalledTimes(1);
  });
});

describe('toast', () => {
  it('aceita duração própria (5 s no apagar) e o padrão é 4 s', () => {
    const f = criarFilaToast();
    f.mostrar('a');
    vi.advanceTimersByTime(3999);
    expect(f.obter()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(f.obter()).toBeNull();
    f.mostrar('b', undefined, 5000);
    vi.advanceTimersByTime(4999);
    expect(f.obter()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(f.obter()).toBeNull();
  });
});

describe('rascunho', () => {
  it('guarda por conversa, apaga ao esvaziar', () => {
    salvarRascunho(null, 'nova');
    salvarRascunho('c1', 'texto da c1');
    expect([lerRascunho(null), lerRascunho('c1'), lerRascunho('c2')]).toEqual(['nova', 'texto da c1', '']);
    limparRascunho('c1');
    expect(lerRascunho('c1')).toBe('');
  });
});
