// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroHttp } from '../api/cliente';
import type { SugestaoDoChat } from '../estado/chat';
import { ESPERA_APAGAR_MS } from '../estado/apagar-com-desfazer';
import { CartaoSugestao } from './CartaoSugestao';
import { ToastProvider } from './Toast';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let raiz: Root;
let contenedor: HTMLElement;
let seq = 0;
const memoria = (extra: Partial<SugestaoDoChat> = {}): SugestaoDoChat => ({ id: `s${++seq}`, tipo: 'memoria', conteudo: { texto: 'Acorda às 6h.', area: 'saude' }, status: 'pendente', ...extra });

beforeEach(() => {
  vi.useFakeTimers();
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});
afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.useRealTimers();
});

function montar(sugestao: SugestaoDoChat, extra: { salvar?: ReturnType<typeof vi.fn>; descartar?: ReturnType<typeof vi.fn> } = {}) {
  const aoMudar = vi.fn();
  const salvar = extra.salvar ?? vi.fn(async (_id: string, c?: { texto: string; area: string }) => ({ item: { id: 'i1', texto: c?.texto ?? 'Acorda às 6h.', area: c?.area ?? 'saude', origem: 'chat', criada_em: '', atualizada_em: null } }));
  const descartar = extra.descartar ?? vi.fn(async () => {});
  act(() => {
    raiz.render(
      <MemoryRouter>
        <ToastProvider>
          <CartaoSugestao sugestao={sugestao} aoMudar={aoMudar} salvar={salvar as never} descartar={descartar as never} />
        </ToastProvider>
      </MemoryRouter>,
    );
  });
  return { aoMudar, salvar, descartar };
}
const botao = (nome: string | RegExp) => [...contenedor.querySelectorAll('button')].find((b) => (typeof nome === 'string' ? b.textContent?.trim() === nome : nome.test(b.textContent ?? '')))!;
const tocar = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };
const digitar = async (el: HTMLTextAreaElement, valor: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const toast = () => document.querySelector('.toast')?.textContent ?? '';

describe('CartaoSugestao (memória)', () => {
  it('mostra 🧠, o texto, a área e os três botões; nada é salvo sem o toque', async () => {
    const x = montar(memoria());
    expect(contenedor.textContent).toContain('🧠');
    expect(contenedor.textContent).toContain('Acorda às 6h.');
    expect(contenedor.textContent).toContain('Saúde e rotina');
    for (const n of ['Salvar', 'Editar', 'Descartar']) expect(botao(n)).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(x.salvar).not.toHaveBeenCalled();
    expect(x.descartar).not.toHaveBeenCalled();
    expect(x.aoMudar).not.toHaveBeenCalled();
  });

  it('Salvar chama a API uma vez (sem editar: sem conteúdo) e vira "✓ Salvo em José sabe"', async () => {
    const s = memoria();
    const x = montar(s);
    await tocar(botao('Salvar'));
    expect(x.salvar).toHaveBeenCalledTimes(1);
    expect(x.salvar).toHaveBeenCalledWith(s.id, undefined);
    expect(x.aoMudar).toHaveBeenCalledWith(s.id, { status: 'salva', conteudo: { texto: 'Acorda às 6h.', area: 'saude' } });
    // o Chat guarda o status; ao re-renderizar com "salva" o cartão mostra o selo
    act(() => raiz.render(<MemoryRouter><ToastProvider><CartaoSugestao sugestao={{ ...s, status: 'salva' }} aoMudar={x.aoMudar} /></ToastProvider></MemoryRouter>));
    const selo = contenedor.querySelector('a.cartao-sugestao__salvo')!;
    expect(selo.textContent).toBe('✓ Salvo em José sabe');
    expect(selo.getAttribute('href')).toBe('/jose-sabe');
    expect(contenedor.querySelectorAll('button')).toHaveLength(0);
  });

  it('Editar: muda texto e área com os chips, e salva o conteúdo editado', async () => {
    const s = memoria();
    const x = montar(s);
    await tocar(botao('Editar'));
    const campo = contenedor.querySelector('textarea')!;
    expect(campo.value).toBe('Acorda às 6h.');
    expect(campo.maxLength).toBe(300);
    const chips = [...contenedor.querySelectorAll('[role="radio"]')];
    expect(chips.map((c) => c.textContent)).toEqual(['Sobre mim', 'Trabalho', 'Finanças', 'Saúde e rotina', 'Família e casa']);
    expect(chips.map((c) => c.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false', 'true', 'false']);
    await digitar(campo, '  Acorda às 5h30.  ');
    await tocar(chips[0]!);
    expect(contenedor.querySelector('[aria-checked="true"]')!.textContent).toBe('Sobre mim');
    expect(x.salvar).not.toHaveBeenCalled(); // editar não salva
    await tocar(botao('Salvar'));
    expect(x.salvar).toHaveBeenCalledWith(s.id, { texto: 'Acorda às 5h30.', area: 'sobre_mim' });
  });

  it('Editar: texto vazio ou só espaços não vai ao servidor; Cancelar descarta a edição', async () => {
    const x = montar(memoria());
    await tocar(botao('Editar'));
    await digitar(contenedor.querySelector('textarea')!, '   ');
    await tocar(botao('Salvar'));
    expect(x.salvar).not.toHaveBeenCalled();
    expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe('Texto obrigatório');
    await tocar(botao('Cancelar'));
    expect(contenedor.querySelector('textarea')).toBeNull();
    expect(contenedor.textContent).toContain('Acorda às 6h.');
  });

  it('erro ao salvar: "Não salvou." e "Tentar de novo" salva na segunda tentativa', async () => {
    const salvar = vi.fn()
      .mockRejectedValueOnce(new ErroHttp(500, 'erro_interno', 'x'))
      .mockResolvedValueOnce({ item: { id: 'i1', texto: 'Acorda às 6h.', area: 'saude', origem: 'chat', criada_em: '', atualizada_em: null } });
    const s = memoria();
    const x = montar(s, { salvar });
    await tocar(botao('Salvar'));
    expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe('Não salvou.');
    expect(x.aoMudar).not.toHaveBeenCalled();
    await tocar(botao('Tentar de novo'));
    expect(salvar).toHaveBeenCalledTimes(2);
    expect(x.aoMudar).toHaveBeenCalledWith(s.id, expect.objectContaining({ status: 'salva' }));
  });

  it('409 (já tratada em outro lugar): avisa e não oferece tentar de novo', async () => {
    montar(memoria(), { salvar: vi.fn().mockRejectedValue(new ErroHttp(409, 'sugestao_ja_tratada', 'x')) });
    await tocar(botao('Salvar'));
    expect(contenedor.querySelector('[role="alert"]')?.textContent).toContain('já foi salva ou descartada');
    expect(botao('Tentar de novo')).toBeUndefined();
  });

  it('Descartar recolhe o cartão com "Descartado. Desfazer"; só chama a API depois de 5 s', async () => {
    const s = memoria();
    const x = montar(s);
    await tocar(botao('Descartar'));
    expect(contenedor.querySelector('article')).toBeNull();
    expect(toast()).toContain('Descartado.');
    expect(toast()).toContain('Desfazer');
    await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_APAGAR_MS - 1); });
    expect(x.descartar).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(x.descartar).toHaveBeenCalledWith(s.id);
    expect(x.aoMudar).toHaveBeenCalledWith(s.id, { status: 'descartada' });
  });

  it('Desfazer traz o cartão de volta e a API nunca é chamada', async () => {
    const x = montar(memoria());
    await tocar(botao('Descartar'));
    await tocar(document.querySelector('.toast__acao')!);
    expect(contenedor.querySelector('article')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_APAGAR_MS * 2); });
    expect(x.descartar).not.toHaveBeenCalled();
  });

  it('falha ao descartar: o cartão volta e avisa', async () => {
    montar(memoria(), { descartar: vi.fn().mockRejectedValue(new ErroHttp(500, 'erro_interno', 'x')) });
    await tocar(botao('Descartar'));
    await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_APAGAR_MS); });
    expect(contenedor.querySelector('article')).not.toBeNull();
    expect(toast()).toContain('Não foi possível descartar.');
  });

  it('descartada ou de outro tipo (tarefa/meta, onda 5) não aparece', () => {
    montar(memoria({ status: 'descartada' }));
    expect(contenedor.querySelector('article')).toBeNull();
    montar(memoria({ tipo: 'tarefa', conteudo: { titulo: 'x', area: 'casa' } }));
    expect(contenedor.querySelector('article')).toBeNull();
    montar(memoria({ conteudo: { texto: '', area: 'nada' } }));
    expect(contenedor.querySelector('article')).toBeNull();
  });

  it('aguenta texto de 300 caracteres e palavra de 80 sem quebrar a lógica (o CSS quebra a linha)', async () => {
    const longo = `${'A'.repeat(80)} ${'b'.repeat(218)}`;
    const s = memoria({ conteudo: { texto: longo, area: 'trabalho' } });
    const x = montar(s);
    expect(contenedor.textContent).toContain('A'.repeat(80));
    await tocar(botao('Editar'));
    expect(contenedor.querySelector('textarea')!.value).toBe(longo);
    expect(contenedor.textContent).toContain('299/300');
    await tocar(botao('Salvar'));
    expect(x.salvar).toHaveBeenCalledWith(s.id, { texto: longo, area: 'trabalho' });
  });
});
