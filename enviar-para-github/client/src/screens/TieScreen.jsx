import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useRoom } from '../hooks/useGame.jsx';
import { playSound } from '../lib/sound.js';
import { Avatar, Chip } from '../components/ui.jsx';
import { TimerBar } from '../components/Timer.jsx';

export default function TieScreen() {
  const room = useRoom();
  const { game, playerInfo } = room;
  const tied = game.tiedIds.map(playerInfo).filter(Boolean);

  useEffect(() => {
    playSound('tie');
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <motion.p
        initial={{ scale: 0.3, rotate: -8, opacity: 0 }}
        animate={{ scale: [0.3, 1.15, 1], rotate: [-8, 4, 0], opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="font-display text-7xl text-sun-400"
        style={{ textShadow: '0 0 30px rgb(255 181 71 / 0.6), 0 4px 0 rgb(0 0 0 / 0.4)' }}
      >
        ⚡ EMPATE!
      </motion.p>

      {tied.length > 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex flex-wrap items-center justify-center gap-4">
          {tied.map((p, i) => (
            <div key={p.id} className="flex items-center gap-4">
              {i > 0 && <span className="font-display text-2xl text-ink-300">VS</span>}
              <motion.div
                initial={{ x: i % 2 ? 60 : -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 250, damping: 16 }}
                className="flex flex-col items-center gap-2"
              >
                <Avatar player={p} size="xl" />
                <span className="font-extrabold text-white">{p.nickname}</span>
              </motion.div>
            </div>
          ))}
        </motion.div>
      ) : (
        <p className="text-lg font-bold text-ink-200">Ninguém votou! 🤷</p>
      )}

      <p className="max-w-xs text-lg text-ink-100">
        {tied.length > 0
          ? '“Os jogadores empatados terão que se explicar novamente.”'
          : 'Sem votos, sem eliminação.'}
      </p>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-bold text-ink-300">Nova rodada de pistas, discussão e votação</p>
        <Chip tone="hot" className="px-4 py-1 text-base">Rodada {game.round + 1}/{game.maxRounds}</Chip>
        {game.round + 1 === game.maxRounds && (
          <p className="max-w-xs text-xs font-bold text-sun-400">
            Última chance: se empatar de novo, o impostor escapa!
          </p>
        )}
      </div>
      <TimerBar className="max-w-xs" />
    </div>
  );
}
