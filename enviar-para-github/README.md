# 🎭 Quem é o Impostor?

Jogo web multiplayer de **dedução social** para **3 a 6 jogadores**, em salas privadas.
Todo mundo recebe a mesma palavra secreta — menos o impostor. Cada um dá **uma pista de uma palavra**, o grupo conversa (na chamada de voz ou no chat do app) e vota em quem parece estar blefando — ou pula o voto. Se o impostor for pego, ele ainda tem **20 segundos para adivinhar a palavra** e roubar a vitória.

- 📱 Mobile-first (feito para jogar com uma mão), funciona também em tablet e desktop
- ⚡ Tempo real com Socket.IO, timers e regras **100% no servidor**
- 🔁 Reconexão automática: fechou o navegador? Volta para a mesma sala, com o mesmo papel e os mesmos pontos
- 🎨 6 temas de cores (Neon, Pôr do sol, Oceano, Galáxia, Hacker, Vampiro), animações rápidas, efeitos sonoros e música de fundo opcionais
- 📲 Instalável como app (PWA): ícone na tela inicial, tela cheia, tela sempre acesa durante a partida
- 📚 23 categorias e 1.287 palavras em português, cada uma com um par "parecido"
- 🎓 Tutorial rápido na primeira visita e imagem do resultado para compartilhar no grupo
- 😂 Reações ao vivo, notas pessoais de suspeita, QR code do convite, ferramentas do host e "destaques da sala"

---

## Sumário

1. [Como executar](#como-executar)
2. [Como jogar e pontuação](#como-jogar-e-pontuação)
3. [Arquitetura](#arquitetura)
4. [Estrutura de pastas](#estrutura-de-pastas)
5. [Autoridade do servidor e segurança](#autoridade-do-servidor-e-segurança)
6. [Como funciona a reconexão](#como-funciona-a-reconexão)
7. [Banco de palavras (`words.json`)](#banco-de-palavras-wordsjson)
8. [Testes](#testes)
9. [Variáveis de ambiente](#variáveis-de-ambiente)
10. [Deploy](#deploy)
11. [Decisões de design](#decisões-de-design)

---

## Como executar

**Requisitos:** Node.js **20.19+** (recomendado 22 — veja `.nvmrc`) e npm 10+.

```bash
npm install
npm run dev
```

- Cliente (Vite + React): <http://localhost:5173>
- Servidor (Express + Socket.IO): <http://localhost:3001> (o Vite faz proxy de `/socket.io`)

`npm run dev` sobe os dois ao mesmo tempo (via `concurrently`), com hot reload no front e reinício automático do servidor.

### Testando com vários jogadores no mesmo computador

- Abra várias **abas** em <http://localhost:5173>: cada aba nova vira um jogador diferente (a identidade é separada por aba — veja [reconexão](#como-funciona-a-reconexão)).
- Ou use janelas anônimas / navegadores diferentes.

### Testando no celular (mesma rede Wi-Fi)

O Vite já escuta na rede. Rode `npm run dev`, veja o endereço `Network: http://192.168.x.x:5173` no terminal e abra no celular.

### Modo produção local

```bash
npm run build   # gera client/dist
npm start       # o servidor entrega o front + Socket.IO em http://localhost:3001
```

---

## Como jogar e pontuação

1. **Tela inicial** — escolha apelido e avatar. **Criar sala** gera um código de 6 caracteres (sem 0/O/1/I para não confundir); **Entrar em uma sala** pede o código. Links `/?sala=CODIGO` já abrem com o código preenchido.
2. **Lobby** — código grande com **Copiar**, **Enviar** e **QR code** (aponta a câmera e entra), jogadores como cards (👑 host, "Você", online/💤 desconectado), escolha de avatar (16 opções, sem repetição), reações e configurações (só o host altera). No **⋯** de cada jogador o host pode **passar o host** ou **remover da sala** (quem é removido não consegue voltar com o mesmo aparelho):
   - **Ritmo**: atalhos ⚡ Rápido / 🎯 Clássico / 🧠 Longo (ajustam todos os tempos de uma vez)
   - **Categorias**: uma, várias ou 🎲 todas as 23 — a cada rodada o servidor sorteia uma das escolhidas
   - **Impostores**: 1, ou 2 quando a sala tem 6 jogadores
   - **Modo do impostor**: 🙈 *sem palavra* ou 🎭 *palavra parecida* (ex.: lasanha em vez de pizza)
   - **Ajuda do impostor** (modo sem palavra): 🔥 *difícil* (nem a categoria ele vê), 🙂 *normal* (vê a categoria) ou 🍀 *fácil* (vê a categoria e quantas letras a palavra tem)
   - **Tempo por pista** (20–60s)
   - **Discussão**: 📞 *em chamada* (padrão — vocês conversam por voz e o chat de texto some) ou 💬 *chat no app*
   - **Tempo de discussão**: 45s–3min ou **∞ sem limite** (a votação abre quando todos marcam "pronto" ou quando o host abre)
   - **Mais opções**: 1 ou 2 **voltas de pistas** antes da discussão, **tempo de votação** (30–60s), **votos secretos** (só a contagem aparece) e **partida até 10/15/20 pontos** (o primeiro a chegar é o campeão 👑 e o placar zera na próxima partida)
3. **Carta** — carta fechada "TOQUE PARA REVELAR", animação de virada, 🟢 INOCENTE + palavra ou 🔴 IMPOSTOR (com a ajuda escolhida pelo host). Depois, "Toquei e vi". O botão 🃏 no topo deixa espiar a carta durante a rodada.
4. **Pistas** — ordem sorteada exibida a todos, vez atual em destaque com timer. **Uma palavra**; o servidor bloqueia a palavra secreta e variações (maiúsculas, acentos, plural, diminutivo, erro de digitação, partes de palavras compostas) e pistas repetidas.
5. **Discussão** — no modo 📞 *em chamada*, a tela mostra todas as pistas e quem está pronto (sem chat). No modo 💬 *chat no app*: chat em tempo real (avatar + nome), rolagem automática, aviso de novas mensagens, limite de 200 caracteres, anti-spam. Se todos marcarem **"Pronto para votar"**, a votação começa antes; o host também pode **abrir a votação** a qualquer momento (com confirmação).
6. **Votação** — cards clicáveis com as pistas de cada jogador + opção **⏭️ Pular voto**, voto confirmado e **oculto** até todos votarem (ou o tempo acabar). Depois: **3… 2… 1…** e todos os votos aparecem juntos, com o carimbo **ELIMINADO**. Com votos secretos, aparece só quantos votos cada um levou.
7. **Ninguém saiu** — se o "pular" tiver mais votos, se houver **empate no topo** (entre jogadores, ou de um jogador com o "pular") ou se ninguém votar, ninguém é eliminado: tela ⚡ EMPATE! / ⏭️ NINGUÉM SAIU e **mais uma rodada** de pistas + discussão + votação, **sem limite de rodadas**. O host pode **encerrar a rodada** a qualquer momento (🚪 → Encerrar rodada: todos voltam ao lobby, sem pontos).
8. **Última chance** — se o impostor for eliminado, ele tem 20s para digitar a palavra (acento, caixa e plural não importam). A validação é feita no servidor.
9. **Resultado** — suspense "O IMPOSTOR ERA…", revelação, tela cheia de **VITÓRIA!** / **DERROTA** (com confete 🎉), botão **📸 Compartilhar resultado** (gera uma imagem com o placar), palavra e palavra do impostor, pontos da rodada com animação, **placar** estilo leaderboard (🥇🥈🥉, você, maior pontuação, vitórias) e **estatísticas** por jogador (toque no nome). Host: **Jogar novamente** (mesmos jogadores e configurações, nova palavra e novo impostor) ou voltar ao lobby. Todos: **Sair da sala**.

| Resultado | Pontos |
|---|---|
| Grupo elimina o impostor | **+2** para cada inocente |
| Impostor escapa (o grupo eliminou um inocente) | **+3** para o impostor |
| Impostor eliminado, mas adivinha a palavra | **+2** para o impostor, 0 para o grupo |

Estatísticas (enquanto a sala existir): pontos, vitórias, rodadas, vezes como impostor, impostores descobertos (votou no impostor), fugas, vitórias roubadas e partidas vencidas.

### Extras para jogar em grupo

- **Reações ao vivo** (😂 🤔 🤨 😱 🤡 👏): flutuam na tela de todo mundo, com o nome de quem mandou. Aparecem no lobby, na discussão (modo chamada), na revelação dos votos, no empate, na última chance e no resultado. Têm um freio contra spam (e spam de reação nunca derruba ninguém).
- **Notas de suspeita**: na discussão, toque num jogador para marcar 🤔 suspeito ou ✅ confio. As marcas aparecem nos cards da votação e ficam **só no seu aparelho** (o servidor nem fica sabendo).
- **Quem está pronto**: a fileira de jogadores da discussão mostra quem já marcou "pronto".
- **Resenha no resultado**: "Como foram as votações" (cada rodada, quem saiu, a contagem e — se os votos não forem secretos — quem votou em quem) e **Destaques da sala** (👑 Rei da sala, 🕵️ Detetive, 🎭 Mestre do disfarce, 🦹 Ladrão de vitória, 🐑 Bode expiatório, 😈 Cara de impostor).
- **Servidor acordando**: no plano grátis o servidor dorme sem jogadores; o jogo mostra "Acordando o servidor…" com um contador e conecta sozinho quando ele volta.

### Ajustes pessoais (⚙️)

Ficam salvos só no aparelho de cada jogador: **tema de cores**, **efeitos sonoros**, **música de fundo** (gerada na hora, muda de clima em cada fase: calma no lobby, tensão nas pistas/votação, suspense na revelação), **vibração**, **instalar como app** e **rever o tutorial**.

### Instalar como app (PWA)

- **Android / Chrome / Edge**: botão **📲 Instalar como app** na tela inicial (ou em ⚙️ Ajustes).
- **iPhone (Safari)**: Compartilhar → **Adicionar à Tela de Início** (o jogo mostra o passo a passo).
- O app abre em tela cheia e a tela do celular **não apaga** durante a partida (Screen Wake Lock).
- O service worker (`client/public/sw.js`) guarda só a "casca" do app. Se o servidor demorar para responder (ex.: acordando no plano grátis), o jogo abre na hora e conecta sozinho quando o servidor voltar. O Socket.IO nunca passa pelo cache.
- Os ícones ficam em `client/public/icons` (para gerar de novo: `node scripts/make-icons.mjs`).

---

## Arquitetura

```
 Navegador (React)                         Servidor (Node)
┌──────────────────────────┐   Socket.IO   ┌──────────────────────────────────────┐
│ GameProvider (useReducer)│ ◀──────────── │ socketHandlers  validação + rate limit │
│  • guarda a última visão │  room:state   │        │                              │
│  • envia só intenções    │ ────────────▶ │ RoomManager  salas em memória, TTL    │
│ Telas por fase           │  eventos c/   │        │                              │
│ useCountdown (espelho)   │  ack          │ Room  máquina de estados autoritativa │
└──────────────────────────┘               │  timers • votos • pontos • visões     │
                                           │ wordBank ← words.json                 │
                                           └──────────────────────────────────────┘
```

- **Monorepo com npm workspaces**: `client/` (React 19 + Vite 7 + Tailwind 4 + Motion) e `server/` (Express 5 + Socket.IO 4). Sem banco de dados: o estado vive em memória.
- **Máquina de estados no servidor** (`server/src/room.js`): `lobby → reveal → clues → discussion → voting → voteReveal → (tie → clues…) → lastChance → result`.
- **Visões por jogador**: a cada mudança o servidor monta uma visão filtrada para *cada* jogador (`viewFor`). Só o próprio jogador recebe sua carta. Várias mudanças no mesmo "tick" viram **um único envio**.
- **Timers**: um único `setTimeout` por sala (nunca `setInterval`), sempre limpo antes de criar outro. O cliente recebe "quanto falta" e só exibe (veja abaixo).
- **Chat** trafega como eventos incrementais (`chat:message`), não dentro do estado — o histórico vai só na (re)conexão.

### Eventos Socket.IO (cliente → servidor, todos com confirmação)

| Evento | Payload | Quem/quando |
|---|---|---|
| `room:create` | `{ clientId, nickname, avatar? }` | qualquer um |
| `room:join` | `{ clientId, code, nickname, avatar? }` | sala existente (reconecta se o `clientId` já estiver nela) |
| `room:resume` | `{ clientId, code }` | reconexão |
| `room:leave` | — | sair de vez |
| `player:avatar` | `{ avatar }` | qualquer jogador |
| `settings:update` | `{ categories?, impostorCount?, impostorMode?, impostorHint?, clueSeconds?, clueRounds?, discussionMode?, discussionSeconds?, votingSeconds?, anonymousVotes?, targetScore? }` | host, no lobby/resultado |
| `game:start` / `game:playAgain` / `game:toLobby` | — | host |
| `game:end` | — | host, durante a rodada (volta todos ao lobby, sem pontos) |
| `card:seen` | — | participante, fase `reveal` |
| `clue:submit` | `{ text }` | jogador da vez |
| `chat:send` | `{ text }` | participante, fase `discussion`, só no modo "chat no app" |
| `discussion:ready` | — | participante (alterna) |
| `discussion:startVoting` | — | host, fase `discussion` |
| `vote:cast` | `{ targetId }` | participante, uma vez |
| `vote:skip` | — | participante, uma vez (pular voto) |
| `guess:submit` | `{ text }` | só o impostor eliminado |
| `reaction:send` | `{ emoji }` | qualquer jogador da sala (lista fixa de emojis; limite próprio, sem "strike") |
| `host:transfer` | `{ targetId }` | host (jogador conectado) |
| `player:kick` | `{ targetId }` | host, no lobby/resultado |

Servidor → cliente: `server:meta`, `room:state`, `chat:message`, `chat:history`, `chat:reset`, `notice`, `reaction`, `room:closed`, `room:kicked`, `session:replaced`.

---

## Estrutura de pastas

```
.
├── package.json            # workspaces + scripts (dev, build, start, test, simulate, visual)
├── Dockerfile · render.yaml
├── client/
│   ├── index.html · vite.config.js · .oxlintrc.json
│   ├── public/                                # favicon, ícones, manifest e service worker (PWA)
│   └── src/
│       ├── main.jsx · App.jsx · index.css      # entrada, roteamento por fase, identidade visual
│       ├── hooks/useGame.jsx                   # estado global + ações (GameProvider)
│       ├── hooks/useCountdown.js               # timer espelhado do servidor (1 intervalo compartilhado)
│       ├── lib/                                # socket, identidade, sons, música, temas/ajustes, PWA, imagem de resultado
│       ├── hooks/useWakeLock.js                # tela sempre acesa durante a partida
│       ├── components/                         # ui, Shell (topo/toasts/modais), Timer, Chat, Leaderboard…
│       └── screens/                            # Home, Lobby, Reveal, Clues, Discussion, Voting,
│                                               # VoteReveal, Tie, LastChance, Result, Error
├── server/
│   ├── src/
│   │   ├── index.js · app.js                   # boot, Express, Socket.IO, arquivos estáticos
│   │   ├── config.js                           # regras, limites, durações, pontuação, avatares
│   │   ├── room.js                             # máquina de estados do jogo (fonte da verdade)
│   │   ├── roomManager.js                      # salas em memória, códigos, expiração
│   │   ├── socketHandlers.js                   # eventos → validação → rate limit → sala
│   │   ├── text.js                             # sanitização, regras de pista/palpite/apelido
│   │   ├── validation.js · rateLimiter.js · logger.js
│   │   ├── wordBank.js
│   │   └── words.json                          # banco de palavras (edite à vontade)
│   └── test/                                   # testes unitários e de integração (node:test)
└── scripts/
    ├── simulate.mjs                            # simulação narrada de 6 jogadores
    ├── visual-check.mjs                        # E2E visual com Playwright (6 dispositivos)
    ├── smoke-remote.mjs                        # robôs jogam no servidor publicado
    └── make-icons.mjs                          # gera os ícones do app a partir do logo
```

---

## Autoridade do servidor e segurança

O cliente **nunca decide nada**. Ele só envia intenções ("quero votar em X"); o servidor valida tudo e responde com a nova visão.

- **Sorteios** (impostor, palavra, categoria aleatória, ordem das pistas) usam `crypto.randomInt`.
- **Nada sensível vaza**: a palavra só vai na carta de quem pode vê-la; o impostor nunca recebe a palavra secreta; inocentes nunca recebem a palavra do impostor; a lista de impostores só aparece no resultado; votos individuais só aparecem na revelação (durante a votação só "quem já votou"). Há um teste que inspeciona **todos** os pacotes recebidos por cada jogador para garantir isso.
- **Identidade**: o jogador é identificado pelo socket vinculado no servidor — não existe campo "playerId" confiável vindo do cliente, então ninguém envia pista/voto em nome de outro. O `clientId` de reconexão é secreto e nunca é enviado a outros jogadores (eles só veem um id público).
- **Validação de payloads** (`validation.js`): objeto simples, campos tipados, enums para configurações, regex para código/ids, tamanho máximo; campos extras são descartados.
- **Regras de fase**: cada ação checa fase, host, participante, vez, voto único, auto-voto, alvo válido.
- **Sanitização**: remove caracteres de controle, zero-width e bidi overrides; colapsa espaços; limita tamanho. O React escapa tudo na renderização (sem `dangerouslySetInnerHTML`).
- **Limites anti-abuso**: rate limit por socket (token bucket; chat mais restrito), pacote máximo de 4 KB, limite de conexões por IP, limite de salas, eventos desconhecidos/invalidos contam "strikes" e o socket abusivo é desconectado.
- **Erros amigáveis**: o cliente só recebe `{ ok:false, code, message }` em português — nunca stack trace. No front, um Error Boundary evita tela branca.
- Cabeçalhos básicos de segurança (`nosniff`, `X-Frame-Options: DENY`) e sem `X-Powered-By`.

### Timers

O servidor guarda o prazo de cada fase/vez e envia `remainingMs` + `durationMs` em cada estado. O cliente desconta o tempo com `performance.now()` (relógio monotônico) desde o recebimento — **não depende do relógio do sistema**. Um único intervalo compartilhado atualiza todos os timers da tela. Nos últimos 10s o timer muda de cor, pulsa e toca "tic" (se o som estiver ligado).

---

## Como funciona a reconexão

1. Na primeira visita, o navegador gera um **`clientId` aleatório** (secreto) e salva no `localStorage`, junto com o código da sala atual.
2. Ao abrir o jogo (ou quando o Socket.IO reconecta sozinho), o cliente envia `room:resume { clientId, code }`.
3. O servidor encontra o jogador pelo `clientId` e **reaproveita o mesmo jogador**: mesmo id público, mesma carta/papel, mesma pontuação, mesmo lugar na ordem. Nada é duplicado. O histórico do chat é reenviado.
4. Se o mesmo jogador abrir em outra aba/dispositivo, a sessão antiga recebe "Jogo aberto em outro lugar" (com opção de voltar).
5. Enquanto está desconectado, o jogador aparece como 💤. Se for a vez dele nas pistas, o servidor espera alguns segundos e pula; votação/discussão não travam esperando quem caiu.
6. **Host**: se o host cair, após ~8s o cargo passa automaticamente para o próximo jogador conectado (todos veem "👑 Fulano agora é o host"). Se o host antigo voltar, **não** recupera o cargo. Um refresh rápido não troca o host. Se o host sair pela porta 🚪, a troca é imediata.
7. **Várias abas**: cada aba segura sua identidade com a Web Locks API. A primeira aba usa o `clientId` principal; abas extras simultâneas ganham uma identidade própria (no `sessionStorage`) — por isso dá para testar vários jogadores no mesmo navegador e, ainda assim, fechar e reabrir o navegador volta para o mesmo jogador.
8. Salas sem atividade por **30 minutos** são removidas da memória; quem tentar voltar vê a tela "Sessão expirada".

---

## Banco de palavras (`words.json`)

Arquivo: `server/src/words.json`. Pode ser editado sem mexer no código (reinicie o servidor).

```json
{
  "categories": {
    "comida": {
      "label": "Comida",
      "emoji": "🍕",
      "words": [
        { "word": "Pizza", "similar": "Lasanha" },
        { "word": "Brigadeiro", "similar": "Beijinho" }
      ]
    }
  }
}
```

- `word`: palavra secreta; `similar`: palavra parecida entregue ao impostor no modo 🎭.
- Categorias atuais (23): Comida, Animais, Futebol, Filmes, Objetos, Lugares, Geral, Profissões, Tecnologia, Jogos, Música, Marcas, Países, Esportes, Escola, Internet, Cultura Pop, Veículos, Roupas, Natureza, Brasil, Casa, Fantasia — todas com **53 a 60 palavras** (1.287 no total).
- Para criar uma categoria nova, adicione uma chave (letras/números, começando com minúscula, ex.: `desenhos`). Ela aparece automaticamente no seletor de categorias do lobby.
- O servidor valida o arquivo ao iniciar: entradas sem par, pares iguais ou palavras repetidas são ignoradas com um aviso no log; categorias com menos de 10 palavras válidas são puladas. Um teste garante 50+ palavras por categoria.
- Palavras já sorteadas não se repetem na mesma sala até a categoria acabar.
- Dica para bons pares: parecidos o bastante para o impostor conseguir blefar, diferentes o bastante para gerar suspeita (ex.: *Nescau/Toddy*, *Violão/Guitarra*, *Suíça/Suécia*).

---

## Testes

```bash
npm test            # 57 testes: unitários + integração (servidor real + clientes Socket.IO)
npm run simulate    # simulação narrada de 6 jogadores (3 rodadas completas)
npm run visual      # build + E2E visual com Playwright em 6 dispositivos (gera ./screenshots)
npm run lint        # oxlint no front
npm run check       # lint + testes + build + simulação
npm run smoke -- https://seu-jogo.onrender.com   # 6 robôs jogam uma rodada no servidor publicado
```

Os testes de integração rodam com `TIMER_SCALE=0.05` (todos os timers 20x mais rápidos) e cobrem:

- **Fluxo completo com 6 jogadores**: lobby → carta → pistas → discussão → votação → resultado → placar → jogar novamente
- **Pontuação**: grupo acerta (+2 cada), impostor escapa (+3), impostor eliminado que acerta a palavra (+2), estatísticas
- **Ninguém saiu**: "pular" vencendo, empate com o "pular", ninguém votando e **5 votações seguidas** sem limite de rodadas até o grupo acertar
- **Jogo em chamada**: chat desligado no modo chamada (padrão), discussão sem tempo (sem cronômetro, host abre a votação, a sala não expira enquanto o grupo conversa) e host encerrando a rodada
- **Social**: reações (só para a própria sala, só emojis da lista, spam limitado sem desconectar), host removendo jogador (não volta nem por `resume` nem por `join`), passando a coroa (inclusive no meio da rodada) e a estatística de "bode expiatório"
- **Reconexão** no lobby, pistas, discussão, votação e resultado (mesmo id, papel, palavra, pontos e histórico do chat; sem duplicar), outra aba assumindo a sessão, saída definitiva
- **Host**: queda com transferência, host que volta não recupera o cargo, refresh rápido não troca, saída imediata
- **Validações**: sala cheia, inexistente, código inválido, apelido duplicado (acentos/maiúsculas), menos de 3 jogadores, eventos e payloads inválidos, não-host, auto-voto, voto duplo, pista fora da vez, pista "em nome de outro"
- **Segurança**: nenhum pacote vaza a palavra, o `clientId` de outro jogador ou a lista de impostores antes da hora
- **Anti-abuso**: rate limit do chat, mensagem grande demais, pacote > 4 KB, flood de eventos, limite de conexões por IP
- **Timers**: vez sem pista é pulada, votação encerra no tempo; **expiração** de sala inativa
- **Carga**: 20 salas jogando simultaneamente
- **Configurações v3**: várias categorias, ajuda do impostor (categoria escondida no difícil, formato da palavra no fácil — só para o impostor), 2 voltas de pistas, votos secretos (ninguém recebe quem votou em quem) e partida até X pontos com campeão
- **Regras de texto**: `pizza/Pizza/pizzas/PIZZA/pizzA/piza/pizzaria` bloqueadas, `forno/queijo/Itália` aceitas, `bolacha` não é bloqueada por `bola`, etc.

O teste visual (`scripts/visual-check.mjs`) joga uma partida inteira pela interface com iPhone SE, iPhone Pro Max, Android, Android pequeno, iPad e desktop — **cada aparelho com um tema diferente** —, passa pelo tutorial, ajustes, seletor de categorias, "mais opções", votos secretos, a imagem de compartilhar, o aviso de servidor acordando, o QR code, o host removendo um visitante e passando a coroa, e uma partida em modo chamada (notas de suspeita, reações, discussão sem tempo, host abrindo a votação, "pular" vencendo, empate com o "pular" e host encerrando a rodada); tira ~69 screenshots e falha se encontrar erro no console, scroll horizontal ou alvo de toque menor que 40px. Se o Playwright não tiver navegador, rode `npx playwright install chromium` (ou defina `CHROMIUM_PATH`).

---

## Variáveis de ambiente

Servidor (`server/.env.example`):

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta HTTP |
| `NODE_ENV` | `development` | `production` (ou `npm start`) ativa cache estático e CORS de mesma origem |
| `CLIENT_ORIGIN` | — | Origens permitidas no CORS (vírgula). Só se o front estiver em outro domínio |
| `TRUST_PROXY` | — | `1` atrás de proxy (Render, Railway, Fly, Nginx) para ler o IP real |
| `ROOM_TTL_MINUTES` | `30` | Inatividade até a sala expirar |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `silent` |
| `MAX_ROOMS` | `2000` | Máximo de salas simultâneas |
| `MAX_CONNECTIONS_PER_IP` | `30` | Conexões simultâneas por IP |
| `TIMER_SCALE` | `1` | Só para testes: multiplica todas as durações |
| `WORDS_FILE` | `server/src/words.json` | Caminho alternativo do banco de palavras |

Cliente (`client/.env.example`):

| Variável | Descrição |
|---|---|
| `VITE_SERVER_URL` | URL do servidor quando o front é hospedado separado (ex.: Vercel + Render). Em dev e no deploy único não é necessário. |

---

## Deploy

O jeito recomendado é **um único serviço Node** que builda o React e serve front + Socket.IO na mesma origem (sem CORS, WebSocket direto).

> ⚠️ O estado das salas fica na memória do processo. Rode **uma instância só** (sem escalar horizontalmente). Para várias instâncias seria preciso sticky sessions + um adapter compartilhado (ex.: Redis), fora do escopo deste projeto.

### Render (recomendado, tem plano gratuito)

Com o projeto no GitHub, o botão abaixo cria tudo sozinho a partir do `render.yaml` (troque `SEU-USUARIO/SEU-REPO` pelo seu repositório público):

`https://render.com/deploy?repo=https://github.com/SEU-USUARIO/SEU-REPO`

1. Suba o projeto para o GitHub.
2. No Render: **New → Blueprint** e selecione o repositório (usa o `render.yaml`), **ou** **New → Web Service** com:
   - Build: `npm ci && npm run build`
   - Start: `npm start`
   - Variáveis: `NODE_VERSION=22`, `TRUST_PROXY=1`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
   - Health check: `/health`
3. Abra a URL gerada e compartilhe com os amigos. (No plano gratuito o serviço "dorme" sem uso; a primeira visita demora alguns segundos.)

### Railway / Fly.io / VPS com Docker

```bash
docker build -t impostor .
docker run -p 3001:3001 -e TRUST_PROXY=1 impostor
```

O `Dockerfile` faz o build do front e gera uma imagem enxuta só com o servidor e o `client/dist`. No Railway basta conectar o repositório (ele detecta o Dockerfile). No Fly.io: `fly launch` e `fly deploy`.

### Front e back separados (opcional)

Front estático (Vercel/Netlify) com `VITE_SERVER_URL=https://seu-back.onrender.com` e back com `CLIENT_ORIGIN=https://seu-front.vercel.app`.

---

## Decisões de design

- **Última chance 20s** é fixa; pistas, discussão e votação são configuráveis pelo host.
- **Pular voto e empates** (regra estilo "Among Us"): só sai quem tiver mais votos que todo mundo *e* que o "pular". Empate no topo, "pular" vencendo ou ninguém votando = ninguém sai e começa outra rodada, sem limite. Quem não vota a tempo simplesmente não conta.
- **Discussão sem tempo**: sem cronômetro; enquanto houver alguém conectado nessa fase, a sala não conta como inativa (o grupo pode estar conversando na chamada).
- **2 impostores** só com 6 jogadores. Eliminar um deles encerra a rodada com a pontuação normal; se o eliminado acertar a palavra, os dois impostores ganham +2. Impostores não sabem quem é o outro.
- **Modo palavra parecida**: o impostor sabe que é o impostor e recebe a palavra parecida para blefar. A pista dele não pode ser a própria palavra; a palavra secreta nunca é usada para validar a pista do impostor (senão o bloqueio revelaria a palavra).
- **Pistas repetidas** na mesma rodada são recusadas, para forçar pistas novas.
- **Chat só na discussão**, apenas para quem está na rodada, e só no modo "💬 chat no app" (no modo "📞 em chamada" o servidor recusa mensagens).
- **Quem entra no meio da partida** (ou estava desconectado quando ela começou) assiste como espectador e joga a partir da próxima rodada.
- **Saídas no meio da rodada**: se um inocente sai, o jogo segue; se o impostor sai (ou sobram menos de 3), a rodada é cancelada sem pontos e todos voltam ao lobby.
- **Sala cheia**: se houver alguém desconectado há mais de 2 minutos no lobby, a vaga é liberada para quem está entrando.
- **Espaço**: salas vazias são apagadas na hora; inativas por 30 min são removidas pelo "varredor".
- **Remover jogador** só no lobby/resultado (no meio da rodada atrapalharia o jogo); o `clientId` removido fica bloqueado naquela sala.
- **Build**: as bibliotecas ficam num arquivo `vendor` separado do código do jogo, então numa atualização o navegador baixa de novo só a parte que mudou; o QR code é carregado só quando alguém abre o QR.
