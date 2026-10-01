// Notas pessoais de suspeita (🤔 suspeito / ✅ confio). Ficam só neste
// aparelho, valem para a rodada atual e nunca vão para o servidor.

import { useCallback, useSyncExternalStore } from 'react';
import { session } from './storage.js';

const ORDER = [null, 'sus', 'trust'];
export const MARKS = {
  sus: { icon: '🤔', label: 'suspeito' },
  trust: { icon: '✅', label: 'confio' },
};

const cache = new Map();
const listeners = new Set();
const EMPTY = Object.freeze({});

const keyOf = (room) => (room?.game ? `impostor:notes:${room.code}:${room.game.number}` : null);

function read(key) {
  if (!key) return EMPTY;
  if (!cache.has(key)) cache.set(key, session.get(key, {}) || {});
  return cache.get(key);
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Notas da rodada atual + função para alternar a nota de um jogador. */
export function useNotes(room) {
  const key = keyOf(room);
  const marks = useSyncExternalStore(subscribe, () => read(key));
  const cycle = useCallback((playerId) => {
    if (!key) return;
    const current = read(key);
    const next = ORDER[(ORDER.indexOf(current[playerId] ?? null) + 1) % ORDER.length];
    const updated = { ...current };
    if (next) updated[playerId] = next;
    else delete updated[playerId];
    cache.set(key, updated);
    session.set(key, updated);
    listeners.forEach((fn) => fn());
  }, [key]);
  return { marks, cycle };
}
