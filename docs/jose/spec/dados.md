# Dados

## Entidades
| Entidade | Campos (tipo) | Obrigatórios | Relacionamentos |
|----------|---------------|--------------|-----------------|
| **Usuario** | id (uuid), email (texto), nome (texto), foto_url (texto), boas_vindas_concluida (booleano), fuso_horario (texto, padrão `America/Sao_Paulo`), criado_em (data/hora) | id, email, nome | 1 → N Conversa, Tarefa, Meta, Memoria |
| **Conversa** | id, usuario_id, titulo (texto, gerado automaticamente), tipo (`normal` \| `boas_vindas`), modo (`padrao` \| `decidir`), criada_em, atualizada_em | id, usuario_id, tipo, criada_em | N → 1 Usuario; 1 → N Mensagem |
| **Mensagem** | id, conversa_id, autor (`marco` \| `jose`), texto (texto longo), origem (`texto` \| `voz`), criada_em | id, conversa_id, autor, texto, origem | N → 1 Conversa; 1 → N Sugestao |
| **Sugestao** (cartão no chat) | id, mensagem_id, tipo (`tarefa` \| `meta` \| `memoria`), conteudo (JSON com os campos propostos), status (`pendente` \| `salva` \| `descartada`), item_id (id da Tarefa/Meta/Memoria criada), criada_em | id, mensagem_id, tipo, conteudo, status | N → 1 Mensagem; 0..1 → Tarefa/Meta/Memoria |
| **Tarefa** | id, usuario_id, titulo (texto ≤ 120), area (enum), prazo (data, opcional), concluida (booleano), concluida_em, meta_id (opcional), origem (`chat` \| `manual`), criada_em | id, usuario_id, titulo, area, concluida | N → 1 Usuario; N → 0..1 Meta |
| **Meta** | id, usuario_id, titulo (texto ≤ 120), area (enum), prazo (data, opcional), status (`ativa` \| `concluida` \| `pausada`), criada_em | id, usuario_id, titulo, area, status | N → 1 Usuario; 1 → N Tarefa |
| **Memoria** | id, usuario_id, texto (texto ≤ 300), area (enum de memória), origem (`boas_vindas` \| `chat` \| `manual`), criada_em, atualizada_em | id, usuario_id, texto, area | N → 1 Usuario |

**Enums**
- `area` (Tarefa/Meta): `trabalho`, `financas`, `saude`, `casa`.
- `area` (Memoria): `sobre_mim`, `trabalho`, `financas`, `saude`, `casa`.

## Entradas e saídas
**Entradas**
- Login Google, que fornece email, nome e foto.
- Mensagens do Marco por **texto** ou **voz**. A voz é gravada no celular, transcrita para texto, e o arquivo de áudio é **apagado** em seguida, sem nunca ser guardado.
- Respostas da conversa de boas-vindas.
- Criação e edição manual de tarefas, metas e memórias.

**Saídas**
- Resposta do José no chat, em streaming.
- Cartões de sugestão (tarefa, meta, memória).
- Listas nas abas Tarefas e José sabe.
- **Exportar meus dados**, em Ajustes: um arquivo JSON com usuário, conversas, mensagens, tarefas, metas e memórias.

## Regras de negócio e cálculos
1. **Contexto enviado à IA** em cada resposta:
   - o prompt de sistema do José (tom direto e curto);
   - **todas as memórias** do Marco;
   - as tarefas pendentes e as metas ativas (título, área e prazo);
   - a data, a hora e o dia da semana atuais (fuso de São Paulo);
   - as últimas **20 mensagens** da conversa atual (assumido, para economizar).
2. **Sugestões:** a IA devolve, junto com o texto, zero ou mais sugestões estruturadas. Cada uma vira um `Sugestao` com status `pendente`. **Nada vira Tarefa, Meta ou Memória sem o toque em "Salvar"**.
3. **Editar sugestão:** muda o `conteudo` antes de salvar. Salvar cria o item e grava o `item_id`.
4. **Título da conversa:** é gerado automaticamente depois da 1ª resposta do José, com até 6 palavras.
5. **Ordenação de tarefas:** primeiro as atrasadas, depois as de hoje, depois as que têm prazo (do mais próximo ao mais distante) e por fim as sem prazo, das mais novas para as mais antigas.
6. **Progresso da meta** = tarefas concluídas ligadas à meta ÷ total de tarefas ligadas. Sem tarefas, mostra "—".
7. **Boas-vindas:** até 5 perguntas. Ao concluir ou pular, `boas_vindas_concluida = true`. "Refazer boas-vindas" abre uma nova conversa do tipo `boas_vindas`.
8. **Acesso:** só o e-mail configurado como dono (variável de ambiente) consegue entrar. Qualquer outro recebe "acesso negado".
9. **Limites** (assumido): mensagem de até 4.000 caracteres, áudio de até 2 minutos e até 200 mensagens por dia (proteção de custo, com o aviso "Limite de hoje atingido, volta amanhã").
10. **Tarefa sugerida ligada a meta:** se a sugestão citar uma meta, ao salvar a tarefa é ligada à meta ativa de mesmo título. Se a meta não existir, a tarefa é salva sem meta.
11. **Qual IA responde:** o modelo **econômico** (Haiku) responde por padrão. O modelo **profundo** (Sonnet) entra quando a conversa está no modo `decidir` (aberta pelo atalho "⚖️ Preciso decidir") ou quando o Marco toca em "Pensar melhor" numa resposta. Nesse caso o José refaz aquela resposta com o modelo profundo, e a nova resposta substitui a anterior.

## Integrações (sistema, direção, frequência)
| Sistema | Direção | Frequência | Uso |
|---------|---------|-----------|-----|
| **Google (OAuth)** | entrada | a cada login | autenticação e dados básicos do perfil |
| **Claude API (Anthropic)** | saída e entrada | a cada mensagem | respostas do José, sugestões estruturadas e título da conversa |
| **Serviço de transcrição de voz** | saída e entrada | a cada áudio | áudio vira texto. O serviço será definido na arquitetura (assumido), já que o Claude não transcreve áudio |

Ficam para depois: Google Calendar, Gmail e WhatsApp.

## Privacidade (LGPD): dados sensíveis, quem acessa, retenção
- **Dados sensíveis:** as conversas e memórias podem conter saúde (TDAH, remédios), finanças e família. Todo o conteúdo é tratado como sensível.
- **Quem acessa:** só o Marco, autenticado. O José (IA) lê o contexto apenas no momento de responder. O conteúdo não é usado para treinar modelos (padrão da API comercial da Anthropic).
- **Retenção:**
  - conversas, tarefas, metas e memórias ficam **para sempre, até o Marco apagar**;
  - **o áudio nunca é guardado**, só o texto transcrito;
  - apagar uma conversa apaga suas mensagens e sugestões pendentes, mas não apaga os itens já salvos a partir dela.
- **Segurança:**
  - acesso só por HTTPS;
  - sessão com cookie seguro;
  - banco de dados não público;
  - chaves de API apenas no servidor, nunca no navegador.
- **Portabilidade:** o Marco pode exportar tudo em JSON a qualquer momento.
