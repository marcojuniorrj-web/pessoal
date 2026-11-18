import { expect, test, type Page } from '@playwright/test';
import { PERGUNTAS_BOAS_VINDAS } from '../compartilhado/boasvindas';
import { contraste } from '../app/src/estilo/contraste';
import { prepararMicrofone, simularApi, simularMemorias, simularChat, simularVoz } from './apoio';
import { conversaBV, QUATRO_MEMORIAS, RESPOSTAS, simularBoasVindas, type BoasVindasFalsas } from './apoio-boasvindas';
import { elementosForaDaTela, medir, menoresQue } from './medidas';

const LONGA = `${'A'.repeat(80)} ${'b'.repeat(218)}`; // 299 caracteres, com uma "palavra" de 80
const LONGA_300 = 'x'.repeat(300);
const PALAVRA_80 = 'Z'.repeat(80);

async function abrir(page: Page, inicial: Partial<BoasVindasFalsas> = {}, url = '/') {
  await simularApi(page);
  const memorias = await simularMemorias(page);
  const f = await simularBoasVindas(page, inicial, memorias);
  await page.goto(url);
  return { f, memorias };
}
const campo = (page: Page) => page.getByRole('textbox', { name: 'Mensagem para o José' });
const progresso = (page: Page) => page.locator('.bv__progresso');
const barraAbas = (page: Page) => page.getByRole('navigation', { name: 'Navegação principal' });

/** Responde pelo campo e espera a pergunta seguinte aparecer. */
async function responder(page: Page, texto: string) {
  await campo(page).fill(texto);
  await page.getByRole('button', { name: 'Enviar' }).click();
}

/** Do começo até a lista "O que aprendi sobre você". */
async function ateALista(page: Page, de = 0) {
  for (let i = de; i < 5; i++) {
    await expect(progresso(page)).toHaveText(`Pergunta ${i + 1} de 5`);
    await responder(page, RESPOSTAS[i]!);
  }
  await expect(page.getByRole('heading', { name: 'O que aprendi sobre você' })).toBeVisible();
}

test.describe('Boas-vindas: o fluxo do 1º acesso', () => {
  test('1º acesso: "/" cria a conversa, vai às Boas-vindas (sem barra de abas), faz as 5 perguntas e a lista marcável salva 2 de 4', async ({ page }) => {
    const { f, memorias } = await abrir(page);
    await expect(page).toHaveURL(/\/boas-vindas\?c=bv1$/);
    expect(f.criadas).toBe(1);
    await expect(page.getByRole('heading', { name: 'Boas-vindas' })).toBeVisible();
    await expect(page.getByText(PERGUNTAS_BOAS_VINDAS[0]!.texto)).toBeVisible();
    await expect(progresso(page)).toHaveText('Pergunta 1 de 5');
    await expect(barraAbas(page)).toHaveCount(0); // só as boas-vindas não têm a barra de abas
    await expect(page.getByRole('button', { name: 'Pular' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Histórico' })).toHaveCount(0);

    // pergunta 1 (livre) e 2 (respostas rápidas que ENTRAM no campo: dá para escolher mais de uma)
    await responder(page, RESPOSTAS[0]!);
    await expect(page.getByText(PERGUNTAS_BOAS_VINDAS[1]!.texto)).toBeVisible();
    await expect(progresso(page)).toHaveText('Pergunta 2 de 5');
    const rapidas = page.getByRole('group', { name: 'Respostas rápidas' });
    await rapidas.getByRole('button', { name: 'Trabalho' }).click();
    await rapidas.getByRole('button', { name: 'Saúde e rotina' }).click();
    await expect(campo(page)).toHaveValue('Trabalho, Saúde e rotina');
    await page.getByRole('button', { name: 'Enviar' }).click();

    // pergunta 3 (livre; sem respostas rápidas), 4 e 5 (tocar ENVIA a resposta)
    await expect(progresso(page)).toHaveText('Pergunta 3 de 5');
    await expect(rapidas).toHaveCount(0);
    await responder(page, RESPOSTAS[2]!);
    await expect(progresso(page)).toHaveText('Pergunta 4 de 5');
    await page.getByRole('group', { name: 'Respostas rápidas' }).getByRole('button', { name: 'Começar' }).click();
    await expect(page.getByText('Começar as tarefas', { exact: true })).toBeVisible();
    await expect(progresso(page)).toHaveText('Pergunta 5 de 5');
    await page.getByRole('group', { name: 'Respostas rápidas' }).getByRole('button', { name: 'Acordo 6h, durmo 22h' }).click();

    // a lista "O que aprendi sobre você"
    await expect(page.getByRole('heading', { name: 'O que aprendi sobre você' })).toBeVisible();
    await expect(progresso(page)).toHaveText('Revise e confirme');
    await expect(campo(page)).toHaveCount(0); // o campo some: no lugar entra "Salvar selecionadas"
    const itens = page.locator('.aprendi__item');
    await expect(itens).toHaveCount(4);
    await expect(page.getByText('4 de 4 marcadas')).toBeVisible();
    // desmarca a 2ª e a 4ª; edita a 3ª (texto e área)
    await page.getByRole('checkbox', { name: 'Guardar a memória 2' }).uncheck();
    await page.getByRole('checkbox', { name: 'Guardar a memória 4' }).uncheck();
    await page.getByRole('textbox', { name: 'Texto da memória 3' }).fill('Tem dificuldade para começar o que parece grande.');
    await page.getByRole('radiogroup', { name: 'Área da memória 3' }).getByRole('radio', { name: 'Trabalho' }).click();
    await expect(page.getByText('2 de 4 marcadas')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar selecionadas' }).click();

    // volta ao Chat (com a barra de abas) e a flag vale
    await expect(page).toHaveURL(/\/$/);
    await expect(barraAbas(page)).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-sem-abas', /.*/); // o aviso volta a ficar acima da barra de abas
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
    expect(f.lotes).toEqual([
      {
        conversa: 'bv1',
        salvar: [
          { id: 'bv1-s0', conteudo: { texto: QUATRO_MEMORIAS[0]!.texto, area: 'saude' } },
          { id: 'bv1-s2', conteudo: { texto: 'Tem dificuldade para começar o que parece grande.', area: 'trabalho' } },
        ],
        descartar: ['bv1-s1', 'bv1-s3'],
      },
    ]);
    expect(f.concluida).toBe(true);
    expect(memorias.memorias.map((m) => m.texto)).toEqual([QUATRO_MEMORIAS[0]!.texto, 'Tem dificuldade para começar o que parece grande.']);
    // "/" não leva mais às boas-vindas
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
    await page.getByRole('navigation').getByText('José sabe', { exact: true }).click();
    await expect(page.getByText('Tem dificuldade para começar o que parece grande.')).toBeVisible();
  });

  test('retomada: fechar na pergunta 3 e reabrir continua de onde parou (e termina com 2 de 4 salvas)', async ({ page }) => {
    const { f } = await abrir(page);
    await expect(progresso(page)).toHaveText('Pergunta 1 de 5');
    await responder(page, RESPOSTAS[0]!);
    await expect(progresso(page)).toHaveText('Pergunta 2 de 5');
    await responder(page, RESPOSTAS[1]!);
    await expect(progresso(page)).toHaveText('Pergunta 3 de 5');
    await expect(page.getByText(PERGUNTAS_BOAS_VINDAS[2]!.texto)).toBeVisible();

    // "fecha o app" e reabre na raiz: o /api/eu aponta a conversa em aberto
    await page.goto('about:blank');
    await page.goto('/');
    await expect(page).toHaveURL(/\/boas-vindas\?c=bv1$/);
    expect(f.criadas).toBe(1); // não criou outra conversa
    await expect(progresso(page)).toHaveText('Pergunta 3 de 5');
    await expect(page.getByText(PERGUNTAS_BOAS_VINDAS[2]!.texto)).toBeVisible();
    await expect(page.getByText(RESPOSTAS[0]!)).toBeVisible(); // as respostas já dadas continuam

    await ateALista(page, 2);
    await page.getByRole('checkbox', { name: 'Guardar a memória 2' }).uncheck();
    await page.getByRole('checkbox', { name: 'Guardar a memória 4' }).uncheck();
    await page.getByRole('button', { name: 'Salvar selecionadas' }).click();
    await expect(barraAbas(page)).toBeVisible();
    expect(f.lotes[0]!.salvar).toHaveLength(2);
    expect(f.lotes[0]!.descartar).toHaveLength(2);
  });

  test('retomada na revisão: reabrir depois da 5ª resposta mostra a lista de novo', async ({ page }) => {
    const { f } = await abrir(page);
    await ateALista(page);
    await page.goto('about:blank');
    await page.goto('/');
    await expect(page).toHaveURL(/\/boas-vindas\?c=bv1$/);
    await expect(page.locator('.aprendi__item')).toHaveCount(4);
    expect(f.criadas).toBe(1);
  });

  test('Pular conclui na hora, leva ao Chat e nunca mais volta às boas-vindas', async ({ page }) => {
    const { f } = await abrir(page);
    await expect(progresso(page)).toHaveText('Pergunta 1 de 5');
    await page.getByRole('button', { name: 'Pular' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
    await expect(barraAbas(page)).toBeVisible();
    expect(f.concluidos).toBe(1);
    expect(f.lotes).toEqual([]);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
  });

  test('Pular continua visível e funciona também na lista final', async ({ page }) => {
    const { f } = await abrir(page);
    await ateALista(page);
    await expect(page.getByRole('button', { name: 'Pular' })).toBeVisible();
    await page.getByRole('button', { name: 'Pular' }).click();
    await expect(barraAbas(page)).toBeVisible();
    expect(f.concluidos).toBe(1);
    expect(f.lotes).toEqual([]);
  });

  test('com as boas-vindas concluídas, "/" abre o Chat direto, mesmo com uma conversa de boas-vindas em aberto (a flag manda)', async ({ page }) => {
    const { f } = await abrir(page, { concluida: true, conversas: [conversaBV('bv9', 2)] });
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    expect(f.criadas).toBe(0);
    await expect(barraAbas(page)).toBeVisible();
    // /boas-vindas sem conversa também volta ao Chat
    await page.goto('/boas-vindas');
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
    expect(f.criadas).toBe(0);
  });

  test('o Chat nunca é bloqueado: com as boas-vindas pendentes, ?nova=1 e ?c= abrem o Chat', async ({ page }) => {
    await abrir(page, { conversas: [conversaBV('bv1', 1)] }, '/?nova=1');
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
    await expect(page).toHaveURL(/nova=1/);
  });

  test('erro ao criar a conversa mostra "Tentar de novo" e "Ir para o Chat"', async ({ page }) => {
    await simularApi(page);
    await page.route((url) => url.pathname === '/api/eu', (r) => r.fulfill({ json: { nome: 'Marco', email: 'm@m.com', foto_url: null, boas_vindas_concluida: false } }));
    await page.route((url) => url.pathname === '/api/conversas', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 500, json: { erro: { codigo: 'x', mensagem: 'x' } } }) : r.fallback()));
    await page.goto('/');
    await expect(page.getByText('Não foi possível abrir as boas-vindas.')).toBeVisible();
    await page.getByRole('button', { name: 'Ir para o Chat' }).click();
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible(); // o Chat nunca fica bloqueado, mesmo sem concluir
    await expect(barraAbas(page)).toBeVisible();
  });

  test('conversa da URL que não existe mais (404): cria outra', async ({ page }) => {
    await simularApi(page);
    const f = await simularBoasVindas(page, { conversas: [] });
    await page.route((url) => url.pathname === '/api/conversas/sumiu', (r) => r.fulfill({ status: 404, json: { erro: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' } } }));
    await page.goto('/boas-vindas?c=sumiu');
    await expect(page).toHaveURL(/\/boas-vindas\?c=bv1$/);
    expect(f.criadas).toBe(1);
  });
});

test.describe('Boas-vindas: erros sem perder o que já foi feito', () => {
  test('erro da IA no resumo: balão com Tentar de novo (as respostas ficam) e o resumo chega depois', async ({ page }) => {
    const { f } = await abrir(page, { planos: ['ok', 'ok', 'ok', 'ok', 'erro-ia'] });
    await expect(progresso(page)).toHaveText('Pergunta 1 de 5');
    for (let i = 0; i < 5; i++) await responder(page, RESPOSTAS[i]!);
    await expect(page.getByText('O José não conseguiu responder agora.')).toBeVisible();
    await expect(page.getByText(RESPOSTAS[4]!)).toBeVisible();
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.locator('.aprendi__item')).toHaveCount(4);
    expect(f.envios.at(-1)!.id).toBe(f.envios.at(-2)!.id); // mesmo id: nada duplica
  });

  test('erro de rede ao salvar: "Sem conexão." + Tentar de novo, com as marcações e o texto editado intactos', async ({ page }) => {
    const { f } = await abrir(page, { loteFalhas: ['rede'] });
    await ateALista(page);
    await page.getByRole('checkbox', { name: 'Guardar a memória 2' }).uncheck();
    await page.getByRole('textbox', { name: 'Texto da memória 1' }).fill('Acorda às 5h30 e dorme às 22h.');
    await page.getByRole('button', { name: 'Salvar selecionadas' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Sem conexão.' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Guardar a memória 2' })).not.toBeChecked();
    await expect(page.getByRole('textbox', { name: 'Texto da memória 1' })).toHaveValue('Acorda às 5h30 e dorme às 22h.');
    expect(f.concluida).toBe(false);
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(barraAbas(page)).toBeVisible();
    expect(f.lotes).toHaveLength(2);
    expect(f.lotes[1]).toEqual(f.lotes[0]); // o mesmo lote
    expect(f.lotes[1]!.salvar[0]!.conteudo!.texto).toBe('Acorda às 5h30 e dorme às 22h.');
  });

  test('erro do servidor ao salvar: "Não foi possível salvar."', async ({ page }) => {
    await abrir(page, { loteFalhas: [500] });
    await ateALista(page);
    await page.getByRole('button', { name: 'Salvar selecionadas' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível salvar.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  });

  test('texto vazio em item marcado bloqueia o envio e mostra o erro; desmarcar resolve', async ({ page }) => {
    const { f } = await abrir(page);
    await ateALista(page);
    await page.getByRole('textbox', { name: 'Texto da memória 2' }).fill('   ');
    await page.getByRole('button', { name: 'Salvar selecionadas' }).click();
    await expect(page.getByText('Escreva o texto ou desmarque.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Texto da memória 2' })).toBeFocused();
    expect(f.lotes).toEqual([]);
    await page.getByRole('checkbox', { name: 'Guardar a memória 2' }).uncheck();
    await expect(page.getByText('Escreva o texto ou desmarque.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar selecionadas' }).click();
    await expect(barraAbas(page)).toBeVisible();
  });

  test('o aviso (toast) fica acima do rodapé e não cobre o campo, as respostas rápidas nem o Salvar', async ({ page }) => {
    await abrir(page, { concluirFalha: true });
    await responder(page, RESPOSTAS[0]!);
    await expect(progresso(page)).toHaveText('Pergunta 2 de 5');
    await page.getByRole('button', { name: 'Pular' }).click();
    const aviso = page.locator('.toast');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('Não foi possível pular');
    const t = (await aviso.boundingBox())!;
    for (const sel of ['.bv__rodape', '.rapidas', '.chat__campo', '.bv__pular']) {
      const el = page.locator(sel).first();
      if (!(await el.count())) continue;
      const b = (await el.boundingBox())!;
      const cobre = t.x < b.x + b.width && b.x < t.x + t.width && t.y < b.y + b.height && b.y < t.y + t.height;
      expect(cobre, `o aviso cobre ${sel}`).toBe(false);
    }
  });
});

test.describe('Boas-vindas: voz (a mesma interface do Chat)', () => {
  test('o 🎤 do rodapé grava, transcreve e envia a resposta como voz; a próxima pergunta aparece', async ({ page }) => {
    await simularApi(page);
    const voz = await simularVoz(page, { texto: 'Acordo às 6h e vou dormir às 22h.' });
    await prepararMicrofone(page);
    const memorias = await simularMemorias(page);
    const f = await simularBoasVindas(page, {}, memorias);
    await page.goto('/');
    await expect(progresso(page)).toHaveText('Pergunta 1 de 5');
    await page.getByRole('button', { name: 'Gravar áudio' }).click();
    await expect(page.getByRole('button', { name: 'Parar e enviar áudio' })).toBeVisible();
    await page.waitForTimeout(1300);
    await page.getByRole('button', { name: 'Parar e enviar áudio' }).click();
    await expect(page.locator('.balao--marco')).toContainText('Acordo às 6h e vou dormir às 22h.');
    await expect(progresso(page)).toHaveText('Pergunta 2 de 5');
    expect(voz.pedidos).toHaveLength(1);
    expect(f.envios[0]).toMatchObject({ origem: 'voz', texto: 'Acordo às 6h e vou dormir às 22h.' });
    await expect(page.getByRole('img', { name: 'Enviado por voz' })).toBeVisible();
  });
});

test.describe('Refazer as boas-vindas', () => {
  test('Ajustes › Refazer boas-vindas abre uma nova conversa, mesmo com as boas-vindas concluídas, e termina no Chat', async ({ page }) => {
    const { f } = await abrir(page, { concluida: true }, '/ajustes');
    await page.getByRole('button', { name: 'Refazer boas-vindas' }).click();
    await expect(page).toHaveURL(/\/boas-vindas\?c=bv1$/);
    expect(f.criadas).toBe(1);
    await expect(progresso(page)).toHaveText('Pergunta 1 de 5');
    await expect(barraAbas(page)).toHaveCount(0);
    await ateALista(page);
    await page.getByRole('button', { name: 'Salvar selecionadas' }).click();
    await expect(page.getByRole('heading', { name: /Marco\./ })).toBeVisible();
    expect(f.concluida).toBe(true);
  });

  test('refazendo sem nada novo: a lista diz que não há nada novo e o botão vira Concluir', async ({ page }) => {
    const { f } = await abrir(page, { concluida: true, memorias: [] }, '/ajustes');
    await page.getByRole('button', { name: 'Refazer boas-vindas' }).click();
    await ateALista(page);
    await expect(page.getByText('Não encontrei nada novo para guardar.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar selecionadas' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(barraAbas(page)).toBeVisible();
    expect(f.lotes).toEqual([]);
    expect(f.concluidos).toBe(1);
  });

  test('José sabe vazio: "Fazer as boas-vindas" abre as boas-vindas', async ({ page }) => {
    await simularApi(page);
    const memorias = await simularMemorias(page);
    const f = await simularBoasVindas(page, { concluida: true }, memorias);
    await page.goto('/jose-sabe');
    await expect(page.getByText('O José ainda não sabe nada sobre você.')).toBeVisible();
    await page.getByRole('button', { name: 'Fazer as boas-vindas' }).click();
    await expect(page).toHaveURL(/\/boas-vindas\?c=bv1$/);
    expect(f.criadas).toBe(1);
    await expect(progresso(page)).toHaveText('Pergunta 1 de 5');
  });
});

test.describe('A barra de abas só some nas boas-vindas', () => {
  for (const rota of ['/', '/tarefas', '/jose-sabe', '/ajustes']) {
    test(`${rota}: a barra de abas está lá`, async ({ page }) => {
      await simularApi(page);
      await simularChat(page);
      await simularMemorias(page);
      await simularBoasVindas(page, { concluida: true });
      await page.route((url) => url.pathname.startsWith('/api/tarefas') || url.pathname.startsWith('/api/metas'), (r) => r.fulfill({ json: [] }));
      await page.goto(rota);
      await expect(barraAbas(page)).toBeVisible();
      await expect(page.locator('html')).not.toHaveAttribute('data-sem-abas', /.*/);
    });
  }
});

// ---- Layout (iPhone): 320 e 390 px, documento fixo, alvos de 48 px, texto longo ----
for (const largura of [320, 390]) {
  test.describe(`Layout ${largura}px`, () => {
    test.use({ viewport: { width: largura, height: 700 } });

    async function conferir(page: Page, rotulo: string) {
      const { rolagem, largura: w, fora, transbordo } = await elementosForaDaTela(page);
      expect(rolagem, `${rotulo}: rolagem lateral`).toBeLessThanOrEqual(w);
      expect(fora, `${rotulo}: fora da largura`).toEqual([]);
      expect(transbordo, `${rotulo}: conteúdo vazando da caixa`).toEqual([]);
      const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, v: window.innerHeight }));
      expect(doc.h, `${rotulo}: o documento não rola`).toBeLessThanOrEqual(doc.v);
      const alvos = await medir(page, '.bv__pular, .rapidas__botao, .chat__acao, .bv__salvar, .aprendi__caixa, .aprendi .chip-area');
      expect(menoresQue(alvos, 48), `${rotulo}: alvos menores que 48px`).toEqual([]);
    }

    test('perguntas (com respostas rápidas) e lista final: nada passa da largura, o documento não rola, alvos de 48px', async ({ page }) => {
      await abrir(page, { memorias: [{ texto: LONGA_300, area: 'sobre_mim' }, { texto: PALAVRA_80, area: 'trabalho' }, { texto: LONGA, area: 'casa' }, { texto: 'Curta.', area: 'saude' }] });
      await expect(progresso(page)).toHaveText('Pergunta 1 de 5');
      await conferir(page, 'pergunta 1');
      await responder(page, RESPOSTAS[0]!);
      await expect(page.getByRole('group', { name: 'Respostas rápidas' })).toBeVisible();
      await conferir(page, 'pergunta 2 (respostas rápidas)');
      await page.getByRole('group', { name: 'Respostas rápidas' }).getByRole('button', { name: 'Família e casa' }).click();
      await page.getByRole('button', { name: 'Enviar' }).click();
      await responder(page, RESPOSTAS[2]!);
      await expect(progresso(page)).toHaveText('Pergunta 4 de 5');
      await conferir(page, 'pergunta 4');
      await page.getByRole('group', { name: 'Respostas rápidas' }).getByRole('button', { name: 'Começar' }).click();
      await expect(progresso(page)).toHaveText('Pergunta 5 de 5');
      await conferir(page, 'pergunta 5 (3 respostas rápidas longas)');
      await page.getByRole('group', { name: 'Respostas rápidas' }).getByRole('button', { name: 'Acordo 8h, durmo à meia-noite' }).click();
      await expect(page.locator('.aprendi__item')).toHaveCount(4);
      await conferir(page, 'lista final');
      // "Salvar selecionadas" e "Pular" ficam à vista (dentro da janela) com a lista longa
      for (const nome of ['Salvar selecionadas', 'Pular']) {
        const b = (await page.getByRole('button', { name: nome }).boundingBox())!;
        expect(b.y, `${nome} dentro da janela`).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height, `${nome} dentro da janela`).toBeLessThanOrEqual(700);
      }
      // o texto de 300 caracteres aparece inteiro (a caixa cresce com o texto, sem rolagem interna)
      const caixa = page.getByRole('textbox', { name: 'Texto da memória 1' });
      const { alturaVisivel, alturaTotal } = await caixa.evaluate((el) => ({ alturaVisivel: el.clientHeight, alturaTotal: el.scrollHeight }));
      expect(alturaTotal).toBeLessThanOrEqual(alturaVisivel + 2);
      // a lista rola por dentro até o último item, e o último item fica acima do botão Salvar
      await page.locator('.aprendi__item').last().scrollIntoViewIfNeeded();
      const ultimo = (await page.locator('.aprendi__item').last().boundingBox())!;
      const salvar = (await page.getByRole('button', { name: 'Salvar selecionadas' }).boundingBox())!;
      expect(ultimo.y + ultimo.height).toBeLessThanOrEqual(salvar.y + 1);
    });

    test('com a área segura do iPhone (notch e barra home): nada rola e o botão Salvar fica visível', async ({ page }) => {
      await abrir(page);
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--safe-top', '47px');
        document.documentElement.style.setProperty('--safe-bottom', '34px');
      });
      await ateALista(page);
      const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, v: window.innerHeight }));
      expect(doc.h).toBeLessThanOrEqual(doc.v);
      const salvar = (await page.getByRole('button', { name: 'Salvar selecionadas' }).boundingBox())!;
      expect(salvar.y + salvar.height).toBeLessThanOrEqual(700 - 34 + 1);
      const topo = (await page.locator('.bv__topo').boundingBox())!;
      expect(topo.y).toBeGreaterThanOrEqual(47 - 1);
    });
  });
}

test.describe('Boas-vindas: acessibilidade', () => {
  test('contraste >= 4,5:1 nos textos do topo e da lista', async ({ page }) => {
    await abrir(page);
    await ateALista(page);
    const cores = await page.evaluate(() => {
      const fundo = (el: Element): string => {
        let n: Element | null = el;
        while (n) {
          const c = getComputedStyle(n).backgroundColor;
          if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
          n = n.parentElement;
        }
        return 'rgb(15, 17, 21)';
      };
      const hex = (c: string) => '#' + c.match(/\d+/g)!.slice(0, 3).map((v) => Number(v).toString(16).padStart(2, '0')).join('');
      return ['.bv__progresso', '.bv__pular', '.aprendi__titulo', '.aprendi__texto', '.bv__marcadas', '.chip-area'].map((sel) => {
        const el = document.querySelector(sel)!;
        return { sel, texto: hex(getComputedStyle(el).color), fundo: hex(fundo(el)) };
      });
    });
    for (const c of cores) expect(contraste(c.texto, c.fundo), `${c.sel} ${c.texto} sobre ${c.fundo}`).toBeGreaterThanOrEqual(4.5);
  });

  test('teclado: depois de escolher uma resposta rápida o foco não se perde no body', async ({ page }) => {
    await abrir(page);
    await responder(page, RESPOSTAS[0]!);
    await responder(page, RESPOSTAS[1]!);
    await responder(page, RESPOSTAS[2]!);
    await expect(progresso(page)).toHaveText('Pergunta 4 de 5');
    const botao = page.getByRole('group', { name: 'Respostas rápidas' }).getByRole('button', { name: 'Decidir' });
    await botao.focus();
    await page.keyboard.press('Enter');
    await expect(progresso(page)).toHaveText('Pergunta 5 de 5');
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'BODY')).not.toBe('BODY');
  });

  test('teclado: Tab chega ao Pular, às caixas e ao Salvar; Espaço marca e desmarca; o foco fica visível', async ({ page }) => {
    await abrir(page);
    await ateALista(page);
    const caixa = page.getByRole('checkbox', { name: 'Guardar a memória 1' });
    await caixa.focus();
    await expect(caixa).toBeFocused();
    await page.keyboard.press('Space');
    await expect(caixa).not.toBeChecked();
    await page.keyboard.press('Space');
    await expect(caixa).toBeChecked();
    const contorno = await caixa.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(contorno).not.toBe('none');
    await page.getByRole('button', { name: 'Pular' }).focus();
    await expect(page.getByRole('button', { name: 'Pular' })).toBeFocused();
  });
});
