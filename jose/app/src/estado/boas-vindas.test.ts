import { beforeEach, describe, expect, it, vi } from 'vitest';

const criar = vi.fn();
vi.mock('../api/boasvindas', () => ({ criarConversaBoasVindas: () => criar() }));

const { abrirBoasVindas, caminhoBoasVindas, conversaParaRetomar, criarBoasVindasUnica, destinoInicial } = await import('./boas-vindas');

beforeEach(() => criar.mockReset());

describe('destinoInicial (roteamento depois do login)', () => {
  it('boas-vindas não concluídas → Boas-vindas (sem conversa na URL)', () => {
    expect(destinoInicial({ boas_vindas_concluida: false }, {})).toBe('boas-vindas');
    expect(destinoInicial({ boas_vindas_concluida: false }, { c: null, nova: false })).toBe('boas-vindas');
  });
  it('concluídas → Chat: a flag manda, nunca prende quem já usou o app', () => {
    expect(destinoInicial({ boas_vindas_concluida: true }, {})).toBe('chat');
    expect(destinoInicial({ boas_vindas_concluida: true }, { c: 'abc' })).toBe('chat');
  });
  it('quem pediu uma conversa ou um Chat novo vai ao Chat mesmo sem concluir (o Chat nunca é bloqueado)', () => {
    expect(destinoInicial({ boas_vindas_concluida: false }, { c: 'abc' })).toBe('chat');
    expect(destinoInicial({ boas_vindas_concluida: false }, { nova: true })).toBe('chat');
  });
});

describe('conversaParaRetomar', () => {
  it('em aberto → retoma; sem conversa → null (precisa criar); concluídas → null mesmo com id', () => {
    expect(conversaParaRetomar({ boas_vindas_concluida: false, conversa_boas_vindas_id: 'c1' })).toBe('c1');
    expect(conversaParaRetomar({ boas_vindas_concluida: false })).toBeNull();
    expect(conversaParaRetomar({ boas_vindas_concluida: true, conversa_boas_vindas_id: 'c1' })).toBeNull();
  });
});

describe('criarBoasVindasUnica / abrirBoasVindas', () => {
  it('chamadas ao mesmo tempo (StrictMode, dois toques) criam uma única conversa', async () => {
    criar.mockResolvedValue({ id: 'nova' });
    const [a, b] = await Promise.all([criarBoasVindasUnica(), criarBoasVindasUnica()]);
    expect([a, b]).toEqual(['nova', 'nova']);
    expect(criar).toHaveBeenCalledTimes(1);
    await criarBoasVindasUnica(); // depois de terminar, uma nova chamada cria outra
    expect(criar).toHaveBeenCalledTimes(2);
  });
  it('falha na criação libera a próxima tentativa', async () => {
    criar.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ id: 'ok' });
    await expect(criarBoasVindasUnica()).rejects.toThrow('rede');
    await expect(criarBoasVindasUnica()).resolves.toBe('ok');
  });
  it('refazer reaproveita a conversa em aberto e só cria quando não há nenhuma', async () => {
    criar.mockResolvedValue({ id: 'nova' });
    expect(await abrirBoasVindas({ boas_vindas_concluida: false, conversa_boas_vindas_id: 'aberta' })).toBe('aberta');
    expect(criar).not.toHaveBeenCalled();
    expect(await abrirBoasVindas({ boas_vindas_concluida: true, conversa_boas_vindas_id: 'velha' })).toBe('nova');
    expect(await abrirBoasVindas({ boas_vindas_concluida: true })).toBe('nova');
  });
  it('caminho da tela', () => {
    expect(caminhoBoasVindas('a b')).toBe('/boas-vindas?c=a%20b');
  });
});
