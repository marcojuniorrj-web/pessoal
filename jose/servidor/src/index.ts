import { Hono } from 'hono';
import type { Ambiente } from './ambiente';
import { dependenciasPadrao, type Dependencias } from './compartilhado/dependencias';
import { rotasAuth } from './modulos/auth/rotas';

export function criarApp(deps: Dependencias = dependenciasPadrao) {
  const app = new Hono<{ Bindings: Ambiente }>();
  app.get('/api/saude', (c) => c.json({ ok: true }));
  app.route('/auth', rotasAuth(deps));
  return app;
}

export const app = criarApp();
export default app;
