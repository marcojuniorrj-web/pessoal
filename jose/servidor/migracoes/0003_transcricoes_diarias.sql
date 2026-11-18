-- Contagem de transcrições de voz por dia (dados.md regra 9: até 60 por dia; arquitetura.md §4).
-- Mesma tabela e mesma chave (usuario_id, dia, fuso do usuário) do limite de respostas. `POST /api/voz` soma 1 ANTES de
-- chamar o Whisper e nunca diminui (uma transcrição que falha continua contada, para o limite de custo não ser burlado).
-- Funciona do zero e sobre o banco existente: as linhas que já existem ficam com 0.
ALTER TABLE uso_diario ADD COLUMN transcricoes INTEGER NOT NULL DEFAULT 0 CHECK (transcricoes >= 0);
