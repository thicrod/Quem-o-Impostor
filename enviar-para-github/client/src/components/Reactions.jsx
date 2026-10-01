// Reações rápidas: emojis que flutuam na tela de todo mundo da sala.
// ReactionLayer mostra (montado uma vez no App); ReactionBar envia.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { request, socket } from '../lib/socket.js';
import { playSound, vibrate } from '../lib/sound.js';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { Avatar, cx } from './ui.jsx';

const DEFAULT_REACTIONS = ['😂', '🤔', '🤨', '😱', '🤡', '👏'];
const MAX_ON_SCREEN = 14;
const LIFETIME_MS = 2600;

export function ReactionLayer() {
  const room = useRoom();
  const [items, setItems] = useState([]);
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    const timers = new Set();
    const onReaction = ({ id, playerId, emoji }) => {
      const current = roomRef.current;
      if (!current) return;
      const player = current.playerInfo(playerId);
      const mine = playerId === current.you?.id;
      if (!mine) playSound('pop');
      setItems((list) => [
        ...list.slice(-(MAX_ON_SCREEN - 1)),
        { id, emoji, player, mine, x: 8 + Math.random() * 74, drift: (Math.random() - 0.5) * 60 },
      ]);
      // setTimeout (e não o fim da animação) para limpar mesmo com a aba em segundo plano
      const t = setTimeout(() => {
        timers.delete(t);
        setItems((list) => list.filter((it) => it.id !== id));
      }, LIFETIME_MS);
      timers.add(t);
    };
    socket.on('reaction', onReaction);
    return () => {
      socket.off('reaction', onReaction);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!room) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[35] overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {items.map((it) => (
          <motion.div
            key={it.id}
            className="absolute bottom-[14dvh] flex flex-col items-center"
            style={{ left: `${it.x}%` }}
            initial={{ y: 0, x: 0, opacity: 0, scale: 0.5 }}
            animate={{ y: '-48dvh', x: it.drift, opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 0.9] }}
            exit={{ opacity: 0 }}
            transition={{ duration: LIFETIME_MS / 1000, ease: 'easeOut', times: [0, 0.15, 0.7, 1] }}
          >
            <span className="text-5xl drop-shadow-[0_6px_14px_rgb(0_0_0/0.45)]">{it.emoji}</span>
            {it.player && (
              <span className="-mt-1 flex items-center gap-1 rounded-full bg-ink-950/75 py-0.5 pr-2 pl-0.5 text-[11px] font-extrabold text-white">
                <Avatar player={it.player} size="xs" />
                {it.mine ? 'Você' : it.player.nickname}
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Fileira de botões de reação (com um freio para não virar spam). */
export function ReactionBar({ className, label = 'Reagir' }) {
  const { state } = useGame();
  const [cooling, setCooling] = useState(false);
  const last = useRef(-Infinity);
  const reactions = state.meta?.reactions || DEFAULT_REACTIONS;

  // `at` = horário do clique (event.timeStamp, em ms)
  const send = async (emoji, at) => {
    if (cooling || at - last.current < 300) return;
    last.current = at;
    vibrate(10);
    const res = await request('reaction:send', { emoji });
    if (res.code === 'RATE_LIMITED') {
      setCooling(true);
      setTimeout(() => setCooling(false), 1200);
    }
  };

  return (
    <div className={cx('flex items-center justify-center gap-1.5', className)} role="group" aria-label={label}>
      {reactions.map((emoji) => (
        <motion.button
          key={emoji}
          type="button"
          whileTap={{ scale: 0.8, rotate: -8 }}
          onClick={(e) => send(emoji, e.timeStamp)}
          disabled={cooling}
          aria-label={`Reagir com ${emoji}`}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/6 text-2xl transition-[opacity,background-color] hover:bg-white/12 disabled:opacity-40"
        >
          {emoji}
        </motion.button>
      ))}
    </div>
  );
}
