// Roda os casos golden no Haiku de verdade e confere cada resposta. Uso: npm run golden
// Precisa de ANTHROPIC_API_KEY no ambiente (nunca no código). Custa centavos de dólar.
import { montarContexto } from '../../modulos/conversas/contexto';
import { criarClienteClaude } from './claude';
import { avaliarCaso, CASOS_GOLDEN } from './golden';
import { prompt } from './prompt';
import type { EventoIA } from './tipos';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Falta ANTHROPIC_API_KEY. Exemplo: ANTHROPIC_API_KEY=sk-ant-... npm run golden');
  process.exit(2);
}
const modelo = process.env.MODELO_PADRAO || 'claude-haiku-5-5';
const ia = criarClienteClaude({ apiKey });
// Igual ao app na onda 4: só a ferramenta de memória está ligada.
const LIGADAS = ['memoria'] as const;

let reprovados = 0;
for (const caso of CASOS_GOLDEN) {
  const contexto = montarContexto({
    prompt,
    sugestoes: [...LIGADAS],
    modo: caso.modo ?? (caso.id === 'decisao' ? 'decidir' : 'padrao'),
    memorias: caso.memorias.map((m) => (typeof m === 'string' ? { texto: m, area: 'sobre_mim' as const } : m)),
    metas: caso.metas.map((titulo) => ({ titulo, area: 'trabalho' as const, prazo: null })),
    tarefas: caso.tarefas.map((titulo) => ({ titulo, area: 'trabalho' as const, prazo: null })),
    agora: new Date(caso.agora),
    mensagens: [{ autor: 'marco', texto: caso.mensagem }],
  });
  let texto = '';
  const sugestoes: Array<{ nome: string; entrada: unknown }> = [];
  for await (const ev of ia.transmitir({ modelo, maxTokens: 1500, esforco: 'low', ferramentas: [...LIGADAS], ...contexto }) as AsyncIterable<EventoIA>) {
    if (ev.tipo === 'texto') texto += ev.delta;
    else if (ev.tipo === 'sugestao') sugestoes.push({ nome: ev.nome, entrada: ev.entrada });
  }
  const r = avaliarCaso(caso, { texto, sugestoes });
  if (!r.ok) reprovados++;
  console.log(`\n=== ${caso.momento} [${r.ok ? 'OK' : 'REPROVADO'}] ===`);
  console.log(`Marco: ${caso.mensagem}`);
  console.log(`José (${r.linhas} linhas):\n${texto}`);
  for (const s of sugestoes) console.log(`  🧠 ${s.nome}: ${JSON.stringify(s.entrada)}`);
  if (!r.ok) console.log(`Falhas: ${r.falhas.join('; ')}`);
}
console.log(`\n${CASOS_GOLDEN.length - reprovados}/${CASOS_GOLDEN.length} casos dentro das regras. Mostre o resultado ao Marco para revisar o tom.`);
process.exit(reprovados ? 1 : 0);
