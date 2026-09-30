// Componentes visuais básicos (botões, painéis, avatares, chips).

import { forwardRef } from 'react';
import { motion } from 'motion/react';

const cx = (...parts) => parts.filter(Boolean).join(' ');
export { cx };

const BUTTON_VARIANTS = {
  primary:
    'text-white bg-gradient-to-b from-hot-400 to-hot-600 shadow-[0_5px_0_0_#8f0c47,0_16px_30px_-12px_rgb(255_61_139/0.7)] active:shadow-[0_1px_0_0_#8f0c47]',
  secondary:
    'text-ink-950 bg-gradient-to-b from-sky-400 to-sky-500 shadow-[0_5px_0_0_#0b7f9c,0_16px_30px_-12px_rgb(20_200_240/0.6)] active:shadow-[0_1px_0_0_#0b7f9c]',
  success:
    'text-ink-950 bg-gradient-to-b from-good-400 to-good-500 shadow-[0_5px_0_0_#0f8a55,0_16px_30px_-12px_rgb(31_216_138/0.6)] active:shadow-[0_1px_0_0_#0f8a55]',
  danger:
    'text-white bg-gradient-to-b from-bad-400 to-bad-500 shadow-[0_5px_0_0_#a1122a,0_16px_30px_-12px_rgb(255_59_82/0.6)] active:shadow-[0_1px_0_0_#a1122a]',
  gold:
    'text-ink-950 bg-gradient-to-b from-sun-400 to-sun-500 shadow-[0_5px_0_0_#a86200,0_16px_30px_-12px_rgb(255_159_26/0.6)] active:shadow-[0_1px_0_0_#a86200]',
  ghost:
    'text-ink-100 bg-white/8 border border-white/15 hover:bg-white/12 shadow-[0_4px_0_0_rgb(0_0_0/0.35)] active:shadow-none',
};

const BUTTON_SIZES = {
  sm: 'min-h-11 px-4 text-sm rounded-xl gap-1.5',
  md: 'min-h-13 px-5 text-base rounded-2xl gap-2',
  lg: 'min-h-15 px-6 text-lg rounded-2xl gap-2.5',
  xl: 'min-h-16 px-7 text-xl rounded-3xl gap-3',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'lg', block = false, loading = false, className, children, disabled, ...props },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={isDisabled ? undefined : { scale: 0.97, y: 3 }}
      className={cx(
        'relative inline-flex select-none items-center justify-center font-display uppercase tracking-wide transition-[filter,opacity,box-shadow] duration-150',
        'hover:brightness-110 disabled:opacity-45 disabled:saturate-50 disabled:hover:brightness-100',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        block && 'w-full',
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </motion.button>
  );
});

export function IconButton({ label, className, children, active, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-11 min-w-11 items-center justify-center rounded-2xl border px-2.5 text-lg transition-colors',
        active ? 'border-sky-400/60 bg-sky-400/15 text-sky-400' : 'border-white/12 bg-white/6 text-ink-100 hover:bg-white/12',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={cx('inline-block size-6 animate-spin rounded-full border-[3px] border-current border-r-transparent', className)}
    />
  );
}

export function Panel({ as: Tag = 'section', className, children, strong = false, ...props }) {
  return (
    <Tag className={cx(strong ? 'glass-strong' : 'glass', 'rounded-3xl p-4 sm:p-5', className)} {...props}>
      {children}
    </Tag>
  );
}

export function Chip({ children, tone = 'default', className, ...props }) {
  const tones = {
    default: 'bg-white/8 text-ink-100 border-white/12',
    hot: 'bg-hot-500/15 text-hot-400 border-hot-400/40',
    sky: 'bg-sky-400/12 text-sky-400 border-sky-400/40',
    good: 'bg-good-500/15 text-good-400 border-good-400/40',
    bad: 'bg-bad-500/15 text-bad-400 border-bad-400/40',
    sun: 'bg-sun-400/15 text-sun-400 border-sun-400/40',
    grape: 'bg-grape-500/18 text-grape-400 border-grape-400/40',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

const AVATAR_SIZES = {
  xs: 'size-7 text-base',
  sm: 'size-9 text-lg',
  md: 'size-12 text-2xl',
  lg: 'size-16 text-[2rem]',
  xl: 'size-22 text-5xl',
  '2xl': 'size-30 text-6xl',
};

export function Avatar({ player, size = 'md', className, showStatus = false, dim = false }) {
  if (!player) return null;
  const color = player.color || '#8b5cf6';
  const offline = player.connected === false;
  return (
    <span
      className={cx('relative inline-flex shrink-0 items-center justify-center rounded-full', AVATAR_SIZES[size], className)}
      style={{
        background: `radial-gradient(circle at 32% 28%, ${color}66, ${color}22 62%, rgb(7 5 26 / 0.6))`,
        boxShadow: `0 0 0 2.5px ${color}, 0 8px 20px -8px ${color}`,
      }}
      aria-hidden="true"
    >
      <span className={cx('leading-none', (offline || dim) && 'opacity-45 grayscale')}>{player.avatar}</span>
      {showStatus && offline && (
        <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-ink-800 text-[11px] ring-2 ring-ink-900">
          💤
        </span>
      )}
    </span>
  );
}

export function SectionTitle({ children, right, className }) {
  return (
    <div className={cx('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="font-display text-lg tracking-wide text-ink-200 uppercase">{children}</h2>
      {right}
    </div>
  );
}

/** Texto para leitores de tela apenas. */
export function SrOnly({ children, ...props }) {
  return <span className="sr-only" {...props}>{children}</span>;
}
