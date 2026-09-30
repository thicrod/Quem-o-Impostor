// Estado global mínimo de interface (modais que podem ser abertos de vários lugares).

import { useSyncExternalStore } from 'react';

let state = { tutorialOpen: false, settingsOpen: false, installHelpOpen: false };
const listeners = new Set();

export function setUi(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useUi = () => useSyncExternalStore(subscribe, () => state);
