// Roda os 4 casos golden no Haiku de verdade e confere cada resposta. Uso: npm run golden
// Precisa de ANTHROPIC_API_KEY no ambiente (nunca no código). Custa centavos de dólar.
import { montarContexto } from '../../modulos/conversas/contexto';
import { criarClienteClaude } from './claude';
import { avaliarResposta, CASOS_GOLDEN } from './golden';
import { prompt } from './prompt';
import { coletarTexto } from './tipos';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Falta ANTHROPIC_API_KEY. Exemplo: ANTHROPIC_API_KEY=sk-ant-... npm run golden');
  process.exit(2);
}
const modelo = process.env.MODELO_PADRAO || 'claude-haiku-5-5';
const ia = criarClienteClaude({ apiKey });

let reprovados = 0;
for (const caso of CASOS_GOLDEN) {
  const contexto = montarContexto({
    prompt,
    sugestoes: false,
    modo: caso.modo ?? (caso.id === 'decisao' ? 'decidir' : 'padrao'),
    memorias: caso.memorias.map((texto) => ({ texto, area: 'sobre_mim' as const })),
    metas: caso.metas.map((titulo) => ({ titulo, area: 'trabalho' as const, prazo: null })),
    tarefas: caso.tarefas.map((titulo) => ({ titulo, area: 'trabalho' as const, prazo: null })),
    agora: new Date(caso.agora),
    mensagens: [{ autor: 'marco', texto: caso.mensagem }],
  });
  const texto = await coletarTexto(ia.transmitir({ modelo, maxTokens: 600, esforco: 'low', ...contexto }));
  const r = avaliarResposta(texto);
  if (!r.ok) reprovados++;
  console.log(`\n=== ${caso.momento} [${r.ok ? 'OK' : 'REPROVADO'}] ===`);
  console.log(`Marco: ${caso.mensagem}`);
  console.log(`José (${r.linhas} linhas):\n${texto}`);
  if (!r.ok) console.log(`Falhas: ${r.falhas.join('; ')}`);
}
console.log(`\n${CASOS_GOLDEN.length - reprovados}/${CASOS_GOLDEN.length} casos dentro das regras. Mostre o resultado ao Marco para revisar o tom.`);
process.exit(reprovados ? 1 : 0);
