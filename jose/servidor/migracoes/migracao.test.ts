import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

describe('migração 0002_uso_diario', () => {
  const pasta = fileURLToPath(new URL('.', import.meta.url));
  const sql0002 = readFileSync(join(pasta, '0002_uso_diario.sql'), 'utf8');
  const sql0001 = readFileSync(join(pasta, '0001_inicial.sql'), 'utf8');

  it('aplicada do zero: tabela vazia, chave (usuario_id, dia) e cascata ao apagar o usuário', async () => {
    const db = await semente();
    expect((await db.prepare('SELECT COUNT(*) AS n FROM uso_diario').first<{ n: number }>())?.n).toBe(0);
    await db.prepare('INSERT INTO uso_diario(usuario_id,dia,respostas) VALUES(?,?,?)').bind('u1', '2026-11-18', 1).run();
    await expect(db.prepare('INSERT INTO uso_diario(usuario_id,dia,respostas) VALUES(?,?,?)').bind('u1', '2026-11-18', 1).run()).rejects.toThrow();
    await expect(db.prepare('INSERT INTO uso_diario(usuario_id,dia,respostas) VALUES(?,?,?)').bind('x', '2026-11-18', 1).run()).rejects.toThrow();
    await db.prepare('DELETE FROM usuarios WHERE id = ?').bind('u1').run();
    expect((await db.prepare('SELECT COUNT(*) AS n FROM uso_diario').first<{ n: number }>())?.n).toBe(0);
  });

  it('sobre um banco existente: preenche só o dia de hoje (fuso do usuário) com as respostas do José', async () => {
    const db = criarD1Simulado(false);
    await db.exec(sql0001);
    const agora = new Date();
    const horas = (h: number) => new Date(agora.getTime() + h * 3_600_000).toISOString();
    // Dois usuários: um em São Paulo (UTC-3) e um em UTC.
    await db.prepare('INSERT INTO usuarios(id,email,nome,criado_em) VALUES(?,?,?,?)').bind('u1', 'a@x.com', 'A', horas(-100)).run();
    await db.prepare("INSERT INTO usuarios(id,email,nome,fuso_horario,criado_em) VALUES(?,?,?,?,?)").bind('u2', 'b@x.com', 'B', 'UTC', horas(-100)).run();
    for (const u of ['u1', 'u2']) {
      await db.prepare('INSERT INTO conversas(id,usuario_id,tipo,criada_em,atualizada_em) VALUES(?,?,?,?,?)').bind(`c-${u}`, u, 'normal', horas(-100), horas(-100)).run();
    }
    const msg = (id: string, conv: string, autor: string, criada: string) =>
      db.prepare("INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES(?,?,?,?,'texto',?)").bind(id, conv, autor, 'x', criada).run();
    await msg('a1', 'c-u1', 'jose', agora.toISOString());
    await msg('a2', 'c-u1', 'jose', agora.toISOString());
    await msg('a3', 'c-u1', 'marco', agora.toISOString()); // do Marco: não conta
    await msg('a4', 'c-u1', 'jose', horas(-30)); // outro dia: não conta
    await msg('b1', 'c-u2', 'jose', agora.toISOString());
    await db.exec(sql0002);
    const dia = (fuso: number) => new Date(agora.getTime() + fuso * 3_600_000).toISOString().slice(0, 10);
    const linhas = (await db.prepare('SELECT usuario_id, dia, respostas FROM uso_diario ORDER BY usuario_id').all()).results;
    expect(linhas).toEqual([
      { usuario_id: 'u1', dia: dia(-3), respostas: 2 },
      { usuario_id: 'u2', dia: dia(0), respostas: 1 },
    ]);
  });
});

describe('migração 0003_transcricoes_diarias', () => {
  const pasta = fileURLToPath(new URL('.', import.meta.url));
  const sql = (nome: string) => readFileSync(join(pasta, nome), 'utf8');

  it('aplicada do zero: a coluna existe, começa em 0 e convive com respostas', async () => {
    const db = await semente();
    await db.prepare('INSERT INTO uso_diario(usuario_id,dia,respostas) VALUES(?,?,?)').bind('u1', '2026-11-18', 3).run();
    expect(await db.prepare('SELECT respostas, transcricoes FROM uso_diario').first()).toEqual({ respostas: 3, transcricoes: 0 });
    await db.prepare('UPDATE uso_diario SET transcricoes = transcricoes + 1').run();
    expect((await db.prepare('SELECT transcricoes AS n FROM uso_diario').first<{ n: number }>())?.n).toBe(1);
    await expect(db.prepare('UPDATE uso_diario SET transcricoes = -1').run()).rejects.toThrow();
    await expect(db.prepare('UPDATE uso_diario SET transcricoes = NULL').run()).rejects.toThrow();
  });

  it('sobre o banco existente (0001 + 0002 com dados): linhas antigas ficam com 0 e nada se perde', async () => {
    const db = criarD1Simulado(false);
    await db.exec(sql('0001_inicial.sql'));
    await db.exec(sql('0002_uso_diario.sql'));
    await db.prepare('INSERT INTO usuarios(id,email,nome,criado_em) VALUES(?,?,?,?)').bind('u1', 'a@x.com', 'A', agora).run();
    await db.prepare('INSERT INTO uso_diario(usuario_id,dia,respostas) VALUES(?,?,?)').bind('u1', '2026-11-18', 11).run();
    await db.prepare('INSERT INTO uso_diario(usuario_id,dia,respostas) VALUES(?,?,?)').bind('u1', '2026-11-17', 2).run();
    await db.exec(sql('0003_transcricoes_diarias.sql'));
    const linhas = (await db.prepare('SELECT dia, respostas, transcricoes FROM uso_diario ORDER BY dia').all()).results;
    expect(linhas).toEqual([
      { dia: '2026-11-17', respostas: 2, transcricoes: 0 },
      { dia: '2026-11-18', respostas: 11, transcricoes: 0 },
    ]);
    // O UPSERT do limite funciona na linha que já existia e cria a do dia que ainda não tinha.
    await db.prepare('INSERT INTO uso_diario (usuario_id, dia, respostas, transcricoes) VALUES (?, ?, 0, 1) ON CONFLICT (usuario_id, dia) DO UPDATE SET transcricoes = transcricoes + 1').bind('u1', '2026-11-18').run();
    expect((await db.prepare("SELECT respostas, transcricoes FROM uso_diario WHERE dia = '2026-11-18'").first())).toEqual({ respostas: 11, transcricoes: 1 });
  });
});
