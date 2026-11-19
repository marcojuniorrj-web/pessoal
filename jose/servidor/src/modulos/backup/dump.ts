// Gera o dump SQL do D1 (esquema + dados) para o backup semanal.
// As tabelas são descobertas em sqlite_master: tabela nova entra no backup sozinha.
//
// `sessoes` fica de fora de propósito: o esquema (CREATE TABLE e índices) vai no dump, para o banco restaurado
// funcionar, mas as LINHAS não. Assim restaurar uma cópia nunca reabre uma sessão (cookie) que já foi derrubada.

/** Tabelas cujo conteúdo nunca entra no backup (só o esquema). */
export const TABELAS_SEM_DADOS: readonly string[] = ['sessoes'];

export interface ResultadoDump {
  sql: string;
  /** Tabelas com os dados exportados (não conta as de TABELAS_SEM_DADOS). */
  tabelas: number;
  /** Linhas exportadas (INSERTs). */
  linhas: number;
}

interface ObjetoEsquema {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

const aspas = (nome: string) => `"${nome.replace(/"/g, '""')}"`;

/** Valor do SQLite como literal SQL. */
export function literalSql(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
  // BLOB: o D1 devolve number[]; outros ambientes devolvem Uint8Array/ArrayBuffer.
  let bytes: ArrayLike<number> | null = null;
  if (Array.isArray(v)) bytes = v as number[];
  else if (v instanceof ArrayBuffer) bytes = new Uint8Array(v);
  else if (ArrayBuffer.isView(v)) bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  if (bytes) return `X'${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}'`;
  throw new Error('valor_nao_suportado');
}

/** Ordena as tabelas para que a tabela referenciada venha antes de quem a referencia (ciclos: ordem alfabética). */
function ordenarPorChaveEstrangeira(tabelas: string[], dependencias: Map<string, Set<string>>): string[] {
  const restantes = new Set(tabelas);
  const saida: string[] = [];
  while (restantes.size > 0) {
    const prontas = [...restantes].filter((t) => [...(dependencias.get(t) ?? [])].every((d) => d === t || !restantes.has(d)));
    const lote = prontas.length > 0 ? prontas : [[...restantes][0]!];
    for (const t of lote.sort()) {
      saida.push(t);
      restantes.delete(t);
    }
  }
  return saida;
}

export async function gerarDump(db: D1Database): Promise<ResultadoDump> {
  const { results } = await db
    .prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY name")
    .all<ObjetoEsquema>();
  const nomesTabelas = results.filter((o) => o.type === 'table').map((o) => o.name);

  const dependencias = new Map<string, Set<string>>();
  for (const t of nomesTabelas) {
    const { results: fks } = await db.prepare(`PRAGMA foreign_key_list(${aspas(t)})`).all<{ table: string }>();
    dependencias.set(t, new Set(fks.map((f) => f.table)));
  }
  const ordem = ordenarPorChaveEstrangeira(nomesTabelas, dependencias);

  const partes: string[] = ['-- Backup do José (D1). As linhas da tabela `sessoes` não são salvas: restaurar não reabre sessões.'];
  // Sem BEGIN/COMMIT de propósito: o D1 recusa transações escritas à mão num arquivo importado.
  for (const t of ordem) partes.push(`${results.find((o) => o.type === 'table' && o.name === t)!.sql};`);
  for (const o of results.filter((o) => o.type === 'index')) partes.push(`${o.sql};`);

  let tabelas = 0;
  let linhas = 0;
  for (const t of ordem) {
    if (TABELAS_SEM_DADOS.includes(t)) continue;
    tabelas++;
    const { results: rows } = await db.prepare(`SELECT * FROM ${aspas(t)}`).all<Record<string, unknown>>();
    for (const r of rows) {
      const colunas = Object.keys(r);
      partes.push(`INSERT INTO ${aspas(t)} (${colunas.map(aspas).join(', ')}) VALUES (${colunas.map((c) => literalSql(r[c])).join(', ')});`);
      linhas++;
    }
  }
  return { sql: partes.join('\n') + '\n', tabelas, linhas };
}
