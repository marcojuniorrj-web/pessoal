import { defineConfig, devices } from '@playwright/test';

// Use CHROME_PATH para apontar um Chrome já instalado (senão: npx playwright install chromium).
const executablePath = process.env.CHROME_PATH || undefined;

export default defineConfig({
  testDir: 'testes',
  testMatch: '**/*.e2e.ts',
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    { command: 'npx vite --config app/vite.config.ts --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
    // Versão compilada (com service worker) para o teste de PWA/offline.
    { command: 'npm run build && npx vite preview --config app/vite.config.ts --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120_000 },
  ],
  projects: [
    {
      name: 'celular',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', launchOptions: { executablePath, args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } },
    },
    {
      name: 'computador',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath, args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } },
    },
  ],
});
