// Preferências pessoais (ficam só neste aparelho): tema, música, vibração,
// tutorial visto. O som dos efeitos continua em sound.js.

import { useSyncExternalStore } from 'react';
import { local } from './storage.js';

export const THEMES = [
  { key: 'neon', label: 'Neon', colors: ['#ff3d8b', '#14c8f0', '#0d0927'] },
  { key: 'sunset', label: 'Pôr do sol', colors: ['#ff6a3d', '#ff5fa2', '#1f0b1c'] },
  { key: 'ocean', label: 'Oceano', colors: ['#14b8a6', '#4f96ff', '#06142b'] },
  { key: 'galaxy', label: 'Galáxia', colors: ['#8b5cf6', '#f472b6', '#080822'] },
  { key: 'hacker', label: 'Hacker', colors: ['#16a34a', '#a3e635', '#041008'] },
  { key: 'vampire', label: 'Vampiro', colors: ['#e11d48', '#d4d4d8', '#130709'] },
];

const KEY = 'impostor:prefs';
const DEFAULTS = { theme: 'neon', music: false, vibration: true, onboarded: false };

let prefs = { ...DEFAULTS, ...(local.get(KEY, {}) || {}) };
if (!THEMES.some((t) => t.key === prefs.theme)) prefs.theme = 'neon';
const listeners = new Set();

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'neon') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  const bg = THEMES.find((t) => t.key === theme)?.colors[2];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#0d0927');
}
applyTheme(prefs.theme);

export const getPrefs = () => prefs;

export function setPref(key, value) {
  prefs = { ...prefs, [key]: value };
  local.set(KEY, prefs);
  if (key === 'theme') applyTheme(value);
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export { subscribe as onPrefsChange };

/** Hook: lê as preferências e re-renderiza quando mudam. */
export function usePrefs() {
  return useSyncExternalStore(subscribe, getPrefs);
}
