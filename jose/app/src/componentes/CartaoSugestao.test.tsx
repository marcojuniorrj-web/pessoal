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

function montar(sugestao: SugestaoDoChat, extra: { salvar?: ReturnType<typeof vi.fn>; descartar?: ReturnType<typeof vi.fn>; agora?: () => Date } = {}) {
  const aoMudar = vi.fn();
  const salvar = extra.salvar ?? vi.fn(async (_id: string, c?: { texto: string; area: string }) => ({ item: { id: 'i1', texto: c?.texto ?? 'Acorda às 6h.', area: c?.area ?? 'saude', origem: 'chat', criada_em: '', atualizada_em: null } }));
  const descartar = extra.descartar ?? vi.fn(async () => {});
  act(() => {
    raiz.render(
      <MemoryRouter>
        <ToastProvider>
          <CartaoSugestao sugestao={sugestao} aoMudar={aoMudar} salvar={salvar as never} descartar={descartar as never} agora={extra.agora} />
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

  it('descartada ou com conteúdo fora do formato não aparece', () => {
    montar(memoria({ status: 'descartada' }));
    expect(contenedor.querySelector('article')).toBeNull();
    montar(memoria({ conteudo: { texto: '', area: 'nada' } }));
    expect(contenedor.querySelector('article')).toBeNull();
    montar(memoria({ tipo: 'tarefa', conteudo: { texto: 'isto é de memória', area: 'casa' } }));
    expect(contenedor.querySelector('article')).toBeNull();
    montar(memoria({ tipo: 'meta', conteudo: { titulo: 'x'.repeat(121), area: 'casa' } }));
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

// ---- 📌 tarefa e 🎯 meta (tarefa 5.5) ----
const sp = (iso: string) => new Date(`${iso}-03:00`);
const HOJE = () => sp('2026-11-17T10:00:00'); // terça-feira
const item = (tipo: 'tarefa' | 'meta', extra: Partial<SugestaoDoChat> = {}): SugestaoDoChat => ({
  id: `s${++seq}`, tipo, conteudo: { titulo: 'Revisar a proposta do cliente', area: 'trabalho', prazo: '2026-11-20' }, status: 'pendente', ...extra,
});
const itemSalvo = (c: { titulo: string; area: string; prazo?: string | null }) => ({ item: { id: 'i1', titulo: c.titulo, area: c.area, prazo: c.prazo ?? null, origem: 'chat', criada_em: '' } });
const salvarItem = () => vi.fn(async (_id: string, c?: { titulo: string; area: string; prazo: string | null }) => itemSalvo(c ?? { titulo: 'Revisar a proposta do cliente', area: 'trabalho', prazo: '2026-11-20' }));
const digitarData = async (el: HTMLInputElement, valor: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('CartaoSugestao (📌 tarefa)', () => {
  it('mostra 📌, o título, a área, o prazo (com o relógio fixo) e os três botões', () => {
    montar(item('tarefa'), { agora: HOJE });
    expect(contenedor.textContent).toContain('📌');
    expect(contenedor.textContent).toContain('Tarefa');
    expect(contenedor.textContent).toContain('Revisar a proposta do cliente');
    expect(contenedor.textContent).toContain('Trabalho');
    expect(contenedor.querySelector('.cartao-sugestao__prazo')?.textContent).toBe('Prazo: sex, 20/11');
    expect(contenedor.querySelector('article')!.getAttribute('aria-label')).toBe('Tarefa sugerida');
    for (const n of ['Salvar', 'Editar', 'Descartar']) expect(botao(n)).toBeTruthy();
  });

  it('o rótulo do prazo segue a virada do dia (Hoje / Amanhã) e não aparece sem prazo', () => {
    montar(item('tarefa', { conteudo: { titulo: 'X', area: 'casa', prazo: '2026-11-17' } }), { agora: () => sp('2026-11-17T23:59:00') });
    expect(contenedor.querySelector('.cartao-sugestao__prazo')?.textContent).toBe('Prazo: Hoje');
    montar(item('tarefa', { conteudo: { titulo: 'X', area: 'casa', prazo: '2026-11-17' } }), { agora: () => sp('2026-11-18T00:01:00') });
    expect(contenedor.querySelector('.cartao-sugestao__prazo')?.textContent).toBe('Prazo: Ontem');
    montar(item('tarefa', { conteudo: { titulo: 'Sem prazo', area: 'casa' } }));
    expect(contenedor.querySelector('.cartao-sugestao__prazo')).toBeNull();
  });

  it('Salvar chama a API uma vez, avisa o Chat com o conteúdo do item criado e vira "✓ Salvo em Tarefas"', async () => {
    const s = item('tarefa');
    const salvar = salvarItem();
    const x = montar(s, { salvar });
    await tocar(botao('Salvar'));
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(salvar).toHaveBeenCalledWith(s.id, undefined);
    expect(x.aoMudar).toHaveBeenCalledWith(s.id, { status: 'salva', conteudo: { titulo: 'Revisar a proposta do cliente', area: 'trabalho', prazo: '2026-11-20' } });
    act(() => raiz.render(<MemoryRouter><ToastProvider><CartaoSugestao sugestao={{ ...s, status: 'salva' }} aoMudar={x.aoMudar} agora={HOJE} /></ToastProvider></MemoryRouter>));
    const selo = contenedor.querySelector('a.cartao-sugestao__salvo')!;
    expect(selo.textContent).toBe('✓ Salvo em Tarefas');
    expect(selo.getAttribute('href')).toBe('/tarefas');
    expect(contenedor.querySelector('article')!.getAttribute('aria-label')).toBe('Tarefa salva');
    expect(contenedor.querySelectorAll('button')).toHaveLength(0);
  });

  it('Editar: título, chips das 4 áreas (sem "Sobre mim") e seletor de prazo; salva o conteúdo editado', async () => {
    const s = item('tarefa');
    const salvar = salvarItem();
    montar(s, { salvar });
    await tocar(botao('Editar'));
    const campo = contenedor.querySelector('textarea')!;
    expect(campo.value).toBe('Revisar a proposta do cliente');
    expect(campo.maxLength).toBe(120);
    expect(contenedor.textContent).toContain('29/120');
    const chips = [...contenedor.querySelectorAll('[role="radio"]')];
    expect(chips.map((c) => c.textContent)).toEqual(['Trabalho', 'Finanças', 'Saúde e rotina', 'Família e casa']);
    expect(chips.map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
    const data = contenedor.querySelector<HTMLInputElement>('input[type="date"]')!;
    expect(data.value).toBe('2026-11-20');
    expect(contenedor.textContent).toContain('Prazo (opcional)');
    await digitar(campo, '  Revisar e enviar a proposta  ');
    await tocar(chips[3]!);
    await digitarData(data, '2026-11-24');
    expect(salvar).not.toHaveBeenCalled(); // editar não salva
    await tocar(botao('Salvar'));
    expect(salvar).toHaveBeenCalledWith(s.id, { titulo: 'Revisar e enviar a proposta', area: 'casa', prazo: '2026-11-24' });
  });

  it('Editar: "Sem prazo" limpa o campo e salva com prazo nulo; uma tarefa sem prazo pode ganhar um', async () => {
    const s = item('tarefa');
    const salvar = salvarItem();
    montar(s, { salvar });
    await tocar(botao('Editar'));
    await tocar(botao('Sem prazo'));
    expect(contenedor.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe('');
    expect(botao('Sem prazo')).toBeUndefined(); // sem prazo, o botão some
    await tocar(botao('Salvar'));
    expect(salvar).toHaveBeenCalledWith(s.id, { titulo: 'Revisar a proposta do cliente', area: 'trabalho', prazo: null });
  });

  it('Editar: título vazio não vai ao servidor; Cancelar descarta a edição', async () => {
    const x = montar(item('tarefa'));
    await tocar(botao('Editar'));
    await digitar(contenedor.querySelector('textarea')!, '   ');
    await tocar(botao('Salvar'));
    expect(x.salvar).not.toHaveBeenCalled();
    expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe('Título obrigatório');
    await tocar(botao('Cancelar'));
    expect(contenedor.querySelector('textarea')).toBeNull();
    expect(contenedor.textContent).toContain('Revisar a proposta do cliente');
  });

  it('a quebra de linha do teclado vira espaço (o título é uma linha só)', async () => {
    montar(item('tarefa'));
    await tocar(botao('Editar'));
    await digitar(contenedor.querySelector('textarea')!, 'Ligar\npara o banco');
    expect(contenedor.querySelector('textarea')!.value).toBe('Ligar para o banco');
  });

  it('Esc sai da edição sem salvar e devolve o foco ao botão Editar', async () => {
    const x = montar(item('tarefa'));
    await tocar(botao('Editar'));
    expect(document.activeElement).toBe(contenedor.querySelector('textarea'));
    await act(async () => { contenedor.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(contenedor.querySelector('textarea')).toBeNull();
    expect(document.activeElement).toBe(botao('Editar'));
    expect(x.salvar).not.toHaveBeenCalled();
  });

  it('erro ao salvar: "Não salvou." e "Tentar de novo" salva na segunda tentativa; 409 não oferece tentar de novo', async () => {
    const salvar = vi.fn().mockRejectedValueOnce(new ErroHttp(500, 'erro_interno', 'x')).mockResolvedValueOnce(itemSalvo({ titulo: 'Revisar a proposta do cliente', area: 'trabalho', prazo: '2026-11-20' }));
    const s = item('tarefa');
    const x = montar(s, { salvar });
    await tocar(botao('Salvar'));
    expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe('Não salvou.');
    await tocar(botao('Tentar de novo'));
    expect(salvar).toHaveBeenCalledTimes(2);
    expect(x.aoMudar).toHaveBeenCalledWith(s.id, expect.objectContaining({ status: 'salva' }));
    act(() => raiz.unmount());
    contenedor.innerHTML = '';
    raiz = createRoot(contenedor);
    montar(item('tarefa'), { salvar: vi.fn().mockRejectedValue(new ErroHttp(409, 'sugestao_ja_tratada', 'x')) });
    await tocar(botao('Salvar'));
    expect(contenedor.querySelector('[role="alert"]')?.textContent).toContain('já foi salva ou descartada');
    expect(botao('Tentar de novo')).toBeUndefined();
  });

  it('Descartar recolhe o cartão com "Descartado. Desfazer" e só chama a API depois de 5 s', async () => {
    const s = item('tarefa');
    const x = montar(s);
    await tocar(botao('Descartar'));
    expect(contenedor.querySelector('article')).toBeNull();
    expect(toast()).toContain('Descartado.');
    await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_APAGAR_MS - 1); });
    expect(x.descartar).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(x.descartar).toHaveBeenCalledWith(s.id);
    expect(x.aoMudar).toHaveBeenCalledWith(s.id, { status: 'descartada' });
  });

  it('título de 120 caracteres com palavra de 80 sem espaço: aparece inteiro e salva', async () => {
    const longo = `${'A'.repeat(80)} ${'b'.repeat(39)}`;
    const s = item('tarefa', { conteudo: { titulo: longo, area: 'casa' } });
    const salvar = salvarItem();
    montar(s, { salvar });
    expect(contenedor.textContent).toContain('A'.repeat(80));
    await tocar(botao('Editar'));
    expect(contenedor.textContent).toContain('120/120');
    await tocar(botao('Salvar'));
    expect(salvar).toHaveBeenCalledWith(s.id, { titulo: longo, area: 'casa', prazo: null });
  });
});

describe('CartaoSugestao (🎯 meta)', () => {
  it('mostra 🎯, o título, a área e o prazo (com o ano quando não é o de hoje); salva e vira "✓ Salvo em Metas"', async () => {
    const s = item('meta', { conteudo: { titulo: 'Correr uma meia-maratona', area: 'saude', prazo: '2027-11-14' } });
    const salvar = salvarItem();
    const x = montar(s, { salvar, agora: HOJE });
    expect(contenedor.textContent).toContain('🎯');
    expect(contenedor.textContent).toContain('Meta');
    expect(contenedor.textContent).toContain('Saúde e rotina');
    expect(contenedor.querySelector('.cartao-sugestao__prazo')?.textContent).toBe('Prazo: dom, 14/11/2027');
    expect(contenedor.querySelector('article')!.getAttribute('aria-label')).toBe('Meta sugerida');
    await tocar(botao('Salvar'));
    expect(x.aoMudar).toHaveBeenCalledWith(s.id, { status: 'salva', conteudo: expect.objectContaining({ titulo: 'Revisar a proposta do cliente' }) });
    act(() => raiz.render(<MemoryRouter><ToastProvider><CartaoSugestao sugestao={{ ...s, status: 'salva' }} aoMudar={x.aoMudar} /></ToastProvider></MemoryRouter>));
    const selo = contenedor.querySelector('a.cartao-sugestao__salvo')!;
    expect(selo.textContent).toBe('✓ Salvo em Metas');
    expect(selo.getAttribute('href')).toBe('/tarefas?aba=metas');
  });

  it('Editar usa os nomes de meta e salva o editado', async () => {
    const s = item('meta', { conteudo: { titulo: 'Correr', area: 'saude' } });
    const salvar = salvarItem();
    montar(s, { salvar });
    await tocar(botao('Editar'));
    expect(contenedor.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('Área da meta');
    expect(contenedor.querySelector('label.so-leitor')!.textContent).toBe('Título da meta');
    await digitar(contenedor.querySelector('textarea')!, 'Correr uma meia-maratona');
    await tocar(botao('Salvar'));
    expect(salvar).toHaveBeenCalledWith(s.id, { titulo: 'Correr uma meia-maratona', area: 'saude', prazo: null });
  });
});
