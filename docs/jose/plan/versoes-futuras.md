# Versões futuras
Tudo o que ficou fora do MVP ou foi marcado "depois/fora do escopo" na SPEC e na revisão dos agentes.
Nada pensado pode se perder.

| Versão | Item | Valor (por que importa) | Pré-requisito | Custo (P/M/G) | Gatilho para começar | Origem |
|--------|------|-------------------------|---------------|---------------|----------------------|--------|
| V1.1 | "🧠 Pensar melhor" (refazer a resposta com o modelo profundo) | Profundidade sob demanda, sem pagar o Sonnet sempre | Fase 2, 6 · rota `POST /api/mensagens/:id/refazer` | P | MVP pronto | arquitetura / revisores de telas e dados |
| V1.1 | Ligação tarefa ↔ meta e progresso da meta | Ver que a meta está andando motiva (TDAH) | Fase 5 · coluna `tarefas.meta_id`, `meta_id` (não título) na ferramenta | M | MVP pronto + ≥ 3 metas ativas | dados regras 6 e 10 / revisor de visão |
| V1.1 | Meta pausada | Pausar sem apagar, sem culpa | Fase 5 | P | junto com o progresso | dados / revisor de visão |
| V1.1 | Filtro por área nas Tarefas | Foco quando a lista cresce | Fase 5 | P | > 20 tarefas pendentes | telas / revisor de visão |
| V1.1 | Busca no Histórico | Achar um raciocínio antigo | Fase 2 | P | > 30 conversas | telas / revisor de visão |
| V1.1 | Exportar meus dados (JSON) | Portabilidade e backup pessoal | Fase 7 | P | MVP pronto | dados (escolha do Marco) / revisor de visão |
| V2 | Plano do dia automático (as 1–3 prioridades ao abrir) | Começar o dia sem pensar | Fases 4 e 5 | M | uso diário ≥ 14 dias | visao (candidato da v2) |
| V2 | Captura rápida (1 toque ou voz, sem conversa) | Tirar da cabeça em 3 segundos | Fase 3 | P | após V1.1 | visao |
| V2 | Lembretes que insistem (push até concluir ou adiar) | Combate ao esquecimento | Fase 5 · Web Push no PWA (iOS 16.4+) | M | após V1.1 | visao |
| V2 | Revisão semanal e relatórios gerados pelo José | Ver o progresso e replanejar | Fases 5 e 7 (métricas) | M | 4 semanas de uso | visao |
| V2 | Google Calendar (ler e criar compromissos) | Agenda e tarefas num lugar só | Fase 5 · OAuth com escopo de calendário | M | após o plano do dia | visao |
| V2 | Gmail (pendências vindas de e-mail) | Follow-ups do trabalho | integração Google | G | após o Calendar | visao |
| V2 | WhatsApp (conversar com o José pelo WhatsApp) | Usar sem abrir o app | adaptador de canal | G | se o uso do PWA cair | visao |
| V3 | Finanças detalhadas (gastos, contas a pagar, metas financeiras) | Área citada pelo Marco | entidades novas | G | após a V2 | visao |
| V3 | Saúde e hábitos (sono, remédio, exercício, sequências) | Rotina e TDAH | entidades novas | G | após a V2 | visao |
| Técnico | Criptografia por coluna dos dados sensíveis | Defesa extra caso o banco vaze | — | M | antes de abrir para outra pessoa | arquitetura (exceção consciente) |
| Técnico | Busca semântica nas memórias | Contexto menor e mais barato | > 300 memórias | M | > 300 memórias ou custo > US$ 5/mês | arquitetura |
| Técnico | Sincronização offline (enviar quando a conexão voltar) | Usar no metrô ou sem sinal | Fase 2 | M | se o offline incomodar | arquitetura |
| Técnico | Bloquear o "renascimento" de memória apagada (hash dos fatos apagados) | O José não reaprender o que o Marco apagou | Fase 4 | P | se acontecer na prática | revisor de usuários / dados |
| Técnico | Gravar segurando o botão (estilo WhatsApp) | Gesto familiar | Fase 3 | P | se o Marco sentir falta | revisor de telas (decisão: tocar e tocar) |
| Fora do escopo | Virar produto para outras pessoas com TDAH | — | multiusuário, LGPD completa, cobrança | G | decisão de negócio | visao |
| Fora do escopo | App nativo em loja | — | — | G | se o PWA não bastar | visao |
| Fora do escopo | Aconselhamento médico, jurídico ou financeiro profissional | O José apoia, não substitui | — | — | nunca | visao |
| Descartado | Gemini como IA | A assinatura do Google One não inclui a API, e o plano grátis usa os dados | adaptador `ia/` | P | só se o custo ou a qualidade mudarem | conversa com o Marco |
