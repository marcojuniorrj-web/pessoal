import { expect, test, type Page } from '@playwright/test';
import { memoriaFalsa, simularApi, simularMemorias, type MemoriasFalsas } from './apoio';
import { elementosForaDaTela, medir, menoresQue, sobrepoe } from './medidas';

const LONGA = `${'A'.repeat(80)} ${'b'.repeat(218)}`; // 299 caracteres, com uma "palavra" de 80

async function abrir(page: Page, inicial: Partial<MemoriasFalsas> = {}) {
  await simularApi(page);
  const f = await simularMemorias(page, inicial);
  await page.goto('/jose-sabe');
  return f;
}
const grupo = (page: Page, rotulo: string) => page.getByRole('region', { name: rotulo });

test.describe('Aba José sabe (4.6)', () => {
  test('vazio: texto, botão "Fazer as boas-vindas" desabilitado (Fase 6) e ⚙ leva a Ajustes', async ({ page }) => {
    await abrir(page);
    await expect(page.getByText('O José ainda não sabe nada sobre você.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fazer as boas-vindas' })).toBeDisabled();
    await page.getByRole('link', { name: 'Ajustes' }).click();
    await expect(page).toHaveURL(/\/ajustes$/);
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  });

  test('esqueleto enquanto carrega; erro mostra "Tentar de novo" que recarrega', async ({ page }) => {
    const f = await abrir(page, { atrasoMs: 600, listaFalha: true });
    await expect(page.getByRole('status', { name: 'Carregando' })).toBeVisible();
    await expect(page.getByText('Não foi possível carregar.')).toBeVisible();
    f.listaFalha = false;
    f.atrasoMs = 0;
    f.memorias.push(memoriaFalsa('m1', 'Acorda às 6h.', 'saude'));
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByText('Acorda às 6h.')).toBeVisible();
  });

  test('lista por área, na ordem da tela, com a data em que o José aprendeu', async ({ page }) => {
    await abrir(page, {
      memorias: [
        memoriaFalsa('a', 'Tem um filho pequeno.', 'casa', 3),
        memoriaFalsa('b', 'É gerente comercial.', 'sobre_mim', 5),
        memoriaFalsa('c', 'Acorda às 6h.', 'saude', 2),
        memoriaFalsa('d', 'Prefere reunião de manhã.', 'trabalho', 1),
      ],
    });
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Sobre mim', 'Trabalho', 'Saúde e rotina', 'Família e casa']);
    await expect(grupo(page, 'Saúde e rotina').getByText('Acorda às 6h.')).toBeVisible();
    await expect(grupo(page, 'Saúde e rotina').getByText(/^Aprendida em \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Finanças' })).toHaveCount(0);
  });

  test('criar, editar (trocando de área) e apagar → Desfazer; apagar de vez chama a API depois de 5 s', async ({ page }) => {
    const f = await abrir(page, { memorias: [memoriaFalsa('m1', 'Acorda às 6h.', 'saude')] });

    // criar
    await page.getByRole('button', { name: '+ Adicionar memória' }).click();
    const novo = page.getByRole('form', { name: 'Adicionar memória' });
    await novo.getByLabel('Texto da memória').fill('  Trabalha de casa às sextas.  ');
    await novo.getByRole('radio', { name: 'Trabalho' }).click();
    await novo.getByRole('button', { name: 'Salvar' }).click();
    expect(f.posts).toEqual([{ texto: 'Trabalha de casa às sextas.', area: 'trabalho' }]);
    await expect(grupo(page, 'Trabalho').getByText('Trabalha de casa às sextas.')).toBeVisible();
    await expect(page.locator('.toast')).toContainText('Memória atualizada.');
    await expect(novo).toHaveCount(0);

    // editar: tocar na memória abre texto e área; mudar a área move o grupo
    await grupo(page, 'Saúde e rotina').getByRole('button', { name: /^Editar: Acorda/ }).click();
    const edicao = page.getByRole('form', { name: 'Editar memória' });
    await expect(edicao.getByLabel('Texto da memória')).toHaveValue('Acorda às 6h.');
    await edicao.getByLabel('Texto da memória').fill('Acorda às 5h30.');
    await edicao.getByRole('radio', { name: 'Sobre mim' }).click();
    await edicao.getByRole('button', { name: 'Salvar' }).click();
    expect(f.patches).toEqual([{ id: 'm1', campos: { texto: 'Acorda às 5h30.', area: 'sobre_mim' } }]);
    await expect(grupo(page, 'Sobre mim').getByText('Acorda às 5h30.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Saúde e rotina' })).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('Memória atualizada');

    // apagar → Desfazer: nada é apagado
    await page.getByRole('button', { name: 'Mais opções de Acorda às 5h30.' }).click();
    await page.getByRole('menuitem', { name: 'Apagar' }).click();
    await expect(page.getByText('Acorda às 5h30.')).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('Apagado.');
    await page.locator('.toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByText('Acorda às 5h30.')).toBeVisible();
    await page.waitForTimeout(5500);
    expect(f.deletes).toEqual([]);

    // apagar de vez
    await page.getByRole('button', { name: 'Mais opções de Acorda às 5h30.' }).click();
    await page.getByRole('menuitem', { name: 'Apagar' }).click();
    await expect.poll(() => f.deletes, { timeout: 8000 }).toEqual(['m1']);
    await page.reload();
    await expect(page.getByText('Acorda às 5h30.')).toHaveCount(0);
    await expect(page.getByText('Trabalha de casa às sextas.')).toBeVisible();
  });

  test('texto vazio ou de mais de 300 caracteres não vai ao servidor; erro ao salvar mostra "Não salvou. Tentar de novo"', async ({ page }) => {
    const f = await abrir(page, { memorias: [memoriaFalsa('m1', 'Acorda às 6h.', 'saude')], escritaFalhas: 1 });
    await page.getByRole('button', { name: '+ Adicionar memória' }).click();
    const form = page.getByRole('form', { name: 'Adicionar memória' });
    await form.getByLabel('Texto da memória').fill('   ');
    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(form.getByRole('alert')).toHaveText('Texto obrigatório');
    expect(f.posts).toEqual([]);
    await expect(form.getByLabel('Texto da memória')).toHaveAttribute('maxlength', '300');
    await form.getByLabel('Texto da memória').fill('Gosta de café.');
    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(form.getByRole('alert')).toHaveText('Não salvou. Tentar de novo');
    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Gosta de café.')).toBeVisible();
    expect(f.posts).toHaveLength(2);
  });

  test('Esc fecha "Adicionar memória" e "Editar memória" devolvendo o foco a quem abriu; Esc e toque fora fecham o menu ⋯', async ({ page }) => {
    await abrir(page, { memorias: [memoriaFalsa('m1', 'Acorda às 6h.', 'saude'), memoriaFalsa('m2', 'Tem um filho.', 'casa')] });

    const adicionar = page.getByRole('button', { name: '+ Adicionar memória' });
    await adicionar.click();
    await expect(page.getByRole('form', { name: 'Adicionar memória' }).getByLabel('Texto da memória')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('form', { name: 'Adicionar memória' })).toHaveCount(0);
    await expect(adicionar).toBeFocused();

    const abrirEdicao = grupo(page, 'Saúde e rotina').getByRole('button', { name: /^Editar: Acorda/ });
    await abrirEdicao.click();
    await expect(page.getByRole('form', { name: 'Editar memória' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('form', { name: 'Editar memória' })).toHaveCount(0);
    await expect(abrirEdicao).toBeFocused();

    const mais = page.getByRole('button', { name: 'Mais opções de Acorda às 6h.' });
    await mais.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(mais).toBeFocused();

    await mais.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.getByRole('heading', { name: 'José sabe' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('a aba José sabe fica marcada na barra e a barra continua visível', async ({ page }) => {
    await abrir(page);
    await expect(page.getByRole('navigation').getByRole('link', { name: /José sabe/ })).toHaveAttribute('aria-current', 'page');
  });
});

for (const largura of [320, 390]) {
  test.describe(`Layout de José sabe em ${largura}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 700 });
    });

    const memorias = () => [
      memoriaFalsa('a', LONGA, 'trabalho', 1),
      memoriaFalsa('b', LONGA.toUpperCase(), 'casa', 2),
      memoriaFalsa('c', 'Curta.', 'sobre_mim', 3),
      memoriaFalsa('d', LONGA, 'saude', 4),
      memoriaFalsa('e', 'Gosta de café sem açúcar.', 'financas', 5),
    ];

    test('lista com textos de 300 caracteres e palavra de 80, menu ⋯, edição e adição: nada passa da largura e os alvos têm 48px', async ({ page }) => {
      await abrir(page, { memorias: memorias() });
      await expect(page.getByText('Curta.')).toBeVisible();
      let m = await elementosForaDaTela(page);
      expect(m.rolagem, 'rolagem lateral').toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
      expect(menoresQue(await medir(page, '.memoria__abrir, .memoria__mais, .memorias__adicionar, .tela__topo .botao'))).toEqual([]);

      // menu ⋯ aberto no primeiro item
      await page.getByRole('button', { name: /^Mais opções de A{80}/ }).first().click();
      await expect(page.getByRole('menuitem', { name: 'Apagar' })).toBeVisible();
      m = await elementosForaDaTela(page);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(menoresQue(await medir(page, '.memoria__menu-item'))).toEqual([]);
      await page.getByRole('button', { name: /^Mais opções de A{80}/ }).first().click();

      // edição do texto longo
      await page.getByRole('button', { name: /^Editar: A{80}/ }).first().click();
      const edicao = page.getByRole('form', { name: 'Editar memória' });
      await expect(edicao.getByLabel('Texto da memória')).toHaveValue(LONGA);
      m = await elementosForaDaTela(page);
      expect(m.rolagem).toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
      expect(menoresQue(await medir(page, '.form-memoria .botao, .form-memoria .chip-area'))).toEqual([]);
      await edicao.getByRole('button', { name: 'Cancelar' }).click();

      // adição
      await page.getByRole('button', { name: '+ Adicionar memória' }).click();
      await page.getByRole('form', { name: 'Adicionar memória' }).getByLabel('Texto da memória').fill(LONGA);
      m = await elementosForaDaTela(page);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.dataset.teclado ?? null)).not.toBe('aberto');
      await expect(page.getByRole('navigation')).toBeVisible();
    });

    test('o aviso "Apagado. Desfazer" não cobre o formulário de editar a última memória nem a barra de abas some', async ({ page }) => {
      await abrir(page, { memorias: memorias() });
      await page.getByRole('button', { name: 'Mais opções de Curta.' }).click();
      await page.getByRole('menuitem', { name: 'Apagar' }).click();
      await expect(page.locator('.toast')).toContainText('Apagado.');
      // abre a edição da última memória da lista enquanto o aviso está no ar
      const ultima = page.getByRole('button', { name: /^Editar: Gosta de café/ });
      await ultima.click();
      const form = page.getByRole('form', { name: 'Editar memória' });
      await expect(form).toBeVisible();
      await page.waitForTimeout(500); // fim da rolagem e da animação do aviso
      await expect(page.locator('.toast')).toBeVisible();
      const [toast] = await medir(page, '.toast');
      const caixas = await medir(page, '.form-memoria .botao, .form-memoria__campo, .form-memoria .chip-area');
      for (const c of caixas) expect(sobrepoe(toast!, c), `o aviso cobre ${c.rotulo}`).toBe(false);
      await expect(page.getByRole('navigation')).toBeVisible();
    });
  });
}
