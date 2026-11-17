import { expect, test } from '@playwright/test';
import { simularApi } from './apoio';

// Chrome com microfone falso: valida gravar → parar → enviar → mostrar o texto (API simulada).
test('página de teste de voz: gravar, parar e ver a transcrição', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  await simularApi(page);
  let tipoEnviado = '';
  await page.route('**/api/voz', async (r) => {
    tipoEnviado = r.request().headers()['content-type'] ?? '';
    await r.fulfill({ status: 200, json: { texto: 'amanhã preciso ligar para o cliente às dez' } });
  });
  await page.context().grantPermissions(['microphone']);
  await page.goto('/teste-voz');
  await page.getByRole('button', { name: /Gravar/ }).click();
  await expect(page.getByRole('button', { name: /Parar/ })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Parar/ }).click();
  await expect(page.getByLabel('Texto transcrito')).toContainText('amanhã preciso ligar para o cliente às dez');
  expect(tipoEnviado).toContain('multipart/form-data');
});
