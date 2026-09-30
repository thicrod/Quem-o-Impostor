import { AnimatePresence, motion } from 'motion/react';
import { Avatar, cx } from './ui.jsx';

/** Pistas agrupadas por rodada, em ordem de envio. */
export function ClueList({ game, playerInfo, meId, emptyText = 'As pistas aparecem aqui.', highlightIds = [] }) {
  const rounds = [...new Set(game.clues.map((c) => c.round))].sort((a, b) => b - a);
  if (game.clues.length === 0) {
    return <p className="rounded-2xl border-2 border-dashed border-white/10 px-4 py-6 text-center text-sm font-bold text-ink-300">{emptyText}</p>;
  }
  const highlight = new Set(highlightIds);
  return (
    <div className="grid gap-4">
      {rounds.map((round) => (
        <section key={round} aria-label={`Pistas da rodada ${round}`}>
          {rounds.length > 1 && (
            <h3 className="mb-2 text-xs font-extrabold tracking-[0.2em] text-ink-300 uppercase">Rodada {round}</h3>
          )}
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {game.clues
                .filter((c) => c.round === round)
                .map((c) => {
                  const p = playerInfo(c.playerId);
                  return (
                    <motion.li
                      key={`${c.round}-${c.playerId}`}
                      layout
                      initial={{ opacity: 0, scale: 0.7, y: -12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                      className={cx(
                        'flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5',
                        c.playerId === meId ? 'border-hot-400/50 bg-hot-500/10' : 'border-white/10 bg-white/5',
                        highlight.has(c.playerId) && 'ring-2 ring-sun-400/70',
                      )}
                    >
                      <Avatar player={p} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-extrabold text-ink-300">{p?.nickname}</p>
                        {c.skipped ? (
                          <p className="text-base font-bold text-ink-300 italic">⏱️ sem pista</p>
                        ) : (
                          <p className="truncate font-display text-2xl leading-tight text-white">
                            <span className="mr-1.5 text-lg" aria-hidden="true">{game.category.emoji}</span>“{c.text}”
                          </p>
                        )}
                      </div>
                    </motion.li>
                  );
                })}
            </AnimatePresence>
          </ol>
        </section>
      ))}
    </div>
  );
}

/** Mapa jogadorId -> pistas (para os cards de votação). */
export function cluesByPlayer(game) {
  const map = {};
  for (const c of game.clues) {
    (map[c.playerId] ||= []).push(c.skipped ? '—' : c.text);
  }
  return map;
}
