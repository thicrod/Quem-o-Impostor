// Timer circular. Só EXIBE o tempo que o servidor informou (useCountdown).
// Nos últimos 10s muda de cor, pulsa e (opcionalmente) toca o "tic".

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useCountdown } from '../hooks/useCountdown.js';
import { formatClock } from '../lib/format.js';
import { playSound } from '../lib/sound.js';
import { cx } from './ui.jsx';

export function TimerRing({ size = 64, tick = false, format = 'seconds', className, label = 'Tempo restante', whenStopped = null }) {
  const countdown = useCountdown();
  const lastTick = useRef(null);
  const seconds = countdown?.seconds ?? 0;
  const warn = countdown && seconds <= 10;
  const danger = countdown && seconds <= 5;

  useEffect(() => {
    if (!tick || !countdown || seconds > 10 || seconds < 1) return;
    if (lastTick.current === seconds) return;
    lastTick.current = seconds;
    playSound(seconds <= 5 ? 'tickUrgent' : 'tick');
  }, [tick, countdown, seconds]);

  if (!countdown) return whenStopped ? <StoppedRing size={size} text={whenStopped} className={className} /> : null;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = danger ? 'var(--color-bad-400)' : warn ? 'var(--color-sun-400)' : 'var(--color-sky-400)';
  const text = format === 'clock' ? formatClock(countdown.remainingMs / 1000) : `${seconds}`;

  return (
    <div
      className={cx('relative inline-grid shrink-0 place-items-center rounded-full', danger && 'animate-pulse-ring', className)}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${label}: ${seconds} segundos`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgb(7 5 26 / 0.7)" stroke="rgb(255 255 255 / 0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, countdown.progress))}
          style={{ transition: 'stroke-dashoffset 0.2s linear, stroke 0.3s' }}
        />
      </svg>
      <motion.span
        key={warn ? seconds : 'steady'}
        initial={warn ? { scale: 1.35 } : false}
        animate={{ scale: 1 }}
        transition={{ duration: 0.25 }}
        className="absolute font-display tabular-nums leading-none"
        style={{ color, fontSize: format === 'clock' && seconds >= 60 ? size * 0.24 : size * 0.34 }}
      >
        {text}
      </motion.span>
    </div>
  );
}

/** Anel parado (ex.: "∞" na discussão sem limite de tempo). */
function StoppedRing({ size, text, className }) {
  return (
    <div
      className={cx('relative inline-grid shrink-0 place-items-center rounded-full border-[6px] border-sky-400/40 bg-ink-950/70', className)}
      style={{ width: size, height: size }}
      role="timer"
      aria-label="Sem limite de tempo"
    >
      <span className="font-display leading-none text-sky-400" style={{ fontSize: size * 0.42 }} aria-hidden="true">{text}</span>
    </div>
  );
}

/** Barra fina de progresso (para cabeçalhos compactos). */
export function TimerBar({ className }) {
  const countdown = useCountdown();
  if (!countdown) return null;
  const warn = countdown.seconds <= 10;
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-white/10', className)} aria-hidden="true">
      <div
        className={cx('h-full rounded-full', warn ? 'bg-bad-400' : 'bg-gradient-to-r from-sky-400 to-grape-400')}
        style={{ width: `${Math.min(100, countdown.progress * 100)}%`, transition: 'width 0.2s linear' }}
      />
    </div>
  );
}
