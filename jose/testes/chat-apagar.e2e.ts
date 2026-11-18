import { expect, test, type Locator, type Page } from '@playwright/test';
import { horaMensagem, rotuloDia } from '../compartilhado/datas';
import { novaConversa, simularApi, simularChat, simularTarefas, type ChatFalso, type ConversaFalsa } from './apoio';
import { JANELA_ABERTURA_MS } from '../app/src/estado/pressao-longa';
import { elementosForaDaTela, medir, menoresQue, sobrepoe } from './medidas';

const MIN_DIA = 24 * 60;
const folha = (page: Page) => page.getByRole('dialog', { name: 'Ações da mensagem' });
const balaoMarco = (page: Page) => page.locator('.balao--marco');
const balaoJose = (page: Page) => page.locator('.balao--jose');

/** Conversa de hoje com 1 pergunta e 1 resposta, mais mensagens extras se pedido. */
const conversaA = (extra: Array<[string, string, number?]> = []): ConversaFalsa =>
  novaConversa('a', 'Plano do dia', 30, 'padrao', [['marco', 'Oi José', 30], ['jose', 'Bom dia, Marco.', 29], ...extra]);

async function abrir(page: Page, inicial: Partial<ChatFalso> = {}, conversas: ConversaFalsa[] = [conversaA()]) {
  await simularApi(page);
  await simularTarefas(page);
  const f = await simularChat(page, { conversas, hoje: conversas[0]!.id, ...inicial });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: conversas[0]!.titulo ?? '' })).toBeVisible();
  return f;
}

/** Pressão longa com o mouse: aperta, espera `ms` parado e solta. */
async function segurar(page: Page, alvo: Locator, ms = 600) {
  await alvo.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const caixa = (await alvo.boundingBox())!;
  // um balão alto pode passar da tela: mira na parte de cima dele, que está à vista
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + Math.min(caixa.height / 2, 24));
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  // um toque só vale na folha depois da janela de abertura (anti-clique fantasma da pressão longa)
  if (ms >= 450) await page.waitForTimeout(JANELA_ABERTURA_MS + 50);
}

test.describe('Horário e separadores de dia (2b.4)', () => {
  test('cada balão mostra HH:mm no fuso do Marco e há separadores Hoje, Ontem e a data', async ({ page }) => {
    const antiga = conversaA();
    antiga.mensagens = novaConversa('a', null, 0, 'padrao', [
      ['marco', 'Mensagem antiga', 10 * MIN_DIA], ['jose', 'Resposta antiga', 10 * MIN_DIA - 1],
      ['marco', 'Mensagem de ontem', MIN_DIA], ['jose', 'Resposta de ontem', MIN_DIA - 1],
      ['marco', 'Mensagem de hoje', 5], ['jose', 'Resposta de hoje', 4],
    ]).mensagens;
    const f = await abrir(page, {}, [antiga]);
    const agora = new Date();
    const msgs = f.conversas[0]!.mensagens;
    await expect(page.locator('.separador-dia')).toHaveText([rotuloDia(msgs[0]!.criada_em, agora), 'Ontem', 'Hoje']);
    expect(rotuloDia(msgs[0]!.criada_em, agora)).toMatch(/^(dom|seg|ter|qua|qui|sex|sáb)\., \d{1,2} de [a-zç]{3}\.( de \d{4})?$/);

    const horas = page.locator('.mensagem__hora');
    await expect(horas).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      const h = horas.nth(i);
      await expect(h).toHaveAttribute('datetime', msgs[i]!.criada_em);
      await expect(h).toContainText(horaMensagem(msgs[i]!.criada_em, 'America/Sao_Paulo'));
      await expect(h).toHaveText(new RegExp(`^(enviada|recebida) às ${horaMensagem(msgs[i]!.criada_em, 'America/Sao_Paulo')}$`));
    }
    // O texto visível do balão continua só a mensagem (a hora fica fora do balão).
    await expect(balaoMarco(page).first()).toHaveText('Mensagem antiga');
    // Cor secundária do tema (contraste testado em estilo.test.ts)
    expect(await horas.first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(154, 160, 170)');
  });

  test('a mensagem que acabou de chegar mostra a hora ao terminar, e a que está chegando não', async ({ page }) => {
    await abrir(page, { atrasoMs: 800 }, [conversaA()]);
    await page.getByLabel('Mensagem para o José').fill('mais uma');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByText('José está pensando')).toBeVisible();
    await expect(page.locator('.mensagem__hora')).toHaveCount(3); // as 2 antigas + a do Marco
    await expect(page.locator('.mensagem__hora')).toHaveCount(4, { timeout: 5000 }); // + a resposta, ao terminar
    await expect(page.locator('.separador-dia')).toHaveText(['Hoje']);
  });
});

for (const largura of [320, 390]) {
  test.describe(`Layout em ${largura}px (2b.7)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 700 });
    });

    test('balão de texto longo e palavra de 80 caracteres: sem rolagem lateral; a folha cabe e tem alvos >= 48px', async ({ page }) => {
      const longo = `${'Z'.repeat(80)} ${'texto longo '.repeat(40)}`.trim();
      const c = conversaA([['marco', longo, 20], ['jose', longo, 19]]);
      await abrir(page, {}, [c]);
      let m = await elementosForaDaTela(page);
      expect(m.rolagem, 'rolagem lateral').toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);

      await segurar(page, balaoMarco(page).nth(1));
      await expect(folha(page)).toBeVisible();
      m = await elementosForaDaTela(page);
      expect(m.rolagem).toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
      const acoes = await medir(page, '.folha__acao, .folha__cancelar');
      expect(acoes).toHaveLength(4);
      expect(menoresQue(acoes)).toEqual([]);
      await expect(page.getByRole('navigation')).toBeVisible();
      // a folha fica acima da barra de abas e dentro da tela
      const [f] = await medir(page, '.folha');
      const [nav] = await medir(page, 'nav');
      expect(f!.y + f!.height).toBeLessThanOrEqual(nav!.y + 0.5);
      expect(f!.y).toBeGreaterThanOrEqual(0);
    });

    test('topo com "Modo decisão" e o ⋯ cabe na largura; o menu "Apagar conversa" também', async ({ page }) => {
      const c = novaConversa('d', 'Decisão sobre a proposta de trabalho', 5, 'decidir', [['marco', 'oi', 5]]);
      await abrir(page, {}, [c]);
      await expect(page.locator('.chat__selo')).toBeVisible();
      await page.getByRole('button', { name: 'Mais opções da conversa' }).click();
      await expect(page.getByRole('menuitem', { name: 'Apagar conversa' })).toBeVisible();
      const m = await elementosForaDaTela(page);
      expect(m.rolagem).toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(menoresQue(await medir(page, '.chat__topo button, .chat__menu-item'))).toEqual([]);
    });

    test('o menu de uma conversa com o último balão longo e o toast não cobrem campo nem barra', async ({ page }) => {
      await abrir(page);
      await segurar(page, balaoMarco(page).first());
      await folha(page).getByRole('button', { name: 'Apagar mensagem e resposta' }).click();
      const aviso = page.locator('.toast');
      await expect(aviso).toContainText('Apagado.');
      await page.waitForTimeout(300);
      const [toast] = await medir(page, '.toast');
      for (const alvo of ['#campo-mensagem', 'button[aria-label="Enviar"]']) {
        const [caixa] = await medir(page, alvo);
        expect(sobrepoe(toast!, caixa!), `o aviso cobre ${alvo}`).toBe(false);
      }
    });
  });
}

test.describe('Pressão longa e folha de ações (2b.5)', () => {
  test('segurar a mensagem do Marco abre a folha com Copiar, Apagar mensagem, Apagar mensagem e resposta e Cancelar', async ({ page }) => {
    await abrir(page);
    await segurar(page, balaoMarco(page));
    const f = folha(page);
    await expect(f).toBeVisible();
    await expect(f.getByRole('button')).toHaveText(['Copiar', 'Apagar mensagem', 'Apagar mensagem e resposta', 'Cancelar']);
    await expect(f.getByRole('button', { name: 'Copiar' })).toBeFocused();
    expect(menoresQue(await medir(page, '.folha__acao, .folha__cancelar'))).toEqual([]);
  });

  test('na mensagem do José só há Copiar e Apagar mensagem', async ({ page }) => {
    await abrir(page);
    await segurar(page, balaoJose(page));
    await expect(folha(page).getByRole('button')).toHaveText(['Copiar', 'Apagar mensagem', 'Cancelar']);
  });

  test('o balão tem seleção de texto desligada (o iOS não abre a lupa), e o menu do navegador não aparece', async ({ page }) => {
    await abrir(page);
    const css = await balaoMarco(page).evaluate((el) => {
      const s = getComputedStyle(el) as CSSStyleDeclaration & { webkitTouchCallout?: string; webkitUserSelect?: string };
      return { userSelect: s.userSelect, callout: s.getPropertyValue('-webkit-touch-callout'), tabindex: el.getAttribute('tabindex') };
    });
    expect(css.userSelect).toBe('none');
    expect(css.tabindex).toBe('0');
    const prevenido = await balaoMarco(page).evaluate((el) => {
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevenido).toBe(true);
  });

  test('soltar antes do tempo não abre nada', async ({ page }) => {
    await abrir(page);
    await segurar(page, balaoMarco(page), 200);
    await page.waitForTimeout(600);
    await expect(folha(page)).toHaveCount(0);
  });

  test('mexer o dedo/mouse mais de ~10 px antes do tempo cancela (é rolagem)', async ({ page }) => {
    await abrir(page);
    const c = (await balaoMarco(page).boundingBox())!;
    const x = c.x + c.width / 2;
    const y = c.y + c.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 40, { steps: 4 });
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(folha(page)).toHaveCount(0);
    // um tremor pequeno (até 10 px) ainda conta como pressão
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 3, y + 4);
    await page.waitForTimeout(600);
    await page.mouse.up();
    await expect(folha(page)).toBeVisible();
  });

  test('toque real (celular): arrastar rola a lista sem abrir a folha; segurar parado abre', async ({ page }, info) => {
    test.skip(info.project.name !== 'celular', 'só o projeto de celular tem toque');
    const muitas: Array<[string, string, number?]> = [];
    for (let i = 0; i < 14; i++) muitas.push(['marco', `Pergunta ${i}`, 20 - i], ['jose', `Resposta ${i} com um texto um pouco maior para ocupar espaço`, 19 - i]);
    await abrir(page, {}, [conversaA(muitas)]);
    const lista = page.locator('.chat__mensagens');
    await lista.evaluate((el) => (el.scrollTop = 0));
    const antes = await lista.evaluate((el) => el.scrollTop);
    const alvo = balaoJose(page).nth(2);
    await alvo.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await lista.evaluate((el) => (el.scrollTop = 0));
    const caixa = (await balaoJose(page).nth(1).boundingBox())!;
    const x = caixa.x + caixa.width / 2;
    const y = caixa.y + caixa.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', pontos: Array<{ x: number; y: number }>) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pontos });
    await toque('touchStart', [{ x, y }]);
    for (let i = 1; i <= 8; i++) {
      await toque('touchMove', [{ x, y: y - i * 20 }]);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(600);
    await toque('touchEnd', []);
    await expect(folha(page)).toHaveCount(0);
    expect(await lista.evaluate((el) => el.scrollTop)).toBeGreaterThan(antes);

    // parado por ~0,6 s: abre
    const c2 = (await balaoJose(page).first().boundingBox())!;
    await lista.evaluate((el) => (el.scrollTop = 0));
    const c3 = (await balaoJose(page).first().boundingBox()) ?? c2;
    await toque('touchStart', [{ x: c3.x + c3.width / 2, y: c3.y + c3.height / 2 }]);
    await page.waitForTimeout(650);
    await toque('touchEnd', []);
    await expect(folha(page)).toBeVisible();
  });

  test('Esc fecha a folha e devolve o foco ao balão; tocar fora e Cancelar também fecham', async ({ page }) => {
    await abrir(page);
    await segurar(page, balaoMarco(page));
    await expect(folha(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(folha(page)).toHaveCount(0);
    await expect(balaoMarco(page)).toBeFocused();

    await segurar(page, balaoJose(page));
    await folha(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(folha(page)).toHaveCount(0);
    await expect(balaoJose(page)).toBeFocused();

    await segurar(page, balaoJose(page));
    await page.mouse.click(10, 10); // no fundo escurecido, longe da folha
    await expect(folha(page)).toHaveCount(0);
  });

  test('o foco fica preso na folha (Tab e Shift+Tab dão a volta)', async ({ page }) => {
    await abrir(page);
    await segurar(page, balaoMarco(page));
    const f = folha(page);
    await expect(f.getByRole('button', { name: 'Copiar' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(f.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(f.getByRole('button', { name: 'Copiar' })).toBeFocused();
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.folha'))).toBe(true);
  });

  test('teclado e botão direito: Enter, tecla de menu de contexto, Shift+F10 e o clique direito abrem a mesma folha', async ({ page }) => {
    await abrir(page);
    const b = balaoMarco(page);
    await b.focus();
    await page.keyboard.press('Enter');
    await expect(folha(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(b).toBeFocused();
    await page.keyboard.press('ContextMenu');
    await expect(folha(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+F10');
    await expect(folha(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await b.click({ button: 'right' });
    await expect(folha(page)).toBeVisible();
  });

  test('no computador aparece um ⋯ discreto ao passar o mouse, que abre a mesma folha', async ({ page }, info) => {
    test.skip(info.project.name !== 'computador', 'o ⋯ é só para mouse');
    await abrir(page);
    const mais = page.getByRole('button', { name: 'Ações da mensagem' }).first();
    await expect(mais).toHaveCSS('opacity', '0');
    await balaoMarco(page).hover();
    await expect(mais).toHaveCSS('opacity', '1');
    await mais.click();
    await expect(folha(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(balaoMarco(page)).toBeFocused();
  });

  test('"Copiar" copia o texto e avisa', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await abrir(page);
    await segurar(page, balaoJose(page));
    await folha(page).getByRole('button', { name: 'Copiar' }).click();
    await expect(page.locator('.toast')).toContainText('Copiado.');
    await expect(folha(page)).toHaveCount(0);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Bom dia, Marco.');
  });

  test('a resposta em andamento (e a pergunta que espera por ela) não abre a folha; depois de pronta, abre', async ({ page }) => {
    await abrir(page, { atrasoMs: 1500 });
    await page.getByLabel('Mensagem para o José').fill('mais uma');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByText('José está pensando')).toBeVisible();
    await segurar(page, page.getByText('José está pensando'), 600);
    await segurar(page, balaoMarco(page).last(), 600);
    await expect(folha(page)).toHaveCount(0);
    await expect(balaoJose(page).last()).toContainText('Próximo passo', { timeout: 5000 });
    await segurar(page, balaoJose(page).last());
    await expect(folha(page)).toBeVisible();
  });

  test('apagar mensagem e resposta → Desfazer: some na hora, volta, e nenhuma chamada à API é feita', async ({ page }) => {
    const f = await abrir(page);
    await segurar(page, balaoMarco(page));
    await folha(page).getByRole('button', { name: 'Apagar mensagem e resposta' }).click();
    await expect(page.locator('.balao')).toHaveCount(0);
    await expect(page.locator('.mensagem__hora')).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('Apagado.');
    expect(f.deletesMensagem).toEqual([]);
    await page.locator('.toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(balaoMarco(page)).toHaveText('Oi José');
    await expect(balaoJose(page)).toHaveText('Bom dia, Marco.');
    await page.waitForTimeout(5600);
    expect(f.deletesMensagem).toEqual([]);
  });

  test('apagar e esperar 5 s: o DELETE sai (com com_resposta=1), e ao recarregar continua apagada', async ({ page }) => {
    const f = await abrir(page);
    await segurar(page, balaoMarco(page));
    await folha(page).getByRole('button', { name: 'Apagar mensagem e resposta' }).click();
    await expect(page.locator('.balao')).toHaveCount(0);
    await page.waitForTimeout(3500);
    expect(f.deletesMensagem).toEqual([]); // ainda dentro dos 5 s
    await expect.poll(() => f.deletesMensagem, { timeout: 4000 }).toEqual([{ id: 'a-m0', comResposta: true }]);
    await page.reload();
    await expect(page.locator('.chat-vazio')).toBeVisible();
    await expect(page.locator('.balao')).toHaveCount(0);
  });

  test('"Apagar mensagem" apaga só a do José, sem com_resposta; a pergunta fica', async ({ page }) => {
    const f = await abrir(page);
    await segurar(page, balaoJose(page));
    await folha(page).getByRole('button', { name: 'Apagar mensagem', exact: true }).click();
    await expect(balaoJose(page)).toHaveCount(0);
    await expect(balaoMarco(page)).toHaveText('Oi José');
    await expect.poll(() => f.deletesMensagem, { timeout: 7000 }).toEqual([{ id: 'a-m1', comResposta: false }]);
    await expect(balaoMarco(page)).toHaveText('Oi José');
  });

  test('os cartões somem junto com a resposta apagada; um cartão salvo continua "✓ Salvo" depois do Desfazer', async ({ page }) => {
    const c = conversaA();
    c.sugestoes = [
      { id: 'sg1', mensagem_id: 'a-m1', tipo: 'tarefa', conteudo: { titulo: 'Revisar a proposta', area: 'trabalho', prazo: null }, status: 'salva', item_id: 't1' },
      { id: 'sg2', mensagem_id: 'a-m1', tipo: 'meta', conteudo: { titulo: 'Correr a meia', area: 'saude', prazo: null }, status: 'descartada', item_id: null },
    ];
    const f = await abrir(page, {}, [c]);
    await expect(page.getByText('✓ Salvo em Tarefas')).toBeVisible();
    await segurar(page, balaoJose(page));
    await folha(page).getByRole('button', { name: 'Apagar mensagem', exact: true }).click();
    await expect(page.getByText('✓ Salvo em Tarefas')).toHaveCount(0);
    await expect(page.getByText('Revisar a proposta')).toHaveCount(0);
    await page.locator('.toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByText('✓ Salvo em Tarefas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0); // nunca volta como pendente
    expect(f.deletesMensagem).toEqual([]);
  });

  test('trocar de aba durante os 5 s não faz a mensagem reaparecer, e a API ainda é chamada', async ({ page }) => {
    const f = await abrir(page);
    await segurar(page, balaoMarco(page));
    await folha(page).getByRole('button', { name: 'Apagar mensagem e resposta' }).click();
    await page.getByRole('navigation').getByText('Tarefas', { exact: true }).click();
    await page.getByRole('navigation').getByText('Chat', { exact: true }).click();
    await expect(page.locator('.chat')).toBeVisible();
    await expect(page.locator('.balao')).toHaveCount(0);
    await expect.poll(() => f.deletesMensagem.length, { timeout: 7000 }).toBe(1);
  });

  test('a folha fica acima do aviso (toast) e o aviso não a cobre', async ({ page }) => {
    await abrir(page, {}, [conversaA([['marco', 'Outra pergunta', 10], ['jose', 'Outra resposta', 9]])]);
    await segurar(page, balaoMarco(page).first());
    await folha(page).getByRole('button', { name: 'Apagar mensagem', exact: true }).click();
    await expect(page.locator('.toast')).toBeVisible();
    await segurar(page, balaoJose(page).last());
    await expect(folha(page)).toBeVisible();
    const cobertos = await page.evaluate(() =>
      [...document.querySelectorAll('.folha button')].filter((b) => {
        const r = b.getBoundingClientRect();
        const topo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !topo?.closest('.folha');
      }).length,
    );
    expect(cobertos).toBe(0);
  });

  test('offline: Copiar continua disponível e os botões de apagar ficam desabilitados', async ({ page }) => {
    await abrir(page);
    await page.context().setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible();
    await segurar(page, balaoMarco(page));
    const f = folha(page);
    await expect(f.getByRole('button', { name: 'Copiar' })).toBeEnabled();
    await expect(f.getByRole('button', { name: 'Apagar mensagem', exact: true })).toBeDisabled();
    await expect(f.getByRole('button', { name: 'Apagar mensagem e resposta' })).toBeDisabled();
    await page.context().setOffline(false);
  });
});

test.describe('Apagar conversa no topo do Chat (2b.6)', () => {
  test('⋯ → Apagar conversa: vai ao Chat vazio, a gaveta não a mostra e, depois de 5 s, o DELETE sai', async ({ page }) => {
    const outra = novaConversa('b', 'Outra conversa', 60 * 5, 'padrao', [['marco', 'oi', 300]]);
    const f = await abrir(page, {}, [conversaA(), outra]);
    await page.getByRole('button', { name: 'Mais opções da conversa' }).click();
    await page.getByRole('menuitem', { name: 'Apagar conversa' }).click();
    await expect(page).toHaveURL(/\/\?nova=1$/);
    await expect(page.locator('.chat-vazio')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nova conversa' })).toBeVisible();
    await expect(page.locator('.toast')).toContainText('Apagado.');
    expect(f.deletes).toEqual([]);

    await page.getByRole('button', { name: 'Histórico' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await expect(gaveta.getByRole('button', { name: /^Outra conversa/ })).toBeVisible();
    await expect(gaveta.getByRole('button', { name: /^Plano do dia/ })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await expect.poll(() => f.deletes, { timeout: 7000 }).toEqual(['a']);
    await page.getByRole('button', { name: 'Histórico' }).click();
    await expect(gaveta.getByRole('button', { name: /^Plano do dia/ })).toHaveCount(0);
    await expect(gaveta.getByRole('button', { name: /^Outra conversa/ })).toBeVisible();
  });

  test('Desfazer traz a conversa de volta e nada é apagado', async ({ page }) => {
    const f = await abrir(page);
    await page.getByRole('button', { name: 'Mais opções da conversa' }).click();
    await page.getByRole('menuitem', { name: 'Apagar conversa' }).click();
    await expect(page.locator('.chat-vazio')).toBeVisible();
    await page.locator('.toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page).toHaveURL(/\/\?c=a$/);
    await expect(page.getByRole('heading', { name: 'Plano do dia' })).toBeVisible();
    await expect(balaoMarco(page)).toHaveText('Oi José');
    await page.waitForTimeout(5600);
    expect(f.deletes).toEqual([]);
  });

  test('voltar à aba Chat nos 5 s não reabre a conversa que está sendo apagada', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Mais opções da conversa' }).click();
    await page.getByRole('menuitem', { name: 'Apagar conversa' }).click();
    await page.getByRole('navigation').getByText('Tarefas', { exact: true }).click();
    await page.getByRole('navigation').getByText('Chat', { exact: true }).click();
    await expect(page.locator('.chat-vazio')).toBeVisible();
    await expect(page.locator('.balao')).toHaveCount(0);
  });

  test('Esc fecha o menu e devolve o foco ao ⋯; tocar fora também fecha; sem conversa aberta não há ⋯', async ({ page }) => {
    await abrir(page);
    const mais = page.getByRole('button', { name: 'Mais opções da conversa' });
    await mais.click();
    await expect(page.getByRole('menuitem', { name: 'Apagar conversa' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem')).toHaveCount(0);
    await expect(mais).toBeFocused();
    await mais.click();
    await page.locator('.chat__mensagens').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('menuitem')).toHaveCount(0);

    await simularChat(page); // outra simulação por cima: Chat vazio
    await page.goto('/?nova=1');
    await expect(page.locator('.chat-vazio')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mais opções da conversa' })).toHaveCount(0);
  });

  test('o item fica desabilitado enquanto o José responde', async ({ page }) => {
    await abrir(page, { atrasoMs: 1500 });
    await page.getByLabel('Mensagem para o José').fill('mais uma');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByText('José está pensando')).toBeVisible();
    await page.getByRole('button', { name: 'Mais opções da conversa' }).click();
    await expect(page.getByRole('menuitem', { name: 'Apagar conversa' })).toBeDisabled();
  });
});

test.describe('Topo do Chat em modo decisão (correção F4)', () => {
  for (const largura of [320, 360, 375, 390, 414, 430]) {
    test(`${largura}px: o título tem pelo menos 140px, o selo fica inteiro numa linha própria e nada passa da largura`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 700 });
      const c = novaConversa('d', 'Decisão sobre a proposta de trabalho', 5, 'decidir', [['marco', 'oi', 5]]);
      await abrir(page, {}, [c]);
      const [titulo] = await medir(page, '.chat__titulo');
      const [selo] = await medir(page, '.chat__selo');
      const [topo] = await medir(page, '.chat__topo');
      expect(titulo!.width, `título em ${largura}px`).toBeGreaterThanOrEqual(140);
      expect(selo!.y, 'selo abaixo da linha do título').toBeGreaterThanOrEqual(titulo!.y + titulo!.height - 0.5);
      expect(selo!.y + selo!.height).toBeLessThanOrEqual(topo!.y + topo!.height + 0.5);
      // o título não é cortado em "N…": mostra pelo menos o começo da frase
      expect(await page.locator('.chat__titulo').evaluate((el) => el.scrollWidth - el.clientWidth < 400)).toBe(true);
      const m = await elementosForaDaTela(page);
      expect(m.rolagem).toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(menoresQue(await medir(page, '.chat__topo button'))).toEqual([]);
    });
  }
});

test.describe('Dois apagamentos seguidos (correção F5)', () => {
  const duas = () => conversaA([['marco', 'Segunda pergunta', 10], ['jose', 'Segunda resposta', 9]]);

  test('o aviso vira "Apagado (2)." e um só Desfazer restaura as duas mensagens', async ({ page }) => {
    const f = await abrir(page, {}, [duas()]);
    await segurar(page, balaoJose(page).first());
    await folha(page).getByRole('button', { name: 'Apagar mensagem', exact: true }).click();
    await expect(page.locator('.toast')).toHaveText(/^Apagado\.\s*Desfazer$/);
    await segurar(page, balaoJose(page).last());
    await folha(page).getByRole('button', { name: 'Apagar mensagem', exact: true }).click();
    await expect(page.locator('.toast')).toHaveText(/^Apagado \(2\)\.\s*Desfazer$/);
    await expect(balaoJose(page)).toHaveCount(0);
    await page.locator('.toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(balaoJose(page)).toHaveText(['Bom dia, Marco.', 'Segunda resposta']);
    await page.waitForTimeout(5600);
    expect(f.deletesMensagem).toEqual([]);
  });

  test('sem Desfazer: o prazo reinicia a cada apagamento e os dois DELETE saem em ordem', async ({ page }) => {
    const f = await abrir(page, {}, [duas()]);
    await segurar(page, balaoJose(page).first());
    await folha(page).getByRole('button', { name: 'Apagar mensagem', exact: true }).click();
    await page.waitForTimeout(2500);
    await segurar(page, balaoJose(page).last());
    await folha(page).getByRole('button', { name: 'Apagar mensagem', exact: true }).click();
    // 1º apagamento há ~3,3 s e 2º há ~0,7 s: ainda nada saiu (o prazo recomeçou no 2º)
    await page.waitForTimeout(3000);
    expect(f.deletesMensagem).toEqual([]);
    await expect.poll(() => f.deletesMensagem.map((d) => d.id), { timeout: 5000 }).toEqual(['a-m1', 'a-m3']);
  });
});

test.describe('Aviso com o teclado aberto (correção F6)', () => {
  test('o aviso fica dentro da área visível e acima do campo de digitação', async ({ page }) => {
    // Simula o teclado do iPhone: a área visível (visualViewport) encolhe 320px e a janela continua do mesmo tamanho.
    await page.addInitScript(() => {
      const vv = window.visualViewport!;
      Object.defineProperty(vv, 'height', { get: () => window.innerHeight - ((window as unknown as { __teclado?: number }).__teclado ?? 0) });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const c = conversaA();
    c.sugestoes = [{ id: 'sg1', mensagem_id: 'a-m1', tipo: 'memoria', conteudo: { texto: 'Acorda às 6h.', area: 'saude' }, status: 'pendente', item_id: null }];
    await abrir(page, {}, [c]);
    await page.getByLabel('Mensagem para o José').focus();
    await page.evaluate(() => {
      (window as unknown as { __teclado: number }).__teclado = 320;
      window.visualViewport!.dispatchEvent(new Event('resize'));
    });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.teclado)).toBe('aberto');
    // toca em Descartar sem tirar o foco do campo (como o iPhone: tocar num botão não fecha o teclado)
    await page.getByRole('button', { name: 'Descartar' }).dispatchEvent('click');
    await expect(page.locator('.toast')).toContainText('Descartado.');
    await page.waitForTimeout(400); // fim da animação de entrada
    const { toast, campo, visivel } = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      return { toast: r('.toast'), campo: r('#campo-mensagem'), visivel: window.visualViewport!.height };
    });
    expect(visivel).toBe(844 - 320);
    expect(toast.bottom, 'base do aviso dentro da área visível').toBeLessThanOrEqual(visivel);
    expect(toast.top).toBeGreaterThanOrEqual(0);
    expect(toast.bottom, 'o aviso não cobre o campo').toBeLessThanOrEqual(campo.top + 0.5);
    expect(campo.bottom).toBeLessThanOrEqual(visivel + 0.5);
  });
});

test.describe('⋯ do mouse (correção F8)', () => {
  for (const largura of [320, 390, 1280]) {
    test(`${largura}px: o ⋯ mede pelo menos 48x48 e não causa rolagem lateral`, async ({ page }, info) => {
      test.skip(info.project.name !== 'computador', 'o ⋯ é só para mouse');
      await page.setViewportSize({ width: largura, height: 700 });
      const longo = `${'Z'.repeat(80)} ${'texto longo '.repeat(20)}`.trim();
      await abrir(page, {}, [conversaA([['marco', longo, 20], ['jose', longo, 19]])]);
      const botoes = await medir(page, '.mensagem__mais');
      expect(botoes.length).toBeGreaterThan(0);
      expect(menoresQue(botoes)).toEqual([]);
      const m = await elementosForaDaTela(page);
      expect(m.rolagem).toBeLessThanOrEqual(m.largura);
      expect(m.fora, JSON.stringify(m.fora)).toEqual([]);
      expect(m.transbordo, JSON.stringify(m.transbordo)).toEqual([]);
    });
  }
});

test.describe('Foco nos menus e depois de apagar (revisão)', () => {
  test('menu ⋯ do topo: abre com o foco no 1º item, setas andam, Esc fecha e devolve o foco ao botão', async ({ page }) => {
    await abrir(page);
    const mais = page.getByRole('button', { name: 'Mais opções da conversa' });
    await mais.click();
    const item = page.getByRole('menuitem', { name: 'Apagar conversa' });
    await expect(item).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(item).toBeFocused(); // um item só: dá a volta nele mesmo
    await page.keyboard.press('ArrowUp');
    await expect(item).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('End');
    await expect(item).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem')).toHaveCount(0);
    await expect(mais).toBeFocused();
  });

  test('menu ⋯ com o item desabilitado (José respondendo): o foco vai ao próprio menu, não ao body', async ({ page }) => {
    await abrir(page, { atrasoMs: 1500 });
    await page.getByLabel('Mensagem para o José').fill('mais uma');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByText('José está pensando')).toBeVisible();
    await page.getByRole('button', { name: 'Mais opções da conversa' }).click();
    await expect(page.getByRole('menu')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Mais opções da conversa' })).toBeFocused();
  });

  test('depois de "Apagar mensagem" o foco vai para o balão vizinho (nunca para o body)', async ({ page }) => {
    await abrir(page, {}, [conversaA([['marco', 'Segunda pergunta', 10], ['jose', 'Segunda resposta', 9]])]);
    await segurar(page, balaoJose(page).first());
    await folha(page).getByRole('button', { name: 'Apagar mensagem', exact: true }).click();
    await expect(balaoJose(page)).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => document.activeElement?.className ?? '')).toContain('balao');
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent ?? '')).toBe('Segunda pergunta');
  });

  test('apagando a última mensagem que sobra, o foco vai ao campo (mouse) ou a "+ Nova" (celular) — não ao body', async ({ page }) => {
    await abrir(page);
    await segurar(page, balaoMarco(page));
    await folha(page).getByRole('button', { name: 'Apagar mensagem e resposta' }).click();
    await expect(page.locator('.balao')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'BODY')).not.toBe('BODY');
    const ativo = await page.evaluate(() => ({ id: document.activeElement?.id, classe: document.activeElement?.className }));
    expect(ativo.id === 'campo-mensagem' || String(ativo.classe).includes('chat__nova')).toBe(true);
  });

  test('depois de "Apagar conversa" o foco vai para "+ Nova"', async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: 'Mais opções da conversa' }).click();
    await page.getByRole('menuitem', { name: 'Apagar conversa' }).click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.className ?? '')).toContain('chat__nova');
  });
});

test.describe('Conversa que fica vazia some junto (pedido do Marco)', () => {
  test('apagar todas as mensagens: Chat vazio na hora; passados os 5 s a conversa some do Histórico, com o aviso "Conversa vazia apagada."', async ({ page }) => {
    const outra = novaConversa('b', 'Outra conversa', 60 * 5, 'padrao', [['marco', 'oi', 300]]);
    const f = await abrir(page, {}, [conversaA(), outra]);
    await segurar(page, balaoMarco(page));
    await folha(page).getByRole('button', { name: 'Apagar mensagem e resposta' }).click();
    // durante os 5 s: estado vazio do Chat (saudação e atalhos), a conversa ainda existe no servidor
    await expect(page.locator('.chat-vazio')).toBeVisible();
    await expect(page.getByRole('button', { name: /Travei/ })).toBeVisible();
    expect(f.conversas.map((c) => c.id)).toContain('a');
    await expect.poll(() => f.deletesMensagem.length, { timeout: 7000 }).toBe(1);
    await expect(page.locator('.toast')).toContainText('Conversa vazia apagada.');
    await expect(page).toHaveURL(/\/\?nova=1$/);
    expect(f.conversas.map((c) => c.id)).toEqual(['b']);
    await page.getByRole('button', { name: 'Histórico' }).click();
    const gaveta = page.getByRole('dialog', { name: 'Histórico de conversas' });
    await expect(gaveta.getByRole('button', { name: /^Outra conversa/ })).toBeVisible();
    await expect(gaveta.getByRole('button', { name: /^Plano do dia/ })).toHaveCount(0);
  });

  test('Desfazer antes dos 5 s traz tudo de volta e a conversa continua', async ({ page }) => {
    const f = await abrir(page);
    await segurar(page, balaoMarco(page));
    await folha(page).getByRole('button', { name: 'Apagar mensagem e resposta' }).click();
    await expect(page.locator('.chat-vazio')).toBeVisible();
    await page.locator('.toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.locator('.chat-vazio')).toHaveCount(0);
    await expect(balaoMarco(page)).toHaveText('Oi José');
    await expect(balaoJose(page)).toHaveText('Bom dia, Marco.');
    await page.waitForTimeout(5600);
    expect(f.deletesMensagem).toEqual([]);
    expect(f.conversas.map((c) => c.id)).toEqual(['a']);
  });

  test('apagar só uma das mensagens não apaga a conversa', async ({ page }) => {
    const f = await abrir(page);
    await segurar(page, balaoJose(page));
    await folha(page).getByRole('button', { name: 'Apagar mensagem', exact: true }).click();
    await expect.poll(() => f.deletesMensagem.length, { timeout: 7000 }).toBe(1);
    await page.waitForTimeout(300);
    expect(f.conversas.map((c) => c.id)).toEqual(['a']);
    await expect(page.locator('.toast')).toHaveCount(0);
    await expect(balaoMarco(page)).toHaveText('Oi José');
  });

  test('se o Marco já foi para outra aba, a conversa vazia é apagada sem puxá-lo de volta ao Chat', async ({ page }) => {
    const f = await abrir(page);
    await segurar(page, balaoMarco(page));
    await folha(page).getByRole('button', { name: 'Apagar mensagem e resposta' }).click();
    await page.getByRole('navigation').getByText('Tarefas', { exact: true }).click();
    await expect.poll(() => f.deletesMensagem.length, { timeout: 7000 }).toBe(1);
    await expect(page).toHaveURL(/\/tarefas/);
    expect(f.conversas).toEqual([]);
  });
});
