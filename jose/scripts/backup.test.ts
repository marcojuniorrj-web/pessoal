import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./backup.sh', import.meta.url));

function rodar(pasta: string, wrangler: string, data: string) {
  return execFileSync('bash', [script], { env: { ...process.env, PASTA_BACKUP: pasta, WRANGLER: wrangler, DATA_BACKUP: data }, encoding: 'utf8' });
}

describe('backup semanal', () => {
  const base = mkdtempSync(join(tmpdir(), 'jose-backup-'));
  // "wrangler" falso: escreve um SQL no caminho passado em --output
  const falso = join(base, 'wrangler-falso.sh');
  writeFileSync(falso, '#!/usr/bin/env bash\nwhile [ $# -gt 0 ]; do [ "$1" = "--output" ] && { echo "CREATE TABLE x(a);" > "$2"; }; shift; done\n');
  chmodSync(falso, 0o755);

  it('gera um arquivo e mantém só as 4 cópias mais recentes', () => {
    const pasta = join(base, 'copias');
    for (const d of ['2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']) rodar(pasta, falso, d);
    expect(readdirSync(pasta).sort()).toEqual(['jose-2026-11-03.sql', 'jose-2026-11-10.sql', 'jose-2026-11-17.sql', 'jose-2026-11-24.sql']);
  });

  it('falha (e não deixa arquivo vazio) se o export não gerar nada', () => {
    const vazio = join(base, 'vazio.sh');
    writeFileSync(vazio, '#!/usr/bin/env bash\nexit 0\n');
    chmodSync(vazio, 0o755);
    const pasta = join(base, 'copias2');
    expect(() => rodar(pasta, vazio, '2026-11-17')).toThrow();
    expect(existsSync(join(pasta, 'jose-2026-11-17.sql'))).toBe(false);
  });
});
