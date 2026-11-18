import { expect, test, type Page } from '@playwright/test';
import { novaConversa, simularApi, simularChat, type ConversaFalsa } from './apoio';

// Pressão longa por TOQUE real (CDP): o clique sintético do touchend não pode agir sobre a folha que abriu sob o dedo.
test.beforeEach(({ page }, info) => {
  test.skip(info.project.name !== 'celular' || !page, 'só o projeto de celular tem toque');
});

const folha = (page: Page) => page.getByRole('dialog', { name: 'Ações da mensagem' });

function conversaLonga(): ConversaFalsa {
  const msgs: Array<[string, string, number?]> = [];
  for (let i = 0; i < 12; i++) msgs.push(['marco', `Pergunta ${i}`, 60 - i * 2], ['jose', `Resposta ${i} com um texto um pouco maior`, 59 - i * 2]);
  return novaConversa('a', 'Plano do dia', 30, 'padrao', msgs);
}

async function abrir(page: Page, largura: number, altura: number) {
  await page.setViewportSize({ width: largura, height: altura });
  await simularApi(page);
  const f = await simularChat(page, { conversas: [conversaLonga()], hoje: 'a' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Plano do dia' })).toBeVisible();
  await expect(page.locator('.balao--jose').last()).toBeVisible();
  return f;
}

async function toqueSegurado(page: Page, ponto: { x: number; y: number }, ms: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [ponto] });
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Centro do último balão do José (metade de baixo da tela) ou do primeiro totalmente visível (no topo). */
async function pontoDoBalao(page: Page, qual: 'baixo' | 'topo') {
  return page.evaluate((q) => {
    const topoLista = document.querySelector('.chat__mensagens')!.getBoundingClientRect().top;
    const baloes = [...document.querySelectorAll<HTMLElement>('.balao--jose')];
    const b = q === 'baixo' ? baloes.at(-1)! : baloes.find((x) => x.getBoundingClientRect().top > topoLista + 8)!;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, qual);
}

const TAMANHOS = [[390, 844], [320, 568]] as const;

for (const [largura, altura] of TAMANHOS) {
  test.describe(`toque real em ${largura}x${altura}`, () => {
    test('segurar 650 ms sobre um balão de baixo e soltar: nada é apagado nem copiado e a folha continua aberta; depois os toques reais funcionam', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      const f = await abrir(page, largura, altura);
      await page.evaluate(() => navigator.clipboard.writeText('sentinela'));
      const ponto = await pontoDoBalao(page, 'baixo');
      await toqueSegurado(page, ponto, 650);
      await expect(folha(page)).toBeVisible();
      // o dedo soltou em cima de um botão da folha: nenhum clique fantasma pode tê-lo acionado
      await page.waitForTimeout(1200);
      await expect(folha(page)).toBeVisible();
      await expect(page.locator('.toast')).toHaveCount(0);
      expect(f.deletesMensagem).toEqual([]);
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('sentinela');

      // toque real em Copiar
      const copiar = await folha(page).getByRole('button', { name: 'Copiar' }).boundingBox();
      await page.touchscreen.tap(copiar!.x + copiar!.width / 2, copiar!.y + copiar!.height / 2);
      await expect(page.locator('.toast')).toContainText('Copiado.');
      await expect(folha(page)).toHaveCount(0);
      expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Resposta 11');

      // e em Apagar
      await toqueSegurado(page, await pontoDoBalao(page, 'baixo'), 650);
      await expect(folha(page)).toBeVisible();
      await page.waitForTimeout(700);
      const apagar = await folha(page).getByRole('button', { name: 'Apagar mensagem', exact: true }).boundingBox();
      await page.touchscreen.tap(apagar!.x + apagar!.width / 2, apagar!.y + apagar!.height / 2);
      await expect(page.locator('.toast')).toContainText('Apagado.');
      await expect(folha(page)).toHaveCount(0);
      await expect.poll(() => f.deletesMensagem.length, { timeout: 7000 }).toBe(1);
    });
  });
}

for (const ms of [1000, 1500]) {
  test(`segurar ${ms} ms e soltar fora da folha: a folha continua aberta`, async ({ page }) => {
    const f = await abrir(page, 390, 844);
    const ponto = await pontoDoBalao(page, 'topo');
    const folhaTopo = 844 - 64 - 4 * 48 - 40; // a folha ocupa só a parte de baixo: o ponto está fora dela
    expect(ponto.y).toBeLessThan(folhaTopo);
    await toqueSegurado(page, ponto, ms);
    await expect(folha(page)).toBeVisible();
    await page.waitForTimeout(800);
    await expect(folha(page)).toBeVisible();
    expect(f.deletesMensagem).toEqual([]);
    // tocar de verdade no fundo (depois da janela) fecha
    await page.touchscreen.tap(20, 90);
    await expect(folha(page)).toHaveCount(0);
  });
}

test('o foco continua dentro da folha 200 ms depois de abrir por toque', async ({ page }) => {
  await abrir(page, 390, 844);
  for (const ponto of [await pontoDoBalao(page, 'topo'), await pontoDoBalao(page, 'baixo')]) {
    await toqueSegurado(page, ponto, 700);
    await expect(folha(page)).toBeVisible();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => !!document.activeElement?.closest('.folha'))).toBe(true);
    await page.waitForTimeout(700);
    await page.touchscreen.tap(20, 90);
    await expect(folha(page)).toHaveCount(0);
  }
});
