// Cronômetro espelhado do servidor.
// O servidor manda "quanto falta" (remainingMs) em cada atualização; o cliente
// só desconta o tempo passado desde que recebeu (performance.now, monotônico).
// Não depende do relógio do sistema do navegador e usa UM único intervalo
// compartilhado por todos os componentes que exibem tempo.

import { useSyncExternalStore } from 'react';
import { useGame, useScopedRoomView } from './useGame.jsx';

const subscribers = new Set();
let intervalId = null;
let now = performance.now();

function subscribe(callback) {
  subscribers.add(callback);
  if (!intervalId) {
    intervalId = setInterval(() => {
      now = performance.now();
      subscribers.forEach((fn) => fn());
    }, 200);
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

const getNow = () => now;

export function useCountdown() {
  const { state } = useGame();
  const scoped = useScopedRoomView();
  const current = useSyncExternalStore(subscribe, getNow);
  const timer = (scoped ?? state.room)?.timer;
  if (!timer) return null;
  const elapsed = Math.max(0, current - state.receivedAt);
  const remainingMs = Math.max(0, timer.remainingMs - elapsed);
  return {
    remainingMs,
    seconds: Math.ceil(remainingMs / 1000),
    durationMs: timer.durationMs,
    progress: timer.durationMs ? remainingMs / timer.durationMs : 0,
  };
}
