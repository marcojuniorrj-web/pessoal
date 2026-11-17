import { expect, test } from '@playwright/test';
import { simularApi } from './apoio';

test('navega por todas as telas e volta, sem beco sem saída', async ({ page }) => {
  await simularApi(page);
  await page.goto('/');
  const abas = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(abas).toBeVisible();

  await abas.getByText('Tarefas').click();
  await expect(page).toHaveURL(/\/tarefas$/);
  await expect(page.getByText('Nada por aqui. Converse com o José e salve o que importar.')).toBeVisible();
  await page.getByRole('button', { name: 'Ir para o Chat' }).click();
  await expect(page).toHaveURL(/\/$/);

  await abas.getByText('José sabe').click();
  await expect(page).toHaveURL(/\/jose-sabe$/);
  await expect(page.getByText('O José ainda não sabe nada sobre você.')).toBeVisible();

  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page).toHaveURL(/\/ajustes$/);
  await expect(abas).toBeVisible(); // a barra continua: nenhum beco sem saída
  await page.getByRole('link', { name: 'Voltar' }).click();
  await expect(page).toHaveURL(/\/jose-sabe$/);

  await abas.getByText('Chat').click();
  await expect(page).toHaveURL(/\/$/);
});

test('sem sessão (401) leva ao Login guardando a rota de volta', async ({ page }) => {
  await simularApi(page, false);
  await page.goto('/tarefas');
  await expect(page).toHaveURL(/\/login\?voltar=%2Ftarefas/);
  await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible();
});

test('no computador o conteúdo fica numa coluna de até 680px', async ({ page }, info) => {
  test.skip(info.project.name !== 'computador');
  await simularApi(page);
  await page.goto('/tarefas');
  const largura = await page.locator('main').evaluate((e) => e.getBoundingClientRect().width);
  expect(largura).toBeLessThanOrEqual(680);
});
