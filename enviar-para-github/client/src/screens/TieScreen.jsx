// Ninguém saiu na votação (empate, "pular" venceu ou ninguém votou):
// mais uma rodada de pistas + discussão + votação, sem limite de rodadas.

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useRoom } from '../hooks/useGame.jsx';
import { playSound } from '../lib/sound.js';
import { Avatar, Chip } from '../components/ui.jsx';
import { TimerBar } from '../components/Timer.jsx';
import { ReactionBar } from '../components/Reactions.jsx';

const TITLES = {
  tie: '⚡ EMPATE!',
  skipped: '⏭️ NINGUÉM SAIU',
  noVotes: '🤐 NINGUÉM VOTOU',
};

function SkipBadge() {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="grid size-22 place-items-center rounded-full border-[3px] border-dashed border-white/30 bg-white/6 text-5xl" aria-hidden="true">
        ⏭️
      </span>
      <span className="font-extrabold text-white">Pular</span>
    </div>
  );
}

export default function TieScreen() {
  const room = useRoom();
  const { game, playerInfo } = room;
  const last = game.voteHistory.at(-1);
  const verdict = last?.verdict || 'tie';
  const tied = game.tiedIds.map(playerInfo).filter(Boolean);
  // Empate de um jogador com o "pular" (ex.: 2 votos em Ana x 2 pulos)
  const withSkip = verdict === 'tie' && tied.length === 1;

  useEffect(() => {
    playSound('tie');
  }, []);

  let quote = '“Os jogadores empatados terão que se explicar novamente.”';
  if (withSkip) quote = `“${tied[0].nickname}, convença a galera na próxima rodada!”`;
  if (verdict === 'skipped') quote = '“Ninguém tem certeza… prestem atenção nas próximas pistas!”';
  if (verdict === 'noVotes') quote = '“Sem votos, sem eliminação.”';

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <motion.p
        initial={{ scale: 0.3, rotate: -8, opacity: 0 }}
        animate={{ scale: [0.3, 1.15, 1], rotate: [-8, 4, 0], opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="font-display text-[3.4rem] leading-none text-sun-400 sm:text-7xl"
        style={{ textShadow: '0 0 30px rgb(255 181 71 / 0.6), 0 4px 0 rgb(0 0 0 / 0.4)' }}
      >
        {TITLES[verdict] || TITLES.tie}
      </motion.p>

      {verdict === 'tie' && tied.length > 0 && (
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
          {withSkip && (
            <div className="flex items-center gap-4">
              <span className="font-display text-2xl text-ink-300">VS</span>
              <motion.div
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6, type: 'spring', stiffness: 250, damping: 16 }}
              >
                <SkipBadge />
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
      {verdict === 'skipped' && (
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 14 }}>
          <SkipBadge />
          <p className="mt-2 text-sm font-bold text-ink-200">A maioria pulou o voto ({last.skipCount})</p>
        </motion.div>
      )}
      {verdict === 'noVotes' && <p className="text-lg font-bold text-ink-200">Ninguém votou! 🤷</p>}

      <p className="max-w-xs text-lg text-ink-100">{quote}</p>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-bold text-ink-300">Nova rodada de pistas, discussão e votação</p>
        <Chip tone="hot" className="px-4 py-1 text-base">Rodada {game.round + 1}</Chip>
      </div>
      <TimerBar className="max-w-xs" />
      <ReactionBar />
    </div>
  );
}
