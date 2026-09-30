// Utilitários de teste: sobe um servidor isolado e cria "jogadores" robôs
// usando socket.io-client (exatamente o mesmo protocolo do navegador).

import { randomBytes } from 'node:crypto';
import { io as ioClient } from 'socket.io-client';

export function setTestEnv(overrides = {}) {
  const defaults = {
    TIMER_SCALE: '0.05',
    LOG_LEVEL: 'silent',
    MAX_CONNECTIONS_PER_IP: '1000',
    NODE_ENV: 'test',
    CLIENT_DIST: '/nonexistent',
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    if (process.env[k] === undefined || overrides[k] !== undefined) process.env[k] = v;
  }
}

export async function startServer(options = {}) {
  const { createGameServer, listen } = await import('../src/app.js');
  const server = createGameServer(options);
  const port = await listen(server, 0);
  return { ...server, url: `http://127.0.0.1:${port}`, port };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const newClientId = () => randomBytes(16).toString('base64url');

export class Bot {
  constructor(url, nickname, { clientId = newClientId(), avatar } = {}) {
    this.url = url;
    this.nickname = nickname;
    this.clientId = clientId;
    this.avatar = avatar;
    this.state = null;
    this.chat = [];
    this.notices = [];
    this.closed = null;
    this.replaced = false;
    this.meta = null;
    this.received = []; // todos os eventos recebidos (para checar vazamentos)
    this.waiters = new Set();
    this.connect().catch(() => {});
  }

  connect() {
    this.socket = ioClient(this.url, { transports: ['websocket'], forceNew: true, reconnection: false });
    this.socket.onAny((event, payload) => {
      this.received.push({ event, payload, phase: this.state?.phase });
    });
    this.socket.on('server:meta', (m) => { this.meta = m; });
    this.socket.on('room:state', (s) => {
      this.state = s;
      this.flush();
    });
    this.socket.on('chat:message', (m) => {
      this.chat.push(m);
      this.flush();
    });
    this.socket.on('chat:history', (h) => { this.chat = [...h]; });
    this.socket.on('chat:reset', () => { this.chat = []; });
    this.socket.on('notice', (n) => {
      this.notices.push(n);
      this.flush();
    });
    this.socket.on('room:closed', (c) => {
      this.closed = c;
      this.flush();
    });
    this.socket.on('session:replaced', () => {
      this.replaced = true;
      this.flush();
    });
    this.socket.on('disconnect', () => this.flush());
    return new Promise((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('connect_error', reject);
    });
  }

  ready() {
    if (this.socket.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('connect_error', reject);
    });
  }

  flush() {
    for (const w of [...this.waiters]) {
      let ok = false;
      try {
        ok = w.predicate(this);
      } catch {
        ok = false;
      }
      if (ok) {
        this.waiters.delete(w);
        clearTimeout(w.timer);
        w.resolve(this.state);
      }
    }
  }

  /** Espera até `predicate(bot)` ser verdadeiro. */
  waitFor(predicate, { timeout = 6000, label = 'condição' } = {}) {
    try {
      if (predicate(this)) return Promise.resolve(this.state);
    } catch {
      /* continua esperando */
    }
    return new Promise((resolve, reject) => {
      const w = { predicate, resolve };
      w.timer = setTimeout(() => {
        this.waiters.delete(w);
        reject(new Error(`[${this.nickname}] timeout esperando ${label} (fase atual: ${this.state?.phase})`));
      }, timeout);
      this.waiters.add(w);
    });
  }

  waitPhase(phase, opts = {}) {
    return this.waitFor((b) => b.state?.phase === phase, { label: `fase ${phase}`, ...opts });
  }

  async request(event, payload) {
    await this.ready();
    const args = payload === undefined ? [event] : [event, payload];
    return this.socket.timeout(4000).emitWithAck(...args);
  }

  create() {
    return this.request('room:create', { clientId: this.clientId, nickname: this.nickname, avatar: this.avatar });
  }

  join(code, nickname = this.nickname) {
    return this.request('room:join', { clientId: this.clientId, code, nickname, avatar: this.avatar });
  }

  resume(code) {
    return this.request('room:resume', { clientId: this.clientId, code });
  }

  get id() {
    return this.state?.you?.id;
  }

  get card() {
    return this.state?.you?.card;
  }

  disconnect() {
    this.socket.disconnect();
  }

  /** Simula fechar e reabrir o navegador: nova conexão, mesmo clientId. */
  async reconnect() {
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.chat = [];
    await this.connect();
  }

  close() {
    this.socket.removeAllListeners();
    this.socket.disconnect();
    for (const w of this.waiters) clearTimeout(w.timer);
    this.waiters.clear();
  }
}

/** Cria uma sala com N jogadores. Retorna { host, bots, code }. */
export async function createRoomWith(url, count, { names } = {}) {
  const list = names || Array.from({ length: count }, (_, i) => `Jogador${i + 1}`);
  const bots = list.map((n) => new Bot(url, n));
  await Promise.all(bots.map((b) => b.ready()));
  const created = await bots[0].create();
  if (!created.ok) throw new Error(`create falhou: ${created.message}`);
  for (const b of bots.slice(1)) {
    const res = await b.join(created.code);
    if (!res.ok) throw new Error(`join falhou (${b.nickname}): ${res.message}`);
  }
  await Promise.all(bots.map((b) => b.waitFor((x) => x.state?.players.length === count, { label: `${count} jogadores` })));
  return { host: bots[0], bots, code: created.code };
}

export const everyone = (bots, fn) => Promise.all(bots.map(fn));

/** Joga a fase de pistas: cada um manda uma pista válida quando for a sua vez. */
export async function playClueRound(bots, { skip = new Set(), clueFor } = {}) {
  const host = bots[0];
  const round = host.state.game.round;
  await host.waitFor((b) => b.state.phase === 'clues' && b.state.game.round === round && !b.state.game.intro, { label: 'fim da intro' });
  const byId = () => Object.fromEntries(bots.map((b) => [b.id, b]));
  let guard = 0;
  while (host.state.phase === 'clues' && guard < 20) {
    guard += 1;
    const turnId = host.state.game.currentTurnId;
    const bot = byId()[turnId];
    const turnIndex = host.state.game.turnIndex;
    if (bot && !skip.has(bot.nickname)) {
      const text = clueFor ? clueFor(bot, round) : `dica${round}x${bot.nickname.toLowerCase()}`;
      const res = await bot.request('clue:submit', { text });
      if (!res.ok) throw new Error(`pista recusada (${bot.nickname}): ${res.message}`);
    }
    await host.waitFor(
      (b) => b.state.phase !== 'clues' || b.state.game.turnIndex !== turnIndex,
      { label: 'próxima vez', timeout: 8000 },
    );
  }
}

/** Todos marcam "pronto" na discussão. */
export async function finishDiscussion(bots) {
  await everyone(bots, (b) => b.waitPhase('discussion'));
  for (const b of bots) await b.request('discussion:ready');
  await bots[0].waitPhase('voting');
}

/** Vota conforme `plan` (nickname -> nickname alvo). `pool` = onde procurar os alvos. */
export async function vote(bots, plan, pool = bots) {
  await everyone(bots, (b) => b.waitPhase('voting'));
  const byNick = Object.fromEntries([...pool, ...bots].map((b) => [b.nickname, b]));
  for (const [voter, target] of Object.entries(plan)) {
    const res = await byNick[voter].request('vote:cast', { targetId: byNick[target].id });
    if (!res.ok) throw new Error(`voto recusado (${voter}->${target}): ${res.message}`);
  }
}

export function roles(bots) {
  const impostors = bots.filter((b) => b.card?.role === 'impostor');
  const innocents = bots.filter((b) => b.card?.role === 'innocent');
  return { impostors, innocents, impostor: impostors[0] };
}

export async function startAndReveal(bots) {
  const host = bots.find((b) => b.state?.you?.isHost) || bots[0];
  if (host.state.phase === 'lobby' || host.state.phase === 'result') {
    const res = await host.request('game:start');
    if (!res.ok) throw new Error(`start falhou: ${res.message}`);
  }
  await everyone(bots, (b) => b.waitFor((x) => x.state?.phase === 'reveal' && x.state.you.card, { label: 'carta' }));
  const secret = bots.find((b) => b.card.role === 'innocent').card.word;
  for (const b of bots) await b.request('card:seen');
  await bots[0].waitPhase('clues');
  return secret;
}
