import { conversaEntradaSchema } from '@compartilhado/schemas';
import { hoje } from '@compartilhado/datas';
import { Hono } from 'hono';
import type { Dependencias } from '../../compartilhado/dependencias';
import { requisicaoInvalida } from '../../compartilhado/erros';
import { buscarDoUsuario } from '../../compartilhado/posse';
import type { AppEnv } from '../auth/sessao';
import {
  apagarConversa, conversaCompleta, criarConversa, listarConversas, ultimaConversaNormal, type ConversaLinha,
} from './repositorio';

export function rotasConversas(deps: Dependencias) {
  const rotas = new Hono<AppEnv>();

  rotas.post('/conversas', async (c) => {
    const corpo = conversaEntradaSchema.safeParse(await c.req.json().catch(() => null));
    if (!corpo.success) throw requisicaoInvalida('Informe o tipo da conversa (normal ou boas_vindas).');
    const id = await criarConversa(c.env.DB, c.var.usuario.id, corpo.data.tipo, corpo.data.modo ?? 'padrao', deps.agora());
    return c.json({ id }, 201);
  });

  rotas.get('/conversas', async (c) => c.json(await listarConversas(c.env.DB, c.var.usuario.id)));

  // Regra 12: a conversa de hoje é a última `normal` atualizada no dia local de hoje (fuso do Marco).
  rotas.get('/conversas/hoje', async (c) => {
    const u = c.var.usuario;
    const ultima = await ultimaConversaNormal(c.env.DB, u.id);
    if (!ultima || hoje(new Date(ultima.atualizada_em), u.fuso_horario) !== hoje(deps.agora(), u.fuso_horario)) return c.json(null);
    return c.json(await conversaCompleta(c.env.DB, ultima));
  });

  rotas.get('/conversas/:id', async (c) => {
    const conversa = await buscarDoUsuario<ConversaLinha>(c.env.DB, 'conversas', c.req.param('id'), c.var.usuario.id);
    return c.json(await conversaCompleta(c.env.DB, conversa));
  });

  rotas.delete('/conversas/:id', async (c) => {
    const conversa = await buscarDoUsuario<ConversaLinha>(c.env.DB, 'conversas', c.req.param('id'), c.var.usuario.id);
    await apagarConversa(c.env.DB, conversa.id);
    return c.body(null, 204);
  });

  return rotas;
}
