// "Instalar app" (PWA). No Android/Chrome/Edge o navegador dispara
// `beforeinstallprompt`; no iPhone é preciso usar Compartilhar → Tela de Início.

import { useSyncExternalStore } from 'react';

let deferred = null;
let installed = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

const isStandalone = () => typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

const isIOS = () => typeof navigator !== 'undefined'
  && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

let snapshot = null;
function getSnapshot() {
  const next = {
    canPrompt: Boolean(deferred),
    standalone: isStandalone() || installed,
    ios: isIOS(),
  };
  if (!snapshot || snapshot.canPrompt !== next.canPrompt || snapshot.standalone !== next.standalone || snapshot.ios !== next.ios) {
    snapshot = next;
  }
  return snapshot;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useInstall() {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  return {
    ...state,
    // Mostra o botão quando dá para instalar direto ou quando é iPhone fora do app.
    available: !state.standalone && (state.canPrompt || state.ios),
    async install() {
      if (!deferred) return 'manual';
      deferred.prompt();
      const choice = await deferred.userChoice.catch(() => null);
      deferred = null;
      emit();
      return choice?.outcome === 'accepted' ? 'installed' : 'dismissed';
    },
  };
}
