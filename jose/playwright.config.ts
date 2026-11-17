import { defineConfig, devices } from '@playwright/test';

// Use CHROME_PATH para apontar um Chrome já instalado (senão: npx playwright install chromium).
const executablePath = process.env.CHROME_PATH || undefined;

export default defineConfig({
  testDir: 'testes',
  testMatch: '**/*.e2e.ts',
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npx vite --config app/vite.config.ts --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'celular',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', launchOptions: { executablePath, args: ['--no-sandbox'] } },
    },
    {
      name: 'computador',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath, args: ['--no-sandbox'] } },
    },
  ],
});
