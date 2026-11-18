import { conversaEntradaSchema } from '@compartilhado/schemas';
import { hoje } from '@compartilhado/datas';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { mensagemEntradaSchema } from '@compartilhado/schemas';
import type { Dependencias } from '../../compartilhado/dependencias';
import { requisicaoInvalida } from '../../compartilhado/erros';
import { buscarDoUsuario, buscarMensagemDoUsuario } from '../../compartilhado/posse';
import { prepararEnvio } from './servico';
import type { AppEnv } from '../auth/sessao';
import {
  apagarConversa, apagarMensagens, conversaCompleta, criarConversa, listarConversas, mensagemSeguinte, ultimaConversaNormal, type ConversaLinha, type MensagemLinha,
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

  // Apagar mensagem (dentro do Chat). `?com_resposta=1` só vale para mensagem do Marco e leva a resposta do José logo depois.
  rotas.delete('/mensagens/:id', async (c) => {
    const comResposta = c.req.query('com_resposta');
    if (comResposta !== undefined && comResposta !== '1' && comResposta !== '0') throw requisicaoInvalida('com_resposta deve ser 1.');
    const mensagem = await buscarMensagemDoUsuario<MensagemLinha>(c.env.DB, c.req.param('id'), c.var.usuario.id);
    const ids = [mensagem.id];
    if (comResposta === '1') {
      if (mensagem.autor !== 'marco') throw requisicaoInvalida('com_resposta só vale para mensagem do Marco.');
      const seguinte = await mensagemSeguinte(c.env.DB, mensagem);
      if (seguinte?.autor === 'jose') ids.push(seguinte.id);
    }
    // Conversa que ficou sem mensagens (e não é de boas-vindas) também é apagada: 200 com { conversa_apagada: true }.
    if (await apagarMensagens(c.env.DB, mensagem.conversa_id, ids)) return c.json({ conversa_apagada: true });
    return c.body(null, 204);
  });

  // Enviar mensagem: SSE com `texto`, `sugestao`, `fim` e `erro`.
  rotas.post('/conversas/:id/mensagens', async (c) => {
    const conversa = await buscarDoUsuario<ConversaLinha>(c.env.DB, 'conversas', c.req.param('id'), c.var.usuario.id);
    const corpo = mensagemEntradaSchema.safeParse(await c.req.json().catch(() => null));
    if (!corpo.success) throw requisicaoInvalida('Mensagem inválida: envie id, texto (1 a 4000 caracteres) e origem.');
    const executar = await prepararEnvio({ env: c.env, deps, usuario: c.var.usuario, conversa, mensagem: corpo.data });
    return streamSSE(c, async (stream) => {
      const sinal = c.req.raw.signal;
      for await (const ev of executar(sinal)) {
        await stream.writeSSE({ event: ev.evento, data: JSON.stringify(ev.dados) });
      }
    });
  });

  return rotas;
}
