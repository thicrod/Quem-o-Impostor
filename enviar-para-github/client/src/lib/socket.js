import { io } from 'socket.io-client';

// Em dev o Vite faz proxy de /socket.io para o servidor (mesma origem).
// Em deploy separado (front num host, back em outro), defina VITE_SERVER_URL.
const URL = import.meta.env.VITE_SERVER_URL || undefined;

export const socket = io(URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 600,
  reconnectionDelayMax: 4000,
  timeout: 8000,
});

const FRIENDLY_TIMEOUT = {
  ok: false,
  code: 'TIMEOUT',
  message: 'O servidor não respondeu. Verifique sua conexão e tente de novo.',
};

/** emit com confirmação + timeout; nunca lança exceção. */
export async function request(event, payload) {
  if (!socket.connected) {
    return { ok: false, code: 'OFFLINE', message: 'Sem conexão com o servidor. Tentando reconectar…' };
  }
  try {
    const args = payload === undefined ? [event] : [event, payload];
    return await socket.timeout(8000).emitWithAck(...args);
  } catch {
    return FRIENDLY_TIMEOUT;
  }
}
