import { expect, test, type Page } from '@playwright/test';
import { simularApi, simularChat, simularMemorias, simularTarefas, type MemoriaFalsa } from './apoio';

// Jornadas que atravessam telas (histórias 4, 5 e 6): o que nasce no Chat chega às listas e dá para controlar lá.
// A API é simulada; o servidor real é coberto pelos testes de rotas (contexto da IA, posse, salvar sugestão).
async function enviar(page: Page, texto: string) {
  await page.getByLabel('Mensagem para o José').fill(texto);
  await page.getByRole('button', { name: 'Enviar' }).click();
}

test.describe('Histórias 4, 5 e 6 de ponta a ponta (Chat → listas)', () => {
  test('memória: o José sugere no Chat, o Marco salva, ela aparece em José sabe e pode ser apagada com Desfazer', async ({ page }) => {
    await simularApi(page);
    const chat = await simularChat(page, { sugerir: [{ texto: 'Acorda às 6h.', area: 'saude' }] });
    const memorias = await simularMemorias(page);
    // Salvar no servidor real cria a memória; aqui o simulador do Chat não conhece a lista, então fazemos o mesmo.
    await page.route('**/api/sugestoes/*/salvar', (rota) => {
      const m: MemoriaFalsa = { id: 'm-novo', texto: 'Acorda às 6h.', area: 'saude', origem: 'chat', criada_em: new Date().toISOString(), atualizada_em: null };
      memorias.memorias.push(m);
      return rota.fulfill({ status: 200, json: { item: m } });
    });
    await page.goto('/');
    await enviar(page, 'eu acordo às 6h');
    const cartao = page.getByRole('article', { name: 'Memória sugerida' });
    await expect(cartao).toContainText('Acorda às 6h.');
    await page.waitForTimeout(500);
    expect(memorias.memorias).toEqual([]); // nada é salvo sem o toque do Marco
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    await page.getByRole('link', { name: '✓ Salvo em José sabe' }).click();
    await expect(page).toHaveURL(/\/jose-sabe$/);
    await expect(page.getByRole('region', { name: 'Saúde e rotina' }).getByText('Acorda às 6h.')).toBeVisible();

    await page.getByRole('button', { name: 'Mais opções de Acorda às 6h.' }).click();
    await page.getByRole('menuitem', { name: 'Apagar' }).click();
    await expect(page.getByText('Acorda às 6h.')).toHaveCount(0);
    await page.locator('.toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByText('Acorda às 6h.')).toBeVisible();
    expect(memorias.deletes).toEqual([]);
  });

  test('tarefa: o José sugere no Chat, o Marco salva, ela aparece em Tarefas e é concluída com Desfazer', async ({ page }) => {
    await simularApi(page);
    await simularChat(page, { sugerir: [{ tipo: 'tarefa', titulo: 'Responder a proposta', area: 'trabalho', prazo: null }] });
    const lista = await simularTarefas(page);
    await page.route('**/api/sugestoes/*/salvar', (rota) => {
      const t = { id: 't-novo', titulo: 'Responder a proposta', area: 'trabalho', prazo: null, concluida: false, concluida_em: null, origem: 'chat' as const, criada_em: new Date().toISOString() };
      lista.tarefas.push(t);
      return rota.fulfill({ status: 200, json: { item: t } });
    });
    await page.goto('/');
    await enviar(page, 'preciso responder a proposta');
    const cartao = page.getByRole('article', { name: 'Tarefa sugerida' });
    await expect(cartao).toContainText('Responder a proposta');
    expect(lista.tarefas).toEqual([]);
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    await page.getByRole('link', { name: '✓ Salvo em Tarefas' }).click();
    await expect(page).toHaveURL(/\/tarefas/);
    const item = page.locator('.item', { hasText: 'Responder a proposta' });
    await expect(item).toBeVisible();
    await page.getByRole('button', { name: 'Concluir: Responder a proposta' }).click();
    await expect(page.locator('.toast')).toContainText('Feito!');
    await page.locator('.toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByRole('list', { name: /pendentes/ }).getByText('Responder a proposta')).toBeVisible();
    expect(lista.chamadas.filter((c) => c.metodo === 'PATCH').map((c) => c.corpo)).toEqual([{ concluida: true }, { concluida: false }]);
  });
});
