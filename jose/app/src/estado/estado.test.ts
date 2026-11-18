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

describe('apagar com Desfazer: vários apagamentos seguidos (um só aviso)', () => {
  const dois = () => {
    const chamadas: string[] = [];
    const desfeitos: string[] = [];
    const avisos: Array<{ mensagem: string; acao?: { aoTocar: () => void } }> = [];
    const mostrar = (mensagem: string, acao?: { rotulo: string; aoTocar: () => void }) => void avisos.push({ mensagem, acao });
    const item = (id: string, extra: { mensagem?: string; falha?: boolean } = {}) =>
      apagarComDesfazer({
        id, mensagem: extra.mensagem, mostrar,
        apagar: async () => { chamadas.push(id); if (extra.falha) throw new Error('x'); },
        aoDesfazer: () => desfeitos.push(id),
        aoFalhar: () => desfeitos.push(`falhou-${id}`),
      });
    return { chamadas, desfeitos, avisos, item };
  };

  it('o 2º apagamento vira "Apagado (2)." e o Desfazer restaura os dois', async () => {
    const x = dois();
    x.item('g1');
    expect(x.avisos.at(-1)!.mensagem).toBe('Apagado.');
    x.item('g2');
    expect(x.avisos.at(-1)!.mensagem).toBe('Apagado (2).');
    x.item('g3');
    expect(x.avisos.at(-1)!.mensagem).toBe('Apagado (3).');
    x.avisos.at(-1)!.acao!.aoTocar();
    expect(x.desfeitos).toEqual(['g1', 'g2', 'g3']);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(x.chamadas).toEqual([]);
    expect(estaPendente('g1') || estaPendente('g2') || estaPendente('g3')).toBe(false);
  });

  it('o prazo de 5 s reinicia a cada novo apagamento; ao expirar os DELETE saem em ordem', async () => {
    const x = dois();
    x.item('h1');
    await vi.advanceTimersByTimeAsync(3000);
    x.item('h2');
    await vi.advanceTimersByTimeAsync(3000); // 6 s desde o 1º, 3 s desde o 2º
    expect(x.chamadas).toEqual([]);
    expect(estaPendente('h1') && estaPendente('h2')).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(x.chamadas).toEqual(['h1', 'h2']);
    expect(estaPendente('h1') || estaPendente('h2')).toBe(false);
  });

  it('uma chamada que falha restaura só aquele item e não impede as outras', async () => {
    const x = dois();
    x.item('f1', { falha: true });
    x.item('f2');
    await vi.advanceTimersByTimeAsync(ESPERA_APAGAR_MS);
    expect(x.chamadas).toEqual(['f1', 'f2']);
    expect(x.desfeitos).toEqual(['falhou-f1']);
  });

  it('só se agrupam avisos iguais ("Descartado." não se mistura com "Apagado.")', async () => {
    const x = dois();
    x.item('k1');
    x.item('k2', { mensagem: 'Descartado.' });
    expect(x.avisos.at(-1)!.mensagem).toBe('Descartado.');
    x.item('k3', { mensagem: 'Descartado.' });
    expect(x.avisos.at(-1)!.mensagem).toBe('Descartado (2).');
    x.avisos.at(-1)!.acao!.aoTocar();
    expect(x.desfeitos).toEqual(['k2', 'k3']);
    await vi.advanceTimersByTimeAsync(ESPERA_APAGAR_MS);
    expect(x.chamadas).toEqual(['k1']);
  });

  it('o mesmo id não entra duas vezes', () => {
    const x = dois();
    x.item('d1');
    x.item('d1');
    expect(x.avisos).toHaveLength(1);
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
