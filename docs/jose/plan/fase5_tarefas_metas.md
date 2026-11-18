# Fase 5: Tarefas e metas a partir da conversa

## Entrega
O José sugere 📌 tarefas e 🎯 metas em cartões, e o Marco salva com um toque.
A aba **Tarefas** mostra as pendentes na ordem certa (atrasadas, hoje, próximas, sem prazo), permite concluir com "Feito! Desfazer", editar, apagar com "Desfazer" e adicionar à mão.
A sub-aba **Metas** mostra a lista simples de metas.
O José passa a considerar as tarefas e as metas ao responder.

## Depende de
Fase 4 (ferramentas, cartões e rotas de sugestão).

## Tarefas (prompts pequenos)
- [x] 5.1 Ligar `sugerir_tarefa` e `sugerir_meta` (conversão de "sexta" em data pelo contexto) e salvar sugestões desses tipos. **Aceite:** testes de salvar tarefa e meta a partir de uma sugestão, com `origem = chat`.
- [x] 5.2 Ordenação da regra 5 e CRUD `/api/tarefas` (concluir grava `concluida_em`, desfazer limpa). **Aceite:** testes de todos os desempates com relógio fixo e de posse.
- [x] 5.3 CRUD `/api/metas` (status `ativa`/`concluida`). **Aceite:** testes de validação e de posse.
- [ ] 5.4 As tarefas pendentes (até 50) e as metas ativas entram no contexto. **Aceite:** caso golden — com 3 tarefas, uma delas atrasada, "o que faço hoje?" prioriza a atrasada.
- [ ] 5.5 CartaoSugestao para tarefa e meta: edição com chips de área e seletor de prazo (opcional); "✓ Salvo em Tarefas". **Aceite:** testes de componente.
- [ ] 5.6 Aba Tarefas:
  - sub-abas Tarefas e Metas;
  - círculo de concluir com "Feito! Desfazer";
  - editar, apagar com "Desfazer" e "+ Adicionar";
  - seções recolhidas "Concluídas";
  - estados esqueleto, vazios e erro.

  **Aceite:** teste Playwright do fluxo completo; no máximo 7 itens visíveis sem rolar numa tela de 390px.
- [ ] 5.7 Jornada "À noite": o prompt orienta que ideias e preocupações fiquem no texto e que só ações virem cartões (no máximo 3). **Aceite:** caso golden de "descarregar a cabeça" com no máximo 3 cartões de tarefa.

## Como testar (roteiro para o Marco)
1. No Chat, toque em "🌙 Descarregar a cabeça" e despeje: "ligar pro banco, revisar proposta do cliente até sexta, quero correr uma meia-maratona ano que vem, tô preocupado com o caixa".
2. Aparecem até 3 cartões: tarefas (a proposta com prazo na sexta) e talvez uma meta (meia-maratona). Salve os que quiser.
3. Abra a aba **Tarefas**: a proposta aparece com o prazo de sexta. Conclua e toque em "Desfazer". Conclua de novo.
4. Abra **Metas**: a meia-maratona está lá.
5. Adicione uma tarefa à mão com prazo de ontem: ela sobe para o topo como atrasada.
6. Volte ao Chat e pergunte "o que faço hoje?". O José deve citar a tarefa atrasada.
