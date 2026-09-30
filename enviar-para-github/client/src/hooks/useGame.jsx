// Estado global do cliente. O cliente NÃO decide nada do jogo: ele só guarda
// a última "visão" enviada pelo servidor e envia intenções (eventos).

import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef,
} from 'react';
import { request, socket } from '../lib/socket.js';
import { resolveClientId } from '../lib/identity.js';
import { roomStore } from '../lib/storage.js';
import { playSound } from '../lib/sound.js';

const GameContext = createContext(null);

// Durante a animação de saída de uma tela, ela continua montada por alguns
// milissegundos. RoomScope "congela" a sala que aquela tela estava mostrando,
// para ela não tentar renderizar os dados da fase seguinte.
const RoomScopeContext = createContext(null);
export function RoomScope({ room, children }) {
  return <RoomScopeContext.Provider value={room}>{children}</RoomScopeContext.Provider>;
}
export const useScopedRoomView = () => useContext(RoomScopeContext);

const FATAL = {
  ROOM_EXPIRED: {
    icon: '⌛', title: 'Sessão expirada',
    message: 'Essa sala ficou inativa por mais de 30 minutos e foi encerrada.',
  },
  ROOM_NOT_FOUND: {
    icon: '🔍', title: 'Sala não encontrada',
    message: 'Não encontramos essa sala. Ela pode ter sido encerrada.',
  },
  SESSION_GONE: {
    icon: '🚪', title: 'Você saiu da sala',
    message: 'Você não faz mais parte dessa sala. Entre de novo com o código.',
  },
  REPLACED: {
    icon: '📱', title: 'Jogo aberto em outro lugar',
    message: 'Sua sessão foi aberta em outra aba ou dispositivo.',
  },
  shutdown: {
    icon: '🔧', title: 'Servidor reiniciado',
    message: 'O servidor foi reiniciado e as salas foram encerradas. Crie uma nova sala.',
  },
};

const initialState = {
  clientId: null,
  connection: 'connecting', // connecting | online | reconnecting | offline
  everConnected: false,
  meta: null,
  room: null,
  receivedAt: 0,
  chat: [],
  fatal: null,
  resuming: false,
  toasts: [],
};

let toastSeq = 0;

function reducer(state, action) {
  switch (action.type) {
    case 'clientId':
      return { ...state, clientId: action.clientId };
    case 'connection':
      return {
        ...state,
        connection: action.value,
        everConnected: state.everConnected || action.value === 'online',
      };
    case 'meta':
      return { ...state, meta: action.meta };
    case 'room':
      return { ...state, room: action.room, receivedAt: performance.now(), resuming: false };
    case 'left':
      return { ...state, room: null, chat: [], resuming: false };
    case 'resuming':
      return { ...state, resuming: action.value };
    case 'chatHistory':
      return { ...state, chat: action.messages };
    case 'chatAdd':
      if (state.chat.some((m) => m.id === action.message.id)) return state;
      return { ...state, chat: [...state.chat, action.message].slice(-120) };
    case 'chatReset':
      return { ...state, chat: [] };
    case 'fatal':
      return { ...state, fatal: action.fatal, room: null, chat: [], resuming: false };
    case 'clearFatal':
      return { ...state, fatal: null };
    case 'toast':
      return { ...state, toasts: [...state.toasts.slice(-3), { id: (toastSeq += 1), ...action.toast }] };
    case 'dismissToast':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const clientIdRef = useRef(null);
  const roomRef = useRef(null);
  useEffect(() => {
    roomRef.current = state.room;
  }, [state.room]);

  const toast = useCallback((text, kind = 'info') => {
    dispatch({ type: 'toast', toast: { text, kind } });
  }, []);

  const showFatal = useCallback((code, extra) => {
    const base = FATAL[code] || { icon: '⚠️', title: 'Ops!', message: extra || 'Algo deu errado.' };
    dispatch({ type: 'fatal', fatal: { code, ...base, ...(extra ? { message: extra } : {}) } });
  }, []);

  const resume = useCallback(async () => {
    const clientId = clientIdRef.current;
    const saved = clientId && roomStore.load(clientId);
    if (!saved?.code) return;
    dispatch({ type: 'resuming', value: true });
    const res = await request('room:resume', { clientId, code: saved.code });
    if (res.ok) return;
    dispatch({ type: 'resuming', value: false });
    if (['ROOM_EXPIRED', 'ROOM_NOT_FOUND', 'SESSION_GONE', 'INVALID_CODE'].includes(res.code)) {
      roomStore.clear(clientId);
      // Só mostra tela de erro se o jogador estava dentro de uma sala nesta aba
      // ou se a sala expirou (mensagem pedida explicitamente).
      if (res.code === 'ROOM_EXPIRED' || roomRef.current) showFatal(res.code);
      else dispatch({ type: 'left' });
    }
  }, [showFatal]);

  // Liga os listeners do socket uma única vez (e remove ao desmontar).
  useEffect(() => {
    let cancelled = false;
    const handlers = {
      connect: () => {
        dispatch({ type: 'connection', value: 'online' });
        resume();
      },
      disconnect: (reason) => {
        if (reason === 'io client disconnect') return;
        dispatch({ type: 'connection', value: 'reconnecting' });
      },
      connect_error: () => {
        dispatch({ type: 'connection', value: socket.active ? 'reconnecting' : 'offline' });
      },
      'server:meta': (meta) => dispatch({ type: 'meta', meta }),
      'room:state': (room) => dispatch({ type: 'room', room }),
      'chat:history': (messages) => dispatch({ type: 'chatHistory', messages }),
      'chat:message': (message) => {
        dispatch({ type: 'chatAdd', message });
        if (message.playerId !== roomRef.current?.you?.id) playSound('message');
      },
      'chat:reset': () => dispatch({ type: 'chatReset' }),
      notice: ({ kind, text }) => {
        if (kind === 'reconnect' || kind === 'disconnect') {
          dispatch({ type: 'toast', toast: { text, kind: kind === 'disconnect' ? 'warn' : 'info' } });
          return;
        }
        dispatch({ type: 'toast', toast: { text, kind: kind === 'abort' || kind === 'error' ? 'error' : kind } });
      },
      'room:closed': ({ reason, message }) => {
        if (clientIdRef.current) roomStore.clear(clientIdRef.current);
        showFatal(reason === 'expired' ? 'ROOM_EXPIRED' : reason, message);
      },
      'session:replaced': () => showFatal('REPLACED'),
    };
    Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
    const onReconnectFailed = () => dispatch({ type: 'connection', value: 'offline' });
    socket.io.on('reconnect_failed', onReconnectFailed);

    resolveClientId().then((clientId) => {
      if (cancelled) return;
      clientIdRef.current = clientId;
      dispatch({ type: 'clientId', clientId });
      socket.connect();
    });

    return () => {
      cancelled = true;
      Object.entries(handlers).forEach(([ev, fn]) => socket.off(ev, fn));
      socket.io.off('reconnect_failed', onReconnectFailed);
      socket.disconnect();
    };
  }, [resume, showFatal]);

  const actions = useMemo(() => {
    const withRoomSave = async (event, payload) => {
      const res = await request(event, { ...payload, clientId: clientIdRef.current });
      if (res.ok && res.code) roomStore.save(clientIdRef.current, res.code);
      return res;
    };
    const simple = (event) => async (payload) => {
      const res = await request(event, payload);
      if (!res.ok && res.code === 'NOT_IN_ROOM') toast(res.message, 'error');
      return res;
    };
    return {
      createRoom: ({ nickname, avatar }) => withRoomSave('room:create', { nickname, avatar }),
      joinRoom: ({ code, nickname, avatar }) => withRoomSave('room:join', { code, nickname, avatar }),
      leaveRoom: async () => {
        await request('room:leave');
        roomStore.clear(clientIdRef.current);
        dispatch({ type: 'left' });
      },
      retryResume: async () => {
        dispatch({ type: 'clearFatal' });
        await resume();
      },
      dismissFatal: () => {
        roomStore.clear(clientIdRef.current);
        dispatch({ type: 'clearFatal' });
        dispatch({ type: 'left' });
      },
      reconnectNow: () => {
        if (!socket.connected) socket.connect();
      },
      setAvatar: (avatar) => simple('player:avatar')({ avatar }),
      updateSettings: (patch) => simple('settings:update')(patch),
      startGame: () => simple('game:start')(),
      markSeen: () => simple('card:seen')(),
      submitClue: (text) => simple('clue:submit')({ text }),
      sendChat: (text) => simple('chat:send')({ text }),
      toggleReady: () => simple('discussion:ready')(),
      castVote: (targetId) => simple('vote:cast')({ targetId }),
      submitGuess: (text) => simple('guess:submit')({ text }),
      playAgain: () => simple('game:playAgain')(),
      toLobby: () => simple('game:toLobby')(),
      toast,
      dismissToast: (id) => dispatch({ type: 'dismissToast', id }),
    };
  }, [resume, toast]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame precisa estar dentro de <GameProvider>');
  return ctx;
}

/** Atalhos derivados da visão da sala. */
export function useRoom() {
  const { state } = useGame();
  const scoped = useContext(RoomScopeContext);
  const room = scoped ?? state.room;
  return useMemo(() => {
    if (!room) return null;
    const byId = Object.fromEntries(room.players.map((p) => [p.id, p]));
    const roster = room.game?.roster || {};
    // Jogadores que saíram no meio da rodada continuam aparecendo com o nome salvo.
    const playerInfo = (id) => byId[id] || (roster[id] ? { id, ...roster[id], connected: false, left: true } : null);
    return { ...room, byId, playerInfo, me: byId[room.you?.id] || null };
  }, [room]);
}
