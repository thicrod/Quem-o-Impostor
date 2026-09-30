// Máquina de estados de uma sala. É a ÚNICA fonte da verdade do jogo:
// quem é impostor, qual a palavra, de quem é a vez, votos, pontos e timers.
// O cliente só recebe uma "visão" filtrada (viewFor) do que pode saber.

import { randomBytes, randomInt } from 'node:crypto';
import {
  AVATARS, DEFAULT_SETTINGS, DURATIONS, LIMITS, MAX_CATEGORIES_SELECTED, RANDOM_CATEGORY, SCORING,
  SEAT_COLORS, SETTINGS_OPTIONS, scaled,
} from './config.js';
import {
  isCorrectGuess, nicknameKey, sanitizeText, validateClue, validateNickname,
} from './text.js';

export class GameError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const PHASES = Object.freeze({
  LOBBY: 'lobby',
  REVEAL: 'reveal',
  CLUES: 'clues',
  DISCUSSION: 'discussion',
  VOTING: 'voting',
  VOTE_REVEAL: 'voteReveal',
  TIE: 'tie',
  LAST_CHANCE: 'lastChance',
  RESULT: 'result',
});

const IN_GAME = new Set([
  PHASES.REVEAL, PHASES.CLUES, PHASES.DISCUSSION, PHASES.VOTING,
  PHASES.VOTE_REVEAL, PHASES.TIE, PHASES.LAST_CHANCE,
]);

const newId = () => randomBytes(6).toString('hex');
const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const emptyStats = () => ({
  wins: 0, rounds: 0, timesImpostor: 0, impostorsFound: 0, escapes: 0, steals: 0, matchesWon: 0,
});

/** "Pão de queijo" -> [3, 2, 6] (letras de cada palavra). Ajuda "fácil" do impostor. */
function wordShape(word) {
  return String(word)
    .split(/[\s-]+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, '').length)
    .filter((n) => n > 0);
}

export class Room {
  /**
   * @param {string} code
   * @param {{ wordBank: any, hooks?: { onState?: Function, onEvent?: Function, onEmpty?: Function } }} deps
   */
  constructor(code, { wordBank, hooks = {} }) {
    this.code = code;
    this.wordBank = wordBank;
    this.hooks = hooks;
    this.players = new Map();
    this.hostId = null;
    this.settings = { ...DEFAULT_SETTINGS, categories: wordBank.normalizeKeys(DEFAULT_SETTINGS.categories) };
    this.matchOver = false; // alguém atingiu a pontuação-alvo
    this.phase = PHASES.LOBBY;
    this.game = null;
    this.gameCounter = 0;
    this.joinCounter = 0;
    this.usedWords = new Set();
    this.chat = [];
    this.timer = null;
    this.deadline = null;
    this.duration = null;
    this.hostTimer = null;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.closed = false;
    this.broadcastQueued = false;
  }

  // ───────────────────────── utilidades ─────────────────────────

  touch() {
    this.lastActivity = Date.now();
  }

  get size() {
    return this.players.size;
  }

  get inGame() {
    return IN_GAME.has(this.phase);
  }

  orderedPlayers() {
    return [...this.players.values()].sort((a, b) => a.joinOrder - b.joinOrder);
  }

  connectedPlayers() {
    return this.orderedPlayers().filter((p) => p.connected);
  }

  findByClientId(clientId) {
    for (const p of this.players.values()) if (p.clientId === clientId) return p;
    return null;
  }

  requirePlayer(playerId) {
    const p = this.players.get(playerId);
    if (!p) throw new GameError('NOT_IN_ROOM', 'Você não está nesta sala.');
    return p;
  }

  requireHost(playerId) {
    this.requirePlayer(playerId);
    if (this.hostId !== playerId) throw new GameError('NOT_HOST', 'Só o host pode fazer isso.');
  }

  requirePhase(...phases) {
    if (!phases.includes(this.phase)) {
      throw new GameError('WRONG_PHASE', 'Essa ação não está disponível agora.');
    }
  }

  isParticipant(playerId) {
    return Boolean(this.game?.participants.includes(playerId));
  }

  requireParticipant(playerId) {
    this.requirePlayer(playerId);
    if (!this.isParticipant(playerId)) {
      throw new GameError('SPECTATOR', 'Você está assistindo esta rodada. Entra na próxima!');
    }
  }

  connectedParticipants() {
    if (!this.game) return [];
    return this.game.participants.filter((id) => this.players.get(id)?.connected);
  }

  notice(kind, text) {
    this.hooks.onEvent?.(this, 'notice', { kind, text });
  }

  broadcast() {
    if (this.broadcastQueued || this.closed) return;
    this.broadcastQueued = true;
    // Junta várias mudanças do mesmo "tick" em um único envio.
    queueMicrotask(() => {
      this.broadcastQueued = false;
      if (!this.closed) this.hooks.onState?.(this);
    });
  }

  // ───────────────────────── timers ─────────────────────────
  // Apenas UM timer de fase por sala (clearTimeout antes de criar outro),
  // mais o timer de transferência de host. Nada de setInterval.

  setTimer(ms, fn) {
    this.clearTimer();
    const duration = scaled(ms);
    this.duration = duration;
    this.deadline = Date.now() + duration;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.deadline = null;
      if (this.closed) return;
      try {
        fn();
      } catch (err) {
        this.hooks.onError?.(err);
      }
    }, duration);
  }

  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
    this.duration = null;
  }

  destroy() {
    this.closed = true;
    this.clearTimer();
    if (this.hostTimer) clearTimeout(this.hostTimer);
    this.hostTimer = null;
  }

  // ───────────────────────── jogadores ─────────────────────────

  addPlayer({ clientId, nickname, avatar, socketId }) {
    if (this.findByClientId(clientId)) {
      throw new GameError('ALREADY_IN_ROOM', 'Você já está nesta sala.');
    }
    const nick = validateNickname(nickname);
    if (!nick.ok) throw new GameError(nick.code, nick.message);
    if (this.players.size >= LIMITS.MAX_PLAYERS) this.evictStalePlayer();
    if (this.players.size >= LIMITS.MAX_PLAYERS) {
      throw new GameError('ROOM_FULL', `A sala já possui ${LIMITS.MAX_PLAYERS} jogadores.`);
    }
    const key = nicknameKey(nick.nickname);
    for (const p of this.players.values()) {
      if (p.nickKey === key) throw new GameError('NICK_TAKEN', 'Esse apelido já está sendo usado nesta sala.');
    }
    const takenAvatars = new Set([...this.players.values()].map((p) => p.avatar));
    const chosenAvatar = AVATARS.includes(avatar) && !takenAvatars.has(avatar)
      ? avatar
      : AVATARS.find((a) => !takenAvatars.has(a));
    const takenColors = new Set([...this.players.values()].map((p) => p.color));
    const player = {
      id: newId(),
      clientId,
      nickname: nick.nickname,
      nickKey: key,
      avatar: chosenAvatar,
      color: SEAT_COLORS.find((c) => !takenColors.has(c)) || SEAT_COLORS[0],
      connected: true,
      socketId,
      disconnectedAt: null,
      joinOrder: this.joinCounter += 1,
      score: 0,
      stats: emptyStats(),
    };
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    this.touch();
    if (this.players.size > 1) {
      this.notice('join', `${player.avatar} ${player.nickname} entrou na sala`);
    }
    this.broadcast();
    return player;
  }

  /** Sala cheia? Libera a vaga de quem está desconectado há muito tempo. */
  evictStalePlayer() {
    const now = Date.now();
    const candidates = this.orderedPlayers()
      .filter((p) => !p.connected && now - p.disconnectedAt > LIMITS.STALE_PLAYER_MS)
      .filter((p) => !this.inGame || !this.isParticipant(p.id))
      .sort((a, b) => a.disconnectedAt - b.disconnectedAt);
    if (candidates[0]) this.removePlayer(candidates[0].id, { reason: 'stale' });
  }

  reconnect(player, socketId) {
    player.connected = true;
    player.socketId = socketId;
    player.disconnectedAt = null;
    this.touch();
    if (player.id === this.hostId && this.hostTimer) {
      clearTimeout(this.hostTimer);
      this.hostTimer = null;
    }
    // Voltou na própria vez com pouco tempo? Devolve metade do tempo de pista.
    const g = this.game;
    if (this.phase === PHASES.CLUES && g && !g.intro && g.turnOrder[g.turnIndex] === player.id) {
      const half = (this.settings.clueSeconds * 1000) / 2;
      if (this.deadline && this.deadline - Date.now() < scaled(half)) {
        this.setTimer(half, () => this.skipTurn());
      }
    }
    this.ensureConnectedHost();
    this.notice('reconnect', `${player.avatar} ${player.nickname} voltou`);
    this.broadcast();
  }

  disconnect(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.connected) return;
    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = Date.now();
    if (playerId === this.hostId) this.scheduleHostTransfer();
    this.notice('disconnect', `${player.avatar} ${player.nickname} caiu. Aguardando reconexão…`);
    this.checkProgress();
    this.broadcast();
  }

  leave(playerId) {
    this.requirePlayer(playerId);
    this.touch();
    this.removePlayer(playerId, { reason: 'leave' });
  }

  removePlayer(playerId, { reason }) {
    const player = this.players.get(playerId);
    if (!player) return;
    this.players.delete(playerId);
    if (reason === 'leave') this.notice('leave', `${player.avatar} ${player.nickname} saiu da sala`);
    if (this.players.size === 0) {
      this.hooks.onEmpty?.(this);
      return;
    }
    if (this.hostId === playerId) this.transferHost(playerId, { allowDisconnected: true });
    this.clampSettings();
    this.handleParticipantExit(playerId);
    this.broadcast();
  }

  setAvatar(playerId, avatar) {
    const player = this.requirePlayer(playerId);
    if (!AVATARS.includes(avatar)) throw new GameError('BAD_AVATAR', 'Avatar inválido.');
    for (const p of this.players.values()) {
      if (p.id !== playerId && p.avatar === avatar) {
        throw new GameError('AVATAR_TAKEN', 'Outro jogador já escolheu esse avatar.');
      }
    }
    player.avatar = avatar;
    this.touch();
    this.broadcast();
  }

  // ───────────────────────── host ─────────────────────────

  scheduleHostTransfer() {
    if (this.hostTimer) clearTimeout(this.hostTimer);
    this.hostTimer = setTimeout(() => {
      this.hostTimer = null;
      if (this.closed) return;
      const host = this.players.get(this.hostId);
      if (host && !host.connected && this.transferHost(this.hostId)) this.broadcast();
    }, scaled(DURATIONS.HOST_GRACE));
  }

  /**
   * Passa o cargo para o próximo jogador conectado (ordem de entrada).
   * `allowDisconnected` só é usado quando o host SAIU de vez e não há ninguém online.
   */
  transferHost(fromId, { allowDisconnected = false } = {}) {
    const next = this.connectedPlayers().find((p) => p.id !== fromId)
      || (allowDisconnected ? this.orderedPlayers().find((p) => p.id !== fromId) : null);
    if (!next) return false;
    this.hostId = next.id;
    if (this.hostTimer && next.connected) {
      clearTimeout(this.hostTimer);
      this.hostTimer = null;
    }
    this.notice('host', `👑 ${next.nickname} agora é o host`);
    return true;
  }

  /** Host desconectado e alguém volta: se o prazo já passou, transfere. */
  ensureConnectedHost() {
    const host = this.players.get(this.hostId);
    if (!host) {
      this.transferHost(null, { allowDisconnected: true });
      return;
    }
    if (!host.connected && !this.hostTimer) this.transferHost(host.id);
  }

  // ───────────────────────── configurações ─────────────────────────

  updateSettings(playerId, patch) {
    this.requireHost(playerId);
    this.requirePhase(PHASES.LOBBY, PHASES.RESULT);
    const next = { ...this.settings };
    // Compatibilidade: `category` (uma chave ou "aleatoria" = todas).
    if (patch.category !== undefined) {
      if (!this.wordBank.has(patch.category)) throw new GameError('BAD_SETTING', 'Categoria inválida.');
      next.categories = patch.category === RANDOM_CATEGORY ? this.wordBank.keys() : [patch.category];
    }
    if (patch.categories !== undefined) {
      const keys = [...new Set(patch.categories)];
      if (keys.length === 0 || keys.length > MAX_CATEGORIES_SELECTED || !keys.every((k) => this.wordBank.categories.has(k))) {
        throw new GameError('BAD_SETTING', 'Escolha pelo menos uma categoria válida.');
      }
      next.categories = keys;
    }
    for (const field of Object.keys(SETTINGS_OPTIONS)) {
      if (patch[field] === undefined) continue;
      if (!SETTINGS_OPTIONS[field].includes(patch[field])) {
        throw new GameError('BAD_SETTING', 'Configuração inválida.');
      }
      next[field] = patch[field];
    }
    if (next.impostorCount === 2 && this.players.size < LIMITS.MAX_PLAYERS) {
      throw new GameError('BAD_SETTING', `2 impostores só com ${LIMITS.MAX_PLAYERS} jogadores na sala.`);
    }
    this.settings = next;
    this.touch();
    this.broadcast();
  }

  clampSettings() {
    if (this.settings.impostorCount === 2 && this.players.size < LIMITS.MAX_PLAYERS) {
      this.settings = { ...this.settings, impostorCount: 1 };
    }
  }

  // ───────────────────────── fluxo do jogo ─────────────────────────

  startGame(playerId) {
    this.requireHost(playerId);
    this.requirePhase(PHASES.LOBBY, PHASES.RESULT);
    const participants = this.connectedPlayers();
    if (participants.length < LIMITS.MIN_PLAYERS) {
      const missing = LIMITS.MIN_PLAYERS - participants.length;
      throw new GameError(
        'NOT_ENOUGH_PLAYERS',
        `São necessários pelo menos ${LIMITS.MIN_PLAYERS} jogadores conectados (falta${missing > 1 ? 'm' : ''} ${missing}).`,
      );
    }
    // Nova partida depois de um campeão: zera o placar (as estatísticas continuam).
    if (this.matchOver) {
      for (const p of this.players.values()) p.score = 0;
      this.matchOver = false;
    }
    const s = this.settings;
    const impostorCount = s.impostorCount === 2 && participants.length >= LIMITS.MAX_PLAYERS ? 2 : 1;
    const pick = this.wordBank.pick(s.categories, this.usedWords, secureRandom);
    const impostors = shuffle(participants).slice(0, impostorCount).map((p) => p.id);
    this.gameCounter += 1;
    this.game = {
      number: this.gameCounter,
      category: pick.category,
      randomCategory: this.wordBank.normalizeKeys(s.categories).length > 1,
      word: pick.word,
      similar: pick.similar,
      mode: s.impostorMode,
      impostorHint: s.impostorHint,
      anonymousVotes: s.anonymousVotes,
      clueRounds: s.clueRounds,
      votingSeconds: s.votingSeconds,
      pass: 0, // voltas de pistas no jogo todo
      passInRound: 0, // voltas de pistas nesta votação
      impostorIds: new Set(impostors),
      participants: participants.map((p) => p.id),
      roster: Object.fromEntries(participants.map((p) => [p.id, {
        nickname: p.nickname, avatar: p.avatar, color: p.color,
      }])),
      seen: new Set(),
      round: 1,
      turnOrder: [],
      turnIndex: -1,
      intro: false,
      clues: [],
      ready: new Set(),
      votes: new Map(),
      voteHistory: [],
      tiedIds: [],
      lastChanceId: null,
      guess: null,
      result: null,
    };
    this.chat = [];
    this.hooks.onEvent?.(this, 'chat:reset', {});
    this.phase = PHASES.REVEAL;
    this.touch();
    this.setTimer(DURATIONS.REVEAL, () => this.startClueRound());
    this.broadcast();
  }

  markSeen(playerId) {
    this.requirePhase(PHASES.REVEAL);
    this.requireParticipant(playerId);
    this.game.seen.add(playerId);
    this.touch();
    this.checkProgress();
    this.broadcast();
  }

  startClueRound() {
    const g = this.game;
    this.phase = PHASES.CLUES;
    g.pass += 1;
    g.passInRound += 1;
    g.turnOrder = shuffle(g.participants);
    g.turnIndex = -1;
    g.intro = true;
    // Banner "Rodada X/3" antes da primeira vez.
    this.setTimer(DURATIONS.ROUND_BANNER, () => this.nextTurn());
    this.broadcast();
  }

  nextTurn() {
    const g = this.game;
    g.intro = false;
    g.turnIndex += 1;
    if (g.turnIndex >= g.turnOrder.length) {
      if (g.passInRound < g.clueRounds) this.startClueRound();
      else this.startDiscussion();
      return;
    }
    const current = this.players.get(g.turnOrder[g.turnIndex]);
    const ms = current?.connected
      ? this.settings.clueSeconds * 1000
      : DURATIONS.DISCONNECTED_TURN_GRACE;
    this.setTimer(ms, () => this.skipTurn());
    this.broadcast();
  }

  skipTurn() {
    const g = this.game;
    const playerId = g.turnOrder[g.turnIndex];
    if (playerId) g.clues.push({ round: g.round, pass: g.pass, playerId, text: null, skipped: true });
    this.nextTurn();
  }

  submitClue(playerId, rawText) {
    this.requirePhase(PHASES.CLUES);
    this.requireParticipant(playerId);
    const g = this.game;
    if (g.intro || g.turnOrder[g.turnIndex] !== playerId) {
      throw new GameError('NOT_YOUR_TURN', 'Calma! Ainda não é a sua vez.');
    }
    const card = this.cardFor(playerId);
    const usedClues = g.clues.filter((c) => c.round === g.round && c.text).map((c) => c.text);
    const check = validateClue(rawText, { protectedWords: card?.word ? [card.word] : [], usedClues });
    if (!check.ok) throw new GameError(check.code, check.message);
    g.clues.push({ round: g.round, pass: g.pass, playerId, text: check.clue, skipped: false });
    this.touch();
    this.nextTurn();
  }

  startDiscussion() {
    this.phase = PHASES.DISCUSSION;
    this.game.ready = new Set();
    this.setTimer(this.settings.discussionSeconds * 1000, () => this.startVoting());
    this.broadcast();
  }

  toggleReady(playerId) {
    this.requirePhase(PHASES.DISCUSSION);
    this.requireParticipant(playerId);
    const { ready } = this.game;
    if (ready.has(playerId)) ready.delete(playerId);
    else ready.add(playerId);
    this.touch();
    this.checkProgress();
    this.broadcast();
  }

  sendChat(playerId, rawText) {
    this.requirePhase(PHASES.DISCUSSION);
    this.requireParticipant(playerId);
    const text = sanitizeText(rawText, LIMITS.CHAT_MAX);
    if (!text) throw new GameError('CHAT_EMPTY', 'Mensagem vazia.');
    const message = { id: newId(), playerId, text, at: Date.now() };
    this.chat.push(message);
    if (this.chat.length > LIMITS.CHAT_HISTORY) this.chat.splice(0, this.chat.length - LIMITS.CHAT_HISTORY);
    this.touch();
    this.hooks.onEvent?.(this, 'chat:message', message);
    return message;
  }

  startVoting() {
    this.phase = PHASES.VOTING;
    this.game.votes = new Map();
    this.setTimer(this.game.votingSeconds * 1000, () => this.resolveVotes());
    this.broadcast();
  }

  castVote(playerId, targetId) {
    this.requirePhase(PHASES.VOTING);
    this.requireParticipant(playerId);
    const g = this.game;
    if (g.votes.has(playerId)) throw new GameError('ALREADY_VOTED', 'Seu voto já foi confirmado.');
    if (targetId === playerId) throw new GameError('SELF_VOTE', 'Você não pode votar em si mesmo.');
    if (!g.participants.includes(targetId) || !this.players.has(targetId)) {
      throw new GameError('BAD_TARGET', 'Esse jogador não está na rodada.');
    }
    g.votes.set(playerId, targetId);
    this.touch();
    this.checkProgress();
    this.broadcast();
  }

  resolveVotes() {
    const g = this.game;
    const tallies = {};
    for (const id of g.participants) tallies[id] = 0;
    const votes = [];
    for (const [voterId, targetId] of g.votes) {
      if (tallies[targetId] === undefined) continue;
      tallies[targetId] += 1;
      votes.push({ voterId, targetId });
    }
    const max = Math.max(0, ...Object.values(tallies));
    const leaders = max > 0 ? Object.keys(tallies).filter((id) => tallies[id] === max) : [];
    const eliminatedId = leaders.length === 1 ? leaders[0] : null;
    const record = {
      round: g.round,
      votes,
      tallies,
      eliminatedId,
      tie: !eliminatedId,
      tiedIds: eliminatedId ? [] : leaders,
      finalRound: g.round >= LIMITS.MAX_VOTE_ROUNDS,
    };
    g.voteHistory.push(record);
    this.phase = PHASES.VOTE_REVEAL;
    this.setTimer(DURATIONS.VOTE_REVEAL, () => this.afterVoteReveal());
    this.broadcast();
  }

  afterVoteReveal() {
    const g = this.game;
    const last = g.voteHistory.at(-1);
    if (last.eliminatedId) {
      if (g.impostorIds.has(last.eliminatedId) && this.players.has(last.eliminatedId)) {
        this.startLastChance(last.eliminatedId);
      } else if (g.impostorIds.has(last.eliminatedId)) {
        this.finish('caught', 'vote');
      } else {
        this.finish('escaped', 'wrongVote');
      }
      return;
    }
    if (g.round < LIMITS.MAX_VOTE_ROUNDS) {
      this.phase = PHASES.TIE;
      g.tiedIds = last.tiedIds;
      this.setTimer(DURATIONS.TIE, () => {
        g.round += 1;
        g.passInRound = 0;
        this.startClueRound();
      });
      this.broadcast();
      return;
    }
    // Regra de desempate: 3º empate seguido = o grupo não chegou a um consenso
    // e o impostor escapa.
    this.finish('escaped', 'tie');
  }

  startLastChance(playerId) {
    this.phase = PHASES.LAST_CHANCE;
    this.game.lastChanceId = playerId;
    this.setTimer(DURATIONS.LAST_CHANCE, () => this.finish('caught', 'vote'));
    this.broadcast();
  }

  submitGuess(playerId, rawText) {
    this.requirePhase(PHASES.LAST_CHANCE);
    const g = this.game;
    if (g.lastChanceId !== playerId) throw new GameError('NOT_YOUR_TURN', 'Só o impostor eliminado pode tentar.');
    const guess = sanitizeText(rawText, LIMITS.GUESS_MAX);
    if (!guess) throw new GameError('GUESS_EMPTY', 'Digite um palpite.');
    g.guess = guess;
    this.touch();
    this.finish(isCorrectGuess(guess, g.word) ? 'stolen' : 'caught', 'vote');
  }

  /** Encerra a rodada, distribui pontos e atualiza estatísticas. */
  finish(outcome, reason) {
    this.clearTimer();
    const g = this.game;
    const impostorsWon = outcome !== 'caught';
    const pointsDelta = {};
    const finalVotes = new Map(g.voteHistory.at(-1)?.votes.map((v) => [v.voterId, v.targetId]) ?? []);
    for (const id of g.participants) {
      const p = this.players.get(id);
      if (!p) continue;
      const isImpostor = g.impostorIds.has(id);
      let points = 0;
      if (outcome === 'caught' && !isImpostor) points = SCORING.GROUP_CATCHES;
      if (outcome === 'escaped' && isImpostor) points = SCORING.IMPOSTOR_ESCAPES;
      if (outcome === 'stolen' && isImpostor) points = SCORING.IMPOSTOR_STEALS;
      p.score += points;
      pointsDelta[id] = points;
      p.stats.rounds += 1;
      if (isImpostor) {
        p.stats.timesImpostor += 1;
        if (outcome === 'escaped') p.stats.escapes += 1;
        if (outcome === 'stolen') p.stats.steals += 1;
      } else if (g.impostorIds.has(finalVotes.get(id))) {
        p.stats.impostorsFound += 1;
      }
      if (isImpostor === impostorsWon) p.stats.wins += 1;
    }
    // Pontuação-alvo: quem chegar primeiro vence a partida (empate = todos vencem).
    let champions = [];
    const target = this.settings.targetScore;
    if (target > 0) {
      const top = Math.max(0, ...[...this.players.values()].map((p) => p.score));
      if (top >= target) {
        champions = [...this.players.values()].filter((p) => p.score === top).map((p) => p.id);
        champions.forEach((id) => { this.players.get(id).stats.matchesWon += 1; });
        this.matchOver = true;
      }
    }
    const last = g.voteHistory.at(-1);
    g.result = {
      matchOver: champions.length > 0,
      champions,
      targetScore: target,
      outcome,
      reason,
      winner: impostorsWon ? 'impostors' : 'group',
      impostorIds: [...g.impostorIds],
      eliminatedId: last?.eliminatedId ?? null,
      word: g.word,
      similar: g.mode === 'similar' ? g.similar : null,
      guess: g.guess,
      guessCorrect: outcome === 'stolen',
      pointsDelta,
    };
    this.phase = PHASES.RESULT;
    this.broadcast();
  }

  playAgain(playerId) {
    this.requirePhase(PHASES.RESULT);
    this.startGame(playerId);
  }

  backToLobby(playerId) {
    this.requireHost(playerId);
    this.requirePhase(PHASES.RESULT);
    this.clearTimer();
    this.phase = PHASES.LOBBY;
    this.game = null;
    if (this.matchOver) {
      for (const p of this.players.values()) p.score = 0;
      this.matchOver = false;
    }
    this.touch();
    this.broadcast();
  }

  abortGame(message) {
    this.clearTimer();
    this.phase = PHASES.LOBBY;
    this.game = null;
    this.notice('abort', message);
    this.broadcast();
  }

  /** Alguém saiu no meio da partida: mantém o jogo em um estado válido. */
  handleParticipantExit(playerId) {
    const g = this.game;
    if (!g || !g.participants.includes(playerId)) return;
    g.participants = g.participants.filter((id) => id !== playerId);
    if (this.phase === PHASES.RESULT) return;
    if (g.impostorIds.has(playerId)) {
      if (this.phase === PHASES.LAST_CHANCE && g.lastChanceId === playerId) {
        this.finish('caught', 'vote');
      } else {
        this.abortGame('O impostor saiu da sala. Rodada cancelada.');
      }
      return;
    }
    if (g.participants.length < LIMITS.MIN_PLAYERS) {
      this.abortGame('Jogadores insuficientes para continuar. Voltando ao lobby.');
      return;
    }
    if (this.phase === PHASES.CLUES) {
      const idx = g.turnOrder.indexOf(playerId);
      if (idx !== -1) {
        g.turnOrder.splice(idx, 1);
        if (idx < g.turnIndex) g.turnIndex -= 1;
        else if (idx === g.turnIndex && !g.intro) {
          g.turnIndex -= 1;
          this.nextTurn();
          return;
        }
      }
    }
    if (this.phase === PHASES.VOTING) {
      g.votes.delete(playerId);
      for (const [voter, target] of g.votes) if (target === playerId) g.votes.delete(voter);
    }
    g.ready.delete(playerId);
    g.seen.delete(playerId);
    this.checkProgress();
  }

  /** Avança a fase mais cedo quando todos os jogadores conectados já agiram. */
  checkProgress() {
    const g = this.game;
    if (!g) return;
    const online = this.connectedParticipants();
    if (online.length === 0) return; // ninguém online: deixa o timer decidir
    if (this.phase === PHASES.REVEAL && online.every((id) => g.seen.has(id))) {
      this.startClueRound();
    } else if (this.phase === PHASES.DISCUSSION && online.every((id) => g.ready.has(id))) {
      this.startVoting();
    } else if (this.phase === PHASES.VOTING && online.every((id) => g.votes.has(id))) {
      this.resolveVotes();
    }
  }

  // ───────────────────────── visões (o que cada um pode ver) ─────────────────────────

  cardFor(playerId) {
    const g = this.game;
    if (!g || !g.participants.includes(playerId)) return null;
    const isImpostor = g.impostorIds.has(playerId);
    const card = {
      role: isImpostor ? 'impostor' : 'innocent',
      word: isImpostor ? (g.mode === 'similar' ? g.similar : null) : g.word,
    };
    if (isImpostor) {
      // Nível de ajuda do impostor (só ele recebe isso).
      card.hint = { level: g.impostorHint };
      if (g.impostorHint === 'easy' && g.mode === 'noWord') card.hint.shape = wordShape(g.word);
    }
    return card;
  }

  /** O impostor está no modo "difícil" e ainda não pode saber a categoria? */
  hidesCategoryFrom(playerId) {
    const g = this.game;
    return Boolean(g && this.phase !== PHASES.RESULT && g.impostorHint === 'hard'
      && g.mode === 'noWord' && g.impostorIds.has(playerId));
  }

  timerView() {
    if (!this.deadline) return null;
    return { remainingMs: Math.max(0, this.deadline - Date.now()), durationMs: this.duration };
  }

  publicPlayer(p) {
    return {
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      color: p.color,
      connected: p.connected,
      isHost: p.id === this.hostId,
      score: p.score,
      stats: { ...p.stats },
    };
  }

  publicGame(viewerId) {
    const g = this.game;
    if (!g) return null;
    const revealed = this.phase === PHASES.RESULT;
    const hideCategory = this.hidesCategoryFrom(viewerId);
    return {
      number: g.number,
      category: hideCategory ? { key: 'secreta', label: 'Categoria secreta', emoji: '❓' } : g.category,
      categoryHidden: hideCategory,
      randomCategory: g.randomCategory,
      mode: g.mode,
      impostorHint: g.impostorHint,
      anonymousVotes: g.anonymousVotes,
      clueRounds: g.clueRounds,
      pass: g.pass,
      passInRound: g.passInRound,
      votingSeconds: g.votingSeconds,
      impostorCount: g.impostorIds.size,
      round: g.round,
      maxRounds: LIMITS.MAX_VOTE_ROUNDS,
      participants: [...g.participants],
      roster: g.roster,
      seenIds: [...g.seen],
      turnOrder: [...g.turnOrder],
      turnIndex: g.turnIndex,
      currentTurnId: this.phase === PHASES.CLUES && !g.intro ? g.turnOrder[g.turnIndex] ?? null : null,
      intro: g.intro,
      clues: g.clues.map((c) => ({ ...c })),
      readyIds: [...g.ready],
      votedIds: this.phase === PHASES.VOTING ? [...g.votes.keys()] : [],
      // Votos individuais só aparecem depois de revelados (fase voteReveal em diante)
      // e nunca aparecem com "votos anônimos" (só a contagem).
      voteHistory: g.voteHistory.map((v) => ({
        ...v,
        votes: g.anonymousVotes ? [] : [...v.votes],
        tallies: { ...v.tallies },
      })),
      tiedIds: [...g.tiedIds],
      lastChanceId: g.lastChanceId,
      result: revealed ? g.result : null,
    };
  }

  viewFor(playerId) {
    const me = this.players.get(playerId);
    const g = this.game;
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      settings: { ...this.settings },
      players: this.orderedPlayers().map((p) => this.publicPlayer(p)),
      timer: this.timerView(),
      game: this.publicGame(playerId),
      you: me ? {
        id: me.id,
        isHost: me.id === this.hostId,
        isParticipant: this.isParticipant(me.id),
        card: this.cardFor(me.id),
        votedFor: this.phase === PHASES.VOTING ? g?.votes.get(me.id) ?? null : null,
        ready: Boolean(g?.ready.has(me.id)),
        seen: Boolean(g?.seen.has(me.id)),
      } : null,
    };
  }
}
