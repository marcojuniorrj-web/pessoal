# Dados

> Escopo: o **MVP enxuto**. Os campos e regras adiados estão marcados com *(V1.1)*.

## Entidades
| Entidade | Campos (tipo) | Obrigatórios | Relacionamentos |
|----------|---------------|--------------|-----------------|
| **Usuario** | id (uuid), email (texto, minúsculas), nome (texto), foto_url (texto), boas_vindas_concluida (booleano), fuso_horario (texto, padrão `America/Sao_Paulo`), criado_em (data/hora) | id, email, nome, criado_em | 1 → N Sessao, Conversa, Tarefa, Meta, Memoria |
| **Sessao** | id (hash do token), usuario_id, expira_em, criada_em | todos | N → 1 Usuario |
| **Conversa** | id, usuario_id, titulo (texto, gerado automaticamente), tipo (`normal` \| `boas_vindas`), modo (`padrao` \| `decidir`), criada_em, atualizada_em | id, usuario_id, tipo, modo, criada_em, atualizada_em | N → 1 Usuario; 1 → N Mensagem |
| **Mensagem** | id (uuid gerado pelo app, para evitar duplicata), conversa_id, autor (`marco` \| `jose`), texto (texto longo), origem (`texto` \| `voz`), modelo (texto, só nas do José), tokens_entrada, tokens_saida, tokens_cache (inteiros, só nas do José), criada_em | id, conversa_id, autor, texto, origem, criada_em | N → 1 Conversa; 1 → N Sugestao |
| **Sugestao** (cartão no chat) | id, mensagem_id, tipo (`tarefa` \| `meta` \| `memoria`), conteudo (JSON com os campos propostos), status (`pendente` \| `salva` \| `descartada`), item_id (id da Tarefa/Meta/Memoria criada), criada_em | id, mensagem_id, tipo, conteudo, status, criada_em | N → 1 Mensagem; 0..1 → Tarefa/Meta/Memoria |
| **Tarefa** | id, usuario_id, titulo (texto ≤ 120), area (enum), prazo (data local `AAAA-MM-DD`, opcional), concluida (booleano), concluida_em, origem (`chat` \| `manual`), criada_em. *(V1.1: meta_id)* | id, usuario_id, titulo, area, concluida, origem, criada_em | N → 1 Usuario |
| **Meta** | id, usuario_id, titulo (texto ≤ 120), area (enum), prazo (data local, opcional), status (`ativa` \| `concluida`; *V1.1: `pausada`*), concluida_em, origem (`chat` \| `manual`), criada_em | id, usuario_id, titulo, area, status, origem, criada_em | N → 1 Usuario |
| **Memoria** | id, usuario_id, texto (texto ≤ 300), area (enum de memória), origem (`boas_vindas` \| `chat` \| `manual`), criada_em, atualizada_em | id, usuario_id, texto, area, origem, criada_em | N → 1 Usuario |
| **UsoDiario** | usuario_id, dia (data local `AAAA-MM-DD`, no fuso do usuário), respostas (inteiro) | todos (chave = usuario_id + dia) | N → 1 Usuario |

**Enums e rótulos.** Um mapa único fica em `compartilhado/` e é usado pela interface e pela IA.
- `area` (Tarefa/Meta):
  - `trabalho` = "Trabalho";
  - `financas` = "Finanças";
  - `saude` = "Saúde e rotina";
  - `casa` = "Família e casa".
- `area` (Memoria): as mesmas, mais `sobre_mim` = "Sobre mim".

**Conteúdo das sugestões** (validado com Zod, com os mesmos limites das entidades):
- `tarefa`: `{titulo, area, prazo?}`
- `meta`: `{titulo, area, prazo?}`
- `memoria`: `{texto, area}`

## Entradas e saídas
**Entradas**
- Login Google, que fornece email (verificado), nome e foto.
- Mensagens do Marco por **texto** ou **voz**. A voz é gravada no celular, transcrita para texto, e o arquivo de áudio é **descartado** em seguida, sem nunca ser guardado.
- Respostas da conversa de boas-vindas.
- Criação e edição manual de tarefas, metas e memórias.

**Saídas**
- Resposta do José no chat, em streaming.
- Cartões de sugestão (tarefa, meta, memória).
- Listas nas abas Tarefas e José sabe.
- Script de métricas de uso (ver "Métricas" abaixo).
- *(V1.1)* Exportar meus dados em JSON.

## Regras de negócio e cálculos
1. **Contexto enviado à IA** em cada resposta, nesta ordem (a ordem permite usar o cache):
   - prompt de sistema do José;
   - **todas as memórias**;
   - metas ativas;
   - tarefas pendentes, até **50**, na ordem da regra 5 — **[ponto de cache]**;
   - depois do ponto de cache: data, hora e dia da semana (fuso do Marco) e as últimas **20 mensagens** da conversa, em texto puro.

   Uma sugestão de mensagem antiga entra como uma linha-resumo, por exemplo: `[sugeriu tarefa "X" — salva]`.
2. **Sugestões:** a IA escreve o texto e usa as ferramentas `sugerir_tarefa`, `sugerir_meta` e `sugerir_memoria`.
   - Usa **no máximo 3 por resposta**. O servidor ignora as que passarem disso.
   - Cada sugestão vira uma `Sugestao` com status `pendente`.
   - **Nada vira Tarefa, Meta ou Memória sem o toque em "Salvar"**.
   - A IA não sugere uma memória que já existe.
   - Datas relativas ("sexta") são convertidas pela IA a partir da data enviada no contexto.
3. **Editar e salvar sugestão:** editar muda o `conteudo`. Salvar só funciona se a sugestão estiver `pendente`: cria o item
   com `origem = chat` (ou `boas_vindas`, se a conversa for de boas-vindas) e grava o `item_id`. "Salvar selecionadas"
   (das boas-vindas) salva e descarta em lote.
4. **Título da conversa:** é gerado depois da 1ª resposta do José, com até 6 palavras, pelo modelo econômico. Se falhar,
   o título vira os 40 primeiros caracteres da 1ª mensagem.
5. **Ordenação de tarefas:**
   1. atrasadas (prazo antes de hoje);
   2. de hoje;
   3. com prazo futuro, do mais próximo ao mais distante;
   4. sem prazo.

   Em empate, a mais nova vem primeiro (`criada_em` decrescente). As concluídas são ordenadas por `concluida_em` decrescente. "Hoje" usa o fuso do Marco.
6. *(V1.1)* Progresso da meta = tarefas concluídas ligadas ÷ total ligado. Sem tarefas, mostra "—".
7. **Boas-vindas:**
   - São 5 perguntas fixas.
   - Enquanto `boas_vindas_concluida = false`, o app retoma a conversa `boas_vindas` aberta.
   - No fim, uma chamada gera as sugestões de memória.
   - Concluir ou Pular marca `boas_vindas_concluida = true`.
   - "Refazer boas-vindas" abre uma nova conversa `boas_vindas`. A IA recebe as memórias atuais e sugere só o que é novo ou mudou.
8. **Acesso:**
   - Só entra o e-mail igual a `OWNER_EMAIL`, comparado em minúsculas, e com `email_verified = true`.
   - Qualquer outro recebe "acesso negado" e **nada é gravado** no banco.
   - Todas as consultas filtram pelo `usuario_id` da sessão. Item de outro usuário responde 404.
9. **Limites** (assumido):
   - mensagem de até 4.000 caracteres;
   - áudio de até 2 minutos e 10 MB, com até 60 transcrições por dia;
   - até **200 respostas do José por dia** (no dia local), contando também as "Tentar de novo", com o aviso "Limite de hoje atingido, volta amanhã".
    A contagem fica em `UsoDiario` e sobe a cada resposta gravada; **apagar mensagens não a diminui** (apagar não burla o limite de custo).
10. **Qual IA responde:** o modelo **econômico** (Haiku) por padrão. O modelo **profundo** (Sonnet) entra quando a conversa
    está no modo `decidir`, aberta pelo atalho "⚖️ Preciso decidir". *(V1.1: botão "Pensar melhor" em qualquer resposta.)*
11. **Tentar de novo sem duplicar:** o app gera o `id` da mensagem do Marco. Se o mesmo `id` chegar de novo, o servidor não
    cria outra mensagem e só gera a resposta que faltou. Se a resposta anterior estava incompleta, ela é apagada e refeita.
12. **Conversa de hoje:** é a última conversa `normal` com `atualizada_em` no dia local de hoje. Se não houver, a próxima
    mensagem cria uma nova.
13. **Apagar com "Desfazer":** a interface espera 5 s antes de chamar a API. Se o Marco tocar em "Desfazer" nesse tempo,
    nada é apagado.
13b. **Apagar mensagens:** o Marco apaga uma mensagem (ou a pergunta e a resposta do José logo depois) dentro do Chat, também com o "Desfazer" de 5 s.
    - As sugestões da mensagem apagada são apagadas junto (cascata); tarefas, metas e memórias já salvas a partir delas **permanecem**.
    - A mensagem apagada deixa de entrar no contexto da IA (regra 1).
    - A contagem do limite diário (regra 9) não muda.
    - Mensagem de outro usuário responde 404.
    - **Conversa vazia some:** se, depois de apagar, a conversa `normal` ficou sem nenhuma mensagem, ela também é apagada (na mesma transação, com as sugestões que restarem); a conversa de boas-vindas nunca. Os itens já salvos permanecem.
14. **Apagar todos os meus dados:** apaga todas as linhas do usuário em todas as tabelas, inclusive sessões e o próprio
    usuário, numa transação só.

## Métricas (para saber se deu certo)
Calculadas a partir das próprias tabelas, por um script SQL. Não precisa de tabela nova.
- **Dia ativo:** dia (fuso do Marco) com pelo menos 1 mensagem do Marco. A meta é **30 dias seguidos**.
- **Taxa de sugestões salvas:** salvas ÷ (salvas + descartadas). Uma referência saudável é ≥ 50%.
- **Tarefas concluídas por semana**, contadas por `concluida_em`.
- **Custo:** soma dos tokens por modelo, por dia.

## Integrações (sistema, direção, frequência)
| Sistema | Direção | Frequência | Uso |
|---------|---------|-----------|-----|
| **Google (OAuth)** | entrada | a cada login | autenticação (e-mail verificado), nome e foto |
| **Claude API (Anthropic)** | saída e entrada | a cada mensagem | respostas do José, sugestões (tool use) e título da conversa |
| **Whisper (Cloudflare Workers AI)** | saída e entrada | a cada áudio | transforma o áudio em texto, em português |

Ficam para depois: Google Calendar, Gmail e WhatsApp.

## Privacidade (LGPD): dados sensíveis, quem acessa, retenção
- **Dados sensíveis:** as conversas e as memórias podem conter saúde (TDAH, remédios), finanças e família. Todo o conteúdo é tratado como sensível.
- **Quem acessa:**
  - Só o Marco, autenticado.
  - O José (IA) lê o contexto apenas no momento de responder.
  - A Anthropic não treina modelos com dados da API comercial e guarda os registros por um período curto, de cerca de 30 dias, para segurança.
  - Uso exclusivamente pessoal: a LGPD não se aplica a esse caso (art. 4º, I), mas as boas práticas são mantidas mesmo assim.
- **Retenção:**
  - conversas, tarefas, metas e memórias ficam **para sempre, até o Marco apagar**;
  - **o áudio nunca é guardado**, só o texto transcrito;
  - apagar uma conversa ou uma mensagem apaga também as sugestões dela, mas os itens já salvos a partir delas permanecem;
  - uma memória apagada pode ainda aparecer em mensagens antigas de conversas que não foram apagadas (risco aceito);
  - backup semanal do banco com **4 cópias (30 dias)**, mais a recuperação de 30 dias da própria Cloudflare (Time Travel do D1).
- **Segurança:**
  - acesso só por HTTPS;
  - sessão em cookie seguro;
  - "Sair de todos os aparelhos" disponível;
  - banco não público;
  - chaves de API apenas no servidor;
  - logs sem o conteúdo das mensagens.
- **Direito de apagar:** "Apagar todos os meus dados" em Ajustes, com confirmação dupla.
- *(V1.1)* Portabilidade: exportar tudo em JSON.
