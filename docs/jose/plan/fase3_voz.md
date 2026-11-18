# Fase 3: Falar com o José por voz

## Entrega
Com o campo vazio, o botão da direita do Chat é o 🎤. O Marco toca nele, fala e toca em ■: o áudio vira texto, é enviado como mensagem de voz e o José responde.
Funciona no PWA do iPhone e do Android, e nenhum áudio fica guardado.

## Depende de
- Fase 2 (Chat) e Fase 2b (folha de ações, apagar).
- Fase 1.12 (adaptador Whisper já validado no iPhone, com a página temporária `TesteVoz`).

## Desenho (decidido com o Marco; também em telas.md, usuarios.md, dados.md e arquitetura.md)
- **Um único botão de ação à direita do campo** (como no WhatsApp): campo vazio = 🎤 (ícone SVG com `aria-label`); com texto = Enviar. A voz nunca apaga o texto digitado.
- **Por toque, não por segurar.** Gravando, o rodapé vira uma barra: **✕** (cancela e descarta), ponto âmbar pulsante + **contador regressivo de 2:00** (`m:ss`) e **■** (parar e enviar). Aos 2:00 para sozinho e envia; Esc cancela. Menos de 1 s é descartado sem aviso.
- Depois de parar: "Transcrevendo áudio…" → o texto é **enviado** com `origem = voz` (balão do Marco com 🎤 pequeno, `aria-label` "Enviado por voz") e o José responde. A mensagem de voz segue as regras das de texto (pressão longa, Copiar, Apagar com Desfazer, conversa vazia some).
- Avisos: "Não entendi o áudio. Tenta de novo ou digita." (falha), "Não ouvi nada no áudio. Tenta de novo ou digita." (vazio), "Libere o microfone nas configurações para usar voz." (+ instrução do iPhone), "Limite de voz de hoje atingido. Digite sua mensagem." (429) e "Gravação cancelada (o app saiu da tela)".
- Offline ou José respondendo: 🎤 desabilitado. Se na hora do envio o José já estiver respondendo, o texto vai para o campo (nada se perde).
- **Limite de 60 transcrições por dia:** migração `0003_transcricoes_diarias.sql` (`uso_diario.transcricoes INT NOT NULL DEFAULT 0`); o servidor soma 1 antes do Whisper (UPSERT atômico) e responde 429 ao passar de 60; falha do Whisper não devolve a contagem. A migração no banco real é aplicada pelo Marco (`npm run db:migrar:remoto`); nada de `--remote` na construção.
- **Formato:** `MediaRecorder` grava `audio/mp4` no iPhone (validado na onda 1) e `audio/webm;codecs=opus` no Android e no computador; o servidor aceita os dois (e `ogg`, `mpeg`, `wav`) pelo Content-Type real, ignorando parâmetros como `codecs=opus`.
- **Microfone sempre liberado** (`getTracks().forEach(t => t.stop())`) ao cancelar, enviar, trocar de aba/rota/conversa, desmontar o Chat e ao ir para o segundo plano (aí a gravação é cancelada com aviso). Sem timers soltos.
- **iPhone/PWA (`viewport-fit=cover`):** só variáveis `--safe-*` (nenhum `env()` fora de `tokens.css`); nada passa da largura em 320/390 px; o documento do Chat não rola; `teclado.ts` não muda; barra de abas nunca some; o toast usa `--reserva-toast` e não cobre campo, barra de gravação nem folha; alvos ≥ 48 px; contraste ≥ 4,5:1; foco por teclado; toque fantasma do iOS: ■, ✕ e 🎤 só agem se o `pointerdown` veio depois da mudança de modo (mesma regra da folha de ações). Os testes de navegador usam Chromium: o que é só do WebKit se confirma no aparelho.

## Tarefas (prompts pequenos)
- [x] 3.0 Atualizar a SPEC (telas, usuarios, dados, arquitetura) e este arquivo com o desenho acima, antes do código. **Aceite:** os 4 arquivos descrevem o botão único, a barra de gravação, os avisos, o limite de 60 por dia, `uso_diario.transcricoes`, o `POST /api/voz` endurecido e a liberação do microfone.
- [x] 3.1 Endurecer `POST /api/voz` e criar a migração `0003_transcricoes_diarias.sql`: limite de 60 transcrições por dia (429 `limite_voz`, UPSERT atômico antes do Whisper, falha não devolve), 413 acima de 10 MB, 400 para formato inválido/ausente/vazio/duração acima de ~2 min, tipos aceitos com parâmetros (`codecs=opus`), erro claro de transcrição, log sem áudio e sem texto. **Aceite:** testes de 413, 429 (61º pedido; outro usuário e outro dia não são afetados; falha do Whisper conta), formato inválido, duração, sessão/Origin, logs sem conteúdo, e da migração (do zero e sobre banco existente).
- [ ] 3.2 Gravação no app, em três partes (sem Chat ainda):
  - 3.2a máquina de estados pura (`ocioso`, `preparando`, `gravando`, `transcrevendo`, `erro`, `negado`), contagem regressiva, formato `m:ss`, escolha do `mimeType` e nome do arquivo. **Aceite:** testes de unidade (tempo, 2:00 automático, < 1 s descartado, cancelar, cada erro, negado).
  - 3.2b cliente `api/voz.ts` e hook `useGravadorVoz` (MediaRecorder, libera o microfone, cancela ao sair da tela/desmontar, sem timers órfãos). **Aceite:** testes do hook com `MediaRecorder` e `getUserMedia` simulados (liberação das trilhas em cada saída).
  - 3.2c componentes `BotaoAcaoChat` (🎤, enviar, ■, ocupado) e `BarraGravacao` (✕, ponto pulsante, contador) com CSS. **Aceite:** testes de componente para cada estado, incluindo o toque fantasma.
- [ ] 3.3 Integração no Chat (rodapé com botão único, origem `voz`, balão com 🎤 e avisos), mais a atualização dos testes e2e existentes que dependiam do "Enviar" com o campo vazio. **Aceite:** Playwright com microfone falso e Whisper simulado: cada estado (gravando, cancelar, parar/enviar, 2:00 automático, menos de 1 s, negado, erro, vazio, limite, offline, segundo plano) em 320, 390 e 1280 px; botão e barra com ≥ 48 px e sem passar da largura; documento do Chat não rola; trilhas do microfone encerradas.
- [ ] 3.4 Teste em aparelhos reais (iPhone com o PWA instalado e Android): permissão de microfone, gravar 30 s e gravar 2 min. **Aceite:** roteiro abaixo executado pelo Marco e registrado em `execucao.md`.
- [ ] 3.5 Remover a página temporária: `TesteVoz`, a rota `/teste-voz`, o link em Ajustes e o `?teste=1`; atualizar o README e os testes. **Aceite:** nenhuma referência restante a `teste-voz`/`TesteVoz`/`?teste=1` e a suíte verde.

## Como testar (roteiro para o Marco)
1. No app instalado, com o campo vazio o botão da direita é o 🎤. Toque nele; na primeira vez, permita o microfone.
2. Fale "preciso organizar a visita do cliente amanhã" e toque em ■. Aparece "Transcrevendo áudio…", depois o seu balão com o 🎤 pequeno e a resposta do José.
3. Comece a gravar e toque em ✕: nada é enviado e o microfone se apaga (o ponto laranja/verde do iPhone some).
4. Grave sem parar: o contador desce de 2:00 e, em 0:00, a gravação para sozinha e é enviada.
5. Comece a gravar e mude de app (ou bloqueie a tela): ao voltar aparece "Gravação cancelada (o app saiu da tela)" e nada foi enviado.
6. Segure o dedo no balão de voz: abre a folha (Copiar, Apagar mensagem). Apague e desfaça.
7. Digite algo no campo: o botão vira Enviar. Apague o texto: volta o 🎤.
8. Negue o microfone nas configurações do celular: aparece a mensagem explicando como liberar.
9. Modo avião: o 🎤 fica desabilitado.
