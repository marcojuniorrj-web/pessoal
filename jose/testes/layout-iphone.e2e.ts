import { expect, test } from '@playwright/test';
import { memoriaFalsa, simularApi, simularMemorias, simularTarefas } from './apoio';
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
