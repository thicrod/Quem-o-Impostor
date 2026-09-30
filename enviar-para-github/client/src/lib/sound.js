// Efeitos sonoros sintetizados com Web Audio (sem arquivos de áudio).
// O AudioContext só é criado depois do primeiro toque/tecla do usuário,
// então o navegador nunca bloqueia nem mostra avisos de autoplay.

import { KEYS, local } from './storage.js';

let ctx = null;
let master = null;
let enabled = local.get(KEYS.sound, true) !== false;
const listeners = new Set();

function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

if (typeof window !== 'undefined') {
  const onGesture = () => unlock();
  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('keydown', onGesture);
}

function tone(freq, { at = 0, dur = 0.15, type = 'sine', gain = 0.5, slide = null } = {}) {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ at = 0, dur = 0.3, gain = 0.25, from = 400, to = 3000 } = {}) {
  const t0 = ctx.currentTime + at;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

const notes = (list, opts) => list.forEach(([f, at, dur = 0.14]) => tone(f, { ...opts, at, dur }));

const SOUNDS = {
  click: () => tone(660, { dur: 0.06, type: 'triangle', gain: 0.25 }),
  join: () => notes([[523, 0], [784, 0.09, 0.2]], { type: 'triangle', gain: 0.35 }),
  leave: () => notes([[523, 0], [392, 0.09, 0.2]], { type: 'triangle', gain: 0.3 }),
  start: () => notes([[392, 0], [523, 0.1], [659, 0.2], [784, 0.3, 0.3]], { type: 'square', gain: 0.18 }),
  reveal: () => {
    noise({ dur: 0.35, gain: 0.18, from: 300, to: 4000 });
    tone(880, { at: 0.25, dur: 0.35, type: 'triangle', gain: 0.35 });
  },
  clue: () => tone(520, { dur: 0.12, type: 'sine', gain: 0.4, slide: 900 }),
  message: () => tone(990, { dur: 0.07, type: 'sine', gain: 0.15 }),
  turn: () => notes([[660, 0], [990, 0.12, 0.22]], { type: 'triangle', gain: 0.4 }),
  tick: () => tone(1200, { dur: 0.05, type: 'square', gain: 0.12 }),
  tickUrgent: () => tone(1500, { dur: 0.08, type: 'square', gain: 0.2 }),
  vote: () => notes([[300, 0, 0.08], [450, 0.06, 0.12]], { type: 'triangle', gain: 0.35 }),
  countdown: () => tone(440, { dur: 0.18, type: 'square', gain: 0.2 }),
  go: () => tone(880, { dur: 0.3, type: 'square', gain: 0.22 }),
  drumroll: () => {
    for (let i = 0; i < 14; i += 1) noise({ at: i * 0.07, dur: 0.06, gain: 0.08 + i * 0.01, from: 150, to: 300 });
  },
  impostor: () => {
    tone(196, { dur: 0.5, type: 'sawtooth', gain: 0.25 });
    tone(185, { at: 0.02, dur: 0.5, type: 'sawtooth', gain: 0.2 });
    noise({ dur: 0.4, gain: 0.15, from: 2000, to: 200 });
  },
  tie: () => notes([[700, 0, 0.08], [500, 0.1, 0.08], [700, 0.2, 0.08], [500, 0.3, 0.18]], { type: 'square', gain: 0.18 }),
  win: () => notes([[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36, 0.45]], { type: 'triangle', gain: 0.35 }),
  lose: () => notes([[392, 0, 0.2], [349, 0.2, 0.2], [311, 0.4, 0.2], [262, 0.6, 0.5]], { type: 'sawtooth', gain: 0.16 }),
  error: () => tone(200, { dur: 0.18, type: 'square', gain: 0.18 }),
};

export function playSound(name) {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  try {
    SOUNDS[name]?.();
  } catch {
    /* som é opcional */
  }
}

export const isSoundEnabled = () => enabled;

export function setSoundEnabled(value) {
  enabled = Boolean(value);
  local.set(KEYS.sound, enabled);
  if (enabled) unlock();
  listeners.forEach((fn) => fn(enabled));
}

export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignora */
  }
}
