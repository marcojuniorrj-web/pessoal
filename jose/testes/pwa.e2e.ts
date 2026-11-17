import { expect, test } from '@playwright/test';
import { simularApi } from './apoio';

test.use({ baseURL: 'http://localhost:4173' });

test('manifest instalável: nome, ícones, standalone e ícone maskable', async ({ page, request }) => {
  await simularApi(page);
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const m = await (await request.get(href!)).json();
  expect(m.name).toBe('José');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBe('/');
  const tamanhos = m.icons.map((i: { sizes: string }) => i.sizes);
  expect(tamanhos).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icone of m.icons) expect((await request.get(icone.src)).status()).toBe(200);
});

test('com o modo avião ligado, o app abre e mostra "Offline"', async ({ page, context }) => {
  await simularApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), Marco\.$/ })).toBeVisible();
  // espera o service worker assumir o controle da página
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await page.unroute('**/api/eu');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Offline', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible(); // usuário vem do cache local
  await page.getByRole('navigation').getByText('Tarefas').click();
  await expect(page.getByText('Nada por aqui.')).toBeVisible();
});
