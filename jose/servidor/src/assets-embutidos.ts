// Serve o app (build do Vite) a partir de arquivos embutidos no próprio Worker.
// Usado só no deploy "embutido" (scripts/deploy-embutido.mjs), quando o upload de
// assets do wrangler não está disponível. Imita o `[assets]` em modo SPA.

export type ArquivoEmbutido = { tipo: string; base64: string };
export type ArquivosEmbutidos = Record<string, ArquivoEmbutido>;

const SEM_CACHE = 'no-cache';
const IMUTAVEL = 'public, max-age=31536000, immutable';

function decodificar(base64: string): ArrayBuffer {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

export function criarAssetsEmbutidos(arquivos: ArquivosEmbutidos): { fetch(req: Request): Promise<Response> } {
  return {
    async fetch(req: Request): Promise<Response> {
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Método não permitido', { status: 405 });
      const caminho = decodeURIComponent(new URL(req.url).pathname);
      let chave = caminho === '/' ? '/index.html' : caminho;
      let arq = arquivos[chave];
      let fallback = false;
      if (!arq) {
        // Modo SPA: rota do app (ex.: /tarefas) devolve o index.html.
        // Arquivo com extensão que não existe é 404 de verdade.
        if (/\.[a-z0-9]+$/i.test(caminho)) return new Response('Não encontrado', { status: 404 });
        chave = '/index.html';
        arq = arquivos[chave];
        fallback = true;
      }
      if (!arq) return new Response('Não encontrado', { status: 404 });
      const cache = !fallback && chave.startsWith('/assets/') ? IMUTAVEL : SEM_CACHE;
      const corpo = req.method === 'HEAD' ? null : decodificar(arq.base64);
      return new Response(corpo, { headers: { 'content-type': arq.tipo, 'cache-control': cache } });
    },
  };
}
