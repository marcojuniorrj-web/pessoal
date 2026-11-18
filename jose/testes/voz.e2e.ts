import { expect, test, type Page } from '@playwright/test';
import { elementosForaDaTela, medir, menoresQue, sobrepoe } from './medidas';
import { microfonesPedidos, novaConversa, prepararMicrofone, simularApi, simularChat, simularTarefas, simularVoz, trilhasAoVivo, type ChatFalso, type VozFalsa } from './apoio';

// Voz no Chat (telas.md, tela 3). O Chromium usa o microfone falso (--use-fake-device-for-media-stream) e o Whisper é simulado.
// O que só o iPhone real confirma (WebKit, permissão do sistema, MediaRecorder do Safari) fica no roteiro da fase 3.

const TEXTO = 'preciso organizar a visita do cliente amanhã';
const mic = (page: Page) => page.getByRole('button', { name: 'Gravar áudio' });
const parar = (page: Page) => page.getByRole('button', { name: 'Parar e enviar áudio' });
const cancelar = (page: Page) => page.getByRole('button', { name: 'Cancelar gravação' });
const aviso = (page: Page) => page.locator('.toast');
const semTrilhas = (page: Page) => expect.poll(() => trilhasAoVivo(page)).toBe(0);

interface Cenario { f: ChatFalso; v: VozFalsa }
async function abrir(page: Page, extra: { chat?: Partial<ChatFalso>; voz?: Partial<VozFalsa>; negar?: boolean; url?: string; tamanho?: { width: number; height: number } } = {}): Promise<Cenario> {
  if (extra.tamanho) await page.setViewportSize(extra.tamanho);
  await simularApi(page);
  await simularTarefas(page);
  const f = await simularChat(page, extra.chat);
  const v = await simularVoz(page, extra.voz);
  await prepararMicrofone(page, { negar: extra.negar });
  await page.goto(extra.url ?? '/');
  await expect(mic(page)).toBeVisible();
  return { f, v };
}

/** Toca no 🎤, espera a barra e grava por `ms`. */
async function comecar(page: Page, ms = 0) {
  await mic(page).click();
  await expect(parar(page)).toBeVisible();
  if (ms) await page.waitForTimeout(ms);
}
async function gravarEEnviar(page: Page, ms = 1300) {
  await comecar(page, ms);
  await parar(page).click();
}

test.describe('fluxo da voz', () => {
  test('tocar no 🎤, falar e tocar em ■: transcreve, envia como voz (balão com 🎤), o José responde e o microfone é liberado', async ({ page }, info) => {
    const { f, v } = await abrir(page, { voz: { atrasoMs: 700 } });
    await comecar(page, 1300);
    await expect(page.locator('.gravacao__tempo')).toHaveText(/^1:5[89]$/); // contagem regressiva a partir de 2:00
    expect(await trilhasAoVivo(page)).toBeGreaterThan(0);
    await parar(page).click();
    await expect(page.getByText('Transcrevendo áudio…')).toBeVisible();
    const balao = page.locator('.balao--marco');
    await expect(balao).toContainText(TEXTO);
    await expect(balao.getByRole('img', { name: 'Enviado por voz' })).toBeVisible();
    await expect(page.locator('.balao--jose')).toContainText('Próximo passo');
    expect(f.postsMensagem.map((p) => ({ texto: p.texto, origem: p.origem }))).toEqual([{ texto: TEXTO, origem: 'voz' }]);
    // o áudio vai em multipart, com o tipo real do gravador e a duração (≥ 1 s)
    expect(v.pedidos).toHaveLength(1);
    expect(v.pedidos[0]!.contentType).toContain('multipart/form-data');
    expect(v.pedidos[0]!.duracaoMs!).toBeGreaterThanOrEqual(1000);
    expect(v.pedidos[0]!.duracaoMs!).toBeLessThan(6000);
    const iphone = await page.evaluate(() => /iPhone|iPad/.test(navigator.userAgent) && MediaRecorder.isTypeSupported('audio/mp4'));
    expect(v.pedidos[0]!.tipoArquivo).toMatch(iphone ? /^audio\/mp4/ : /^audio\/webm/);
    expect(v.pedidos[0]!.arquivo).toBe(iphone ? 'audio.m4a' : 'audio.webm');
    await semTrilhas(page);
    await expect(mic(page)).toBeVisible();
    // a mensagem de voz continua com o 🎤 ao reabrir a conversa
    await page.reload();
    await expect(page.locator('.balao--marco').getByRole('img', { name: 'Enviado por voz' })).toBeVisible();
    void info;
  });

  test('✕ cancela: nada é enviado, o microfone é liberado e o foco volta ao 🎤', async ({ page }) => {
    const { f, v } = await abrir(page);
    await comecar(page, 800);
    await cancelar(page).click();
    await expect(mic(page)).toBeVisible();
    await expect(mic(page)).toBeFocused();
    await semTrilhas(page);
    await page.waitForTimeout(400);
    expect(v.pedidos).toHaveLength(0);
    expect(f.postsMensagem).toHaveLength(0);
    await expect(page.locator('.balao--marco')).toHaveCount(0);
    await expect(aviso(page)).toHaveCount(0);
  });

  test('Esc cancela a gravação', async ({ page }) => {
    const { f, v } = await abrir(page);
    await comecar(page, 300);
    await page.keyboard.press('Escape');
    await expect(mic(page)).toBeVisible();
    await semTrilhas(page);
    expect(v.pedidos).toHaveLength(0);
    expect(f.postsMensagem).toHaveLength(0);
  });

  test('áudio com menos de 1 s é descartado sem aviso', async ({ page }) => {
    const { f, v } = await abrir(page);
    await mic(page).click();
    await expect(parar(page)).toBeVisible();
    await page.keyboard.press('Space'); // teclado: o ■ responde na hora (o toque só vale depois da janela contra o clique fantasma)
    await expect(mic(page)).toBeVisible();
    await expect(page.getByText('Transcrevendo áudio…')).toHaveCount(0);
    await semTrilhas(page);
    await page.waitForTimeout(400);
    expect(v.pedidos).toHaveLength(0);
    expect(f.postsMensagem).toHaveLength(0);
    await expect(aviso(page)).toHaveCount(0);
  });

  test('aos 2:00 a gravação para sozinha e envia; o contador desce até 0:00', async ({ page }) => {
    await page.clock.install();
    const { f, v } = await abrir(page);
    await comecar(page, 300);
    await page.clock.fastForward(61_000);
    await expect(page.locator('.gravacao__tempo')).toHaveText('0:59');
    await page.clock.fastForward(60_000);
    await expect(page.locator('.balao--marco')).toContainText(TEXTO);
    await expect(page.locator('.balao--jose')).toContainText('Próximo passo');
    expect(v.pedidos).toHaveLength(1);
    expect(v.pedidos[0]!.duracaoMs).toBe(120_000);
    expect(f.postsMensagem[0]!.origem).toBe('voz');
    await semTrilhas(page);
  });

  test('com texto no campo o botão é Enviar (a voz não apaga o texto); sem texto volta o 🎤', async ({ page }) => {
    await abrir(page);
    const campo = page.getByLabel('Mensagem para o José');
    await campo.fill('rascunho que não pode sumir');
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeEnabled();
    await expect(mic(page)).toHaveCount(0);
    await campo.fill('');
    await expect(mic(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar' })).toHaveCount(0);
  });

  test('o rascunho de outra conversa não é perdido ao gravar e enviar voz', async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('jose:rascunho:a')) localStorage.setItem('jose:rascunho:a', 'rascunho da conversa A');
    });
    const { f } = await abrir(page, { chat: { conversas: [novaConversa('a', 'Conversa A', 60, 'padrao', [['marco', 'oi'], ['jose', 'olá']])], hoje: null }, url: '/?nova=1' });
    await gravarEEnviar(page);
    await expect(page.locator('.balao--marco')).toContainText(TEXTO);
    await expect(page.locator('.balao--jose')).toContainText('Próximo passo');
    expect(f.postsMensagem.at(-1)!.origem).toBe('voz');
    expect(await page.evaluate(() => localStorage.getItem('jose:rascunho:a'))).toBe('rascunho da conversa A');
    await page.goto('/?c=a');
    await expect(page.getByLabel('Mensagem para o José')).toHaveValue('rascunho da conversa A');
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeEnabled();
  });

  test('offline: o 🎤 fica desabilitado como o Enviar', async ({ page }) => {
    await abrir(page);
    await page.context().setOffline(true);
    await expect(mic(page)).toBeDisabled();
    await page.context().setOffline(false);
    await expect(mic(page)).toBeEnabled();
  });

  test('foco por teclado: Enter no 🎤 grava, Enter no ■ envia', async ({ page }) => {
    const { v } = await abrir(page);
    await mic(page).focus();
    await page.keyboard.press('Enter');
    await expect(parar(page)).toBeFocused();
    await page.waitForTimeout(1300);
    await page.keyboard.press('Enter');
    await expect(page.locator('.balao--marco')).toContainText(TEXTO);
    expect(v.pedidos).toHaveLength(1);
  });
});

test.describe('avisos e erros (nada se perde)', () => {
  const casos: Array<[string, VozFalsa['planos'], string]> = [
    ['falha da transcrição', ['falha'], 'Não entendi o áudio. Tenta de novo ou digita.'],
    ['transcrição vazia', ['vazio'], 'Não ouvi nada no áudio. Tenta de novo ou digita.'],
    ['limite diário de voz (429)', ['limite'], 'Limite de voz de hoje atingido. Digite sua mensagem.'],
  ];
  for (const [nome, planos, mensagem] of casos) {
    test(`${nome}: aviso claro, nada é enviado e dá para tentar de novo`, async ({ page }) => {
      const { f, v } = await abrir(page, { voz: { planos } });
      await gravarEEnviar(page);
      await expect(aviso(page)).toHaveText(mensagem);
      await expect(page.getByLabel('Mensagem para o José')).toHaveValue('');
      await expect(page.locator('.balao--marco')).toHaveCount(0);
      expect(f.postsMensagem).toHaveLength(0);
      await semTrilhas(page);
      await expect(mic(page)).toBeEnabled();
      // tenta de novo (o próximo plano é ok)
      await gravarEEnviar(page);
      await expect(page.locator('.balao--marco')).toContainText(TEXTO);
      expect(v.pedidos).toHaveLength(2);
    });
  }

  test('microfone negado: "Libere o microfone nas configurações para usar voz." (com a instrução no iPhone)', async ({ page }) => {
    const { v } = await abrir(page, { negar: true });
    await mic(page).click();
    await expect(aviso(page)).toContainText('Libere o microfone nas configurações para usar voz.');
    const iphone = await page.evaluate(() => /iPhone|iPad/.test(navigator.userAgent));
    if (iphone) await expect(aviso(page)).toContainText('Ajustes > Safari (ou José) > Microfone');
    await expect(mic(page)).toBeEnabled();
    await expect(parar(page)).toHaveCount(0);
    expect(v.pedidos).toHaveLength(0);
    expect(await microfonesPedidos(page)).toBe(1);
  });

  test('sessão expirada (401) na transcrição leva ao Login', async ({ page }) => {
    await abrir(page, { voz: { planos: ['401'] } });
    await gravarEEnviar(page);
    await expect(page).toHaveURL(/\/login/);
    await semTrilhas(page);
  });
});

test.describe('microfone sempre liberado', () => {
  test('o app vai para o segundo plano durante a gravação: cancela, não envia e avisa ao voltar', async ({ page }) => {
    const { f, v } = await abrir(page);
    await comecar(page, 800);
    const mudar = (estado: 'hidden' | 'visible') =>
      page.evaluate((e) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => e });
        document.dispatchEvent(new Event('visibilitychange'));
      }, estado);
    await mudar('hidden');
    await expect(mic(page)).toBeVisible();
    await semTrilhas(page);
    await mudar('visible');
    await expect(aviso(page)).toHaveText('Gravação cancelada (o app saiu da tela)');
    await page.waitForTimeout(300);
    expect(v.pedidos).toHaveLength(0);
    expect(f.postsMensagem).toHaveLength(0);
  });

  test('trocar de aba durante a gravação: o Chat é desmontado, o microfone é liberado e nada é enviado', async ({ page }) => {
    const { f, v } = await abrir(page);
    await comecar(page, 800);
    await page.getByRole('navigation').getByText('Tarefas', { exact: true }).click();
    await expect(page.getByText('Nada por aqui.')).toBeVisible();
    await semTrilhas(page);
    await expect(aviso(page)).toHaveText('Gravação cancelada.');
    await page.waitForTimeout(300);
    expect(v.pedidos).toHaveLength(0);
    expect(f.postsMensagem).toHaveLength(0);
    // ao voltar ao Chat dá para gravar de novo
    await page.getByRole('navigation').getByText('Chat', { exact: true }).click();
    await expect(mic(page)).toBeEnabled();
  });

  test('abrir outra conversa durante a gravação cancela a gravação (não vale para a outra conversa)', async ({ page }) => {
    const { f } = await abrir(page, { chat: { conversas: [novaConversa('a', 'Conversa A', 60, 'padrao', [['marco', 'oi'], ['jose', 'olá']])], hoje: null } });
    await comecar(page, 800);
    await page.getByRole('button', { name: 'Nova conversa' }).click();
    await expect(mic(page)).toBeVisible();
    await semTrilhas(page);
    await expect(aviso(page)).toHaveText('Gravação cancelada.');
    expect(f.postsMensagem).toHaveLength(0);
  });

  test('toque duplo no 🎤 não abre dois microfones', async ({ page }) => {
    await abrir(page);
    await mic(page).dblclick();
    await expect(parar(page)).toBeVisible();
    expect(await microfonesPedidos(page)).toBe(1);
    await cancelar(page).click({ delay: 0 }).catch(() => {});
    await page.keyboard.press('Escape');
    await semTrilhas(page);
  });
});

// ---- A mensagem de voz segue as regras das de texto (pressão longa, Copiar, Apagar com Desfazer) ----
function conversaComVoz() {
  const c = novaConversa('a', 'Plano do dia', 30, 'padrao', [['marco', 'preciso ligar para o cliente', 40], ['jose', 'Boa. Qual é o primeiro passo?', 39]]);
  c.mensagens[0]!.origem = 'voz';
  return c;
}
const folha = (page: Page) => page.getByRole('dialog', { name: 'Ações da mensagem' });

test.describe('balão de voz', () => {
  test('mostra o 🎤 pequeno com rótulo; o botão direito abre a folha com Copiar e Apagar; Apagar mensagem tem Desfazer', async ({ page }) => {
    const { f } = await abrir(page, { chat: { conversas: [conversaComVoz()], hoje: 'a' } });
    const balao = page.locator('.balao--marco');
    await expect(balao.getByRole('img', { name: 'Enviado por voz' })).toBeVisible();
    await balao.click({ button: 'right' });
    await expect(folha(page)).toBeVisible();
    await expect(folha(page).getByRole('button', { name: 'Copiar' })).toBeVisible();
    await page.waitForTimeout(700); // a folha só aceita toques depois da janela contra o clique fantasma do iOS
    await folha(page).getByRole('button', { name: 'Apagar mensagem', exact: true }).click();
    await expect(aviso(page)).toContainText('Apagado.');
    await expect(balao).toHaveCount(0);
    await aviso(page).getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.locator('.balao--marco').getByRole('img', { name: 'Enviado por voz' })).toBeVisible();
    expect(f.deletesMensagem).toEqual([]);
  });

  test('pressão longa por toque no balão de voz abre a folha (só celular)', async ({ page }, info) => {
    test.skip(info.project.name !== 'celular');
    await abrir(page, { chat: { conversas: [conversaComVoz()], hoje: 'a' } });
    const r = (await page.locator('.balao--marco').boundingBox())!;
    const ponto = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [ponto] });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(folha(page)).toBeVisible();
    await page.waitForTimeout(700);
    await folha(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(folha(page)).toHaveCount(0);
  });

  test('durante a gravação a folha abre normalmente e o Esc fecha só a folha (a gravação continua); outro Esc cancela', async ({ page }) => {
    await abrir(page, { chat: { conversas: [conversaComVoz()], hoje: 'a' } });
    await comecar(page, 400);
    await page.locator('.balao--marco').click({ button: 'right' });
    await expect(folha(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(folha(page)).toHaveCount(0);
    await expect(parar(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(mic(page)).toBeVisible();
    await semTrilhas(page);
  });
});

// ---- Layout: 320, 390 e 1280 px (alvos ≥ 48, nada passa da largura, o documento do Chat não rola) ----
const TAMANHOS = [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1280, height: 800 }];

async function conferirLayout(page: Page, tamanho: { width: number; height: number }, rotulo: string, alvos: string[]) {
  const doc = await page.evaluate(() => ({ alturaDoc: document.documentElement.scrollHeight, janela: window.innerHeight, rolagem: document.documentElement.scrollWidth, largura: window.innerWidth }));
  expect(doc.alturaDoc, `${rotulo}: o documento do Chat não rola`).toBeLessThanOrEqual(doc.janela);
  expect(doc.rolagem, `${rotulo}: rolagem lateral`).toBeLessThanOrEqual(doc.largura);
  const m = await elementosForaDaTela(page);
  expect(m.fora, `${rotulo}: ${JSON.stringify(m.fora)}`).toEqual([]);
  expect(m.transbordo, `${rotulo}: ${JSON.stringify(m.transbordo)}`).toEqual([]);
  const caixas = (await Promise.all(alvos.map((a) => medir(page, a)))).flat();
  expect(caixas.length, `${rotulo}: alvos encontrados`).toBe(alvos.length);
  expect(menoresQue(caixas), `${rotulo}: alvos menores que 48px`).toEqual([]);
  // nada por baixo da barra de abas
  const barra = (await medir(page, '.barra-abas'))[0]!;
  const rodape = (await medir(page, '.chat__rodape'))[0]!;
  expect(rodape.y + rodape.height, `${rotulo}: rodapé acima da barra de abas`).toBeLessThanOrEqual(barra.y + 1);
  expect(barra.y + barra.height).toBeLessThanOrEqual(tamanho.height + 1);
}

for (const tamanho of TAMANHOS) {
  test.describe(`layout ${tamanho.width}x${tamanho.height}`, () => {
    test('ocioso: o 🎤 tem pelo menos 48px, cabe na largura e a lista rola sozinha', async ({ page }) => {
      await abrir(page, { tamanho, chat: { conversas: [conversaComVoz()], hoje: 'a' } });
      await conferirLayout(page, tamanho, 'ocioso', ['.chat__acao', '.chat__campo']);
      expect((await page.locator('.chat__acao').boundingBox())!.width).toBeGreaterThanOrEqual(48);
      await expect(page.getByRole('navigation')).toBeVisible();
    });

    test('gravando: barra com ✕ e ■ de 48px, contador legível (contraste ≥ 4,5:1), ponto pulsante e nada passa da largura', async ({ page }) => {
      await abrir(page, { tamanho, chat: { conversas: [conversaComVoz()], hoje: 'a' } });
      await comecar(page, 800);
      await conferirLayout(page, tamanho, 'gravando', ['.chat__cancelar-gravacao', '.chat__acao', '.gravacao']);
      const [x, barra, acao] = [await medir(page, '.chat__cancelar-gravacao'), await medir(page, '.gravacao'), await medir(page, '.chat__acao')].map((l) => l[0]!);
      expect(sobrepoe(x!, barra!) || sobrepoe(barra!, acao!) || sobrepoe(x!, acao!), '✕, contador e ■ não se sobrepõem').toBe(false);
      expect(await page.locator('.gravacao__ponto').evaluate((el) => getComputedStyle(el).animationName)).not.toBe('none');
      const contraste = await page.evaluate(() => {
        const lum = (rgb: string) => {
          const [r, g, b] = rgb.match(/\d+/g)!.slice(0, 3).map((v) => Number(v) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
          return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
        };
        const frente = getComputedStyle(document.querySelector('.gravacao__tempo')!).color;
        const fundo = getComputedStyle(document.querySelector('.gravacao')!).backgroundColor;
        const [a, b] = [lum(frente), lum(fundo)].sort((p, q) => q - p);
        return (a! + 0.05) / (b! + 0.05);
      });
      expect(contraste).toBeGreaterThanOrEqual(4.5);
      await cancelar(page).click();
      await expect(mic(page)).toBeVisible();
      await conferirLayout(page, tamanho, 'depois de cancelar', ['.chat__acao', '.chat__campo']);
    });

    test('gravando com "reduzir movimento": o ponto fica parado', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await abrir(page, { tamanho });
      await comecar(page);
      expect(await page.locator('.gravacao__ponto').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    });

    test('transcrevendo: "Transcrevendo áudio…" na barra, com 48px e dentro da largura', async ({ page }) => {
      await abrir(page, { tamanho, voz: { atrasoMs: 1500 }, chat: { conversas: [conversaComVoz()], hoje: 'a' } });
      await gravarEEnviar(page);
      await expect(page.getByText('Transcrevendo áudio…')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Transcrevendo áudio' })).toHaveAttribute('aria-busy', 'true');
      await conferirLayout(page, tamanho, 'transcrevendo', ['.gravacao', '.chat__acao']);
      await expect(page.locator('.balao--marco').last()).toContainText(TEXTO);
    });

    test('erro e negado: o aviso (toast) não cobre o campo nem o 🎤, e a página não rola', async ({ page }) => {
      await abrir(page, { tamanho, voz: { planos: ['falha'] }, chat: { conversas: [conversaComVoz()], hoje: 'a' } });
      await gravarEEnviar(page);
      await expect(aviso(page)).toContainText('Não entendi o áudio.');
      await page.waitForTimeout(300);
      const [toast] = await medir(page, '.toast');
      for (const alvo of ['.chat__campo', '.chat__acao']) {
        const [caixa] = await medir(page, alvo);
        expect(sobrepoe(toast!, caixa!), `o aviso cobre ${alvo}`).toBe(false);
      }
      await conferirLayout(page, tamanho, 'após o erro', ['.chat__acao', '.chat__campo']);
    });

    test('o aviso (toast) durante a gravação não cobre a barra de gravação nem o ■', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await abrir(page, { tamanho, chat: { conversas: [conversaComVoz()], hoje: 'a' } });
      await comecar(page, 300);
      await page.locator('.balao--marco').click({ button: 'right' });
      await expect(folha(page)).toBeVisible();
      await page.waitForTimeout(700);
      await folha(page).getByRole('button', { name: 'Copiar' }).click();
      await expect(aviso(page)).toContainText('Copiado.');
      await page.waitForTimeout(300);
      const [toast] = await medir(page, '.toast');
      for (const alvo of ['.gravacao', '.chat__cancelar-gravacao', '.chat__acao']) {
        const [caixa] = await medir(page, alvo);
        expect(sobrepoe(toast!, caixa!), `o aviso cobre ${alvo}`).toBe(false);
      }
      await expect(parar(page)).toBeVisible(); // continua gravando
      await conferirLayout(page, tamanho, 'toast + gravando', ['.chat__cancelar-gravacao', '.chat__acao', '.gravacao']);
    });

    test('balão de voz com texto longo sem espaços não estoura a largura', async ({ page }) => {
      const c = novaConversa('a', 'Plano do dia', 30, 'padrao', [['marco', `${'x'.repeat(90)} fim`, 40], ['jose', 'ok', 39]]);
      c.mensagens[0]!.origem = 'voz';
      await abrir(page, { tamanho, chat: { conversas: [c], hoje: 'a' } });
      await expect(page.locator('.balao--marco').getByRole('img', { name: 'Enviado por voz' })).toBeVisible();
      await conferirLayout(page, tamanho, 'balão longo', ['.chat__acao']);
    });
  });
}

test('áreas seguras do iPhone: barra de gravação dentro das laterais e acima da barra de abas', async ({ page }) => {
  await abrir(page, { tamanho: { width: 390, height: 844 } });
  await page.addStyleTag({ content: ':root { --safe-top: 47px; --safe-bottom: 34px; --safe-left: 20px; --safe-right: 20px; }' });
  await comecar(page, 300);
  const cancelarCaixa = (await cancelar(page).boundingBox())!;
  const acao = (await page.locator('.chat__acao').boundingBox())!;
  expect(cancelarCaixa.x).toBeGreaterThanOrEqual(20);
  expect(acao.x + acao.width).toBeLessThanOrEqual(390 - 20);
  const barra = (await medir(page, '.barra-abas'))[0]!;
  expect(acao.y + acao.height).toBeLessThanOrEqual(barra.y + 0.5);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);
});
