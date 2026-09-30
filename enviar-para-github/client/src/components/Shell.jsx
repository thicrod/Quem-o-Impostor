// Peças da "moldura" do jogo: barra superior, toasts, overlay de reconexão,
// modal de confirmação, espiar a própria carta e região aria-live.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { isSoundEnabled, onSoundChange, playSound, setSoundEnabled } from '../lib/sound.js';
import { Button, Chip, IconButton, Spinner, cx } from './ui.jsx';

export function Logo({ size = 'md' }) {
  const s = size === 'lg' ? 92 : size === 'sm' ? 36 : 56;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true" className="drop-shadow-[0_10px_25px_rgba(255,61,139,0.45)]">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6fb5" />
          <stop offset="0.55" stopColor="#ff3d8b" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path
        d="M4 26c0-6 6-10 13-10 6 0 11 3 15 6 4-3 9-6 15-6 7 0 13 4 13 10 0 12-8 21-17 21-5 0-8-2-11-6-3 4-6 6-11 6C12 47 4 38 4 26z"
        fill="url(#logo-g)"
      />
      <ellipse cx="20" cy="30" rx="6.5" ry="4.8" fill="#0d0927" />
      <ellipse cx="44" cy="30" rx="6.5" ry="4.8" fill="#0d0927" />
      <circle cx="22" cy="29.5" r="2" fill="#3ee0ff" />
      <circle cx="46" cy="29.5" r="2" fill="#3ee0ff" />
      <path d="M26 41q6 3 12 0" stroke="#0d0927" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function SoundToggle({ className }) {
  const enabled = useSyncExternalStore(onSoundChange, isSoundEnabled);
  return (
    <IconButton
      label={enabled ? 'Som ligado (toque para desligar)' : 'Som desligado (toque para ligar)'}
      active={enabled}
      className={className}
      onClick={() => {
        setSoundEnabled(!enabled);
        if (!enabled) setTimeout(() => playSound('click'), 30);
      }}
    >
      <span aria-hidden="true">{enabled ? '🔊' : '🔇'}</span>
      <span className="ml-1 hidden text-xs font-extrabold sm:inline">{enabled ? 'ON' : 'OFF'}</span>
    </IconButton>
  );
}

export function Modal({ open, onClose, title, children, actions }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-end bg-ink-950/70 p-4 backdrop-blur-sm sm:place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="glass-strong w-full max-w-sm rounded-3xl p-5 safe-bottom"
            initial={{ y: 40, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-2xl text-white">{title}</h2>
            <div className="mt-2 text-ink-200">{children}</div>
            <div className="mt-5 grid gap-3">{actions}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Botão "minha carta": segura para espiar a palavra durante a rodada. */
export function MyCardPeek() {
  const room = useRoom();
  const [open, setOpen] = useState(false);
  const card = room?.you?.card;
  if (!card || room.phase === 'result' || room.phase === 'reveal') return null;
  const impostor = card.role === 'impostor';
  return (
    <>
      <IconButton label="Ver minha carta" onClick={() => setOpen(true)}>
        <span aria-hidden="true">🃏</span>
      </IconButton>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Sua carta"
        actions={<Button variant="ghost" size="md" onClick={() => setOpen(false)}>Esconder</Button>}
      >
        <div className={cx('mt-2 rounded-2xl border-2 p-4 text-center', impostor ? 'border-bad-400/60 bg-bad-500/10' : 'border-good-400/60 bg-good-500/10')}>
          <p className={cx('font-display text-xl', impostor ? 'text-bad-400' : 'text-good-400')}>
            {impostor ? '🔴 IMPOSTOR' : '🟢 INOCENTE'}
          </p>
          {card.word ? (
            <p className="mt-1 font-display text-3xl break-words text-white">{card.word}</p>
          ) : (
            <p className="mt-1 text-ink-200">Você não tem palavra. Blefe!</p>
          )}
        </div>
      </Modal>
    </>
  );
}

export function TopBar() {
  const room = useRoom();
  const { actions } = useGame();
  const [confirmLeave, setConfirmLeave] = useState(false);
  if (!room) return null;
  const category = room.game?.category;
  return (
    <header className="safe-top sticky top-0 z-30 -mx-4 mb-2 bg-gradient-to-b from-ink-950/95 via-ink-950/80 to-transparent px-4 pb-3">
      <div className="flex items-center gap-2">
        <Chip tone="default" className="font-mono text-[13px] normal-case tracking-[0.18em]" title="Código da sala">
          <span aria-hidden="true">#</span>
          <span className="sr-only">Sala </span>
          {room.code}
        </Chip>
        {category && room.phase !== 'lobby' && (
          <Chip tone="grape" className="min-w-0 truncate normal-case" title="Categoria da rodada">
            <span aria-hidden="true">{category.emoji}</span> {category.label}
          </Chip>
        )}
        <div className="ml-auto flex items-center gap-2">
          <MyCardPeek />
          <SoundToggle />
          <IconButton label="Sair da sala" onClick={() => setConfirmLeave(true)}>
            <span aria-hidden="true">🚪</span>
          </IconButton>
        </div>
      </div>
      <Modal
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Sair da sala?"
        actions={(
          <>
            <Button variant="danger" size="md" onClick={() => { setConfirmLeave(false); actions.leaveRoom(); }}>
              Sair da sala
            </Button>
            <Button variant="ghost" size="md" onClick={() => setConfirmLeave(false)}>Continuar jogando</Button>
          </>
        )}
      >
        {room.game && room.phase !== 'result'
          ? 'A rodada está em andamento. Se você sair, perde seu lugar e seus pontos nesta sala.'
          : 'Você perde seu lugar e seus pontos nesta sala.'}
      </Modal>
    </header>
  );
}

const TOAST_TONES = {
  info: 'border-sky-400/40',
  join: 'border-good-400/50',
  leave: 'border-white/20',
  host: 'border-sun-400/60',
  warn: 'border-sun-400/50',
  error: 'border-bad-400/60',
};

export function Toasts() {
  const { state, actions } = useGame();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(64px,calc(env(safe-area-inset-top)+56px))] z-40 flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence initial={false}>
        {state.toasts.map((t) => (
          <ToastItem key={t.id} toast={t} dismiss={actions.dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, dismiss }) {
  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), toast.kind === 'error' ? 4500 : 3000);
    return () => clearTimeout(id);
  }, [toast.id, toast.kind, dismiss]);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={cx('glass-strong pointer-events-auto max-w-sm rounded-2xl border-l-4 px-4 py-2.5 text-sm font-bold text-white', TOAST_TONES[toast.kind] || TOAST_TONES.info)}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      onClick={() => dismiss(toast.id)}
    >
      {toast.text}
    </motion.div>
  );
}

export function ConnectionOverlay() {
  const { state, actions } = useGame();
  const show = Boolean(state.room) && state.connection !== 'online';
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center bg-ink-950/80 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-label="Reconectando"
        >
          <div className="glass-strong w-full max-w-xs rounded-3xl p-6 text-center">
            <Spinner className="size-10 text-sky-400" />
            <p className="mt-4 font-display text-2xl text-white">Reconectando…</p>
            <p className="mt-1 text-sm text-ink-200">
              Sua vaga está guardada. Assim que a conexão voltar, você continua de onde parou.
            </p>
            {state.connection === 'offline' && (
              <Button className="mt-4" size="md" variant="secondary" block onClick={actions.reconnectNow}>
                Tentar agora
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Anuncia mudanças importantes para leitores de tela. */
export function LiveAnnouncer({ message }) {
  return (
    <div className="sr-only" aria-live="assertive" aria-atomic="true">
      {message}
    </div>
  );
}

export function SpectatorBanner() {
  return (
    <div className="mb-3 rounded-2xl border border-sky-400/40 bg-sky-400/10 px-4 py-2.5 text-center text-sm font-bold text-sky-400" role="status">
      👀 Você está assistindo esta rodada — entra na próxima!
    </div>
  );
}
