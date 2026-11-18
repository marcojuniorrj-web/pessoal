# Fase 6: Boas-vindas e modo decisão

## Entrega
No primeiro acesso, o José faz 5 perguntas fixas (uma por vez, com respostas rápidas), que dá para pular e que continuam de onde pararam se o app for fechado, e mostra "O que aprendi sobre você" (lista marcável e editável) para o Marco confirmar as memórias de uma vez.
O atalho **"⚖️ Preciso decidir"** abre o **Modo decisão**, respondido pelo modelo mais profundo, com a 1ª pergunta vinda do próprio José e o coaching do Marco: só as perguntas que faltam (até 3), ganhos e perdas curtos, congruência, uma recomendação e o primeiro passo como cartão de tarefa.
Ajustes ganha "Refazer boas-vindas" e "Instalar na tela inicial", José sabe (vazio) ganha "Fazer as boas-vindas", e o Chat mostra uma vez a faixa "Instalar na tela inicial".

## Depende de
Fase 4 (memórias e cartões). A Fase 5 ajuda (sugestão de tarefa na decisão), mas não bloqueia.

## Tarefas (prompts pequenos)
- [x] 6.1 Roteiro das 5 perguntas fixas (`compartilhado/boasvindas.ts`: texto, respostas rápidas, etapa calculada pelas mensagens) e a seção `BOASVINDAS` do prompt: a chamada final gera até 8 sugestões de memória (com as memórias atuais no contexto ao refazer). **Aceite:** o caso golden `boasvindas-memorias` (conferência automática testada sem rede) exige memórias coerentes com as respostas e sem repetir as existentes; `npm run golden` com chave real só pelo Marco.
- [x] 6.2 Backend das boas-vindas:
  - `POST /api/conversas {tipo: boas_vindas}` grava a 1ª pergunta (sem IA);
  - `POST .../mensagens` numa conversa de boas-vindas devolve a próxima pergunta fixa (4 primeiras respostas) ou chama a IA (5ª), 409 na 6ª;
  - `GET /api/eu` devolve a conversa em aberto; `POST /api/eu/boas-vindas`;
  - `POST /api/conversas/:id/sugestoes/lote`, numa transação (salva, descarta e conclui);
  - o Histórico e a "conversa de hoje" ignoram a conversa de boas-vindas, que nunca é apagada por ficar vazia.

  **Aceite:** testes de retomada, de pular, das 5 etapas, do lote (inclusive reenvio e posse) e do filtro do Histórico.
- [x] 6.3 Tela Boas-vindas (mesma interface do Chat, sem barra de abas): "Pergunta N de 5", respostas rápidas, Pular sempre visível, retomada, lista marcável e editável com "Salvar selecionadas" e erro de rede sem perder o que foi marcado ou editado. **Aceite:** teste Playwright — fechar na pergunta 3, reabrir, continuar e salvar 2 de 4 memórias; 320 e 390 px sem rolagem lateral, documento sem rolar, alvos de 48 px, texto de 300 caracteres e palavra de 80; testes de unidade da lógica de retomada e de etapas.
- [x] 6.4 Roteamento depois do login: com as boas-vindas não concluídas, cria a conversa (se não houver) ou retoma a em aberto e vai para Boas-vindas; concluídas, vai para o Chat (a flag manda). "Refazer boas-vindas" em Ajustes e "Fazer as boas-vindas" no vazio de José sabe passam a funcionar. **Aceite:** testes dos dois caminhos (unidade e Playwright).
- [ ] 6.5 Modo decisão com o coaching do Marco: o atalho cria a conversa com `modo = decidir` (modelo profundo, selo "Modo decisão") e envia "Preciso decidir"; a pergunta inicial vem do José (texto fixo só como alternativa offline/erro); a seção `DECIDIR` reescrita (abertura curta, até 3 perguntas só as que faltam, ganhos e perdas, congruência, recomendação e primeiro passo como cartão de tarefa; sem citar GROW/SLAC/DISC/Gallup). **Aceite:** testes de unidade do prompt (sem teoria citada) e casos golden `decisao-abertura`, `decisao-coaching` e `decisao-coaching-completa` (conferência sem rede); o `usage` registra o modelo profundo.
- [ ] 6.6 Faixa "Instalar na tela inicial", uma única vez depois das boas-vindas, com a instrução para iPhone (Compartilhar → Adicionar à Tela de Início); o mesmo item em Ajustes. **Aceite:** não aparece de novo depois de fechada, nem com o app já instalado (testes de unidade e Playwright).

## Como testar (roteiro para o Marco)
1. Em Ajustes, toque em "Refazer boas-vindas" (ou entre pela 1ª vez). Responda 2 perguntas e feche o app.
2. Reabra: o app continua na pergunta 3. Termine as 5.
3. Em "O que aprendi sobre você", desmarque uma memória, edite outra e toque em "Salvar selecionadas". Confira em **José sabe**.
4. No Chat, toque em **✎ (nova conversa)** e depois em "⚖️ Preciso decidir". O José responde "Qual é a decisão?". Escreva: "fico na Unnità ou aceito uma proposta para gerenciar outra equipe?".
5. O José faz só as perguntas que faltam (até 3), depois mostra ganhos e perdas curtos de cada opção, uma recomendação e o primeiro passo (como cartão de tarefa). O topo mostra "Modo decisão".
6. Em Ajustes, confira "Instalar na tela inicial" (no iPhone mostra a instrução) e, ao terminar as boas-vindas, a faixa que aparece uma vez no Chat.
