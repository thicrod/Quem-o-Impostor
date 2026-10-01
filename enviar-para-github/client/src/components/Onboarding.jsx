// Tutorial rápido: aparece na primeira visita e pode ser reaberto em Ajustes.

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { getPrefs, setPref } from '../lib/prefs.js';
import { setUi, useUi } from '../lib/uiStore.js';
import { playSound } from '../lib/sound.js';
import { Button, cx } from './ui.jsx';

const SLIDES = [
  { icon: '🎭', title: 'Bem-vindo!', text: 'Um jogo de blefe para 3 a 6 amigos, cada um no seu celular. Uma rodada dura poucos minutos.' },
  { icon: '🃏', title: 'Todos recebem uma palavra…', text: '…menos o impostor! Ele não sabe a palavra (ou recebe uma parecida) e precisa fingir.' },
  { icon: '💬', title: 'Dê UMA palavra de pista', text: 'Nem óbvia demais (o impostor descobre), nem vaga demais (vão desconfiar de você).' },
  { icon: '🕵️', title: 'Conversem e votem', text: 'Falem na chamada (ou no chat): quem parece não saber a palavra? Dá para pular o voto. Se ninguém sair, rola mais uma rodada.' },
  { icon: '🚨', title: 'Última chance', text: 'Se o impostor for pego, ainda pode roubar a vitória adivinhando a palavra em 20 segundos!' },
];

export function Onboarding() {
  const { tutorialOpen } = useUi();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);

  // Primeira visita: abre sozinho.
  useEffect(() => {
    if (!getPrefs().onboarded) setUi({ tutorialOpen: true });
  }, []);

  const close = () => {
    setPref('onboarded', true);
    setUi({ tutorialOpen: false });
    setIndex(0);
  };

  const go = (next) => {
    if (next < 0) return;
    if (next >= SLIDES.length) {
      close();
      return;
    }
    playSound('click');
    setDir(next > index ? 1 : -1);
    setIndex(next);
  };

  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <AnimatePresence>
      {tutorialOpen && (
        <motion.div
          className="fixed inset-0 z-[70] grid place-items-center bg-ink-950/85 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Como jogar"
            className="glass-strong w-full max-w-sm overflow-hidden rounded-[2rem] p-6 text-center"
            initial={{ y: 40, scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.95 }}
          >
            <div className="flex justify-end">
              <button type="button" onClick={close} className="min-h-11 rounded-full px-3 text-sm font-bold text-ink-300 hover:text-white">
                Pular
              </button>
            </div>
            <div className="relative h-64 overflow-hidden">
              <AnimatePresence mode="popLayout" custom={dir} initial={false}>
                <motion.div
                  key={index}
                  custom={dir}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                  initial={{ x: dir * 120, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: dir * -120, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.4}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -60) go(index + 1);
                    else if (info.offset.x > 60) go(index - 1);
                  }}
                >
                  <motion.span
                    className="text-7xl"
                    initial={{ scale: 0.5, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                    aria-hidden="true"
                  >
                    {slide.icon}
                  </motion.span>
                  <h2 className="font-display text-3xl text-white">{slide.title}</h2>
                  <p className="max-w-xs text-ink-200">{slide.text}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-2 flex justify-center gap-2" aria-hidden="true">
              {SLIDES.map((s, i) => (
                <span key={s.title} className={cx('h-2 rounded-full transition-all', i === index ? 'w-6 bg-hot-400' : 'w-2 bg-white/20')} />
              ))}
            </div>
            <p className="sr-only" aria-live="polite">Passo {index + 1} de {SLIDES.length}</p>
            <div className="mt-5 grid grid-cols-[auto_1fr] gap-3">
              <Button variant="ghost" size="md" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Voltar">
                ←
              </Button>
              <Button size="md" onClick={() => go(index + 1)}>
                {last ? 'Bora jogar! 🎉' : 'Próximo →'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
