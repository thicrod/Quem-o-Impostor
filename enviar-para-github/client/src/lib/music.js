// Música de fundo opcional, gerada na hora com Web Audio (sem arquivos).
// Três "climas": calmo (lobby/resultado), tensão (pistas/discussão/votação)
// e suspense (revelação dos votos/última chance). Desligada por padrão.

import { getAudioContext, onAudioUnlock } from './sound.js';
import { getPrefs, onPrefsChange } from './prefs.js';

const MOODS = {
  calm: { bpm: 84, root: 220, scale: [0, 3, 5, 7, 10, 12], pattern: [0, 2, 4, 2, 1, 3, 5, 3] },
  tension: { bpm: 112, root: 196, scale: [0, 1, 5, 7, 8, 12], pattern: [0, 0, 3, 0, 1, 0, 4, 2] },
  suspense: { bpm: 66, root: 174.61, scale: [0, 1, 6, 7], pattern: [0, 0, 0, 0, 0, 0, 0, 0] },
};

let mood = null;
let timerId = null;
let nextTime = 0;
let step = 0;
let bus = null;
let noiseBuffer = null;

const note = (root, semis) => root * 2 ** (semis / 12);

function tone(ctx, freq, at, dur, type, gain) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(bus);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function hat(ctx, at, gain) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  src.connect(f).connect(g).connect(bus);
  src.start(at);
}

function playStep(ctx, m, s, at) {
  const cfg = MOODS[m];
  const idx = cfg.pattern[s % cfg.pattern.length];
  if (m === 'calm') {
    tone(ctx, note(cfg.root * 2, cfg.scale[idx]), at, 0.4, 'triangle', 0.035);
    if (s % 8 === 0) tone(ctx, cfg.root / 2, at, 1.8, 'sine', 0.06);
    if (s % 16 === 0) {
      tone(ctx, note(cfg.root, 3), at, 3.4, 'sine', 0.018);
      tone(ctx, note(cfg.root, 7), at, 3.4, 'sine', 0.018);
    }
  } else if (m === 'tension') {
    tone(ctx, note(cfg.root, cfg.scale[idx]), at, 0.14, 'triangle', 0.045);
    if (s % 2 === 1) hat(ctx, at, 0.02);
    if (s % 4 === 0) tone(ctx, cfg.root / 2, at, 0.3, 'sine', 0.07);
  } else {
    // batimento cardíaco + nota aguda ocasional
    if (s % 8 === 0) tone(ctx, 55, at, 0.22, 'sine', 0.14);
    if (s % 8 === 1) tone(ctx, 52, at, 0.25, 'sine', 0.1);
    if (s % 16 === 4) tone(ctx, note(cfg.root * 4, cfg.scale[(s / 16) % 4 | 0]), at, 1.2, 'sine', 0.012);
  }
}

function schedule() {
  const ctx = getAudioContext();
  if (!ctx || !mood) return;
  const stepDur = 60 / MOODS[mood].bpm / 2; // colcheias
  while (nextTime < ctx.currentTime + 0.3) {
    playStep(ctx, mood, step, nextTime);
    nextTime += stepDur;
    step += 1;
  }
}

function start() {
  const ctx = getAudioContext();
  if (timerId || !ctx) return;
  bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, ctx.currentTime);
  bus.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 1.2);
  bus.connect(ctx.destination);
  nextTime = ctx.currentTime + 0.1;
  timerId = setInterval(schedule, 100); // um único intervalo, só com a música ligada
}

function stop() {
  if (!timerId) return;
  clearInterval(timerId);
  timerId = null;
  const ctx = getAudioContext();
  if (ctx && bus) {
    const old = bus;
    old.gain.cancelScheduledValues(ctx.currentTime);
    old.gain.setValueAtTime(old.gain.value, ctx.currentTime);
    old.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    setTimeout(() => old.disconnect(), 600);
  }
  bus = null;
}

function update() {
  const ctx = getAudioContext();
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const shouldPlay = getPrefs().music && mood && ctx && ctx.state === 'running' && !hidden;
  if (shouldPlay) start();
  else stop();
}

/** Troca o clima da música (null = silêncio). */
export function setMusicMood(next) {
  if (next === mood) return;
  mood = next;
  update();
}

if (typeof window !== 'undefined') {
  onAudioUnlock((ctx) => {
    ctx.addEventListener('statechange', update);
    setTimeout(update, 50);
  });
  onPrefsChange(update);
  document.addEventListener('visibilitychange', update);
}
