import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarD1Simulado } from '../../../testes/d1-simulado';
import { semearUsuario } from '../../../testes/semear';
import aplicacao, { aoAgendar } from '../../index';
import { dataSaoPaulo, executarBackup } from './backup';
import { gerarDump, literalSql } from './dump';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

/** R2 falso em memória (só o que o backup usa: put, list paginado e delete). */
function r2Falso() {
  const objetos = new Map<string, string>();
  const bucket = {
    async put(chave: string, valor: string) {
      objetos.set(chave, valor);
    },
    async list({ prefix = '', cursor }: { prefix?: string; cursor?: string } = {}) {
      const todas = [...objetos.keys()].filter((k) => k.startsWith(prefix)).sort();
      const ini = cursor ? Number(cursor) : 0;
      const fatia = todas.slice(ini, ini + 3); // página pequena para exercitar a paginação
      const truncated = ini + 3 < todas.length;
      return { objects: fatia.map((key) => ({ key })), truncated, cursor: truncated ? String(ini + 3) : undefined };
    },
    async delete(chaves: string | string[]) {
      for (const k of Array.isArray(chaves) ? chaves : [chaves]) objetos.delete(k);
    },
  };
  return { objetos, bucket: bucket as unknown as R2Bucket };
}

function textoLogs(espioes: ReturnType<typeof vi.spyOn>[]) {
  return JSON.stringify(espioes.flatMap((e) => e.mock.calls));
}

afterEach(() => vi.restoreAllMocks());

/** Banco com as migrações + linhas com escapes difíceis. */
async function bancoComDados() {
  const db = criarD1Simulado();
  await semearUsuario(db, 'a', 'a@exemplo.com');
  await semearUsuario(db, 'b', 'b@exemplo.com');
  const textos = ["d'Água e \"aspas\"", 'Ação à noite: coração, ünï', 'emoji 🙂👍🏽 fim', 'linha 1\nlinha 2\r\n\ttab', "'); DROP TABLE usuarios; --", ''];
  let i = 0;
  for (const t of textos) {
    await db
      .prepare("INSERT INTO memorias(id,usuario_id,texto,area,origem,criada_em) VALUES(?,?,?,'sobre_mim','manual',?)")
      .bind(`esc-${i++}`, 'a-u', t, '2026-11-18T12:00:00.000Z')
      .run();
  }
  await db.prepare("INSERT INTO tarefas(id,usuario_id,titulo,area,prazo,origem,criada_em) VALUES('t-null','a-u','Sem prazo','casa',NULL,'manual','2026-11-18T12:00:00.000Z')").run();
  return { db, textos };
}

describe('gerarDump', () => {
  it('escapa texto, NULL, números e BLOB', () => {
    expect(literalSql("it's")).toBe("'it''s'");
    expect(literalSql(null)).toBe('NULL');
    expect(literalSql(undefined)).toBe('NULL');
    expect(literalSql(42)).toBe('42');
    expect(literalSql(-3.25)).toBe('-3.25');
    expect(literalSql(10n)).toBe('10');
    expect(literalSql(new Uint8Array([0, 15, 255]))).toBe("X'000fff'");
    expect(literalSql([1, 171])).toBe("X'01ab'"); // o D1 devolve BLOB como number[]
    expect(literalSql('🙂\nx')).toBe("'🙂\nx'");
  });

  it('vem dentro de BEGIN/COMMIT, com CREATE de tabelas e índices antes dos INSERT', async () => {
    const { db } = await bancoComDados();
    const { sql } = await gerarDump(db);
    const linhas = sql.split('\n');
    expect(linhas[1]).toBe('BEGIN TRANSACTION;');
    expect(linhas.at(-2)).toBe('COMMIT;');
    expect(sql).not.toMatch(/d1_migrations|_cf_|sqlite_sequence/);
    expect(sql).toContain('CREATE INDEX idx_mensagens_conversa_criada');
    const ultimoCreate = Math.max(...linhas.map((l, i) => (l.startsWith('CREATE') ? i : -1)));
    const primeiroInsert = linhas.findIndex((l) => l.startsWith('INSERT'));
    expect(ultimoCreate).toBeLessThan(primeiroInsert);
  });

  it('reimportado num banco vazio, devolve as mesmas contagens e o mesmo conteúdo (menos as linhas de sessoes)', async () => {
    const { db, textos } = await bancoComDados();
    const dump = await gerarDump(db);

    const novo = new DatabaseSync(':memory:');
    novo.exec('PRAGMA foreign_keys = ON'); // as chaves estrangeiras valem na restauração: a ordem do dump precisa respeitá-las
    novo.exec(dump.sql);

    const tabelas = (
      (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'd1_migrations'").all<{ name: string }>()).results
    ).map((t) => t.name);
    expect(tabelas).toContain('sessoes');
    let total = 0;
    for (const t of tabelas) {
      const original = (await db.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all()).results;
      const restaurado = novo.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all();
      if (t === 'sessoes') {
        expect(original.length).toBe(2);
        expect(restaurado).toEqual([]); // sessões não voltam
      } else {
        expect(restaurado.map((r) => ({ ...r }))).toEqual(original);
        total += original.length;
      }
    }
    expect(dump.linhas).toBe(total);
    expect(dump.tabelas).toBe(tabelas.length - 1);
    // textos difíceis voltaram idênticos
    const voltou = novo.prepare("SELECT texto FROM memorias WHERE id LIKE 'esc-%' ORDER BY id").all().map((r) => r.texto);
    expect(voltou).toEqual(textos);
    expect(novo.prepare("SELECT prazo FROM tarefas WHERE id='t-null'").get()).toEqual({ prazo: null });
    // esquema completo restaurado (inclusive o de sessoes e os índices)
    expect(novo.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_sessoes_usuario'").get()).toEqual({ n: 1 });
  });

  it('restaura BLOB, números reais e ordem de FK mesmo com tabelas que se referenciam fora de ordem alfabética', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE a_filha(id INTEGER PRIMARY KEY, pai INTEGER NOT NULL REFERENCES z_pai(id), dados BLOB, preco REAL);
             CREATE TABLE z_pai(id INTEGER PRIMARY KEY, nome TEXT);
             INSERT INTO z_pai VALUES (1, 'x');
             INSERT INTO a_filha VALUES (1, 1, x'00ff10', 3.5);`);
    const d1 = {
      prepare: (sql: string) => ({
        bind: () => ({}),
        all: async () => ({ results: db.prepare(sql).all().map((r) => ({ ...r })) }),
      }),
    } as unknown as D1Database;
    const { sql } = await gerarDump(d1);
    expect(sql.indexOf('CREATE TABLE z_pai')).toBeLessThan(sql.indexOf('CREATE TABLE a_filha'));
    expect(sql.indexOf('INSERT INTO "z_pai"')).toBeLessThan(sql.indexOf('INSERT INTO "a_filha"'));
    const novo = new DatabaseSync(':memory:');
    novo.exec('PRAGMA foreign_keys = ON');
    novo.exec(sql);
    expect(novo.prepare('SELECT hex(dados) AS h, preco FROM a_filha').get()).toEqual({ h: '00FF10', preco: 3.5 });
  });

  it('tabela nova entra no dump sozinha', async () => {
    const { db } = await bancoComDados();
    await db.exec('CREATE TABLE consumo (id TEXT PRIMARY KEY, tokens INTEGER)');
    await db.prepare("INSERT INTO consumo VALUES ('c1', 7)").run();
    const { sql, tabelas } = await gerarDump(db);
    expect(sql).toContain('CREATE TABLE consumo');
    expect(sql).toContain('INSERT INTO "consumo" ("id", "tokens") VALUES (\'c1\', 7);');
    expect(tabelas).toBe(8 + 1); // 8 tabelas de dados das migrações (sem sessoes) + a nova
  });
});

describe('executarBackup', () => {
  it('data no fuso de São Paulo (domingo 06:00 UTC cai no mesmo dia; 01:00 UTC ainda é o dia anterior)', () => {
    expect(dataSaoPaulo(new Date('2026-11-22T06:00:00Z'))).toBe('2026-11-22');
    expect(dataSaoPaulo(new Date('2026-11-23T01:00:00Z'))).toBe('2026-11-22');
  });

  it('grava backups/jose-AAAA-MM-DD.sql com o dump e registra um único log sem conteúdo', async () => {
    const { db } = await bancoComDados();
    const { objetos, bucket } = r2Falso();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await executarBackup({ DB: db, BACKUPS: bucket }, new Date('2026-11-22T06:00:00Z'));
    expect([...objetos.keys()]).toEqual(['backups/jose-2026-11-22.sql']);
    expect(objetos.get('backups/jose-2026-11-22.sql')).toContain("INSERT INTO \"memorias\"");
    expect(log).toHaveBeenCalledTimes(1);
    const [msg, dados] = log.mock.calls[0]!;
    expect(msg).toBe('backup ok');
    expect(dados).toMatchObject({ tabelas: 8, copias: 1 });
    expect((dados as { bytes: number }).bytes).toBeGreaterThan(1000);
    expect((dados as { linhas: number }).linhas).toBeGreaterThan(10);
  });

  it('mantém só as 8 cópias mais recentes (com listagem paginada) e ignora outros objetos', async () => {
    const { db } = await bancoComDados();
    const { objetos, bucket } = r2Falso();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    objetos.set('outro/arquivo.txt', 'x');
    const domingos = ['2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15'];
    for (const d of domingos) objetos.set(`backups/jose-${d}.sql`, 'velho');
    await executarBackup({ DB: db, BACKUPS: bucket }, new Date('2026-11-22T06:00:00Z'));
    const copias = [...objetos.keys()].filter((k) => k.startsWith('backups/')).sort();
    expect(copias).toEqual([...domingos.slice(2), '2026-11-22'].map((d) => `backups/jose-${d}.sql`));
    expect(copias).toHaveLength(8);
    expect(objetos.has('outro/arquivo.txt')).toBe(true);
    // rodar de novo no mesmo dia sobrescreve a cópia, não cria outra
    await executarBackup({ DB: db, BACKUPS: bucket }, new Date('2026-11-22T09:00:00Z'));
    expect([...objetos.keys()].filter((k) => k.startsWith('backups/'))).toHaveLength(8);
  });

  it('nenhum dado pessoal vai para os logs (sucesso nem falha)', async () => {
    const { db } = await bancoComDados();
    await db.prepare("INSERT INTO memorias(id,usuario_id,texto,area,origem,criada_em) VALUES('m-x','a-u','MARCADOR-SECRETO-MEMORIA','sobre_mim','manual','2026-11-18T12:00:00.000Z')").run();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { bucket } = r2Falso();
    await executarBackup({ DB: db, BACKUPS: bucket }, new Date('2026-11-22T06:00:00Z'));

    const falho = { put: async () => { throw new Error('falha com MARCADOR-SECRETO-ERRO a@exemplo.com'); } } as unknown as R2Bucket;
    await expect(executarBackup({ DB: db, BACKUPS: falho }, new Date('2026-11-22T06:00:00Z'))).rejects.toThrow('MARCADOR-SECRETO-ERRO');
    const banco = { prepare: () => { throw new Error('boom MARCADOR-SECRETO-BANCO'); } } as unknown as D1Database;
    await expect(executarBackup({ DB: banco, BACKUPS: bucket }, new Date())).rejects.toThrow();

    const tudo = textoLogs([log, err, warn]);
    expect(tudo).not.toMatch(/MARCADOR-SECRETO|a@exemplo|b@exemplo|segredo de|Memória|Conversa a|Tarefa a|água|Ação/i);
    expect(err.mock.calls.map((c) => c[0])).toEqual(['backup falhou', 'backup falhou']);
    expect(err.mock.calls[0]![1]).toEqual({ tipo: 'Error' });
  });

  it('sem o binding BACKUPS: log claro, não lança e não lê o banco', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const prepare = vi.fn();
    await expect(executarBackup({ DB: { prepare } as unknown as D1Database }, new Date())).resolves.toBeUndefined();
    expect(prepare).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0]![0]).toBe('backup sem destino');
  });
});

describe('Cron no Worker', () => {
  it('o Worker exporta fetch e scheduled; scheduled espera o backup terminar (waitUntil)', async () => {
    expect(typeof aplicacao.fetch).toBe('function');
    expect(typeof aplicacao.scheduled).toBe('function');
    const { db } = await bancoComDados();
    const { objetos, bucket } = r2Falso();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const promessas: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => promessas.push(p) } as unknown as ExecutionContext;
    const env = { DB: db, BACKUPS: bucket } as never;
    aoAgendar({ scheduledTime: Date.parse('2026-11-22T06:00:00Z'), cron: '0 6 * * 0' } as ScheduledController, env, ctx);
    await Promise.all(promessas);
    expect([...objetos.keys()]).toEqual(['backups/jose-2026-11-22.sql']);
  });
});
