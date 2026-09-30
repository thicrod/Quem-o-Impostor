import { motion } from 'motion/react';
import { playSound } from '../lib/sound.js';
import { cx } from './ui.jsx';

/** Controle segmentado (tipo "abas") — acessível como radiogroup. */
export function Segmented({ label, options, value, onChange, disabled = false, name }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl border border-white/10 bg-ink-950/50 p-1">
      {options.map((opt) => {
        const selected = opt.value === value;
        const optDisabled = disabled || opt.disabled;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={optDisabled}
            title={opt.title}
            onClick={() => {
              if (selected) return;
              playSound('click');
              onChange(opt.value);
            }}
            className={cx(
              'relative min-h-11 flex-1 rounded-xl px-2 text-sm font-extrabold transition-colors',
              selected ? 'text-ink-950' : 'text-ink-200 hover:text-white',
              optDisabled && !selected && 'opacity-35',
              disabled && 'cursor-default',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`seg-${name || label}`}
                className="absolute inset-0 rounded-xl bg-gradient-to-b from-sky-400 to-sky-500 shadow-glow-sky"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
