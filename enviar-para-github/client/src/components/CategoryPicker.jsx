// Seletor de categorias (várias ao mesmo tempo). O servidor sorteia uma das
// escolhidas a cada rodada — sem repetir palavras já usadas na sala.

import { useState } from 'react';
import { motion } from 'motion/react';
import { playSound } from '../lib/sound.js';
import { Button, cx } from './ui.jsx';
import { Modal } from './Shell.jsx';

function summaryOf(categories, value) {
  const selected = categories.filter((c) => value.includes(c.key));
  const words = selected.reduce((n, c) => n + c.count, 0);
  if (selected.length === 0 || selected.length === categories.length) {
    return { emoji: '🎲', title: 'Todas as categorias', sub: `Sorteia entre ${categories.length} categorias · ${words} palavras` };
  }
  if (selected.length === 1) {
    return { emoji: selected[0].emoji, title: selected[0].label, sub: `${selected[0].count} palavras` };
  }
  return {
    emoji: '🎲',
    title: `${selected.length} categorias`,
    sub: `${selected.map((c) => c.emoji).join(' ')} · ${words} palavras`,
  };
}

export function CategoryPicker({ categories, value, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const summary = summaryOf(categories, value);
  const allKeys = categories.map((c) => c.key);

  const toggle = (key) => {
    playSound('click');
    setDraft((d) => (d.includes(key) ? d.filter((k) => k !== key) : [...d, key]));
  };

  const save = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setDraft(value); setOpen(true); }}
        className={cx(
          'flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left transition-colors',
          disabled ? 'cursor-default border-white/10 bg-white/5' : 'border-white/15 bg-ink-950/50 hover:border-sky-400/60',
        )}
        aria-haspopup="dialog"
        aria-label={`Categorias: ${summary.title}${disabled ? '' : '. Toque para trocar'}`}
      >
        <span className="text-3xl" aria-hidden="true">{summary.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl text-white">{summary.title}</span>
          <span className="block truncate text-xs font-bold text-ink-300">{summary.sub}</span>
        </span>
        {!disabled && <span className="shrink-0 text-sky-400" aria-hidden="true">Trocar ›</span>}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Escolha as categorias"
        wide
        actions={(
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <Button variant="ghost" size="md" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="md" onClick={save} disabled={draft.length === 0}>
              {draft.length === 0 ? 'Escolha 1+' : `Salvar (${draft.length})`}
            </Button>
          </div>
        )}
      >
        <p className="text-sm">Marque quantas quiser: a cada rodada o jogo sorteia uma delas.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => { playSound('click'); setDraft(allKeys); }}
            className="min-h-10 rounded-full border border-sky-400/40 bg-sky-400/10 px-3 text-sm font-extrabold text-sky-400"
          >
            🎲 Todas
          </button>
          <button
            type="button"
            onClick={() => { playSound('click'); setDraft([]); }}
            className="min-h-10 rounded-full border border-white/15 bg-white/5 px-3 text-sm font-extrabold text-ink-200"
          >
            Limpar
          </button>
        </div>
        <div className="-mx-1 mt-3 grid max-h-[46dvh] grid-cols-2 gap-2 overflow-y-auto px-1 py-1 sm:grid-cols-3">
          {categories.map((c) => {
            const on = draft.includes(c.key);
            return (
              <motion.button
                key={c.key}
                type="button"
                role="checkbox"
                aria-checked={on}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggle(c.key)}
                className={cx(
                  'relative flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 px-2 py-2 text-center transition-colors',
                  on ? 'border-hot-400 bg-hot-500/15' : 'border-white/10 bg-white/5 hover:border-white/30',
                )}
              >
                {on && (
                  <span className="absolute top-1 right-1.5 grid size-5 place-items-center rounded-full bg-hot-500 text-[11px] font-black text-white" aria-hidden="true">
                    ✓
                  </span>
                )}
                <span className="text-2xl" aria-hidden="true">{c.emoji}</span>
                <span className="text-sm leading-tight font-extrabold text-white">{c.label}</span>
                <span className="text-[11px] font-bold text-ink-300">{c.count} palavras</span>
              </motion.button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
