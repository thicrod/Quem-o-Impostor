// 3… 2… 1… e todos os votos aparecem ao mesmo tempo.

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useRoom } from '../hooks/useGame.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { playSound, vibrate } from '../lib/sound.js';
import { Avatar, cx } from '../components/ui.jsx';
import { ReactionBar } from '../components/Reactions.jsx';

const COUNTDOWN_MS = 3000;

const VERDICTS = {
  tie: { title: '⚡ EMPATE!', text: 'Ninguém foi eliminado.' },
  skipped: { title: '⏭️ PULARAM!', text: 'A maioria pulou o voto: ninguém sai.' },
  noVotes: { title: '🤐 NINGUÉM VOTOU', text: 'Sem votos, ninguém sai.' },
};

/** Linha do "pular" (ocupa a largura toda, abaixo dos jogadores). */
function SkipTile({ count, voters, anonymous, top, delay, playerInfo }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 18 }}
      className={cx(
        'col-span-3 flex min-h-14 items-center gap-3 rounded-3xl border-[3px] border-dashed px-4 py-2',
        top ? 'border-sun-400 bg-sun-400/12' : 'border-white/10 bg-white/5',
        count === 0 && 'opacity-60',
      )}
    >
      <span className="text-2xl" aria-hidden="true">⏭️</span>
      <span className="font-extrabold text-white">Pular</span>
      <span className={cx('font-display text-2xl leading-none', top ? 'text-sun-400' : 'text-ink-200')}>
        {count} <span className="text-xs">{count === 1 ? 'voto' : 'votos'}</span>
      </span>
      <span
        className="ml-auto flex flex-wrap justify-end gap-0.5"
        aria-label={anonymous
          ? `${count} ${count === 1 ? 'pulou' : 'pularam'}`
          : `Pularam: ${voters.map((v) => playerInfo(v)?.nickname).join(', ') || 'ninguém'}`}
      >
        {anonymous
          ? Array.from({ length: count }, (_, j) => (
            <span
              key={j}
              className="grid size-7 place-items-center rounded-full bg-sky-400/20 font-display text-sm text-sky-400 ring-2 ring-sky-400/60"
              aria-hidden="true"
            >
              ?
            </span>
          ))
          : voters.map((voterId) => <Avatar key={voterId} player={playerInfo(voterId)} size="xs" />)}
      </span>
    </motion.li>
  );
}

export default function VoteRevealScreen() {
  const room = useRoom();
  const countdown = useCountdown();
  const { game, playerInfo, you } = room;
  const record = game.voteHistory.at(-1);
  const elapsed = countdown ? countdown.durationMs - countdown.remainingMs : COUNTDOWN_MS + 5000;
  // Se reconectar no meio da revelação, pula direto para os votos.
  const number = elapsed < COUNTDOWN_MS ? 3 - Math.floor(elapsed / 1000) : 0;
  const revealed = number === 0;
  const showVerdict = elapsed > COUNTDOWN_MS + 1400;
  const lastNumber = useRef(null);

  useEffect(() => {
    if (number === lastNumber.current) return;
    lastNumber.current = number;
    if (number > 0) playSound('countdown');
    else {
      playSound('go');
      vibrate(50);
    }
  }, [number]);

  const nobodyOut = !record?.eliminatedId;
  useEffect(() => {
    if (showVerdict) playSound(nobodyOut ? 'tie' : 'vote');
  }, [showVerdict, nobodyOut]);

  if (!record) return null;
  const byTarget = {};
  record.votes.forEach((v) => (byTarget[v.targetId] ||= []).push(v.voterId));
  const ordered = [...game.participants].sort((a, b) => (record.tallies[b] || 0) - (record.tallies[a] || 0));
  const skipCount = record.skipCount || 0;
  const max = Math.max(0, skipCount, ...Object.values(record.tallies));
  const eliminated = playerInfo(record.eliminatedId);
  const anonymous = Boolean(game.anonymousVotes);
  const skipTop = skipCount > 0 && skipCount === max;
  const verdict = VERDICTS[record.verdict] || VERDICTS.tie;
  const tieWithSkip = record.verdict === 'tie' && skipTop;

  return (
    <div className="flex flex-1 flex-col pb-8">
      <h1 className="text-center font-display text-4xl text-white text-outline">VOTOS</h1>
      {anonymous && <p className="text-center text-xs font-extrabold tracking-widest text-sky-400 uppercase">🕶️ Votação secreta: só a contagem</p>}

      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="countdown"
            className="flex flex-1 flex-col items-center justify-center py-16"
            exit={{ opacity: 0, scale: 1.4 }}
            aria-live="assertive"
          >
            <p className="text-sm font-extrabold tracking-[0.3em] text-ink-300 uppercase">Revelando em</p>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={number}
                initial={{ scale: 2.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16 }}
                className="font-display text-[9rem] leading-none text-hot-400 text-outline"
              >
                {number}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="votes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 grid gap-3">
            {/* Veredito no topo: visível sem rolar, mesmo em celulares pequenos */}
            <div className="min-h-[104px]">
              <AnimatePresence>
                {showVerdict && (
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                    className={cx(
                      'rounded-3xl border-2 px-4 py-3 text-center',
                      nobodyOut ? 'border-sun-400/70 bg-sun-400/12' : 'border-bad-400/70 bg-bad-500/12',
                    )}
                    role="status"
                  >
                    {nobodyOut ? (
                      <>
                        <p className="font-display text-4xl text-sun-400">{verdict.title}</p>
                        <p className="text-sm text-ink-200">
                          {tieWithSkip ? 'Empate com o “pular”: ninguém sai.' : verdict.text} Mais uma rodada!
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-extrabold tracking-[0.25em] text-ink-300 uppercase">Eliminado</p>
                        <div className="mt-1 flex items-center justify-center gap-3">
                          <Avatar player={eliminated} size="md" />
                          <p className="truncate font-display text-4xl text-white">{eliminated?.nickname}</p>
                        </div>
                        <p className="mt-0.5 text-sm text-ink-200">Será que era o impostor…?</p>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <ul className="grid grid-cols-3 gap-2 sm:gap-3">
              {ordered.map((id, i) => {
                const p = playerInfo(id);
                const count = record.tallies[id] || 0;
                const top = count === max && max > 0;
                return (
                  <motion.li
                    key={id}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ delay: i * 0.08, type: 'spring', stiffness: 220, damping: 18 }}
                    className={cx(
                      'relative flex flex-col items-center gap-1 rounded-3xl border-[3px] px-1.5 py-2.5 text-center',
                      top ? (nobodyOut ? 'border-sun-400 bg-sun-400/12' : 'border-bad-400 bg-bad-500/15') : 'border-white/10 bg-white/5',
                    )}
                  >
                    <Avatar player={p} size="md" />
                    <span className="w-full truncate text-sm font-extrabold text-white">{id === you.id ? 'Você' : p?.nickname}</span>
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 400, damping: 12 }}
                      className={cx('font-display text-2xl leading-none', top ? (nobodyOut ? 'text-sun-400' : 'text-bad-400') : 'text-ink-200')}
                    >
                      {count} <span className="text-xs">{count === 1 ? 'voto' : 'votos'}</span>
                    </motion.span>
                    <span
                      className="flex min-h-7 flex-wrap justify-center gap-0.5"
                      aria-label={anonymous
                        ? `${count} ${count === 1 ? 'voto secreto' : 'votos secretos'}`
                        : `Votaram: ${(byTarget[id] || []).map((v) => playerInfo(v)?.nickname).join(', ') || 'ninguém'}`}
                    >
                      {anonymous
                        ? Array.from({ length: count }, (_, j) => (
                          <motion.span
                            key={j}
                            initial={{ y: -30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 + i * 0.08 + j * 0.06 }}
                            className="grid size-7 place-items-center rounded-full bg-sky-400/20 font-display text-sm text-sky-400 ring-2 ring-sky-400/60"
                            aria-hidden="true"
                          >
                            ?
                          </motion.span>
                        ))
                        : (byTarget[id] || []).map((voterId, j) => (
                          <motion.span
                            key={voterId}
                            initial={{ y: -30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 + i * 0.08 + j * 0.06 }}
                          >
                            <Avatar player={playerInfo(voterId)} size="xs" />
                          </motion.span>
                        ))}
                    </span>
                    {showVerdict && !nobodyOut && id === record.eliminatedId && (
                      <span
                        className="stamp pointer-events-none absolute inset-x-[4%] top-7 rounded-lg border-[3px] border-bad-400 bg-ink-950/70 py-0.5 font-display text-sm tracking-wider text-bad-400"
                        aria-hidden="true"
                      >
                        ELIMINADO
                      </span>
                    )}
                  </motion.li>
                );
              })}
              <SkipTile
                count={skipCount}
                voters={record.skips || []}
                anonymous={anonymous}
                top={skipTop}
                delay={ordered.length * 0.08}
                playerInfo={playerInfo}
              />
            </ul>
            <ReactionBar className="mt-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
