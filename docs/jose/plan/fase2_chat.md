# Fase 2: Conversar com o José por texto

## Entrega
O Marco conversa com o José por texto:
- a resposta chega em streaming, curta e direta, no tom combinado;
- os atalhos "O que faço hoje?", "Travei" e "Descarregar a cabeça" funcionam;
- dá para abrir conversas antigas na gaveta de Histórico, apagar com "Desfazer" e começar uma nova;
- erros, falta de internet e o limite diário têm mensagens claras, e "Tentar de novo" não duplica nada.

## Depende de
Fase 1.

## Tarefas (prompts pequenos)
- [ ] 2.1 Escrever `prompt-jose.md` (regras de arquitetura.md §4) e 4 casos "golden", um por momento do dia. **Aceite:** um script roda os 4 casos no Haiku e confere: no máximo ~5 linhas, 1 próximo passo e nenhum conselho médico ou financeiro profissional. O resultado é revisado pelo Marco.
- [x] 2.2 Montador de contexto (regra 1 de dados.md): ordem sistema → memórias → metas → tarefas (até 50) → ponto de cache → data/hora → 20 mensagens em texto puro. **Aceite:** teste de snapshot da ordem e dos limites; data/hora ficam depois do ponto de cache.
- [x] 2.3 Adaptador Claude: streaming, troca entre `MODELO_PADRAO` e `MODELO_PROFUNDO`, `cache_control`, captura do `usage`, fallback de recusa no modelo profundo e erros tipados. **Aceite:** testes com a API simulada cobrindo texto em partes, erro 5xx e recusa.
- [ ] 2.4 Módulo de conversas: `POST /api/conversas`, `GET /api/conversas`, `GET /api/conversas/hoje`, `GET /api/conversas/:id` e `DELETE /api/conversas/:id`, com posse checada. **Aceite:** testes de cada rota; a conversa de outro usuário devolve 404; a regra 12 é testada com relógio fixo.
- [ ] 2.5 `POST /api/conversas/:id/mensagens` com SSE (`texto`, `fim`, `erro`):
  - grava a mensagem do Marco antes de chamar a IA;
  - **id repetido não duplica** (regra 11);
  - grava a resposta com `modelo` e tokens;
  - responde 429 no limite diário (`LIMITE_MENSAGENS_DIA`);
  - atualiza `atualizada_em`.

  **Aceite:** teste de retry com o mesmo id (sem duplicata) e teste do limite.
- [ ] 2.6 Título automático (Haiku, até 6 palavras), com fallback nos 40 primeiros caracteres; sai no evento `fim`. **Aceite:** teste com a IA falhando usa o fallback.
- [ ] 2.7 Tela Chat: balões, streaming, "José está pensando…", teclado que sobe, abrir na "conversa de hoje", atalhos de início e "Nova conversa" no topo. **Aceite:** a primeira parte da resposta aparece em até 3 s (medido no Playwright contra a API simulada e manualmente contra a real).
- [ ] 2.8 Estados do Chat: erro e resposta interrompida mostram **Tentar de novo** (mesmo id), mais offline, limite diário e rascunho guardado em caso de 401. **Aceite:** testes Playwright de cada estado com a API simulada.
- [ ] 2.9 Gaveta de Histórico: grupos, hora ou data, esqueleto, vazio e erro; apagar com "Desfazer" (espera 5 s antes de chamar a API); apagar a conversa aberta leva ao Chat vazio. **Aceite:** teste Playwright de apagar → desfazer, em que nada é apagado.

## Como testar (roteiro para o Marco)
1. Abra o app: aparece a saudação com os 4 atalhos.
2. Toque em "☀️ O que faço hoje?". O José responde curto, com 1 próximo passo.
3. Escreva "travei no relatório de vendas". A resposta deve ser um passo pequeno, de até 5 minutos.
4. Toque em **+ Nova**, converse sobre outro assunto e abra o ☰: as duas conversas aparecem em "Hoje".
5. Apague uma conversa e toque em "Desfazer": ela continua lá. Apague de novo e espere: some.
6. Ligue o modo avião no meio de uma resposta: aparece o erro com "Tentar de novo". Desligue e toque: a resposta vem sem repetir a sua mensagem.
7. Feche e reabra o app: ele volta na conversa de hoje.
