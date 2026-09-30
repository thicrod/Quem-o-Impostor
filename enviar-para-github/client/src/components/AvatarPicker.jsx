import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { playSound } from '../lib/sound.js';
import { cx } from './ui.jsx';

/** Seletor de avatar. `taken` = avatares já escolhidos por outros jogadores. */
export function AvatarPicker({ avatars, value, onChange, taken = new Set(), compact = false, disabled = false }) {
  const selectedRef = useRef(null);
  const stripRef = useRef(null);

  // Mantém o avatar escolhido visível na faixa horizontal (sem rolar a página).
  useEffect(() => {
    const strip = stripRef.current;
    const el = selectedRef.current;
    if (!compact || !value || !strip || !el) return;
    strip.scrollLeft = el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2;
  }, [compact, value]);

  return (
    <div
      ref={stripRef}
      role="radiogroup"
      aria-label="Escolha seu avatar"
      className={cx(
        compact
          ? 'no-scrollbar relative -mx-1 flex snap-x gap-2 overflow-x-auto px-1 py-1.5'
          : 'grid grid-cols-6 gap-2 sm:grid-cols-8',
      )}
    >
      {avatars.map((a) => {
        const selected = a === value;
        const unavailable = taken.has(a) && !selected;
        return (
          <motion.button
            key={a}
            ref={selected ? selectedRef : undefined}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Avatar ${a}${unavailable ? ' (já escolhido)' : ''}`}
            disabled={disabled || unavailable}
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              playSound('click');
              onChange(a);
            }}
            className={cx(
              'relative grid shrink-0 snap-center place-items-center rounded-2xl border-2 text-[1.9rem] leading-none transition-colors',
              compact ? 'size-14' : 'aspect-square w-full min-h-12',
              selected
                ? 'border-hot-400 bg-hot-500/20 shadow-glow-hot'
                : 'border-white/10 bg-white/5 hover:border-white/30',
              unavailable && 'opacity-30 grayscale',
            )}
          >
            <span aria-hidden="true">{a}</span>
            {selected && (
              <motion.span
                layoutId={compact ? 'avatar-check-compact' : 'avatar-check'}
                className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-hot-500 text-[11px] font-black text-white"
                aria-hidden="true"
              >
                ✓
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
