import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// Importa arquivos .md como texto (o prompt do José), como o wrangler/esbuild fazem no Worker.
const md = { name: 'md-como-texto', transform: (_: string, id: string) => (id.endsWith('.md') ? `export default ${JSON.stringify(readFileSync(id, 'utf8'))};` : undefined) };

export default defineConfig({
  plugins: [md],
  resolve: { alias: { '@compartilhado': fileURLToPath(new URL('./compartilhado', import.meta.url)) } },
  test: {
    include: ['{app,servidor,compartilhado,scripts}/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
