import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { criarD1Simulado } from '../testes/d1-simulado';

// Roda servidor/scripts/metricas.sql num banco em memória com dados conhecidos e confere os números.
const SQL = readFileSync(new URL('./metricas.sql', import.meta.url), 'utf8');
const consultas = SQL.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').split(/;\s*\n/).map((c) => c.trim()).filter(Boolean);

type Linha = Record<string, unknown>;
async function rodar(db: ReturnType<typeof criarD1Simulado>): Promise<Linha[][]> {
  const saidas: Linha[][] = [];
  for (const c of consultas) saidas.push((await db.prepare(c).all<Linha>()).results);
  return saidas;
}

const diaSP = (deslocamento: number) => {
  const d = new Date(Date.now() - 3 * 3600_000 + deslocamento * 86400_000); // data de hoje em São Paulo (UTC-3) ± dias
  return d.toISOString().slice(0, 10);
};

async function usuario(db: ReturnType<typeof criarD1Simulado>, id = 'u1', fuso = 'America/Sao_Paulo') {
  await db.prepare('INSERT INTO usuarios(id,email,nome,fuso_horario,criado_em) VALUES(?,?,?,?,?)').bind(id, `${id}@x.com`, id, fuso, '2026-01-01T00:00:00Z').run();
  await db.prepare("INSERT INTO conversas(id,usuario_id,tipo,criada_em,atualizada_em) VALUES(?,?,'normal','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')").bind(`c-${id}`, id).run();
  return `c-${id}`;
}
let seq = 0;
const msg = (db: ReturnType<typeof criarD1Simulado>, conv: string, autor: 'marco' | 'jose', criada: string, extra: { modelo?: string; e?: number; s?: number; c?: number } = {}) =>
  db
    .prepare('INSERT INTO mensagens(id,conversa_id,autor,texto,origem,modelo,tokens_entrada,tokens_saida,tokens_cache,criada_em) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(`m${++seq}`, conv, autor, 'x', 'texto', extra.modelo ?? null, extra.e ?? null, extra.s ?? null, extra.c ?? null, criada)
    .run();

describe('metricas.sql', () => {
  it('o script tem as 4 consultas', () => {
    expect(consultas).toHaveLength(4);
  });

  it('banco vazio: tudo zerado, sem erro', async () => {
    const db = criarD1Simulado();
    const [dias, sug, tar, tok] = await rodar(db);
    expect(dias).toEqual([]);
    expect(sug![0]).toMatchObject({ salvas: 0, descartadas: 0, pendentes: 0, taxa_salvas_pct: null });
    expect(tar).toEqual([]);
    expect(tok).toEqual([]);
  });

  it('dias ativos seguidos: sequência atual, maior sequência e total, no fuso de São Paulo', async () => {
    const db = criarD1Simulado();
    const conv = await usuario(db);
    // Ativos (às 12h de SP = 15h UTC): hoje, ontem, anteontem (sequência atual = 3) e de -10 a -6 (5 seguidos); -3 e -4 vazios.
    for (const d of [0, -1, -2, -6, -7, -8, -9, -10]) await msg(db, conv, 'marco', `${diaSP(d)}T15:00:00.000Z`);
    // Mais de uma mensagem no mesmo dia não conta duas vezes.
    await msg(db, conv, 'marco', `${diaSP(0)}T16:00:00.000Z`);
    // 23h30 de SP no dia -20 é 02h30 UTC do dia -19: no fuso de SP é o dia -20.
    await msg(db, conv, 'marco', `${diaSP(-19)}T02:30:00.000Z`);
    // Mensagens do José não contam como dia ativo.
    await msg(db, conv, 'jose', `${diaSP(-4)}T15:00:00.000Z`, { modelo: 'm' });
    const [dias] = await rodar(db);
    expect(dias).toEqual([{ metrica: 'dias ativos seguidos', dias_ativos_total: 9, sequencia_atual: 3, maior_sequencia: 5, ultimo_dia_ativo: diaSP(0) }]);
  });

  it('a sequência atual continua valendo se hoje ainda não teve mensagem (até ontem), e zera depois disso', async () => {
    const db = criarD1Simulado();
    const conv = await usuario(db);
    for (const d of [-1, -2, -3, -4]) await msg(db, conv, 'marco', `${diaSP(d)}T15:00:00.000Z`);
    expect((await rodar(db))[0]![0]).toMatchObject({ sequencia_atual: 4, maior_sequencia: 4 });
    const db2 = criarD1Simulado();
    const conv2 = await usuario(db2);
    for (const d of [-2, -3]) await msg(db2, conv2, 'marco', `${diaSP(d)}T15:00:00.000Z`);
    expect((await rodar(db2))[0]![0]).toMatchObject({ sequencia_atual: 0, maior_sequencia: 2 });
  });

  it('taxa de sugestões salvas = salvas ÷ (salvas + descartadas); pendentes ficam de fora', async () => {
    const db = criarD1Simulado();
    const conv = await usuario(db);
    await msg(db, conv, 'jose', '2026-11-10T15:00:00Z', { modelo: 'm' });
    const mid = `m${seq}`;
    const status = ['salva', 'salva', 'salva', 'descartada', 'pendente', 'pendente'];
    for (const [i, st] of status.entries()) {
      await db.prepare("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,status,criada_em) VALUES(?,?,'memoria','{}',?,'2026-11-10T15:00:00Z')").bind(`s${i}`, mid, st).run();
    }
    const [, sug] = await rodar(db);
    expect(sug![0]).toEqual({ metrica: 'sugestoes salvas', salvas: 3, descartadas: 1, pendentes: 2, taxa_salvas_pct: 75 });
  });

  it('tarefas concluídas por semana (segunda a domingo, dia local de São Paulo); pendentes não contam', async () => {
    const db = criarD1Simulado();
    await usuario(db);
    const t = (id: string, concluida: number, em: string | null) =>
      db.prepare("INSERT INTO tarefas(id,usuario_id,titulo,area,concluida,concluida_em,origem,criada_em) VALUES(?, 'u1','t','casa',?,?, 'manual','2026-11-01T00:00:00Z')").bind(id, concluida, em).run();
    await t('a', 1, '2026-11-09T15:00:00Z'); // segunda 09/11
    await t('b', 1, '2026-11-15T20:00:00Z'); // domingo 15/11 17h SP (ainda a semana de 09/11)
    await t('c', 1, '2026-11-16T01:00:00Z'); // domingo 15/11 22h em SP (semana de 09/11), já segunda em UTC
    await t('d', 1, '2026-11-16T15:00:00Z'); // segunda 16/11
    await t('e', 1, '2026-11-18T15:00:00Z'); // quarta 18/11
    await t('f', 0, null); // pendente
    const [, , semanas] = await rodar(db);
    expect(semanas).toEqual([
      { semana_comeca_em: '2026-11-16', tarefas_concluidas: 2 },
      { semana_comeca_em: '2026-11-09', tarefas_concluidas: 3 },
    ]);
  });

  it('tokens por modelo por dia (dia local), só respostas do José', async () => {
    const db = criarD1Simulado();
    const conv = await usuario(db);
    await msg(db, conv, 'jose', '2026-11-18T15:00:00Z', { modelo: 'claude-haiku-5-5', e: 100, s: 20, c: 1000 });
    await msg(db, conv, 'jose', '2026-11-18T16:00:00Z', { modelo: 'claude-haiku-5-5', e: 50, s: 10, c: 0 });
    await msg(db, conv, 'jose', '2026-11-18T17:00:00Z', { modelo: 'claude-sonnet-5-5', e: 300, s: 200, c: 500 });
    await msg(db, conv, 'jose', '2026-11-19T01:30:00Z', { modelo: 'claude-haiku-5-5', e: 7, s: 3, c: 2 }); // ainda 18/11 em SP
    await msg(db, conv, 'jose', '2026-11-19T15:00:00Z', { modelo: 'claude-haiku-5-5', e: 1, s: 1, c: 1 });
    await msg(db, conv, 'marco', '2026-11-18T15:00:00Z'); // do Marco: ignorada
    const [, , , tok] = await rodar(db);
    expect(tok).toEqual([
      { dia: '2026-11-19', modelo: 'claude-haiku-5-5', respostas: 1, tokens_entrada: 1, tokens_cache: 1, tokens_saida: 1 },
      { dia: '2026-11-18', modelo: 'claude-haiku-5-5', respostas: 3, tokens_entrada: 157, tokens_cache: 1002, tokens_saida: 33 },
      { dia: '2026-11-18', modelo: 'claude-sonnet-5-5', respostas: 1, tokens_entrada: 300, tokens_cache: 500, tokens_saida: 200 },
    ]);
  });
});
