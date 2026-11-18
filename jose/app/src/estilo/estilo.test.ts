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

describe('placeholder dos campos (>= 4,5:1)', () => {
  it('tem cor explícita do tema, sem opacidade reduzida', () => {
    expect(global).toMatch(/::placeholder\s*\{[^}]*color:\s*var\(--texto-2\)[^}]*opacity:\s*1/);
  });
  it.each(['fundo', 'superficie', 'superficie-2'])('texto-2 sobre %s', (fundo) => {
    expect(contraste(cor('texto-2'), cor(fundo))).toBeGreaterThanOrEqual(4.5);
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

describe('layout no iPhone (cartões e José sabe): nada passa da largura', () => {
  const chat = readFileSync(new URL('./chat.css', import.meta.url), 'utf8');
  const regra = (css: string, seletor: string) => css.match(new RegExp(`${seletor.replace(/[.[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  it('o cartão de sugestão quebra palavras longas, não estoura a coluna e seus botões quebram de linha', () => {
    const cartao = regra(chat, '.cartao-sugestao');
    expect(cartao).toMatch(/min-width: 0/);
    expect(cartao).toMatch(/max-width: 100%/);
    expect(cartao).toMatch(/overflow-wrap: anywhere/);
    expect(regra(chat, '.cartao-sugestao__texto')).toMatch(/overflow-wrap: anywhere/);
    expect(regra(chat, '.cartao-sugestao__acoes')).toMatch(/flex-wrap: wrap/);
    expect(regra(chat, '.chips-area')).toMatch(/flex-wrap: wrap/);
    expect(regra(chat, '.cartao-sugestao__campo')).toMatch(/max-width: 100%/);
  });
  it('chips e alvos do cartão têm pelo menos 48px', () => {
    expect(regra(chat, '.chip-area')).toMatch(/min-height: var\(--alvo-minimo\)/);
    expect(regra(chat, '.cartao-sugestao__salvo')).toMatch(/min-height: var\(--alvo-minimo\)/);
  });
  it('campos de texto herdam a fonte (16px ou mais: o iPhone dá zoom em campo menor)', () => {
    expect(regra(chat, '.cartao-sugestao__campo')).toMatch(/font: inherit/);
  });
});

describe('horário e folha de ações (fase 2b)', () => {
  const chat = readFileSync(new URL('./chat.css', import.meta.url), 'utf8');
  it('a hora usa a cor secundária do tema, com contraste >= 4,5:1 sobre o fundo e a superfície', () => {
    expect(chat).toMatch(/\.mensagem__hora\s*\{[^}]*color:\s*var\(--texto-2\)/);
    for (const fundo of ['fundo', 'superficie']) expect(contraste(cor('texto-2'), cor(fundo))).toBeGreaterThanOrEqual(4.5);
  });
  it('o balão que abre ações não deixa o iOS selecionar texto nem abrir o próprio menu', () => {
    expect(chat).toMatch(/\.balao\[data-acoes\]\s*\{[^}]*-webkit-touch-callout:\s*none/);
    expect(chat).toMatch(/\.balao\[data-acoes\]\s*\{[^}]*user-select:\s*none/);
  });
  it('as ações da folha e o ⋯ do topo têm pelo menos 48px; a folha fica acima do aviso e da barra', () => {
    expect(chat).toMatch(/\.folha__acao\s*\{[^}]*min-height:\s*var\(--alvo-minimo\)/);
    expect(chat).toMatch(/\.chat__mais\s*\{[^}]*min-height:\s*var\(--alvo-minimo\)/);
    const z = (re: RegExp, texto: string) => Number(texto.match(re)![1]);
    expect(z(/\.folha-fundo\s*\{[^}]*z-index:\s*(\d+)/, chat)).toBeGreaterThan(z(/\.toast\s*\{[^}]*z-index:\s*(\d+)/s, global));
  });
});

describe('áreas seguras do iPhone', () => {
  const chat = readFileSync(new URL('./chat.css', import.meta.url), 'utf8');
  const tarefas = readFileSync(new URL('./tarefas.css', import.meta.url), 'utf8');
  it('só tokens.css lê env(safe-area-inset-*); o resto usa as variáveis --safe-*', () => {
    expect(css).toMatch(/--safe-top:\s*env\(safe-area-inset-top/);
    for (const arquivo of [chat, global, tarefas]) expect(arquivo).not.toMatch(/env\(safe-area-inset/);
  });
  it('a folha desconta o rodapé seguro no max-height, e a tampa da barra de status fica entre o conteúdo e a faixa offline/gaveta', () => {
    expect(chat).toMatch(/\.folha\s*\{[^}]*max-height:[^;]*var\(--safe-bottom\)/s);
    const z = (re: RegExp, texto: string) => Number(texto.match(re)![1]);
    const tampa = z(/\.tampa-status\s*\{[^}]*z-index:\s*(\d+)/s, global);
    expect(tampa).toBeGreaterThan(z(/\.barra-abas\s*\{[^}]*z-index:\s*(\d+)/s, global));
    expect(tampa).toBeLessThan(z(/\.faixa-offline\s*\{[^}]*z-index:\s*(\d+)/s, global));
    expect(tampa).toBeLessThan(z(/\.gaveta-fundo\s*\{[^}]*z-index:\s*(\d+)/s, chat));
    expect(global).toMatch(/\.tampa-status\s*\{[^}]*height:\s*var\(--safe-top\)/s);
  });
  it('a gaveta reserva topo, esquerda e rodapé; a folha, as laterais; a barra de abas, as laterais e o rodapé', () => {
    expect(chat).toMatch(/\.gaveta\s*\{[^}]*padding:\s*var\(--safe-top\)[^}]*var\(--safe-bottom\)[^}]*var\(--safe-left\)/s);
    expect(chat).toMatch(/\.folha\s*\{[^}]*--safe-right[^}]*--safe-left/s);
    expect(chat).toMatch(/\.folha\s*\{[^}]*bottom:\s*calc\([^;]*var\(--safe-bottom\)/s);
    expect(global).toMatch(/\.barra-abas\s*\{[^}]*padding:\s*0 var\(--safe-right\) var\(--safe-bottom\) var\(--safe-left\)/s);
    expect(global).toMatch(/\.casca\s*\{[^}]*padding:\s*var\(--safe-top\)/);
    expect(global).toMatch(/\.faixa-offline\s*\{[^}]*top:\s*var\(--safe-top\)/s);
  });
});
