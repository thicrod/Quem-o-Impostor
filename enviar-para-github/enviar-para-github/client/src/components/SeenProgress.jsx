import { motion } from 'motion/react';
import { Avatar, cx } from './ui.jsx';

/** Fileira de avatares mostrando quem já concluiu uma ação (viu a carta, votou, está pronto). */
export function DoneRow({ ids, doneIds, playerInfo, label }) {
  const done = new Set(doneIds);
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-bold text-ink-200" role="status">
        {label} <span className="font-display text-white">{doneIds.length}/{ids.length}</span>
      </p>
      <ul className="flex flex-wrap justify-center gap-2">
        {ids.map((id) => {
          const p = playerInfo(id);
          if (!p) return null;
          const ok = done.has(id);
          return (
            <li key={id} className="relative" aria-label={`${p.nickname}: ${ok ? 'pronto' : 'aguardando'}`}>
              <Avatar player={p} size="sm" dim={!ok} />
              {ok && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={cx('absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-good-500 text-[11px] font-black text-ink-950 ring-2 ring-ink-900')}
                  aria-hidden="true"
                >
                  ✓
                </motion.span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
