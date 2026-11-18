import { expect, test, type Page } from '@playwright/test';
import { simularApi, simularChat, simularMemorias } from './apoio';
import { simularBoasVindas, type BoasVindasFalsas } from './apoio-boasvindas';
import { elementosForaDaTela, medir, menoresQue } from './medidas';

const faixa = (page: Page) => page.getByRole('complementary', { name: 'Instalar na tela inicial' });
const estadoSalvo = (page: Page) => page.evaluate(() => localStorage.getItem('jose:instalar'));

async function abrir(page: Page, inicial: Partial<BoasVindasFalsas> = {}, url = '/') {
  await simularApi(page);
  await simularChat(page);
  const memorias = await simularMemorias(page);
  await page.route((u) => u.pathname.startsWith('/api/tarefas') || u.pathname.startsWith('/api/metas'), (r) => r.fulfill({ json: [] }));
  const f = await simularBoasVindas(page, inicial, memorias);
  await page.goto(url);
  return f;
}
/** Pula as boas-vindas (o jeito mais curto de "terminar" e cair no Chat). */
async function terminarBoasVindas(page: Page) {
  await page.getByRole('button', { name: 'Pular' }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
}
const ehIphone = (nome: string) => nome === 'celular'; // o projeto "celular" usa o user agent do iPhone

test.describe('Faixa "Instalar na tela inicial" (6.6)', () => {
  test('aparece no Chat logo depois das boas-vindas, com a instrução certa para o aparelho', async ({ page }, info) => {
    await abrir(page);
    await expect(page.getByRole('button', { name: 'Pular' })).toBeVisible();
    await expect(faixa(page)).toHaveCount(0); // nunca dentro das boas-vindas
    await terminarBoasVindas(page);
    await expect(faixa(page)).toBeVisible();
    expect(await estadoSalvo(page)).toBe('pendente');
    if (ehIphone(info.project.name)) {
      await expect(faixa(page)).toContainText('Compartilhar');
      await expect(faixa(page)).toContainText('Adicionar à Tela de Início');
    } else {
      await expect(faixa(page)).toContainText('No menu do navegador');
    }
  });

  test('depois de fechada (✕) nunca volta: nem ao recarregar, nem ao voltar ao Chat, nem refazendo as boas-vindas', async ({ page }) => {
    await abrir(page);
    await terminarBoasVindas(page);
    await faixa(page).getByRole('button', { name: 'Fechar aviso de instalação' }).click();
    await expect(faixa(page)).toHaveCount(0);
    expect(await estadoSalvo(page)).toBe('fechada');
    await page.reload();
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
    await expect(faixa(page)).toHaveCount(0);
    await page.getByRole('navigation').getByText('Tarefas', { exact: true }).click();
    await page.getByRole('navigation').getByText('Chat', { exact: true }).click();
    await expect(faixa(page)).toHaveCount(0);
    // refazer as boas-vindas não a traz de volta
    await page.goto('/ajustes');
    await page.getByRole('button', { name: 'Refazer boas-vindas' }).click();
    await page.getByRole('button', { name: 'Pular' }).click();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
    await expect(faixa(page)).toHaveCount(0);
  });

  test('enquanto não for fechada, continua à vista ao voltar ao Chat (é "uma vez" até fechar)', async ({ page }) => {
    await abrir(page);
    await terminarBoasVindas(page);
    await page.getByRole('navigation').getByText('Tarefas', { exact: true }).click();
    await page.getByRole('navigation').getByText('Chat', { exact: true }).click();
    await expect(faixa(page)).toBeVisible();
  });

  test('não aparece para quem nunca passou pelas boas-vindas neste aparelho (conta antiga)', async ({ page }) => {
    await abrir(page, { concluida: true });
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
    await expect(faixa(page)).toHaveCount(0);
    expect(await estadoSalvo(page)).toBeNull();
  });

  test('não aparece com o app já instalado (standalone), mesmo logo depois das boas-vindas', async ({ page }) => {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => (q.includes('display-mode: standalone') ? ({ ...original(q), matches: true, media: q } as MediaQueryList) : original(q));
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    });
    await abrir(page);
    await terminarBoasVindas(page);
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
    await expect(faixa(page)).toHaveCount(0);
  });

  test('Ajustes tem o mesmo item: mostra a instrução; com o app instalado diz que já está na tela inicial', async ({ page }, info) => {
    await abrir(page, { concluida: true }, '/ajustes');
    const botao = page.getByRole('button', { name: 'Instalar na tela inicial' });
    await expect(botao).toBeVisible();
    await botao.click();
    if (ehIphone(info.project.name)) {
      await expect(page.getByText('Compartilhar', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Adicionar à Tela de Início')).toBeVisible();
    } else {
      await expect(page.getByText('No menu do navegador')).toBeVisible();
    }
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    await botao.click();
    await expect(page.getByText('Adicionar à Tela de Início')).toHaveCount(0);
  });

  test('Ajustes com o app instalado: "Já está na tela inicial."', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }));
    await abrir(page, { concluida: true }, '/ajustes');
    await expect(page.getByText('Já está na tela inicial.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Instalar na tela inicial' })).toHaveCount(0);
  });
});

for (const largura of [320, 390]) {
  test(`faixa a ${largura}px: dentro da largura, ✕ com 48px, o documento não rola e as mensagens continuam à vista`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 640 });
    await abrir(page);
    await terminarBoasVindas(page);
    await expect(faixa(page)).toBeVisible();
    const { rolagem, largura: w, fora, transbordo } = await elementosForaDaTela(page);
    expect(rolagem).toBeLessThanOrEqual(w);
    expect(fora, JSON.stringify(fora)).toEqual([]);
    expect(transbordo).toEqual([]);
    expect(menoresQue(await medir(page, '.faixa-instalar__fechar'), 48)).toEqual([]);
    const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, v: window.innerHeight }));
    expect(doc.h).toBeLessThanOrEqual(doc.v);
    // a faixa não empurra o campo nem a barra de abas para fora da tela
    const campo = (await page.getByRole('textbox').boundingBox())!;
    const nav = (await medir(page, 'nav'))[0]!;
    expect(campo.y + campo.height).toBeLessThanOrEqual(nav.y + 0.5);
    const lista = (await page.locator('.chat__mensagens').boundingBox())!;
    expect(lista.height).toBeGreaterThan(100);
  });
}
