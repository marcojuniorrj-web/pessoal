import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { contraste } from './contraste';
import { criarFilaToast, DURACAO_TOAST_MS } from '../estado/fila-toast';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const global = readFileSync(new URL('./global.css', import.meta.url), 'utf8');
const cor = (nome: string) => css.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`))![1]!;

describe('contraste AA (>= 4,5:1 para texto)', () => {
  const pares: [string, string][] = [
    ['texto', 'fundo'], ['texto', 'superficie'], ['texto', 'superficie-2'],
    ['texto-2', 'fundo'], ['texto-2', 'superficie'],
    ['destaque', 'fundo'], ['destaque', 'superficie-2'], ['texto-sobre-destaque', 'destaque'],
    ['sucesso', 'fundo'], ['erro', 'fundo'], ['erro', 'superficie-2'],
    ...['trabalho', 'financas', 'saude', 'casa', 'sobre_mim'].map((a) => [`area-${a}-texto`, `area-${a}-fundo`] as [string, string]),
  ];
  it.each(pares)('%s sobre %s', (frente, fundo) => {
    expect(contraste(cor(frente), cor(fundo))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('acessibilidade no CSS', () => {
  it('respeita "reduzir movimento"', () => {
    expect(global).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
  it('botões e alvos têm pelo menos 48px', () => {
    expect(css).toMatch(/--alvo-minimo:\s*48px/);
    expect(global).toMatch(/\.botao\s*\{[^}]*min-height: var\(--alvo-minimo\)/);
    expect(global).toMatch(/\.toast__acao\s*\{[^}]*min-height: var\(--alvo-minimo\)/);
  });
});

describe('fila de Toast (1 por vez, 4 s)', () => {
  it('mostra, expira em 4 s e um novo aviso substitui o atual', async () => {
    vi.useFakeTimers();
    const fila = criarFilaToast();
    fila.mostrar('Primeiro');
    expect(fila.obter()?.mensagem).toBe('Primeiro');
    vi.advanceTimersByTime(DURACAO_TOAST_MS - 1);
    expect(fila.obter()?.mensagem).toBe('Primeiro');
    fila.mostrar('Segundo');
    vi.advanceTimersByTime(DURACAO_TOAST_MS - 1);
    expect(fila.obter()?.mensagem).toBe('Segundo'); // o timer do primeiro foi cancelado
    vi.advanceTimersByTime(1);
    expect(fila.obter()).toBeNull();
    vi.useRealTimers();
  });
  it('notifica os ouvintes', () => {
    const fila = criarFilaToast();
    let n = 0;
    const sair = fila.assinar(() => n++);
    fila.mostrar('a');
    fila.fechar();
    sair();
    fila.mostrar('b');
    expect(n).toBe(2);
    fila.fechar();
  });
});
