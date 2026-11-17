import { uuidv7 } from '../../compartilhado/id';

export interface UsuarioLinha {
  id: string;
  email: string;
  nome: string;
  foto_url: string | null;
  boas_vindas_concluida: number;
  fuso_horario: string;
  criado_em: string;
}

export interface SessaoLinha {
  id: string;
  usuario_id: string;
  expira_em: string;
  criada_em: string;
}

export async function buscarUsuarioPorEmail(db: D1Database, email: string) {
  return db.prepare('SELECT * FROM usuarios WHERE email = ?').bind(email).first<UsuarioLinha>();
}

export async function buscarUsuario(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM usuarios WHERE id = ?').bind(id).first<UsuarioLinha>();
}

/** Cria o usuário ou atualiza nome e foto. Devolve o id. */
export async function salvarUsuario(db: D1Database, dados: { email: string; nome: string; fotoUrl: string | null }, agora: Date) {
  const existente = await buscarUsuarioPorEmail(db, dados.email);
  if (existente) {
    await db.prepare('UPDATE usuarios SET nome = ?, foto_url = ? WHERE id = ?').bind(dados.nome, dados.fotoUrl, existente.id).run();
    return existente.id;
  }
  const id = uuidv7(agora.getTime());
  await db
    .prepare('INSERT INTO usuarios(id, email, nome, foto_url, criado_em) VALUES(?,?,?,?,?)')
    .bind(id, dados.email, dados.nome, dados.fotoUrl, agora.toISOString())
    .run();
  return id;
}

export async function criarSessao(db: D1Database, idHash: string, usuarioId: string, agora: Date, expiraEm: Date) {
  await db
    .prepare('INSERT INTO sessoes(id, usuario_id, expira_em, criada_em) VALUES(?,?,?,?)')
    .bind(idHash, usuarioId, expiraEm.toISOString(), agora.toISOString())
    .run();
}

export async function buscarSessao(db: D1Database, idHash: string) {
  return db.prepare('SELECT * FROM sessoes WHERE id = ?').bind(idHash).first<SessaoLinha>();
}

export async function renovarSessao(db: D1Database, idHash: string, expiraEm: Date) {
  await db.prepare('UPDATE sessoes SET expira_em = ? WHERE id = ?').bind(expiraEm.toISOString(), idHash).run();
}

export async function apagarSessao(db: D1Database, idHash: string) {
  await db.prepare('DELETE FROM sessoes WHERE id = ?').bind(idHash).run();
}

export async function apagarSessoesDoUsuario(db: D1Database, usuarioId: string) {
  await db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').bind(usuarioId).run();
}
