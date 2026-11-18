// Roda os casos golden no Haiku de verdade e confere cada resposta. Uso: npm run golden
// Precisa de ANTHROPIC_API_KEY no ambiente (nunca no código). Custa centavos de dólar.
import { ordenarPendentes } from '@compartilhado/ordenacao';
import { montarContexto } from '../../modulos/conversas/contexto';
import { criarClienteClaude } from './claude';
import { avaliarCaso, CASOS_GOLDEN, SUGESTOES_LIGADAS } from './golden';
import { prompt } from './prompt';
import type { EventoIA, TipoSugestao } from './tipos';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Falta ANTHROPIC_API_KEY. Exemplo: ANTHROPIC_API_KEY=sk-ant-... npm run golden');
  process.exit(2);
}
const modelo = process.env.MODELO_PADRAO || 'claude-haiku-5-5';
const ia = criarClienteClaude({ apiKey });
// Igual ao app na onda 5: memória, tarefa e meta ligadas.
const LIGADAS = SUGESTOES_LIGADAS;
const SO_MEMORIA: TipoSugestao[] = ['memoria'];
const ICONE = { sugerir_memoria: '🧠', sugerir_tarefa: '📌', sugerir_meta: '🎯' } as Record<string, string>;

let reprovados = 0;
for (const caso of CASOS_GOLDEN) {
  const agora = new Date(caso.agora);
  // Tarefas como o app as manda: pendentes na ordem da regra 5 (a ordem listada no caso desempata).
  const tarefas = ordenarPendentes(
    caso.tarefas.map((t, i) => {
      const o = typeof t === 'string' ? { titulo: t } : t;
      return { titulo: o.titulo, area: o.area ?? ('trabalho' as const), prazo: o.prazo ?? null, criada_em: new Date(agora.getTime() - i * 1000).toISOString() };
    }),
    agora,
  );
  const contexto = montarContexto({
    prompt,
    sugestoes: [...(caso.boasVindas ? SO_MEMORIA : LIGADAS)],
    boasVindas: !!caso.boasVindas,
    modo: caso.modo ?? (caso.id === 'decisao' ? 'decidir' : 'padrao'),
    memorias: caso.memorias.map((m) => (typeof m === 'string' ? { texto: m, area: 'sobre_mim' as const } : m)),
    metas: caso.metas.map((titulo) => ({ titulo, area: 'trabalho' as const, prazo: null })),
    tarefas,
    agora,
    mensagens: [...(caso.historico ?? []), { autor: 'marco', texto: caso.mensagem }],
  });
  let texto = '';
  const sugestoes: Array<{ nome: string; entrada: unknown }> = [];
  for await (const ev of ia.transmitir({ modelo, maxTokens: 1500, esforco: 'low', ferramentas: [...(caso.boasVindas ? SO_MEMORIA : LIGADAS)], ...contexto }) as AsyncIterable<EventoIA>) {
    if (ev.tipo === 'texto') texto += ev.delta;
    else if (ev.tipo === 'sugestao') sugestoes.push({ nome: ev.nome, entrada: ev.entrada });
  }
  const r = avaliarCaso(caso, { texto, sugestoes });
  if (!r.ok) reprovados++;
  console.log(`\n=== ${caso.momento} [${r.ok ? 'OK' : 'REPROVADO'}] ===`);
  console.log(`Marco: ${caso.mensagem}`);
  console.log(`José (${r.linhas} linhas):\n${texto}`);
  for (const s of sugestoes) console.log(`  ${ICONE[s.nome] ?? '?'} ${s.nome}: ${JSON.stringify(s.entrada)}`);
  if (!r.ok) console.log(`Falhas: ${r.falhas.join('; ')}`);
}
console.log(`\n${CASOS_GOLDEN.length - reprovados}/${CASOS_GOLDEN.length} casos dentro das regras. Mostre o resultado ao Marco para revisar o tom.`);
process.exit(reprovados ? 1 : 0);
