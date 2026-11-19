# José

Assistente pessoal em PWA (React + Vite no celular; Cloudflare Workers + Hono + D1 no servidor).
Documentação do projeto: `../docs/jose/` (SPEC e PLAN).

```
app/          interface (React PWA)         servidor/   Worker (Hono), migrações e wrangler.toml
compartilhado/ schemas Zod e datas/fuso     testes/     e2e (Playwright)
scripts/      backup e geração de ícones
```

## Rodar localmente
```bash
npm install
cp .dev.vars.exemplo servidor/.dev.vars   # (o wrangler lê ao lado do wrangler.toml) preencha GOOGLE_*, SESSION_SECRET e OWNER_EMAIL
npm run db:migrar:local               # cria as tabelas no D1 local
npm run dev                           # interface em http://localhost:5173 (a API sobe em :8787)
```
No dev local a transcrição de voz fica indisponível (Workers AI exige login na Cloudflare); `servidor/wrangler.dev.toml` é o `wrangler.toml` sem o binding `[ai]`.

## Testes e build
```bash
npm test                               # Vitest: regras, rotas (D1 simulado, OAuth simulado), datas, schemas, backup
npm run build                          # tsc + build do Vite (app/dist, com service worker)
CHROME_PATH=/caminho/do/chrome npm run test:e2e   # Playwright (sem CHROME_PATH: npx playwright install chromium)
```

## IA (Claude) e casos golden
- Variáveis: `MODELO_PADRAO` (Haiku) e `MODELO_PROFUNDO` (Sonnet, modo decisão) ficam no `wrangler.toml`; `LIMITE_MENSAGENS_DIA` (padrão 200). A chave entra só como segredo: `npx wrangler secret put ANTHROPIC_API_KEY --config servidor/wrangler.toml` (em desenvolvimento, em `servidor/.dev.vars`). Sem a chave, o chat responde 500 `ia_indisponivel`.
- O prompt do José é `servidor/src/adaptadores/ia/prompt-jose.md` (seções BASE, SUGESTOES, DECIDIR, BOASVINDAS e TITULO).
- **Casos golden** (6 casos, no Haiku, com a ferramenta `sugerir_memoria` ligada como no app). Os 4 primeiros são os momentos do dia e conferem: no máximo 5 linhas, 1 próximo passo, sem conselho médico/financeiro/jurídico. Os 2 de memória (tarefa 4.4) conferem também:
  - `memoria-existente`: com a memória "Acorda às 6h." salva, a resposta a "O que faço hoje?" usa essa informação e **nenhuma** sugestão repete a memória;
  - `memoria-nova`: ao contar um fato novo ("trabalho melhor de manhã e odeio reunião depois das 17h"), o José escreve o texto e sugere de 1 a 3 memórias, sem repetir a que já existe.
  - Onda 6 (boas-vindas e modo decisão), conferência automática testada sem rede em `golden.test.ts`: `boasvindas-memorias` (as 5 respostas viram memórias coerentes, até 8, sem repetir as existentes), `decisao-abertura` ("Preciso decidir" → UMA pergunta curta), `decisao-coaching` (informação incompleta → UMA pergunta curta, sem ganhos/perdas nem teoria) e `decisao-coaching-completa` (ganhos e perdas + recomendação + primeiro passo como cartão de tarefa com o prazo, até ~8 linhas). Os casos de decisão rodam no modelo profundo; nenhuma resposta pode citar GROW, SLAC, DISC ou Gallup (os testes do prompt também conferem o texto do `.md`).
  ```bash
  ANTHROPIC_API_KEY=sk-ant-... npm run golden   # custa centavos; mostra as respostas e as sugestões para o Marco revisar o tom
  ```
  Os testes automáticos (`npm test`) usam uma IA simulada e não precisam de chave.
- Cada resposta grava `modelo` e tokens; os logs do Worker mostram `tokensCache` (se ficar 0 em conversas seguidas, o prefixo ainda está abaixo do mínimo de cache).

## Boas-vindas e modo decisão
- **Boas-vindas:** 5 perguntas fixas no código (`compartilhado/boasvindas.ts`), uma por vez, com respostas rápidas; a etapa vem só das mensagens da conversa (retomada sem estado extra). Na 5ª resposta uma chamada da IA gera até 8 memórias, que o Marco marca e edita na lista "O que aprendi sobre você" (`POST /api/conversas/:id/sugestoes/lote`, numa transação, que também conclui as boas-vindas). `boas_vindas_concluida` manda: quem já concluiu abre o Chat. Para uma conta que já usa o app, basta marcar a flag no banco: `UPDATE usuarios SET boas_vindas_concluida = 1 WHERE email = '...'`.
- **Modo decisão:** o atalho cria a conversa em modo `decidir` e envia "Preciso decidir"; a pergunta inicial é a resposta do modelo profundo.
- **Faixa "Instalar na tela inicial":** `localStorage` `jose:instalar` (`pendente` depois das boas-vindas, `fechada` depois do ✕). Só o iPhone real confirma o Compartilhar → Adicionar à Tela de Início.

## Voz no Chat
- Com o campo vazio o botão da direita é o 🎤 (toque para gravar, ■ para parar e enviar, ✕ para cancelar; para sozinho aos 2:00). O áudio vai para `POST /api/voz`, é transcrito pelo Whisper (Workers AI) só em memória e descartado; o texto é enviado como mensagem de voz.
- **Limite de 60 transcrições por dia** (fuso do Marco): a coluna `uso_diario.transcricoes` vem da migração `servidor/migracoes/0003_transcricoes_diarias.sql`. Depois de publicar uma versão com voz, aplique-a no banco real: `npm run db:migrar:remoto` (funciona sobre o banco existente; as linhas antigas ficam com 0).
- Nos testes (`npm test` e Playwright) o Whisper é simulado e o navegador usa o microfone falso do Chromium (`--use-fake-device-for-media-stream`). O áudio real do iPhone/Android só se confirma no aparelho.

## Configurar o login com Google (uma vez)
1. Em https://console.cloud.google.com crie um projeto e abra **APIs e serviços > Tela de permissão OAuth**: tipo *Externo*, em modo *Teste*, adicione seu Gmail como **usuário de teste**.
2. **Credenciais > Criar credenciais > ID do cliente OAuth > Aplicativo da Web**. Em **URIs de redirecionamento autorizados** coloque:
   - `http://localhost:5173/auth/google/callback` (desenvolvimento)
   - `https://jose.SEU-SUBDOMINIO.workers.dev/auth/google/callback` (produção; o subdomínio aparece no passo de deploy)
3. Guarde o **Client ID** e o **Client Secret**.

## Deploy na Cloudflare (tarefa 1.13)
```bash
npx wrangler login
npx wrangler d1 create jose            # copie o database_id para servidor/wrangler.toml
npm run db:migrar:remoto               # aplica servidor/migracoes no D1 remoto
npm run deploy                         # build + wrangler deploy; mostra a URL https://jose.<subdominio>.workers.dev
# segredos (cada comando pergunta o valor; nada vai para o git):
for s in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET OWNER_EMAIL; do npx wrangler secret put $s --config servidor/wrangler.toml; done
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET --config servidor/wrangler.toml
# ANTHROPIC_API_KEY só é necessário a partir da onda 2
curl -i https://jose.<subdominio>.workers.dev/saude     # deve responder 200 {"ok":true}
```
Depois de saber a URL, volte ao Google Cloud e cadastre o redirecionamento de produção (passo 2 acima).

### Deploy sem o upload de assets (`npm run deploy:embutido`)
Alguns ambientes (proxies que reescrevem o cabeçalho de autorização) derrubam o upload de arquivos do `wrangler deploy` com 401. Nesse caso use `npm run deploy:embutido`: ele faz o build, embute os arquivos da interface dentro do Worker (`servidor/embutido/`, gerado, fora do git) e publica com `servidor/wrangler.embutido.toml` (gerado a partir do `wrangler.toml`, sem `[assets]`). O resultado para o usuário é idêntico. O deploy normal (`npm run deploy`) continua valendo num computador comum.

### Checklist de deploy (a cada versão publicada)
Marque um por um antes de dizer "publicado". Nada aqui apaga dados; só o item 7 mexe no banco real e é opcional.
- [ ] 1. `git status` limpo e na branch certa; `npm test` verde (unitários, rotas, segurança, métricas).
- [ ] 2. `npm run build` sem erro (roda o `tsc` e o Vite) e `npx playwright test --trace off` verde (celular 390 px e computador).
- [ ] 3. Há migração nova em `servidor/migracoes/`? Então `npm run db:migrar:remoto` **antes** do deploy (as migrações funcionam sobre o banco existente) e, antes dela, um `npm run backup`.
- [ ] 4. Segredos no ar: `npx wrangler secret list --config servidor/wrangler.toml` mostra `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_EMAIL` e `SESSION_SECRET`. Nunca coloque segredo no código nem no `wrangler.toml`.
- [ ] 5. Publicar: `npm run deploy` (ou `npm run deploy:embutido` se o upload de assets falhar).
- [ ] 6. Conferir: `curl -i https://jose.<subdominio>.workers.dev/saude` responde 200 `{"ok":true}`; abrir o app no celular, entrar, mandar uma mensagem e ver a resposta; Ajustes mostra a versão nova.
- [ ] 7. (Só se uma conta nova precisar disso) marcar as boas-vindas: ver "Boas-vindas e modo decisão".
- [ ] 8. Logs: no painel da Cloudflare (Workers › jose › Logs) ou `npx wrangler tail jose --config servidor/wrangler.toml`: só ids, tempos, tokens e erros; se aparecer texto de mensagem, é um defeito (os testes de `seguranca.test.ts` existem para impedir isso).
- [ ] 9. Backup semanal ativo (R2 ligado, bucket `jose-backups` criado, Cron `0 6 * * 0` aparecendo no Worker; abaixo) e restauração testada pelo menos uma vez num banco de teste.

### Backup semanal (automático, no R2)
O próprio Worker faz o backup: todo **domingo às 03:00 (horário de São Paulo; Cron `0 6 * * 0`, 06:00 UTC)** ele gera um arquivo SQL com o banco inteiro e grava no bucket R2 **`jose-backups`** como `backups/jose-AAAA-MM-DD.sql` (data de São Paulo). Ficam as **8 cópias mais recentes** (8 semanas); as mais antigas são apagadas sozinhas. O código está em `servidor/src/modulos/backup/` e o agendamento em `[triggers]` do `wrangler.toml`. O log da execução (`backup ok` com bytes, nº de tabelas, nº de linhas e cópias mantidas; ou `backup falhou` com o tipo do erro) não leva nenhum conteúdo; veja em Workers › jose › Logs ou `npx wrangler tail jose --config servidor/wrangler.toml`.

**Ativar (uma vez, antes do próximo deploy):** o `wrangler.toml` já declara o bucket, então o deploy falha enquanto o R2 não estiver ativo e o bucket não existir.
1. No painel da Cloudflare: R2 Object Storage › ativar (pede forma de pagamento; 10 GB e as operações deste backup cabem no plano gratuito).
2. `npx wrangler r2 bucket create jose-backups --config servidor/wrangler.toml`
3. `npm run deploy` (ou `npm run deploy:embutido`). A partir daí o Cron roda sozinho; na tela do Worker (Triggers) aparece `0 6 * * 0`. Para ver o primeiro backup sem esperar o domingo: painel › Workers › jose › Settings › Triggers › Cron Triggers, ou `npx wrangler dev --test-scheduled --config servidor/wrangler.dev.toml` e `curl "http://localhost:8787/__scheduled?cron=0+6+*+*+0"` (local: sem o binding `BACKUPS` ele só registra `backup sem destino`, sem quebrar nada).

**Listar e baixar:** o wrangler não tem comando de listar objetos; veja os nomes no painel (R2 › `jose-backups` › pasta `backups/`) ou use o nome do domingo desejado:
```bash
npx wrangler r2 object get jose-backups/backups/jose-AAAA-MM-DD.sql --remote --file ./jose-AAAA-MM-DD.sql --config servidor/wrangler.toml
```
O arquivo tem **todas as conversas e memórias**: guarde-o num lugar privado e não o coloque no git (a pasta `backups/` já está ignorada).

**O que o arquivo contém:** o esquema completo (tabelas e índices, lidos do próprio banco: tabela nova entra no backup sozinha) e as linhas de todas as tabelas, **exceto a `sessoes`**. As sessões não são salvas de propósito: restaurar uma cópia nunca reabre um login já encerrado (depois de restaurar, entre de novo com o Google). O conteúdo vem dentro de `BEGIN TRANSACTION; ... COMMIT;`.

**Restaurar num banco NOVO** (nunca por cima do banco em uso):
```bash
npx wrangler d1 create jose-restaurado --config servidor/wrangler.toml
npx wrangler d1 execute jose-restaurado --remote --file ./jose-AAAA-MM-DD.sql --config servidor/wrangler.toml
npx wrangler d1 execute jose-restaurado --remote --command "SELECT COUNT(*) FROM mensagens" --config servidor/wrangler.toml   # conferir
```
Só depois de conferir, troque o `database_id` no `wrangler.toml` e publique. Se o D1 recusar o `BEGIN`/`COMMIT` do arquivo (o D1 não aceita transações escritas à mão em alguns caminhos), remova essas duas linhas (`grep -v -x -E 'BEGIN TRANSACTION;|COMMIT;' jose-AAAA-MM-DD.sql > sem-transacao.sql`) e execute o arquivo novo. Para testar o arquivo sem tocar na nuvem: `sqlite3 teste.db < jose-AAAA-MM-DD.sql`.

> **Privacidade: "Apagar todos os meus dados" NÃO apaga as cópias do R2.** O botão do app apaga o banco, mas os arquivos `backups/jose-*.sql` continuam no bucket por até 8 semanas, com o conteúdo de antes do apagamento. Para apagá-los de verdade:
> ```bash
> npx wrangler r2 object delete jose-backups/backups/jose-AAAA-MM-DD.sql --remote --config servidor/wrangler.toml   # um por um
> npx wrangler r2 bucket delete jose-backups --config servidor/wrangler.toml   # o bucket inteiro (precisa estar vazio; apague os objetos antes pelo painel)
> ```
> Se for apagar tudo de vez, apague as cópias **antes** do próximo domingo, ou o Cron cria uma nova (já sem dados, mas ainda com o esquema). Para parar os backups, remova `[triggers]` e `[[r2_buckets]]` do `wrangler.toml` e publique de novo.

**Cópia manual (opcional):** `npm run backup` continua existindo: gera `backups/jose-AAAA-MM-DD.sql` no computador (`wrangler d1 export --remote`, só lê o banco; esse export inclui as sessões) e mantém as 4 cópias mais recentes. Use antes de uma migração (item 3 do checklist).

**Segunda camada, Time Travel do D1** (últimos 30 dias, sem agendar nada):
`npx wrangler d1 time-travel info jose --config servidor/wrangler.toml` mostra os bookmarks e
`npx wrangler d1 time-travel restore jose --timestamp=2026-11-18T12:00:00Z --config servidor/wrangler.toml` volta o banco àquele momento (**sobrescreve o banco atual**: confira a data com `info` antes e faça um `npm run backup` primeiro, pois o restore também guarda um bookmark para desfazer).

## Emergência: celular perdido ou roubado
1. **Pelo app, em outro aparelho:** Ajustes › **Sair de todos os aparelhos** (derruba todas as sessões na hora; o cookie antigo passa a dar 401).
2. **Sem outro aparelho com o app:** pelo computador, derrube as sessões direto no banco:
   `npx wrangler d1 execute jose --remote --config servidor/wrangler.toml --command "DELETE FROM sessoes"`
   (o efeito é o mesmo; depois é só entrar de novo com o Google).
3. No Google (myaccount.google.com › Segurança › Seus dispositivos) saia do aparelho perdido e troque a senha da conta se houver risco.
4. Se o aparelho estiver desbloqueado e com os dados à vista e você quiser apagar tudo do servidor: Ajustes › **Apagar todos os meus dados** (pede digitar APAGAR; não tem volta, só o backup; as cópias do backup no R2 **não** são apagadas: ver "Backup semanal").
5. Chave da IA exposta? Gere outra no console da Anthropic e troque: `npx wrangler secret put ANTHROPIC_API_KEY --config servidor/wrangler.toml`. A chave nunca vai para o celular, então perder o aparelho não a expõe.

## Métricas de uso (tarefa 7.3)
`servidor/scripts/metricas.sql` só lê o banco e devolve 4 tabelas: dias ativos seguidos (atual, maior e total), taxa de sugestões salvas, tarefas concluídas por semana e tokens por modelo por dia.
```bash
npx wrangler d1 execute jose --remote --config servidor/wrangler.toml --file servidor/scripts/metricas.sql   # banco real (só leitura)
npx wrangler d1 execute jose --local --config servidor/wrangler.dev.toml --file servidor/scripts/metricas.sql  # banco local de teste
```
- **Dia ativo** = pelo menos 1 mensagem do Marco no dia local (São Paulo = UTC-3; outro fuso é tratado como UTC). Meta: 30 seguidos. A taxa de sugestões salvas é salvas ÷ (salvas + descartadas); referência saudável: 50% ou mais.
- **Tokens:** vêm do `usage` gravado em cada resposta (`mensagens.modelo`, `tokens_entrada`, `tokens_cache`, `tokens_saida`). O banco não tem preços: multiplique pelos preços atuais da Anthropic. Limites: apagar uma mensagem ou conversa apaga também o consumo dela, e a chamada do título automático não é gravada. Para um custo exato e permanente seria preciso uma tabela de consumo (migração + SPEC), que não foi criada.
- O teste `servidor/scripts/metricas.test.ts` roda o script num banco em memória com dados conhecidos e confere os números.

## Roteiro de teste no iPhone (aceite das tarefas 1.12 e da entrega da onda 1)
1. No Safari, abra o link e toque em **Entrar com Google**: deve cair no Chat com "Bom dia/Boa tarde/Boa noite, Marco.".
2. Compartilhar > **Adicionar à Tela de Início**. Abra pelo ícone "J": deve continuar logado (risco: Safari e PWA podem não dividir cookies; se pedir login de novo, anote e avise).
3. Feche o app, espere um pouco e abra de novo: ainda logado.
4. Peça a alguém para tentar entrar com outro Gmail: deve aparecer "Acesso negado".
5. Toque nas 3 abas e em Ajustes > ←.
6. Modo avião: o app abre e mostra "Offline".
7. **Voz:** no Chat, com o campo vazio, toque no 🎤 e fale (o contador desce de 2:00); toque em ■ para parar e enviar, ou em ✕ para cancelar. O texto transcrito vira uma mensagem com o 🎤 pequeno e o José responde. O formato gravado é `audio/mp4` no iPhone e `audio/webm` no Android. O roteiro completo da voz (permissão, 30 s, 2 min, segundo plano, microfone negado) está em `docs/jose/plan/fase3_voz.md`. Se o iPhone falhar, registre em `docs/jose/plan/execucao.md` e acione o plano B (converter no cliente ou trocar o provedor atrás de `servidor/src/adaptadores/voz/`).
8. Ajustes > **Sair de todos os aparelhos**: volta ao Login.
9. **Só em ambiente de teste (banco local, nunca o real):** Ajustes › **Apagar todos os meus dados** › Continuar › digite `APAGAR` › Apagar tudo. O app volta ao Login; ao entrar de novo, tudo começa do zero (boas-vindas incluídas). No banco real isso é irreversível (só o backup recupera).

## Privacidade e segurança (resumo da onda 7)
- `DELETE /api/eu` com `{"confirmacao":"APAGAR"}` apaga, numa transação, todas as linhas do usuário em todas as tabelas (sugestões, mensagens, conversas, tarefas, metas, memórias, uso diário, sessões e o usuário) e limpa o cookie. O app também apaga o que guarda no aparelho (`localStorage` `jose:*`) e recarrega no Login.
- Testes: `servidor/src/seguranca.test.ts` (isolamento com 2 usuários em todas as rotas `/:id`, Origin, cookies, cabeçalhos, logs sem conteúdo ou segredo) e `scripts/segredos.test.ts` (nenhum segredo versionado).
- Desempenho no celular (medido em Chromium com CPU 4x e Slow 4G): `npm run build && node scripts/medir-desempenho.mjs` (ou `npm run medir`). Os números estão em `docs/jose/plan/execucao.md`.
