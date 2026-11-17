import { expect, test } from '@playwright/test';
import { novaConversa, simularApi, simularChat } from './apoio';

test.describe('Estados do Chat (2.8)', () => {
  test('erro da IA: balão com "Tentar de novo"; ao tentar, reenvia o MESMO id e não duplica a mensagem', async ({ page }) => {
    await simularApi(page);
    const f = await simularChat(page, { planos: ['erro-ia', 'ok'] });
    await page.goto('/');
    await page.getByLabel('Mensagem para o José').fill('travei no relatório de vendas');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('alert')).toContainText('O José não conseguiu responder agora.');
    await expect(page.locator('.balao--marco')).toHaveCount(1);
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.locator('.balao--jose')).toContainText('Próximo passo');
    await expect(page.getByRole('alert')).toHaveCount(0);
    // continua uma única mensagem do Marco, e as duas chamadas usaram o mesmo id
    await expect(page.locator('.balao--marco')).toHaveCount(1);
    expect(f.postsMensagem).toHaveLength(2);
    expect(f.postsMensagem[0]!.id).toBe(f.postsMensagem[1]!.id);
    expect(f.conversas[0]!.mensagens.filter((m) => m.autor === 'marco')).toHaveLength(1);
  });

  test('resposta interrompida no meio: mostra o aviso e "Tentar de novo"', async ({ page }) => {
    await simularApi(page);
    const f = await simularChat(page, { planos: ['cortada', 'ok'] });
    await page.goto('/');
    await page.getByRole('button', { name: /Travei/ }).click();
    await expect(page.getByRole('alert')).toContainText('A resposta foi interrompida.');
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.locator('.balao--jose')).toContainText('Próximo passo');
    await expect(page.locator('.balao--jose')).not.toContainText('pela metade');
    expect(new Set(f.postsMensagem.map((p) => p.id)).size).toBe(1);
  });

  test('limite diário: mensagem clara, sem botão de tentar de novo', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { planos: ['limite'] });
    await page.goto('/');
    await page.getByLabel('Mensagem para o José').fill('oi');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('alert')).toHaveText('Limite de hoje atingido, volta amanhã.');
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
  });

  test('offline: faixa "Offline" e envio desabilitado; volta ao normal ao reconectar', async ({ page }) => {
    await simularApi(page);
    await simularChat(page);
    await page.goto('/');
    const campo = page.getByLabel('Mensagem para o José');
    await expect(campo).toBeEnabled();
    await page.context().setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible();
    await expect(campo).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Travei/ })).toBeDisabled();
    await page.context().setOffline(false);
    await expect(campo).toBeEnabled();
  });

  test('falha de rede ao enviar: "Sem conexão." com Tentar de novo', async ({ page }) => {
    await simularApi(page);
    const f = await simularChat(page);
    await page.goto('/');
    await page.getByLabel('Mensagem para o José').fill('oi');
    // a rede cai só nesta chamada (o navegador ainda acha que está online)
    await page.route((u) => u.pathname === '/api/conversas', (r) => r.abort('internetdisconnected'), { times: 1 });
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('alert')).toContainText('Sem conexão.');
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.locator('.balao--jose')).toContainText('Próximo passo');
    expect(f.postsMensagem).toHaveLength(1);
  });

  test('ao reabrir uma conversa cuja última mensagem ficou sem resposta, oferece Tentar de novo (mesmo id)', async ({ page }) => {
    await simularApi(page);
    const f = await simularChat(page, { conversas: [novaConversa('h1', 'Relatório', 5, 'padrao', [['marco', 'travei no relatório']])], hoje: 'h1' });
    await page.goto('/');
    await expect(page.locator('.balao--marco')).toHaveText('travei no relatório');
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.locator('.balao--jose')).toContainText('Próximo passo');
    expect(f.postsMensagem[0]!.id).toBe('h1-m0');
    expect(f.conversas[0]!.mensagens.filter((m) => m.autor === 'marco')).toHaveLength(1);
  });

  test('sessão expirada (401) ao enviar: vai ao Login guardando a conversa e o rascunho', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { conversas: [novaConversa('h1', 'Plano', 5, 'padrao', [['marco', 'oi'], ['jose', 'Olá!']])], hoje: 'h1', planos: ['401'] });
    await page.goto('/?c=h1');
    await expect(page.getByRole('heading', { name: 'Plano' })).toBeVisible();
    await page.getByLabel('Mensagem para o José').fill('preciso falar com o cliente Alfa');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page).toHaveURL(/\/login\?voltar=%2F%3Fc%3Dh1$/);
    expect(await page.evaluate(() => localStorage.getItem('jose:rascunho:h1'))).toBe('preciso falar com o cliente Alfa');

    // depois de entrar de novo, o app volta à mesma conversa e o texto está no campo
    await page.goto('/?c=h1');
    await expect(page.getByRole('heading', { name: 'Plano' })).toBeVisible();
    await expect(page.getByLabel('Mensagem para o José')).toHaveValue('preciso falar com o cliente Alfa');
  });

  test('401 em qualquer chamada da API (aqui, o histórico) leva ao Login com a rota de volta', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { conversas: [novaConversa('h1', 'Plano', 5)] });
    await page.goto('/?c=h1');
    await expect(page.getByRole('heading', { name: 'Plano' })).toBeVisible();
    await page.route((u) => u.pathname === '/api/conversas', (r) => r.fulfill({ status: 401, json: { erro: { codigo: 'nao_autenticado', mensagem: 'x' } } }));
    await page.getByRole('button', { name: 'Histórico' }).click();
    await expect(page).toHaveURL(/\/login\?voltar=%2F%3Fc%3Dh1$/);
  });

  test('rascunho digitado é guardado e volta ao reabrir o app', async ({ page }) => {
    await simularApi(page);
    await simularChat(page);
    await page.goto('/');
    await page.getByLabel('Mensagem para o José').fill('ideia pela metade');
    await page.reload();
    await expect(page.getByLabel('Mensagem para o José')).toHaveValue('ideia pela metade');
  });
});
