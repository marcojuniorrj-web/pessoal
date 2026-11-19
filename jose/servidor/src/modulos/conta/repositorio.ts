/**
 * Apaga TODAS as linhas do usuário, em todas as tabelas, numa única transação (D1 batch).
 * Ao criar uma tabela nova numa migração, inclua-a aqui: `conta.test.ts` compara esta lista
 * com o `sqlite_master` e quebra se faltar alguma.
 */
export async function apagarTudoDoUsuario(db: D1Database, usuarioId: string): Promise<void> {
  const porUsuario = (sql: string) => db.prepare(sql).bind(usuarioId);
  // Do mais dependente para o menos (não depende só da cascata): sugestões → mensagens → conversas → o resto → usuário.
  await db.batch([
    porUsuario('DELETE FROM sugestoes WHERE mensagem_id IN (SELECT m.id FROM mensagens m JOIN conversas c ON c.id = m.conversa_id WHERE c.usuario_id = ?)'),
    porUsuario('DELETE FROM mensagens WHERE conversa_id IN (SELECT id FROM conversas WHERE usuario_id = ?)'),
    porUsuario('DELETE FROM conversas WHERE usuario_id = ?'),
    porUsuario('DELETE FROM tarefas WHERE usuario_id = ?'),
    porUsuario('DELETE FROM metas WHERE usuario_id = ?'),
    porUsuario('DELETE FROM memorias WHERE usuario_id = ?'),
    porUsuario('DELETE FROM uso_diario WHERE usuario_id = ?'),
    porUsuario('DELETE FROM sessoes WHERE usuario_id = ?'),
    db.prepare('DELETE FROM usuarios WHERE id = ?').bind(usuarioId),
  ]);
}
