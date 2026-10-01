// Resumo das votações da partida (para a resenha depois do resultado).

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Avatar, Chip, cx } from './ui.jsx';

function Verdict({ rec, playerInfo }) {
  if (rec.eliminatedId) {
    const p = playerInfo(rec.eliminatedId);
    return <Chip tone="bad" className="normal-case">❌ {p?.nickname ?? 'Alguém'} saiu</Chip>;
  }
  if (rec.verdict === 'skipped') return <Chip tone="sky" className="normal-case">⏭️ Pularam</Chip>;
  if (rec.verdict === 'noVotes') return <Chip tone="default" className="normal-case">🤐 Ninguém votou</Chip>;
  return <Chip tone="sun" className="normal-case">⚡ Empate</Chip>;
}

function Who({ id, playerInfo, meId }) {
  const p = playerInfo(id);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar player={p} size="xs" />
      <span className="truncate font-bold text-white">{id === meId ? 'Você' : p?.nickname}</span>
    </span>
  );
}

function Round({ rec, playerInfo, meId, anonymous }) {
  const [open, setOpen] = useState(false);
  const counts = Object.entries(rec.tallies).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const lines = [
    ...rec.votes.map((v) => ({ voterId: v.voterId, targetId: v.targetId })),
    ...(rec.skips || []).map((voterId) => ({ voterId, targetId: null })),
  ];
  return (
    <li className="rounded-2xl bg-white/5 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold tracking-widest text-ink-300 uppercase">Rodada {rec.round}</span>
        <Verdict rec={rec} playerInfo={playerInfo} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {counts.map(([id, n]) => (
          <span
            key={id}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-sm font-extrabold',
              id === rec.eliminatedId ? 'bg-bad-500/20 text-bad-400' : 'bg-ink-950/60 text-white',
            )}
          >
            <Avatar player={playerInfo(id)} size="xs" /> {n}
          </span>
        ))}
        {rec.skipCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-ink-950/60 px-2.5 py-0.5 text-sm font-extrabold text-sky-400">
            ⏭️ {rec.skipCount}
          </span>
        )}
        {counts.length === 0 && !rec.skipCount && <span className="text-sm text-ink-300">Sem votos</span>}
      </div>
      {!anonymous && lines.length > 0 && (
        <>
          <button
            type="button"
            className="mt-1 min-h-10 text-xs font-extrabold text-sky-400"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Esconder votos ▴' : 'Quem votou em quem ▾'}
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="grid gap-1 overflow-hidden text-sm"
              >
                {lines.map((l) => (
                  <li key={l.voterId} className="flex min-w-0 items-center gap-2">
                    <Who id={l.voterId} playerInfo={playerInfo} meId={meId} />
                    <span className="text-ink-300" aria-hidden="true">→</span>
                    {l.targetId ? (
                      <Who id={l.targetId} playerInfo={playerInfo} meId={meId} />
                    ) : (
                      <span className="font-bold text-sky-400">⏭️ pulou</span>
                    )}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </>
      )}
    </li>
  );
}

export function VoteRecap({ game, playerInfo, meId }) {
  if (!game.voteHistory?.length) return null;
  return (
    <section aria-label="Resumo das votações">
      <h2 className="mb-3 font-display text-lg tracking-wide text-ink-200 uppercase">🗳️ Como foram as votações</h2>
      <ol className="grid gap-2">
        {game.voteHistory.map((rec) => (
          <Round key={rec.round} rec={rec} playerInfo={playerInfo} meId={meId} anonymous={game.anonymousVotes} />
        ))}
      </ol>
      {game.anonymousVotes && <p className="mt-2 text-xs font-bold text-ink-300">🕶️ Votação secreta: só a contagem.</p>}
    </section>
  );
}
