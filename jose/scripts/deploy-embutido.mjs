#!/usr/bin/env node
// Deploy com a interface embutida no Worker (sem upload de assets do wrangler).
// Uso: npm run deploy:embutido
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const raiz = new URL('..', import.meta.url).pathname;
const dist = join(raiz, 'app/dist');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

function listar(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : [p];
  });
}

execSync('npm run build', { cwd: raiz, stdio: 'inherit' });

const arquivos = {};
for (const p of listar(dist)) {
  const chave = '/' + relative(dist, p).split('\\').join('/');
  const tipo = TIPOS[extname(p)] ?? 'application/octet-stream';
  arquivos[chave] = { tipo, base64: readFileSync(p).toString('base64') };
}
if (!arquivos['/index.html']) throw new Error('app/dist/index.html não encontrado: o build falhou?');
writeFileSync(join(raiz, 'servidor/embutido/arquivos.gerado.ts'), `export const arquivos = ${JSON.stringify(arquivos)};\n`);

// wrangler.toml sem [assets] e com o ponto de entrada embutido.
let toml = readFileSync(join(raiz, 'servidor/wrangler.toml'), 'utf8');
toml = toml.replace(/\[assets\][\s\S]*?(?=\n\[|\n*$)/, '').replace('main = "src/index.ts"', 'main = "embutido/index.ts"');
writeFileSync(join(raiz, 'servidor/wrangler.embutido.toml'), toml);

execSync('npx wrangler deploy --config servidor/wrangler.embutido.toml', { cwd: raiz, stdio: 'inherit' });
