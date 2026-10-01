// "Destaques da sala": títulos divertidos calculados das estatísticas da sessão.

import { motion } from 'motion/react';
import { Avatar } from './ui.jsx';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const AWARDS = [
  { key: 'matchesWon', icon: '👑', title: 'Rei da sala', value: (s) => s.matchesWon, text: (n) => `venceu ${plural(n, 'partida', 'partidas')}` },
  { key: 'detective', icon: '🕵️', title: 'Detetive', value: (s) => s.impostorsFound, text: (n) => `achou o impostor ${plural(n, 'vez', 'vezes')}` },
  { key: 'disguise', icon: '🎭', title: 'Mestre do disfarce', value: (s) => s.escapes, text: (n) => `escapou ${plural(n, 'vez', 'vezes')} como impostor` },
  { key: 'thief', icon: '🦹', title: 'Ladrão de vitória', value: (s) => s.steals, text: (n) => `adivinhou a palavra ${plural(n, 'vez', 'vezes')}` },
  { key: 'scapegoat', icon: '🐑', title: 'Bode expiatório', value: (s) => s.framed ?? 0, text: (n) => `saiu inocente ${plural(n, 'vez', 'vezes')}` },
  { key: 'sus', icon: '😈', title: 'Cara de impostor', value: (s) => s.timesImpostor, text: (n) => `foi impostor ${plural(n, 'vez', 'vezes')}` },
];

/** Quem lidera cada destaque (empates: todos que empataram, até 3). */
export function computeAwards(players) {
  const list = [];
  for (const award of AWARDS) {
    const best = Math.max(0, ...players.map((p) => award.value(p.stats)));
    if (best < 1) continue;
    const all = players.filter((p) => award.value(p.stats) === best);
    list.push({ ...award, best, winners: all.slice(0, 3), extra: Math.max(0, all.length - 3) });
  }
  return list;
}

export function Awards({ players, meId }) {
  const awards = computeAwards(players);
  if (awards.length === 0) return null;
  return (
    <section aria-label="Destaques da sala">
      <h2 className="mb-3 font-display text-lg tracking-wide text-ink-200 uppercase">✨ Destaques da sala</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {awards.map((a, i) => (
          <motion.li
            key={a.key}
            initial={{ opacity: 0, y: 14, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.07, type: 'spring', stiffness: 300, damping: 20 }}
            className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-center"
          >
            <span className="text-3xl" aria-hidden="true">{a.icon}</span>
            <span className="font-display text-base leading-tight text-sun-400">{a.title}</span>
            <span className="flex -space-x-1.5">
              {a.winners.map((p) => <Avatar key={p.id} player={p} size="xs" />)}
            </span>
            <span className="line-clamp-2 w-full text-sm leading-tight font-extrabold break-words text-white">
              {a.winners.map((p) => (p.id === meId ? 'Você' : p.nickname)).join(', ')}
              {a.extra > 0 && <span className="text-ink-300"> +{a.extra}</span>}
            </span>
            <span className="text-[11px] font-bold text-ink-300">{a.text(a.best)}</span>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
