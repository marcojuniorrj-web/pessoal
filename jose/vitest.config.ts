import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@compartilhado': fileURLToPath(new URL('./compartilhado', import.meta.url)) } },
  test: {
    include: ['{app,servidor,compartilhado}/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
