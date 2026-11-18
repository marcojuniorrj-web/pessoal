# Fase 4: O José lembra de você

## Entrega
Durante a conversa, o José sugere memórias ("Você acorda às 6h") em cartões, e o Marco escolhe Salvar, Editar ou Descartar.
A aba **José sabe** mostra tudo o que ele sabe, por área, e permite editar, apagar com "Desfazer" e adicionar.
As memórias salvas passam a deixar as respostas personalizadas.

## Depende de
Fase 2.

## Tarefas (prompts pequenos)
- [x] 4.1 Ferramentas da IA (`sugerir_memoria` agora; `sugerir_tarefa` e `sugerir_meta` declaradas, mas ligadas na Fase 5), com `strict: true`:
  - o texto vem antes das ferramentas;
  - validação Zod;
  - máximo de 3 por resposta;
  - evento SSE `sugestao`;
  - linha-resumo no histórico.

  **Aceite:** testes com a API simulada; a 4ª sugestão é ignorada; um conteúdo inválido é descartado e registrado no log.
- [ ] 4.2 `POST /api/sugestoes/:id/salvar` (com `conteudo` editado) e `/descartar`: só funcionam se a sugestão estiver `pendente` (senão 409), gravam `item_id` e definem `origem` pela conversa. **Aceite:** testes de salvar, salvar duas vezes (409), descartar e posse.
- [x] 4.3 CRUD `/api/memorias`. **Aceite:** testes de validação (texto de até 300) e de posse.
- [ ] 4.4 As memórias entram no contexto (montador da Fase 2) e o prompt orienta a não sugerir memória que já existe. **Aceite:** caso golden — com a memória "acorda às 6h" salva, o José a usa no "O que faço hoje?" e não a sugere de novo.
- [ ] 4.5 Componente CartaoSugestao: Salvar, Editar (texto, chips de área), Descartar com "Desfazer", erro ao salvar e "✓ Salvo em José sabe". **Aceite:** testes de componente; nada é salvo sem toque.
- [ ] 4.6 Aba José sabe: grupos por área, data, adicionar, editar, apagar com "Desfazer", estados esqueleto, vazio (botão "Fazer as boas-vindas" vai para a Fase 6, por enquanto desabilitado) e erro, e ⚙ para Ajustes. **Aceite:** teste Playwright de criar, editar e apagar → desfazer.

## Como testar (roteiro para o Marco)
1. No Chat, escreva "eu trabalho melhor de manhã e odeio reunião depois das 17h".
2. Aparece um cartão 🧠 com a memória sugerida. Toque em Editar, ajuste o texto e Salve.
3. Abra a aba **José sabe**: a memória está na área certa.
4. Volte ao Chat, toque em **+ Nova** e pergunte "o que faço hoje?". A resposta deve levar em conta que você rende melhor de manhã.
5. Na aba José sabe, apague uma memória e toque em "Desfazer". Depois apague de vez.
