// Revisão de consultas do D1 (tarefa 7.6): as consultas quentes (rodam a cada abertura de tela ou mensagem) precisam usar
// índice. O D1 é SQLite, então o EXPLAIN QUERY PLAN do node:sqlite com as mesmas migrações mostra o mesmo plano.
import { describe, expect, it } from 'vitest';
import { criarD1Simulado } from '../testes/d1-simulado';

const CONSULTAS: Array<[string, string, string?]> = [
  // [nome, SQL, tabela que PODE ser varrida por inteiro (pequena e sem filtro por natureza)]
  ['sessão pelo hash (a cada requisição)', 'SELECT * FROM sessoes WHERE id = ?'],
  ['usuário pelo id (a cada requisição)', 'SELECT * FROM usuarios WHERE id = ?'],
  ['usuário pelo e-mail (login)', 'SELECT * FROM usuarios WHERE email = ?'],
  ['mensagens da conversa em ordem', 'SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY criada_em ASC, rowid ASC'],
  ['mensagem pelo id', 'SELECT * FROM mensagens WHERE id = ?'],
  ['sugestões da conversa', 'SELECT s.id, s.mensagem_id, s.tipo, s.conteudo, s.status, s.item_id FROM sugestoes s JOIN mensagens m ON m.id = s.mensagem_id WHERE m.conversa_id = ? ORDER BY s.criada_em ASC, s.rowid ASC'],
  ['posse da sugestão (sugestão → mensagem → conversa)', 'SELECT s.* FROM sugestoes s JOIN mensagens m ON m.id = s.mensagem_id JOIN conversas c ON c.id = m.conversa_id WHERE s.id = ? AND c.usuario_id = ?'],
  ['posse da mensagem', 'SELECT m.* FROM mensagens m JOIN conversas c ON c.id = m.conversa_id WHERE m.id = ? AND c.usuario_id = ?'],
  ['posse de item (conversas, tarefas, metas, memórias)', 'SELECT * FROM conversas WHERE id = ? AND usuario_id = ?'],
  ['conversa de hoje', "SELECT * FROM conversas WHERE usuario_id = ? AND tipo = 'normal' ORDER BY atualizada_em DESC, rowid DESC LIMIT 1"],
  ['histórico de conversas', "SELECT id, titulo, tipo, modo, atualizada_em FROM conversas WHERE usuario_id = ? AND tipo = 'normal' ORDER BY atualizada_em DESC, rowid DESC"],
  ['conversa de boas-vindas em aberto', "SELECT id FROM conversas WHERE usuario_id = ? AND tipo = 'boas_vindas' ORDER BY atualizada_em DESC, rowid DESC LIMIT 1"],
  ['memórias (contexto da IA e aba José sabe)', 'SELECT texto, area FROM memorias WHERE usuario_id = ? ORDER BY criada_em ASC, rowid ASC'],
  ['metas ativas (contexto da IA)', "SELECT titulo, area, prazo FROM metas WHERE usuario_id = ? AND status = 'ativa' ORDER BY criada_em ASC, rowid ASC"],
  ['metas (aba Tarefas)', 'SELECT * FROM metas WHERE usuario_id = ? ORDER BY rowid DESC'],
  ['tarefas pendentes/concluídas', 'SELECT * FROM tarefas WHERE usuario_id = ? AND concluida = ? ORDER BY rowid DESC'],
  ['uso do dia (limite diário)', 'SELECT respostas FROM uso_diario WHERE usuario_id = ? AND dia = ?'],
  ['conversa que ficou vazia', 'SELECT 1 AS n FROM mensagens WHERE conversa_id = ? LIMIT 1'],
  ['apagar tudo: sugestões do usuário', 'DELETE FROM sugestoes WHERE mensagem_id IN (SELECT m.id FROM mensagens m JOIN conversas c ON c.id = m.conversa_id WHERE c.usuario_id = ?)'],
  ['apagar tudo: mensagens do usuário', 'DELETE FROM mensagens WHERE conversa_id IN (SELECT id FROM conversas WHERE usuario_id = ?)'],
];

describe('plano das consultas do D1 (EXPLAIN QUERY PLAN)', () => {
  it.each(CONSULTAS)('%s: sem varrer tabela inteira', (_nome, sql) => {
    const db = criarD1Simulado();
    // O D1 simulado esconde o banco; abrimos o mesmo esquema direto no SQLite para pedir o plano.
    return (async () => {
      const n = (sql.match(/\?/g) ?? []).length;
      const plano = (await db.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(...Array(n).fill('x')).all<{ detail: string }>()).results.map((l) => l.detail);
      const varreduras = plano.filter((d) => /^SCAN /.test(d) && !/USING (COVERING )?INDEX/.test(d));
      expect(varreduras, plano.join(' | ')).toEqual([]);
    })();
  });

  it('as ordenações que ainda usam uma árvore temporária são só de listas pequenas do próprio usuário', async () => {
    const db = criarD1Simulado();
    const plano = async (sql: string) => (await db.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind('x').all<{ detail: string }>()).results.map((l) => l.detail).join(' | ');
    // Documenta o que o plano mostra hoje (ver execucao.md): com 1 usuário e centenas de linhas, ordenar na memória custa microssegundos.
    expect(await plano("SELECT * FROM conversas WHERE usuario_id = ? AND tipo = 'normal' ORDER BY atualizada_em DESC, rowid DESC LIMIT 1")).toContain('idx_conversas_usuario_atualizada');
    expect(await plano('SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY criada_em ASC, rowid ASC')).not.toContain('TEMP B-TREE');
  });
});
