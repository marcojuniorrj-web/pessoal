# Telas

Uso principal: **celular** (PWA). No computador, o conteúdo fica numa coluna central de no máximo 680px e a
barra inferior continua. Referência de interação: **WhatsApp** (balões de conversa).

> Escopo: este arquivo descreve o **MVP enxuto**. O que foi adiado aparece marcado *(V1.1)* e está
> em `plan/versoes-futuras.md`.

## Mapa de navegação
```
Login (Google) ──► [boas-vindas não concluídas?] ──sim──► Boas-vindas (cria ou retoma a conversa aberta) ──► Chat
                        └──não──────────────────────────────────────────────────────────────────────────────► Chat
Ajustes › Refazer boas-vindas  e  José sabe (vazio) › Fazer as boas-vindas ──► Boas-vindas (nova conversa) ──► Chat

Barra inferior fixa (3 abas):
  Chat ─┬─ ☰ Histórico de conversas ──► abre uma conversa no Chat
        └─ ✎ Nova conversa
  Tarefas (tarefas e metas)
  José sabe (memórias)
     └─ ⚙ Ajustes (← volta para José sabe)
```
**"Conversa de hoje":** o app sempre abre no Chat, na última conversa `normal` atualizada hoje (fuso do Marco).
Se não houver nenhuma, abre o Chat vazio, com os atalhos. A conversa só é criada na 1ª mensagem. Antes de ganhar
título, o topo mostra "Nova conversa".

**Padrões comuns a todas as telas**
- **Apagar** (mensagem, tarefa, meta, memória, conversa): some da tela na hora e mostra o aviso **"Apagado. Desfazer"** por 5 s.
  Só depois dos 5 s o app chama a API (Desfazer cancela). Não há pergunta de confirmação. Os gestos de deslizar sempre têm uma alternativa visível (⋯).
- **Conversa apagada:** uma conversa que está nos 5 s do Desfazer (por ter perdido a última mensagem) ou que o servidor já não tem nunca é aberta nem continuada: o Chat vai ao Chat vazio, levando o texto que o Marco já digitou ("Conversa apagada." quando foi apagada em outro aparelho). Se um envio ainda assim receber 404 (conversa inexistente), o app cria uma conversa nova e reenvia a mesma mensagem uma única vez.
- **Conferência com o servidor:** depois de apagar uma mensagem e ao voltar o app para a frente, o Chat confere a conversa aberta com o servidor (sem mexer no campo de digitação nem na resposta em andamento). Se a mensagem "apagada" ainda existir lá, aparece "Não foi possível apagar." com "Tentar de novo".
- **Barra de status do iPhone:** uma tampa opaca fixa cobre a área segura do topo; o conteúdo rolado não passa sob o relógio e a bateria.
- **Horário:** as horas mostradas nas conversas usam 24 h (`HH:mm`) e o fuso do Marco (`fuso_horario` de `/api/eu`).
- **Avisos (toast):** aparecem acima da barra de abas (nas boas-vindas, que não têm barra, acima do campo), por 4 s, e um de cada vez.
- **Barra de abas:** só as Boas-vindas não a mostram (por desenho); em todas as outras telas ela está sempre lá.
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
- **Objetivo:** o José conhecer o Marco em 5 perguntas, e o Marco confirmar o que ele aprendeu.
- **Elementos:**
  - a mesma interface do Chat (balões, campo, 🎤/enviar e voz), **sem a barra de abas** (a única tela sem ela, por desenho) e sem ☰, ✎ e ⋯;
  - topo com "Boas-vindas", o indicador **"Pergunta N de 5"** (N = respostas do Marco + 1; conta as respostas do Marco, não as perguntas) e o link **Pular**, sempre visível (alvo de 48px, inclusive na lista final);
  - as **5 perguntas são fixas no código** (nada de IA para perguntar), feitas **uma por vez**: 1) rotina de um dia normal; 2) áreas da vida que quer organizar; 3) metas principais; 4) o que mais trava; 5) horário de acordar e dormir;
  - **respostas rápidas** (botões de 48px acima do campo) quando fazem sentido: na 2 (Trabalho, Finanças, Saúde e rotina, Família e casa, que **entram no campo** para escolher mais de uma), na 4 e na 5 (tocar **envia** a resposta). A 1 e a 3 são livres. Escrever ou falar sempre vale.
- **Ações:**
  - responder (texto, voz ou botão) leva à próxima pergunta;
  - **retomada:** se o Marco fechar o app no meio, ele reabre na mesma conversa de boas-vindas (o app a descobre por `GET /api/eu`) e continua de onde parou, com o indicador certo;
  - depois da 5ª resposta o José faz **uma chamada** que gera as sugestões de memória (só memória, até 8) a partir das respostas; o app mostra **"O que aprendi sobre você"**: uma **lista marcável** no lugar do campo de digitação. Cada item tem uma **caixa marcada** (alvo de 48px), o **texto editável** (até 300 caracteres, com contador) e os **chips de área**. O botão **Salvar selecionadas** (sempre visível, fixo abaixo da lista) salva as marcadas, descarta as desmarcadas, **tudo numa só operação**, e leva ao Chat;
  - **Pular** leva ao Chat sem salvar nada;
  - em qualquer caso, as boas-vindas ficam concluídas e o chat nunca é bloqueado. O roteamento nunca prende quem já concluiu: com as boas-vindas concluídas o app abre o Chat.
- **Refazer** (Ajustes › Refazer boas-vindas, ou o botão do vazio de José sabe): abre **uma nova conversa de boas-vindas** com as mesmas 5 perguntas. A chamada final recebe as memórias atuais e sugere **só o que é novo ou mudou** (o servidor também descarta o que repete uma memória existente). Se a lista ficar vazia, o José diz que não tem nada novo e o botão vira **Concluir**.
- **A conversa de boas-vindas** não aparece no Histórico, não é "a conversa de hoje" e nunca é apagada automaticamente quando fica vazia. Nela não há apagar mensagem (pressão longa) nem cartões no balão: as sugestões só existem na lista marcável.
- **Estados:**
  - carregando: esqueleto; erro ao abrir: "Não foi possível carregar." + Tentar de novo;
  - o José está preparando o resumo: "José está pensando…"; se falhar, balão de erro com **Tentar de novo** (as respostas já dadas ficam);
  - erro de rede ao salvar a lista: "Sem conexão." + **Tentar de novo**, mantendo as marcações e os textos editados; qualquer outro erro: "Não foi possível salvar." + Tentar de novo;
  - texto de memória vazio em item marcado: "Escreva o texto ou desmarque."; o botão fica desabilitado.
- **Mobile:** igual ao Chat. O documento não rola (só a lista); nada passa da largura em 320px e 390px, mesmo com texto de 300 caracteres e palavra de 80 caracteres; o aviso (toast) nunca cobre o campo, as respostas rápidas nem o botão Salvar selecionadas.

### 3. Chat (tela principal)
- **Perfil:** Marco.
- **Objetivo:** conversar com o José para destravar, decidir, planejar e descarregar a cabeça.
- **Elementos:**
  - **Topo:**
    - ☰ (Histórico, que lista só conversas normais: a de boas-vindas não aparece);
    - título da conversa ("Nova conversa" ou, no modo decisão antes de ter título, "Decisão");
    - **✎ (nova conversa)**;
    - **⋯** (alvo de 48px) com **"Apagar conversa"** (aparece quando há uma conversa aberta);
    - selo **"Modo decisão"**, quando a conversa está nesse modo.
  - **Área de mensagens:** balões. As mensagens do Marco ficam à direita e as do José à esquerda. Um áudio enviado aparece como balão de texto com o ícone 🎤.
    - **Horário:** cada balão mostra a hora (`HH:mm`, 24 h, cor secundária) e, entre mensagens de dias diferentes, há um **separador de dia**: "Hoje", "Ontem" ou a data curta ("seg., 17 de nov."; sem o ano quando é o ano corrente). A mensagem que acabou de chegar mostra a hora quando termina. A hora é um `<time datetime>` com rótulo acessível ("enviada às 14:32").
    - **Apagar e copiar por pressão longa (como no WhatsApp):** segurar o balão por ~450 ms abre uma **folha de ações** na parte de baixo da tela (acima da barra de abas e do teclado, com fundo escurecido) com **"Copiar"**, **"Apagar mensagem"** e, nas mensagens do Marco que têm resposta do José logo depois, **"Apagar mensagem e resposta"**, mais **"Cancelar"**. A folha fecha com Esc, tocando fora ou em Cancelar; o foco fica preso nela e volta ao balão ao fechar; alvos de 48px. Não há botão ⋯ em cada balão (a tela fica limpa). Se o dedo se mover mais de ~10px (é rolagem) ou soltar antes do tempo, nada abre e a lista rola normalmente; enquanto segura, o balão fica levemente realçado (e vibra de leve, se o aparelho permitir). O balão tem `user-select: none` e `-webkit-touch-callout: none` para o iOS não abrir a própria lupa/menu; o texto continua copiável pela ação "Copiar".
    - **Alternativas à pressão longa:** o balão é focável (Tab); Enter, a tecla de menu de contexto ou Shift+F10 abrem a mesma folha; o clique com o botão direito também; no computador (mouse) aparece um **⋯** discreto ao passar o mouse ou focar no balão. A resposta do José em andamento (streaming) ou com erro não abre a folha.
  - **Cartões de sugestão** dentro da conversa, com **no máximo 3 por resposta**:
    - 📌 Tarefa: título, área e prazo (opcional);
    - 🎯 Meta: título, área e prazo (opcional);
    - 🧠 Memória: o fato sobre o Marco e a área.

    Cada cartão tem **Salvar**, **Editar** (título ou texto, chips de área, seletor de prazo) e **Descartar**.
  - **Atalhos de início**, quando a conversa está vazia. São 4 botões:
    - "☀️ O que faço hoje?", "🧱 Travei" e "🌙 Descarregar a cabeça" enviam o próprio texto como 1ª mensagem;
    - **"⚖️ Preciso decidir"** cria a conversa em **modo decisão**, respondida pelo modelo mais profundo, e envia "Preciso decidir" como 1ª mensagem: **a pergunta inicial ("Qual é a decisão?") é a resposta real do José**, não um texto fixo do app. O texto fixo ("Qual é a decisão?" na tela vazia do modo) só aparece como alternativa se a conversa estiver vazia (ex.: sem rede na criação).
    - **Como o José conduz o modo decisão** (arquitetura.md §4): uma pergunta curta de abertura, no máximo 3 perguntas depois (uma por vez, só as que faltam), **ganhos e perdas** de cada opção em linhas curtas, uma pergunta de congruência com o que importa para o Marco (quando fizer sentido) e **uma recomendação clara com o primeiro passo**, oferecido como cartão de tarefa (com prazo se ele disse). Se a 1ª mensagem já traz informação suficiente, o José não pergunta nada e vai à recomendação. Respostas curtas, sem teoria e sem aconselhamento médico, jurídico ou financeiro profissional.

    Para sair do modo decisão, toca-se em **✎ (nova conversa)**.
  - **Faixa "Instalar na tela inicial"**, mostrada **uma única vez** logo depois das boas-vindas (ao salvar ou ao pular), entre o topo e as mensagens, com **✕** (48px) para fechar. No iPhone ela explica: **Compartilhar → Adicionar à Tela de Início**; nos outros aparelhos, o botão Instalar quando o navegador oferece, senão a dica do menu do navegador. **Não aparece** se o app já está instalado (modo standalone), nem de novo depois de fechada, nem com o teclado aberto. O estado fica no aparelho (`localStorage`).
  - **Rodapé:** campo "Fale com o José…" e **um único botão de ação à direita**, como no WhatsApp: com o campo **vazio** ele é o **🎤** (ícone SVG, `aria-label` "Gravar áudio"); com texto digitado vira **Enviar**. A voz nunca apaga o que o Marco digitou: se já há texto no campo, o botão é Enviar.
    - **Gesto por toque, não por segurar:** tocar no 🎤 começa a gravar (a 1ª vez o aparelho pede a permissão do microfone). Durante a gravação o rodapé vira uma **barra de gravação**: **✕** (cancelar, descarta o áudio) à esquerda; no meio um ponto âmbar pulsante (parado com "reduzir movimento") e o **contador regressivo** a partir de 2:00 (`m:ss`); **■** (parar e enviar) à direita, no lugar do 🎤. Aos 2:00 a gravação para sozinha e é enviada. Esc cancela (não quando uma folha, o menu ⋯ ou a gaveta estão abertos: aí o Esc fecha só eles).
    - Depois de parar, a barra mostra "Transcrevendo áudio…" e o texto transcrito é **enviado como mensagem** com `origem = voz`: balão do Marco com um ícone 🎤 pequeno (`aria-label` "Enviado por voz") e o texto; o José responde normalmente. A mensagem de voz segue as mesmas regras das de texto (pressão longa, Copiar, Apagar com Desfazer, conversa vazia some).
    - **Offline, ou enquanto o José ainda responde:** o 🎤 fica desabilitado, como o Enviar. Se na hora de enviar o texto transcrito o José já estiver respondendo (ou a rede cair), o texto vai para o campo para o Marco enviar, sem perder nada.
    - O microfone é liberado (`stream.getTracks().forEach(t => t.stop())`) ao cancelar, ao enviar, ao trocar de aba, conversa ou rota, ao desmontar o Chat e quando o app vai para o segundo plano (`visibilitychange` hidden): nesse caso a gravação é **cancelada** e, ao voltar, aparece "Gravação cancelada (o app saiu da tela)". Nenhum timer fica solto.
    - O rascunho do campo (localStorage por conversa) não é perdido ao gravar.
- **Ações:**
  - **Enviar mensagem:** a resposta do José aparece em streaming.
  - **Salvar no cartão:** o cartão vira "✓ Salvo em Tarefas" (ou "✓ Salvo em José sabe").
  - **Editar:** abre os campos dentro do próprio cartão.
  - **Descartar:** recolhe o cartão, com o aviso "Descartado. Desfazer".
  - **Apagar mensagem (folha de ações do balão):** a mensagem (ou a pergunta com a resposta) some na hora, com o aviso "Apagado. Desfazer". Os cartões da resposta apagada somem junto, mas o que já foi salvo a partir deles (tarefas, metas, memórias) **permanece**. A mensagem apagada deixa de entrar no contexto da IA.
  - **Última mensagem apagada:** se o Marco apagar todas as mensagens, o Chat mostra o estado vazio (saudação e atalhos) na hora e "Desfazer" traz tudo de volta; quando a exclusão é confirmada (após os 5 s) a conversa vazia também é apagada, o app vai ao Chat vazio com o aviso "Conversa vazia apagada." e o Histórico deixa de listá-la.
  - **Apagar conversa (⋯ do topo):** apaga a conversa aberta com "Apagado. Desfazer" e leva ao Chat vazio; a gaveta de Histórico reflete a mudança.
  - **Tentar de novo** (no balão de erro): refaz a resposta do José sem duplicar a mensagem do Marco.
- **Estados:**
  - vazio: saudação conforme o horário ("Bom dia, Marco.") e os 4 atalhos (no modo decisão vazio: "Qual é a decisão?");
  - carregando: "José está pensando…" com três pontinhos;
  - gravando: barra de gravação (✕, ponto âmbar pulsante, contador regressivo a partir de 2:00 e ■) que para sozinha e envia ao chegar a zero;
  - áudio com menos de 1 s: é descartado sem aviso;
  - transcrevendo: "Transcrevendo áudio…";
  - erro de transcrição (falha do servidor ou da rede): "Não entendi o áudio. Tenta de novo ou digita."; nada do que o Marco digitou se perde;
  - transcrição vazia (sem fala): "Não ouvi nada no áudio. Tenta de novo ou digita.";
  - gravação cancelada porque o app saiu da tela: "Gravação cancelada (o app saiu da tela)";
  - limite diário de voz (60 transcrições por dia): "Limite de voz de hoje atingido. Digite sua mensagem.";
  - erro na IA ou resposta interrompida no meio: balão de erro com **Tentar de novo**, sem perder o texto digitado;
  - erro ao salvar um cartão: "Não salvou. Tentar de novo";
  - sem internet: faixa "Offline" e envio desabilitado;
  - limite diário atingido: "Limite de hoje atingido, volta amanhã.";
  - microfone negado: "Libere o microfone nas configurações para usar voz." No iPhone a mensagem acrescenta "Ajustes > Safari (ou José) > Microfone".
- **Mobile:** o campo de digitação sobe junto com o teclado. Botões com pelo menos 48px. Nada passa da largura da tela (320px e 390px), mesmo com balão de texto longo ou palavra sem espaços; o balão não tem botões ao lado que o empurrem para fora; a folha de ações não é coberta pelo aviso (toast); a barra de abas nunca some (só as Boas-vindas não a têm); o aviso (toast) não cobre campo, barra de gravação, formulário nem cartões. O botão de ação e a barra de gravação (✕, ■) têm pelo menos 48px e o contador tem contraste de pelo menos 4,5:1. O documento do Chat não rola (só a lista de mensagens).

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
  - apagar a conversa que está aberta leva ao Chat vazio (o Chat também tem **⋯ → Apagar conversa** no topo).
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
  - vazio: "O José ainda não sabe nada sobre você." e o botão **Fazer as boas-vindas**, que abre uma nova conversa de boas-vindas;
  - erro: "Não foi possível carregar. Tentar de novo";
  - sucesso: aviso "Memória atualizada".

### 7. Ajustes
- **Perfil:** Marco.
- **Elementos:**
  - **←** no topo, que volta a José sabe;
  - conta conectada (foto e e-mail Google);
  - **Instalar na tela inicial** (no iPhone, mostra a instrução: Compartilhar → Adicionar à Tela de Início; com o app já instalado mostra "Já está na tela inicial");
  - **Refazer boas-vindas**, que abre uma nova conversa de boas-vindas e mantém as memórias atuais (o José sugere só o que é novo);
  - **Sair**;
  - **Sair de todos os aparelhos**;
  - **Apagar todos os meus dados**;
  - versão do app;
  - Exportar meus dados *(V1.1)*.
- **Ações:**
  - Sair e Sair de todos pedem confirmação simples e voltam ao Login.
  - **Apagar todos os meus dados** pede **confirmação dupla**: primeiro um aviso, depois digitar "APAGAR". Apaga conversas,
    tarefas, metas, memórias e sessões, e volta ao Login. Na próxima entrada, tudo começa do zero.
- **Estados:** apagando: "Apagando…". Erro: "Não foi possível apagar. Tentar de novo". Erro ao abrir as boas-vindas: "Não foi possível abrir as boas-vindas. Tente de novo."

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
