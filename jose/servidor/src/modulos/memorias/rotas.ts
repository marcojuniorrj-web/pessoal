// CRUD de memórias (arquitetura.md §5): tudo o que o José sabe sobre o Marco. Posse sempre por usuario_id da sessão.
import { memoriaAtualizacaoSchema, memoriaEntradaSchema } from '@compartilhado/schemas';
import { Hono } from 'hono';
import type { Dependencias } from '../../compartilhado/dependencias';
import { requisicaoInvalida } from '../../compartilhado/erros';
import { buscarDoUsuario } from '../../compartilhado/posse';
import type { AppEnv } from '../auth/sessao';
import { apagarMemoria, atualizarMemoria, inserirMemoria, listarMemorias, paraDto, type MemoriaLinha } from './repositorio';

export function rotasMemorias(deps: Pick<Dependencias, 'agora'>) {
  const rotas = new Hono<AppEnv>();

  rotas.get('/memorias', async (c) => c.json((await listarMemorias(c.env.DB, c.var.usuario.id)).map(paraDto)));

  rotas.post('/memorias', async (c) => {
    const corpo = memoriaEntradaSchema.safeParse(await c.req.json().catch(() => null));
    if (!corpo.success) throw requisicaoInvalida(corpo.error.issues[0]?.message ?? 'Memória inválida: informe texto (1 a 300 caracteres) e área.');
    return c.json(paraDto(await inserirMemoria(c.env.DB, c.var.usuario.id, corpo.data, 'manual', deps.agora())), 201);
  });

  rotas.patch('/memorias/:id', async (c) => {
    const memoria = await buscarDoUsuario<MemoriaLinha>(c.env.DB, 'memorias', c.req.param('id'), c.var.usuario.id);
    const corpo = memoriaAtualizacaoSchema.safeParse(await c.req.json().catch(() => null));
    if (!corpo.success) throw requisicaoInvalida(corpo.error.issues[0]?.message ?? 'Memória inválida: informe texto (1 a 300 caracteres) e/ou área.');
    await atualizarMemoria(c.env.DB, memoria.id, c.var.usuario.id, corpo.data, deps.agora());
    return c.json(paraDto(await buscarDoUsuario<MemoriaLinha>(c.env.DB, 'memorias', memoria.id, c.var.usuario.id)));
  });

  rotas.delete('/memorias/:id', async (c) => {
    const memoria = await buscarDoUsuario<MemoriaLinha>(c.env.DB, 'memorias', c.req.param('id'), c.var.usuario.id);
    await apagarMemoria(c.env.DB, memoria.id, c.var.usuario.id);
    return c.body(null, 204);
  });

  return rotas;
}
