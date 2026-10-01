// Guarda as salas em memória, gera códigos e remove salas inativas.

import { randomInt } from 'node:crypto';
import { ENV, LIMITS } from './config.js';
import { CODE_ALPHABET } from './validation.js';
import { GameError, Room } from './room.js';
import { logger } from './logger.js';

const EXPIRED_MEMORY_MS = 6 * 60 * 60_000; // lembra códigos expirados por 6h
const EXPIRED_MEMORY_MAX = 5000;

export class RoomManager {
  constructor({ wordBank, hooks = {}, ttlMs = ENV.ROOM_TTL_MS }) {
    this.wordBank = wordBank;
    this.hooks = hooks;
    this.ttlMs = ttlMs;
    this.rooms = new Map();
    this.expired = new Map(); // code -> expiredAt (para mensagem "sala expirada")
    this.sweeper = null;
  }

  startSweeper(intervalMs = Math.min(60_000, Math.max(50, this.ttlMs / 3))) {
    this.stopSweeper();
    this.sweeper = setInterval(() => this.sweep(), intervalMs);
    this.sweeper.unref?.();
  }

  stopSweeper() {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
  }

  generateCode() {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      let code = '';
      for (let i = 0; i < LIMITS.CODE_LENGTH; i += 1) {
        code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code) && !this.expired.has(code)) return code;
    }
    throw new GameError('SERVER_BUSY', 'Não foi possível criar a sala. Tente novamente.');
  }

  create() {
    if (this.rooms.size >= LIMITS.MAX_ROOMS) {
      throw new GameError('SERVER_BUSY', 'O servidor está lotado agora. Tente de novo em instantes.');
    }
    const code = this.generateCode();
    const room = new Room(code, {
      wordBank: this.wordBank,
      hooks: {
        ...this.hooks,
        onEmpty: (r) => this.remove(r.code, 'empty'),
        onError: (err) => logger.error(`[sala ${code}]`, err),
      },
    });
    this.rooms.set(code, room);
    logger.info(`Sala ${code} criada (${this.rooms.size} ativas)`);
    return room;
  }

  get(code) {
    return this.rooms.get(code) ?? null;
  }

  /** Busca a sala ou lança o erro amigável correto (inexistente x expirada). */
  require(code) {
    const room = this.rooms.get(code);
    if (room) return room;
    if (this.expired.has(code)) {
      throw new GameError('ROOM_EXPIRED', 'Essa sala ficou inativa por mais de 30 minutos e foi encerrada.');
    }
    throw new GameError('ROOM_NOT_FOUND', 'Não encontramos essa sala. Confira o código.');
  }

  remove(code, reason) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.destroy();
    this.rooms.delete(code);
    if (reason === 'expired') {
      this.expired.set(code, Date.now());
      if (this.expired.size > EXPIRED_MEMORY_MAX) {
        const oldest = this.expired.keys().next().value;
        this.expired.delete(oldest);
      }
    }
    this.hooks.onClosed?.(room, reason);
    logger.info(`Sala ${code} encerrada (${reason}); ${this.rooms.size} ativas`);
  }

  sweep(now = Date.now()) {
    for (const [code, room] of this.rooms) {
      // Discussão sem limite de tempo com gente online (conversando na chamada)
      // não conta como inatividade.
      if (room.isOpenDiscussion?.()) {
        room.touch();
        continue;
      }
      if (now - room.lastActivity > this.ttlMs) this.remove(code, 'expired');
    }
    for (const [code, at] of this.expired) {
      if (now - at > EXPIRED_MEMORY_MS) this.expired.delete(code);
    }
  }

  stats() {
    let players = 0;
    let online = 0;
    for (const room of this.rooms.values()) {
      players += room.size;
      online += room.connectedPlayers().length;
    }
    return { rooms: this.rooms.size, players, online };
  }

  closeAll() {
    this.stopSweeper();
    for (const code of [...this.rooms.keys()]) this.remove(code, 'shutdown');
  }
}
