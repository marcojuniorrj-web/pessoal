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
| IA (José) | **Claude API**: `claude-haiku-5-5` como padrão (conversa, sugestões e título). Usa `claude-sonnet-5-5` só no modo **Decidir** (conversa iniciada por "⚖️ Preciso decidir") (*V1.1:* também quando o Marco toca em **"Pensar melhor"**). Streaming + tool use + **prompt caching** do prefixo estável | O Haiku custa 1/20 do Sonnet e é ótimo em respostas curtas. O Sonnet fica onde a profundidade importa. Os dados não são usados para treinar modelos |
| Transcrição de voz | **Cloudflare Workers AI — Whisper** (`@cf/openai/whisper-large-v3-turbo`) | Mesmo provedor, sem nova conta; custo de centavos/mês; áudio processado em memória e descartado |
| Testes | **Vitest** (regras e serviços) + **Playwright** (fluxos principais no celular) | Padrão do ecossistema Vite |

Custo estimado (assumido, ~30 mensagens/dia, ~10 mil tokens de contexto cada): Cloudflare R$ 0; Claude ≈ **US$ 1–3/mês** (Haiku no dia a dia, Sonnet só em decisões, com cache); Whisper < US$ 1/mês. **Total ≈ R$ 10–20/mês.**

Alternativa avaliada e descartada: Gemini. A assinatura Google One não inclui a API, e o plano gratuito da API pode usar os dados para melhorar produtos, o que não serve para dados de saúde e finanças. O preço pago é equivalente ao do Haiku.

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
- "Acesso por perfil" aqui é **isolamento por `usuario_id`** em toda consulta (há um só perfil). Um helper de posse é usado em todas as rotas `/:id`. As sugestões são checadas pelo caminho mensagem → conversa → usuário.
- Segredos (`ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `SESSION_SECRET`, `OWNER_EMAIL`) via `wrangler secret`; `.dev.vars.exemplo` versionado.
- Logs sem conteúdo de mensagens (só ids, tempos e erros) — o conteúdo é sensível.
- Backup: exportação semanal do D1 (`wrangler d1 export`), com 4 cópias, mais o Time Travel do D1 (30 dias). *(V1.1: botão "Exportar meus dados".)*

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
│   │   │   └── conta/          # apagar tudo, sair de todos (V1.1: exportar)
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
D1 (SQLite). Convenções:
- ids em `TEXT` (uuid v7);
- data/hora em `TEXT` ISO-8601 UTC, e prazo como data local `AAAA-MM-DD`;
- booleanos em `INTEGER 0/1`;
- JSON em `TEXT`.

`PRAGMA foreign_keys = ON`. Todas as colunas marcadas como obrigatórias em dados.md são `NOT NULL`.

```sql
usuarios(id PK, email UNIQUE NOT NULL, nome NOT NULL, foto_url, boas_vindas_concluida INT NOT NULL DEFAULT 0,
         fuso_horario NOT NULL DEFAULT 'America/Sao_Paulo', criado_em NOT NULL)
sessoes(id PK /* sha-256 do token */, usuario_id NOT NULL FK→usuarios ON DELETE CASCADE,
        expira_em NOT NULL, criada_em NOT NULL)                          -- índice (usuario_id)
conversas(id PK, usuario_id NOT NULL FK ON DELETE CASCADE, titulo,
          tipo NOT NULL CHECK(tipo IN('normal','boas_vindas')),
          modo NOT NULL DEFAULT 'padrao' CHECK(modo IN('padrao','decidir')),
          criada_em NOT NULL, atualizada_em NOT NULL)                    -- índice (usuario_id, atualizada_em DESC)
mensagens(id PK /* gerado no app */, conversa_id NOT NULL FK ON DELETE CASCADE,
          autor NOT NULL CHECK(autor IN('marco','jose')), texto NOT NULL,
          origem NOT NULL CHECK(origem IN('texto','voz')), modelo,
          tokens_entrada INT, tokens_saida INT, tokens_cache INT, criada_em NOT NULL)  -- índice (conversa_id, criada_em)
sugestoes(id PK, mensagem_id NOT NULL FK ON DELETE CASCADE,
          tipo NOT NULL CHECK(tipo IN('tarefa','meta','memoria')), conteudo NOT NULL /*JSON*/,
          status NOT NULL DEFAULT 'pendente' CHECK(status IN('pendente','salva','descartada')),
          item_id, criada_em NOT NULL)
metas(id PK, usuario_id NOT NULL FK ON DELETE CASCADE, titulo NOT NULL CHECK(length(titulo)<=120),
      area NOT NULL CHECK(area IN('trabalho','financas','saude','casa')), prazo,
      status NOT NULL DEFAULT 'ativa' CHECK(status IN('ativa','concluida')), concluida_em,
      origem NOT NULL CHECK(origem IN('chat','manual','boas_vindas')), criada_em NOT NULL)
tarefas(id PK, usuario_id NOT NULL FK ON DELETE CASCADE, titulo NOT NULL CHECK(length(titulo)<=120),
        area NOT NULL CHECK(area IN('trabalho','financas','saude','casa')), prazo,
        concluida INT NOT NULL DEFAULT 0, concluida_em,
        origem NOT NULL CHECK(origem IN('chat','manual','boas_vindas')), criada_em NOT NULL)  -- índice (usuario_id, concluida, prazo)
memorias(id PK, usuario_id NOT NULL FK ON DELETE CASCADE, texto NOT NULL CHECK(length(texto)<=300),
         area NOT NULL CHECK(area IN('sobre_mim','trabalho','financas','saude','casa')),
         origem NOT NULL CHECK(origem IN('boas_vindas','chat','manual')), criada_em NOT NULL, atualizada_em)
uso_diario(usuario_id NOT NULL FK→usuarios ON DELETE CASCADE, dia NOT NULL /* AAAA-MM-DD no fuso do usuário */,
           respostas INT NOT NULL DEFAULT 0, PRIMARY KEY (usuario_id, dia))      -- migração 0002
```
- **Apagar conversa:** a cascata apaga as mensagens e as sugestões. Os itens já salvos (tarefas, metas e memórias) permanecem.
- **Apagar mensagem:** a cascata apaga as sugestões da mensagem; os itens salvos permanecem.
- **Limite diário:** `uso_diario` guarda as respostas do José por dia local do usuário. É incrementada na mesma transação que grava a resposta e **nunca decrementa** (apagar mensagens não libera o limite). A migração 0002 preenche o dia de hoje com a contagem atual de respostas, para o limite não zerar.
- **Apagar usuário:** a cascata apaga tudo.
- **V1.1:**
  - `tarefas.meta_id` (FK para metas, `ON DELETE SET NULL`);
  - `metas.status` passa a aceitar `'pausada'`.

**Sugestões via tool use.** O José recebe três ferramentas (`strict: true`, `tool_choice: auto`):
- `sugerir_tarefa{titulo, area, prazo?}`;
- `sugerir_meta{titulo, area, prazo?}`;
- `sugerir_memoria{texto, area}`.

Como funciona:
- O prompt pede que o texto venha **antes** das ferramentas.
- Cada chamada é validada com Zod e vira uma linha em `sugestoes`, com status `pendente`. O máximo é 3 por resposta.
- **Não há segunda chamada à IA** depois das ferramentas: a resposta termina ali.
- O histórico é reenviado como **texto puro**, com linhas-resumo das sugestões. Nunca são reenviados os blocos tool_use/tool_result.

**Prompt do José.** Fica em `servidor/src/adaptadores/ia/prompt-jose.md`, versionado. Regras:
- no máximo ~5 linhas e 1 próximo passo por resposta;
- no máximo 3 sugestões;
- não dar aconselhamento médico, jurídico ou financeiro profissional;
- não sugerir memória que já existe;
- modo decidir: até 3 perguntas → prós e contras curtos → recomendação.

O prompt é testado com 4 casos "golden", um por momento do dia.

**Configuração da IA** (variáveis de ambiente):
- `MODELO_PADRAO=claude-haiku-5-5`, com `max_tokens` 600;
- `MODELO_PROFUNDO=claude-sonnet-5-5`, com `max_tokens` 1500, esforço `low` e fallback de recusa ligado;
- streaming e `cache_control` ao fim do bloco de tarefas.

## 5. Contrato da API
Todas as rotas abaixo de `/api` exigem sessão (cookie):
- Sem sessão, devolvem 401.
- Item de outro usuário devolve 404.
- As que escrevem (POST/PATCH/DELETE) checam o cabeçalho `Origin`.

Erros seguem o formato `{ erro: { codigo, mensagem } }`, com HTTP 400, 401, 404, 409, 413, 429 ou 500.

| Operação | Rota | Quem chama | Recebe | Devolve | Regras |
|----------|------|------------|--------|---------|--------|
| Iniciar login | `GET /auth/google` | Login | `?voltar=` | redirect Google | gera `state` + PKCE |
| Retorno do login | `GET /auth/google/callback` | Google | `code, state` | 302 para `/` (ou `voltar`), `/?erro=negado` ou `/?erro=falha` | exige `email_verified`; compara em minúsculas com `OWNER_EMAIL`; **nada é gravado** se negado; cria/atualiza usuário e sessão (30 dias, renovada no uso) |
| Sair | `POST /auth/sair` | Ajustes | — | 204 | apaga a sessão atual |
| Sair de todos | `POST /auth/sair-todos` | Ajustes | — | 204 | apaga todas as sessões do usuário |
| Quem sou | `GET /api/eu` | app ao abrir | — | `{nome, email, foto_url, boas_vindas_concluida, fuso_horario, conversa_boas_vindas_id?}` | o app usa `fuso_horario` para os horários e separadores de dia |
| Conversa de hoje | `GET /api/conversas/hoje` | Chat ao abrir | — | `{conversa, mensagens[], sugestoes[]}` ou `null` | regra 12 |
| Listar conversas | `GET /api/conversas` | Histórico | — | `[{id, titulo, tipo, modo, atualizada_em}]` | ordem `atualizada_em DESC` *(V1.1: `?busca=`)* |
| Criar conversa | `POST /api/conversas` | 1ª mensagem / atalho Decidir / Boas-vindas | `{tipo, modo?}` | `{id}` | `boas_vindas`: o José faz a 1ª pergunta |
| Abrir conversa | `GET /api/conversas/:id` | Chat | — | `{conversa, mensagens[], sugestoes[]}` | — |
| Apagar conversa | `DELETE /api/conversas/:id` | Histórico e ⋯ do topo do Chat (depois de 5 s sem desfazer) | — | 204 | cascata; os itens salvos ficam |
| Apagar mensagem | `DELETE /api/mensagens/:id` | folha de ações do balão, aberta por pressão longa (depois de 5 s sem desfazer) | `?com_resposta=1` (opcional) | 204 | posse por mensagem → conversa → usuário (404 se não for do Marco); `com_resposta` só vale para mensagem do Marco (400 se for do José) e apaga também a resposta do José logo depois; cascata nas sugestões; itens salvos ficam; se não houver resposta logo depois, apaga só a mensagem e também devolve 204; mensagem inexistente responde 404 e o app trata esse 404 como "já apagada" |
| Enviar mensagem | `POST /api/conversas/:id/mensagens` | Chat | `{id (uuid do app), texto (1–4000), origem}` | **SSE** com os eventos `texto` (delta), `sugestao` ({id, tipo, conteudo}), `fim` ({mensagem_id, titulo?}) e `erro` | monta o contexto (regra 1); grava a mensagem do Marco antes de chamar a IA; **id repetido não duplica, só gera a resposta que falta** (regra 11); grava a resposta e o `usage` ao fim; 429 no limite diário |
| Transcrever áudio | `POST /api/voz` | Botão 🎤 | `multipart: audio` (≤ 2 min, 10 MB; webm/mp4/m4a) | `{texto}` | idioma `pt`; o áudio fica só em memória e é descartado; 413 se grande; 429 no limite |
| Salvar sugestão | `POST /api/sugestoes/:id/salvar` | Cartão | `{conteudo?}` (editado) | `{item}` | só se `pendente` (senão 409); cria o item; grava `item_id` |
| Descartar sugestão | `POST /api/sugestoes/:id/descartar` | Cartão | — | 204 | só se `pendente` |
| Salvar selecionadas | `POST /api/conversas/:id/sugestoes/lote` | Boas-vindas | `{salvar: [{id, conteudo?}], descartar: [id]}` | `{itens[]}` | transação única |
| Concluir boas-vindas | `POST /api/eu/boas-vindas` | Boas-vindas (fim/Pular) | — | 204 | `boas_vindas_concluida = 1` |
| Tarefas (CRUD) | `GET/POST /api/tarefas`, `PATCH/DELETE /api/tarefas/:id` | Tarefas | `{titulo, area, prazo?}` / campos parciais (incl. `concluida`) | tarefa(s) | GET na ordem da regra 5; concluir grava `concluida_em` e desfazer limpa; POST manual com `origem = manual` |
| Metas (CRUD) | `GET/POST /api/metas`, `PATCH/DELETE /api/metas/:id` | Tarefas › Metas | `{titulo, area, prazo?, status?}` | meta(s) | concluir grava `concluida_em` |
| Memórias (CRUD) | `GET/POST /api/memorias`, `PATCH/DELETE /api/memorias/:id` | José sabe | `{texto (1–300), area}` | memória(s) | — |
| Apagar tudo | `DELETE /api/eu` | Ajustes | `{confirmacao: "APAGAR"}` | 204 + cookie limpo | regra 14; transação única |
| *(V1.1)* Refazer com modelo profundo | `POST /api/mensagens/:id/refazer` | "Pensar melhor" | `{modelo: "profundo"}` | SSE | apaga a resposta antiga e as sugestões pendentes dela; não duplica a mensagem do Marco |
| *(V1.1)* Exportar | `GET /api/exportar` | Ajustes | — | `jose-dados-AAAA-MM-DD.json` | inclui `versao`; não inclui sessões |

## 6. Riscos e decisões
| Tema | Opções | Decisão |
|------|--------|---------|
| Escopo do MVP | completo · enxuto | **Enxuto** (decisão do Marco). Ficam para a V1.1: progresso e ligação de metas, meta pausada, filtros, busca no histórico, "Pensar melhor" e exportar. O modo Decidir fica no MVP |
| Transcrição de voz | Web Speech API · Whisper no Workers AI · outro provedor | **Workers AI Whisper**. Risco: aceitar o formato mp4/AAC do Safari no iPhone. **Testar na onda 1** com um áudio gravado no iPhone real. Plano B: converter no cliente ou trocar de provedor atrás do adaptador |
| Gravação de voz | segurar o botão · tocar para gravar e parar | **Tocar para gravar e tocar para parar** (decisão do Marco), mais confiável no PWA do iPhone |
| Login no PWA do iPhone | — | Risco: o PWA instalado e o Safari podem não dividir cookies. **Validar na onda 1 no iPhone real**, antes do chat |
| Autenticação | Cloudflare Access · OAuth próprio · senha | **OAuth Google próprio**, com allowlist estrita e "Sair de todos os aparelhos" |
| Apagar não pode burlar o limite | contar as mensagens existentes · tabela de contagem | **Tabela `uso_diario`**, incrementada ao gravar cada resposta e nunca decrementada |
| Custo da IA | Sonnet em tudo (~US$ 25/mês) · Haiku + Sonnet sob demanda · só Haiku · IA gratuita da Cloudflare | **Haiku padrão + Sonnet no modo Decidir**. Também: prompt caching, contexto de 20 mensagens e 50 tarefas, limite diário configurável (`LIMITE_MENSAGENS_DIA`, padrão 200, que devolve 429) e registro do `usage` por resposta. O tamanho mínimo para cachear pode não ser atingido no começo; medir desde o 1º dia |
| Memórias crescendo no contexto | enviar todas · busca semântica | **Enviar todas** no MVP; reavaliar acima de ~300 memórias |
| Resposta longa demais (TDAH) | confiar no prompt · limite técnico | Prompt firme, com casos golden e `max_tokens` moderado; ajustar depois de 1 semana de uso real |
| Excesso de estímulo | — | No máximo 3 cartões por resposta e 1 aviso por vez; revisar com o Marco depois de 1 semana |
| Privacidade dos dados sensíveis | criptografar por coluna · isolamento | **Exceção consciente à boa prática "criptografar dados sensíveis"**: D1 criptografado em repouso pela Cloudflare, acesso só pelo Worker autenticado e logs sem conteúdo. Criptografia por coluna fica para depois |
| Falha da API da IA | erro seco · tentar de novo | A mensagem do Marco é salva antes. "Tentar de novo" reenvia o mesmo `id` e não duplica |
| Offline | app offline completo · aviso | O PWA abre offline (shell e últimas listas em cache, só leitura) com a faixa "Offline". Sincronização offline fica para depois |
| Celular perdido | — | "Sair de todos os aparelhos" no MVP. Emergência: `wrangler d1 execute ... "DELETE FROM sessoes"` |
| Lock-in Cloudflare | — | Aceito: os adaptadores isolam IA, voz e auth; D1 é SQLite padrão, exportável |
