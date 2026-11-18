import { expect, test, type Page } from '@playwright/test';
import { diaRelativo, metaFalsa, simularApi, simularMemorias, simularTarefas, tarefaFalsa, type TarefasFalsas } from './apoio';
import { elementosForaDaTela, medir, menoresQue, sobrepoe } from './medidas';

// Hoje, para os testes: terça-feira, 17/11/2026, 10h em São Paulo.
const FIXO = new Date('2026-11-17T10:00:00-03:00');
const dia = (n: number) => diaRelativo(n, FIXO);
const LONGO_120 = `${'A'.repeat(80)} ${'b'.repeat(39)}`; // 120 caracteres, com uma "palavra" de 80

async function abrir(page: Page, inicial: Partial<TarefasFalsas> = {}, caminho = '/tarefas') {
  await page.clock.setFixedTime(FIXO);
  await simularApi(page);
  const f = await simularTarefas(page, inicial);
  await page.goto(caminho);
  return f;
}
const item = (page: Page, titulo: string) => page.locator('.item', { hasText: titulo });
const titulosPendentes = (page: Page) => page.getByRole('list', { name: /pendentes|ativas/ }).locator('.item__titulo').allTextContents();
const aviso = (page: Page) => page.locator('.toast');

test.describe('Aba Tarefas (5.6)', () => {
  test('vazio em Tarefas (com "Ir para o Chat") e em Metas; as duas sub-abas e o link ?aba=metas', async ({ page }) => {
    await abrir(page);
    await expect(page.getByRole('tab', { name: 'Tarefas' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Nada por aqui. Converse com o José e salve o que importar.')).toBeVisible();
    await page.getByRole('tab', { name: 'Metas' }).click();
    await expect(page).toHaveURL(/\/tarefas\?aba=metas$/);
    await expect(page.getByText('Nenhuma meta ainda. Conte ao José o que você quer alcançar.')).toBeVisible();
    await page.getByRole('tab', { name: 'Tarefas' }).click();
    await expect(page).toHaveURL(/\/tarefas$/);
    await page.getByRole('button', { name: 'Ir para o Chat' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/tarefas?aba=metas');
    await expect(page.getByRole('tab', { name: 'Metas' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: '+ Adicionar' })).toBeVisible();
  });

  test('esqueleto enquanto carrega; erro mostra "Tentar de novo" que recarrega', async ({ page }) => {
    const f = await abrir(page, { atrasoMs: 600, listaFalha: true });
    await expect(page.getByRole('status', { name: 'Carregando' })).toBeVisible();
    await expect(page.getByText('Não foi possível carregar.')).toBeVisible();
    f.listaFalha = false;
    f.atrasoMs = 0;
    f.tarefas.push(tarefaFalsa('Ligar para o banco'));
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByText('Ligar para o banco')).toBeVisible();
  });

  test('ordem da regra 5: atrasadas, hoje, próximas (a mais próxima primeiro) e sem prazo; com o prazo em texto', async ({ page }) => {
    await abrir(page, {
      tarefas: [
        tarefaFalsa('Sem prazo'),
        tarefaFalsa('Daqui a pouco', { prazo: dia(3) }),
        tarefaFalsa('Amanhã cedo', { prazo: dia(1) }),
        tarefaFalsa('Para hoje', { prazo: dia(0) }),
        tarefaFalsa('Passou ontem', { prazo: dia(-1) }),
        tarefaFalsa('Passou faz tempo', { prazo: dia(-7) }),
      ],
    });
    await expect(page.locator('.item')).toHaveCount(6);
    // atrasadas: a mais nova primeiro (criada_em decrescente), como no servidor
    expect(await titulosPendentes(page)).toEqual(['Passou faz tempo', 'Passou ontem', 'Para hoje', 'Amanhã cedo', 'Daqui a pouco', 'Sem prazo']);
    await expect(item(page, 'Passou ontem')).toContainText('Atrasada · ontem');
    await expect(item(page, 'Passou faz tempo')).toContainText('Atrasada · ter, 10/11');
    await expect(item(page, 'Para hoje')).toContainText('Hoje');
    await expect(item(page, 'Amanhã cedo')).toContainText('Amanhã');
    await expect(item(page, 'Daqui a pouco')).toContainText('sex, 20/11');
    await expect(item(page, 'Sem prazo').locator('.item__prazo')).toHaveCount(0);
  });

  test('o dia vira com a tela aberta: "Hoje" passa a "Atrasada · ontem" à meia-noite de São Paulo', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-17T23:59:40-03:00') });
    await simularApi(page);
    await simularTarefas(page, { tarefas: [tarefaFalsa('Fechar o relatório', { prazo: '2026-11-17' }), tarefaFalsa('Pagar a luz', { prazo: '2026-11-18' })] });
    await page.goto('/tarefas');
    await expect(item(page, 'Fechar o relatório')).toContainText('Hoje');
    await expect(item(page, 'Pagar a luz')).toContainText('Amanhã');
    await page.clock.fastForward(40_000); // 00h00min20s do dia 18
    await expect(item(page, 'Fechar o relatório')).toContainText('Atrasada · ontem');
    await expect(item(page, 'Pagar a luz')).toContainText('Hoje');
  });

  test('fluxo completo: adicionar, concluir com "Feito! Desfazer", reabrir, editar e apagar com "Desfazer"', async ({ page }) => {
    const f = await abrir(page);
    const chamadasDe = (metodo: string) => f.chamadas.filter((c) => c.rota === 'tarefas' && c.metodo === metodo);

    // adicionar (com validação)
    await page.getByRole('button', { name: '+ Adicionar' }).click();
    const novo = page.getByRole('form', { name: 'Adicionar tarefa' });
    await expect(novo.getByLabel('Título da tarefa')).toBeFocused();
    await novo.getByRole('button', { name: 'Salvar' }).click();
    await expect(novo.getByRole('alert')).toHaveText('Título obrigatório');
    expect(chamadasDe('POST')).toEqual([]);
    await novo.getByLabel('Título da tarefa').fill('  Ligar para o banco  ');
    await novo.getByRole('radio', { name: 'Finanças' }).click();
    await novo.getByLabel('Prazo (opcional)').fill(dia(-1));
    await novo.getByRole('button', { name: 'Salvar' }).click();
    await expect(novo).toHaveCount(0);
    await expect(page.getByRole('button', { name: '+ Adicionar' })).toBeFocused();
    expect(chamadasDe('POST').map((c) => c.corpo)).toEqual([{ titulo: 'Ligar para o banco', area: 'financas', prazo: dia(-1) }]);
    await expect(item(page, 'Ligar para o banco')).toContainText('Atrasada · ontem');
    await expect(item(page, 'Ligar para o banco')).toContainText('Finanças');

    await page.getByRole('button', { name: '+ Adicionar' }).click();
    await page.getByLabel('Título da tarefa').fill('Enviar o relatório');
    await page.keyboard.press('Enter'); // Enter no título salva
    await expect(item(page, 'Enviar o relatório')).toBeVisible();
    expect(chamadasDe('POST').at(-1)!.corpo).toEqual({ titulo: 'Enviar o relatório', area: 'trabalho', prazo: null });
    expect(await titulosPendentes(page)).toEqual(['Ligar para o banco', 'Enviar o relatório']);

    // concluir → "Feito! Desfazer" → Desfazer
    await page.getByRole('button', { name: 'Concluir: Ligar para o banco' }).click();
    await expect(aviso(page)).toContainText('Feito!');
    await expect(aviso(page).getByRole('button', { name: 'Desfazer' })).toBeVisible();
    expect(await titulosPendentes(page)).toEqual(['Enviar o relatório']);
    await expect(page.getByRole('button', { name: /^Concluídas \(1\)/ })).toBeVisible();
    await aviso(page).getByRole('button', { name: 'Desfazer' }).click();
    expect(await titulosPendentes(page)).toEqual(['Ligar para o banco', 'Enviar o relatório']);
    await expect(page.getByRole('button', { name: /^Concluídas/ })).toHaveCount(0);
    expect(chamadasDe('PATCH').map((c) => c.corpo)).toEqual([{ concluida: true }, { concluida: false }]);

    // concluir de novo e ver na seção recolhida "Concluídas"
    await page.getByRole('button', { name: 'Concluir: Ligar para o banco' }).click();
    const concluidas = page.getByRole('button', { name: /^Concluídas \(1\)/ });
    await expect(concluidas).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('list', { name: 'Tarefas concluídas' })).toHaveCount(0); // recolhida
    await concluidas.click();
    await expect(concluidas).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('list', { name: 'Tarefas concluídas' }).getByText('Ligar para o banco')).toBeVisible();
    // reabrir pelo círculo preenchido
    await page.getByRole('button', { name: 'Reabrir: Ligar para o banco' }).click();
    await expect(aviso(page)).toContainText('Tarefa reaberta.');
    expect(await titulosPendentes(page)).toEqual(['Ligar para o banco', 'Enviar o relatório']);

    // editar: tocar no item abre título, área e prazo; mudar o prazo muda a posição
    await page.getByRole('button', { name: 'Editar: Enviar o relatório' }).click();
    const edicao = page.getByRole('form', { name: 'Editar tarefa' });
    await expect(edicao.getByLabel('Título da tarefa')).toHaveValue('Enviar o relatório');
    await edicao.getByLabel('Título da tarefa').fill('Enviar o relatório de vendas');
    await edicao.getByRole('radio', { name: 'Saúde e rotina' }).click();
    await edicao.getByLabel('Prazo (opcional)').fill(dia(0));
    await edicao.getByRole('button', { name: 'Salvar' }).click();
    await expect(edicao).toHaveCount(0);
    expect(chamadasDe('PATCH').at(-1)).toMatchObject({ id: expect.any(String), corpo: { titulo: 'Enviar o relatório de vendas', area: 'saude', prazo: dia(0) } });
    await expect(item(page, 'Enviar o relatório de vendas')).toContainText('Hoje');
    await expect(item(page, 'Enviar o relatório de vendas')).toContainText('Saúde e rotina');
    expect(await titulosPendentes(page)).toEqual(['Ligar para o banco', 'Enviar o relatório de vendas']);
    // "Sem prazo" remove o prazo
    await page.getByRole('button', { name: 'Editar: Enviar o relatório de vendas' }).click();
    await page.getByRole('button', { name: 'Sem prazo' }).click();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(item(page, 'Enviar o relatório de vendas').locator('.item__prazo')).toHaveCount(0);
    expect(chamadasDe('PATCH').at(-1)!.corpo).toMatchObject({ prazo: null });

    // apagar → Desfazer: nada é apagado
    await page.getByRole('button', { name: 'Mais opções de Enviar o relatório de vendas' }).click();
    await page.getByRole('menuitem', { name: 'Apagar' }).click();
    await expect(page.getByText('Enviar o relatório de vendas')).toHaveCount(0);
    await expect(aviso(page)).toContainText('Apagado.');
    await aviso(page).getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByText('Enviar o relatório de vendas')).toBeVisible();
    await page.waitForTimeout(5500);
    expect(chamadasDe('DELETE')).toEqual([]);

    // apagar de vez: depois de 5 s a API é chamada e ao recarregar ela não volta
    await page.getByRole('button', { name: 'Mais opções de Enviar o relatório de vendas' }).click();
    await page.getByRole('menuitem', { name: 'Apagar' }).click();
    await expect.poll(() => chamadasDe('DELETE').length, { timeout: 8000 }).toBe(1);
    await page.reload();
    await expect(page.getByText('Enviar o relatório de vendas')).toHaveCount(0);
    await expect(page.getByText('Ligar para o banco')).toBeVisible();
  });

  test('concluir e desfazer em seguida chega ao servidor na ordem tocada, e a tarefa fica pendente', async ({ page }) => {
    const f = await abrir(page, { tarefas: [tarefaFalsa('Ligar para o banco')] });
    await page.getByRole('button', { name: 'Concluir: Ligar para o banco' }).click();
    await aviso(page).getByRole('button', { name: 'Desfazer' }).click();
    await expect.poll(() => f.chamadas.filter((c) => c.metodo === 'PATCH').map((c) => c.corpo)).toEqual([{ concluida: true }, { concluida: false }]);
    expect(f.tarefas[0]!.concluida).toBe(false);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Concluir: Ligar para o banco' })).toBeVisible();
  });

  test('metas: adicionar, concluir com "Feito! Desfazer", ver em "Concluídas", editar e apagar com "Desfazer"', async ({ page }) => {
    const f = await abrir(page, { metas: [metaFalsa('Correr uma meia-maratona', { prazo: '2027-11-14' })] }, '/tarefas?aba=metas');
    const chamadasDe = (metodo: string) => f.chamadas.filter((c) => c.rota === 'metas' && c.metodo === metodo);
    await expect(item(page, 'Correr uma meia-maratona')).toContainText('dom, 14/11/2027');
    await expect(item(page, 'Correr uma meia-maratona')).toContainText('Saúde e rotina');

    await page.getByRole('button', { name: '+ Adicionar' }).click();
    const novo = page.getByRole('form', { name: 'Adicionar meta' });
    await novo.getByLabel('Título da meta').fill('Fechar a meta do trimestre');
    await novo.getByRole('button', { name: 'Salvar' }).click();
    await expect(item(page, 'Fechar a meta do trimestre')).toBeVisible();
    expect(chamadasDe('POST').map((c) => c.corpo)).toEqual([{ titulo: 'Fechar a meta do trimestre', area: 'trabalho', prazo: null }]);
    expect(await titulosPendentes(page)).toEqual(['Fechar a meta do trimestre', 'Correr uma meia-maratona']); // a mais nova primeiro

    await page.getByRole('button', { name: 'Concluir: Correr uma meia-maratona' }).click();
    await expect(aviso(page)).toContainText('Feito!');
    await aviso(page).getByRole('button', { name: 'Desfazer' }).click();
    expect(await titulosPendentes(page)).toEqual(['Fechar a meta do trimestre', 'Correr uma meia-maratona']);
    await page.getByRole('button', { name: 'Concluir: Correr uma meia-maratona' }).click();
    await page.getByRole('button', { name: /^Concluídas \(1\)/ }).click();
    await expect(page.getByRole('list', { name: 'Metas concluídas' }).getByText('Correr uma meia-maratona')).toBeVisible();
    expect(chamadasDe('PATCH').map((c) => c.corpo)).toEqual([{ status: 'concluida' }, { status: 'ativa' }, { status: 'concluida' }]);

    await page.getByRole('button', { name: 'Editar: Fechar a meta do trimestre' }).click();
    await page.getByLabel('Título da meta').fill('Bater a meta do trimestre');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(item(page, 'Bater a meta do trimestre')).toBeVisible();

    await page.getByRole('button', { name: 'Mais opções de Bater a meta do trimestre' }).click();
    await page.getByRole('menuitem', { name: 'Apagar' }).click();
    await expect(aviso(page)).toContainText('Apagado.');
    await aviso(page).getByRole('button', { name: 'Desfazer' }).click();
    await expect(item(page, 'Bater a meta do trimestre')).toBeVisible();
    await page.waitForTimeout(5500);
    expect(chamadasDe('DELETE')).toEqual([]);
  });

  test('Esc fecha "Adicionar" e "Editar" devolvendo o foco a quem abriu; Esc e toque fora fecham o menu ⋯', async ({ page }) => {
    await abrir(page, { tarefas: [tarefaFalsa('Ligar para o banco'), tarefaFalsa('Pagar o aluguel')] });
    const adicionar = page.getByRole('button', { name: '+ Adicionar' });
    await adicionar.click();
    await expect(page.getByLabel('Título da tarefa')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('form', { name: 'Adicionar tarefa' })).toHaveCount(0);
    await expect(adicionar).toBeFocused();

    const abrirEdicao = page.getByRole('button', { name: 'Editar: Pagar o aluguel' });
    await abrirEdicao.click();
    await expect(page.getByRole('form', { name: 'Editar tarefa' }).getByLabel('Título da tarefa')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('form', { name: 'Editar tarefa' })).toHaveCount(0);
    await expect(abrirEdicao).toBeFocused();

    // Esc depois de "Sem prazo" (o botão some, o foco vai para o campo de data)
    await adicionar.click();
    await page.getByLabel('Prazo (opcional)').fill(dia(2));
    await page.getByRole('button', { name: 'Sem prazo' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('form', { name: 'Adicionar tarefa' })).toHaveCount(0);

    const mais = page.getByRole('button', { name: 'Mais opções de Ligar para o banco' });
    await mais.click();
    await expect(page.getByRole('menuitem', { name: 'Apagar' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Apagar' })).toHaveCount(0);
    await expect(mais).toBeFocused();
    await mais.click();
    await page.getByRole('heading', { name: 'Tarefas', level: 1 }).click(); // toque fora
    await expect(page.getByRole('menuitem', { name: 'Apagar' })).toHaveCount(0);
    await mais.click();
    await page.getByRole('button', { name: 'Mais opções de Pagar o aluguel' }).click(); // abrir outro fecha o anterior
    await expect(page.getByRole('menuitem', { name: 'Apagar' })).toHaveCount(1);
  });

  test('erro ao salvar mostra "Não salvou. Tentar de novo"; falha ao concluir desfaz na tela e avisa', async ({ page }) => {
    const f = await abrir(page, { tarefas: [tarefaFalsa('Ligar para o banco')], escritaFalhas: 1 });
    await page.getByRole('button', { name: '+ Adicionar' }).click();
    const form = page.getByRole('form', { name: 'Adicionar tarefa' });
    await form.getByLabel('Título da tarefa').fill('Gosta de café');
    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(form.getByRole('alert')).toHaveText('Não salvou. Tentar de novo');
    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(item(page, 'Gosta de café')).toBeVisible();

    f.escritaFalhas = 1;
    await page.getByRole('button', { name: 'Concluir: Ligar para o banco' }).click();
    await expect(aviso(page)).toContainText('Não salvou.');
    await expect(page.getByRole('button', { name: 'Concluir: Ligar para o banco' })).toBeVisible(); // voltou para pendente
    await aviso(page).getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByRole('button', { name: 'Concluir: Ligar para o banco' })).toHaveCount(0);
  });
});

for (const largura of [320, 390]) {
  test.describe(`Layout da aba Tarefas em ${largura}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 700 });
    });

    test('título de 120 caracteres e palavra de 80: nada passa da largura, alvos >= 48px, barra de abas visível (lista e formulário)', async ({ page }) => {
      await abrir(page, {
        tarefas: [
          tarefaFalsa(LONGO_120, { prazo: dia(-30) }),
          tarefaFalsa(LONGO_120.toUpperCase(), { prazo: '2027-11-14', area: 'financas' }),
          tarefaFalsa('Curta', { area: 'casa' }),
          tarefaFalsa(`${'Z'.repeat(80)} feita`, { concluida: true, concluida_em: '2026-11-16T12:00:00Z' }),
        ],
      });
      await page.getByRole('button', { name: /^Concluídas/ }).click();
      let m = await elementosForaDaTela(page);
      expect(m.rolagem, 'rolagem lateral').toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
      const alvos = '.subabas__item, .itens__adicionar, .itens__alternar, .item__circulo, .item__abrir, .item__mais';
      expect(menoresQue(await medir(page, alvos))).toEqual([]);
      await expect(page.getByRole('navigation')).toBeVisible();

      // formulário de editar: título, 4 chips, campo de data e botões, tudo dentro da largura
      await page.getByRole('button', { name: `Editar: ${LONGO_120}`, exact: true }).click();
      await expect(page.getByLabel('Título da tarefa')).toHaveValue(LONGO_120);
      m = await elementosForaDaTela(page);
      expect(m.rolagem, 'rolagem lateral na edição').toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
      expect(menoresQue(await medir(page, '.form-item .botao, .form-item .chip-area, .form-item input'))).toEqual([]);
      await expect(page.getByRole('navigation')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.dataset.teclado ?? null)).not.toBe('aberto');

      // Metas: mesma conferência
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: 'Metas' }).click();
      await page.getByRole('button', { name: '+ Adicionar' }).click();
      await page.getByLabel('Título da meta').fill(LONGO_120);
      m = await elementosForaDaTela(page);
      expect(m.rolagem, 'rolagem lateral em Metas').toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
    });

    test('o aviso "Feito! Desfazer" não cobre o formulário aberto em seguida, nem a barra de abas some', async ({ page }) => {
      await abrir(page, { tarefas: [tarefaFalsa('Ligar para o banco'), tarefaFalsa('Pagar o aluguel'), tarefaFalsa('Enviar o relatório'), tarefaFalsa(LONGO_120)] });
      await page.getByRole('button', { name: 'Concluir: Ligar para o banco' }).click();
      await expect(aviso(page)).toContainText('Feito!');
      await page.waitForTimeout(300); // fim da animação de entrada
      await page.getByRole('button', { name: `Editar: ${LONGO_120}`, exact: true }).click();
      const form = page.getByRole('form', { name: 'Editar tarefa' });
      await expect(form).toBeVisible();
      await page.waitForTimeout(500); // fim da rolagem até o formulário
      const [toast] = await medir(page, '.toast');
      const [caixa] = await medir(page, '.form-item');
      expect(sobrepoe(toast!, caixa!), 'o aviso cobre o formulário').toBe(false);
      await expect(page.getByRole('navigation')).toBeVisible();
    });
  });
}

test('em 390px cabem no máximo 7 itens sem rolar (com 12 tarefas), e pelo menos 3', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 }); // área visível do iPhone 13 no Safari
  await abrir(page, { tarefas: Array.from({ length: 12 }, (_, i) => tarefaFalsa(`Tarefa de teste número ${i + 1}`, { prazo: dia(i % 4) })) });
  await expect(page.locator('.item')).toHaveCount(12);
  const visiveis = await page.evaluate(() => {
    const topoBarra = document.querySelector('nav')!.getBoundingClientRect().top;
    return [...document.querySelectorAll('.item')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top < topoBarra && r.bottom > 0;
    }).length;
  });
  expect(visiveis).toBeLessThanOrEqual(7);
  expect(visiveis).toBeGreaterThanOrEqual(3);
});

// Onda 5, ajuste 3: o aviso "Feito! Desfazer" nunca cobre o formulário de edição (nem a base, onde ficam Salvar e Cancelar).
// 320x568 (iPhone SE): a janela mais curta, onde o formulário de edição quase não cabe acima do aviso.
for (const tamanho of [{ width: 320, height: 568 }, { width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  for (const tipo of ['tarefa', 'meta'] as const) {
    test(`${tamanho.width}x${tamanho.height}: "Feito! Desfazer" não cobre Salvar/Cancelar do formulário de ${tipo} (aviso antes e depois de abrir)`, async ({ page }) => {
      await page.setViewportSize(tamanho);
      // Títulos de duas linhas deixam o formulário alto (o caso mais apertado em 320x640).
      const titulos = Array.from({ length: 30 }, (_, i) => `Item ${i} da lista, com um título um pouco mais comprido para quebrar a linha`);
      await abrir(page, tipo === 'tarefa' ? { tarefas: titulos.map((t) => tarefaFalsa(t)) } : { metas: titulos.map((t) => metaFalsa(t)) }, tipo === 'tarefa' ? '/tarefas' : '/tarefas?aba=metas');
      const conferir = async () => {
        await page.waitForTimeout(600); // fim da animação e da rolagem
        const [toast] = await medir(page, '.toast');
        for (const nome of ['Salvar', 'Cancelar']) {
          const alvo = page.locator('.form-item').getByRole('button', { name: nome });
          await expect(alvo).toBeVisible();
          const caixa = await alvo.boundingBox();
          expect(sobrepoe(toast!, { rotulo: nome, ...caixa! }), `o aviso cobre ${nome}`).toBe(false);
        }
      };
      // 1) aviso primeiro, formulário depois
      await page.getByRole('button', { name: 'Concluir: Item 3 da lista, com um título um pouco mais comprido para quebrar a linha' }).click();
      await expect(aviso(page)).toContainText('Feito!');
      await page.getByRole('button', { name: `Editar: Item 12 da lista, com um título um pouco mais comprido para quebrar a linha`, exact: true }).click();
      await expect(page.locator('.form-item')).toBeVisible();
      await conferir();
      // 2) formulário aberto, aviso depois
      await page.keyboard.press('Escape');
      await expect(page.locator('.form-item')).toHaveCount(0);
      await page.getByRole('button', { name: `Editar: Item 11 da lista, com um título um pouco mais comprido para quebrar a linha`, exact: true }).click();
      await expect(page.locator('.form-item')).toBeVisible();
      await page.getByRole('button', { name: `Concluir: Item 10 da lista, com um título um pouco mais comprido para quebrar a linha`, exact: true }).click();
      await expect(aviso(page)).toContainText('Feito!');
      await conferir();
    });
  }
}

// Onda 5, ajuste 4: o texto de ajuda (placeholder) dos campos tem contraste >= 4,5:1 sobre o fundo do próprio campo.
const rgb = (css: string) => (css.match(/[\d.]+/g) ?? []).map(Number) as [number, number, number, number?];
const lum = ([r, g, b]: number[]) => {
  const c = [r, g, b].map((v) => { const s = (v ?? 0) / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
async function contrasteDoPlaceholder(page: Page, seletor: string): Promise<number> {
  const { cor, fundo, opacidade } = await page.locator(seletor).first().evaluate((el) => {
    const ph = getComputedStyle(el, '::placeholder');
    return { cor: ph.color, fundo: getComputedStyle(el).backgroundColor, opacidade: ph.opacity };
  });
  const [fr, fg, fb, fa = 1] = rgb(cor);
  const [br, bg, bb] = rgb(fundo);
  const a = fa * Number(opacidade); // cor do texto já misturada com o fundo do campo
  const mix = [fr! * a + br! * (1 - a), fg! * a + bg! * (1 - a), fb! * a + bb! * (1 - a)];
  const [x, y] = [lum(mix), lum([br!, bg!, bb!])].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
test.describe('Contraste do placeholder', () => {
  test('formulários de tarefa e de meta: >= 4,5:1', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: '+ Adicionar' }).click();
    expect(await contrasteDoPlaceholder(page, 'textarea[placeholder^="Ex.: Ligar"]')).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('tab', { name: 'Metas' }).click();
    await page.getByRole('button', { name: '+ Adicionar' }).click();
    expect(await contrasteDoPlaceholder(page, 'textarea[placeholder^="Ex.: Correr"]')).toBeGreaterThanOrEqual(4.5);
  });
  test('campo "Fale com o José…" do Chat e formulário de memória: >= 4,5:1', async ({ page }) => {
    await simularApi(page);
    await page.goto('/');
    expect(await contrasteDoPlaceholder(page, '#campo-mensagem')).toBeGreaterThanOrEqual(4.5);
    await simularMemorias(page);
    await page.goto('/jose-sabe');
    await page.getByRole('button', { name: '+ Adicionar' }).click();
    expect(await contrasteDoPlaceholder(page, 'textarea[placeholder^="Ex.: Acorda"]')).toBeGreaterThanOrEqual(4.5);
  });
});
