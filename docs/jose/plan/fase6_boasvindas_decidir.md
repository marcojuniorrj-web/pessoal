# Fase 6: Boas-vindas e modo decisão

## Entrega
No primeiro acesso, o José faz 5 perguntas, que dá para pular e que continuam de onde pararam se o app for fechado, e mostra "O que aprendi sobre você" para o Marco confirmar as memórias de uma vez.
O atalho **"⚖️ Preciso decidir"** abre o **Modo decisão**, respondido pelo modelo mais profundo: até 3 perguntas, depois prós e contras curtos, depois uma recomendação.
Ajustes ganha "Refazer boas-vindas", e o Chat mostra uma vez a faixa "Instalar na tela inicial".

## Depende de
Fase 4 (memórias e cartões). A Fase 5 ajuda (sugestão de tarefa na decisão), mas não bloqueia.

## Tarefas (prompts pequenos)
- [ ] 6.1 Roteiro das 5 perguntas fixas, com respostas rápidas e a chamada final que gera N sugestões de memória (com as memórias atuais no contexto ao refazer). **Aceite:** um caso golden gera memórias coerentes com as respostas e não repete memórias existentes.
- [ ] 6.2 Backend das boas-vindas:
  - `POST /api/conversas {tipo: boas_vindas}` faz a 1ª pergunta;
  - `GET /api/eu` devolve a conversa em aberto;
  - `POST /api/eu/boas-vindas`;
  - `POST /api/conversas/:id/sugestoes/lote`, numa transação.

  **Aceite:** testes de retomada, de pular e do lote.
- [ ] 6.3 Tela Boas-vindas: sem barra de abas, "Pergunta N de 5", Pular sempre visível, retomada, lista marcável e editável com "Salvar selecionadas" e erro de rede sem perder as respostas. **Aceite:** teste Playwright — fechar na pergunta 3, reabrir, continuar e salvar 2 de 4 memórias.
- [ ] 6.4 Roteamento depois do login: com as boas-vindas não concluídas, vai para Boas-vindas; senão, para o Chat. "Refazer boas-vindas" em Ajustes e o botão "Fazer as boas-vindas" no vazio de José sabe passam a funcionar. **Aceite:** testes dos dois caminhos.
- [ ] 6.5 Modo decisão: o atalho cria a conversa com `modo = decidir`, que usa `MODELO_PROFUNDO`; selo "Modo decisão" no topo; a instrução do prompt para decisões; sair com "+ Nova". **Aceite:** um caso golden mostra perguntas, depois prós e contras, depois a recomendação; o `usage` registra o modelo profundo.
- [ ] 6.6 Faixa "Instalar na tela inicial", uma única vez depois das boas-vindas, com a instrução para iPhone; o mesmo item em Ajustes. **Aceite:** não aparece de novo depois de fechada ou com o app já instalado.

## Como testar (roteiro para o Marco)
1. Em Ajustes, toque em "Refazer boas-vindas" (ou entre pela 1ª vez). Responda 2 perguntas e feche o app.
2. Reabra: o app continua na pergunta 3. Termine as 5.
3. Em "O que aprendi sobre você", desmarque uma memória, edite outra e toque em "Salvar selecionadas". Confira em **José sabe**.
4. No Chat, toque em **✎ (nova conversa)** e depois em "⚖️ Preciso decidir". Escreva: "fico na Unnità ou aceito uma proposta para gerenciar outra equipe?".
5. O José faz até 3 perguntas, depois mostra prós e contras curtos e uma recomendação. O topo mostra "Modo decisão".
