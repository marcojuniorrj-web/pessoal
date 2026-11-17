#!/usr/bin/env node
// Roda os casos golden contra a API real da Anthropic (precisa de ANTHROPIC_API_KEY). Uso: npm run golden
import { buildSync } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = new URL('..', import.meta.url).pathname;
const saida = join(mkdtempSync(join(tmpdir(), 'jose-golden-')), 'golden.mjs');
buildSync({
  entryPoints: [join(raiz, 'servidor/src/adaptadores/ia/golden-cli.ts')],
  bundle: true, platform: 'node', format: 'esm', outfile: saida, loader: { '.md': 'text' }, tsconfig: join(raiz, 'tsconfig.json'), logLevel: 'error',
});
await import(pathToFileURL(saida).href);
