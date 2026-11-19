import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Varredura de segredos no que está versionado (tarefa 7.4). Os padrões são montados em pedaços para este arquivo
// não se achar sozinho. O histórico completo foi varrido à mão na revisão (ver docs/jose/plan/execucao.md).
const PADROES = [
  ['sk-', 'ant-[A-Za-z0-9_-]{16,}'], // chave da Anthropic
  ['GOC', 'SPX-[A-Za-z0-9_-]{8,}'], // segredo de cliente do Google
  ['AI', 'za[0-9A-Za-z_-]{30,}'], // chave de API do Google
  ['gh', 'p_[A-Za-z0-9]{30,}'], // token do GitHub
  ['github', '_pat_[A-Za-z0-9_]{20,}'],
  ['-----BEGIN ', '[A-Z ]*PRIVATE KEY'],
  ['AK', 'IA[0-9A-Z]{16}'], // AWS
  ['apify', '_api_[A-Za-z0-9]{10,}'],
  ['[0-9]{8,}-[a-z0-9]{20,}\\.apps\\.', 'googleusercontent\\.com'], // ID de cliente OAuth do Google
].map((p) => p.join(''));

function git(...args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 1) return ''; // git grep: nenhuma ocorrência
    throw e;
  }
}

describe('segredos no repositório', () => {
  it('nenhum arquivo versionado traz chave, token ou segredo conhecido', () => {
    for (const padrao of PADROES) {
      const achados = git('grep', '-nIE', '-e', padrao, '--', '.', ':!package-lock.json');
      expect(achados.split('\n').filter(Boolean).map((l) => l.split(':').slice(0, 2).join(':')), `padrão ${padrao.slice(0, 6)}…`).toEqual([]);
    }
  });

  it('.dev.vars (segredos locais) e backups não estão versionados e estão no .gitignore', () => {
    const versionados = git('ls-files').split('\n');
    expect(versionados.filter((f) => /(^|\/)\.dev\.vars$|(^|\/)\.env(\..+)?$|^backups\/|\.pem$/.test(f))).toEqual([]);
    const ignorados = git('check-ignore', 'servidor/.dev.vars', 'backups/jose-2026-01-01.sql').split('\n').filter(Boolean);
    expect(ignorados).toEqual(['servidor/.dev.vars', 'backups/jose-2026-01-01.sql']);
  });
});
