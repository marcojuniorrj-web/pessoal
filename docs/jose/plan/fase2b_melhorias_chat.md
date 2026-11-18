# Fase 2b: Melhorias do Chat (pedido do Marco, 2026-11-18)

## Entrega
1. **Apagar mensagens e conversas**: dentro do próprio Chat dá para apagar uma mensagem (ou a pergunta com a resposta) e a conversa inteira, sempre com "Apagado. Desfazer" por 5 s e sem pergunta de confirmação.
2. **Horário das mensagens**: cada balão mostra a hora (24 h, no fuso do Marco) e a conversa tem separadores de dia ("Hoje", "Ontem", "seg., 17 de nov.").

## Depende de
Fase 2 (Chat e Histórico) e Fase 4 (cartões de sugestão). Vem antes da Fase 3 (voz) porque mexe nos mesmos arquivos do Chat.

## Regras (também em telas.md, usuarios.md, dados.md e arquitetura.md)
- Cada balão tem um botão **⋯** (alternativa visível a qualquer gesto), alvo de 48 px. O menu tem **"Apagar mensagem"** e, nas mensagens do Marco que têm resposta do José logo depois, **"Apagar mensagem e resposta"**. O menu abre para cima quando não cabe embaixo, fecha com Esc e ao tocar fora, e devolve o foco.
- O topo do Chat ganha **⋯ → "Apagar conversa"** (a gaveta de Histórico continua com o apagar de cada conversa). Apagar a conversa aberta leva ao Chat vazio.
- Apagar mensagem: some da tela na hora, aparece o aviso "Apagado. Desfazer" por 5 s e só depois o app chama a API (Desfazer cancela). Itens já salvos a partir de cartões (tarefas, metas, memórias) **permanecem**; os cartões da resposta apagada somem junto.
- A mensagem apagada deixa de entrar no contexto da IA. Uma resposta do José em andamento (streaming) não pode ser apagada até terminar.
- **API:** `DELETE /api/mensagens/:id?com_resposta=1` (204; posse via conversa → usuário, 404 se não for do Marco; `com_resposta` só vale para mensagem do Marco e apaga também a resposta seguinte do José).
- O limite diário continua contando as respostas feitas no dia, mesmo as apagadas (para apagar não burlar o limite de custo): o servidor guarda a contagem do dia numa tabela `uso_diario(usuario_id, dia, respostas)`.
- **Horário:** o balão mostra `HH:mm` (24 h) na cor secundária, com `<time datetime>` e rótulo acessível ("enviada às 14:32"). Fuso = `fuso_horario` do usuário (de `/api/eu`). Separador de dia: "Hoje", "Ontem" ou "seg., 17 de nov." (sem ano no ano corrente). A mensagem que acabou de chegar mostra a hora ao terminar.
- Layout (iPhone): nada passa da largura em 320/390 px; o ⋯ não pode empurrar o balão para fora; a barra de abas nunca some; toast sem cobrir campo nem cartões; Esc e foco corretos.

## Tarefas (prompts pequenos)
- [ ] 2b.1 Atualizar a SPEC (telas, usuarios, dados, arquitetura) com as regras acima, antes do código. Aceite: os 4 arquivos descrevem o ⋯ do balão, o apagar conversa no topo, a rota, a tabela `uso_diario` e o horário.
- [ ] 2b.2 Migração `0002_uso_diario.sql` e ajuste do limite diário para ler `uso_diario` (incrementa quando o José responde; apagar não decrementa). Aceite: teste em que apagar a resposta não libera o limite; migração aplicada do zero e sobre a existente (preenche o dia de hoje com a contagem atual de respostas).
- [ ] 2b.3 `DELETE /api/mensagens/:id` com `com_resposta`. Aceite: testes de posse (404), só mensagem do Marco aceita `com_resposta`, cascata nas sugestões, itens salvos permanecem, 204 idempotente.
- [ ] 2b.4 Horário e separadores de dia no Chat (função pura testada com fuso e virada do dia 23h59/00h01 em São Paulo; rótulos "Hoje", "Ontem" e data). Aceite: testes de unidade + e2e em 320 e 390 px sem rolagem lateral.
- [ ] 2b.5 Menu ⋯ do balão com "Apagar mensagem" e "Apagar mensagem e resposta", com Desfazer de 5 s, foco e Esc. Aceite: e2e (apagar → Desfazer: nada é chamado; esperar 5 s: DELETE sai; resposta em andamento sem ⋯; menu abre para cima no fim da lista), 320/390/1280.
- [ ] 2b.6 "Apagar conversa" no menu ⋯ do topo do Chat. Aceite: e2e (apaga com Desfazer, leva ao Chat vazio, a gaveta de Histórico reflete).
- [ ] 2b.7 Revisão de layout e acessibilidade das mudanças: contraste do horário ≥ 4,5:1, alvos ≥ 48 px, sem rolagem lateral, `scroll-padding`, toast sem cobrir cartões. Aceite: testes Playwright nos 3 tamanhos.

## Como testar (roteiro para o Marco)
1. Abra o Chat: cada balão mostra a hora; ao rolar para o dia anterior aparece "Ontem".
2. Toque no ⋯ de uma mensagem sua e escolha "Apagar mensagem e resposta": some, aparece "Apagado. Desfazer"; toque em Desfazer e ela volta.
3. Apague uma mensagem do José e espere 5 s: some de vez. Recarregue o app: continua apagada.
4. Em uma resposta com cartão de tarefa já salvo, apague a resposta: a tarefa continua na aba Tarefas.
5. No topo do Chat, ⋯ → "Apagar conversa": vai ao Chat vazio, e a conversa some do Histórico.
