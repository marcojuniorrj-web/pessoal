import { expect, test } from '@playwright/test';
import { simularApi } from './apoio';

test.describe('Login', () => {
  test('mostra a frase e o botão', async ({ page }) => {
    await simularApi(page, false);
    await page.goto('/login');
    await expect(page.getByText('Seu assistente para o dia a dia')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible();
  });
  test('?erro=negado e ?erro=falha mostram as mensagens', async ({ page }) => {
    await simularApi(page, false);
    await page.goto('/?erro=negado');
    await expect(page.getByRole('alert')).toHaveText('Acesso negado — este app é pessoal.');
    await page.goto('/?erro=falha');
    await expect(page.getByRole('alert')).toHaveText('Não foi possível entrar. Tente de novo.');
  });
  test('o botão fica em carregamento e vai para /auth/google', async ({ page }) => {
    await simularApi(page, false);
    let destino = '';
    await page.route('**/auth/google**', (r) => {
      destino = r.request().url();
      return r.fulfill({ status: 200, body: 'ok' });
    });
    await page.goto('/login?voltar=%2Ftarefas');
    const botao = page.getByRole('button', { name: 'Entrar com Google' });
    await botao.click();
    await expect.poll(() => destino).toContain('/auth/google?voltar=%2Ftarefas');
  });
  test('sucesso: já logado, o Login redireciona', async ({ page }) => {
    await simularApi(page, true);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/$/);
  });
});

test('Chat vazio mostra a saudação por horário com o nome', async ({ page }) => {
  await simularApi(page);
  await page.clock.install({ time: new Date('2026-11-17T12:00:00-03:00') });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boa tarde, Marco.' })).toBeVisible();
});

test.describe('Ajustes', () => {
  test('mostra a conta, confirma e sai de todos, voltando ao Login', async ({ page }) => {
    await simularApi(page);
    let chamado = '';
    await page.route('**/auth/sair-todos', (r) => {
      chamado = r.request().method();
      return r.fulfill({ status: 204 });
    });
    await page.goto('/ajustes');
    await expect(page.getByText('marco@gmail.com')).toBeVisible();
    await page.getByRole('button', { name: 'Sair de todos os aparelhos' }).click();
    await expect(page.getByText('Sair de todos os aparelhos?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    expect(chamado).toBe('');
    await page.getByRole('button', { name: 'Sair de todos os aparelhos' }).click();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(chamado).toBe('POST');
  });
  test('Esc fecha a confirmação sem sair', async ({ page }) => {
    await simularApi(page);
    let chamado = false;
    await page.route('**/auth/sair*', (r) => {
      chamado = true;
      return r.fulfill({ status: 204 });
    });
    await page.goto('/ajustes');
    for (const nome of ['Sair', 'Sair de todos os aparelhos']) {
      await page.getByRole('button', { name: nome, exact: true }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('alertdialog')).toBeHidden();
    }
    expect(chamado).toBe(false);
  });

  test('Sair chama /auth/sair', async ({ page }) => {
    await simularApi(page);
    let chamado = false;
    await page.route('**/auth/sair', (r) => {
      chamado = true;
      return r.fulfill({ status: 204 });
    });
    await page.goto('/ajustes');
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(chamado).toBe(true);
  });
});
