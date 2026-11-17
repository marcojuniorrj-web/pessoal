import { describe, expect, it } from 'vitest';
import { criarAssetsEmbutidos } from './assets-embutidos';

const b64 = (s: string) => btoa(s);
const assets = criarAssetsEmbutidos({
  '/index.html': { tipo: 'text/html; charset=utf-8', base64: b64('<html>app</html>') },
  '/assets/app-abc.js': { tipo: 'text/javascript; charset=utf-8', base64: b64('console.log(1)') },
  '/sw.js': { tipo: 'text/javascript; charset=utf-8', base64: b64('self') },
});
const pedir = (caminho: string, metodo = 'GET') => assets.fetch(new Request(`https://x.dev${caminho}`, { method: metodo }));

describe('assets embutidos (modo SPA)', () => {
  it('serve / como index.html sem cache', async () => {
    const r = await pedir('/');
    expect(r.status).toBe(200);
    expect(await r.text()).toBe('<html>app</html>');
    expect(r.headers.get('cache-control')).toBe('no-cache');
    expect(r.headers.get('content-type')).toContain('text/html');
  });
  it('serve arquivo com hash como imutável', async () => {
    const r = await pedir('/assets/app-abc.js');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toContain('immutable');
  });
  it('service worker nunca fica em cache', async () => {
    expect((await pedir('/sw.js')).headers.get('cache-control')).toBe('no-cache');
  });
  it('rota do app cai no index.html (SPA)', async () => {
    const r = await pedir('/tarefas');
    expect(r.status).toBe(200);
    expect(await r.text()).toBe('<html>app</html>');
  });
  it('arquivo com extensão inexistente é 404', async () => {
    expect((await pedir('/nao-existe.png')).status).toBe(404);
  });
  it('rejeita métodos de escrita e HEAD não tem corpo', async () => {
    expect((await pedir('/', 'POST')).status).toBe(405);
    const h = await pedir('/', 'HEAD');
    expect(h.status).toBe(200);
    expect(await h.text()).toBe('');
  });
});
