# Arquitetura

> Este arquivo já vem com as boas práticas. O Claude preenche as seções marcadas com <...>
> a partir de visao.md, usuarios.md, telas.md e dados.md.

## 1. Tecnologias escolhidas
O repositório está vazio, então a escolha parte das restrições: **1 usuário, custo baixo, PWA no celular**.

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Interface | **React + Vite + TypeScript**, PWA com `vite-plugin-pwa`; estilos com CSS próprio (tokens de cor da identidade) | PWA instalável, rápido, sem framework pesado |
| Servidor/API | **Cloudflare Workers + Hono** (TypeScript) | Gratuito nesse volume, streaming nativo, mesmo deploy da interface |
| Banco | **Cloudflare D1** (SQLite) com migrações SQL versionadas | Gratuito até 5 GB; suficiente para 1 usuário por anos |
| Hospedagem | **Cloudflare** (Worker com assets estáticos) — um único deploy (`wrangler deploy`) | HTTPS e domínio `*.workers.dev` grátis; conta Cloudflare já conectada |
| Autenticação | **Google OAuth 2.0** implementado no Worker (lib `arctic`), sessão em cookie `HttpOnly; Secure; SameSite=Lax` guardada em D1 (30 dias, renovada no uso) | 1 toque; só o e-mail `OWNER_EMAIL` entra |
| IA (José) | **Claude API** — `claude-sonnet-5-5` para conversa (streaming + tool use para sugestões); `claude-haiku-5-5` para título da conversa | Bom português, segue tom; Haiku barateia tarefas simples |
| Transcrição de voz | **Cloudflare Workers AI — Whisper** (`@cf/openai/whisper-large-v3-turbo`) | Mesmo provedor, sem nova conta; custo de centavos/mês; áudio processado em memória e descartado |
| Testes | **Vitest** (regras e serviços) + **Playwright** (fluxos principais no celular) | Padrão do ecossistema Vite |

Custo estimado (assumido, uso diário intenso): Cloudflare R$ 0; Claude ≈ US$ 5–15/mês; Whisper < US$ 1/mês.

## 2. Boas práticas obrigatórias
- Separar camadas: interface → rotas/API → serviço (regra de negócio) → repositório (dados).
- Cada módulo do domínio tem sua pasta com rotas, serviço, repositório e modelos.
- Integrações externas atrás de adaptadores (trocar WhatsApp por Telegram não mexe na regra).
- Configuração e segredos só em variáveis de ambiente (`.env`, com `.env.exemplo` versionado).
- Validar toda entrada; erros com mensagem clara; logs das operações importantes.
- Dados sensíveis (CPF, renda) criptografados ou mascarados; acesso por perfil.
- Testes automáticos para regras de negócio e cálculos.
- Backups e migrações de banco versionados.

**Complementos deste projeto**
- Validação de entrada com **Zod** (compartilhado entre API e interface).
- Adaptadores: `ia/` (Claude), `voz/` (Whisper), `auth/` (Google) — trocar provedor não mexe em `modulos/`.
- Toda rota da API (exceto `/auth/*`) exige sessão válida; o `usuario_id` vem **sempre da sessão**, nunca do corpo da requisição.
- Segredos (`ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `SESSION_SECRET`, `OWNER_EMAIL`) via `wrangler secret`; `.dev.vars.exemplo` versionado.
- Logs sem conteúdo de mensagens (só ids, tempos e erros) — o conteúdo é sensível.
- Backup: exportação D1 semanal (`wrangler d1 export`) + botão "Exportar meus dados".

## 3. Organização interna (pastas)
```
jose/
├── app/                        # Interface (React PWA)
│   ├── src/
│   │   ├── telas/              # Login, BoasVindas, Chat, Historico, Tarefas, JoseSabe, Ajustes
│   │   ├── componentes/        # Balao, CartaoSugestao, BotaoMicrofone, BarraAbas, Toast...
│   │   ├── api/                # cliente HTTP + leitura de streaming (SSE)
│   │   ├── estado/             # hooks de dados (conversas, tarefas, memórias)
│   │   └── estilo/             # tokens de cor/tipografia (tema escuro)
│   └── public/                 # manifest, ícones do PWA
├── servidor/                   # Cloudflare Worker (Hono)
│   ├── src/
│   │   ├── index.ts            # monta rotas, middleware de sessão, serve assets
│   │   ├── modulos/
│   │   │   ├── auth/           # rotas · servico · repositorio (usuarios, sessoes)
│   │   │   ├── conversas/      # conversas, mensagens, sugestões, chat com streaming
│   │   │   ├── tarefas/        # tarefas e metas (ordenação, progresso)
│   │   │   ├── memorias/
│   │   │   └── exportar/
│   │   ├── adaptadores/
│   │   │   ├── ia/             # claude.ts: prompt de sistema, contexto, tools de sugestão
│   │   │   ├── voz/            # whisper.ts
│   │   │   └── google/         # oauth.ts
│   │   └── compartilhado/      # erros, validação (zod), datas/fuso
│   ├── migracoes/              # 0001_inicial.sql ...
│   └── wrangler.toml
├── compartilhado/              # tipos e schemas Zod usados por app e servidor
└── testes/                     # e2e Playwright
```

## 4. Modelo de dados técnico
D1 (SQLite). Ids `TEXT` (uuid v7), datas `TEXT` ISO-8601 UTC, booleanos `INTEGER 0/1`, JSON em `TEXT`.

```sql
usuarios(id PK, email UNIQUE NOT NULL, nome NOT NULL, foto_url, boas_vindas_concluida INT DEFAULT 0,
         fuso_horario DEFAULT 'America/Sao_Paulo', criado_em NOT NULL)
sessoes(id PK /* hash do token */, usuario_id FK→usuarios, expira_em NOT NULL, criada_em NOT NULL)
conversas(id PK, usuario_id FK, titulo, tipo CHECK(tipo IN('normal','boas_vindas')) NOT NULL,
          criada_em, atualizada_em)                       -- índice (usuario_id, atualizada_em DESC)
mensagens(id PK, conversa_id FK ON DELETE CASCADE, autor CHECK(IN('marco','jose')),
          texto NOT NULL, origem CHECK(IN('texto','voz')), criada_em)   -- índice (conversa_id, criada_em)
sugestoes(id PK, mensagem_id FK ON DELETE CASCADE, tipo CHECK(IN('tarefa','meta','memoria')),
          conteudo TEXT /*JSON*/ NOT NULL, status CHECK(IN('pendente','salva','descartada')) DEFAULT 'pendente',
          item_id, criada_em)
metas(id PK, usuario_id FK, titulo NOT NULL CHECK(length<=120), area CHECK(IN('trabalho','financas','saude','casa')),
      prazo, status CHECK(IN('ativa','concluida','pausada')) DEFAULT 'ativa', criada_em)
tarefas(id PK, usuario_id FK, titulo NOT NULL CHECK(length<=120), area CHECK(...), prazo,
        concluida INT DEFAULT 0, concluida_em, meta_id FK→metas ON DELETE SET NULL,
        origem CHECK(IN('chat','manual')), criada_em)     -- índice (usuario_id, concluida, prazo)
memorias(id PK, usuario_id FK, texto NOT NULL CHECK(length<=300),
         area CHECK(IN('sobre_mim','trabalho','financas','saude','casa')),
         origem CHECK(IN('boas_vindas','chat','manual')), criada_em, atualizada_em)
```
Apagar conversa → cascata em mensagens e sugestões; itens já salvos (tarefas/metas/memórias) permanecem.
`PRAGMA foreign_keys = ON`.

**Sugestões via tool use:** o José recebe três ferramentas — `sugerir_tarefa{titulo, area, prazo?, meta_titulo?}`,
`sugerir_meta{titulo, area, prazo?}`, `sugerir_memoria{texto, area}`. Cada chamada vira uma linha em `sugestoes`
(status `pendente`); o servidor responde à ferramenta "sugestão exibida ao usuário" sem criar nada.

## 5. Contrato da API
Todas as rotas abaixo de `/api` exigem sessão (cookie). Erros: `{ erro: { codigo, mensagem } }` com HTTP 400/401/403/404/413/429/500.

| Operação | Rota | Quem chama | Recebe | Devolve | Regras |
|----------|------|------------|--------|---------|--------|
| Iniciar login | `GET /auth/google` | Login | — | redirect Google | gera `state` + PKCE |
| Retorno do login | `GET /auth/google/callback` | Google | `code, state` | redirect `/` ou `/?erro=negado` | e-mail ≠ `OWNER_EMAIL` → 403 "acesso negado"; cria/atualiza usuário e sessão |
| Sair | `POST /auth/sair` | Ajustes | — | 204 | apaga sessão |
| Quem sou | `GET /api/eu` | app ao abrir | — | `{nome, email, foto_url, boas_vindas_concluida}` | 401 se sem sessão |
| Listar conversas | `GET /api/conversas?busca=` | Histórico | busca opcional | `[{id, titulo, tipo, atualizada_em}]` | ordem `atualizada_em DESC` |
| Criar conversa | `POST /api/conversas` | + Nova / Boas-vindas | `{tipo}` | `{id}` | boas_vindas: José inicia com a 1ª pergunta |
| Abrir conversa | `GET /api/conversas/:id` | Chat | — | `{conversa, mensagens[], sugestoes[]}` | só do próprio usuário (senão 404) |
| Apagar conversa | `DELETE /api/conversas/:id` | Histórico | — | 204 | cascata; itens salvos ficam |
| Enviar mensagem | `POST /api/conversas/:id/mensagens` | Chat | `{texto (1–4000), origem}` | **SSE**: eventos `texto` (delta), `sugestao` ({id,tipo,conteudo}), `fim` ({mensagem_id, titulo?}), `erro` | monta contexto (regra 1 de dados.md); grava msg do Marco antes de chamar a IA; grava a do José ao fim; gera título na 1ª resposta |
| Transcrever áudio | `POST /api/voz` | Botão 🎤 | `multipart: audio` (≤ 2 min / 10 MB) | `{texto}` | áudio processado em memória e descartado; 413 se grande |
| Salvar sugestão | `POST /api/sugestoes/:id/salvar` | Cartão | `{conteudo?}` (editado) | `{item}` | só se `pendente`; cria Tarefa/Meta/Memória; grava `item_id` |
| Descartar sugestão | `POST /api/sugestoes/:id/descartar` | Cartão | — | 204 | só se `pendente` |
| Concluir boas-vindas | `POST /api/eu/boas-vindas` | Boas-vindas (fim/pular) | — | 204 | `boas_vindas_concluida = 1` |
| Listar tarefas | `GET /api/tarefas?area=&concluidas=` | Tarefas | filtros | `[tarefa]` | ordenação da regra 5 |
| Criar tarefa | `POST /api/tarefas` | + Adicionar | `{titulo, area, prazo?, meta_id?}` | `{tarefa}` | origem `manual` |
| Editar tarefa | `PATCH /api/tarefas/:id` | Tarefas | campos parciais (incl. `concluida`) | `{tarefa}` | concluir grava `concluida_em`; desfazer limpa |
| Apagar tarefa | `DELETE /api/tarefas/:id` | Tarefas | — | 204 | — |
| Metas (CRUD) | `GET/POST /api/metas`, `PATCH/DELETE /api/metas/:id` | Tarefas › Metas | `{titulo, area, prazo?, status?}` | meta com `progresso {feitas, total}` | regra 6; apagar meta desliga tarefas (`meta_id = NULL`) |
| Memórias (CRUD) | `GET/POST /api/memorias`, `PATCH/DELETE /api/memorias/:id` | José sabe | `{texto (1–300), area}` | memória | agrupadas por área na interface |
| Exportar | `GET /api/exportar` | Ajustes | — | arquivo `jose-dados-AAAA-MM-DD.json` | todos os dados do usuário |

## 6. Riscos e decisões
| Tema | Opções | Decisão |
|------|--------|---------|
| Transcrição de voz | Web Speech API do navegador (grátis, mas falha em PWA no iPhone) · Whisper no Workers AI · ElevenLabs/OpenAI | **Workers AI Whisper**: funciona em qualquer celular, mesmo provedor, barato |
| Autenticação | Cloudflare Access · OAuth próprio · senha | **OAuth Google próprio**: controle da sessão longa no PWA; Access tem atrito em PWA instalado |
| Custo da IA fora de controle | sem limite · limite diário | Limite diário configurável (`LIMITE_MENSAGENS_DIA`, padrão 200) → 429 com mensagem amigável; contexto limitado a 30 mensagens |
| Memórias crescendo demais no contexto | enviar todas · busca semântica | **Enviar todas** no MVP (300 chars × poucas centenas cabe); reavaliar acima de ~300 memórias |
| Resposta da IA longa demais (TDAH) | confiar no prompt · limite técnico | Prompt de sistema firme (≤ 5 linhas, 1 próximo passo) + `max_tokens` moderado; ajuste após uso real |
| Privacidade de dados sensíveis | criptografar colunas · confiar no isolamento | D1 criptografado em repouso pela Cloudflare + acesso só via Worker autenticado; logs sem conteúdo. Criptografia por coluna fica para depois |
| Falha da API da IA | erro seco · tentar de novo | Mensagem do Marco já salva antes; balão "Tentar de novo" reenvia sem duplicar |
| Offline | app offline completo · aviso | PWA abre offline (shell em cache) com faixa "Offline"; envio desabilitado. Sincronização offline fica para depois |
| Lock-in Cloudflare | — | Aceito: adaptadores isolam IA/voz/auth; D1 é SQLite padrão, exportável |
