import { useState } from 'react';
import { motion } from 'motion/react';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { Avatar, Button, Chip, cx } from '../components/ui.jsx';
import { TimerRing } from '../components/Timer.jsx';
import { ChatInput, ChatMessages } from '../components/Chat.jsx';
import { ClueList } from '../components/ClueList.jsx';
import { Modal, SpectatorBanner } from '../components/Shell.jsx';
import { PlayerStrip } from '../components/PlayerStrip.jsx';
import { ReactionBar } from '../components/Reactions.jsx';

function ClueStrip({ game, playerInfo }) {
  const [open, setOpen] = useState(false);
  const clues = game.clues;
  return (
    <div className="glass rounded-2xl">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left text-xs font-extrabold tracking-widest text-ink-200 uppercase"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>📝 Pistas ({clues.filter((c) => !c.skipped).length})</span>
        <span aria-hidden="true">{open ? 'Recolher ▴' : 'Ver todas ▾'}</span>
      </button>
      <ul className={cx('gap-1.5 px-3 pb-2.5', open ? 'grid grid-cols-2' : 'no-scrollbar flex overflow-x-auto')}>
        {clues.map((c) => {
          const p = playerInfo(c.playerId);
          return (
            <li key={`${c.pass ?? c.round}-${c.playerId}`} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ink-950/60 py-1 pr-2.5 pl-1">
              <Avatar player={p} size="xs" />
              <span className="max-w-28 truncate text-sm">
                <span className="font-bold text-ink-300">{p?.nickname}:</span>{' '}
                <span className={cx('font-extrabold', c.skipped ? 'text-ink-300 italic' : 'text-white')}>
                  {c.skipped ? '—' : c.text}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Aviso do modo chamada: a conversa acontece por voz, fora do app. */
function CallBanner({ untimed }) {
  return (
    // Em telas baixas (iPhone SE) o aviso some: o subtítulo já diz para falar na chamada.
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 [@media(max-height:720px)]:hidden">
      <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-good-500/15 text-2xl" aria-hidden="true">
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-good-400/60"
          animate={{ scale: [1, 1.35], opacity: [0.8, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut' }}
        />
        📞
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl leading-tight text-white">Conversem na chamada!</p>
        <p className="text-[13px] leading-snug text-ink-200">
          {untimed
            ? 'Sem limite de tempo: a votação abre quando todos estiverem prontos.'
            : 'Quando todos estiverem prontos, a votação abre antes do tempo.'}
        </p>
      </div>
    </div>
  );
}

export default function DiscussionScreen() {
  const room = useRoom();
  const { actions } = useGame();
  const { game, you, playerInfo } = room;
  const [confirmVote, setConfirmVote] = useState(false);
  const [opening, setOpening] = useState(false);
  const readyCount = game.readyIds.length;
  const total = game.participants.length;
  const callMode = game.discussionMode === 'call';
  const untimed = game.discussionSeconds === 0;

  const openVoting = async () => {
    setOpening(true);
    const res = await actions.startVotingNow();
    setOpening(false);
    setConfirmVote(false);
    if (!res.ok) actions.toast(res.message, 'error');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pb-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none text-white text-outline">DISCUSSÃO</h1>
          <p className="mt-1 text-sm text-ink-200">
            {callMode ? 'Quem está blefando? Falem na chamada!' : 'Quem está blefando? Converse e desconfie!'}
          </p>
        </div>
        <TimerRing size={78} format="clock" tick label="Tempo de discussão" whenStopped="∞" />
      </div>

      {!you.isParticipant && <SpectatorBanner />}

      <PlayerStrip room={room} />

      {callMode ? (
        <>
          <CallBanner untimed={untimed} />
          <section className="glass min-h-0 flex-1 overflow-y-auto rounded-3xl p-3" aria-label="Pistas da rodada">
            <h2 className="mb-2 px-1 font-display text-lg tracking-wide text-ink-200 uppercase">📝 Pistas</h2>
            <ClueList game={game} playerInfo={playerInfo} meId={you.id} />
          </section>
        </>
      ) : (
        <>
          <ClueStrip game={game} playerInfo={playerInfo} />
          <ChatMessages className="glass flex-1 rounded-3xl px-2" />
        </>
      )}

      <div className="grid gap-2">
        {callMode && <ReactionBar />}
        {you.isParticipant && (
          <motion.div layout className="flex items-center gap-2">
            <Button
              variant={you.ready ? 'success' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={actions.toggleReady}
              aria-pressed={you.ready}
            >
              {you.ready ? '✓ Pronto para votar' : '✋ Pronto para votar'}
            </Button>
            <Chip tone={readyCount > 0 ? 'good' : 'default'} className="h-11 px-3 text-sm" aria-live="polite">
              {readyCount}/{total} prontos
            </Chip>
          </motion.div>
        )}
        {you.isHost && (
          <Button variant="secondary" size="sm" block onClick={() => setConfirmVote(true)}>
            🗳️ Abrir votação agora
          </Button>
        )}
        {!callMode && (
          <ChatInput disabled={!you.isParticipant} disabledText="👀 Só quem está na rodada pode falar no chat." />
        )}
      </div>

      <Modal
        open={confirmVote}
        onClose={() => setConfirmVote(false)}
        title="Abrir a votação?"
        actions={(
          <>
            <Button size="md" onClick={openVoting} loading={opening}>🗳️ Abrir votação</Button>
            <Button variant="ghost" size="md" onClick={() => setConfirmVote(false)}>Continuar conversando</Button>
          </>
        )}
      >
        Todo mundo vai para a votação agora, mesmo quem ainda não marcou “pronto”.
      </Modal>
    </div>
  );
}
