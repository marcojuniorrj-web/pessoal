import type { MiddlewareHandler } from 'hono';

/**
 * Cabeçalhos de segurança das respostas de /api e /auth (dados sensíveis): nunca ficam em cache de navegador ou
 * intermediário, o navegador não adivinha o tipo do conteúdo, nenhuma URL do app vaza como Referer e nada pode ser
 * embutido em outro site.
 */
export const cabecalhosDeSeguranca: MiddlewareHandler = async (c, next) => {
  await next();
  // Depois da rota: o fluxo SSE do Hono define "no-cache" por conta própria e precisa ser trocado por "no-store".
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Frame-Options', 'DENY');
};
