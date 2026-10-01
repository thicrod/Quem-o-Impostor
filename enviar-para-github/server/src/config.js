// Configuração central do servidor. Tudo que é "regra do jogo" ou limite de
// segurança fica aqui para ser fácil de ajustar sem caçar números mágicos.

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const ENV = {
  PORT: num(process.env.PORT, 3001),
  // `node src/index.js --production` funciona igual em Windows, macOS e Linux.
  NODE_ENV: process.env.NODE_ENV || (process.argv.includes('--production') ? 'production' : 'development'),
  // Origens permitidas para CORS (separadas por vírgula). Vazio = mesma origem
  // em produção e qualquer origem em desenvolvimento.
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || '',
  TRUST_PROXY: process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true',
  // Multiplica TODAS as durações do jogo. Usado pelos testes (ex.: 0.02) para
  // rodar partidas inteiras em poucos segundos. Em produção fica 1.
  TIMER_SCALE: num(process.env.TIMER_SCALE, 1),
  ROOM_TTL_MS: num(process.env.ROOM_TTL_MINUTES, 30) * 60_000,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

export const isProd = ENV.NODE_ENV === 'production';

export const LIMITS = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 6,
  MAX_ROOMS: num(process.env.MAX_ROOMS, 2000),
  MAX_CONNECTIONS_PER_IP: num(process.env.MAX_CONNECTIONS_PER_IP, 30),
  NICK_MIN: 2,
  NICK_MAX: 16,
  CLUE_MIN: 2,
  CLUE_MAX: 24,
  GUESS_MAX: 40,
  CHAT_MAX: 200,
  CHAT_HISTORY: 80,
  CODE_LENGTH: 6,
  // Sala cheia + jogador desconectado há mais que isso no lobby => vaga liberada.
  STALE_PLAYER_MS: 2 * 60_000,
  // Tamanho máximo de um pacote Socket.IO (bytes). Protege contra payloads gigantes.
  MAX_PAYLOAD_BYTES: 4 * 1024,
};

// Durações fixas (ms), antes do TIMER_SCALE.
export const DURATIONS = {
  REVEAL: 40_000, // tempo máximo para todos verem a carta
  VOTE_REVEAL: 7_500, // 3..2..1 + exibição dos votos
  TIE: 4_500,
  LAST_CHANCE: 20_000,
  DISCONNECTED_TURN_GRACE: 6_000, // vez de um jogador desconectado
  HOST_GRACE: 8_000, // host desconectado por mais que isso => passa o cargo
  ROUND_BANNER: 2_200, // banner "Rodada 2/3" antes das pistas
};

export const scaled = (ms) => Math.max(20, Math.round(ms * ENV.TIMER_SCALE));

// Configurações que o host pode alterar (valores permitidos).
// `categories` é validada à parte (lista de chaves do words.json).
export const SETTINGS_OPTIONS = {
  impostorCount: [1, 2],
  impostorMode: ['noWord', 'similar'],
  // Ajuda do impostor: hard = nem a categoria ele vê; normal = vê a categoria;
  // easy = vê a categoria + quantas letras tem a palavra.
  impostorHint: ['hard', 'normal', 'easy'],
  clueSeconds: [20, 30, 45, 60],
  clueRounds: [1, 2], // voltas de pistas antes de cada discussão
  // Discussão: "call" = o grupo conversa por voz (chat de texto desligado); "chat" = chat no app.
  discussionMode: ['call', 'chat'],
  discussionSeconds: [45, 60, 90, 120, 180, 0], // 0 = sem limite de tempo
  votingSeconds: [30, 45, 60],
  anonymousVotes: [false, true],
  targetScore: [0, 10, 15, 20], // 0 = sem limite; senão quem chegar primeiro vence a partida
};

export const DEFAULT_SETTINGS = {
  categories: ['geral'],
  impostorCount: 1,
  impostorMode: 'noWord',
  impostorHint: 'normal',
  clueSeconds: 30,
  clueRounds: 1,
  discussionMode: 'call',
  discussionSeconds: 90,
  votingSeconds: 45,
  anonymousVotes: false,
  targetScore: 0,
};

export const MAX_CATEGORIES_SELECTED = 40;

// Voto em "pular" (ninguém). Não colide com ids de jogador (12 caracteres hex).
export const SKIP_VOTE = 'skip';

// Reações rápidas (emojis que flutuam na tela de todo mundo).
export const REACTIONS = ['😂', '🤔', '🤨', '😱', '🤡', '👏'];

export const RANDOM_CATEGORY = 'aleatoria';

export const AVATARS = [
  '🦊', '🐼', '🐸', '🐙', '🦁', '🐯', '🐵', '🦄',
  '🤖', '👽', '🥷', '🤠', '🧙', '🧛', '🧑‍🚀', '🧑‍🎨',
];

// Cor de destaque de cada "assento" da sala (atribuída na entrada).
export const SEAT_COLORS = ['#ff4fa3', '#22d3ee', '#a3e635', '#fbbf24', '#a78bfa', '#fb7185'];

export const SCORING = {
  GROUP_CATCHES: 2, // cada inocente
  IMPOSTOR_ESCAPES: 3, // cada impostor
  IMPOSTOR_STEALS: 2, // impostor eliminado que adivinha a palavra
};

// Rate limit por socket: capacidade do "balde" e recarga por segundo.
export const RATE_LIMITS = {
  default: { capacity: 20, refillPerSec: 10 },
  chat: { capacity: 5, refillPerSec: 0.8 },
  create: { capacity: 3, refillPerSec: 0.05 },
  join: { capacity: 6, refillPerSec: 0.5 },
  reaction: { capacity: 5, refillPerSec: 2 },
};

// Após tantas violações de rate limit/payload inválido o socket é desconectado.
export const MAX_ABUSE_STRIKES = 60;
