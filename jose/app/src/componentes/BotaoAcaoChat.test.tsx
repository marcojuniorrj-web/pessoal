// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JANELA_ABERTURA_MS } from '../estado/pressao-longa';
import { BarraGravacao } from './BarraGravacao';
import { BotaoAcaoChat, type ModoAcao } from './BotaoAcaoChat';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let raiz: Root;
let contenedor: HTMLElement;
beforeEach(() => {
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});
afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.restoreAllMocks();
});

const botao = () => contenedor.querySelector('button.chat__acao') as HTMLButtonElement;
function montarAcao(modo: ModoAcao, desabilitado = false) {
  const acoes = { aoMicrofone: vi.fn(), aoEnviar: vi.fn(), aoParar: vi.fn() };
  act(() => raiz.render(<BotaoAcaoChat modo={modo} desabilitado={desabilitado} {...acoes} />));
  return acoes;
}
/** Clique de mouse/toque de verdade: detail 1, precedido de um pointerdown no instante `quando` (performance.now()). */
const tocar = (el: Element, quando: number) =>
  act(() => {
    const down = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(down, 'timeStamp', { value: quando });
    el.dispatchEvent(down);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
const aindaNaJanela = () => performance.now() + JANELA_ABERTURA_MS / 2;
const depoisDaJanela = () => performance.now() + JANELA_ABERTURA_MS + 5000;

describe('BotaoAcaoChat', () => {
  it('campo vazio: 🎤 com rótulo, ícone SVG (sem emoji) e toque inicia a gravação', () => {
    const a = montarAcao('microfone');
    expect(botao().getAttribute('aria-label')).toBe('Gravar áudio');
    expect(botao().querySelector('svg')).not.toBeNull();
    expect(botao().textContent).toBe('');
    tocar(botao(), aindaNaJanela());
    expect(a.aoMicrofone).toHaveBeenCalledTimes(1);
    expect(a.aoEnviar).not.toHaveBeenCalled();
  });

  it('com texto: vira Enviar (o mesmo botão) e o toque envia', () => {
    const a = montarAcao('enviar');
    expect(botao().getAttribute('aria-label')).toBe('Enviar');
    expect(botao().textContent).toBe('➤');
    tocar(botao(), aindaNaJanela());
    expect(a.aoEnviar).toHaveBeenCalledTimes(1);
    expect(a.aoMicrofone).not.toHaveBeenCalled();
  });

  it('o elemento é o mesmo ao trocar de modo (o foco não se perde)', () => {
    montarAcao('microfone');
    const antes = botao();
    montarAcao('enviar');
    expect(botao()).toBe(antes);
    montarAcao('parar');
    expect(botao()).toBe(antes);
  });

  it('desabilitado (offline ou José respondendo): 🎤 e Enviar não agem', () => {
    for (const modo of ['microfone', 'enviar'] as const) {
      const a = montarAcao(modo, true);
      expect(botao().disabled).toBe(true);
      botao().click();
      expect(a.aoMicrofone).not.toHaveBeenCalled();
      expect(a.aoEnviar).not.toHaveBeenCalled();
    }
  });

  it('gravando: ■ "Parar e enviar áudio", habilitado, e só age com toque depois da janela de abertura', () => {
    const a = montarAcao('parar', true); // mesmo "desabilitado" (offline) o ■ continua valendo
    expect(botao().getAttribute('aria-label')).toBe('Parar e enviar áudio');
    expect(botao().disabled).toBe(false);
    expect(botao().querySelector('svg')).not.toBeNull();
    tocar(botao(), aindaNaJanela()); // clique fantasma do mesmo toque que iniciou
    expect(a.aoParar).not.toHaveBeenCalled();
    tocar(botao(), depoisDaJanela());
    expect(a.aoParar).toHaveBeenCalledTimes(1);
  });

  it('gravando: o teclado (Enter/Espaço, clique com detail 0) sempre para', () => {
    const a = montarAcao('parar');
    botao().click();
    expect(a.aoParar).toHaveBeenCalledTimes(1);
  });

  it('gravando: clique solto, sem pointerdown, não para (toque fantasma)', () => {
    const a = montarAcao('parar');
    act(() => botao().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
    expect(a.aoParar).not.toHaveBeenCalled();
  });

  it('transcrevendo: ocupado (spinner, aria-busy), não age e mantém o foco', () => {
    const a = montarAcao('transcrevendo');
    expect(botao().getAttribute('aria-label')).toBe('Transcrevendo áudio');
    expect(botao().getAttribute('aria-busy')).toBe('true');
    expect(botao().getAttribute('aria-disabled')).toBe('true');
    expect(botao().querySelector('.spinner')).not.toBeNull();
    botao().focus();
    botao().click();
    expect(Object.values(a).every((f) => f.mock.calls.length === 0)).toBe(true);
    expect(document.activeElement).toBe(botao());
  });
});

describe('BarraGravacao', () => {
  const barra = (fase: 'gravando' | 'transcrevendo', restanteMs: number) => {
    const aoCancelar = vi.fn();
    act(() => raiz.render(<BarraGravacao fase={fase} restanteMs={restanteMs} aoCancelar={aoCancelar} />));
    return aoCancelar;
  };
  const cancelar = () => contenedor.querySelector('button.chat__cancelar-gravacao') as HTMLButtonElement;

  it('gravando: ✕ com rótulo, ponto pulsante e contador regressivo a partir de 2:00', () => {
    barra('gravando', 120_000);
    expect(cancelar().getAttribute('aria-label')).toBe('Cancelar gravação');
    expect(cancelar().querySelector('svg')).not.toBeNull();
    expect(contenedor.querySelector('.gravacao__ponto')).not.toBeNull();
    expect(contenedor.querySelector('.gravacao__tempo')?.textContent).toBe('2:00');
    expect(contenedor.querySelector('[role="timer"]')?.getAttribute('aria-label')).toBe('Gravando, tempo restante');
    barra('gravando', 59_000);
    expect(contenedor.querySelector('.gravacao__tempo')?.textContent).toBe('0:59');
    barra('gravando', 0);
    expect(contenedor.querySelector('.gravacao__tempo')?.textContent).toBe('0:00');
  });

  it('✕ cancela só com toque depois da janela de abertura (ou pelo teclado)', () => {
    const aoCancelar = barra('gravando', 100_000);
    tocar(cancelar(), aindaNaJanela());
    expect(aoCancelar).not.toHaveBeenCalled();
    tocar(cancelar(), depoisDaJanela());
    expect(aoCancelar).toHaveBeenCalledTimes(1);
    cancelar().click();
    expect(aoCancelar).toHaveBeenCalledTimes(2);
  });

  it('transcrevendo: mostra "Transcrevendo áudio…" (status) e não tem ✕ nem contador', () => {
    barra('transcrevendo', 120_000);
    expect(contenedor.querySelector('[role="status"]')?.textContent).toBe('Transcrevendo áudio…');
    expect(cancelar()).toBeNull();
    expect(contenedor.querySelector('.gravacao__tempo')).toBeNull();
  });
});
