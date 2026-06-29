# Auditoria de Segurança - ConnectAI Backend

**Data:** 2026-06-28
**Escopo:** Backend Node.js + Fastify + Prisma (PostgreSQL/PostGIS) + JWT + Stripe + Redis + WebSocket. Auditoria com foco no pedido do dono do projeto: (a) usuário malicioso capaz de **derrubar as APIs** (DoS, exaustão de recurso, indisponibilidade) e (b) usuário malicioso capaz de **prejudicar** de qualquer forma (auth bypass, IDOR/BOLA, escalonamento de privilégio, vazamento de PII, fraude de billing/trial, abuso de regra de negócio, quebra de integridade). Análise estática do código em `src/` com leitura direta e verificação adversarial de cada achado. SQL cru já foi auditado previamente (tudo parametrizado com `Prisma.sql`, guarda em `src/lib/sql-safety.test.ts`) e está fora deste relatório.

---

## Sumário executivo

A postura de segurança do projeto é **sólida nos fundamentos** (SQL 100% parametrizado, JWT, error-handler global, denylist de moderação no REST, gates de privacidade em vários caminhos, anti-enumeração no password-reset), mas tem uma **falha estrutural recorrente de disponibilidade**: o rate-limit é opt-in por rota (`global: false`) e **várias rotas caras ficaram sem `config.rateLimit`** — justamente uploads de imagem, WebSocket e sugestões com IA/Places. O vetor de maior risco é o **WebSocket** (sem rate-limit, sem cap de conexões, sem `maxPayload` e ignorando a denylist de moderação), seguido das rotas de upload sem throttle. Há também inconsistências de modelo de privacidade (perfil por id vs. busca) e uma fraude de trial de baixo ROI. Nenhum achado é crítico isolado, mas o conjunto de gaps de DoS é assimétrico (custo baixíssimo para o atacante, impacto global) e deve ser priorizado.

| Severidade | Quantidade |
|---|---|
| Crítica | 0 |
| Alta | 2 |
| Média | 7 |
| Baixa | 10 |
| Info | 1 |
| **Total** | **20** |

> Observação: 25 achados confirmados na verificação adversarial foram consolidados em 20 entradas (F-01 a F-20) após mesclar duplicatas entre dimensões (rate-limit/trustProxy, Swagger/docs, upload de imagem, cap de conexões WS).

---

## Tabela de achados priorizados

| ID | Severidade | Categoria | Título | Local (file:line) |
|---|---|---|---|---|
| F-01 | **Alta** | DoS / AuthBypass | WebSocket sem rate-limit nem cap de conexões por usuário (exaustão de fd/memória/event-loop) | `chat.gateway.ts:141`, `notifications.gateway.ts:54`, `chat.hub.ts:23`, `server.ts:156` |
| F-02 | **Alta** | DoS | Flood de frames inbound no `/ws/chat`: 1 SELECT + 1 PUBLISH por frame, sem throttle e SELECT antes do authz | `chat.gateway.ts:189`, `chat.gateway.ts:119`, `chat.repository.ts:153` |
| F-03 | **Média** | DoS | Rotas de upload de imagem (avatar/evento/post) sem rate-limit chamando `sharp` inline | `users.routes.ts:142`, `events.routes.ts:105`, `posts.routes.ts:56`, `image-processor.service.ts:17` |
| F-04 | **Média** | AuthBypass | Handshake WebSocket não checa moderation-denylist nem accountStatus (banido opera no tempo real) | `chat.gateway.ts:148`, `notifications.gateway.ts:61`, `auth-decorators.ts:34`, `moderation-denylist.ts:39` |
| F-05 | **Média** | DoS | Rate-limit por `req.ip` sem `trustProxy` vira balde global atrás de proxy | `server.ts:79`, `server.ts:114`, `auth.routes.ts:33`, `rate-limit.ts:10` |
| F-06 | **Média** | DoS | `POST /spots/suggestions`: quota checada antes e consumida depois — concorrência dispara Places+IA em massa | `spots.service.ts:356`, `spots.service.ts:401`, `spots.service.ts:442`, `spots.repository.ts:396`, `spots.routes.ts:29` |
| F-07 | **Média** | DoS | WebSocket sem `maxPayload`: frame único de até ~100 MiB materializado em memória | `server.ts:156`, `chat.gateway.ts:189` |
| F-08 | **Média** | DataExposure / IDOR | `GET /users/:id` expõe perfil completo de conta privada a não-seguidores | `users.service.ts:109`, `users.repository.ts:96`, `users.repository.ts:27`, `users.routes.ts:78` |
| F-09 | **Média** | DoS | Flood de push via `POST` de comentários sem rate-limit (dedupeKey único por comentário) | `comments.routes.ts:31`, `comments.routes.ts:62`, `notification-shape.ts:58`, `notifications.service.ts:79` |
| F-10 | **Baixa** | DoS | Listagem e mapa de eventos (`authenticateOptional`) sem rate-limit — flood não autenticado de queries espaciais | `events.routes.ts:35`, `events.routes.ts:44`, `events.repository.ts:554` |
| F-11 | **Baixa** | AuthBypass | Brute-force/credential-stuffing sem trava por conta (só rate-limit por IP) | `auth.service.ts:62`, `auth.routes.ts:29` |
| F-12 | **Baixa** | DoS | Cliente Anthropic sem timeout em chamada inline de `/spots/suggestions` — handler pendurado até 10 min | `suggestion-ai/index.ts:20`, `suggestion-ai/index.ts:41`, `spots.service.ts:387`, `spots.service.ts:433` |
| F-13 | **Baixa** | AuthBypass | Denylist de moderação falha aberta sem Redis + refresh não barra BANNED/SUSPENDED | `moderation-denylist.ts:39`, `auth-decorators.ts:34`, `auth.service.ts:130` |
| F-14 | **Baixa** | DataExposure | Enumeração de contas por timing no login (bcrypt só roda para usuário existente) | `auth.service.ts:62` |
| F-15 | **Baixa** | DataExposure | Cadastro distingue 409 de e-mail x username (oráculo de enumeração) | `users.service.ts:155` |
| F-16 | **Baixa** | DataExposure | Indicador de digitação (`typing`) vaza para usuário que bloqueou o remetente | `chat.gateway.ts:127`, `chat.repository.ts:153`, `chat.hub.ts:150` |
| F-17 | **Baixa** | DataExposure | `/metrics` aberto por padrão quando `METRICS_TOKEN` não definido | `plugins/metrics.ts:62`, `env.ts:237` |
| F-18 | **Baixa** | BillingFraud | Política de 1-trial-por-usuário burlável via exclusão de conta + re-registro do mesmo e-mail | `users.repository.ts:592`, `users.repository.ts:532`, `billing.repository.ts:49`, `billing.service.ts:158` |
| F-19 | **Baixa** | BusinessLogic | Tracking de analytics (view/share) sem dedup, sem rate-limit e sem userId — inflação de métricas + linhas ilimitadas | `event-stats.service.ts:108`, `event-stats.repository.ts:23`, `event-stats.routes.ts:42`, `prisma/schema.prisma:535` |
| F-20 | **Info** | DataExposure | Swagger/Scalar (`/docs`) e OpenAPI expostos incondicionalmente, inclusive em produção | `server.ts:158`, `server.ts:169` |

---

## Achados detalhados

### [ALTA] F-01 — WebSocket sem rate-limit nem cap de conexões por usuário

**Local:** `src/modules/chat/chat.gateway.ts:141`, `src/modules/notifications/notifications.gateway.ts:54`, `src/modules/chat/chat.hub.ts:23`, `src/server.ts:156`

**Descrição:** As rotas `app.get('/ws/chat', { websocket: true }, ...)` e `/ws/notifications` não declaram `config.rateLimit`. O `@fastify/rate-limit` está registrado com `global: false` (opt-in por rota) e o evento de *upgrade* do WebSocket normalmente nem passa pelo `onRequest` HTTP onde o rate-limit atuaria — logo não há throttle algum no handshake. Além disso, o registry de sockets (`createSocketRegistry().add()`, `chat.hub.ts:23-29`) faz `set.add(socket)` em um `Set` por usuário **sem verificar `set.size`** — crescimento ilimitado de conexões simultâneas. Cada conexão aceita aloca um file descriptor, uma entrada no `Set` e **dois `setInterval`** (heartbeat + tokenCheck, `chat.gateway.ts:167` e `:182`; idem `notifications.gateway.ts:75` e `:89`). O mesmo JWT serve para N conexões (`app.jwt.verify` em `chat.gateway.ts:148` só valida assinatura/exp, sem nonce por conexão).

**Cenário de ataque:**
1. Atacante cria 1 conta e obtém um JWT válido.
2. Em loop, abre milhares de WebSockets em `wss://.../ws/chat?token=<jwt>` (e `/ws/notifications`) com o mesmo token.
3. Cada handshake passa no `jwt.verify` e é adicionado ao `Set` sem cap, criando 2 timers por socket.
4. Com N conexões: N file descriptors + 2N timers + N sockets vivos. O event-loop fica sobrecarregado pelos heartbeats; `registry.deliver` (`chat.hub.ts:45-58`) ainda itera todos os N sockets a cada mensagem entregue (amplificação de CPU).
5. fds/memória/event-loop se esgotam e o processo fica indisponível **para todos os usuários**.

**Impacto:** Indisponibilidade total do processo (todas as APIs, não só o WS) a partir de **uma única conta autenticada**. O heartbeat só derruba zumbis (sem pong) — não limita sockets ativos que o atacante mantém vivos nem o ritmo de abertura.

**Correção (passos concretos):**
- Aplicar um teto de conexões por usuário **dentro** de `createSocketRegistry().add()`, para que chat e notifications herdem o limite de uma vez:
  ```ts
  const MAX_SOCKETS_PER_USER = 8
  function add(userId: string, socket: ClientSocket) {
    const set = byUser.get(userId) ?? new Set()
    if (set.size >= MAX_SOCKETS_PER_USER) {
      socket.close(4429, 'too many connections')
      return false
    }
    set.add(socket)
    byUser.set(userId, set)
    return true
  }
  ```
- Opcionalmente, um teto global de sockets por processo e um throttle por IP/usuário no evento de upgrade.
- Cobrir com teste de handshake que rejeita a conexão N+1.

**Esforço:** P (a mudança no registry cobre os dois gateways).

---

### [ALTA] F-02 — Flood de frames inbound no `/ws/chat` (DB + Redis por frame, sem throttle)

**Local:** `src/modules/chat/chat.gateway.ts:189`, `src/modules/chat/chat.gateway.ts:119`, `src/modules/chat/chat.repository.ts:153`

**Descrição:** O handler `socket.on('message', (raw) => { void handleInbound(userId, raw.toString()) })` (`chat.gateway.ts:189-191`) processa **cada frame** sem rate-limit/debounce por socket e em modo *fire-and-forget* (sem backpressure). Para frames `typing`, `handleInbound` executa `findActiveParticipantUserIds(conversationId)` — um SELECT no Postgres (`chat.repository.ts:153-159`) — e depois um `realtime.publish` no Redis. Pior: o SELECT roda **antes** da checagem de participação (`if (!participantIds.includes(userId)) return`, `chat.gateway.ts:126-131`), então qualquer portador de JWT válido dispara a query com **qualquer `conversationId` arbitrário**, mesmo sem participar da conversa.

**Cenário de ataque:**
1. Atacante conecta em `/ws/chat` com token válido.
2. Dispara um loop enviando milhares de frames `{type:'typing',conversationId:'<qualquer-uuid>',isTyping:true}` por segundo.
3. Cada frame ⇒ 1 SELECT no Postgres (independente de ser participante) + (se participante) 1 PUBLISH no Redis + fan-out a todos os participantes locais.
4. Como é fire-and-forget, milhares de queries async concorrentes acumulam e **esgotam o pool de conexões do Prisma**, que starva REST + WS de todos os usuários.

**Impacto:** Exaustão do pool de conexões do banco a partir de um único socket autenticado ⇒ indisponibilidade global. Amplificação: 1 frame barato do atacante ⇒ trabalho de DB + Redis + broadcast no servidor.

**Correção:**
- Mover a checagem de participação para **antes** de qualquer query (remove o vetor do não-participante):
  ```ts
  // valida participação via cache/membership barato antes do SELECT pesado
  if (!(await isParticipant(userId, msg.conversationId))) return
  ```
- Adicionar throttle por socket para `typing` (token-bucket/janela em memória, ex.: 1 frame a cada 2-3s por conversa).
- Definir `maxPayload` e um teto de frames/s no registro do plugin websocket (ver F-07).

**Esforço:** M.

---

### [MÉDIA] F-03 — Rotas de upload de imagem sem rate-limit chamando `sharp` inline

**Local:** `src/modules/users/users.routes.ts:142`, `src/modules/events/events.routes.ts:105`, `src/modules/posts/posts.routes.ts:56`, `src/lib/image-processor/image-processor.service.ts:17`, `src/modules/events/events.controller.ts:136`

**Descrição:** `PATCH /users/me/avatar`, `POST /events/:id/images` e `POST /events/:eventId/posts/:postId/images` **não declaram `config.rateLimit`** — em contraste explícito com a rota de imagem do chat, que tem `rateLimit(30)` (`chat.routes.ts:142`), e com siblings baratas nos mesmos arquivos (`users.routes.ts:73`/`:119`, `events.routes.ts:60`/`:70`). Como o rate-limit é `global: false`, essas rotas ficam sem throttle. Cada request lê o arquivo inteiro em buffer (`data.toBuffer()`, até 5 MB) e executa `sharp(buffer).resize().webp().toBuffer()` inline no handler (`image-processor.service.ts:17`), trabalho CPU-bound no threadpool do libvips, além de upload/transformação no Cloudinary. O `sharp(buffer)` não define `limitInputPixels` customizado.

**Cenário de ataque:**
1. Atacante cria 1 conta e obtém JWT.
2. Em loop de alta concorrência, dispara `PATCH /users/me/avatar` (ou `POST /events/:id/images`) com um JPEG/PNG de ~5 MB.
3. Sem rate-limit, cada request carrega 5 MB em buffer e executa re-encode webp pesado de CPU; vários bitmaps grandes simultâneos pressionam memória.
4. CPU/threadpool do libvips saturam, a latência de **toda** a API dispara e o serviço fica indisponível; em paralelo, a fatura do Cloudinary cresce.

**Impacto:** Degradação/indisponibilidade de todas as rotas por exaustão de CPU/threadpool a partir de uma única conta + banda; custo financeiro no Cloudinary. O cap de 5 MB do multipart limita memória por request mas não a frequência nem o custo.

**Correção:**
- Adicionar `config: { rateLimit: rateLimit(10) }` (ou menor) nas três rotas, no padrão já usado no chat:
  ```ts
  api.patch('/users/me/avatar', { onRequest: [app.authenticate], config: { rateLimit: rateLimit(10) } }, uploadUserAvatar)
  ```
- Definir `limitInputPixels` explícito no `sharp` e considerar um cap de concorrência no image-processor.

**Esforço:** P.

---

### [MÉDIA] F-04 — Handshake WebSocket não aplica moderação (banido/suspenso opera no tempo real)

**Local:** `src/modules/chat/chat.gateway.ts:148`, `src/modules/notifications/notifications.gateway.ts:61`, `src/lib/auth-decorators.ts:34`, `src/lib/moderation-denylist.ts:39`

**Descrição:** Os dois gateways WS autenticam o handshake **apenas** com `app.jwt.verify(token)` e não consultam a denylist de moderação nem releem `accountStatus`. O decorator REST `authenticate` (`auth-decorators.ts:34`) faz exatamente isso após o verify: chama `isBlocked(payload.sub)` (Redis SET de contas SUSPENDED/BANNED) e lança 401. A revalidação periódica do WS (`tokenCheck`, `chat.gateway.ts:182-187`) só cobre **expiração** do JWT (`isTokenExpired`), nunca reconsulta moderação. Como o JWT do projeto não expira em prazo curto (comentários explícitos em `moderation-denylist.ts:5-8` e `auth-decorators.ts:31-33`), uma conta punida mantém um token criptograficamente válido.

**Cenário de ataque:**
1. Atacante é usuário legítimo com sessão mobile ativa (JWT de longa duração no device).
2. Um moderador bane/suspende a conta; todo request REST passa a retornar 401 e o app desloga.
3. O atacante **não deixa o app deslogar**: usa o JWT que já possui e abre `GET /ws/chat?token=<jwt>` e/ou `/ws/notifications?token=<jwt>`.
4. O gateway faz `jwt.verify` com sucesso e **não consulta `isBlocked`** — a conexão é aceita.
5. O banido recebe mensagens ao vivo das conversas onde participa, vê presença, recebe notificações ao vivo e emite `typing` — tudo após o ban, até o JWT expirar naturalmente.

**Impacto:** Bypass da moderação no canal mais sensível (tempo real). Contido no lado de **leitura/presença**: o envio/persistência de novas mensagens passa pelo REST (`chat.service.ts`, que checa `isBlocked`/`isBlockedEitherWay`), então o banido não posta conteúdo novo — mas continua lendo, vendo presença e recebendo notificações.

**Correção:**
- Reusar `isBlocked(claims.sub)` no handshake (await antes de aceitar o socket) e dentro do `tokenCheck` periódico (fechar com 4401 se virar bloqueado durante a sessão), espelhando o decorator REST.
- Cobrir com teste de handshake que rejeita conta SUSPENDED/BANNED nos dois gateways.

**Esforço:** P.

---

### [MÉDIA] F-05 — Rate-limit por `req.ip` sem `trustProxy` vira balde global atrás de proxy

**Local:** `src/server.ts:79`, `src/server.ts:114`, `src/modules/auth/auth.routes.ts:33`, `src/lib/rate-limit.ts:10`

**Descrição:** A instância Fastify é criada **sem `trustProxy`** (`server.ts:79-88`) e o `@fastify/rate-limit` é registrado **sem `keyGenerator`** (`server.ts:114-118`), caindo no default `req => req.ip`. Sem `trustProxy`, `req.ip` é o peer do socket. O próprio codebase prova que roda atrás de proxy: `consent.controller.ts:72-83` parseia manualmente `x-forwarded-for` (com `TRUSTED_PROXIES`) porque `req.ip` não reflete o cliente real. Quando o proxy não preserva o IP de origem no socket, **todas** as requisições chegam com o IP do proxy e os limites por rota (login=10, forgot=5, reset=10, refresh=30, social=20) viram um único balde compartilhado por toda a base.

**Cenário de ataque:**
1. App roda atrás de ALB/nginx/ingress (cenário típico de produção; há Dockerfile/compose no repo).
2. Atacante envia >10 `POST /auth/login` por minuto de um IP qualquer.
3. Como a chave é o IP do proxy (igual para todos), o balde de 10/min do login estoura **globalmente**.
4. Usuários legítimos passam a receber 429 ao tentar logar/refresh — login indisponível para a base inteira a partir de um único atacante. Inversamente, o anti-brute-force fica inútil (10 tentativas/min para o mundo todo, não por atacante).

**Impacto:** DoS de aplicação no caminho crítico de auth (login/refresh/reset) + diluição da proteção anti-brute-force. Condicionado à topologia de proxy de produção (precisa não preservar o IP de origem no socket).

**Correção:**
- Definir um `keyGenerator` no rate-limit que reuse a **mesma lógica de IP confiável** já existente em `consent.controller` (`extractMeta`/`isTrustedProxy`/`forwardedIp`) — idealmente extraída para um lib compartilhado — e configurar `trustProxy` de forma consistente (por env, ex.: número de hops ou CIDR do LB).
- Reforçar: keyar `/auth/login` também por email para fortalecer o anti-brute-force.
- **Evitar o remendo** de ligar `trustProxy: true` cego, que passaria a confiar em `x-forwarded-for` de qualquer cliente e permitiria spoof do IP (troca um problema por outro).
- **Antes de priorizar**, validar a topologia real de prod (ALB/ELB com X-Forwarded-For vs NLB L4).

**Esforço:** M.

---

### [MÉDIA] F-06 — `POST /spots/suggestions`: quota checada antes, consumida depois — concorrência dispara Places+IA em massa

**Local:** `src/modules/spots/spots.service.ts:356`, `src/modules/spots/spots.service.ts:401`, `src/modules/spots/spots.service.ts:442`, `src/modules/spots/spots.repository.ts:396`, `src/modules/spots/spots.routes.ts:29`

**Descrição:** A rota `POST /spots/suggestions` **não tem `config.rateLimit`**; a única defesa de abuso é a quota diária (free 5 / premium 25). Mas a quota é apenas **lida** no pre-flight (`findTodayGenerationCount >= limit`, `spots.service.ts:356`, SELECT **sem lock**) e só é **consumida** atomicamente (`consumeGenerationQuota`, `spots.repository.ts:396`, `INSERT ... ON CONFLICT ... WHERE count < limit`) **depois** de executar todo o trabalho caro: `composeProfileQueries` (IA Haiku), N Text Search no Google Places em `Promise.all` (`spots.service.ts:401`) e `enhance` (IA). O consume atômico protege o **contador**, não o **custo**. A chave de cache inclui o texto livre normalizado (`q:${intent.toLowerCase()}`, `spots.service.ts:371`; schema `min(3).max(120)` em `spots.schema.ts:78`), então variar o texto força cache MISS sempre.

**Cenário de ataque:**
1. Atacante autentica (1 conta free).
2. Dispara, em paralelo, centenas de `POST /spots/suggestions` com query variando a cada request (`'bar 1'`, `'bar 2'`, ...), forçando cache MISS.
3. Como não há rate-limit e o pre-flight é uma leitura sem lock, todas as N requisições concorrentes leem `count<limit` e prosseguem.
4. Cada uma executa Text Search no Places + 2 chamadas de IA. Só no consume final as vencedoras passam; o resto recebe 429 — **mas o custo de Places+IA de todas já foi pago**.
5. Repetindo com bursts e várias contas, drena o budget do Google Places e da Anthropic e/ou estoura o rate-limit do provider, indisponibilizando a feature.

**Impacto:** Amplificação de custo externo (Places + Anthropic) e potencial indisponibilidade da feature de sugestões. O consume atômico limita o dano sustentado por conta-dia, então a amplificação ilimitada se restringe ao burst de concorrência dentro de uma janela de quota + multi-conta.

**Correção (raiz, no espírito do CLAUDE.md):**
- Adicionar `config.rateLimit` na rota para limitar o volume por usuário/IP.
- **Reservar/consumir a quota ANTES** de chamar Places+IA (mover `consumeGenerationQuota` para antes do bloco caro, com rollback/estorno se Places/IA falhar), de modo que o teto atômico também limite o custo, não só o contador.
- Aumentar TTL/cache **não** resolve, porque o texto livre derrota a chave.

**Esforço:** M.

---

### [MÉDIA] F-07 — WebSocket sem `maxPayload`: frame único de até ~100 MiB materializado em memória

**Local:** `src/server.ts:156`, `src/modules/chat/chat.gateway.ts:189`

**Descrição:** `app.register(fastifyWebsocket)` é chamado **sem options**, logo sem `maxPayload`. O default do `ws` subjacente (confirmado em `node_modules/.../ws/lib/websocket-server.js:74`) é `100 * 1024 * 1024` = 100 MiB por frame. Em `chat.gateway.ts:190`, cada frame vira `raw.toString()` (cópia integral para string) **antes** de qualquer validação de tamanho — o único filtro implícito é o `JSON.parse` em `handleInbound`, que só roda após a alocação. O `@fastify/multipart` limita uploads HTTP a 5 MB, mas o canal WS não tem limite equivalente (20x o limite HTTP).

**Cenário de ataque:**
1. Atacante conecta em `/ws/chat` com token válido.
2. Envia um único frame de dezenas de MB (até ~100 MiB).
3. O servidor bufferiza o frame inteiro e chama `raw.toString()`, alocando ~100 MiB de Buffer + até ~200 MiB de string.
4. Repetindo em paralelo por várias conexões, dispara picos de memória e pressão de GC, podendo causar OOM.

**Impacto:** Pressão de memória/GC e possível OOM. O `ws` encerra frames acima de 100 MiB (close 1009), então o tamanho não é ilimitado e o atacante paga banda real — por isso média e não alta. Afeta apenas o chat (notifications só lê Redis pub/sub).

**Correção:** Como toda mensagem inbound aceita é apenas `{type:'typing', conversationId, isTyping}`, um cap de poucos KB basta:
```ts
app.register(fastifyWebsocket, { options: { maxPayload: 65536 } })
```
Reforço adicional: checar `raw.length` antes do `toString()` para descartar frames grandes sem materializar a string.

**Esforço:** P.

---

### [MÉDIA] F-08 — `GET /users/:id` expõe perfil completo de conta privada a não-seguidores

**Local:** `src/modules/users/users.service.ts:109`, `src/modules/users/users.repository.ts:96`, `src/modules/users/users.repository.ts:27`, `src/modules/users/users.controller.ts:62`, `src/modules/users/users.routes.ts:78`

**Descrição:** `GET /users/:id` (rota com `authenticateOptional`) chama `getUserById` → `findUserById`, que filtra apenas por `activeUserWhere()` (accountStatus ACTIVE), **sem gate de privacidade**, e seleciona `userPublicProfileSelect` (`users.repository.ts:27-31`) — bio, followersCount, followingCount, createdAt, eventsCount e as preferências de categoria/subcategoria — de **qualquer** usuário, inclusive contas `isPrivate=true`. Isto contradiz a própria política do projeto: `searchUsers` (`users.service.ts:89-101`) aplica deliberadamente um *reduced card* para contas privadas sem follow ACCEPTED, escondendo bio/counts/createdAt. A inconsistência está travada por teste (`users.test.ts:147-148` espera 200 com perfil inteiro vs. `users.test.ts:829-832` que garante que a busca esconde os mesmos campos no mesmo cenário).

**Cenário de ataque:**
1. Atacante obtém o id (UUID) de uma conta privada (search reduzido, autor de comentário, deep-link, lista de participantes de evento público).
2. Envia `GET /users/<uuid-privado>` sem token (ou como não-seguidor).
3. Recebe 200 com bio, followersCount, followingCount, createdAt, eventsCount e as preferências de rolê do alvo privado — exatamente o que a tela de busca recusa mostrar.
4. Iterando ids/usernames, raspa em massa o grafo social (contadores) e os interesses de contas privadas.

**Impacto:** Quebra do modelo de privacidade + enumeração de metadados de perfil. **PII direta (email/phone/birthdate/role) NÃO vaza** — esses campos estão em `userPrivateProfileSelect`, usado só em `/users/me`. O que vaza são metadados que o usuário marcou como privados — por isso média, não alta.

**Correção (raiz):** Aplicar em `getUserById` o **mesmo gate** já existente em `searchUsers`: quando `user.isPrivate && viewerId !== id && followStatus !== 'ACCEPTED'`, retornar o card mínimo (id/username/name/lastname/avatarUrl/isPrivate/followStatus). Como a serialização é por Zod, a redução deve refletir no schema de resposta da rota. **Idealmente extrair a lógica de gate** para uma função compartilhada (`profile-visibility`) para as duas rotas não divergirem de novo. Verificar separadamente `GET /users/:id/events` (também `authenticateOptional`).

**Esforço:** M.

---

### [MÉDIA] F-09 — Flood de push via `POST` de comentários sem rate-limit

**Local:** `src/modules/comments/comments.routes.ts:31-38`, `:62-69`, `src/modules/comments/comments.service.ts:47-53`, `:68-76`, `src/modules/notifications/notification-shape.ts:50-66`, `src/modules/notifications/notifications.service.ts:79-109`

**Descrição:** As rotas `POST /events/:eventId/comments` e `POST /posts/:postId/comments` declaram apenas `onRequest:[app.authenticate]`, **sem `config.rateLimit`** (rate-limit é opt-in). Cada comentário dispara `notifyFromActor` com `commentId=comment.id`. O `dedupeKey` embute o `commentId` (`notification-shape.ts:58-65`), que é **sempre novo**, então `createNotificationIfNew` nunca colide na unique constraint e **sempre insere** uma linha. `dispatchSocial` então sempre publica em realtime e, com consentimento `pushNotifications`, sempre chama `enqueuePush` → push Expo real. Eventos públicos são acessíveis por qualquer autenticado (`event-invites.access.ts:16`).

**Cenário de ataque:**
1. Atacante autentica (qualquer conta) e escolhe um evento público da vítima.
2. Dispara em loop `POST /events/:eventId/comments` com `{content:'x'}` (min 1 / max 500).
3. Cada request cria um comment com `commentId` único → `dedupeKey` único → insere sempre → realtime + push Expo real no device da vítima.
4. Sem rate-limit, centenas/milhares de requests/min ⇒ 1 notificação in-app + 1 push do SO por comentário. Multiplicável em vários eventos/posts em paralelo.

**Impacto:** Bombardeio de push (harassment) no device da vítima, inflação de `unreadCount`, crescimento ilimitado da tabela `notification` e do feed de comentários. É autenticado-only e limitado por latência HTTP/DB (não derruba a API instantaneamente), por isso média.

**Correção:** Adicionar `config: { rateLimit: rateLimit(N) }` nas rotas `POST` de comments (e por consistência em posts/reactions). Mitigação adicional no service: **coalescer** notificações de comentário por `(actor, event)` numa janela de tempo, em vez de `dedupeKey` por `commentId`, reduzindo o flood mesmo sob rate-limit.

**Esforço:** P (rate-limit) / M (coalescing).

---

### [BAIXA] F-10 — Listagem e mapa de eventos (`authenticateOptional`) sem rate-limit

**Local:** `src/modules/events/events.routes.ts:35`, `:44`, `src/modules/events/events.repository.ts:554`

**Descrição:** `GET /events` e `GET /events/map` usam `authenticateOptional` (funcionam sem token) e **não declaram `config.rateLimit`**, enquanto as siblings mais pesadas são throttladas (`/events/map/events` = `rateLimit(240)`, `/events/search` = `rateLimit(30)`). O custo por request é não-trivial: `findEventsForMap` faz `findEventIdsInBbox` (espacial PostGIS, cap 2000) + `findMany` + `groupBy` + sort em memória (3 round-trips ao Postgres, até 2000 linhas materializadas). A lista com `orderBy=distance` faz `findEventIdsByDistance` (overfetch até 1000) + `findMany` com includes completos + reordenação. O `mapEventsQuerySchema` real não tem `limit` de cliente — usa caps internos de 2000 fetch / 500 resposta.

**Cenário de ataque:**
1. Sem login, atacante dispara em alta taxa `GET /events/map?bbox...` variando o bbox e `GET /events?orderBy=distance&nearLat=...&nearLng=...` variando coordenadas (invalida cache).
2. Cada request roda query espacial + hidratação no Postgres.
3. Distribuindo o flood por muitos IPs, satura o pool do Postgres e CPU de serialização, degradando a API para legítimos.

**Impacto:** Degradação por volume; custo moderado por request (índices PostGIS + caps internos). Depende de volume/distribuição, por isso baixa.

**Correção:** Adicionar `config: { rateLimit: rateLimit(N) }` a `/events` e `/events/map`, alinhando com as siblings espaciais já throttladas.

**Esforço:** P.

---

### [BAIXA] F-11 — Brute-force/credential-stuffing sem trava por conta

**Local:** `src/modules/auth/auth.service.ts:62-73`, `src/modules/auth/auth.routes.ts:29-36`

**Descrição:** `POST /auth/login` só tem rate-limit por IP (10/min). Não há contador de tentativas falhas **por conta** nem lockout temporário após N senhas erradas — diferente do password-reset, que tem `PASSWORD_RESET_MAX_ATTEMPTS` e cooldown por conta. MFA só existe para ADMIN (`assertAdmin`, `auth.service.ts:212-219`), então usuário comum tem a senha (mín. 6 chars, `auth.schema.ts:5`) como único fator.

**Cenário de ataque:**
1. Atacante tem credenciais vazadas (email+senha de outros sites).
2. Distribui as tentativas por dezenas de IPs (proxies residenciais), cada IP <=10 req/min.
3. Sem lockout por conta, a conta-alvo aceita tentativas ilimitadas no agregado.
4. Senhas reusadas caem; o atacante assume a conta.

**Impacto:** Takeover de contas com senha reusada/fraca via credential-stuffing distribuído. É um controle de hardening **ausente** (defesa em profundidade), não um bypass garantido — o rate-limit por IP, bcrypt cost 10 e erro genérico já impõem fricção; exige atacante com pool de IPs. Por isso baixa.

**Correção:** Adicionar contador de falhas + cooldown por conta (espelhando `PASSWORD_RESET_MAX_ATTEMPTS`), idealmente com chave de rate-limit por email além de por IP.

**Esforço:** M.

---

### [BAIXA] F-12 — Cliente Anthropic sem timeout em chamada inline de `/spots/suggestions`

**Local:** `src/lib/suggestion-ai/index.ts:20`, `:41`, `src/modules/spots/spots.service.ts:387`, `:433`

**Descrição:** Os clientes Anthropic são instanciados como `new Anthropic({ apiKey })` **sem `timeout`** (`suggestion-ai/index.ts:20` e `:41`); o default do SDK é 10 minutos + `maxRetries=2`. Essas chamadas (`composeProfileQueries` e `enhance`) rodam **inline** no handler de `POST /spots/suggestions` (`spots.service.ts:387` e `:433`). Diferente do Places (que usa `AbortSignal.timeout`), a IA não tem timeout curto. Combinado com a ausência de rate-limit na rota (F-06), se a API da Anthropic ficar lenta cada request fica preso por até 10 min.

**Cenário de ataque:**
1. A API da Anthropic degrada (pré-condição externa, fora do controle do atacante).
2. Atacante dispara muitas requisições `POST /spots/suggestions` concorrentes.
3. Cada handler fica pendurado aguardando a IA por até 10 min, acumulando sockets presos.

**Impacto:** Risco de resiliência: handlers pendurados durante degradação da Anthropic. **Não é DoS diretamente acionável** — depende de a Anthropic estar lenta, que o atacante não controla. Por isso baixa.

**Correção (hardening):** Passar `timeout` curto por request (ex.: `messages.parse(params, { timeout: 10000, maxRetries: 0 })`) ou no construtor `new Anthropic({ apiKey, timeout: 10000 })`, espelhando o `AbortSignal.timeout` do Places. Como ambos os enhancers já têm fallback gracioso (template) no catch, um timeout curto degrada para template em vez de pendurar — ganho de resiliência sem regressão.

**Esforço:** P.

---

### [BAIXA] F-13 — Denylist de moderação falha aberta sem Redis + refresh não barra BANNED/SUSPENDED

**Local:** `src/lib/moderation-denylist.ts:39-47`, `src/lib/auth-decorators.ts:34-36`, `src/modules/auth/auth.service.ts:130-136`

**Descrição:** `isBlocked` degrada para `false` quando o Redis está indisponível (fail-open consciente, `moderation-denylist.ts:40` e `:44-46`). `authenticate` confia **somente** na denylist Redis e nunca relê `User.accountStatus` do banco. Pior: `rotateRefreshToken` → `assertSessionRenewable` (`auth.service.ts:130-136`) só barra `ANONYMIZED`, **não** BANNED/SUSPENDED — então a sessão de um banido se auto-renova via `/auth/refresh` independentemente do estado do Redis. Defaults: access 15m, refresh 90d.

**Cenário de ataque:**
1. Usuário é banido (accountStatus=BANNED).
2. Redis cai/é esvaziado — `isBlocked` degrada para false.
3. O banido segue usando o app e, a cada 15m, renova via `/auth/refresh` (que não barra BANNED/SUSPENDED).
4. O ban só passa a valer quando o Redis volta E o boot roda `rebuildFromDb`, ou quando o refresh de 90 dias expira.

**Impacto:** Janela de bypass de ban potencialmente longa. **Não diretamente explorável** — o gatilho (Redis indisponível) está fora do controle do atacante; com Redis saudável o ban é aplicado a cada request. Por isso baixa.

**Correção (raiz barata):** Incluir BANNED/SUSPENDED em `assertSessionRenewable` — fecha o `/auth/refresh` para conta punida **independentemente do Redis**. Opcionalmente, fail-closed seletivo para contas críticas.

**Esforço:** P.

---

### [BAIXA] F-14 — Enumeração de contas por timing no login

**Local:** `src/modules/auth/auth.service.ts:62-73`

**Descrição:** `validateLogin` busca o usuário por email e, se `!user || !user.password || accountStatus === 'ANONYMIZED'`, lança 401 **imediatamente** (`:66-67`), antes de qualquer `bcrypt.compare`. Só para usuários existentes com senha o fluxo chega ao `compare` (`:70`, ~50-100ms). Não há comparação contra hash dummy para equalizar o tempo. A mensagem é idêntica nos dois casos (bom), mas o **tempo** difere.

**Cenário de ataque:**
1. Atacante mede a latência de `POST /auth/login` com `{email: alvo, password: 'x'}`.
2. Emails não cadastrados respondem em poucos ms (sem bcrypt); cadastrados demoram ~50-100ms a mais.
3. Com uma wordlist, separa contas existentes das inexistentes pela diferença de tempo — alvos para phishing/credential-stuffing.

**Impacto:** Revela apenas **existência** de conta, não credenciais nem PII. O rate-limit de 10/min por IP throttla severamente a coleta e o sinal de ~50-100ms é da ordem do jitter de rede (oráculo ruidoso). Por isso baixa.

**Correção:** Rodar `bcrypt.compare` contra um hash dummy constante quando o usuário não existe/sem senha, para equalizar o tempo dos dois caminhos.

**Esforço:** P.

---

### [BAIXA] F-15 — Cadastro distingue 409 de e-mail x username (oráculo de enumeração)

**Local:** `src/modules/users/users.service.ts:155-170`

**Descrição:** `registerUser` checa e-mail e username separadamente e lança mensagens 409 distintas: `'Este e-mail já está cadastrado em outra conta.'` vs `'Este nome de usuário já está em uso.'`. A rota `POST /users` é não autenticada com `rateLimit(10)`. Contrasta com o password-reset, deliberadamente anti-enumeração (`password-reset.service.ts:22-46`).

**Cenário de ataque:**
1. Atacante envia `POST /users` com um e-mail alvo + username aleatório improvável de colidir.
2. Se receber 409 com a mensagem de e-mail, confirma que o e-mail tem conta.
3. Repetindo (até 10/min por IP), mapeia quais e-mails de uma lista têm conta na plataforma.

**Impacto:** Disclosure de existência de e-mail. Parcialmente intrínseco (a constraint UNIQUE já produziria 409); `rateLimit(10)` limita o volume. Por isso baixa.

**Correção:** Unificar a mensagem 409 do cadastro (ex.: `'E-mail ou nome de usuário já em uso.'`), alinhando com a postura anti-enumeração do password-reset.

**Esforço:** P.

---

### [BAIXA] F-16 — Indicador de digitação (`typing`) vaza para usuário que bloqueou o remetente

**Local:** `src/modules/chat/chat.gateway.ts:127`, `src/modules/chat/chat.repository.ts:153`, `src/modules/chat/chat.hub.ts:150`

**Descrição:** O caminho de **presença** filtra bloqueios via `NOT EXISTS` em `findConversationPartnerIds` (`chat.repository.ts:175-179`). Já o caminho de **typing** usa `findActiveParticipantUserIds` (`chat.repository.ts:153`), que **não filtra blocks**, e `dispatchEvent` só remove o próprio autor da lista (`chat.hub.ts:150-154`). `authorizeSend` (`chat.service.ts:183-193`) só aplica `isBlockedEitherWay` para bloquear **envio de mensagem** em DIRECT, não a propagação do `typing`.

**Cenário de ataque:**
1. Usuário B está numa conversa (grupo ou direct) com A.
2. A bloqueia B.
3. B digita; o servidor publica `typing` para todos os participantes ativos sem filtrar o bloqueio.
4. O cliente de A recebe o frame `typing` de B — vaza atividade/presença de B apesar do bloqueio.

**Impacto:** Vazamento de 1 bit de presença/atividade (paper-cut de privacidade), sem conteúdo de mensagem, PII, IDOR ou DoS. Quebra a paridade que os próprios devs estabeleceram para presença. Por isso baixa.

**Correção (raiz):** Reaproveitar o mesmo `NOT EXISTS blocks` de `findConversationPartnerIds` para o caminho de typing (ou filtrar `participantIds` por blocos antes de publicar/dispatch), garantindo paridade entre typing e presença. Manter a validação de participação atual.

**Esforço:** P.

---

### [BAIXA] F-17 — `/metrics` aberto por padrão quando `METRICS_TOKEN` não definido

**Local:** `src/plugins/metrics.ts:62`, `src/lib/env.ts:237`

**Descrição:** `METRICS_ENABLED` tem default `true` e `METRICS_TOKEN` é opcional. Quando o token não é definido, a rota `/metrics` é registrada **sem `onRequest` de auth** (`token ? { onRequest } : {}`, `metrics.ts:71-78`). Diferente de CORS/EMAIL_DRIVER/REDIS_URL, **não há refine de boot** exigindo o token em produção (`env.ts` tem refines para os outros em `:356/:371/:383`, nenhum para METRICS_TOKEN).

**Cenário de ataque:**
1. Deploy de prod sem `METRICS_TOKEN` setado e sem ACL de rede em `/metrics`.
2. Atacante faz `GET /metrics`.
3. Recebe o dump Prometheus: rotas conhecidas, volumes, latências, taxas de erro por status — reconhecimento da app.

**Impacto:** Vazamento de telemetria de reconhecimento (sem PII/credenciais). Depende de **dupla misconfiguração** (token ausente + sem ACL de borda). Por isso baixa.

**Correção:** Espelhar o refine de CORS exigindo `METRICS_TOKEN` quando `NODE_ENV=production` e `METRICS_ENABLED`. Quando o token existe, a auth já usa `timingSafeEqual` (bom).

**Esforço:** P.

---

### [BAIXA] F-18 — Política de 1-trial-por-usuário burlável via exclusão + re-registro do mesmo e-mail

**Local:** `src/modules/users/users.repository.ts:592`, `:532`, `src/modules/billing/billing.repository.ts:49`, `src/modules/users/users.service.ts:155`, `src/modules/billing/billing.service.ts:158`

**Descrição:** A elegibilidade de trial é decidida por `hasAnyPreviousSubscription(userId)` (`billing.repository.ts:49`), que conta linhas da tabela `subscription` **do userId atual**. A anonimização executa `tx.subscription.deleteMany({ where: { userId } })` (`users.repository.ts:592`), apagando todo o histórico, e troca o email do titular para `deleted+${userId}@deleted.invalid` (`:532`), liberando o email original. `terminateBillingForUser` também **deleta o Customer no Stripe** (`billing.service.ts:471`), removendo dedupe do gateway. `registerUser` só rejeita colisão exata de email (`:159`). O novo userId não tem nenhuma linha em `subscription` ⇒ `hasAnyPreviousSubscription=false` ⇒ recebe `TRIAL_DAYS=7` de novo.

**Cenário de ataque:**
1. Atacante cria conta, consome o trial de 7 dias.
2. Pede exclusão da conta (self-service).
3. Após o grace de 30 dias, o reconciler anonimiza: deleta o Customer no Stripe, apaga `subscription`, renomeia o email.
4. Atacante re-registra com o mesmo email ⇒ novo userId sem histórico ⇒ `trialEligible=true` ⇒ outro trial de 7 dias. Repetível em loop.

**Impacto:** Burla da política de 1-trial-por-usuário. **ROI negativo** (esperar 30 dias para reganhar 7 dias de premium), não repetível em taxa relevante. Por isso baixa.

**Correção (raiz):** Persistir um sinal de "já teve trial" que **sobreviva à anonimização** (hash unidirecional do email e/ou fingerprint do PaymentMethod/cartão), consultado pelo gate de trial, em vez de depender da tabela `subscription` do userId atual.

**Esforço:** M.

---

### [BAIXA] F-19 — Tracking de analytics (view/share) sem dedup, sem rate-limit e sem userId

**Local:** `src/modules/event-stats/event-stats.service.ts:108`, `src/modules/event-stats/event-stats.repository.ts:23`, `src/modules/event-stats/event-stats.routes.ts:42`, `prisma/schema.prisma:535`

**Descrição:** `POST /events/:id/analytics/view` e `/share` têm apenas `authenticate` + `ensureEventAccess`, **sem `config.rateLimit`**. `trackEventAnalyticsMetric` → `createEventAnalyticsMetric` faz `prisma.eventAnalyticsMetric.create()` — uma linha nova por request. O modelo `EventAnalyticsMetric` (`schema.prisma:535-545`) **não tem `userId` nem unique constraint** (só `@@index([eventId,type,occurredAt])`): dedup impossível. `checkEventAccess` libera evento público para qualquer autenticado.

**Cenário de ataque:**
1. Atacante autentica e escolhe um evento público (ou privado onde foi convidado).
2. Dispara em loop `POST /events/:id/analytics/view` e `/share`.
3. Cada request insere uma linha; sem dedup nem rate-limit.
4. **Integridade:** o autor Premium vê `totals.views`/`totals.shares` inflados em `GET /events/:id/stats` e no CSV — métrica de negócio (feature Premium) corrompida. **Disponibilidade:** inserts ilimitados crescem a tabela e o índice sem limite.

**Impacto:** Inflação de métricas vanity (views/shares) e crescimento ilimitado da tabela. Não envolve dinheiro/auth/PII/IDOR; confirmations vêm de tabela separada e não são forjáveis aqui. Por isso baixa.

**Correção:** Adicionar `config.rateLimit` nas duas rotas e, idealmente, registrar `userId` em `EventAnalyticsMetric` com unique parcial por janela de tempo para dedup, mantendo a métrica de negócio confiável.

**Esforço:** P (rate-limit) / M (dedup + schema).

---

### [INFO] F-20 — Swagger/Scalar (`/docs`) e OpenAPI expostos incondicionalmente em produção

**Local:** `src/server.ts:158`, `src/server.ts:169`

**Descrição:** `fastifySwagger` + `ScalarApiReference` (routePrefix `/docs`) são registrados sem gate por `NODE_ENV` nem auth. Em produção, qualquer um acessa `/docs` e o JSON OpenAPI, obtendo o mapa completo da superfície da API (rotas billing/webhook/admin, shapes de request/response, enums).

**Cenário de ataque:** Atacante acessa `https://api.../docs`, lê a spec completa e usa o mapa para mirar checkout/subscribe/featured/IDOR sem engenharia reversa do app mobile.

**Impacto:** Divulgação do **mapa** da API — facilita reconhecimento, mas **não é vulnerabilidade por si**: não expõe segredos/PII, o `/webhooks/stripe` continua protegido por assinatura HMAC, rotas premium-gated continuam exigindo auth, e a mesma informação é trivialmente obtida observando o tráfego do app mobile. Segurança por obscuridade não é controle válido. Por isso info.

**Correção (hardening, não bloqueante):** Envolver ambos os registros em `if (env.NODE_ENV !== 'production')` ou adicionar `onRequest` de auth no `/docs` e no endpoint JSON. Trade-off: o produto pode querer `/docs` público para integradores — decisão de negócio.

**Esforço:** P.

---

## Disponibilidade / DoS

Esta seção consolida o vetor mais preocupante da auditoria, atendendo ao pedido explícito do dono. A **causa raiz comum** é arquitetural: `@fastify/rate-limit` está com `global: false` (opt-in por rota), então **toda rota que não declara `config.rateLimit` fica sem throttle algum**. Várias rotas caras ficaram de fora, em contraste com siblings baratas que têm rate-limit — evidência de omissão acidental, não decisão.

**Mapa de cobertura de rate-limit (lacunas):**

| Rota / canal | Tem rate-limit? | Custo por request | Achado |
|---|---|---|---|
| `/ws/chat`, `/ws/notifications` (handshake) | Não (e upgrade não passa pelo hook HTTP) | fd + 2 timers + socket por conexão | F-01 |
| `/ws/chat` (frames inbound `typing`) | Não | 1 SELECT + 1 PUBLISH por frame | F-02 |
| `PATCH /users/me/avatar`, `POST /events/:id/images`, `POST .../posts/:postId/images` | Não | `sharp` CPU-bound + Cloudinary | F-03 |
| `POST /spots/suggestions` | Não | Places (N) + 2x IA Anthropic | F-06, F-12 |
| `POST /events/:eventId/comments`, `/posts/:postId/comments` | Não | insert + realtime + push Expo | F-09 |
| `GET /events`, `GET /events/map` | Não (`authenticateOptional`) | query espacial PostGIS (até 2000 linhas) | F-10 |
| `POST /events/:id/analytics/view`/`share` | Não | insert ilimitado (sem dedup) | F-19 |
| `/auth/*`, `/events/map/events`, `/events/search`, REST de chat | Sim | — | (referência do padrão correto) |

**Defesas recomendadas (consolidadas):**

1. **Cobertura de rate-limit:** declarar `config.rateLimit` em todas as rotas de write/upload/IA/espaciais sem throttle (F-03, F-06, F-09, F-10, F-19). É o quick win de maior alavancagem.
2. **Chave de rate-limit correta:** resolver o `trustProxy`/`keyGenerator` (F-05) para que o throttle realmente isole por cliente atrás do proxy — caso contrário o item 1 vira balde global.
3. **Tetos de WebSocket:** cap de conexões por usuário no registry (F-01), `maxPayload` baixo (F-07) e throttle por socket nos frames inbound (F-02) — o canal WS hoje não tem nenhuma das três defesas.
4. **Reservar quota antes do trabalho caro:** em `/spots/suggestions`, consumir a quota **antes** de Places+IA (F-06), e dar timeout curto às chamadas de IA (F-12).
5. **Limites de upload/pixels:** já há `fileSize 5MB`; adicionar `limitInputPixels` explícito no `sharp` e considerar cap de concorrência no image-processor (F-03).
6. **Timeouts externos:** Places já usa `AbortSignal.timeout`; replicar timeout curto na Anthropic (F-12).
7. **Backpressure de WebSocket:** o handler de mensagens é fire-and-forget; introduzir limite de frames/s por socket e processar com backpressure (F-02).

---

## Roadmap de correção

### Fase 1 — Quick wins (P, alto impacto, baixo risco)
Aplicar imediatamente; são one-liners ou mudanças localizadas que fecham os maiores gaps de disponibilidade:
- **F-01** — cap de conexões no `registry.add` (cobre chat + notifications de uma vez).
- **F-03** — `config.rateLimit` nas 3 rotas de upload.
- **F-07** — `maxPayload: 65536` no `fastifyWebsocket`.
- **F-09**, **F-10**, **F-19** — `config.rateLimit` nas rotas de comentários, listagem/mapa de eventos e analytics.
- **F-04** — `isBlocked` no handshake WS + no `tokenCheck`.
- **F-13** — incluir BANNED/SUSPENDED em `assertSessionRenewable`.
- **F-14** — dummy bcrypt compare no login.
- **F-15** — unificar mensagem 409 do cadastro.
- **F-16** — filtrar blocks no caminho de typing.
- **F-12** — timeout curto nas chamadas Anthropic.
- **F-20** — gate de `/docs` por `NODE_ENV`.

### Fase 2 — Curto prazo (M, raiz arquitetural)
- **F-02** — mover authz antes do SELECT + throttle por socket nos frames inbound.
- **F-05** — `keyGenerator`/`trustProxy` consistente (reusar lógica de `consent.controller`); **validar a topologia de proxy de prod antes**.
- **F-06** — reservar/consumir quota antes de Places+IA na rota de sugestões + `config.rateLimit`.
- **F-08** — gate de privacidade em `getUserById` (extrair função compartilhada de visibilidade).
- **F-17** — refine de boot exigindo `METRICS_TOKEN` em produção.

### Fase 3 — Médio prazo (M, defesa em profundidade / produto)
- **F-11** — lockout/backoff por conta no login (espelhar `PASSWORD_RESET_MAX_ATTEMPTS`).
- **F-18** — persistir sinal de trial resistente à anonimização (hash de email / fingerprint de PaymentMethod).
- **F-19 (parte 2)** — `userId` + unique parcial em `EventAnalyticsMetric` para dedup confiável.

---

## Itens para revisão manual mais profunda

- **Topologia de proxy/load-balancer em produção** (ALB/ELB com X-Forwarded-For vs NLB L4): determina o impacto real de F-05 e a correção segura de `trustProxy`. Não verificável só pelo repo.
- **Pentest dinâmico de WebSocket:** medir empiricamente o teto de conexões/frames antes de degradação (F-01, F-02, F-07) no ambiente real, incluindo comportamento do load-balancer no upgrade.
- **`GET /users/:id/events`** (`authenticateOptional`): verificar se há gate de privacidade equivalente para eventos de conta privada (fora do escopo de F-08).
- **Fluxo completo de billing/Stripe:** webhooks, idempotência, reconciler de assinaturas e o gate de cartão — auditados parcialmente; merecem revisão de fraude de pagamento dedicada além do trial (F-18).
- **Custo real de budget externo (Places/Anthropic):** quantificar o headroom para calibrar a urgência de F-06 (depende de limites de billing dos providers, não visíveis no código).
- **Integrações reais (push Expo, Cloudinary, mailer):** caminhos com side effects externos não exercitados pelos testes de integração.

---

## Pontos fortes já existentes

Para equilíbrio e para não regredir, o projeto já acerta em vários pontos:

- **SQL 100% parametrizado:** todo SQL cru usa `Prisma.sql`; não há `$queryRawUnsafe`/`$executeRawUnsafe`/`Prisma.raw`, com teste de guarda (`src/lib/sql-safety.test.ts`).
- **Anti-enumeração no password-reset:** fluxo deliberadamente projetado para não revelar existência de conta (sempre 200, comentários em `password-reset.service.ts`) — modelo a estender ao login e ao cadastro.
- **Denylist de moderação no REST:** `authenticate` consulta `isBlocked` a cada request, com `rebuildFromDb` no boot — só falta espelhar no WS (F-04).
- **Gate de privacidade na busca e na aba de eventos do perfil:** `searchUsers` reduz o card de contas privadas e `findEventsByAuthor` respeita visibilidade — falta apenas paridade em `getUserById` (F-08).
- **Mensagem de erro única no login** (`'Invalid credentials'`) evitando enumeração por conteúdo.
- **Webhook Stripe protegido por assinatura HMAC** em plugin separado com raw body.
- **Auth de `/metrics` com `timingSafeEqual`** quando o token está presente.
- **Limite de upload (`fileSize 5MB`)** e validação de mimetype (`assertImageMimetype`).
- **Timeout no cliente Places** (`AbortSignal.timeout`) e fallback gracioso (template) nos enhancers de IA.
- **Consume atômico de quota de sugestões** (`INSERT ... ON CONFLICT WHERE count < limit`) — o contador nunca ultrapassa o teto.
- **Helmet, CORS com allowlist por env, JWT, error-handler global** e arquitetura em camadas que concentra o acesso a dados no repository, facilitando auditoria.
- **Padrão de rate-limit já estabelecido** em rotas de auth e nas rotas espaciais pesadas — a correção dos gaps de DoS é majoritariamente replicar um padrão que o próprio projeto já adota.
