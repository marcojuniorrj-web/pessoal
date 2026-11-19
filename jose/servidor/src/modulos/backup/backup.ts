// Backup semanal automático: dump do D1 gravado no R2 (Cron Trigger do Worker).
import type { Ambiente } from '../../ambiente';
import { gerarDump } from './dump';

export const PREFIXO = 'backups/';
export const COPIAS_MANTIDAS = 8;
const FUSO = 'America/Sao_Paulo';

/** Data AAAA-MM-DD no fuso de São Paulo. */
export function dataSaoPaulo(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

const NOME_COPIA = /^backups\/jose-\d{4}-\d{2}-\d{2}\.sql$/;

/** Lista todas as chaves com o prefixo (a listagem do R2 é paginada). */
async function listarChaves(bucket: R2Bucket): Promise<string[]> {
  const chaves: string[] = [];
  let cursor: string | undefined;
  do {
    const pagina = await bucket.list({ prefix: PREFIXO, cursor });
    chaves.push(...pagina.objects.map((o) => o.key));
    cursor = pagina.truncated ? pagina.cursor : undefined;
  } while (cursor);
  return chaves;
}

/**
 * Grava backups/jose-AAAA-MM-DD.sql e mantém só as 8 cópias mais recentes.
 * Os logs não levam conteúdo do banco: só tamanho, contagens e o tipo do erro.
 */
export async function executarBackup(env: Pick<Ambiente, 'DB' | 'BACKUPS'>, agora: Date = new Date()): Promise<void> {
  if (!env.BACKUPS) {
    console.error('backup sem destino', { motivo: 'binding BACKUPS ausente (ative o R2 e crie o bucket jose-backups)' });
    return;
  }
  try {
    const dump = await gerarDump(env.DB);
    const chave = `${PREFIXO}jose-${dataSaoPaulo(agora)}.sql`;
    const bytes = new TextEncoder().encode(dump.sql).byteLength;
    await env.BACKUPS.put(chave, dump.sql, { httpMetadata: { contentType: 'application/sql; charset=utf-8' } });

    // Os nomes têm a data, então a ordem alfabética é a cronológica.
    const copias = (await listarChaves(env.BACKUPS)).filter((k) => NOME_COPIA.test(k)).sort();
    const antigas = copias.slice(0, Math.max(0, copias.length - COPIAS_MANTIDAS));
    if (antigas.length > 0) await env.BACKUPS.delete(antigas);
    console.log('backup ok', { bytes, tabelas: dump.tabelas, linhas: dump.linhas, copias: copias.length - antigas.length });
  } catch (e) {
    console.error('backup falhou', { tipo: e instanceof Error ? e.name : typeof e });
    throw e;
  }
}
