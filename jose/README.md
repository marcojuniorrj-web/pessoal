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
- O prompt do José é `servidor/src/adaptadores/ia/prompt-jose.md` (seções BASE, SUGESTOES, DECIDIR e TITULO).
- **Casos golden** (6 casos, no Haiku, com a ferramenta `sugerir_memoria` ligada como no app). Os 4 primeiros são os momentos do dia e conferem: no máximo 5 linhas, 1 próximo passo, sem conselho médico/financeiro/jurídico. Os 2 de memória (tarefa 4.4) conferem também:
  - `memoria-existente`: com a memória "Acorda às 6h." salva, a resposta a "O que faço hoje?" usa essa informação e **nenhuma** sugestão repete a memória;
  - `memoria-nova`: ao contar um fato novo ("trabalho melhor de manhã e odeio reunião depois das 17h"), o José escreve o texto e sugere de 1 a 3 memórias, sem repetir a que já existe.
  ```bash
  ANTHROPIC_API_KEY=sk-ant-... npm run golden   # custa centavos; mostra as respostas e as sugestões para o Marco revisar o tom
  ```
  Os testes automáticos (`npm test`) usam uma IA simulada e não precisam de chave.
- Cada resposta grava `modelo` e tokens; os logs do Worker mostram `tokensCache` (se ficar 0 em conversas seguidas, o prefixo ainda está abaixo do mínimo de cache).

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

### Backup semanal
```bash
npm run backup        # gera backups/jose-AAAA-MM-DD.sql e mantém as 4 cópias mais recentes
```
Agende uma vez por semana (cron/launchd ou um lembrete). O Time Travel do D1 guarda mais 30 dias.

## Roteiro de teste no iPhone (aceite das tarefas 1.12 e da entrega da onda 1)
1. No Safari, abra o link e toque em **Entrar com Google**: deve cair no Chat com "Bom dia/Boa tarde/Boa noite, Marco.".
2. Compartilhar > **Adicionar à Tela de Início**. Abra pelo ícone "J": deve continuar logado (risco: Safari e PWA podem não dividir cookies; se pedir login de novo, anote e avise).
3. Feche o app, espere um pouco e abra de novo: ainda logado.
4. Peça a alguém para tentar entrar com outro Gmail: deve aparecer "Acesso negado".
5. Toque nas 3 abas e em Ajustes > ←.
6. Modo avião: o app abre e mostra "Offline".
7. **Voz:** no Chat, com o campo vazio, toque no 🎤 e fale (o contador desce de 2:00); toque em ■ para parar e enviar, ou em ✕ para cancelar. O texto transcrito vira uma mensagem com o 🎤 pequeno e o José responde. O formato gravado é `audio/mp4` no iPhone e `audio/webm` no Android. O roteiro completo da voz (permissão, 30 s, 2 min, segundo plano, microfone negado) está em `docs/jose/plan/fase3_voz.md`. Se o iPhone falhar, registre em `docs/jose/plan/execucao.md` e acione o plano B (converter no cliente ou trocar o provedor atrás de `servidor/src/adaptadores/voz/`).
8. Ajustes > **Sair de todos os aparelhos**: volta ao Login.

## Emergência (celular perdido)
`npx wrangler d1 execute jose --remote --config servidor/wrangler.toml --command "DELETE FROM sessoes"`
