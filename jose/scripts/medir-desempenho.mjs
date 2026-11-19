// Mede o tempo até o campo de texto do Chat ficar utilizável, com CPU e rede de celular simulados (tarefa 7.6).
// Serve app/dist com gzip (como o Cloudflare), simula a API com 300 ms de ida e volta e usa Chromium com
// throttling: rede "Slow 4G" (1,6 Mbps, 150 ms) e CPU 4x mais lenta. Nada toca em banco, servidor ou site reais.
// Uso: npm run build && node scripts/medir-desempenho.mjs   (CHROME_PATH aponta um Chrome já instalado)
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../app/dist', import.meta.url));
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const comprimiveis = new Set(['.html', '.js', '.css', '.webmanifest', '.svg']);
let bytesGzip = 0;

const servidor = createServer((req, res) => {
  let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let arquivo = join(dist, caminho);
  if (!existsSync(arquivo) || statSync(arquivo).isDirectory()) arquivo = join(dist, 'index.html');
  const ext = extname(arquivo);
  let corpo = readFileSync(arquivo);
  const cab = { 'content-type': tipos[ext] ?? 'application/octet-stream', 'cache-control': caminho === '/sw.js' || ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable' };
  if (comprimiveis.has(ext)) { corpo = gzipSync(corpo); cab['content-encoding'] = 'gzip'; }
  bytesGzip += corpo.length;
  res.writeHead(200, cab);
  res.end(corpo);
});
await new Promise((ok) => servidor.listen(0, ok));
const base = `http://localhost:${servidor.address().port}`;

const EU = { nome: 'Marco', email: 'marco@gmail.com', foto_url: null, boas_vindas_concluida: true, fuso_horario: 'America/Sao_Paulo' };
const RTT_API = 300; // ms: ida e volta de uma API real num celular

async function medir(cpu, repeticoes) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const saida = { frio: [], instalado: [], bytesFrio: 0 };
  for (let i = 0; i < repeticoes; i++) {
    const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await contexto.newPage();
    await page.route('**/api/eu', async (r) => { await new Promise((ok) => setTimeout(ok, RTT_API)); await r.fulfill({ json: EU }); });
    await page.route('**/api/conversas/hoje', async (r) => { await new Promise((ok) => setTimeout(ok, RTT_API)); await r.fulfill({ json: null }); });
    const cdp = await contexto.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });

    const usavel = async () => {
      const t0 = Date.now();
      await page.getByLabel('Mensagem para o José').waitFor({ state: 'visible', timeout: 60000 });
      await page.waitForFunction(() => { const el = document.querySelector('textarea'); return el && !el.disabled; }, null, { timeout: 60000 });
      return Date.now() - t0;
    };
    // 1ª visita: sem cache e sem service worker.
    bytesGzip = 0;
    const ini1 = Date.now();
    await page.goto(base + '/', { waitUntil: 'commit' });
    await usavel();
    saida.frio.push(Date.now() - ini1);
    saida.bytesFrio = bytesGzip;
    // App "instalado": service worker ativo e casca em cache; reabre o app.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.waitForTimeout(1500);
    const ini2 = Date.now();
    await page.goto(base + '/', { waitUntil: 'commit' });
    await usavel();
    saida.instalado.push(Date.now() - ini2);
    await contexto.close();
  }
  await browser.close();
  return saida;
}
const mediana = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
for (const cpu of [4, 6]) {
  const r = await medir(cpu, 5);
  console.log(`CPU ${cpu}x, Slow 4G, API ${RTT_API} ms: 1ª visita mediana ${mediana(r.frio)} ms (${r.frio.join('/')}), transferido ${(r.bytesFrio / 1024).toFixed(0)} KB gzip; app instalado mediana ${mediana(r.instalado)} ms (${r.instalado.join('/')})`);
}
servidor.close();
