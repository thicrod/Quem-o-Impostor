// Camada Socket.IO: valida cada evento, aplica rate limit, liga sockets a
// jogadores e repassa as ações para a sala. Nenhuma regra de jogo mora aqui.

import {
  AVATARS, ENV, LIMITS, MAX_ABUSE_STRIKES, MAX_CATEGORIES_SELECTED, SCORING, SETTINGS_OPTIONS, DURATIONS,
} from './config.js';
import { GameError } from './room.js';
import { RateLimiter } from './rateLimiter.js';
import { t, validate, ValidationError } from './validation.js';
import { validateNickname } from './text.js';
import { logger } from './logger.js';

const roomKey = (code) => `room:${code}`;

const CLOSE_MESSAGES = {
  expired: 'Essa sala ficou inativa por mais de 30 minutos e foi encerrada.',
  shutdown: 'O servidor foi reiniciado. Crie uma nova sala.',
  empty: 'A sala foi encerrada.',
};

export function buildMeta(wordBank) {
  return {
    version: 2,
    avatars: AVATARS,
    categories: wordBank.publicList(),
    totalWords: wordBank.totalWords(),
    settingsOptions: SETTINGS_OPTIONS,
    limits: {
      minPlayers: LIMITS.MIN_PLAYERS,
      maxPlayers: LIMITS.MAX_PLAYERS,
      nickMin: LIMITS.NICK_MIN,
      nickMax: LIMITS.NICK_MAX,
      clueMax: LIMITS.CLUE_MAX,
      chatMax: LIMITS.CHAT_MAX,
      guessMax: LIMITS.GUESS_MAX,
      codeLength: LIMITS.CODE_LENGTH,
      maxVoteRounds: LIMITS.MAX_VOTE_ROUNDS,
    },
    scoring: SCORING,
    durations: { lastChanceSeconds: DURATIONS.LAST_CHANCE / 1000 },
  };
}

function clientIp(socket) {
  if (ENV.TRUST_PROXY) {
    const fwd = socket.handshake.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  }
  return socket.handshake.address || 'unknown';
}

// Schemas dos eventos (cliente -> servidor)
const S = {
  create: { clientId: t.clientId(), nickname: t.string(LIMITS.NICK_MAX), avatar: t.string(16, { optional: true }) },
  join: {
    clientId: t.clientId(), code: t.code(), nickname: t.string(LIMITS.NICK_MAX),
    avatar: t.string(16, { optional: true }),
  },
  resume: { clientId: t.clientId(), code: t.code() },
  avatar: { avatar: t.string(16) },
  settings: {
    category: t.string(40, { optional: true }),
    categories: t.stringList(MAX_CATEGORIES_SELECTED, 40, { optional: true }),
    ...Object.fromEntries(Object.entries(SETTINGS_OPTIONS).map(([k, v]) => [k, t.enumOf(v, { optional: true })])),
  },
  text: (max) => ({ text: t.string(max) }),
  vote: { targetId: t.id() },
};

export function attachSocketHandlers(io, manager, wordBank) {
  const meta = buildMeta(wordBank);
  const connectionsPerIp = new Map();
  const clientRooms = new Map(); // clientId -> código da sala (1 sala por identidade)

  // ── hooks chamados pelas salas ──
  manager.hooks.onState = (room) => {
    for (const p of room.players.values()) {
      if (p.socketId) io.to(p.socketId).emit('room:state', room.viewFor(p.id));
    }
  };
  manager.hooks.onEvent = (room, event, payload) => {
    io.to(roomKey(room.code)).emit(event, payload);
  };
  manager.hooks.onClosed = (room, reason) => {
    if (reason !== 'empty') {
      io.to(roomKey(room.code)).emit('room:closed', { reason, message: CLOSE_MESSAGES[reason] });
    }
    // Remove também identidades que já tinham saído/sido removidas desta sala.
    for (const [clientId, code] of clientRooms) {
      if (code === room.code) clientRooms.delete(clientId);
    }
    for (const s of io.sockets.sockets.values()) {
      if (s.data.code === room.code) {
        s.data.code = null;
        s.data.playerId = null;
      }
    }
    io.socketsLeave(roomKey(room.code));
  };

  // ── limite de conexões por IP ──
  io.use((socket, next) => {
    const ip = clientIp(socket);
    const count = connectionsPerIp.get(ip) || 0;
    if (count >= LIMITS.MAX_CONNECTIONS_PER_IP) {
      const err = new Error('Muitas conexões a partir deste endereço.');
      err.data = { code: 'TOO_MANY_CONNECTIONS' };
      next(err);
      return;
    }
    connectionsPerIp.set(ip, count + 1);
    socket.data.ip = ip;
    next();
  });

  io.on('connection', (socket) => {
    const limiter = new RateLimiter();
    socket.data.strikes = 0;
    socket.data.code = null;
    socket.data.playerId = null;
    socket.emit('server:meta', meta);

    const strike = (weight = 1) => {
      socket.data.strikes += weight;
      if (socket.data.strikes >= MAX_ABUSE_STRIKES) {
        logger.warn(`Socket ${socket.id} (${socket.data.ip}) desconectado por abuso`);
        socket.emit('notice', { kind: 'error', text: 'Conexão encerrada por excesso de requisições.' });
        socket.disconnect(true);
      }
    };

    const currentRoom = () => (socket.data.code ? manager.get(socket.data.code) : null);
    const currentPlayerId = () => socket.data.playerId;

    /** Ação que exige estar em uma sala. */
    const inRoom = (fn) => () => {
      const room = currentRoom();
      if (!room || !room.players.has(currentPlayerId())) {
        throw new GameError('NOT_IN_ROOM', 'Você não está em uma sala.');
      }
      return fn(room, currentPlayerId());
    };

    const KNOWN_EVENTS = new Set();
    /** Registra um handler com validação + rate limit + tratamento de erro. */
    const on = (event, schema, handler, bucket = 'default') => {
      KNOWN_EVENTS.add(event);
      socket.on(event, (payload, ack) => {
        let reply = ack;
        let data = payload;
        if (typeof payload === 'function' && ack === undefined) {
          reply = payload;
          data = undefined;
        }
        const respond = typeof reply === 'function' ? reply : () => {};
        if (!limiter.consume(bucket)) {
          strike();
          respond({ ok: false, code: 'RATE_LIMITED', message: 'Calma! Muitas ações seguidas. Espere um pouquinho.' });
          return;
        }
        try {
          const clean = validate(schema, data);
          const result = handler(clean) || {};
          respond({ ok: true, ...result });
        } catch (err) {
          if (err instanceof ValidationError) {
            strike();
            respond({ ok: false, code: err.code, message: err.message });
          } else if (err instanceof GameError) {
            respond({ ok: false, code: err.code, message: err.message });
          } else {
            logger.error(`Erro no evento ${event}:`, err);
            respond({ ok: false, code: 'SERVER_ERROR', message: 'Algo deu errado. Tente novamente.' });
          }
        }
      });
    };

    socket.onAny((event) => {
      if (!KNOWN_EVENTS.has(event)) strike(2);
    });

    /** Sai da sala atual (intencionalmente) antes de entrar em outra. */
    const detach = ({ leave }) => {
      const room = currentRoom();
      const player = room?.players.get(currentPlayerId());
      if (player && leave) {
        clientRooms.delete(player.clientId);
        room.leave(player.id);
      } else if (player && player.socketId === socket.id) {
        room.disconnect(player.id);
      }
      if (socket.data.code) socket.leave(roomKey(socket.data.code));
      socket.data.code = null;
      socket.data.playerId = null;
    };

    /** A mesma identidade estava em outra sala? Sai de lá (evita jogador fantasma). */
    const leaveOtherRoom = (clientId, exceptCode) => {
      const otherCode = clientRooms.get(clientId);
      if (!otherCode || otherCode === exceptCode) return;
      const other = manager.get(otherCode);
      const ghost = other?.findByClientId(clientId);
      if (ghost) {
        if (ghost.socketId && ghost.socketId !== socket.id) {
          const old = io.sockets.sockets.get(ghost.socketId);
          if (old) {
            old.leave(roomKey(otherCode));
            old.data.code = null;
            old.data.playerId = null;
            old.emit('session:replaced');
          }
        }
        other.leave(ghost.id);
      }
      clientRooms.delete(clientId);
    };

    const bind = (room, player) => {
      socket.join(roomKey(room.code));
      socket.data.code = room.code;
      socket.data.playerId = player.id;
      clientRooms.set(player.clientId, room.code);
      if (room.chat.length) socket.emit('chat:history', room.chat);
      return { code: room.code, playerId: player.id };
    };

    /** Reconecta (ou "assume" a sessão de outra aba) mantendo o mesmo jogador. */
    const takeOver = (room, player) => {
      if (socket.data.playerId === player.id && player.socketId === socket.id && player.connected) {
        room.broadcast();
        return bind(room, player);
      }
      if (socket.data.code && socket.data.code !== room.code) detach({ leave: false });
      if (player.socketId && player.socketId !== socket.id) {
        const old = io.sockets.sockets.get(player.socketId);
        if (old) {
          old.leave(roomKey(room.code));
          old.data.code = null;
          old.data.playerId = null;
          old.emit('session:replaced');
        }
      }
      room.reconnect(player, socket.id);
      return bind(room, player);
    };

    on('room:create', S.create, ({ clientId, nickname, avatar }) => {
      const nick = validateNickname(nickname);
      if (!nick.ok) throw new GameError(nick.code, nick.message);
      detach({ leave: true });
      leaveOtherRoom(clientId, null);
      const room = manager.create();
      try {
        const player = room.addPlayer({ clientId, nickname: nick.nickname, avatar, socketId: socket.id });
        return bind(room, player);
      } catch (err) {
        manager.remove(room.code, 'empty');
        throw err;
      }
    }, 'create');

    on('room:join', S.join, ({ clientId, code, nickname, avatar }) => {
      const room = manager.require(code);
      const existing = room.findByClientId(clientId);
      if (existing) return takeOver(room, existing);
      // valida antes de sair da sala atual, para não perder o lugar à toa
      const nick = validateNickname(nickname);
      if (!nick.ok) throw new GameError(nick.code, nick.message);
      const player = room.addPlayer({ clientId, nickname: nick.nickname, avatar, socketId: socket.id });
      if (socket.data.code && socket.data.code !== code) detach({ leave: true });
      leaveOtherRoom(clientId, code);
      return bind(room, player);
    }, 'join');

    on('room:resume', S.resume, ({ clientId, code }) => {
      const room = manager.require(code);
      const player = room.findByClientId(clientId);
      if (!player) throw new GameError('SESSION_GONE', 'Você não faz mais parte dessa sala.');
      return takeOver(room, player);
    }, 'join');

    on('room:leave', null, () => {
      detach({ leave: true });
    });

    on('player:avatar', S.avatar, ({ avatar }) => inRoom((room, id) => room.setAvatar(id, avatar))());
    on('settings:update', S.settings, (patch) => inRoom((room, id) => {
      if (Object.keys(patch).length === 0) throw new GameError('BAD_SETTING', 'Nada para alterar.');
      room.updateSettings(id, patch);
    })());
    on('game:start', null, inRoom((room, id) => room.startGame(id)));
    on('card:seen', null, inRoom((room, id) => room.markSeen(id)));
    on('clue:submit', S.text(LIMITS.CLUE_MAX), ({ text }) => inRoom((room, id) => room.submitClue(id, text))());
    on('chat:send', S.text(LIMITS.CHAT_MAX), ({ text }) => inRoom((room, id) => {
      room.sendChat(id, text);
    })(), 'chat');
    on('discussion:ready', null, inRoom((room, id) => room.toggleReady(id)));
    on('vote:cast', S.vote, ({ targetId }) => inRoom((room, id) => room.castVote(id, targetId))());
    on('guess:submit', S.text(LIMITS.GUESS_MAX), ({ text }) => inRoom((room, id) => room.submitGuess(id, text))());
    on('game:playAgain', null, inRoom((room, id) => room.playAgain(id)));
    on('game:toLobby', null, inRoom((room, id) => room.backToLobby(id)));

    socket.on('disconnect', () => {
      const ip = socket.data.ip;
      const count = (connectionsPerIp.get(ip) || 1) - 1;
      if (count <= 0) connectionsPerIp.delete(ip);
      else connectionsPerIp.set(ip, count);
      const room = currentRoom();
      const player = room?.players.get(currentPlayerId());
      if (player && player.socketId === socket.id) room.disconnect(player.id);
    });
  });

  return { clientRooms, connectionsPerIp };
}
