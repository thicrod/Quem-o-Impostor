import { useEffect, useState } from 'react';
import { AnimatePresence, animate, motion } from 'motion/react';
import { Avatar, Chip, cx } from './ui.jsx';

const MEDALS = ['🥇', '🥈', '🥉'];

export function CountUp({ from = 0, to, duration = 1.1, delay = 0, className }) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    const controls = animate(from, to, {
      duration,
      delay,
      ease: 'easeOut',
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [from, to, duration, delay]);
  return <span className={cx('tabular-nums', className)}>{value}</span>;
}

export function rankPlayers(players) {
  return [...players].sort((a, b) => b.score - a.score || b.stats.wins - a.stats.wins || a.nickname.localeCompare(b.nickname));
}

const STAT_LABELS = [
  ['score', 'Pontos', '⭐'],
  ['wins', 'Vitórias', '🏆'],
  ['rounds', 'Rodadas', '🎲'],
  ['timesImpostor', 'Vezes como impostor', '🎭'],
  ['impostorsFound', 'Impostores descobertos', '🕵️'],
  ['escapes', 'Fugas como impostor', '💨'],
  ['steals', 'Vitórias roubadas', '🦹'],
  ['framed', 'Eliminado sendo inocente', '🐑'],
  ['matchesWon', 'Partidas vencidas', '👑'],
];

/**
 * Leaderboard de jogo. `gained` = pontos ganhos na última rodada (anima a subida).
 */
export function Leaderboard({ players, meId, gained = null, title = 'Placar', compact = false, delay = 0 }) {
  const ranked = rankPlayers(players);
  const [openId, setOpenId] = useState(null);
  const top = ranked[0]?.score ?? 0;

  return (
    <section aria-label={title}>
      <div className="mb-3">
        <h2 className="font-display text-xl tracking-wide text-white uppercase">🏆 {title}</h2>
        <p className="text-xs font-bold text-ink-300">Toque em um jogador para ver as estatísticas</p>
      </div>
      <motion.ol layout className="grid gap-2">
        {ranked.map((p, i) => {
          const isMe = p.id === meId;
          const leader = i === 0 && top > 0;
          const delta = gained?.[p.id] ?? 0;
          const open = openId === p.id;
          return (
            <motion.li
              key={p.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + i * 0.07, type: 'spring', stiffness: 300, damping: 26 }}
              className={cx(
                'overflow-hidden rounded-2xl border-2',
                leader
                  ? 'border-sun-400/70 bg-gradient-to-r from-sun-400/20 via-sun-400/8 to-transparent shadow-[0_10px_30px_-12px_rgb(255_181_71/0.6)]'
                  : isMe
                    ? 'border-hot-400/60 bg-hot-500/10'
                    : 'border-white/10 bg-white/5',
              )}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : p.id)}
              >
                <span className={cx('w-8 shrink-0 text-center font-display', i < 3 ? 'text-2xl' : 'text-base text-ink-300')}>
                  {i < 3 && p.score > 0 ? MEDALS[i] : `#${i + 1}`}
                </span>
                <Avatar player={p} size={leader && !compact ? 'md' : 'sm'} showStatus />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-extrabold text-white">{p.nickname}</span>
                    {isMe && <Chip tone="hot" className="shrink-0">Você</Chip>}
                  </span>
                  <span className="block text-xs font-bold text-ink-300">
                    {leader ? '👑 Maior pontuação · ' : ''}🏆 {p.stats.wins} {p.stats.wins === 1 ? 'vitória' : 'vitórias'}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className={cx('font-display leading-none', leader ? 'text-3xl text-sun-400' : 'text-2xl text-white')}>
                    {gained ? <CountUp from={p.score - delta} to={p.score} delay={delay + 0.4 + i * 0.07} /> : p.score}
                    <span className="ml-0.5 text-xs text-ink-300">pts</span>
                  </span>
                  {delta > 0 && (
                    <motion.span
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: delay + 0.5 + i * 0.07 }}
                      className="text-xs font-black text-good-400"
                    >
                      +{delta}
                    </motion.span>
                  )}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.dl
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="grid grid-cols-2 gap-2 overflow-hidden px-3 pb-3 sm:grid-cols-4"
                  >
                    {STAT_LABELS.map(([key, label, icon]) => (
                      <div key={key} className="rounded-xl bg-ink-950/50 px-2.5 py-2">
                        <dt className="text-[11px] font-bold text-ink-300 uppercase">{icon} {label}</dt>
                        <dd className="font-display text-xl text-white">{key === 'score' ? p.score : p.stats[key] ?? 0}</dd>
                      </div>
                    ))}
                  </motion.dl>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </motion.ol>
    </section>
  );
}
