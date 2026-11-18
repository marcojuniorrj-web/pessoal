import { expect, test, type Page } from '@playwright/test';
import { novaConversa, simularApi, simularChat } from './apoio';

test.describe('Chat (2.7)', () => {
  test('vazio: saudação e os 4 atalhos', async ({ page }) => {
    await simularApi(page);
    await simularChat(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), Marco\.$/ })).toBeVisible();
    for (const nome of ['O que faço hoje?', 'Travei', 'Descarregar a cabeça', 'Preciso decidir']) {
      await expect(page.getByRole('button', { name: new RegExp(nome) })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Nova conversa' })).toBeVisible();
  });

  test('atalho envia o próprio texto; a primeira parte da resposta aparece em até 3 s; título aparece no topo', async ({ page }) => {
    await simularApi(page);
    const f = await simularChat(page);
    await page.goto('/');
    const inicio = Date.now();
    await page.getByRole('button', { name: /O que faço hoje\?/ }).click();
    await expect(page.locator('.balao--marco')).toHaveText('O que faço hoje?');
    await expect(page.locator('.balao--jose').first()).toContainText('Resposta do José.', { timeout: 3000 });
    expect(Date.now() - inicio).toBeLessThan(3000);
    await expect(page.getByRole('heading', { name: 'Título de teste' })).toBeVisible();
    expect(f.postsConversa).toEqual([{ tipo: 'normal', modo: 'padrao' }]);
    expect(f.postsMensagem.map((p) => p.texto)).toEqual(['O que faço hoje?']);
    // a URL passa a apontar para a conversa criada; os atalhos somem
    await expect(page).toHaveURL(/\/\?c=c1$/);
    await expect(page.getByRole('button', { name: /Travei/ })).toHaveCount(0);
  });

  test('mostra "José está pensando…" enquanto a resposta não chega', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { atrasoMs: 1200 });
    await page.goto('/');
    await page.getByLabel('Mensagem para o José').fill('travei no relatório de vendas');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByText('José está pensando')).toBeVisible();
    await expect(page.locator('.balao--jose')).toContainText('Resposta do José.');
    await expect(page.getByText('José está pensando')).toHaveCount(0);
  });

  test('digitar e enviar pelo botão; o campo limpa e o botão só vale com texto', async ({ page }) => {
    await simularApi(page);
    const f = await simularChat(page);
    await page.goto('/');
    const enviar = page.getByRole('button', { name: 'Enviar' });
    await expect(enviar).toBeDisabled();
    const campo = page.getByLabel('Mensagem para o José');
    await campo.fill('travei no relatório de vendas');
    await expect(enviar).toBeEnabled();
    await enviar.click();
    await expect(campo).toHaveValue('');
    await expect(page.locator('.balao--marco')).toHaveText('travei no relatório de vendas');
    await expect(page.locator('.balao--jose')).toContainText('Próximo passo');
    expect(f.postsMensagem).toHaveLength(1);
  });

  test('abre na conversa de hoje, com as mensagens e o título', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { conversas: [novaConversa('h1', 'Plano do dia', 10, 'padrao', [['marco', 'oi'], ['jose', 'Bom dia, Marco.']])], hoje: 'h1' });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Plano do dia' })).toBeVisible();
    await expect(page.locator('.balao--marco')).toHaveText('oi');
    await expect(page.locator('.balao--jose')).toHaveText('Bom dia, Marco.');
    await expect(page.getByRole('button', { name: /Travei/ })).toHaveCount(0);
  });

  test('Nova conversa abre o Chat vazio com os atalhos', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { conversas: [novaConversa('h1', 'Plano do dia', 10, 'padrao', [['marco', 'oi'], ['jose', 'Bom dia, Marco.']])], hoje: 'h1' });
    await page.goto('/');
    await expect(page.locator('.balao--marco')).toBeVisible();
    await page.getByRole('button', { name: 'Nova conversa' }).click();
    await expect(page).toHaveURL(/nova=1/);
    await expect(page.locator('.balao')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /O que faço hoje\?/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nova conversa' })).toBeVisible();
  });

  test('"Preciso decidir" cria a conversa em modo decisão e mostra o selo', async ({ page }) => {
    await simularApi(page);
    const f = await simularChat(page);
    await page.goto('/');
    await page.getByRole('button', { name: /Preciso decidir/ }).click();
    await expect(page.getByText('Modo decisão', { exact: true }).first()).toBeVisible();
    expect(f.postsConversa).toEqual([{ tipo: 'normal', modo: 'decidir' }]);
    await expect(page.getByRole('button', { name: /Travei/ })).toHaveCount(0);
    // ao reabrir a conversa o selo continua; Nova conversa sai do modo
    await page.reload();
    await expect(page.locator('.chat__selo')).toHaveText('Modo decisão');
    await page.getByRole('button', { name: 'Nova conversa' }).click();
    await expect(page.locator('.chat__selo')).toHaveCount(0);
  });

  test('o campo de digitação fica à vista logo acima da barra de abas', async ({ page }) => {
    await simularApi(page);
    await simularChat(page);
    await page.goto('/');
    const campo = await page.getByLabel('Mensagem para o José').boundingBox();
    const barra = await page.getByRole('navigation', { name: 'Navegação principal' }).boundingBox();
    const vp = page.viewportSize()!;
    expect(campo!.y + campo!.height).toBeLessThanOrEqual(barra!.y + 1);
    expect(barra!.y + barra!.height).toBeLessThanOrEqual(vp.height + 1);
    // alvos de toque de pelo menos 48px
    const enviar = await page.getByRole('button', { name: 'Enviar' }).boundingBox();
    expect(enviar!.height).toBeGreaterThanOrEqual(48);
  });
});

// Onda 5, ajuste 5: o que o Marco digita enquanto a conversa de hoje ainda carrega nunca é apagado pelo rascunho lido.
test.describe('Digitar enquanto a conversa de hoje carrega', () => {
  const campo = (page: Page) => page.getByLabel('Mensagem para o José');

  test('com conversa de hoje: o texto digitado continua no campo (e o rascunho vazio da conversa não o apaga)', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { conversas: [novaConversa('h1', 'Plano do dia', 10, 'padrao', [['marco', 'oi'], ['jose', 'Bom dia, Marco.']])], hoje: 'h1', atrasoHojeMs: 1500 });
    await page.goto('/');
    await expect(campo(page)).toBeVisible();
    await campo(page).fill('estou digitando antes de carregar');
    await expect(page.getByRole('heading', { name: 'Plano do dia' })).toBeVisible({ timeout: 5000 }); // a carga terminou
    await expect(page.locator('.balao--jose')).toHaveText('Bom dia, Marco.');
    await expect(campo(page)).toHaveValue('estou digitando antes de carregar');
    // e o rascunho passa a valer para a conversa carregada: sobrevive a um reload
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Plano do dia' })).toBeVisible({ timeout: 5000 });
    await expect(campo(page)).toHaveValue('estou digitando antes de carregar');
  });

  test('sem conversa de hoje: o texto digitado continua no campo', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { atrasoHojeMs: 1500 });
    await page.goto('/');
    await campo(page).fill('só um começo de ideia');
    await expect(page.getByRole('button', { name: /Travei/ })).toBeVisible({ timeout: 5000 });
    await expect(campo(page)).toHaveValue('só um começo de ideia');
  });

  test('sem digitar nada: o rascunho salvo da conversa ainda preenche o campo', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { conversas: [novaConversa('h1', 'Plano do dia', 10, 'padrao', [['marco', 'oi'], ['jose', 'Bom dia, Marco.']])], hoje: 'h1', atrasoHojeMs: 800 });
    await page.addInitScript(() => localStorage.setItem('jose:rascunho:h1', 'rascunho guardado'));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Plano do dia' })).toBeVisible({ timeout: 5000 });
    await expect(campo(page)).toHaveValue('rascunho guardado');
  });
});

test('"Nova conversa" continua limpando o campo (o texto digitado depois da carga não é tratado como digitado durante a carga)', async ({ page }) => {
  await simularApi(page);
  await simularChat(page, { conversas: [novaConversa('h1', 'Plano do dia', 10, 'padrao', [['marco', 'oi'], ['jose', 'Bom dia, Marco.']])], hoje: 'h1' });
  await page.goto('/');
  await expect(page.locator('.balao--marco')).toBeVisible();
  await page.getByLabel('Mensagem para o José').fill('texto da conversa antiga');
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  await expect(page.getByRole('heading', { name: 'Nova conversa' })).toBeVisible();
  await expect(page.getByLabel('Mensagem para o José')).toHaveValue('');
});

// Pedido do Marco: a barra de cima estava apertada ("Nova" grudada nos 3 pontinhos). O ✎ de nova conversa e o ⋯ têm alvo
// de pelo menos 48 px e folga de pelo menos 12 px entre as caixas de toque, e o título continua com espaço, em qualquer largura de celular.
for (const largura of [320, 360, 390, 430, 1280]) {
  test(`barra do topo em ${largura}px: ✎ e ⋯ separados (>= 12 px entre as caixas de toque), alvos >= 48 px e título com espaço`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await simularApi(page);
    await simularChat(page, { conversas: [novaConversa('h1', 'Organizando prioridades do dia', 10, 'padrao', [['marco', 'oi'], ['jose', 'Bom dia, Marco.']])], hoje: 'h1' });
    await page.goto('/');
    const nova = page.getByRole('button', { name: 'Nova conversa' });
    const mais = page.getByRole('button', { name: 'Mais opções da conversa' });
    await expect(mais).toBeVisible();
    const n = (await nova.boundingBox())!;
    const m = (await mais.boundingBox())!;
    const t = (await page.getByRole('heading', { name: 'Organizando prioridades do dia' }).boundingBox())!;
    expect(n.width).toBeGreaterThanOrEqual(48);
    expect(n.height).toBeGreaterThanOrEqual(48);
    expect(m.width).toBeGreaterThanOrEqual(48);
    expect(m.height).toBeGreaterThanOrEqual(48);
    // as áreas clicáveis não se tocam e há folga entre os ícones (a caixa do botão tem 48 px; o ícone fica no centro)
    expect(m.x - (n.x + n.width)).toBeGreaterThanOrEqual(12);
    expect((m.x + m.width / 2) - (n.x + n.width / 2)).toBeGreaterThanOrEqual(60);
    expect(t.width).toBeGreaterThanOrEqual(largura <= 320 ? 100 : 140);
    // nada passa da largura
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
