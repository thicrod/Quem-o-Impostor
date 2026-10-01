// Aviso amigável quando o servidor demora para responder. No plano grátis do
// Render ele "dorme" sem jogadores e leva até ~1 minuto para acordar.

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Spinner, cx } from './ui.jsx';

/** Segundos desde que `active` ficou verdadeiro (0 enquanto falso). */
export function useSecondsWhile(active) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const start = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => {
      clearInterval(id);
      setSeconds(0);
    };
  }, [active]);
  return active ? seconds : 0;
}

const WAKE_SECONDS = 60;

export function ServerWaking({ seconds, className, onRetry, offline = false }) {
  const progress = Math.min(0.95, seconds / WAKE_SECONDS);
  return (
    <div
      role="status"
      className={cx('rounded-2xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-left', className)}
    >
      <div className="flex items-center gap-3">
        <motion.span
          className="text-2xl"
          animate={{ rotate: [0, -12, 12, 0], y: [0, -2, 0] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          aria-hidden="true"
        >
          🛌
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-sky-400">Acordando o servidor… {seconds}s</p>
          <p className="text-[13px] leading-snug text-ink-200">
            Quando ninguém joga por um tempo, ele tira um cochilo. Leva até 1 minuto — o jogo conecta sozinho.
          </p>
        </div>
        {offline ? (
          onRetry && (
            <button type="button" className="min-h-11 shrink-0 px-2 text-sm font-extrabold text-sky-400 underline" onClick={onRetry}>
              Tentar
            </button>
          )
        ) : (
          <Spinner className="size-5 shrink-0 text-sky-400" />
        )}
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-grape-400"
          style={{ width: `${progress * 100}%`, transition: 'width 1s linear' }}
        />
      </div>
    </div>
  );
}
