import { expect, test } from '@playwright/test';
import { simularApi } from './apoio';

// Garante o que quebrou no iPhone: nada passa da largura da tela e a barra de abas nunca some sozinha.
for (const largura of [320, 390]) {
  test(`largura ${largura}px: sem rolagem lateral e a barra de abas sempre visível em todas as telas`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 700 });
    await simularApi(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();

    for (const aba of ['Chat', 'Tarefas', 'José sabe']) {
      await page.getByRole('navigation').getByText(aba, { exact: true }).click();
      const medidas = await page.evaluate(() => ({
        rolagem: document.documentElement.scrollWidth,
        largura: window.innerWidth,
        teclado: document.documentElement.dataset.teclado ?? null,
      }));
      expect(medidas.rolagem, `rolagem lateral em ${aba}`).toBeLessThanOrEqual(medidas.largura);
      expect(medidas.teclado === 'aberto', `teclado preso em ${aba}`).toBe(false);
      await expect(page.getByRole('navigation')).toBeVisible();
    }
  });
}

test('Chat: sair para outra aba funciona, e o foco no campo não deixa a barra de abas presa', async ({ page }) => {
  await simularApi(page);
  await page.goto('/');
  const campo = page.getByRole('textbox');
  await campo.focus();
  await campo.blur();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.teclado ?? 'fechado')).toBe('fechado');
  await page.getByRole('navigation').getByText('Tarefas', { exact: true }).click();
  await expect(page.getByText('Nada por aqui.')).toBeVisible();
});
