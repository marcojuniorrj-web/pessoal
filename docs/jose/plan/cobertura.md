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
