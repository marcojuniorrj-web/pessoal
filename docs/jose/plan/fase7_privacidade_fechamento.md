# Fase 7: Privacidade, métricas e fechamento do MVP

## Entrega
O MVP fica pronto para uso diário:
- "Apagar todos os meus dados", com confirmação dupla, funciona;
- um script mostra a sequência de dias ativos, a taxa de sugestões salvas, as tarefas concluídas e o gasto com a IA;
- os 10 fluxos das histórias têm testes automáticos;
- a performance no celular é medida;
- o Marco começa os **7 dias de uso real** que definem o "MVP pronto".

## Depende de
Fases 1 a 6.

## Tarefas (prompts pequenos)
- [ ] 7.1 `DELETE /api/eu` com `{confirmacao: "APAGAR"}`: apaga todas as tabelas numa transação e limpa o cookie. **Aceite:** depois de apagar, nenhuma linha do usuário sobra (teste conta as linhas de todas as tabelas).
- [ ] 7.2 Ajustes → "Apagar todos os meus dados": aviso, depois digitar "APAGAR", estados apagando e erro, e volta ao Login. **Aceite:** teste Playwright.
- [ ] 7.3 Script `servidor/scripts/metricas.sql` (rodado com `wrangler d1 execute`): dias ativos seguidos, taxa de sugestões salvas, tarefas concluídas por semana e tokens por modelo por dia. **Aceite:** com dados de teste conhecidos, devolve os números esperados.
- [ ] 7.4 Revisão de segurança: isolamento (teste com 2 usuários em **todas** as rotas `/:id` → 404), Origin, cookies, logs sem conteúdo e segredos fora do repositório. **Aceite:** a suíte de isolamento passa e não há segredo no git.
- [ ] 7.5 Suíte e2e no Playwright cobrindo as 10 histórias de `usuarios.md`, no celular (390px) e no computador. **Aceite:** tudo verde, com `--trace off`.
- [ ] 7.6 Performance: o campo de texto fica utilizável em até 3 s com o app instalado; peso do JS medido; consultas lentas no D1 revisadas. **Aceite:** medição registrada em `execucao.md`.
- [ ] 7.7 Ajuste fino do prompt depois de rodar os casos golden de novo, com a revisão de estímulo visual (cartões e avisos) junto com o Marco. **Aceite:** o Marco aprova o tom.
- [ ] 7.8 Deploy final, backup semanal rodando e procedimento de emergência documentado ("celular perdido": `DELETE FROM sessoes`). **Aceite:** checklist do README completo.

## Como testar (roteiro para o Marco)
1. Use o José normalmente por **7 dias seguidos**: de manhã, quando travar, antes de uma decisão e à noite.
2. No 7º dia, peço para rodar o script de métricas e revisamos juntos: dias ativos, sugestões salvas e tarefas concluídas.
3. Em um ambiente de teste, toque em Ajustes → "Apagar todos os meus dados", digite APAGAR e confirme que, ao entrar de novo, tudo começa do zero.
4. Se tudo estiver bem nos 7 dias: **MVP pronto**. Seguimos para a V1.1.
