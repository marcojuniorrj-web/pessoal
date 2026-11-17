import type { Page } from '@playwright/test';

export const EU = { nome: 'Marco', email: 'marco@gmail.com', foto_url: null, boas_vindas_concluida: true };

/** Simula a API: logado (200) ou sessão expirada (401). */
export async function simularApi(page: Page, logado = true) {
  await page.route('**/api/eu', (rota) =>
    logado
      ? rota.fulfill({ status: 200, json: EU })
      : rota.fulfill({ status: 401, json: { erro: { codigo: 'nao_autenticado', mensagem: 'Entre de novo' } } }),
  );
}
