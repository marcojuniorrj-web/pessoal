import { describe, expect, it } from 'vitest';
import { criarD1Simulado } from '../testes/d1-simulado';

const agora = '2026-11-17T12:00:00.000Z';

async function semente() {
  const db = criarD1Simulado();
  await db.prepare('INSERT INTO usuarios(id,email,nome,criado_em) VALUES(?,?,?,?)').bind('u1', 'marco@x.com', 'Marco', agora).run();
  return db;
}

describe('migração 0001_inicial', () => {
  it('insere e lê uma linha de cada tabela', async () => {
    const db = await semente();
    await db.prepare('INSERT INTO sessoes(id,usuario_id,expira_em,criada_em) VALUES(?,?,?,?)').bind('s1', 'u1', agora, agora).run();
    await db.prepare('INSERT INTO conversas(id,usuario_id,tipo,criada_em,atualizada_em) VALUES(?,?,?,?,?)').bind('c1', 'u1', 'normal', agora, agora).run();
    await db.prepare('INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES(?,?,?,?,?,?)').bind('m1', 'c1', 'marco', 'oi', 'texto', agora).run();
    await db.prepare('INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,criada_em) VALUES(?,?,?,?,?)').bind('g1', 'm1', 'tarefa', '{}', agora).run();
    await db.prepare('INSERT INTO metas(id,usuario_id,titulo,area,origem,criada_em) VALUES(?,?,?,?,?,?)').bind('t1', 'u1', 'Meta', 'saude', 'manual', agora).run();
    await db.prepare('INSERT INTO tarefas(id,usuario_id,titulo,area,origem,criada_em) VALUES(?,?,?,?,?,?)').bind('r1', 'u1', 'Tarefa', 'casa', 'chat', agora).run();
    await db.prepare('INSERT INTO memorias(id,usuario_id,texto,area,origem,criada_em) VALUES(?,?,?,?,?,?)').bind('e1', 'u1', 'Acorda às 6h', 'sobre_mim', 'manual', agora).run();
    for (const [tabela, id] of [['usuarios', 'u1'], ['sessoes', 's1'], ['conversas', 'c1'], ['mensagens', 'm1'], ['sugestoes', 'g1'], ['metas', 't1'], ['tarefas', 'r1'], ['memorias', 'e1']]) {
      const linha = await db.prepare(`SELECT id FROM ${tabela} WHERE id = ?`).bind(id).first<{ id: string }>();
      expect(linha?.id, tabela).toBe(id);
    }
  });

  it('aplica padrões e CHECKs', async () => {
    const db = await semente();
    const u = await db.prepare('SELECT * FROM usuarios WHERE id = ?').bind('u1').first<Record<string, unknown>>();
    expect(u).toMatchObject({ fuso_horario: 'America/Sao_Paulo', boas_vindas_concluida: 0 });
    await expect(
      db.prepare('INSERT INTO tarefas(id,usuario_id,titulo,area,origem,criada_em) VALUES(?,?,?,?,?,?)').bind('x', 'u1', 'a'.repeat(121), 'casa', 'chat', agora).run(),
    ).rejects.toThrow();
    await expect(
      db.prepare('INSERT INTO tarefas(id,usuario_id,titulo,area,origem,criada_em) VALUES(?,?,?,?,?,?)').bind('x', 'u1', 'ok', 'sobre_mim', 'chat', agora).run(),
    ).rejects.toThrow();
    await expect(
      db.prepare('INSERT INTO memorias(id,usuario_id,texto,area,origem,criada_em) VALUES(?,?,?,?,?,?)').bind('x', 'u1', 'a'.repeat(301), 'casa', 'chat', agora).run(),
    ).rejects.toThrow();
  });

  it('respeita foreign_keys e cascata ao apagar o usuário', async () => {
    const db = await semente();
    await expect(
      db.prepare('INSERT INTO sessoes(id,usuario_id,expira_em,criada_em) VALUES(?,?,?,?)').bind('s', 'inexistente', agora, agora).run(),
    ).rejects.toThrow();
    await db.prepare('INSERT INTO conversas(id,usuario_id,tipo,criada_em,atualizada_em) VALUES(?,?,?,?,?)').bind('c1', 'u1', 'normal', agora, agora).run();
    await db.prepare('INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES(?,?,?,?,?,?)').bind('m1', 'c1', 'marco', 'oi', 'texto', agora).run();
    await db.prepare('DELETE FROM usuarios WHERE id = ?').bind('u1').run();
    const n = await db.prepare('SELECT COUNT(*) AS n FROM mensagens').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });
});
