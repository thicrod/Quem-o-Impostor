import { AnimatePresence, motion } from 'motion/react';
import { Avatar, cx } from './ui.jsx';

const passOf = (c) => c.pass ?? c.round;

/** Pistas agrupadas por volta (e rodada de votação), a mais recente primeiro. */
export function ClueList({ game, playerInfo, meId, emptyText = 'As pistas aparecem aqui.', highlightIds = [] }) {
  const passes = [...new Set(game.clues.map(passOf))].sort((a, b) => b - a);
  const multiRound = new Set(game.clues.map((c) => c.round)).size > 1;
  const multiPass = (game.clueRounds ?? 1) > 1;
  // Número da volta dentro da rodada de votação (1ª, 2ª…)
  const passLabel = (pass) => {
    const round = game.clues.find((c) => passOf(c) === pass)?.round ?? 1;
    const inRound = [...new Set(game.clues.filter((c) => passOf(c) === pass).map(passOf))].sort((a, b) => a - b);
    const parts = [];
    if (multiRound) parts.push(`Rodada ${round}`);
    if (multiPass) parts.push(`${inRound.indexOf(pass) + 1}ª volta`);
    return parts.join(' · ');
  };
  if (game.clues.length === 0) {
    return <p className="rounded-2xl border-2 border-dashed border-white/10 px-4 py-6 text-center text-sm font-bold text-ink-300">{emptyText}</p>;
  }
  const highlight = new Set(highlightIds);
  return (
    <div className="grid gap-4">
      {passes.map((pass) => (
        <section key={pass} aria-label={passLabel(pass) ? `Pistas: ${passLabel(pass)}` : 'Pistas'}>
          {passes.length > 1 && (
            <h3 className="mb-2 text-xs font-extrabold tracking-[0.2em] text-ink-300 uppercase">{passLabel(pass)}</h3>
          )}
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {game.clues
                .filter((c) => passOf(c) === pass)
                .map((c) => {
                  const p = playerInfo(c.playerId);
                  return (
                    <motion.li
                      key={`${passOf(c)}-${c.playerId}`}
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
