import { expect, test } from '@playwright/test';
import { novaConversa, simularApi, simularChat, simularTarefas } from './apoio';

import type { Locator } from '@playwright/test';
/** O botão que abre a conversa (o nome acessível leva também a hora/data; o ⋯ começa com "Mais opções"). */
const item = (onde: Locator, titulo: string) => onde.getByRole('button', { name: new RegExp(`^${titulo}`) });

const conversas = () => [
  novaConversa('a', 'Plano do dia', 30, 'padrao', [['marco', 'oi'], ['jose', 'Bom dia, Marco.']]),
  novaConversa('b', 'Decisão da promoção', 60 * 30, 'decidir'), // ~30 h atrás: ontem
  novaConversa('c', 'Conversa antiga', 60 * 24 * 20),
];

test.describe('Gaveta de Histórico (2.9)', () => {
  test('lista em grupos, com hora (Hoje) ou data (mais antigas), e abre a conversa tocada', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { conversas: conversas(), hoje: 'a' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Histórico' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await expect(gaveta.getByRole('heading', { name: 'Hoje' })).toBeVisible();
    await expect(gaveta.getByRole('heading', { name: 'Mais antigas' })).toBeVisible();
    await expect(gaveta.getByRole('region', { name: 'Hoje' }).getByText(/^\d{2}:\d{2}$/)).toBeVisible();
    await expect(gaveta.getByRole('region', { name: 'Mais antigas' }).getByText(/^\d{2}\/\d{2}$/)).toBeVisible();
    await item(gaveta, 'Conversa antiga').click();
    await expect(gaveta).toHaveCount(0);
    await expect(page).toHaveURL(/\/\?c=c$/);
    await expect(page.getByRole('heading', { name: 'Conversa antiga' })).toBeVisible();
  });

  test('esqueleto enquanto carrega e "Nenhuma conversa ainda." quando vazio', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { atrasoListaMs: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Histórico' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await expect(gaveta.getByRole('status', { name: 'Carregando' })).toBeVisible();
    await expect(gaveta.getByText('Nenhuma conversa ainda.')).toBeVisible();
    await expect(gaveta.getByRole('status', { name: 'Carregando' })).toHaveCount(0);
  });

  test('erro ao carregar mostra a mensagem e "Tentar de novo" recarrega', async ({ page }) => {
    await simularApi(page);
    const f = await simularChat(page, { conversas: conversas(), listaFalha: true });
    await page.goto('/');
    await page.getByRole('button', { name: 'Histórico' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await expect(gaveta.getByText('Não foi possível carregar.')).toBeVisible();
    f.listaFalha = false;
    await gaveta.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(item(gaveta, 'Plano do dia')).toBeVisible();
  });

  test('Esc e o X fecham a gaveta', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { conversas: conversas() });
    await page.goto('/');
    await page.getByRole('button', { name: 'Histórico' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Histórico' }).click();
    await page.getByRole('button', { name: 'Fechar histórico' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('toast "Apagado" não cobre o campo de digitação nem o botão de ação', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { conversas: conversas(), hoje: 'a' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Histórico' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await gaveta.getByRole('button', { name: 'Mais opções de Conversa antiga' }).click();
    await gaveta.getByRole('menuitem', { name: 'Apagar' }).click();
    const aviso = page.locator('.toast');
    await expect(aviso).toContainText('Apagado.');
    await page.getByRole('button', { name: 'Fechar histórico' }).click();
    await expect(aviso).toBeVisible();
    await page.waitForTimeout(300); // fim da animação de entrada
    const t = (await aviso.boundingBox())!;
    for (const alvo of [page.getByLabel('Mensagem para o José'), page.locator('.chat__acao')]) {
      const b = (await alvo.boundingBox())!;
      const sobrepoe = t.x < b.x + b.width && t.x + t.width > b.x && t.y < b.y + b.height && t.y + t.height > b.y;
      expect(sobrepoe).toBe(false);
    }
  });

  test('título de 80 caracteres sem espaço não estoura a gaveta: hora e ⋯ continuam visíveis', async ({ page }) => {
    await simularApi(page);
    const longo = 'x'.repeat(80);
    await simularChat(page, { conversas: [novaConversa('a', 'Plano do dia', 30), novaConversa('l', longo, 40)], hoje: 'a' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Histórico' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await page.waitForTimeout(400); // fim da animação de deslizar
    const caixa = (await gaveta.boundingBox())!;
    const linha = gaveta.locator('li', { hasText: longo });
    const mais = linha.getByRole('button', { name: /^Mais opções/ });
    const quando = linha.locator('.gaveta__quando');
    await expect(mais).toBeVisible();
    await expect(quando).toBeVisible();
    for (const el of [mais, quando]) {
      const b = (await el.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(caixa.x);
      expect(b.x + b.width).toBeLessThanOrEqual(caixa.x + caixa.width + 0.5);
    }
    expect(await gaveta.locator('.gaveta__corpo').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  });

  test('foco: entra na gaveta, o Tab fica preso nela e volta ao botão Histórico ao fechar (Esc e X)', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { conversas: conversas(), hoje: 'a' });
    await page.goto('/');
    const abrir = page.getByRole('button', { name: 'Histórico' });
    await abrir.click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await expect(gaveta.getByRole('button', { name: 'Fechar histórico' })).toBeFocused();
    await expect(gaveta.getByRole('button', { name: /^Plano do dia/ })).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await gaveta.evaluate((g) => g.contains(document.activeElement))).toBe(true);
    }
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await gaveta.evaluate((g) => g.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(gaveta).toHaveCount(0);
    await expect(abrir).toBeFocused();
    await abrir.click();
    await page.getByRole('button', { name: 'Fechar histórico' }).click();
    await expect(abrir).toBeFocused();
  });

  test('apagar → Desfazer: nada é apagado (nem depois de esperar mais de 5 s)', async ({ page }) => {
    await simularApi(page);
    const f = await simularChat(page, { conversas: conversas(), hoje: 'a' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Histórico' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await gaveta.getByRole('button', { name: 'Mais opções de Decisão da promoção' }).click();
    await gaveta.getByRole('menuitem', { name: 'Apagar' }).click();
    await expect(item(gaveta, 'Decisão da promoção')).toHaveCount(0);
    const aviso = page.locator('.toast');
    await expect(aviso).toContainText('Apagado.');
    await aviso.getByRole('button', { name: 'Desfazer' }).click();
    await expect(item(gaveta, 'Decisão da promoção')).toBeVisible();
    await page.waitForTimeout(5600);
    expect(f.deletes).toEqual([]);
    expect(f.conversas.map((c) => c.id)).toContain('b');
  });

  test('apagar sem desfazer: espera 5 s antes de chamar a API e então some', async ({ page }) => {
    await simularApi(page);
    const f = await simularChat(page, { conversas: conversas(), hoje: 'a' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Histórico' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await gaveta.getByRole('button', { name: 'Mais opções de Conversa antiga' }).click();
    const t0 = Date.now();
    await gaveta.getByRole('menuitem', { name: 'Apagar' }).click();
    await page.waitForTimeout(3500);
    expect(f.deletes).toEqual([]); // ainda dentro dos 5 s
    await expect.poll(() => f.deletes, { timeout: 4000 }).toEqual(['c']);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(4900);
    await page.getByRole('button', { name: 'Fechar histórico' }).click();
    await page.getByRole('button', { name: 'Histórico' }).click();
    await expect(item(page.getByRole('dialog'), 'Conversa antiga')).toHaveCount(0);
  });

  test('apagar a conversa aberta leva ao Chat vazio', async ({ page }) => {
    await simularApi(page);
    const f = await simularChat(page, { conversas: conversas(), hoje: 'a' });
    await page.goto('/');
    await expect(page.locator('.balao--marco')).toHaveText('oi');
    await page.getByRole('button', { name: 'Histórico' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await gaveta.getByRole('button', { name: 'Mais opções de Plano do dia' }).click();
    await gaveta.getByRole('menuitem', { name: 'Apagar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/nova=1/);
    await expect(page.locator('.balao')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /O que faço hoje\?/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nova conversa' })).toBeVisible();
    expect(f.deletes).toEqual([]); // ainda dentro dos 5 s
  });

  test('o apagamento continua mesmo trocando de aba durante os 5 s', async ({ page }) => {
    await simularApi(page);
    await simularTarefas(page);
    const f = await simularChat(page, { conversas: conversas(), hoje: 'a' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Histórico' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await gaveta.getByRole('button', { name: 'Mais opções de Conversa antiga' }).click();
    await gaveta.getByRole('menuitem', { name: 'Apagar' }).click();
    await page.getByRole('button', { name: 'Fechar histórico' }).click();
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByText('Tarefas').click();
    await expect.poll(() => f.deletes, { timeout: 7000 }).toEqual(['c']);
  });
});
