import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { playSound, vibrate } from '../lib/sound.js';
import { Avatar, Button, Chip, cx } from '../components/ui.jsx';
import { TimerRing } from '../components/Timer.jsx';
import { DoneRow } from '../components/SeenProgress.jsx';
import { cluesByPlayer } from '../components/ClueList.jsx';
import { SpectatorBanner } from '../components/Shell.jsx';
import { MarkBadge } from '../components/PlayerStrip.jsx';
import { useNotes } from '../lib/notes.js';

const SKIP = 'skip';

export default function VotingScreen() {
  const room = useRoom();
  const { actions } = useGame();
  const { game, you, playerInfo } = room;
  const [selected, setSelected] = useState(null);
  const { marks } = useNotes(room);
  const [sending, setSending] = useState(false);
  const voted = you.votedFor;
  const clues = cluesByPlayer(game);
  const tied = new Set(game.tiedIds);
  const target = selected && selected !== SKIP ? playerInfo(selected) : null;
  const skipped = voted === SKIP;
  const skipChosen = (voted || selected) === SKIP;
  const tiedNames = [...tied].map((id) => playerInfo(id)?.nickname).filter(Boolean);

  const confirm = async () => {
    if (!selected) return;
    setSending(true);
    const res = selected === SKIP ? await actions.skipVote() : await actions.castVote(selected);
    setSending(false);
    if (res.ok) {
      playSound('vote');
      vibrate(40);
    } else {
      playSound('error');
      actions.toast(res.message, 'error');
    }
  };

  return (
    <div className="grid gap-4 pb-36">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold tracking-[0.25em] text-hot-400 uppercase">
            Votação · Rodada {game.round}
            {game.anonymousVotes && <span className="ml-2 text-sky-400">· 🕶️ Secreta</span>}
          </p>
          <h1 className="font-display text-[2.1rem] leading-none text-white text-outline sm:text-5xl">QUEM É O IMPOSTOR?</h1>
        </div>
        <TimerRing size={70} tick={!voted && you.isParticipant} label="Tempo para votar" />
      </div>

      {!you.isParticipant && <SpectatorBanner />}

      {tiedNames.length > 0 && (
        <p className="rounded-2xl border border-sun-400/40 bg-sun-400/10 px-4 py-2.5 text-sm font-bold text-sun-400">
          {tiedNames.length === 1
            ? `⚡ ${tiedNames[0]} empatou com o “pular” na votação anterior`
            : `⚡ Empataram na votação anterior: ${tiedNames.join(' e ')}`}
        </p>
      )}

      <AnimatePresence mode="wait">
        {voted ? (
          <motion.div
            key="done"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-3xl border-2 border-good-400/60 bg-good-500/12 px-4 py-3 text-center"
            role="status"
          >
            <p className="font-display text-2xl text-good-400">✓ VOTO CONFIRMADO</p>
            <p className="text-sm text-ink-200">
              {skipped
                ? <>Você <strong className="text-white">pulou</strong> o voto.</>
                : <>Você votou em <strong className="text-white">{playerInfo(voted)?.nickname}</strong>.</>}{' '}
              {game.anonymousVotes ? 'Só a contagem será revelada — seu voto fica em segredo.' : 'Os votos aparecem juntos no final.'}
            </p>
          </motion.div>
        ) : you.isParticipant ? (
          <motion.p key="choose" className="text-center font-display text-xl text-ink-200" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            👇 Escolha um jogador ou pule
          </motion.p>
        ) : null}
      </AnimatePresence>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Jogadores para votar">
        {game.participants.map((id, i) => {
          const p = playerInfo(id);
          const isMe = id === you.id;
          const chosen = (voted || selected) === id;
          const disabled = isMe || Boolean(voted) || !you.isParticipant;
          return (
            <motion.li
              key={id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <motion.button
                type="button"
                role="radio"
                aria-checked={chosen}
                aria-label={`${p?.nickname}${isMe ? ' (você)' : ''}. Pistas: ${(clues[id] || []).join(', ') || 'nenhuma'}`}
                disabled={disabled}
                whileTap={disabled ? undefined : { scale: 0.95 }}
                onClick={() => {
                  setSelected(id);
                  playSound('click');
                }}
                className={cx(
                  'relative flex h-full w-full flex-col items-center gap-1.5 rounded-3xl border-[3px] px-2 pt-4 pb-3 text-center transition-colors',
                  chosen
                    ? 'border-hot-400 bg-hot-500/20 shadow-glow-hot'
                    : 'border-white/10 bg-white/5 enabled:hover:border-white/30',
                  isMe && 'opacity-50',
                  tied.has(id) && !chosen && 'border-sun-400/60',
                )}
              >
                {chosen && (
                  <motion.span
                    layoutId="vote-mark"
                    className="absolute -top-3 right-3 rounded-full bg-hot-500 px-2.5 py-0.5 text-xs font-black text-white"
                  >
                    {voted ? 'SEU VOTO' : 'ESCOLHIDO'}
                  </motion.span>
                )}
                <MarkBadge mark={marks[id]} className="absolute top-2 left-2" />
                <Avatar player={p} size="lg" showStatus />
                <span className="w-full truncate text-lg font-extrabold text-white">{p?.nickname}</span>
                {isMe && <Chip tone="hot">Você</Chip>}
                <span className="flex flex-wrap justify-center gap-1">
                  {(clues[id] || []).map((c, idx) => (
                    <span key={idx} className="rounded-lg bg-ink-950/60 px-2 py-0.5 text-xs font-bold text-ink-100">{c}</span>
                  ))}
                </span>
              </motion.button>
            </motion.li>
          );
        })}
        {/* Pular: se o "pular" vencer ou empatar no topo, ninguém sai e rola outra rodada */}
        <motion.li
          className="col-span-2 sm:col-span-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: game.participants.length * 0.05 }}
        >
          <motion.button
            type="button"
            role="radio"
            aria-checked={skipChosen}
            aria-label="Pular voto. Se o pular ganhar ou empatar, ninguém sai e rola outra rodada."
            disabled={Boolean(voted) || !you.isParticipant}
            whileTap={voted || !you.isParticipant ? undefined : { scale: 0.97 }}
            onClick={() => {
              setSelected(SKIP);
              playSound('click');
            }}
            className={cx(
              'relative flex min-h-16 w-full items-center gap-3 rounded-3xl border-[3px] border-dashed px-4 py-2.5 text-left transition-colors',
              skipChosen ? 'border-sky-400 bg-sky-400/15 shadow-glow-sky' : 'border-white/15 bg-white/4 enabled:hover:border-white/30',
            )}
          >
            {skipChosen && (
              <motion.span
                layoutId="vote-mark"
                className="absolute -top-3 right-3 rounded-full bg-sky-400 px-2.5 py-0.5 text-xs font-black text-ink-950"
              >
                {voted ? 'SEU VOTO' : 'ESCOLHIDO'}
              </motion.span>
            )}
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/8 text-2xl" aria-hidden="true">⏭️</span>
            <span className="min-w-0">
              <span className="block font-display text-xl text-white">Pular voto</span>
              <span className="block text-xs text-ink-300">Se o “pular” ganhar ou empatar, ninguém sai e rola outra rodada.</span>
            </span>
          </motion.button>
        </motion.li>
      </ul>

      <div className="glass rounded-3xl p-4">
        <DoneRow ids={game.participants} doneIds={game.votedIds} playerInfo={playerInfo} label="Já votaram:" />
      </div>

      {you.isParticipant && !voted && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent px-4 pt-6 safe-bottom">
          <div className="mx-auto max-w-md">
            <Button size="xl" block disabled={!selected} loading={sending} onClick={confirm}>
              {target ? `Votar em ${target.nickname}` : selected === SKIP ? '⏭️ Pular voto' : 'Escolha um jogador ou pule'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
