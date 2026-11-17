import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ErroHttp, registrarAoNaoAutenticado } from './cliente';

afterEach(() => {
  registrarAoNaoAutenticado(null);
  vi.unstubAllGlobals();
});

const resposta = (status: number, corpo: unknown) => vi.fn(async () => new Response(JSON.stringify(corpo), { status }));

describe('tratamento global do 401', () => {
  it('avisa a sessão quando uma chamada de /api/* volta 401 e ainda lança o erro', async () => {
    const aviso = vi.fn();
    registrarAoNaoAutenticado(aviso);
    vi.stubGlobal('fetch', resposta(401, { erro: { codigo: 'nao_autenticado', mensagem: 'Entre de novo' } }));
    await expect(api.get('/api/conversas/hoje')).rejects.toMatchObject({ status: 401, codigo: 'nao_autenticado' });
    expect(aviso).toHaveBeenCalledTimes(1);
  });
  it('não dispara em outros erros nem em rotas fora de /api', async () => {
    const aviso = vi.fn();
    registrarAoNaoAutenticado(aviso);
    vi.stubGlobal('fetch', resposta(404, { erro: { codigo: 'nao_encontrado', mensagem: 'x' } }));
    await expect(api.get('/api/conversas/x')).rejects.toBeInstanceOf(ErroHttp);
    vi.stubGlobal('fetch', resposta(401, {}));
    await expect(api.post('/auth/sair')).rejects.toBeInstanceOf(ErroHttp);
    expect(aviso).not.toHaveBeenCalled();
  });
});
