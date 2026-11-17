# Telas

Uso principal: **celular** (PWA). No computador, o conteúdo fica numa coluna central de no máximo 680px e a
barra inferior continua. Referência de interação: **WhatsApp** (balões de conversa).

> Escopo: este arquivo descreve o **MVP enxuto**. O que foi adiado aparece marcado *(V1.1)* e está
> em `plan/versoes-futuras.md`.

## Mapa de navegação
```
Login (Google) ──► [boas-vindas não concluídas?] ──sim──► Boas-vindas (retoma de onde parou) ──► Chat
                        └──não──────────────────────────────────────────────────────────────► Chat

Barra inferior fixa (3 abas):
  Chat ─┬─ ☰ Histórico de conversas ──► abre uma conversa no Chat
        └─ + Nova conversa
  Tarefas (tarefas e metas)
  José sabe (memórias)
     └─ ⚙ Ajustes (← volta para José sabe)
```
**"Conversa de hoje":** o app sempre abre no Chat, na última conversa `normal` atualizada hoje (fuso do Marco).
Se não houver nenhuma, abre o Chat vazio, com os atalhos. A conversa só é criada na 1ª mensagem. Antes de ganhar
título, o topo mostra "Nova conversa".

**Padrões comuns a todas as telas**
- **Apagar** (tarefa, meta, memória, conversa): apaga na hora e mostra o aviso **"Apagado. Desfazer"** por 5 s.
  Não há pergunta de confirmação. Os gestos de deslizar sempre têm uma alternativa visível (⋯).
- **Avisos (toast):** aparecem acima da barra de abas, por 4 s, e um de cada vez.
- **Sessão expirada (401):** leva ao Login guardando o rascunho digitado. Depois de entrar, volta à conversa em que o Marco estava.
- **Offline:** mostra a faixa "Offline" no topo. As abas mostram a última lista carregada, só para leitura, e o envio fica desabilitado.
- **Áreas:** um único mapa de rótulos é usado em todas as telas:
  - `trabalho` → Trabalho;
  - `financas` → Finanças;
  - `saude` → Saúde e rotina;
  - `casa` → Família e casa;
  - `sobre_mim` → Sobre mim (só nas memórias).

## Telas

### 1. Login
- **Perfil:** Marco (antes de entrar).
- **Objetivo:** entrar com segurança com 1 toque.
- **Elementos:** logo e nome "José", a frase "Seu assistente para o dia a dia" e o botão **Entrar com Google**.
- **Ações:** "Entrar com Google" leva às Boas-vindas (enquanto não estiverem concluídas) ou ao Chat.
- **Estados:**
  - carregando: o botão fica com spinner;
  - `?erro=falha`: "Não foi possível entrar. Tente de novo.";
  - `?erro=negado`: "Acesso negado — este app é pessoal.";
  - sucesso: redireciona.
- **Mobile:** botão grande no centro da tela.

### 2. Boas-vindas (1º acesso)
- **Perfil:** Marco.
- **Objetivo:** o José conhecer o Marco em até 5 perguntas.
- **Elementos:**
  - a mesma interface do Chat, sem a barra de abas, com o indicador "Pergunta N de 5" (N conta as respostas do Marco);
  - as 5 perguntas, fixas no código: rotina, áreas da vida, metas principais, o que mais trava, horário de acordar e dormir;
  - botões de resposta rápida quando fizer sentido;
  - link **Pular**, sempre visível.
- **Ações:**
  - responder (texto ou voz) leva à próxima pergunta;
  - se o Marco fechar o app no meio, ele reabre na mesma conversa de boas-vindas e continua de onde parou;
  - no fim, o José mostra **"O que aprendi sobre você"**: a lista de memórias sugeridas, cada uma com uma caixa marcada
    e o texto editável. O botão **Salvar selecionadas** salva as marcadas, descarta as desmarcadas e leva ao Chat;
  - Pular leva ao Chat;
  - em qualquer caso, as boas-vindas ficam concluídas e o chat nunca é bloqueado.
- **Estados:** erro de rede mostra "Sem conexão. Tentar de novo" e mantém as respostas já dadas.
- **Mobile:** igual ao Chat.

### 3. Chat (tela principal)
- **Perfil:** Marco.
- **Objetivo:** conversar com o José para destravar, decidir, planejar e descarregar a cabeça.
- **Elementos:**
  - **Topo:**
    - ☰ (Histórico);
    - título da conversa;
    - **+ Nova**;
    - selo **"Modo decisão"**, quando a conversa está nesse modo.
  - **Área de mensagens:** balões. As mensagens do Marco ficam à direita e as do José à esquerda. Um áudio enviado aparece como balão de texto com o ícone 🎤.
  - **Cartões de sugestão** dentro da conversa, com **no máximo 3 por resposta**:
    - 📌 Tarefa: título, área e prazo (opcional);
    - 🎯 Meta: título, área e prazo (opcional);
    - 🧠 Memória: o fato sobre o Marco e a área.

    Cada cartão tem **Salvar**, **Editar** (título ou texto, chips de área, seletor de prazo) e **Descartar**.
  - **Atalhos de início**, quando a conversa está vazia. São 4 botões:
    - "☀️ O que faço hoje?", "🧱 Travei" e "🌙 Descarregar a cabeça" enviam o próprio texto como 1ª mensagem;
    - **"⚖️ Preciso decidir"** cria a conversa em **modo decisão**, respondida pelo modelo mais profundo, e o José pergunta qual é a decisão.

    Para sair do modo decisão, toca-se em **+ Nova**.
  - **Faixa "Instalar na tela inicial"**, mostrada uma única vez depois das boas-vindas. No iPhone, ela explica: Compartilhar → Adicionar à Tela de Início.
  - **Rodapé:** campo "Fale com o José…", botão 🎤 e botão enviar.
    - O 🎤 funciona com **um toque para gravar e outro para parar e enviar**, e ✕ cancela a gravação.
- **Ações:**
  - **Enviar mensagem:** a resposta do José aparece em streaming.
  - **Salvar no cartão:** o cartão vira "✓ Salvo em Tarefas" (ou "✓ Salvo em José sabe").
  - **Editar:** abre os campos dentro do próprio cartão.
  - **Descartar:** recolhe o cartão, com o aviso "Descartado. Desfazer".
  - **Tentar de novo** (no balão de erro): refaz a resposta do José sem duplicar a mensagem do Marco.
- **Estados:**
  - vazio: saudação conforme o horário ("Bom dia, Marco.") e os 4 atalhos;
  - carregando: "José está pensando…" com três pontinhos;
  - gravando: o microfone fica âmbar, com um contador regressivo a partir de 2:00 que para sozinho ao chegar a zero;
  - áudio com menos de 1 s: é descartado sem aviso;
  - transcrevendo: "Transcrevendo áudio…";
  - erro de transcrição: "Não entendi o áudio. Tenta de novo ou digita.";
  - erro na IA ou resposta interrompida no meio: balão de erro com **Tentar de novo**, sem perder o texto digitado;
  - erro ao salvar um cartão: "Não salvou. Tentar de novo";
  - sem internet: faixa "Offline" e envio desabilitado;
  - limite diário atingido: "Limite de hoje atingido, volta amanhã.";
  - microfone negado: "Libere o microfone nas configurações para usar voz."
- **Mobile:** o campo de digitação sobe junto com o teclado. Botões com pelo menos 48px.

### 4. Histórico de conversas (gaveta lateral do Chat)
- **Perfil:** Marco.
- **Objetivo:** retomar conversas antigas.
- **Elementos:**
  - lista agrupada em Hoje, Ontem, Esta semana e Mais antigas;
  - cada item mostra o título automático e a **hora** (em Hoje e Ontem) ou a **data** (nos outros grupos);
  - busca por título *(V1.1)*.
- **Ações:**
  - tocar numa conversa abre essa conversa no Chat e fecha a gaveta;
  - deslizar (ou ⋯) e **Apagar** mostra o aviso "Apagado. Desfazer";
  - apagar a conversa que está aberta leva ao Chat vazio.
- **Estados:**
  - vazio: "Nenhuma conversa ainda.";
  - carregando: lista em esqueleto;
  - erro: "Não foi possível carregar. Tentar de novo".

### 5. Tarefas (aba)
- **Perfil:** Marco.
- **Objetivo:** ver e concluir o que foi salvo a partir das conversas.
- **Elementos:**
  - Duas abas internas: **Tarefas** e **Metas**.
  - **Tarefas:**
    - lista de pendentes, na ordem da regra 5 (dados.md);
    - cada item tem um círculo de concluir, o título, a etiqueta da área e o prazo;
    - seção recolhida "Concluídas".
  - **Metas:** lista simples com título, área e prazo (se houver). As metas concluídas ficam numa seção recolhida.
  - **+ Adicionar**, em cada aba, abre título, área e prazo (opcional).
  - Ficam para depois:
    - ligação de tarefa a meta e progresso *(V1.1)*;
    - meta pausada *(V1.1)*;
    - filtro por área *(V1.1)*.
- **Ações:**
  - tocar no círculo conclui a tarefa ou a meta, com o aviso "Feito! Desfazer";
  - tocar no item permite editar título, área e prazo;
  - deslizar (ou ⋯) e **Apagar** mostra o aviso "Apagado. Desfazer".
- **Estados:**
  - carregando: esqueleto;
  - vazio em Tarefas: "Nada por aqui. Converse com o José e salve o que importar." e o botão **Ir para o Chat**;
  - vazio em Metas: "Nenhuma meta ainda. Conte ao José o que você quer alcançar.";
  - erro ao salvar: "Não salvou. Tentar de novo".
- **Mobile:** alvos de toque grandes e no máximo 7 itens visíveis sem rolar numa tela de 390px.

### 6. José sabe (aba — memórias)
- **Perfil:** Marco.
- **Objetivo:** ver e controlar tudo o que o José sabe sobre ele.
- **Elementos:**
  - memórias agrupadas por área (Sobre mim, Trabalho, Finanças, Saúde e rotina, Família e casa);
  - cada memória mostra o texto e a data em que foi aprendida;
  - botão **+ Adicionar memória**;
  - ícone ⚙ no topo, que leva a Ajustes.
- **Ações:**
  - tocar na memória permite editar o texto e a área;
  - deslizar (ou ⋯) e **Apagar** mostra o aviso "Apagado. Desfazer";
  - **Adicionar** abre o campo de texto e a escolha da área.
- **Estados:**
  - carregando: esqueleto;
  - vazio: "O José ainda não sabe nada sobre você." e o botão **Fazer as boas-vindas**;
  - erro: "Não foi possível carregar. Tentar de novo";
  - sucesso: aviso "Memória atualizada".

### 7. Ajustes
- **Perfil:** Marco.
- **Elementos:**
  - **←** no topo, que volta a José sabe;
  - conta conectada (foto e e-mail Google);
  - **Instalar na tela inicial** (no iPhone, mostra a instrução);
  - **Refazer boas-vindas**, que mantém as memórias atuais (o José sugere só o que é novo);
  - **Sair**;
  - **Sair de todos os aparelhos**;
  - **Apagar todos os meus dados**;
  - versão do app;
  - Exportar meus dados *(V1.1)*.
- **Ações:**
  - Sair e Sair de todos pedem confirmação simples e voltam ao Login.
  - **Apagar todos os meus dados** pede **confirmação dupla**: primeiro um aviso, depois digitar "APAGAR". Apaga conversas,
    tarefas, metas, memórias e sessões, e volta ao Login. Na próxima entrada, tudo começa do zero.
- **Estados:** apagando: "Apagando…". Erro: "Não foi possível apagar. Tentar de novo".

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
  - Saúde e rotina em rosa;
  - Família e casa em roxo;
  - Sobre mim em cinza.
- **Tipografia** (assumido): Inter, com corpo de 17px no celular e linhas curtas.
- **Logo** (assumido): monograma "J" num círculo âmbar. Também serve de ícone do PWA.
- **Tom de voz:** direto e curto, no máximo ~5 linhas por resposta, 1 próximo passo por vez, sem julgamento e sem "textão". Usa o nome "Marco".
- **Acessibilidade:** contraste AA, suporte a "reduzir movimento", alvos de pelo menos 48px e nenhuma informação transmitida só por cor.
