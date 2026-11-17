# Telas

Uso principal: **celular** (PWA), com layout que se adapta ao computador. Referência de interação: **WhatsApp**
(balões de conversa e áudio segurando o botão).

## Mapa de navegação
```
Login (Google) ──► [1º acesso?] ──sim──► Boas-vindas (chat guiado) ──► Chat
                        └──não──────────────────────────────────────► Chat

Barra inferior fixa (3 abas):
  Chat ─┬─ ☰ Histórico de conversas ──► abre uma conversa no Chat
        └─ + Nova conversa
  Tarefas (tarefas e metas)
  José sabe (memórias)
     └─ ⚙ Ajustes (instalar app, sair)
```
O app sempre abre no **Chat**, na conversa de hoje.

## Telas

### 1. Login
- **Perfil:** Marco (antes de entrar).
- **Objetivo:** entrar com segurança com 1 toque.
- **Elementos:** logo e nome "José", a frase "Seu assistente para o dia a dia" e o botão **Entrar com Google**.
- **Ações:** "Entrar com Google" leva às Boas-vindas (no 1º acesso) ou ao Chat.
- **Estados:**
  - carregando: o botão fica com spinner;
  - erro: "Não foi possível entrar. Tente de novo.";
  - e-mail não autorizado: "Acesso negado — este app é pessoal.";
  - sucesso: redireciona.
- **Mobile:** botão grande no centro da tela.

### 2. Boas-vindas (1º acesso)
- **Perfil:** Marco.
- **Objetivo:** o José conhecer o Marco em até 5 perguntas.
- **Elementos:**
  - a mesma interface do Chat, com indicador "Pergunta 2 de 5";
  - as perguntas: rotina, áreas da vida, metas principais, o que mais trava, horário de acordar e dormir;
  - botões de resposta rápida quando fizer sentido;
  - link **Pular**.
- **Ações:**
  - responder (texto ou voz) leva à próxima pergunta;
  - no fim, aparece o cartão "Salvar o que aprendi?" com a lista de memórias e os botões Salvar e Descartar, e depois o Chat;
  - Pular leva ao Chat.
- **Estados:** erro de rede mostra "Sem conexão. Tentar de novo" e mantém as respostas já dadas.
- **Mobile:** igual ao Chat.

### 3. Chat (tela principal)
- **Perfil:** Marco.
- **Objetivo:** conversar com o José para destravar, decidir, planejar e descarregar a cabeça.
- **Elementos:**
  - Topo: ☰ (Histórico), título da conversa e **+ Nova**.
  - Área de mensagens com balões. As mensagens do Marco ficam à direita e as do José à esquerda. Um áudio enviado aparece com o texto transcrito embaixo.
  - **Cartões de sugestão** dentro da conversa, um de cada tipo:
    - 📌 Tarefa: título, área e prazo opcional;
    - 🎯 Meta: título, área e prazo;
    - 🧠 Memória: o fato sobre o Marco.

    Cada cartão tem **Salvar**, **Editar** e **Descartar**.
  - **Atalhos de início**, quando a conversa está vazia. São 4 botões, um para cada momento:
    - "☀️ O que faço hoje?"
    - "🧱 Travei"
    - "⚖️ Preciso decidir"
    - "🌙 Descarregar a cabeça"
  - Rodapé: campo "Fale com o José…", botão 🎤 (segurar para gravar e soltar para enviar, ou arrastar para cancelar) e botão enviar.
- **Ações:**
  - enviar mensagem: a resposta do José aparece em streaming;
  - Salvar no cartão: o cartão vira "✓ Salvo em Tarefas" (ou em José sabe);
  - Editar abre um campo inline;
  - Descartar recolhe o cartão;
  - **🧠 Pensar melhor**, um link discreto sob a última resposta do José, refaz a resposta com o modelo mais profundo. Conversas abertas por "⚖️ Preciso decidir" já usam esse modelo e mostram um selo "Modo decisão" no topo.
- **Estados:**
  - vazio: saudação conforme o horário ("Bom dia, Marco.") e os 4 atalhos;
  - carregando: "José está pensando…" com três pontinhos;
  - gravando: o microfone fica vermelho e um contador de tempo aparece;
  - transcrevendo: "Transcrevendo áudio…";
  - erro na IA: um balão de erro com **Tentar de novo**, sem perder o texto digitado;
  - sem internet: uma faixa "Offline" no topo e o envio desabilitado;
  - limite diário atingido: "Limite de hoje atingido, volta amanhã.";
  - microfone negado: "Libere o microfone nas configurações para usar voz."
- **Mobile:** o campo de digitação sobe junto com o teclado e o botão 🎤 tem pelo menos 48px.

### 4. Histórico de conversas (gaveta lateral do Chat)
- **Perfil:** Marco.
- **Objetivo:** retomar conversas antigas.
- **Elementos:** lista agrupada em Hoje, Ontem, Esta semana e Mais antigas. Cada item mostra o título automático e a hora. Há um campo de busca por título.
- **Ações:**
  - tocar numa conversa abre essa conversa no Chat;
  - deslizar para a esquerda (ou tocar em ⋯) mostra **Apagar**, que pede confirmação.
- **Estados:**
  - vazio: "Nenhuma conversa ainda.";
  - carregando: lista em esqueleto;
  - erro: "Não foi possível carregar. Tentar de novo".

### 5. Tarefas (aba)
- **Perfil:** Marco.
- **Objetivo:** ver e concluir o que foi salvo a partir das conversas.
- **Elementos:**
  - Duas abas internas: **Tarefas** e **Metas**.
  - Tarefas: lista de pendentes, com as de prazo para hoje ou atrasadas no topo. Cada item tem um círculo de concluir, o título, uma etiqueta da área (Trabalho, Finanças, Saúde, Casa) e o prazo.
  - Uma seção recolhida "Concluídas".
  - Metas: título, área, prazo e as tarefas ligadas a ela (quantas estão feitas do total).
  - Botão **+ Adicionar** para criação manual rápida: título e área.
- **Ações:**
  - tocar no círculo conclui a tarefa e mostra o aviso "Feito! Desfazer";
  - tocar no item permite editar título, área e prazo;
  - deslizar mostra **Apagar**;
  - o filtro por área fica em chips no topo.
- **Estados:**
  - vazio: "Nada por aqui. Converse com o José e salve o que importar." com o botão **Ir para o Chat**;
  - erro ao salvar: aviso "Não salvou. Tentar de novo".
- **Mobile:** alvos de toque grandes e no máximo 7 tarefas visíveis sem rolar.

### 6. José sabe (aba — memórias)
- **Perfil:** Marco.
- **Objetivo:** ver e controlar tudo o que o José sabe sobre ele.
- **Elementos:**
  - Memórias agrupadas por área: Sobre mim, Trabalho, Finanças, Saúde e rotina, Família e casa.
  - Cada memória mostra o texto e a data em que foi aprendida.
  - Botão **+ Adicionar memória**.
  - Ícone ⚙ no topo, que leva a Ajustes.
- **Ações:**
  - tocar na memória permite editar o texto e a área;
  - deslizar mostra **Apagar**, que pede confirmação;
  - **Adicionar** abre um campo de texto e a escolha da área.
- **Estados:**
  - vazio: "O José ainda não sabe nada sobre você." com o botão **Fazer as boas-vindas**;
  - sucesso: aviso "Memória atualizada".

### 7. Ajustes
- **Perfil:** Marco.
- **Elementos:**
  - conta conectada (foto e e-mail Google);
  - **Instalar na tela inicial**, quando disponível;
  - **Refazer boas-vindas**;
  - **Exportar meus dados**, que baixa um arquivo JSON com tudo;
  - **Sair**;
  - versão do app.
- **Ações:** Sair pede confirmação e volta ao Login.

## Identidade visual (marca, cores, tom de voz)
- **Estilo:** calmo e escuro, com pouca informação por tela para reduzir estímulo.
- **Cores** (assumido):
  - fundo `#0F1115`;
  - superfícies `#181B21`;
  - texto `#E8E9EC`;
  - texto secundário `#9AA0AA`;
  - **destaque único** âmbar suave `#F2B25C`, usado só para a ação principal e o botão 🎤;
  - sucesso `#5BC08A`;
  - erro `#E36B6B`.
- **Etiquetas de área** (assumido), discretas e em tons dessaturados:
  - Trabalho em azul;
  - Finanças em verde;
  - Saúde em rosa;
  - Casa em roxo.
- **Tipografia** (assumido): Inter, com corpo de 17px no celular e linhas curtas.
- **Logo** (assumido): monograma "J" num círculo âmbar. Também serve de ícone do PWA.
- **Tom de voz:** direto e curto, no máximo ~5 linhas por resposta, 1 próximo passo por vez, sem julgamento e sem "textão". Usa o nome "Marco".
- **Acessibilidade:** contraste AA, suporte a "reduzir movimento" e nenhuma informação transmitida só por cor.
