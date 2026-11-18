// CRUD de tarefas (arquitetura.md §5). Posse sempre por usuario_id da sessão; o fuso para "hoje" é o do usuário.
import { tarefaAtualizacaoSchema, tarefaEntradaSchema } from '@compartilhado/schemas';
import { Hono } from 'hono';
import type { Dependencias } from '../../compartilhado/dependencias';
import { requisicaoInvalida } from '../../compartilhado/erros';
import { buscarDoUsuario } from '../../compartilhado/posse';
import type { AppEnv } from '../auth/sessao';
import { apagarTarefa, atualizarTarefa, inserirTarefa, listarTarefas, paraDto, type TarefaLinha } from './repositorio';

export function rotasTarefas(deps: Pick<Dependencias, 'agora'>) {
  const rotas = new Hono<AppEnv>();

  rotas.get('/tarefas', async (c) => {
    const { id, fuso_horario } = c.var.usuario;
    return c.json((await listarTarefas(c.env.DB, id, deps.agora(), fuso_horario)).map(paraDto));
  });

  rotas.post('/tarefas', async (c) => {
    const corpo = tarefaEntradaSchema.safeParse(await c.req.json().catch(() => null));
    if (!corpo.success) throw requisicaoInvalida(corpo.error.issues[0]?.message ?? 'Tarefa inválida: informe título (1 a 120 caracteres) e área.');
    return c.json(paraDto(await inserirTarefa(c.env.DB, c.var.usuario.id, corpo.data, 'manual', deps.agora())), 201);
  });

  rotas.patch('/tarefas/:id', async (c) => {
    const tarefa = await buscarDoUsuario<TarefaLinha>(c.env.DB, 'tarefas', c.req.param('id'), c.var.usuario.id);
    const corpo = tarefaAtualizacaoSchema.safeParse(await c.req.json().catch(() => null));
    if (!corpo.success) throw requisicaoInvalida(corpo.error.issues[0]?.message ?? 'Tarefa inválida.');
    await atualizarTarefa(c.env.DB, tarefa, corpo.data, deps.agora());
    return c.json(paraDto(await buscarDoUsuario<TarefaLinha>(c.env.DB, 'tarefas', tarefa.id, c.var.usuario.id)));
  });

  rotas.delete('/tarefas/:id', async (c) => {
    const tarefa = await buscarDoUsuario<TarefaLinha>(c.env.DB, 'tarefas', c.req.param('id'), c.var.usuario.id);
    await apagarTarefa(c.env.DB, tarefa.id, c.var.usuario.id);
    return c.body(null, 204);
  });

  return rotas;
}
