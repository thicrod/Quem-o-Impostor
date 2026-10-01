import { forwardRef } from 'react';
import { motion } from 'motion/react';
import { Avatar, Chip, cx } from './ui.jsx';

/** Card de jogador do lobby (entra/sai com animação). */
export const LobbyPlayerCard = forwardRef(function LobbyPlayerCard({ player, isMe, onManage }, ref) {
  const offline = !player.connected;
  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.6, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
      className={cx(
        'relative flex flex-col items-center gap-2 rounded-3xl border-2 px-2 pt-4 pb-3 text-center',
        isMe ? 'border-hot-400/70 bg-hot-500/10' : 'border-white/10 bg-white/5',
      )}
      aria-label={`${player.nickname}${player.isHost ? ', host' : ''}${isMe ? ', você' : ''}, ${offline ? 'desconectado' : 'conectado'}`}
    >
      {player.isHost && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl drop-shadow" title="Host" aria-hidden="true">👑</span>
      )}
      {onManage && (
        <button
          type="button"
          onClick={onManage}
          className="absolute top-1 right-1 grid size-10 place-items-center rounded-full text-xl font-black text-ink-200 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={`Opções de ${player.nickname}`}
          title="Opções do host"
        >
          ⋯
        </button>
      )}
      <Avatar player={player} size="lg" showStatus />
      <p className="w-full truncate px-1 text-base font-extrabold text-white">{player.nickname}</p>
      <div className="flex flex-wrap justify-center gap-1">
        {player.isHost && <Chip tone="sun">Host</Chip>}
        {isMe && <Chip tone="hot">Você</Chip>}
        {offline ? (
          <Chip tone="default" className="text-ink-300">💤 Desconectado</Chip>
        ) : (
          !player.isHost && !isMe && <Chip tone="good">● Online</Chip>
        )}
      </div>
    </motion.li>
  );
});

export function EmptySlot() {
  return (
    <li className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-white/10 text-ink-300">
      <span className="grid size-16 place-items-center rounded-full bg-white/4 text-2xl opacity-60" aria-hidden="true">＋</span>
      <span className="text-sm font-bold">Aguardando…</span>
    </li>
  );
}
