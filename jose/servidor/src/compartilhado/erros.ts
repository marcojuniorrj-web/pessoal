import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Erro de API no formato `{ erro: { codigo, mensagem } }` (arquitetura.md §5). */
export class ErroApi extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export const naoAutenticado = () => new ErroApi(401, 'nao_autenticado', 'Entre de novo para continuar.');
export const origemInvalida = () => new ErroApi(403, 'origem_invalida', 'Origem não permitida.');
export const naoEncontrado = () => new ErroApi(404, 'nao_encontrado', 'Não encontrado.');
export const requisicaoInvalida = (mensagem: string) => new ErroApi(400, 'requisicao_invalida', mensagem);

/** Trata erros da API no formato padrão, sem vazar detalhes internos nem conteúdo. */
export function tratarErro(e: Error, c: import('hono').Context) {
  if (e instanceof ErroApi) return c.json({ erro: { codigo: e.codigo, mensagem: e.message } }, e.status);
  console.error('erro interno', e.name);
  return c.json({ erro: { codigo: 'erro_interno', mensagem: 'Algo deu errado. Tente de novo.' } }, 500);
}
