-- Métricas do José (dados.md, "Métricas"). Só lê o banco; não grava nada.
-- Rodar:  npx wrangler d1 execute jose --remote --config servidor/wrangler.toml --file servidor/scripts/metricas.sql
-- (para testar num banco local: troque --remote por --local e use --config servidor/wrangler.dev.toml)
--
-- Fuso: o SQLite não conhece fusos nomeados. Como na migração 0002, America/Sao_Paulo vale UTC-3 (sem horário de verão
-- desde 2019) e qualquer outro fuso é tratado como UTC.
-- Cada consulta abaixo é independente e devolve uma tabela; o wrangler imprime as 4 em sequência.

-- 1) DIAS ATIVOS SEGUIDOS. Dia ativo = pelo menos 1 mensagem do Marco no dia local (inclui as respostas das boas-vindas).
--    sequencia_atual conta os dias seguidos até hoje (ou até ontem, se hoje ainda não teve mensagem). Meta: 30 seguidos.
--    Mensagens apagadas pelo Marco não existem mais no banco, então o dia delas deixa de contar.
WITH ativos AS (
  SELECT DISTINCT c.usuario_id,
         date(m.criada_em, CASE u.fuso_horario WHEN 'America/Sao_Paulo' THEN '-3 hours' ELSE '+0 hours' END) AS dia
  FROM mensagens m
  JOIN conversas c ON c.id = m.conversa_id
  JOIN usuarios u ON u.id = c.usuario_id
  WHERE m.autor = 'marco'
),
numerados AS (
  SELECT usuario_id, dia, julianday(dia) - ROW_NUMBER() OVER (PARTITION BY usuario_id ORDER BY dia) AS grupo
  FROM ativos
),
sequencias AS (
  SELECT usuario_id, MIN(dia) AS inicio, MAX(dia) AS fim, COUNT(*) AS dias
  FROM numerados
  GROUP BY usuario_id, grupo
)
SELECT 'dias ativos seguidos' AS metrica,
       (SELECT COUNT(*) FROM ativos a WHERE a.usuario_id = u.id) AS dias_ativos_total,
       COALESCE((SELECT MAX(s.dias) FROM sequencias s WHERE s.usuario_id = u.id
                  AND s.fim >= date('now', CASE u.fuso_horario WHEN 'America/Sao_Paulo' THEN '-3 hours' ELSE '+0 hours' END, '-1 day')), 0) AS sequencia_atual,
       COALESCE((SELECT MAX(s.dias) FROM sequencias s WHERE s.usuario_id = u.id), 0) AS maior_sequencia,
       (SELECT MAX(a.dia) FROM ativos a WHERE a.usuario_id = u.id) AS ultimo_dia_ativo
FROM usuarios u;

-- 2) TAXA DE SUGESTÕES SALVAS = salvas ÷ (salvas + descartadas), em %. As pendentes ficam de fora. Referência saudável: >= 50.
SELECT 'sugestoes salvas' AS metrica,
       COALESCE(SUM(status = 'salva'), 0) AS salvas,
       COALESCE(SUM(status = 'descartada'), 0) AS descartadas,
       COALESCE(SUM(status = 'pendente'), 0) AS pendentes,
       CASE WHEN SUM(status IN ('salva', 'descartada')) > 0
            THEN ROUND(100.0 * SUM(status = 'salva') / SUM(status IN ('salva', 'descartada')), 1) END AS taxa_salvas_pct
FROM sugestoes;

-- 3) TAREFAS CONCLUÍDAS POR SEMANA (semana começa na segunda; conta por concluida_em no dia local). Só aparecem semanas com conclusão.
SELECT date(date(t.concluida_em, CASE u.fuso_horario WHEN 'America/Sao_Paulo' THEN '-3 hours' ELSE '+0 hours' END), 'weekday 0', '-6 days') AS semana_comeca_em,
       COUNT(*) AS tarefas_concluidas
FROM tarefas t
JOIN usuarios u ON u.id = t.usuario_id
WHERE t.concluida = 1 AND t.concluida_em IS NOT NULL
GROUP BY semana_comeca_em
ORDER BY semana_comeca_em DESC;

-- 4) TOKENS POR MODELO POR DIA (dia local). Vem do `usage` gravado em cada resposta do José (mensagens.modelo e tokens_*).
--    tokens_entrada: entrada sem cache; tokens_cache: lidos do cache; tokens_saida: gerados.
--    Limites: (a) apagar uma mensagem ou conversa apaga também o consumo dela; (b) a chamada que gera o título automático da
--    conversa (Haiku, poucas dezenas de tokens) não vira mensagem e não é gravada; (c) não há preço no banco: multiplique pelos
--    preços atuais da Anthropic. Para um custo exato seria preciso uma tabela de consumo (migração + SPEC), ainda não criada.
SELECT date(m.criada_em, CASE u.fuso_horario WHEN 'America/Sao_Paulo' THEN '-3 hours' ELSE '+0 hours' END) AS dia,
       m.modelo,
       COUNT(*) AS respostas,
       SUM(COALESCE(m.tokens_entrada, 0)) AS tokens_entrada,
       SUM(COALESCE(m.tokens_cache, 0)) AS tokens_cache,
       SUM(COALESCE(m.tokens_saida, 0)) AS tokens_saida
FROM mensagens m
JOIN conversas c ON c.id = m.conversa_id
JOIN usuarios u ON u.id = c.usuario_id
WHERE m.autor = 'jose' AND m.modelo IS NOT NULL
GROUP BY dia, m.modelo
ORDER BY dia DESC, m.modelo;
