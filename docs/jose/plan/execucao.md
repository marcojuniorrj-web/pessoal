# Execução (memória de construção)
## Onde paramos
- Fase atual: BUILD onda 5 publicada, aguardando teste do Marco; depois ajuste de coaching
- Última tarefa concluída: onda 4 inteira (cartão 🧠, aba José sabe), testada no iPhone
- Próximo passo: terminar a onda 5; depois o AJUSTE DE COACHING (ver Histórico 2026-11-18) → 3 (voz) → 6 (boas-vindas e modo decisão, com GROW + perdas e ganhos) → 7
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
| 2026-11-17 | BUILD onda 1 | Tarefas 1.1 a 1.13 concluídas. Deploy em https://jose.marco-junior-rj.workers.dev (Worker `jose`, D1 `jose`, id 44bc8c56-0e72-4aa8-8da7-e45749d90673, conta Cloudflare do Marco). Segredos: OWNER_EMAIL, SESSION_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Google OAuth em modo Teste (projeto `jose-515022`). | Deploy por `npm run deploy:embutido` (o proxy do ambiente derruba o upload de assets do wrangler). Faixa Offline também reage a falha de rede e ao app voltar para a frente (o `navigator.onLine` do iPhone não é confiável). Pendências para as próximas ondas: tratamento global do 401 (onda 2), limite de 2 min e de 60 transcrições por dia (onda 3), remover a página /teste-voz depois da voz estar em uso. | Marco, no iPhone: login, instalar, continuar logado ao reabrir, faixa Offline, voz e Sair de todos OK. Android não testado |
| 2026-11-18 | BUILD onda 2 | Chat por texto com streaming (Haiku padrão, Sonnet no modo decisão), histórico, título automático, erros/offline/limite/401. Publicado e testado pelo Marco no iPhone com a chave real. | Corrigido no iPhone: zoom não conta como teclado (teclado só "aberto" com campo em foco e sem zoom), safe-area no topo/laterais, sem rolagem lateral. `/api/eu` devolve `fuso_horario`. Tetos de max_tokens 1500/4000; plano B sem fallback em qualquer 400 do modo decisão. Testes de navegador usam Chromium (não WebKit): problemas só do iPhone só aparecem no aparelho real. | Marco no iPhone: conversa, modo decisão, histórico e layout OK |
| 2026-11-18 | BUILD onda 4 | Ferramenta `sugerir_memoria` (strict, ≤ 3, Zod, sem repetir), salvar/descartar sugestão, CRUD de memórias, cartão 🧠 e aba José sabe. Testada pelo Marco no iPhone com a chave real. | Logs do Worker ativados (`[observability]`); o log `ia ok` traz `ferramentasChamadas` e `sugestoesAceitas`. Na 1ª tentativa o cartão não apareceu porque o prompt era conservador demais ("prefira nenhuma a uma sugestão fraca"): agora o José sugere quando o Marco conta algo duradouro, mesmo sem pedir. `scroll-padding-bottom` por causa da barra de abas; Esc sai da edição. | Marco no iPhone: cartão 🧠 aparece quando pede para guardar; falta reavaliar com fatos ditos de forma indireta |
| 2026-11-18 | Perfil do Marco (pasta de coaching no Drive) | Lidos Gallup, DISC e análise de inteligência emocional (resultados do próprio Marco); sessões e programa de coaching são modelos em branco; arquivos "Fábio Bessa" (outra pessoa) NÃO foram abertos nem usados. 7 memórias gravadas direto no D1 remoto (origem `manual`, 6 em `sobre_mim` e 1 em `trabalho`): DISC, não gosta de ser controlado, Gallup, tranquilidade para pensar, inteligência emocional, risco de sobrecarga e formação em coaching. | Combinado com o Marco: aplicar as técnicas de coaching DEPOIS da onda 5, num ajuste de prompt: metas com a boa formulação (positiva, depende dele, como saberá que chegou, o que impede, 1º passo), "travei" com perguntas focadas na solução, tom com opções e desafios (não ordens) e corte da análise em excesso rumo ao 1º passo; GROW + perdas e ganhos entram no modo decisão (onda 6). Relatórios são de 2022/2023; podem estar desatualizados. | Marco aprovou os textos das memórias |
| 2026-11-18 | BUILD onda 5 | Cartões 📌/🎯, aba Tarefas e Metas (ordenação da regra 5, concluir/apagar com Desfazer, cache offline só leitura), contexto da IA com tarefas e metas, jornada À noite no prompt. Corrigido após revisão e teste de telas: toast cobrindo controles (reserva de espaço), menu ⋯ que abre para cima, contraste do placeholder e texto digitado que sumia durante a carga. Publicado. | Perfil profissional do Marco lido no LinkedIn via Apify (actor harvestapi/linkedin-profile-scraper, ~US$ 0,004) e 5 memórias de trabalho gravadas direto no D1 ("mais de 17 anos", corretor desde 2009, carreira sempre comercial). Pendências: se o Marco enviar mensagem enquanto a conversa de hoje ainda carrega, o envio é abortado; `npm run golden` com chave real; `origem` `boas_vindas` em tarefa/meta não consta na tabela de entidades de dados.md. | aguardando o Marco no iPhone |
