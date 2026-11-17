import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{app,servidor,compartilhado}/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
