-- Contagem de respostas do José por dia (dados.md regra 9; arquitetura.md §4).
-- É incrementada quando o José grava uma resposta e nunca diminui: apagar mensagens não libera o limite diário.
PRAGMA foreign_keys = ON;

CREATE TABLE uso_diario (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dia TEXT NOT NULL,                       -- AAAA-MM-DD no fuso do usuário
  respostas INTEGER NOT NULL DEFAULT 0 CHECK (respostas >= 0),
  PRIMARY KEY (usuario_id, dia)
);

-- Preenche o dia de hoje com as respostas do José que já existem, para o limite não zerar ao aplicar.
-- O SQLite não conhece fusos nomeados: America/Sao_Paulo (sem horário de verão desde 2019) vale UTC-3
-- e qualquer outro fuso é tratado como UTC. A conta do app, daqui para a frente, usa o fuso real.
INSERT INTO uso_diario (usuario_id, dia, respostas)
SELECT c.usuario_id, date(m.criada_em, CASE u.fuso_horario WHEN 'America/Sao_Paulo' THEN '-3 hours' ELSE '+0 hours' END), COUNT(*)
FROM mensagens m
JOIN conversas c ON c.id = m.conversa_id
JOIN usuarios u ON u.id = c.usuario_id
WHERE m.autor = 'jose'
  AND date(m.criada_em, CASE u.fuso_horario WHEN 'America/Sao_Paulo' THEN '-3 hours' ELSE '+0 hours' END)
    = date('now', CASE u.fuso_horario WHEN 'America/Sao_Paulo' THEN '-3 hours' ELSE '+0 hours' END)
GROUP BY c.usuario_id, 2;
