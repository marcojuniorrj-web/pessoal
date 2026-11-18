# Usuários

## Perfis
| Perfil | Quem é | Objetivo | Dispositivo/momento de uso |
|--------|--------|----------|----------------------------|
| **Marco** (único usuário) | Dono do app. Gerente comercial com TDAH. | Organizar o dia, destravar decisões, planejar o futuro e descarregar a cabeça, tudo num lugar só. | Principalmente o **celular** (PWA), às vezes o computador. Em quatro momentos: **ao acordar** (planejar o dia), **travado no meio do dia** (começar ou retomar o foco), **antes de uma decisão** (pensar junto) e **à noite** (descarregar e preparar o amanhã). |
| **José** (assistente de IA, não é pessoa) | O assistente dentro do app. | Responder de forma **direta e curta**, um próximo passo por vez, usando o que sabe sobre o Marco. | Responde sempre que o Marco escreve ou manda áudio. |

Só **1 pessoa** usa o app. Não há outros perfis humanos (sem família nem equipe no MVP).

## Permissões
| Ação | Marco | José (IA) |
|------|-------|-----------|
| Conversar (texto e voz) | Sim | Responde |
| Ver o histórico de conversas | Sim | Lê para dar contexto |
| Apagar uma conversa | Sim | Não |
| Apagar uma mensagem (ou a pergunta com a resposta) dentro do Chat | Sim (com Desfazer) | Não |
| Ver, editar e apagar as **memórias** (fatos sobre o Marco) | Sim | Só **sugere** novas memórias |
| Editar uma sugestão antes de salvar | Sim | Não |
| Criar tarefa ou meta | Sim | Só **sugere**. Nada é salvo sem o OK do Marco |
| Editar, concluir ou apagar tarefa/meta | Sim | Não |
| Acessar o app | Só com a conta Google do Marco (e-mail verificado) | — |
| Sair deste aparelho / de todos os aparelhos | Sim | — |
| Apagar todos os dados | Sim (confirmação dupla) | Não |

Regra-chave: **o José nunca salva nada sozinho**. Toda tarefa, meta ou memória sugerida aparece como
cartão com os botões "Salvar", "Editar" e "Descartar".

## Jornadas (passo a passo por perfil)

**Primeiro acesso**
1. Abre o link no celular e toca em "Entrar com Google". Só o e-mail do Marco é aceito.
2. O José começa uma **conversa de boas-vindas** com 5 perguntas rápidas: rotina, áreas da vida, metas
   principais, o que mais trava e o horário em que acorda e dorme. Dá para **Pular**, e o chat nunca fica bloqueado.
   Se o Marco fechar o app no meio, a conversa continua de onde parou.
3. No fim, o José mostra "O que aprendi sobre você", uma lista de memórias marcáveis. O Marco confirma as que quer
   e toca em "Salvar selecionadas".
4. No Chat aparece, uma única vez, a faixa "Instalar na tela inicial".

**Ao acordar**
1. Abre o app e já cai no chat.
2. Escreve ou fala: "o que eu faço hoje?".
3. O José responde com até 3 prioridades e o primeiro passo, e sugere salvar como tarefas.
4. O Marco toca em "Salvar" nas que quiser.

**Travado no meio do dia**
1. Manda um áudio: "não consigo começar o relatório".
2. O José devolve 1 passo pequeno (de até 5 minutos) e pergunta se quer o próximo.

**Antes de uma decisão**
1. Escreve: "aceito a proposta X ou fico?".
2. O José faz até 3 perguntas para entender, depois mostra prós e contras em lista curta e dá uma recomendação.
3. Opcional: sugere uma tarefa ("responder até sexta").

**À noite**
1. Despeja tudo o que está na cabeça, por texto ou voz.
2. O José organiza em tarefas, ideias e preocupações. Ideias e preocupações ficam só no texto; o que for ação vira cartão de tarefa (no máximo 3) para salvar para amanhã.

## Histórias de usuário do MVP (com critério de aceite)

1. **Entrar com segurança.** Como Marco, quero entrar com a minha conta Google, para que só eu acesse meus dados.
   - Aceite: o login Google funciona. Outro e-mail recebe "acesso negado". A sessão continua aberta no celular, sem relogar todo dia.
2. **Conversar por texto.** Como Marco, quero escrever para o José e receber resposta curta, para destravar rápido.
   - Aceite: a resposta começa a aparecer em até 3 segundos. O padrão é até ~5 linhas e 1 próximo passo, salvo se eu pedir mais.
3. **Conversar por voz.** Como Marco, quero mandar áudio, para usar na rua ou sem paciência de digitar.
   - Aceite: com o campo vazio, o botão da direita é o 🎤; tocar nele grava (contador regressivo a partir de 2:00, ✕ cancela) e tocar em ■ para e envia; aos 2:00 para sozinho e envia. O áudio vira texto, é enviado como mensagem de voz (balão com 🎤) e o José responde. Áudio com menos de 1 s é descartado. Com texto digitado, o botão é Enviar. Se a transcrição falhar, o microfone for negado ou o limite de 60 transcrições por dia acabar, aparece um aviso claro e nada se perde. Funciona no PWA do iPhone e do Android; o áudio nunca é guardado.
4. **José me conhece.** Como Marco, quero que o José use o que sabe sobre mim, para as respostas não serem genéricas.
   - Aceite: as memórias salvas entram no contexto de toda conversa. A resposta cita minha rotina ou minhas metas quando for relevante.
5. **Ver e controlar memórias.** Como Marco, quero ver, editar e apagar o que o José sabe sobre mim, para manter a privacidade.
   - Aceite: a tela "O que o José sabe" lista as memórias por área. Editar e apagar funcionam. Uma memória apagada não volta a ser usada.
6. **Sugestões viram tarefas e metas.** Como Marco, quero que o José sugira tarefas e metas e eu confirme, para nada se perder sem eu ter que organizar.
   - Aceite: a sugestão aparece como cartão Salvar/Editar/Descartar, com no máximo 3 por resposta. A tarefa salva vai para uma lista simples, onde dá para concluir (com Desfazer) e apagar (com Desfazer). Nada é salvo sem toque meu.
7. **Boas-vindas.** Como Marco, quero uma conversa inicial curta, para o José já começar me conhecendo.
   - Aceite: são no máximo 5 perguntas. Dá para pular. As respostas viram memórias confirmadas.
8. **Histórico.** Como Marco, quero rever conversas antigas, para retomar um raciocínio.
   - Aceite: a lista de conversas mostra data e título automático. Dá para abrir e apagar.
8b. **Apagar e situar no tempo.** Como Marco, quero apagar uma mensagem ou a conversa inteira sem sair do Chat e ver a hora de cada mensagem, para limpar o que não quero guardar e saber quando cada coisa foi dita.
   - Aceite: segurando um balão (pressão longa) abre a folha de ações com "Copiar", "Apagar mensagem" e, nas minhas mensagens com resposta, "Apagar mensagem e resposta"; o topo do Chat tem ⋯ → "Apagar conversa". Tudo some na hora, com "Apagado. Desfazer" por 5 s. Se eu apagar todas as mensagens de uma conversa, ela também é apagada (com o aviso "Conversa vazia apagada."), depois dos 5 s do Desfazer. Itens já salvos a partir dos cartões permanecem. Cada balão mostra a hora (24 h, meu fuso) e há separadores "Hoje", "Ontem" e data. Apagar não libera o limite diário de respostas.
9. **Decidir com mais profundidade.** Como Marco, quero um modo de decisão, para pensar melhor nas escolhas importantes.
   - Aceite: o atalho "⚖️ Preciso decidir" abre a conversa em "Modo decisão", respondida pelo modelo profundo. O José faz até 3 perguntas, mostra prós e contras curtos e dá uma recomendação.
10. **Controle e privacidade.** Como Marco, quero sair de todos os aparelhos e apagar todos os meus dados, para me proteger se perder o celular.
   - Aceite: "Sair de todos os aparelhos" derruba todas as sessões, e um cookie antigo passa a receber 401. "Apagar todos os meus dados", com confirmação dupla, não deixa nenhuma linha minha no banco.
