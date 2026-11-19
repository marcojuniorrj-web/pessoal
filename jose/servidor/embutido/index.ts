// Ponto de entrada do deploy "embutido": o mesmo app, com os arquivos da interface
// dentro do Worker (no lugar do binding [assets]). Fora do tsc/vitest de propósito:
// o arquivo ./arquivos.gerado.ts só existe depois de scripts/deploy-embutido.mjs.
import { app, aoAgendar } from '../src/index';
import type { Ambiente } from '../src/ambiente';
import { criarAssetsEmbutidos } from '../src/assets-embutidos';
// @ts-ignore gerado no deploy
import { arquivos } from './arquivos.gerado';

const assets = criarAssetsEmbutidos(arquivos);

export default {
  fetch(req: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    return app.fetch(req, { ...env, ASSETS: assets }, ctx);
  },
  // Cron semanal (backup do D1 no R2): mesmo handler do index.ts.
  scheduled(evento: ScheduledController, env: Record<string, unknown>, ctx: ExecutionContext) {
    return aoAgendar(evento, env as unknown as Ambiente, ctx);
  },
} satisfies ExportedHandler<Record<string, unknown>>;
