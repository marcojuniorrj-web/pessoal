import { expect, test } from '@playwright/test';
import { simularApi, simularTarefas, tarefaFalsa } from './apoio';

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

test('com o modo avião ligado, o app abre, mostra "Offline" e a aba Tarefas abre com a última lista, só para leitura', async ({ page, context }) => {
  await simularApi(page);
  await simularTarefas(page, { tarefas: [tarefaFalsa('Ligar para o banco')] });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), Marco\.$/ })).toBeVisible();
  // espera o service worker assumir o controle da página
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Com internet, abre a aba Tarefas uma vez: a lista fica guardada no aparelho.
  await page.getByRole('navigation').getByText('Tarefas').click();
  await expect(page.getByText('Ligar para o banco')).toBeVisible();
  await page.getByRole('navigation').getByText('Chat').click();

  await page.unroute('**/api/eu');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Offline', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible(); // usuário vem do cache local
  await page.getByRole('navigation').getByText('Tarefas').click();
  await expect(page.getByText('Ligar para o banco')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Adicionar' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Concluir: Ligar para o banco' })).toBeDisabled();
});

test('faixa "Offline" aparece quando o servidor falha, mesmo com navigator.onLine = true, e some ao voltar', async ({ page }) => {
  await simularApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
  await expect(page.getByText('Offline', { exact: true })).toHaveCount(0);

  // O app volta para a frente (como no iPhone) com a rede caída, sem recarregar a página.
  await page.unroute('**/api/eu');
  await page.route('**/api/eu', (rota) => rota.abort('internetdisconnected'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('Offline', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible(); // continua usando o cache local

  // A rede volta: a faixa some.
  await page.unroute('**/api/eu');
  await simularApi(page);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('Offline', { exact: true })).toHaveCount(0);
});
