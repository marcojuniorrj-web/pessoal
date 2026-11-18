import { describe, expect, it } from 'vitest';
import type { SugestaoDoChat } from './chat';
import { contarMarcados, erroDoItem, montarItens, montarLote, rotuloMarcadas, sugestoesDaLista } from './lista-aprendi';

const mem = (id: string, texto: string, area = 'saude', status: SugestaoDoChat['status'] = 'pendente'): SugestaoDoChat => ({ id, tipo: 'memoria', conteudo: { texto, area }, status });
const quatro = [mem('a', 'Acorda às 6h.'), mem('b', 'Dorme às 22h30.'), mem('c', 'Quer correr uma meia-maratona.', 'sobre_mim'), mem('d', 'Trava ao começar tarefas grandes.', 'sobre_mim')];

describe('sugestoesDaLista', () => {
  it('só memórias pendentes e válidas: salva, descartada, tarefa e conteúdo quebrado ficam de fora', () => {
    const lista = [mem('a', 'ok'), mem('b', 'salva', 'casa', 'salva'), mem('c', 'desc', 'casa', 'descartada'), { id: 'd', tipo: 'tarefa', conteudo: { titulo: 'x', area: 'casa' }, status: 'pendente' } as SugestaoDoChat, { id: 'e', tipo: 'memoria', conteudo: { texto: 1 }, status: 'pendente' } as SugestaoDoChat];
    expect(sugestoesDaLista(lista).map((s) => s.id)).toEqual(['a']);
  });
});

describe('montarItens', () => {
  it('tudo marcado no começo, com o texto e a área do José', () => {
    expect(montarItens(quatro, {})[1]).toEqual({ id: 'b', marcado: true, texto: 'Dorme às 22h30.', area: 'saude' });
    expect(contarMarcados(montarItens(quatro, {}))).toBe(4);
  });
  it('as edições do Marco ficam por cima (caixa, texto, área)', () => {
    const itens = montarItens(quatro, { b: { marcado: false }, c: { texto: 'Quer correr a meia de 2027.', area: 'saude' } });
    expect(itens.map((i) => i.marcado)).toEqual([true, false, true, true]);
    expect(itens[2]).toMatchObject({ texto: 'Quer correr a meia de 2027.', area: 'saude' });
    expect(rotuloMarcadas(itens)).toBe('3 de 4 marcadas');
  });
  it('um cartão salvo ou descartado nunca reaparece como pendente', () => {
    const itens = montarItens([...quatro.slice(0, 2), mem('c', 'x', 'casa', 'salva'), mem('d', 'y', 'casa', 'descartada')], {});
    expect(itens.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('montarLote: salvar 2 de 4', () => {
  it('as marcadas vão em salvar (editadas) e as desmarcadas em descartar', () => {
    const itens = montarItens(quatro, { b: { marcado: false }, d: { marcado: false }, c: { texto: '  Quer correr a meia de 2027.  ', area: 'saude' } });
    expect(montarLote(itens)).toEqual({
      ok: true,
      lote: {
        salvar: [{ id: 'a', conteudo: { texto: 'Acorda às 6h.', area: 'saude' } }, { id: 'c', conteudo: { texto: 'Quer correr a meia de 2027.', area: 'saude' } }],
        descartar: ['b', 'd'],
      },
    });
  });
  it('todas desmarcadas: só descarta (concluir sem salvar)', () => {
    const itens = montarItens(quatro, { a: { marcado: false }, b: { marcado: false }, c: { marcado: false }, d: { marcado: false } });
    expect(montarLote(itens)).toMatchObject({ ok: true, lote: { salvar: [], descartar: ['a', 'b', 'c', 'd'] } });
  });
  it('texto vazio ou grande demais em item marcado bloqueia (e aponta o item); desmarcado não conta', () => {
    expect(montarLote(montarItens(quatro, { b: { texto: '   ' } }))).toEqual({ ok: false, primeiroComErro: 'b' });
    expect(montarLote(montarItens(quatro, { c: { texto: 'x'.repeat(301) } }))).toEqual({ ok: false, primeiroComErro: 'c' });
    expect(montarLote(montarItens(quatro, { b: { texto: '', marcado: false } })).ok).toBe(true);
  });
  it('aceita exatamente 300 caracteres e uma palavra de 80 sem espaços', () => {
    expect(montarLote(montarItens(quatro, { a: { texto: 'x'.repeat(300) }, b: { texto: 'A'.repeat(80) } })).ok).toBe(true);
  });
  it('erroDoItem', () => {
    expect(erroDoItem({ id: 'x', marcado: true, texto: '', area: 'casa' })).toBe('Escreva o texto ou desmarque.');
    expect(erroDoItem({ id: 'x', marcado: false, texto: '', area: 'casa' })).toBeNull();
  });
});
