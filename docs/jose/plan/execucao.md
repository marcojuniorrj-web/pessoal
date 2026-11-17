# Execução (memória de construção)
## Onde paramos
- Fase atual: BUILD onda 1 (em andamento)
- Última tarefa concluída: 1.11 (Fase 1: 1.1 a 1.11 feitas e testadas; 1.12 e 1.13 prontas no código, falta o aceite real)
- Próximo passo: o Marco faz o deploy e o teste no iPhone/Android seguindo `jose/README.md` (Google OAuth, `wrangler d1 create`, segredos, `npm run deploy`, página Teste de voz); depois fecha 1.12 e 1.13 e segue para a onda 2
## Aprovações
- [x] SPEC aprovada (2026-11-17)
- [x] PLAN aprovado (2026-11-17)
## Resumo das fases (decisões fechadas — ler antes dos documentos completos)
### SPEC
- MVP: **enxuto**. Inclui:
  - chat por texto e voz (tocar para gravar e tocar para parar);
  - memórias;
  - sugestões confirmadas de tarefa, meta e memória, com no máximo 3 por resposta;
  - lista simples de tarefas e metas;
  - modo decisão;
  - boas-vindas;
  - sair de todos;
  - apagar tudo.

  Os itens da V1.1 estão em `versoes-futuras.md`.
- Usuários e permissões:
  - só o Marco, com login Google (`OWNER_EMAIL`, e-mail verificado);
  - o José nunca salva nada sozinho;
  - isolamento por `usuario_id`.
- Telas principais:
  - Login, Boas-vindas, Chat (com Histórico), Tarefas/Metas, José sabe e Ajustes;
  - barra com 3 abas, tema escuro e calmo, destaque âmbar;
  - apagar com "Desfazer".
- Dados e integrações: D1 com 8 tabelas, Claude API (Haiku padrão, Sonnet no modo decisão, tool use, cache) e Whisper no Workers AI. O áudio nunca é guardado.
- Stack/arquitetura: React + Vite (PWA), Cloudflare Workers + Hono, D1, arctic (OAuth), Zod, Vitest e Playwright. Custo estimado de R$ 10–20/mês.
### PLAN
- Ondas:
  1. esqueleto, login e prova da voz;
  2. chat por texto;
  3. voz;
  4. memórias e cartões;
  5. tarefas e metas;
  6. boas-vindas e modo decisão;
  7. privacidade, métricas e fechamento.
- Riscos em aberto:
  - login no PWA do iPhone (validar na 1);
  - áudio mp4 do iPhone no Whisper (validar na 1.12);
  - cache abaixo do mínimo no início (medir o `usage`);
  - tom e tamanho das respostas (casos golden e 7 dias de uso).
## Histórico
| Data | Fase/tarefa | O que foi feito | Decisões | Testado por |
|------|-------------|-----------------|----------|-------------|
| 2026-11-17 | SPEC | 5 arquivos da SPEC criados e aprovados | Haiku + Sonnet sob demanda; Gemini descartado | Marco |
| 2026-11-17 | PLAN | Revisão por 4 especialistas; SPEC corrigida; 7 ondas planejadas | MVP enxuto; apagar com Desfazer; tocar para gravar; sair de todos e apagar tudo no MVP | — |
