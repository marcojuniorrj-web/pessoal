import { expect, test, type Page } from '@playwright/test';
import { novaConversa, simularApi, simularChat, type ChatFalso } from './apoio';
import { elementosForaDaTela, medir, menoresQue, sobrepoe } from './medidas';

const LONGA = `${'A'.repeat(80)} ${'b'.repeat(218)}`; // 299 caracteres, com uma "palavra" de 80
const cartoes = (page: Page) => page.getByRole('article', { name: 'Memória sugerida' });

async function abrir(page: Page, inicial: Partial<ChatFalso> = {}) {
  await simularApi(page);
  const f = await simularChat(page, inicial);
  await page.goto('/');
  return f;
}
async function enviar(page: Page, texto = 'eu acordo às 6h') {
  await page.getByLabel('Mensagem para o José').fill(texto);
  await page.getByRole('button', { name: 'Enviar' }).click();
}

test.describe('Cartão de sugestão no Chat (4.5)', () => {
  test('aparece depois da resposta, nada é salvo sem toque, e Salvar vira "✓ Salvo em José sabe"', async ({ page }) => {
    const f = await abrir(page, { sugerir: [{ texto: 'Acorda às 6h.', area: 'saude' }] });
    await enviar(page);
    await expect(page.getByText('Próximo passo: abrir o arquivo.')).toBeVisible();
    const cartao = cartoes(page);
    await expect(cartao).toContainText('Acorda às 6h.');
    await expect(cartao).toContainText('Saúde e rotina');
    await page.waitForTimeout(800);
    expect(f.salvos).toEqual([]);
    expect(f.descartados).toEqual([]);
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('link', { name: '✓ Salvo em José sabe' })).toBeVisible();
    expect(f.salvos).toEqual([{ id: expect.any(String) }]);
    await expect(cartao).toHaveCount(0); // virou o cartão "salvo" (outro rótulo)
    await page.getByRole('link', { name: '✓ Salvo em José sabe' }).click();
    await expect(page).toHaveURL(/\/jose-sabe$/);
  });

  test('Editar: texto e chips de área; envia o conteúdo editado', async ({ page }) => {
    const f = await abrir(page, { sugerir: [{ texto: 'Acorda às 6h.', area: 'saude' }] });
    await enviar(page);
    const cartao = cartoes(page);
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await cartao.getByLabel('Texto da memória').fill('Acorda às 5h30 nos dias de treino.');
    await cartao.getByRole('radio', { name: 'Sobre mim' }).click();
    await expect(cartao.getByRole('radio', { name: 'Sobre mim' })).toHaveAttribute('aria-checked', 'true');
    expect(f.salvos).toEqual([]);
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('✓ Salvo em José sabe')).toBeVisible();
    expect(f.salvos).toEqual([{ id: expect.any(String), conteudo: { texto: 'Acorda às 5h30 nos dias de treino.', area: 'sobre_mim' } }]);
    await expect(page.getByText('Acorda às 5h30 nos dias de treino.')).toBeVisible();
  });

  test('Esc sai da edição do cartão sem salvar e devolve o foco ao botão Editar', async ({ page }) => {
    const f = await abrir(page, { sugerir: [{ texto: 'Acorda às 6h.', area: 'saude' }] });
    await enviar(page);
    const cartao = cartoes(page);
    await cartao.getByRole('button', { name: 'Editar' }).click();
    await expect(cartao.getByLabel('Texto da memória')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(cartao.getByLabel('Texto da memória')).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Editar' })).toBeFocused();
    expect(f.salvos).toEqual([]);
  });

  test('Descartar recolhe com "Descartado. Desfazer"; Desfazer devolve o cartão sem chamar a API', async ({ page }) => {
    const f = await abrir(page, { sugerir: [{ texto: 'Acorda às 6h.', area: 'saude' }] });
    await enviar(page);
    await cartoes(page).getByRole('button', { name: 'Descartar' }).click();
    await expect(cartoes(page)).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('Descartado.');
    await page.locator('.toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(cartoes(page)).toHaveCount(1);
    await page.waitForTimeout(5500);
    expect(f.descartados).toEqual([]);
  });

  test('Descartar de vez: depois de 5 s a API é chamada e o cartão continua fora ao reabrir a conversa', async ({ page }) => {
    const f = await abrir(page, { sugerir: [{ texto: 'Acorda às 6h.', area: 'saude' }] });
    await enviar(page);
    await cartoes(page).getByRole('button', { name: 'Descartar' }).click();
    await expect.poll(() => f.descartados.length, { timeout: 8000 }).toBe(1);
    await page.reload();
    await expect(page.getByText('Próximo passo: abrir o arquivo.')).toBeVisible();
    await expect(cartoes(page)).toHaveCount(0);
  });

  test('erro ao salvar mostra "Não salvou." e "Tentar de novo" salva', async ({ page }) => {
    const f = await abrir(page, { sugerir: [{ texto: 'Acorda às 6h.', area: 'saude' }], salvarFalhas: 1 });
    await enviar(page);
    await cartoes(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(cartoes(page).getByRole('alert')).toHaveText('Não salvou.');
    await cartoes(page).getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByText('✓ Salvo em José sabe')).toBeVisible();
    expect(f.salvos).toHaveLength(2);
  });

  test('ao reabrir a conversa: pendente volta como cartão, salva como "✓ Salvo", descartada some', async ({ page }) => {
    const c = novaConversa('a', 'Plano do dia', 5, 'padrao', [['marco', 'oi'], ['jose', 'Anotei.']]);
    c.sugestoes = [
      { id: 'p', mensagem_id: 'a-m1', tipo: 'memoria', conteudo: { texto: 'Pendente.', area: 'casa' }, status: 'pendente', item_id: null },
      { id: 's', mensagem_id: 'a-m1', tipo: 'memoria', conteudo: { texto: 'Já salva.', area: 'casa' }, status: 'salva', item_id: 'm1' },
      { id: 'd', mensagem_id: 'a-m1', tipo: 'memoria', conteudo: { texto: 'Descartada.', area: 'casa' }, status: 'descartada', item_id: null },
    ];
    await abrir(page, { conversas: [c], hoje: 'a' });
    await expect(page.getByText('Pendente.')).toBeVisible();
    await expect(page.getByText('Já salva.')).toBeVisible();
    await expect(page.getByRole('link', { name: '✓ Salvo em José sabe' })).toHaveCount(1);
    await expect(page.getByText('Descartada.')).toHaveCount(0);
  });

  test('reenviar uma mensagem já respondida: salva continua "✓ Salvo", descartada não reaparece e pendente volta como cartão', async ({ page }) => {
    const f = await abrir(page, { planos: ['cortada'] });
    await enviar(page, 'três fatos');
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    // O servidor chegou a responder e o Marco tratou duas sugestões em outro aparelho.
    const msg = f.postsMensagem[0]!;
    const resposta = `${msg.id}-resp`;
    const conversa = f.conversas[0]!;
    conversa.mensagens.push({ id: resposta, autor: 'jose', texto: 'Resposta do José. Próximo passo: abrir o arquivo.', origem: 'texto', modelo: 'claude-haiku-5-5', criada_em: new Date().toISOString() });
    conversa.sugestoes = [
      { id: 'sg-p', mensagem_id: resposta, tipo: 'memoria', conteudo: { texto: 'Pendente.', area: 'casa' }, status: 'pendente', item_id: null },
      { id: 'sg-s', mensagem_id: resposta, tipo: 'memoria', conteudo: { texto: 'Já salva.', area: 'casa' }, status: 'salva', item_id: 'm1' },
      { id: 'sg-d', mensagem_id: resposta, tipo: 'memoria', conteudo: { texto: 'Descartada.', area: 'casa' }, status: 'descartada', item_id: null },
    ];
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByText('Pendente.')).toBeVisible();
    await expect(page.getByText('Já salva.')).toBeVisible();
    await expect(page.getByRole('link', { name: '✓ Salvo em José sabe' })).toHaveCount(1);
    await expect(page.getByText('Descartada.')).toHaveCount(0);
    await expect(cartoes(page)).toHaveCount(1);
  });

  test('no máximo 3 cartões por resposta', async ({ page }) => {
    await abrir(page, { sugerir: ['a', 'b', 'c', 'd'].map((t) => ({ texto: `Fato ${t}`, area: 'casa' })) });
    await enviar(page);
    await expect(cartoes(page)).toHaveCount(3);
  });
});

for (const largura of [320, 390]) {
  test.describe(`Layout do cartão em ${largura}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 700 });
    });

    test('3 cartões com texto de 300 caracteres e palavra de 80: nada passa da largura, alvos >= 48px, barra de abas visível', async ({ page }) => {
      await abrir(page, { sugerir: [{ texto: LONGA, area: 'trabalho' }, { texto: LONGA.toUpperCase(), area: 'casa' }, { texto: 'Curta.', area: 'sobre_mim' }] });
      await enviar(page, `${'Z'.repeat(80)} mensagem longa`);
      await expect(cartoes(page)).toHaveCount(3);
      let m = await elementosForaDaTela(page);
      expect(m.rolagem, 'rolagem lateral').toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
      expect(menoresQue(await medir(page, '.cartao-sugestao .botao'))).toEqual([]);
      await expect(page.getByRole('navigation')).toBeVisible();

      // modo de edição: textarea, contador e os 5 chips dentro da largura, todos com 48px
      const primeiro = cartoes(page).first();
      await primeiro.getByRole('button', { name: 'Editar' }).click();
      await expect(primeiro.getByLabel('Texto da memória')).toHaveValue(LONGA);
      m = await elementosForaDaTela(page);
      expect(m.rolagem, 'rolagem lateral na edição').toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
      expect(menoresQue(await medir(page, '.cartao-sugestao .botao, .cartao-sugestao .chip-area'))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.dataset.teclado ?? null)).not.toBe('aberto');
    });

    test('o aviso "Descartado. Desfazer" não cobre o campo de digitação nem o Enviar', async ({ page }) => {
      await abrir(page, { sugerir: [{ texto: LONGA, area: 'trabalho' }] });
      await enviar(page);
      await cartoes(page).getByRole('button', { name: 'Descartar' }).click();
      const aviso = page.locator('.toast');
      await expect(aviso).toContainText('Descartado.');
      await page.waitForTimeout(300); // fim da animação de entrada
      const [toast] = await medir(page, '.toast');
      for (const alvo of ['#campo-mensagem', 'button[aria-label="Enviar"]']) {
        const [caixa] = await medir(page, alvo);
        expect(sobrepoe(toast!, caixa!), `o aviso cobre ${alvo}`).toBe(false);
      }
      const m = await elementosForaDaTela(page);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
    });
  });
}

// ---- 📌 tarefa e 🎯 meta (tarefa 5.5) ----
const LONGO_120 = `${'A'.repeat(80)} ${'b'.repeat(39)}`; // 120 caracteres, com uma "palavra" de 80
const tarefas = (page: Page) => page.getByRole('article', { name: 'Tarefa sugerida' });
const metas = (page: Page) => page.getByRole('article', { name: 'Meta sugerida' });

test.describe('Cartões 📌 tarefa e 🎯 meta no Chat (5.5)', () => {
  test('aparecem depois da resposta; Editar muda título, área e prazo; Salvar vira "✓ Salvo em Tarefas" / "✓ Salvo em Metas"', async ({ page }) => {
    const f = await abrir(page, { sugerir: [
      { tipo: 'tarefa', titulo: 'Revisar a proposta do cliente', area: 'trabalho', prazo: '2026-11-20' },
      { tipo: 'meta', titulo: 'Correr uma meia-maratona', area: 'saude' },
    ] });
    await enviar(page, 'revisar a proposta até sexta e quero correr uma meia');
    const t = tarefas(page);
    await expect(t).toContainText('📌');
    await expect(t).toContainText('Revisar a proposta do cliente');
    await expect(t).toContainText('Trabalho');
    await expect(t.locator('.cartao-sugestao__prazo')).toContainText('Prazo:');
    await expect(metas(page)).toContainText('🎯');
    await expect(metas(page)).toContainText('Correr uma meia-maratona');
    await page.waitForTimeout(600);
    expect(f.salvos).toEqual([]); // nada é salvo sem toque

    await t.getByRole('button', { name: 'Editar' }).click();
    await expect(t.getByLabel('Título da tarefa')).toBeFocused();
    await t.getByLabel('Título da tarefa').fill('Revisar e enviar a proposta');
    await t.getByRole('radio', { name: 'Finanças' }).click();
    await t.getByLabel('Prazo (opcional)').fill('2026-11-24');
    expect(f.salvos).toEqual([]);
    await t.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('link', { name: '✓ Salvo em Tarefas' })).toBeVisible();
    expect(f.salvos[0]).toEqual({ id: expect.any(String), conteudo: { titulo: 'Revisar e enviar a proposta', area: 'financas', prazo: '2026-11-24' } });

    await metas(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('link', { name: '✓ Salvo em Metas' })).toBeVisible();
    expect(f.salvos[1]).toEqual({ id: expect.any(String) });
    await page.getByRole('link', { name: '✓ Salvo em Metas' }).click();
    await expect(page).toHaveURL(/\/tarefas\?aba=metas$/);
  });

  test('"Sem prazo" remove o prazo; Esc sai da edição e devolve o foco ao Editar; Descartar tem "Desfazer"', async ({ page }) => {
    const f = await abrir(page, { sugerir: [{ tipo: 'tarefa', titulo: 'Ligar para o banco', area: 'financas', prazo: '2026-11-20' }] });
    await enviar(page);
    const t = tarefas(page);
    await t.getByRole('button', { name: 'Editar' }).click();
    await t.getByRole('button', { name: 'Sem prazo' }).click();
    await expect(t.getByLabel('Prazo (opcional)')).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(t.getByLabel('Título da tarefa')).toHaveCount(0);
    await expect(t.getByRole('button', { name: 'Editar' })).toBeFocused();
    expect(f.salvos).toEqual([]);
    await t.getByRole('button', { name: 'Descartar' }).click();
    await expect(tarefas(page)).toHaveCount(0);
    await page.locator('.toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(tarefas(page)).toHaveCount(1);
    await page.waitForTimeout(5500);
    expect(f.descartados).toEqual([]);
  });

  test('reenviar a mensagem não traz de volta o cartão salvo nem o descartado', async ({ page }) => {
    const f = await abrir(page, { sugerir: [
      { tipo: 'tarefa', titulo: 'Ligar para o banco', area: 'financas' },
      { tipo: 'meta', titulo: 'Correr uma meia-maratona', area: 'saude' },
      { tipo: 'tarefa', titulo: 'Pagar o condomínio', area: 'casa' },
    ] });
    await enviar(page);
    await tarefas(page).first().getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('link', { name: '✓ Salvo em Tarefas' })).toBeVisible();
    await metas(page).getByRole('button', { name: 'Descartar' }).click();
    await page.waitForTimeout(5500);
    expect(f.descartados).toHaveLength(1);
    await page.reload();
    await expect(page.getByText('Próximo passo: abrir o arquivo.')).toBeVisible();
    await expect(page.getByRole('link', { name: '✓ Salvo em Tarefas' })).toBeVisible();
    await expect(metas(page)).toHaveCount(0);
    await expect(tarefas(page)).toHaveCount(1); // a pendente continua como cartão
  });
});

for (const largura of [320, 390]) {
  test(`Layout dos cartões 📌/🎯 em ${largura}px: título de 120 caracteres e palavra de 80, nada passa da largura, alvos >= 48px, barra de abas visível`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 700 });
    await abrir(page, { sugerir: [
      { tipo: 'tarefa', titulo: LONGO_120, area: 'trabalho', prazo: '2027-11-14' },
      { tipo: 'meta', titulo: LONGO_120.toUpperCase(), area: 'casa', prazo: '2026-12-31' },
      { tipo: 'tarefa', titulo: 'Curta', area: 'saude' },
    ] });
    await enviar(page, `${'Z'.repeat(80)} mensagem longa`);
    await expect(tarefas(page)).toHaveCount(2);
    let m = await elementosForaDaTela(page);
    expect(m.rolagem, 'rolagem lateral').toBeLessThanOrEqual(m.largura);
    expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
    expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
    expect(menoresQue(await medir(page, '.cartao-sugestao .botao'))).toEqual([]);
    await expect(page.getByRole('navigation')).toBeVisible();

    // edição: título, 4 chips, campo de data e botões dentro da largura (o campo de data do iPhone tem largura própria)
    const primeiro = tarefas(page).first();
    await primeiro.getByRole('button', { name: 'Editar' }).click();
    await expect(primeiro.getByLabel('Título da tarefa')).toHaveValue(LONGO_120);
    m = await elementosForaDaTela(page);
    expect(m.rolagem, 'rolagem lateral na edição').toBeLessThanOrEqual(m.largura);
    expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
    expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
    expect(menoresQue(await medir(page, '.cartao-sugestao .botao, .cartao-sugestao .chip-area, .cartao-sugestao input'))).toEqual([]);
    await expect(page.getByRole('navigation')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.teclado ?? null)).not.toBe('aberto');
  });
}
