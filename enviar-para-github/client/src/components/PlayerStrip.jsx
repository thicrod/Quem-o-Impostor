// Fileira de jogadores da discussão: mostra quem já está pronto e deixa
// marcar suspeitos (🤔) ou de confiança (✅) — notas só suas.

import { motion } from 'motion/react';
import { MARKS, useNotes } from '../lib/notes.js';
import { playSound } from '../lib/sound.js';
import { Avatar, cx } from './ui.jsx';

export function MarkBadge({ mark, className }) {
  if (!mark) return null;
  return (
    <motion.span
      key={mark}
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className={cx('grid size-6 place-items-center rounded-full bg-ink-950 text-sm ring-2 ring-ink-900', className)}
      aria-hidden="true"
    >
      {MARKS[mark].icon}
    </motion.span>
  );
}

export function PlayerStrip({ room }) {
  const { game, you, playerInfo } = room;
  const { marks, cycle } = useNotes(room);
  const ready = new Set(game.readyIds);
  const canMark = you.isParticipant;

  return (
    <section aria-label="Jogadores" className="glass rounded-2xl px-2 py-2">
      <ul className="no-scrollbar flex justify-between gap-1 overflow-x-auto">
        {game.participants.map((id) => {
          const p = playerInfo(id);
          if (!p) return null;
          const me = id === you.id;
          const mark = marks[id];
          const isReady = ready.has(id);
          const status = `${isReady ? 'pronto' : 'ainda conversando'}${mark ? `, marcado como ${MARKS[mark].label}` : ''}`;
          return (
            <li key={id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={me || !canMark}
                onClick={() => {
                  cycle(id);
                  playSound('click');
                }}
                className="flex min-h-14 w-full min-w-11 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1 transition-colors enabled:hover:bg-white/8"
                aria-label={`${p.nickname}${me ? ' (você)' : ''}: ${status}${me || !canMark ? '' : '. Toque para marcar.'}`}
              >
                <span className="relative">
                  <Avatar player={p} size="sm" dim={!isReady} />
                  <MarkBadge mark={mark} className="absolute -top-2 -right-2.5 size-5 text-[11px]" />
                  {isReady && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-1 -bottom-1 grid size-4.5 place-items-center rounded-full bg-good-500 text-[10px] font-black text-ink-950 ring-2 ring-ink-900"
                      aria-hidden="true"
                    >
                      ✓
                    </motion.span>
                  )}
                </span>
                <span className={cx('w-full truncate text-center text-[11px] font-bold', isReady ? 'text-good-400' : 'text-ink-300')}>
                  {me ? 'Você' : p.nickname}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {canMark && (
        <p className="mt-1 text-center text-[11px] font-bold text-ink-300">
          Toque para marcar: 🤔 suspeito · ✅ confio <span className="opacity-70">(só você vê)</span>
        </p>
      )}
    </section>
  );
}
