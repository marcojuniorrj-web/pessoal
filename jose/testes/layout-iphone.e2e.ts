import { expect, test } from '@playwright/test';
import { memoriaFalsa, metaFalsa, simularApi, simularMemorias, simularTarefas, tarefaFalsa } from './apoio';
import { elementosComTransbordo } from './medidas';

// Garante o que quebrou no iPhone: nada passa da largura da tela e a barra de abas nunca some sozinha.
for (const largura of [320, 390]) {
  test(`largura ${largura}px: sem rolagem lateral e a barra de abas sempre visível em todas as telas`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 700 });
    await simularApi(page);
    await simularMemorias(page);
    await simularTarefas(page);
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
      expect(await elementosComTransbordo(page), `conteúdo vazando da caixa em ${aba}`).toEqual([]);
      await expect(page.getByRole('navigation')).toBeVisible();
    }
  });
}

test('Chat: sair para outra aba funciona, e o foco no campo não deixa a barra de abas presa', async ({ page }) => {
  await simularApi(page);
  await simularTarefas(page);
  await page.goto('/');
  const campo = page.getByRole('textbox');
  await campo.focus();
  await campo.blur();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.teclado ?? 'fechado')).toBe('fechado');
  await page.getByRole('navigation').getByText('Tarefas', { exact: true }).click();
  await expect(page.getByText('Nada por aqui.')).toBeVisible();
});

// O foco (teclado/leitor de tela) rola a página só o mínimo: o último item não pode ficar atrás da barra de abas fixa.
const MUITAS = Array.from({ length: 14 }, (_, i) => memoriaFalsa(`m${i}`, `Memória número ${i} com um texto de tamanho razoável.`, 'trabalho', i + 1));
for (const tamanho of [{ width: 320, height: 640 }, { width: 1280, height: 800 }]) {
  test(`${tamanho.width}x${tamanho.height}: focar o último item de José sabe o deixa acima da barra de abas`, async ({ page }) => {
    await page.setViewportSize(tamanho);
    await simularApi(page);
    await simularMemorias(page, { memorias: MUITAS });
    await page.goto('/jose-sabe');
    const ultimo = page.getByRole('button', { name: /^Mais opções de Memória número 13/ });
    await expect(ultimo).toBeVisible();
    // Posição do bug: o item cabe na janela, mas a borda de baixo está escondida atrás da barra fixa.
    await ultimo.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().bottom - window.innerHeight + 10));
    await ultimo.focus();
    const { fundo, barra } = await page.evaluate(() => ({
      fundo: document.activeElement!.getBoundingClientRect().bottom,
      barra: document.querySelector('nav')!.getBoundingClientRect().top,
    }));
    expect(fundo, 'borda de baixo do item focado vs. topo da barra').toBeLessThanOrEqual(barra);
  });
}

// Onda 5, ajuste 2: o menu ⋯ ("Apagar") do último item de uma lista de 30 nunca fica atrás da barra de abas.
async function menuForaDaBarra(page: import('@playwright/test').Page, nomeUltimo: string) {
  const ultimo = page.getByRole('button', { name: nomeUltimo });
  // Duas posições da rolagem: o item a 24px da barra (o menu não cabe embaixo) e a página rolada até o fim.
  for (const posicao of ['perto-da-barra', 'fim-da-pagina'] as const) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    if (posicao === 'perto-da-barra') {
      await ultimo.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().bottom - (document.querySelector('nav')!.getBoundingClientRect().top - 24)));
    }
    await ultimo.click();
    const apagar = page.getByRole('menuitem', { name: 'Apagar' });
    await expect(apagar).toBeVisible();
    await page.waitForTimeout(150);
    const caixa = (await apagar.boundingBox())!;
    const barra = await page.evaluate(() => document.querySelector('nav')!.getBoundingClientRect().top);
    expect(caixa.y + caixa.height, `${posicao}: base do "Apagar" vs. topo da barra de abas`).toBeLessThanOrEqual(barra);
    expect(caixa.y, `${posicao}: topo do "Apagar" dentro da janela`).toBeGreaterThanOrEqual(0);
    expect(caixa.height).toBeGreaterThanOrEqual(48);
    // De fato tocável: o que está no centro do botão é o próprio botão (não a barra de abas nem outro item).
    const noCentro = await apagar.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const topo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return topo === el || el.contains(topo);
    });
    expect(noCentro, `${posicao}: o "Apagar" está coberto por outro elemento`).toBe(true);
    await page.keyboard.press('Escape');
    await expect(apagar).toHaveCount(0);
  }
}
const TRINTA = Array.from({ length: 30 }, (_, i) => i);
for (const tamanho of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test.describe(`Menu ⋯ do último item em ${tamanho.width}x${tamanho.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(tamanho);
    });
    test('Tarefas', async ({ page }) => {
      await simularApi(page);
      await simularTarefas(page, { tarefas: TRINTA.map((i) => tarefaFalsa(`Tarefa ${i}`)) });
      await page.goto('/tarefas');
      await menuForaDaBarra(page, 'Mais opções de Tarefa 0');
    });
    test('Metas', async ({ page }) => {
      await simularApi(page);
      await simularTarefas(page, { metas: TRINTA.map((i) => metaFalsa(`Meta ${i}`)) });
      await page.goto('/tarefas?aba=metas');
      await menuForaDaBarra(page, 'Mais opções de Meta 0');
    });
    test('José sabe', async ({ page }) => {
      await simularApi(page);
      await simularMemorias(page, { memorias: TRINTA.map((i) => memoriaFalsa(`m${i}`, `Memória número ${i}`, 'trabalho', i + 1)) });
      await page.goto('/jose-sabe');
      await menuForaDaBarra(page, 'Mais opções de Memória número 29');
    });
  });
}
