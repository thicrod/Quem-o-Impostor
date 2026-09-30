import { useState } from 'react';
import { motion } from 'motion/react';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { Avatar, Button, Chip, cx } from '../components/ui.jsx';
import { TimerRing } from '../components/Timer.jsx';
import { ChatInput, ChatMessages } from '../components/Chat.jsx';
import { SpectatorBanner } from '../components/Shell.jsx';

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
            <li key={`${c.round}-${c.playerId}`} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ink-950/60 py-1 pr-2.5 pl-1">
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

export default function DiscussionScreen() {
  const room = useRoom();
  const { actions } = useGame();
  const { game, you, playerInfo } = room;
  const readyCount = game.readyIds.length;
  const total = game.participants.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pb-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none text-white text-outline">DISCUSSÃO</h1>
          <p className="mt-1 text-sm text-ink-200">Quem está blefando? Converse e desconfie!</p>
        </div>
        <TimerRing size={78} format="clock" tick label="Tempo de discussão" />
      </div>

      {!you.isParticipant && <SpectatorBanner />}
      <ClueStrip game={game} playerInfo={playerInfo} />

      <ChatMessages className="glass flex-1 rounded-3xl px-2" />

      <div className="grid gap-2">
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
        <ChatInput disabled={!you.isParticipant} disabledText="👀 Só quem está na rodada pode falar no chat." />
      </div>
    </div>
  );
}
