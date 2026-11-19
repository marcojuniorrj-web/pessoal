import { Hono } from 'hono';
import type { Ambiente } from './ambiente';
import { dependenciasPadrao, type Dependencias } from './compartilhado/dependencias';
import { cabecalhosDeSeguranca } from './compartilhado/cabecalhos';
import { naoEncontrado, tratarErro } from './compartilhado/erros';
import { rotasAuth } from './modulos/auth/rotas';
import { rotasVoz } from './modulos/voz/rotas';
import { rotasConta } from './modulos/conta/rotas';
import { rotasConversas } from './modulos/conversas/rotas';
import { rotasMemorias } from './modulos/memorias/rotas';
import { rotasSugestoes } from './modulos/sugestoes/rotas';
import { rotasMetas } from './modulos/tarefas/metas-rotas';
import { rotasTarefas } from './modulos/tarefas/rotas';
import { executarBackup } from './modulos/backup/backup';
import { checarOrigem, exigirSessao, type AppEnv } from './modulos/auth/sessao';

export function criarApp(deps: Dependencias = dependenciasPadrao) {
  const app = new Hono<AppEnv>();
  app.onError(tratarErro);

  // Público: verificação de saúde (usada depois do deploy).
  app.get('/saude', (c) => c.json({ ok: true }));

  // /auth/*: sem sessão; as escritas checam o Origin.
  app.use('/auth/*', cabecalhosDeSeguranca, checarOrigem);
  app.route('/auth', rotasAuth(deps));

  // Toda rota /api exige sessão; o usuario_id vem sempre dela.
  app.use('/api/*', cabecalhosDeSeguranca, checarOrigem, exigirSessao(deps));
  app.route('/api', rotasConta());
  app.route('/api', rotasVoz(deps));
  app.route('/api', rotasConversas(deps));
  app.route('/api', rotasMemorias(deps));
  app.route('/api', rotasSugestoes(deps));
  app.route('/api', rotasTarefas(deps));
  app.route('/api', rotasMetas(deps));
  app.notFound((c) => (c.req.path.startsWith('/api/') ? tratarErro(naoEncontrado(), c) : c.env.ASSETS.fetch(c.req.raw)));
  return app;
}

export const app = criarApp();

/** Cron Trigger semanal (wrangler.toml [triggers]): backup do D1 no R2. */
export function aoAgendar(evento: ScheduledController, env: Ambiente, ctx: ExecutionContext) {
  ctx.waitUntil(executarBackup(env, new Date(evento.scheduledTime)));
}

export default { fetch: app.fetch, scheduled: aoAgendar };
