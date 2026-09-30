import { useState } from 'react';
import { motion } from 'motion/react';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { playSound, vibrate } from '../lib/sound.js';
import { Button, Chip, cx } from '../components/ui.jsx';
import { TimerBar } from '../components/Timer.jsx';
import { DoneRow } from '../components/SeenProgress.jsx';
import { Logo, SpectatorBanner } from '../components/Shell.jsx';

function CardFace({ card, category }) {
  const impostor = card.role === 'impostor';
  return (
    <div
      className={cx(
        'absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[2rem] border-4 p-6 text-center backface-hidden',
        impostor
          ? 'border-bad-400 bg-[radial-gradient(circle_at_50%_20%,#4a0f24,#1a0820_70%)] shadow-glow-bad'
          : 'border-good-400 bg-[radial-gradient(circle_at_50%_20%,#0f3d33,#0b1a26_70%)] shadow-glow-good',
      )}
      style={{ transform: 'rotateY(180deg)' }}
    >
      <span className="text-5xl" aria-hidden="true">{impostor ? '🔴' : '🟢'}</span>
      <p className={cx('font-display text-4xl tracking-wide', impostor ? 'text-bad-400' : 'text-good-400')}>
        {impostor ? 'IMPOSTOR' : 'INOCENTE'}
      </p>
      {impostor ? (
        <>
          <p className="font-display text-2xl text-white">VOCÊ É O IMPOSTOR</p>
          {card.word ? (
            <div className="mt-1 rounded-2xl bg-white/8 px-4 py-3">
              <p className="text-xs font-extrabold tracking-widest text-ink-300 uppercase">Sua palavra</p>
              <p className="font-display text-3xl break-words text-white">{card.word}</p>
              <p className="mt-1 text-xs text-ink-200">Os outros têm uma palavra parecida. Disfarce!</p>
            </div>
          ) : (
            <p className="text-sm text-ink-200">Você não sabe a palavra. Preste atenção nas pistas e blefe!</p>
          )}
        </>
      ) : (
        <>
          <p className="text-xs font-extrabold tracking-widest text-ink-300 uppercase">Sua palavra é:</p>
          <p data-testid="card-word" className="font-display text-[2.6rem] leading-none break-words text-white">{card.word}</p>
          <p className="text-sm text-ink-200">Dê pistas sem entregar a palavra para o impostor.</p>
        </>
      )}
      <Chip tone="grape" className="mt-1 normal-case">{category?.emoji} {category?.label}</Chip>
    </div>
  );
}

export default function RevealScreen() {
  const room = useRoom();
  const { actions } = useGame();
  const [flipped, setFlipped] = useState(false);
  const [everSeen, setEverSeen] = useState(false);
  const [sending, setSending] = useState(false);
  const { game, you } = room;
  const card = you.card;
  const confirmed = you.seen;

  const toggle = () => {
    if (!card) return;
    const next = !flipped;
    setFlipped(next);
    if (next) {
      setEverSeen(true);
      playSound('reveal');
      vibrate(card.role === 'impostor' ? [60, 40, 60] : 30);
    }
  };

  const confirm = async () => {
    setSending(true);
    setFlipped(false);
    const res = await actions.markSeen();
    setSending(false);
    if (!res.ok) actions.toast(res.message, 'error');
  };

  return (
    <div className="flex flex-1 flex-col items-center pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center">
        <p className="text-xs font-extrabold tracking-[0.25em] text-sky-400 uppercase">Rodada {game.number}</p>
        <h1 className="font-display text-4xl text-white text-outline">SUA CARTA</h1>
        <p className="mt-1 text-sm text-ink-200">
          {game.randomCategory ? '🎲 Categoria sorteada: ' : 'Categoria: '}
          <strong className="text-white">{game.category.emoji} {game.category.label}</strong>
        </p>
        <TimerBar className="mx-auto mt-3 max-w-xs" />
      </motion.div>

      {!you.isParticipant && <div className="mt-4 w-full"><SpectatorBanner /></div>}

      {card && (
        <div className="perspective mt-5 w-full" style={{ maxWidth: 'min(300px, 40dvh)' }}>
          <motion.button
            type="button"
            onClick={toggle}
            disabled={confirmed}
            aria-label={flipped ? 'Esconder carta' : 'Toque para revelar sua carta'}
            aria-pressed={flipped}
            className="preserve-3d relative block aspect-[3/4] w-full rounded-[2rem]"
            initial={{ y: 60, opacity: 0, rotate: -6 }}
            animate={{ y: 0, opacity: 1, rotate: 0, rotateY: flipped ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            whileTap={{ scale: 0.97 }}
          >
            {/* Verso (fechada) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[2rem] border-4 border-hot-400/80 bg-[radial-gradient(circle_at_30%_20%,#3b1d7a,#150d3b_65%)] shadow-glow-hot backface-hidden">
              <div
                className="absolute inset-0 opacity-20"
                style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0 2px, transparent 2px 18px)' }}
                aria-hidden="true"
              />
              <div className="animate-float"><Logo size="lg" /></div>
              <p className="relative font-display text-2xl text-white">
                {confirmed ? 'CARTA GUARDADA' : 'TOQUE PARA REVELAR'}
              </p>
              <p className="relative px-6 text-center text-xs font-bold text-ink-200">
                {confirmed ? 'Use 🃏 no topo para espiar de novo' : 'Não deixe ninguém ver sua tela 👀'}
              </p>
            </div>
            <CardFace card={card} category={game.category} />
          </motion.button>
        </div>
      )}

      <div className="mt-auto w-full max-w-sm pt-6">
        {card && !confirmed && (
          <Button size="xl" variant="success" block disabled={!everSeen} loading={sending} onClick={confirm}>
            ✓ Toquei e vi
          </Button>
        )}
        {card && !confirmed && !everSeen && (
          <p className="mt-2 text-center text-sm font-bold text-ink-300">Revele a carta para continuar</p>
        )}
        {(confirmed || !card) && (
          <div className="glass rounded-3xl p-4">
            <DoneRow
              ids={game.participants}
              doneIds={game.seenIds}
              playerInfo={room.playerInfo}
              label="Aguardando todos verem a carta…"
            />
          </div>
        )}
      </div>
    </div>
  );
}
