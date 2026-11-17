import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const versao = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
const raiz = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: raiz,
  plugins: [react()],
  define: { __VERSAO__: JSON.stringify(versao) },
  resolve: { alias: { '@compartilhado': fileURLToPath(new URL('../compartilhado', import.meta.url)) } },
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/auth': 'http://localhost:8787',
    },
  },
});
