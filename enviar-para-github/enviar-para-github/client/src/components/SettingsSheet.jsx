// Ajustes pessoais (valem só neste aparelho): tema, som, música, vibração,
// instalar como app e rever o tutorial. Abre pelo botão ⚙️.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { THEMES, setPref, usePrefs } from '../lib/prefs.js';
import { isSoundEnabled, onSoundChange, playSound, setSoundEnabled, vibrate } from '../lib/sound.js';
import { setUi, useUi } from '../lib/uiStore.js';
import { useInstall } from '../lib/install.js';
import { Button, IconButton, cx } from './ui.jsx';

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function SettingsButton({ className }) {
  return (
    <IconButton label="Ajustes" className={className} onClick={() => { playSound('click'); setUi({ settingsOpen: true }); }}>
      <span aria-hidden="true">⚙️</span>
    </IconButton>
  );
}

function Toggle({ icon, label, hint, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-left transition-colors hover:bg-white/10"
    >
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold text-white">{label}</span>
        {hint && <span className="block text-xs text-ink-300">{hint}</span>}
      </span>
      <span
        className={cx('relative h-8 w-14 shrink-0 rounded-full transition-colors', checked ? 'bg-good-500' : 'bg-white/15')}
        aria-hidden="true"
      >
        <motion.span
          className="absolute top-1 size-6 rounded-full bg-white shadow-md"
          animate={{ left: checked ? 28 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </span>
    </button>
  );
}

function ThemePicker({ value }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema de cores">
      {THEMES.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => { setPref('theme', t.key); playSound('click'); vibrate(8); }}
            className={cx(
              'group flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2 transition-all',
              active ? 'border-white bg-white/10' : 'border-white/10 bg-white/4 hover:border-white/30',
            )}
          >
            <span
              className="relative block h-11 w-full overflow-hidden rounded-xl"
              style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }}
              aria-hidden="true"
            >
              <span className="absolute right-1.5 bottom-1.5 size-4 rounded-full ring-2 ring-white/70" style={{ background: t.colors[2] }} />
              {active && <span className="absolute inset-0 grid place-items-center text-lg">✓</span>}
            </span>
            <span className={cx('text-xs font-extrabold', active ? 'text-white' : 'text-ink-200')}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function InstallBlock() {
  const inst = useInstall();
  const { installHelpOpen } = useUi();
  const [iosHelp, setIosHelp] = useState(installHelpOpen);
  if (inst.standalone) {
    return <p className="rounded-2xl bg-good-500/12 px-4 py-3 text-sm font-bold text-good-400">✅ Você está usando o app instalado.</p>;
  }
  if (!inst.available) {
    return (
      <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-ink-300">
        Para instalar, abra este site no Chrome (Android) ou no Safari (iPhone).
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      <Button
        variant="secondary"
        size="md"
        block
        onClick={async () => {
          const r = await inst.install();
          if (r === 'manual') setIosHelp((v) => !v);
        }}
      >
        <span aria-hidden="true">📲</span> Instalar na tela inicial
      </Button>
      <AnimatePresence initial={false}>
        {iosHelp && (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-2xl bg-white/5 px-4 text-sm text-ink-100"
          >
            <li className="pt-3">1. Toque em <b>Compartilhar</b> <span aria-hidden="true">(□↑)</span> na barra do Safari.</li>
            <li className="pt-1">2. Escolha <b>Adicionar à Tela de Início</b>.</li>
            <li className="py-1 pb-3">3. Toque em <b>Adicionar</b>. Pronto: abre em tela cheia, como um app!</li>
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}

const close = () => setUi({ settingsOpen: false, installHelpOpen: false });

export function SettingsSheet() {
  const { settingsOpen } = useUi();
  const prefs = usePrefs();
  const sound = useSyncExternalStore(onSoundChange, isSoundEnabled);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          className="fixed inset-0 z-[65] grid place-items-end bg-ink-950/75 backdrop-blur-sm sm:place-items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Ajustes"
            className="glass-strong max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] p-5 safe-bottom sm:rounded-[2rem]"
            initial={{ y: 60, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-3xl text-white">⚙️ Ajustes</h2>
              <IconButton label="Fechar ajustes" onClick={close}><span aria-hidden="true">✕</span></IconButton>
            </div>

            <h3 className="mt-5 mb-2 font-display text-sm tracking-wide text-ink-300 uppercase">🎨 Tema</h3>
            <ThemePicker value={prefs.theme} />

            <h3 className="mt-5 mb-2 font-display text-sm tracking-wide text-ink-300 uppercase">🔊 Som</h3>
            <div className="grid gap-2">
              <Toggle
                icon={sound ? '🔊' : '🔇'}
                label="Efeitos sonoros"
                hint="Cliques, votos, revelações"
                checked={sound}
                onChange={(v) => { setSoundEnabled(v); if (v) setTimeout(() => playSound('click'), 30); }}
              />
              <Toggle
                icon="🎵"
                label="Música de fundo"
                hint="Muda de clima a cada fase"
                checked={prefs.music}
                onChange={(v) => setPref('music', v)}
              />
              {canVibrate && (
                <Toggle
                  icon="📳"
                  label="Vibração"
                  hint="Na sua vez e nos momentos importantes"
                  checked={prefs.vibration}
                  onChange={(v) => { setPref('vibration', v); if (v) vibrate(30); }}
                />
              )}
            </div>

            <h3 className="mt-5 mb-2 font-display text-sm tracking-wide text-ink-300 uppercase">📱 App</h3>
            <InstallBlock />

            <div className="mt-5 grid gap-2">
              <Button variant="ghost" size="md" block onClick={() => setUi({ settingsOpen: false, installHelpOpen: false, tutorialOpen: true })}>
                <span aria-hidden="true">🎓</span> Ver tutorial
              </Button>
            </div>
            <p className="mt-4 text-center text-xs text-ink-300">Os ajustes ficam salvos só neste aparelho.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
