// Ajuda que o impostor recebe (definida pelo host: difícil / normal / fácil).
// O servidor só manda o "formato" da palavra para o próprio impostor.

import { cx } from './ui.jsx';

/** Quadradinhos com o nº de letras de cada parte da palavra ("Pão de queijo" → 3 · 2 · 6). */
export function WordShape({ shape, className }) {
  if (!shape?.length) return null;
  const total = shape.reduce((a, b) => a + b, 0);
  const label = `A palavra tem ${shape.length > 1 ? `${shape.length} partes: ` : ''}${shape.join(' + ')} letras`;
  if (total > 16) {
    return <p className={cx('font-display text-xl text-white', className)} aria-label={label}>{shape.join(' + ')} letras</p>;
  }
  return (
    <div className={cx('flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5', className)} role="img" aria-label={label}>
      {shape.map((n, i) => (
        <span key={i} className="flex gap-1">
          {Array.from({ length: n }, (_, j) => (
            <span key={j} className="block h-5 w-3.5 rounded-[5px] border-b-[3px] border-sun-400 bg-white/10" />
          ))}
        </span>
      ))}
    </div>
  );
}

const TEXT = {
  hard: '🔥 Modo difícil: nem a categoria você sabe. Escute as pistas com atenção!',
  normal: 'Você não sabe a palavra, só a categoria. Escute as pistas e blefe!',
  easy: 'Você não sabe a palavra, mas ganhou uma ajudinha:',
};

export function ImpostorHint({ card, className }) {
  if (card?.role !== 'impostor') return null;
  if (card.word) {
    return (
      <p className={cx('text-sm text-ink-200', className)}>
        Os outros têm uma palavra <b className="text-white">parecida</b> com a sua. Disfarce!
      </p>
    );
  }
  const level = card.hint?.level || 'normal';
  return (
    <div className={cx('grid gap-2 text-sm text-ink-200', className)}>
      <p>{TEXT[level] || TEXT.normal}</p>
      {level === 'easy' && card.hint?.shape && (
        <div className="rounded-2xl bg-white/8 px-3 py-2.5">
          <WordShape shape={card.hint.shape} />
          <p className="mt-1.5 text-xs font-bold text-sun-400">{card.hint.shape.reduce((a, b) => a + b, 0)} letras</p>
        </div>
      )}
    </div>
  );
}
