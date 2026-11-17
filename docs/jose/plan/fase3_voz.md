# Fase 3: Falar com o José por voz

## Entrega
O Marco toca no 🎤, fala e toca de novo. O áudio vira texto, é enviado, e o José responde.
Funciona no PWA do iPhone e do Android, e nenhum áudio fica guardado.

## Depende de
- Fase 2 (Chat).
- Fase 1.12 (adaptador Whisper já validado).

## Tarefas (prompts pequenos)
- [ ] 3.1 Endurecer `POST /api/voz`: limite de 60 transcrições por dia (429), 413 para arquivos grandes, formatos aceitos (webm, mp4, m4a), erro claro de transcrição e log sem conteúdo. **Aceite:** testes de 413, 429 e formato inválido.
- [ ] 3.2 Componente BotaoMicrofone:
  - toque grava e toque para e envia;
  - ✕ cancela;
  - contador regressivo a partir de 2:00, que para sozinho;
  - áudio com menos de 1 s é descartado;
  - estados gravando, transcrevendo, negado e erro.

  **Aceite:** testes de componente para cada estado.
- [ ] 3.3 Integração no Chat: o texto transcrito vira mensagem com `origem = voz` e aparece num balão com 🎤; em caso de erro, o texto pode ser corrigido antes de enviar. **Aceite:** teste Playwright com o microfone simulado.
- [ ] 3.4 Teste em aparelhos reais (iPhone com o PWA instalado e Android): permissão de microfone, gravar 30 s e gravar 2 min. **Aceite:** roteiro abaixo executado e registrado em `execucao.md`.

## Como testar (roteiro para o Marco)
1. No app instalado, toque no 🎤. Na primeira vez, permita o microfone.
2. Fale "preciso organizar a visita do cliente amanhã" e toque de novo. Aparece "Transcrevendo…", depois o seu balão com 🎤 e a resposta do José.
3. Comece a gravar e toque em ✕: nada é enviado.
4. Grave sem parar: aos 2:00, a gravação para sozinha e é enviada.
5. Negue o microfone nas configurações do celular: aparece a mensagem explicando como liberar.
