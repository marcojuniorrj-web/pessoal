// CRUD de metas (arquitetura.md §5): status `ativa` | `concluida`. Posse sempre por usuario_id da sessão.
import { metaAtualizacaoSchema, metaEntradaSchema } from '@compartilhado/schemas';
import { Hono } from 'hono';
import type { Dependencias } from '../../compartilhado/dependencias';
import { requisicaoInvalida } from '../../compartilhado/erros';
import { buscarDoUsuario } from '../../compartilhado/posse';
import type { AppEnv } from '../auth/sessao';
import { apagarMeta, atualizarMeta, inserirMeta, listarMetas, paraDto, type MetaLinha } from './metas-repositorio';

export function rotasMetas(deps: Pick<Dependencias, 'agora'>) {
  const rotas = new Hono<AppEnv>();

  rotas.get('/metas', async (c) => c.json((await listarMetas(c.env.DB, c.var.usuario.id)).map(paraDto)));

  rotas.post('/metas', async (c) => {
    const corpo = metaEntradaSchema.safeParse(await c.req.json().catch(() => null));
    if (!corpo.success) throw requisicaoInvalida(corpo.error.issues[0]?.message ?? 'Meta inválida: informe título (1 a 120 caracteres) e área.');
    return c.json(paraDto(await inserirMeta(c.env.DB, c.var.usuario.id, corpo.data, 'manual', deps.agora())), 201);
  });

  rotas.patch('/metas/:id', async (c) => {
    const meta = await buscarDoUsuario<MetaLinha>(c.env.DB, 'metas', c.req.param('id'), c.var.usuario.id);
    const corpo = metaAtualizacaoSchema.safeParse(await c.req.json().catch(() => null));
    if (!corpo.success) throw requisicaoInvalida(corpo.error.issues[0]?.message ?? 'Meta inválida.');
    await atualizarMeta(c.env.DB, meta, corpo.data, deps.agora());
    return c.json(paraDto(await buscarDoUsuario<MetaLinha>(c.env.DB, 'metas', meta.id, c.var.usuario.id)));
  });

  rotas.delete('/metas/:id', async (c) => {
    const meta = await buscarDoUsuario<MetaLinha>(c.env.DB, 'metas', c.req.param('id'), c.var.usuario.id);
    await apagarMeta(c.env.DB, meta.id, c.var.usuario.id);
    return c.body(null, 204);
  });

  return rotas;
}
