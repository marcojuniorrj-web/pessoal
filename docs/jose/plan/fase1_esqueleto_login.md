# Fase 1: Esqueleto e login no celular

## Entrega
O José já existe no celular do Marco:
- abre por um link HTTPS da Cloudflare e dá para instalar na tela inicial;
- entra com a conta Google (só o e-mail do Marco é aceito) e a sessão continua aberta por 30 dias;
- mostra o Chat vazio, com "Bom dia, Marco.", e as 3 abas navegáveis;
- Ajustes já tem Sair e Sair de todos os aparelhos.

Esta onda também **elimina os 2 maiores riscos técnicos**: o login no PWA do iPhone e a transcrição de áudio gravado no iPhone.

## Depende de
- Nada.
- Antes de começar, o Marco precisa providenciar: chave da API da Anthropic, um projeto no Google Cloud com o OAuth configurado (eu guio o passo a passo) e a conta Cloudflare, que já está conectada.

## Tarefas (prompts pequenos)
- [x] 1.1 Criar o monorepo (`app/`, `servidor/`, `compartilhado/`, `testes/`) com TypeScript, Vite + React, Hono, Vitest, `wrangler.toml` e `.dev.vars.exemplo`. **Aceite:** `npm run dev` sobe a interface e a API localmente; `npm test` roda um teste de exemplo.
- [x] 1.2 Migração `0001_inicial.sql` com **todas** as tabelas de arquitetura.md §4 (NOT NULL, CHECKs, índices, `foreign_keys`). **Aceite:** a migração roda do zero no D1 local e no remoto; um teste insere e lê uma linha de cada tabela.
- [x] 1.3 `compartilhado/`: mapa enum → rótulo das áreas e schemas Zod das entidades e do conteúdo das sugestões. **Aceite:** testes de validação (limites de 120 e 300 caracteres, áreas inválidas).
- [x] 1.4 Utilitário de datas e fuso (`hoje`, `diaLocal`, `atrasada`, grupos Hoje/Ontem/Esta semana/Mais antigas). **Aceite:** testes Vitest com relógio fixo, incluindo a virada do dia às 23h59 e 00h01 em São Paulo.
- [x] 1.5 Adaptador Google OAuth (lib arctic, state + PKCE). Exige `email_verified`, compara em minúsculas com `OWNER_EMAIL` e não grava nada se o acesso for negado. Redireciona para `/?erro=negado` ou `/?erro=falha`. **Aceite:** testes unitários de e-mail diferente, e-mail não verificado e maiúsculas; nenhuma linha é criada quando o acesso é negado.
- [x] 1.6 Middleware de sessão: token aleatório com hash no banco, cookie `HttpOnly; Secure; SameSite=Lax`, 30 dias renovados no uso, `usuario_id` sempre vindo da sessão, checagem de `Origin` nas escritas, e helper de posse que devolve 404. **Aceite:** sem cookie → 401; cookie expirado → 401; POST com outra origem → 403.
- [x] 1.7 Rotas `GET /api/eu`, `POST /auth/sair` e `POST /auth/sair-todos`. **Aceite:** depois de "sair de todos", um cookie antigo recebe 401.
- [x] 1.8 Base visual: tokens de cor e tipografia (tema escuro), componentes Botão, Toast (fila de 1, 4 s), Esqueleto, FaixaOffline e etiqueta de área. **Aceite:** contraste AA conferido; "reduzir movimento" respeitado; alvos de pelo menos 48px.
- [x] 1.9 Casca do app: BarraAbas (Chat, Tarefas, José sabe), rotas, guarda de rota (401 leva ao Login guardando a rota de volta) e coluna de 680px no computador. As abas Tarefas e José sabe mostram o estado vazio. **Aceite:** um teste Playwright navega por todas as telas e volta, sem beco sem saída.
- [ ] 1.10 Tela Login com os estados carregando, falha, negado e sucesso; Chat vazio com saudação por horário; Ajustes com ←, conta, Sair e Sair de todos (com confirmação). **Aceite:** as mensagens aparecem conforme `?erro=`.
- [ ] 1.11 PWA: manifest, ícone "J", service worker com a casca em cache e abertura offline com a faixa. **Aceite:** Lighthouse marca como instalável; com o modo avião ligado, o app abre e mostra "Offline".
- [ ] 1.12 **Prova de risco da voz:** adaptador Whisper (Workers AI, `pt`) e rota `POST /api/voz` (até 10 MB / 2 min, áudio descartado), mais uma página de teste com gravar → transcrever. **Aceite:** um áudio gravado no **iPhone real** (mp4/AAC) e um no Android voltam como texto em português. Se falhar, registrar e acionar o plano B em `execucao.md`.
- [ ] 1.13 Deploy na Cloudflare (`wrangler deploy`), com segredos via `wrangler secret`, migração remota e script de backup semanal (`wrangler d1 export`, guardando 4 cópias). **Aceite:** a URL `*.workers.dev` responde por HTTPS e o backup gera um arquivo.

## Como testar (roteiro para o Marco)
1. No iPhone, abra o link no Safari e toque em "Entrar com Google". Você deve cair no Chat, com "Bom dia, Marco." (ou boa tarde/boa noite).
2. Instale: Compartilhar → Adicionar à Tela de Início. Abra pelo ícone "J": você deve **continuar logado**.
3. Feche o app, espere um pouco e abra de novo: ainda logado.
4. Peça a alguém para tentar entrar com outro Gmail: deve aparecer "Acesso negado".
5. Toque nas 3 abas e em ⚙ Ajustes → ←. Nada fica travado.
6. Ligue o modo avião e abra o app: aparece a faixa "Offline".
7. Na página de teste de voz, grave "amanhã preciso ligar para o cliente às dez" e confira o texto.
8. Ajustes → Sair de todos os aparelhos: você volta para o Login.
