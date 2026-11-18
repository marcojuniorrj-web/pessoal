import { Hono } from 'hono';
import type { AppEnv } from '../auth/sessao';

export function rotasConta() {
  const rotas = new Hono<AppEnv>();

  // Quem sou: dados do usuário da sessão (e a conversa de boas-vindas em aberto, se houver).
  rotas.get('/eu', async (c) => {
    const u = c.var.usuario;
    const resposta: Record<string, unknown> = {
      nome: u.nome,
      email: u.email,
      foto_url: u.foto_url,
      boas_vindas_concluida: u.boas_vindas_concluida === 1,
      fuso_horario: u.fuso_horario,
    };
    if (u.boas_vindas_concluida !== 1) {
      const conversa = await c.env.DB
        .prepare("SELECT id FROM conversas WHERE usuario_id = ? AND tipo = 'boas_vindas' ORDER BY atualizada_em DESC, rowid DESC LIMIT 1")
        .bind(u.id)
        .first<{ id: string }>();
      if (conversa) resposta.conversa_boas_vindas_id = conversa.id;
    }
    return c.json(resposta);
  });

  // Pular ou concluir as boas-vindas: a flag passa a valer e o app abre o Chat. Idempotente.
  rotas.post('/eu/boas-vindas', async (c) => {
    await c.env.DB.prepare('UPDATE usuarios SET boas_vindas_concluida = 1 WHERE id = ?').bind(c.var.usuario.id).run();
    return c.body(null, 204);
  });

  return rotas;
}
