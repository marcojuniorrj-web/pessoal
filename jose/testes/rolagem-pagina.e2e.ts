import { expect, test, type Page } from '@playwright/test';
import { memoriaFalsa, metaFalsa, novaConversa, simularApi, simularChat, simularMemorias, simularTarefas, tarefaFalsa } from './apoio';

// No iPhone o documento rolava no Chat (spans "só para leitores" absolutos esticavam a página): só a lista de mensagens pode rolar.
const TAMANHOS = [[320, 568], [320, 640], [390, 844], [1280, 800]] as const;

function conversaLonga() {
  const msgs: Array<[string, string, number?]> = [];
  for (let i = 0; i < 30; i++) msgs.push(['marco', `Pergunta ${i} sobre o relatório de vendas do trimestre`, 90 - i * 2], ['jose', `Resposta ${i}: um texto um pouco mais longo para ocupar espaço na lista.`, 89 - i * 2]);
  return novaConversa('a', 'Conversa longa', 30, 'padrao', msgs);
}

const rolagem = (page: Page) => page.evaluate(() => ({ alturaDoc: document.documentElement.scrollHeight, janela: window.innerHeight, y: window.scrollY, corpo: document.body.scrollHeight }));

for (const [largura, altura] of TAMANHOS) {
  test.describe(`${largura}x${altura}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
    });

    test('Chat com conversa longa: o documento não rola; só a lista de mensagens', async ({ page }) => {
      await simularApi(page);
      await simularTarefas(page);
      await simularChat(page, { conversas: [conversaLonga()], hoje: 'a' });
      await page.goto('/');
      await expect(page.locator('.balao--jose').last()).toBeVisible();
      const r = await rolagem(page);
      expect(r.alturaDoc, 'scrollHeight do documento').toBeLessThanOrEqual(r.janela);
      expect(r.corpo).toBeLessThanOrEqual(r.janela);
      // a lista é que rola
      const lista = await page.locator('.chat__mensagens').evaluate((el) => ({ rola: el.scrollHeight > el.clientHeight, y: el.scrollTop }));
      expect(lista.rola).toBe(true);
      // arrastar/rolar sobre o cabeçalho e sobre o campo não move a página
      for (const alvo of ['.chat__topo', '.chat__rodape']) {
        const c = (await page.locator(alvo).boundingBox())!;
        await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(100);
        expect((await rolagem(page)).y, `página rolou ao rolar sobre ${alvo}`).toBe(0);
      }
      // abrir a folha (que tem textos só para leitores) também não estica a página
      await page.locator('.balao--jose').last().click({ button: 'right' });
      await expect(page.getByRole('dialog', { name: 'Ações da mensagem' })).toBeVisible();
      expect((await rolagem(page)).alturaDoc).toBeLessThanOrEqual(altura);
    });

    test('Tarefas e José sabe: rola só o conteúdo, sem faixa vazia no fim e sem rolagem à toa quando a lista é curta', async ({ page }) => {
      await simularApi(page);
      const longas = Array.from({ length: 25 }, (_, i) => tarefaFalsa(`Tarefa número ${i}`));
      const muitasMemorias = Array.from({ length: 25 }, (_, i) => memoriaFalsa(`m${i}`, `Memória número ${i} sobre o Marco`, 'trabalho'));
      const t = await simularTarefas(page, { tarefas: [tarefaFalsa('Só uma')], metas: [metaFalsa('Uma meta')] });
      const m = await simularMemorias(page, { memorias: [memoriaFalsa('um', 'Uma só', 'casa')] });
      await simularChat(page);
      await page.goto('/tarefas');
      await expect(page.getByText('Só uma')).toBeVisible();
      let r = await rolagem(page);
      expect(r.alturaDoc, 'Tarefas curta não rola').toBeLessThanOrEqual(r.janela);
      await page.goto('/jose-sabe');
      await expect(page.getByText('Uma só')).toBeVisible();
      r = await rolagem(page);
      expect(r.alturaDoc, 'José sabe curta não rola').toBeLessThanOrEqual(r.janela);

      // listas longas: rola a página; no fim, o último item fica acima da barra de abas e sem faixa vazia enorme
      t.tarefas = longas;
      m.memorias = muitasMemorias;
      for (const [rota, seletor] of [['/tarefas', '.item'], ['/jose-sabe', '.memoria']] as const) {
        await page.goto(rota);
        await expect(page.locator(seletor).first()).toBeVisible();
        const item = page.locator(seletor).last();
        await item.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const [caixa, nav] = await Promise.all([item.boundingBox(), page.getByRole('navigation').boundingBox()]);
        expect(caixa!.y + caixa!.height, `último item acima da barra em ${rota}`).toBeLessThanOrEqual(nav!.y + 0.5);
        expect(nav!.y - (caixa!.y + caixa!.height), `faixa vazia entre o último item e a barra em ${rota}`).toBeLessThan(200);
      }
    });
  });
}

test.describe('Tampa sob a barra de status (iPhone, --safe-top: 47px)', () => {
  const SIMULAR = ':root { --safe-top: 47px; --safe-bottom: 34px; }';

  test('conteúdo rolado não aparece nos 47px do topo (Tarefas e José sabe) e a faixa Offline não fica escondida', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await simularApi(page);
    await simularTarefas(page, { tarefas: Array.from({ length: 30 }, (_, i) => tarefaFalsa(`Tarefa número ${i}`)) });
    await simularMemorias(page, { memorias: Array.from({ length: 30 }, (_, i) => memoriaFalsa(`m${i}`, `Memória número ${i}`, 'trabalho')) });
    await simularChat(page);
    for (const rota of ['/tarefas', '/jose-sabe']) {
      await page.goto(rota);
      await page.addStyleTag({ content: SIMULAR });
      await expect(page.locator('.item, .memoria').first()).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 500));
      const cobertos = await page.evaluate(() => {
        const alvos: string[] = [];
        for (const x of [10, 100, 195, 290, 380]) for (const y of [2, 20, 46]) {
          const el = document.elementFromPoint(x, y);
          if (!el?.closest('.tampa-status')) alvos.push(`${x},${y}:${el?.className}`);
        }
        return alvos;
      });
      expect(cobertos, `conteúdo rolado visível sob a barra de status em ${rota}`).toEqual([]);
      // logo abaixo da tampa o conteúdo aparece normalmente
      expect(await page.evaluate(() => !!document.elementFromPoint(195, 60)?.closest('.tampa-status'))).toBe(false);
    }
    // faixa Offline: fica logo abaixo da tampa (nem escondida nem com espaço duplicado)
    await page.context().setOffline(true);
    const faixa = page.locator('.faixa-offline');
    await expect(faixa).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 500));
    const c = (await faixa.boundingBox())!;
    expect(c.y, 'faixa abaixo da tampa').toBeGreaterThanOrEqual(47 - 0.5);
    expect(c.y, 'sem espaço duplicado acima da faixa').toBeLessThanOrEqual(47 + 0.5);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.faixa-offline') !== null, { x: c.x + c.width / 2, y: c.y + c.height / 2 })).toBe(true);
    await page.context().setOffline(false);
  });
});
