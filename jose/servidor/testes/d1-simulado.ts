// Simulação mínima do D1 para testes, em cima do SQLite embutido do Node (node:sqlite).
// Implementa só o que o código usa: prepare/bind/first/all/run, batch e exec.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

type Valor = string | number | null;

class Comando {
  private valores: Valor[] = [];
  constructor(private db: InstanceType<typeof DatabaseSync>, readonly sql: string) {}

  bind(...valores: unknown[]) {
    this.valores = valores.map((v) => (v === undefined ? null : (v as Valor)));
    return this;
  }
  async first<T = unknown>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...this.valores) as T | undefined) ?? null;
  }
  async all<T = unknown>() {
    const results = this.db.prepare(this.sql).all(...this.valores) as T[];
    return { results, success: true, meta: {} };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.valores);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) }, results: [] };
  }
  executarSincrono() {
    return this.db.prepare(this.sql).run(...this.valores);
  }
}

export interface D1Simulado {
  prepare(sql: string): Comando;
  batch(comandos: Comando[]): Promise<unknown[]>;
  exec(sql: string): Promise<unknown>;
}

/** Cria um banco em memória com todas as migrações de servidor/migracoes aplicadas. */
export function criarD1Simulado(aplicarMigracoes = true): D1Simulado & D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const simulado: D1Simulado = {
    prepare: (sql) => new Comando(db, sql),
    async batch(comandos) {
      // Transação única, como o batch do D1.
      db.exec('BEGIN');
      try {
        const saidas = comandos.map((c) => c.executarSincrono());
        db.exec('COMMIT');
        return saidas;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql) {
      db.exec(sql);
      return {};
    },
  };
  if (aplicarMigracoes) {
    const pasta = fileURLToPath(new URL('../migracoes', import.meta.url));
    for (const arq of readdirSync(pasta).filter((a) => a.endsWith('.sql')).sort()) {
      db.exec(readFileSync(join(pasta, arq), 'utf8'));
    }
  }
  return simulado as unknown as D1Simulado & D1Database;
}
