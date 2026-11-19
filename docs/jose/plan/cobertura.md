# Cobertura
Todo item da SPEC precisa estar em alguma fase.

| Item da SPEC (arquivo › item) | Fase | Tarefa |
|-------------------------------|------|--------|
| visao › Organizar o dia ("O que faço hoje?") | 2, 5 | 2.1, 2.7, 5.4 |
| visao › Ajudar a decidir (modo decisão) | 6 | 6.5 |
| visao › Planejar o futuro (metas) | 5 | 5.1, 5.3, 5.6 |
| visao › Assistente que conversa (texto + voz) | 2, 3 | 2.5, 2.7, 3.2, 3.3 |
| visao › Métrica de 30 dias ativos + taxa de sugestões + tarefas por semana | 7 | 7.3 |
| visao › Rapidez (≤ 3 s para usar) | 7 | 7.6 |
| visao › PWA celular + computador (680px) | 1 | 1.9, 1.11 |
| visao › MVP pronto = 10 histórias + 7 dias de uso real | 7 | 7.5, roteiro |
| visao › Custo baixo (Haiku padrão, Sonnet em decisões, cache, limite) | 2, 6 | 2.3, 2.5, 6.5 |
| usuarios › Login Google só do Marco (história 1) | 1 | 1.5, 1.6, 1.10 |
| usuarios › Conversar por texto (história 2) | 2 | 2.5, 2.7 |
| usuarios › Conversar por voz (história 3) | 3 | 3.1–3.4 (risco: 1.12) |
| usuarios › José me conhece (história 4) | 4 | 4.4 |
| usuarios › Ver e controlar memórias (história 5) | 4 | 4.3, 4.6 |
| usuarios › Sugestões viram tarefas/metas (história 6) | 4, 5 | 4.1, 4.2, 4.5, 5.1, 5.5 |
| usuarios › Boas-vindas (história 7) | 6 | 6.1–6.4 |
| usuarios › Histórico (história 8) | 2 | 2.4, 2.9 |
| usuarios › Modo decisão (história 9) | 6 | 6.5 |
| usuarios › Sair de todos / apagar tudo (história 10) | 1, 7 | 1.7, 7.1, 7.2 |
| usuarios › Permissão: José nunca salva sozinho | 4 | 4.2, 4.5 |
| usuarios › Permissão: editar sugestão antes de salvar | 4, 5 | 4.5, 5.5 |
| usuarios › Jornada "À noite" (só ações viram cartões) | 5 | 5.7 |
| telas › Padrões: apagar com Desfazer, toasts, 401 com rascunho, offline | 1, 2 | 1.8, 1.9, 2.8, 2.9 |
| telas › Mapa único de rótulos de área | 1 | 1.3 |
| telas › 1 Login (estados `?erro=`) | 1 | 1.10 |
| telas › 2 Boas-vindas (retomada, Pular, salvar selecionadas) | 6 | 6.3, 6.4 |
| telas › 3 Chat (atalhos, cartões ≤ 3, estados, faixa de instalar) | 2, 3, 4, 5, 6 | 2.7, 2.8, 3.2, 4.5, 5.5, 6.5, 6.6 |
| telas › 4 Histórico (grupos, hora/data, apagar) | 2 | 2.9 |
| telas › 5 Tarefas e Metas (lista simples) | 5 | 5.6 |
| telas › 6 José sabe | 4 | 4.6 |
| telas › 7 Ajustes (←, sair, sair de todos, refazer, apagar tudo, instalar) | 1, 6, 7 | 1.10, 6.4, 6.6, 7.2 |
| telas › Identidade visual e acessibilidade (AA, 48px, reduzir movimento) | 1 | 1.8, 1.11 (ícone) |
| dados › Entidades e migração completa (NOT NULL, CHECK, cascatas) | 1 | 1.2 |
| dados › Regra 1 Contexto + cache | 2, 4, 5 | 2.2, 4.4, 5.4 |
| dados › Regra 2 Sugestões (≤ 3, Zod, não repetir memória) | 4, 5 | 4.1, 4.4, 5.1 |
| dados › Regra 3 Editar/salvar sugestão + lote | 4, 6 | 4.2, 6.2 |
| dados › Regra 4 Título com fallback | 2 | 2.6 |
| dados › Regra 5 Ordenação de tarefas | 5 | 5.2 |
| dados › Regra 7 Boas-vindas (retomada, refazer sem repetir) | 6 | 6.1, 6.2 |
| dados › Regra 8 Acesso (email_verified, minúsculas, nada gravado, posse) | 1, 7 | 1.5, 1.6, 7.4 |
| dados › Regra 9 Limites (mensagem, áudio, 200/dia, 60 áudios/dia) | 2, 3 | 2.5, 3.1 |
| dados › Regra 10 Qual IA responde | 2, 6 | 2.3, 6.5 |
| dados › Regra 11 Tentar de novo sem duplicar | 2 | 2.5, 2.8 |
| dados › Regra 12 Conversa de hoje | 2 | 2.4, 2.7 |
| dados › Regra 13 Apagar com Desfazer (5 s) | 2, 4, 5 | 2.9, 4.6, 5.6 |
| dados › Regra 14 Apagar todos os dados | 7 | 7.1 |
| dados › Datas e fuso | 1 | 1.4 |
| dados › Métricas | 7 | 7.3 |
| dados › Integrações: Google, Claude, Whisper | 1, 2 | 1.5, 1.12, 2.3 |
| dados › Privacidade: áudio nunca guardado, logs sem conteúdo, backup 4 cópias | 1, 3, 7 | 1.12, 1.13, 3.1, 7.4, 7.8 |
| arquitetura › Stack (Vite/React, Hono, D1, Workers, arctic) | 1 | 1.1, 1.13 |
| arquitetura › Organização de pastas e adaptadores | 1 | 1.1 |
| arquitetura › Prompt do José + casos golden | 2 | 2.1, 7.7 |
| arquitetura › Tool use (strict, auto, sem 2ª chamada, histórico em texto) | 4 | 4.1 |
| arquitetura › Contrato da API (todas as rotas do MVP) | 1, 2, 3, 4, 5, 6, 7 | 1.7, 2.4–2.6, 3.1, 4.2, 4.3, 5.2, 5.3, 6.2, 7.1 |
| arquitetura › Origin, cookie, isolamento por usuário | 1, 7 | 1.6, 7.4 |
| arquitetura › Riscos: login no iPhone, áudio no iPhone | 1 | 1.10–1.12 |
| arquitetura › Riscos: estímulo visual, tom das respostas | 7 | 7.7 |
| arquitetura › Celular perdido (procedimento de emergência) | 7 | 7.8 |
| Itens *(V1.1)* e "depois" | — | `versoes-futuras.md` |

## Histórias de usuário → testes (tarefa 7.5)
Todo teste de navegador (Playwright, `testes/*.e2e.ts`) roda duas vezes: no celular (iPhone 13, 390 px) e no computador. Os e2e usam a API simulada; o que depende do servidor real (contexto da IA, posse, banco) é coberto pelos testes de rotas (Vitest, D1 em SQLite). Rodar: `npx playwright test --trace off`.

| # | História | Teste de navegador (e2e) | Teste de servidor/regra (Vitest) |
|---|----------|--------------------------|-----------------------------------|
| 1 | Entrar com segurança | `telas.e2e.ts` › Login (frase e botão, `?erro=negado` e `?erro=falha`, carregamento e ida a `/auth/google`, já logado redireciona); `navegacao.e2e.ts` › sem sessão (401) leva ao Login guardando a rota; `chat-estados.e2e.ts` › sessão expirada (401) ao enviar | `auth.test.ts` (só o e-mail do dono, minúsculas, `email_verified`, negado não grava nada); `sessao.test.ts` (sessão de 30 dias renovada no uso, 401); `seguranca.test.ts` › cookies |
| 2 | Conversar por texto | `chat.e2e.ts` › atalho envia o texto e a 1ª parte aparece em até 3 s, "José está pensando…", digitar e enviar; `chat-estados.e2e.ts` › erro da IA com "Tentar de novo" sem duplicar, limite diário, offline | `mensagens.test.ts` (SSE, grava antes de chamar a IA, id repetido não duplica, limite diário); `golden.test.ts` (resposta curta, 1 passo) |
| 3 | Conversar por voz | `voz.e2e.ts` (🎤 → ■ → texto enviado como voz, ✕ e Esc cancelam, 2:00 automático, < 1 s descartado, microfone negado, 429, microfone sempre liberado) | `voz.test.ts` (formatos, 10 MB, 2 min, 60 por dia, áudio nunca gravado) |
| 4 | José me conhece | `historias.e2e.ts` › memória: sugestão no Chat → Salvar → aparece em José sabe | `contexto.test.ts` (memórias, metas e tarefas entram no contexto, na ordem do cache); `memorias.test.ts` |
| 5 | Ver e controlar memórias | `jose-sabe.e2e.ts` (lista por área, criar, editar, apagar com Desfazer, limites); `historias.e2e.ts` (apagar com Desfazer depois de salvar do Chat) | `memorias.test.ts` (CRUD, posse); `seguranca.test.ts` (404 para outro usuário); `memorias.test.ts` › apaga e some (a lista é a fonte do contexto: `contexto.test.ts`) |
| 6 | Sugestões viram tarefas e metas | `sugestoes.e2e.ts` (cartões 🧠/📌/🎯, nada salvo sem toque, máx. 3, Editar/Salvar/Descartar com Desfazer); `tarefas.e2e.ts` (concluir e apagar com Desfazer, ordenação); `historias.e2e.ts` › tarefa: do cartão à lista e concluir | `sugestoes.test.ts`, `tarefas.test.ts`, `metas.test.ts` (Zod, ≤ 3, salvar só se pendente) |
| 7 | Boas-vindas | `boasvindas.e2e.ts` (5 perguntas, "Pergunta N de 5", Pular, retomada, lista marcável e editável, quem já concluiu não volta, refazer) | `boasvindas.test.ts` (fluxo, lote transacional, 409 na 6ª, idempotência) |
| 8 | Histórico | `historico.e2e.ts` (grupos com hora/data, abrir, apagar com Desfazer, Esc/X, foco) | `conversas.test.ts` |
| 8b | Apagar mensagem e situar no tempo | `chat-apagar.e2e.ts` (pressão longa, folha, apagar com resposta, conversa vazia some, separadores e hora); `folha-toque.e2e.ts` | `apagar-mensagem.test.ts` (cascata, `uso_diario` não diminui, 404 de outro usuário) |
| 9 | Decidir com mais profundidade | `chat.e2e.ts` › "Preciso decidir" cria a conversa em modo decisão e a pergunta vem do José; falha com "Tentar de novo" | `decisao.test.ts` (modelo profundo, título só depois da 1ª mensagem de verdade); `golden.test.ts` (casos de decisão) |
| 10 | Controle e privacidade | `telas.e2e.ts` › Ajustes (Sair, Sair de todos, Esc); `apagar-tudo.e2e.ts` (aviso → digitar APAGAR exato → apagando → Login com o aparelho limpo; erro com nova tentativa; Esc; Enter; alvos de 48 px) | `conta.test.ts` (`DELETE /api/eu`: 400 sem "APAGAR", Origin, nenhuma linha em nenhuma das 9 tabelas, tudo ou nada); `seguranca.test.ts`; `auth.test.ts`/`conta.test.ts` (sair de todos → cookie antigo dá 401) |

Lacunas assumidas (só o aparelho real resolve): voz no Android, pressão longa e toque fantasma no Safari, teclado do iPhone e instalação na tela inicial (README, roteiro do iPhone).
