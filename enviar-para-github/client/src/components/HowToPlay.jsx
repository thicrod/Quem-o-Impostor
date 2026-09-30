import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cx } from './ui.jsx';

const STEPS = [
  ['🃏', 'Veja sua carta', 'Todos recebem a palavra secreta — menos o impostor, que precisa blefar.'],
  ['💬', 'Dê uma pista', 'Na sua vez, mande UMA palavra relacionada. Nem óbvia demais, nem vaga demais!'],
  ['🕵️', 'Discuta', 'Troquem ideias no chat e descubram quem parece não saber a palavra.'],
  ['🗳️', 'Vote', 'Eliminem o suspeito. Se for o impostor, ele ainda pode roubar a vitória adivinhando a palavra.'],
];

export function HowToPlay({ className, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cx('glass rounded-3xl', className)}>
      <button
        type="button"
        className="flex min-h-13 w-full items-center justify-between gap-3 px-5 py-3 text-left font-display text-lg tracking-wide text-ink-100 uppercase"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>❓ Como jogar</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} aria-hidden="true">⌄</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-5"
          >
            {STEPS.map(([icon, title, text], i) => (
              <li key={title} className="flex gap-3 pb-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/8 text-xl" aria-hidden="true">{icon}</span>
                <div>
                  <p className="font-extrabold text-white">{i + 1}. {title}</p>
                  <p className="text-sm text-ink-200">{text}</p>
                </div>
              </li>
            ))}
            <li className="pb-4 text-sm text-ink-300">
              Pontos: grupo acerta o impostor = +2 para cada inocente · impostor escapa = +3 · impostor eliminado que adivinha a palavra = +2.
            </li>
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}
