-- Migração inicial do José (arquitetura.md §4). O D1 mantém foreign_keys ligado.
PRAGMA foreign_keys = ON;

CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  foto_url TEXT,
  boas_vindas_concluida INTEGER NOT NULL DEFAULT 0 CHECK (boas_vindas_concluida IN (0, 1)),
  fuso_horario TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  criado_em TEXT NOT NULL
);

CREATE TABLE sessoes (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em TEXT NOT NULL,
  criada_em TEXT NOT NULL
);
CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id);

CREATE TABLE conversas (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('normal', 'boas_vindas')),
  modo TEXT NOT NULL DEFAULT 'padrao' CHECK (modo IN ('padrao', 'decidir')),
  criada_em TEXT NOT NULL,
  atualizada_em TEXT NOT NULL
);
CREATE INDEX idx_conversas_usuario_atualizada ON conversas(usuario_id, atualizada_em DESC);

CREATE TABLE mensagens (
  id TEXT PRIMARY KEY,
  conversa_id TEXT NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  autor TEXT NOT NULL CHECK (autor IN ('marco', 'jose')),
  texto TEXT NOT NULL,
  origem TEXT NOT NULL CHECK (origem IN ('texto', 'voz')),
  modelo TEXT,
  tokens_entrada INTEGER,
  tokens_saida INTEGER,
  tokens_cache INTEGER,
  criada_em TEXT NOT NULL
);
CREATE INDEX idx_mensagens_conversa_criada ON mensagens(conversa_id, criada_em);

CREATE TABLE sugestoes (
  id TEXT PRIMARY KEY,
  mensagem_id TEXT NOT NULL REFERENCES mensagens(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('tarefa', 'meta', 'memoria')),
  conteudo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'salva', 'descartada')),
  item_id TEXT,
  criada_em TEXT NOT NULL
);
CREATE INDEX idx_sugestoes_mensagem ON sugestoes(mensagem_id);

CREATE TABLE metas (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL CHECK (length(titulo) <= 120),
  area TEXT NOT NULL CHECK (area IN ('trabalho', 'financas', 'saude', 'casa')),
  prazo TEXT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'concluida')),
  concluida_em TEXT,
  origem TEXT NOT NULL CHECK (origem IN ('chat', 'manual', 'boas_vindas')),
  criada_em TEXT NOT NULL
);
CREATE INDEX idx_metas_usuario ON metas(usuario_id, status);

CREATE TABLE tarefas (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL CHECK (length(titulo) <= 120),
  area TEXT NOT NULL CHECK (area IN ('trabalho', 'financas', 'saude', 'casa')),
  prazo TEXT,
  concluida INTEGER NOT NULL DEFAULT 0 CHECK (concluida IN (0, 1)),
  concluida_em TEXT,
  origem TEXT NOT NULL CHECK (origem IN ('chat', 'manual', 'boas_vindas')),
  criada_em TEXT NOT NULL
);
CREATE INDEX idx_tarefas_usuario_concluida_prazo ON tarefas(usuario_id, concluida, prazo);

CREATE TABLE memorias (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto TEXT NOT NULL CHECK (length(texto) <= 300),
  area TEXT NOT NULL CHECK (area IN ('sobre_mim', 'trabalho', 'financas', 'saude', 'casa')),
  origem TEXT NOT NULL CHECK (origem IN ('boas_vindas', 'chat', 'manual')),
  criada_em TEXT NOT NULL,
  atualizada_em TEXT
);
CREATE INDEX idx_memorias_usuario ON memorias(usuario_id);
