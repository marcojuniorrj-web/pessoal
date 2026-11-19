import { expect, test, type Page } from '@playwright/test';
import { simularApi } from './apoio';
import { elementosComTransbordo } from './medidas';

// História 10: "Apagar todos os meus dados" (aviso → digitar APAGAR → apagando → Login), sem tocar em nenhum banco real.
async function abrirAjustes(page: Page) {
  await simularApi(page);
  await page.goto('/ajustes');
  await expect(page.getByText('marco@gmail.com')).toBeVisible();
}

test.describe('Apagar todos os meus dados', () => {
  test('aviso, digitar APAGAR exato, apagando, limpa o aparelho e volta ao Login', async ({ page }) => {
    await simularApi(page);
    // Dados que o app guarda no aparelho.
    await page.addInitScript(() => {
      // window.name sobrevive à recarga; o sessionStorage seria apagado pelo próprio app.
      if (window.name === 'semeado') return;
      window.name = 'semeado';
      localStorage.setItem('jose:lista:tarefas', JSON.stringify([{ id: 't1', titulo: 'Segredo' }]));
      localStorage.setItem('jose:rascunho:nova', 'texto a meio');
    });
    let corpo: unknown = null;
    let metodo = '';
    await page.route('**/api/eu', async (r) => {
      if (r.request().method() === 'DELETE') {
        metodo = 'DELETE';
        corpo = r.request().postDataJSON();
        await new Promise((ok) => setTimeout(ok, 600)); // dá tempo de ver "Apagando…"
        // A partir daqui o servidor já não reconhece a sessão.
        await page.route('**/api/eu', (r2) => r2.fulfill({ status: 401, json: { erro: { codigo: 'nao_autenticado', mensagem: 'x' } } }));
        return r.fulfill({ status: 204 });
      }
      return r.fallback();
    });
    await page.goto('/ajustes');
    await page.getByRole('button', { name: 'Apagar todos os meus dados' }).click();
    // 1) aviso
    await expect(page.getByRole('alertdialog')).toContainText('Não dá para desfazer');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await page.getByRole('button', { name: 'Apagar todos os meus dados' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    // 2) digitar
    const campo = page.getByLabel('Digite APAGAR para apagar tudo');
    await expect(campo).toBeFocused();
    const apagar = page.getByRole('button', { name: 'Apagar tudo' });
    await expect(apagar).toBeDisabled();
    await campo.fill('apagar');
    await expect(apagar).toBeDisabled();
    await campo.fill('APAGAR ');
    await expect(apagar).toBeDisabled();
    await campo.fill('APAGAR');
    await expect(apagar).toBeEnabled();
    expect(metodo).toBe('');
    await apagar.click();
    // 3) apagando
    await expect(page.getByRole('button', { name: 'Apagando…' })).toBeDisabled();
    await expect(campo).toBeDisabled();
    // 4) volta ao Login e o aparelho fica limpo
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /Entrar com Google/ })).toBeVisible();
    expect(metodo).toBe('DELETE');
    expect(corpo).toEqual({ confirmacao: 'APAGAR' });
    const restos = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('jose:')));
    expect(restos).toEqual([]);
  });

  test('erro: mostra o aviso, mantém tudo e permite tentar de novo', async ({ page }) => {
    await simularApi(page);
    await page.addInitScript(() => localStorage.setItem('jose:lista:tarefas', '[]'));
    let tentativas = 0;
    await page.route('**/api/eu', (r) => {
      if (r.request().method() !== 'DELETE') return r.fallback();
      tentativas += 1;
      return tentativas === 1 ? r.fulfill({ status: 500, json: { erro: { codigo: 'erro_interno', mensagem: 'x' } } }) : r.fulfill({ status: 204 });
    });
    await page.goto('/ajustes');
    await page.getByRole('button', { name: 'Apagar todos os meus dados' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Digite APAGAR para apagar tudo').fill('APAGAR');
    await page.getByRole('button', { name: 'Apagar tudo' }).click();
    await expect(page.getByRole('alert')).toContainText('Nada foi apagado');
    await expect(page).toHaveURL(/\/ajustes/);
    expect(await page.evaluate(() => localStorage.getItem('jose:lista:tarefas'))).toBe('[]');
    await expect(page.getByRole('button', { name: 'Apagar tudo' })).toBeEnabled();
    await page.getByRole('button', { name: 'Apagar tudo' }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(tentativas).toBe(2);
  });

  test('Esc fecha o aviso e o passo de digitar sem apagar nada', async ({ page }) => {
    await abrirAjustes(page);
    let chamado = false;
    await page.route('**/api/eu', (r) => {
      if (r.request().method() === 'DELETE') chamado = true;
      return r.fallback();
    });
    await page.getByRole('button', { name: 'Apagar todos os meus dados' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await page.getByRole('button', { name: 'Apagar todos os meus dados' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Digite APAGAR para apagar tudo').fill('APAGAR');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Apagar todos os meus dados' })).toBeVisible();
    expect(chamado).toBe(false);
  });

  test('Enter no campo com APAGAR confirma; alvos de 48 px e sem rolagem lateral', async ({ page }) => {
    await abrirAjustes(page);
    await page.route('**/api/eu', (r) => (r.request().method() === 'DELETE' ? r.fulfill({ status: 204 }) : r.fallback()));
    await page.getByRole('button', { name: 'Apagar todos os meus dados' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    const campo = page.getByLabel('Digite APAGAR para apagar tudo');
    for (const el of [campo, page.getByRole('button', { name: 'Cancelar' }), page.getByRole('button', { name: 'Apagar tudo' })]) {
      const caixa = (await el.boundingBox())!;
      expect(caixa.height).toBeGreaterThanOrEqual(47.5);
    }
    const larg = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(larg[0]).toBeLessThanOrEqual(larg[1]!);
    expect(await elementosComTransbordo(page)).toEqual([]);
    await campo.fill('APAGAR');
    await campo.press('Enter');
    await expect(page).toHaveURL(/\/login/);
  });
});
