# Visão

## Objetivo da aplicação
**José** é um assistente pessoal com IA, num único app, para ajudar o Marco (que tem TDAH) a:
- **Organizar o dia** (tarefas, compromissos, rotina);
- **Ajudar a decidir** (destravar decisões com passo a passo);
- **Planejar o futuro** (metas quebradas em passos pequenos);
- **Conversar** como um assistente que conhece a rotina dele.

Áreas cobertas: **Trabalho, Finanças, Saúde e rotina, Família e casa**. Tudo concentrado num lugar só.

## Problema que resolve (hoje, sem o app)
- Com TDAH, organizar, decidir e planejar sozinho é muito difícil: tarefas e ideias ficam espalhadas
  (cabeça, notas, apps, mensagens), decisões travam e o futuro fica sem plano.
- Não há um lugar único nem alguém que ajude a começar, priorizar e retomar o foco.

## Métricas de sucesso
- **Uso diário**: abrir o José todo dia, sem esforço, por 30 dias seguidos. (escolhida)
- (assumido) Início de uso: a conversa do dia começa em menos de 10 segundos após abrir o app.

## Escopo do MVP
Mínimo que gera valor na primeira semana: **Chat com o José**.
- Conversar para decidir, destravar e quebrar tarefas grandes em passos pequenos.
- (assumido) O José guarda o contexto básico sobre o Marco (rotina, áreas, metas) para as respostas
  serem pessoais e não genéricas.
- (assumido) Acesso pelo celular como PWA (instalável, abre rápido) e também no computador.

## Fica para depois
- Integrações (Google Calendar, Gmail, WhatsApp).
- Finanças detalhadas (gastos, contas a pagar, metas financeiras).
- Saúde e hábitos (sono, remédios, exercício, sequências).
- Revisão semanal e relatórios gerados pelo José.
- (assumido, vindo da conversa) Plano do dia, captura rápida e lembretes que insistem: ficaram fora do
  MVP, mas são os primeiros candidatos da versão 2.

## Fora do escopo
- (assumido) Virar produto para outras pessoas (uso só pessoal e privado).
- (assumido) App nativo em loja de apps.
- (assumido) Aconselhamento médico, jurídico ou financeiro profissional: o José apoia a decisão, não substitui especialista.

## Restrições (prazo, orçamento, ferramentas, público/interno)
- **Público**: uso interno, só o Marco (1 usuário).
- **Orçamento**: baixo. Hospedagem gratuita/barata + API de IA paga por uso.
- **Plataforma**: PWA, celular em primeiro lugar.
- (assumido) Prazo: primeira versão utilizável em poucas semanas, entregue em ondas pequenas.
- (assumido) Dados pessoais e sensíveis (finanças, saúde): privacidade e acesso protegido por login.
