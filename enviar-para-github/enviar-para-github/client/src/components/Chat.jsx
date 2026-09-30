import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { playSound } from '../lib/sound.js';
import { Avatar, cx } from './ui.jsx';

const NEAR_BOTTOM_PX = 80;

export function ChatMessages({ className }) {
  const { state } = useGame();
  const room = useRoom();
  const listRef = useRef(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unread, setUnread] = useState(0);
  const lastCount = useRef(state.chat.length);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useLayoutEffect(() => {
    const count = state.chat.length;
    const added = count - lastCount.current;
    lastCount.current = count;
    if (added <= 0) return;
    const mine = state.chat.at(-1)?.playerId === room.you.id;
    if (atBottom || mine) {
      scrollToBottom(true);
    } else {
      setUnread((n) => n + added);
    }
  }, [state.chat, atBottom, room.you.id, scrollToBottom]);

  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    setAtBottom(bottom);
    if (bottom) setUnread(0);
  };

  return (
    <div className={cx('relative min-h-0', className)}>
      <ol
        ref={listRef}
        onScroll={onScroll}
        className="h-full space-y-2.5 overflow-y-auto overscroll-contain px-1 py-2"
        aria-label="Mensagens do chat"
        aria-live="polite"
        aria-relevant="additions"
      >
        {state.chat.length === 0 && (
          <li className="px-4 py-8 text-center text-sm font-bold text-ink-300">
            💬 Ninguém falou nada ainda. Quem achou alguma pista estranha?
          </li>
        )}
        {state.chat.map((m) => {
          const p = room.playerInfo(m.playerId);
          const mine = m.playerId === room.you.id;
          return (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18 }}
              className={cx('flex items-end gap-2', mine && 'flex-row-reverse')}
            >
              <Avatar player={p} size="sm" />
              <div className={cx('max-w-[78%] min-w-0', mine && 'text-right')}>
                <p className="px-1 text-[11px] font-extrabold text-ink-300" style={{ color: p?.color }}>
                  {mine ? 'Você' : p?.nickname}
                </p>
                <p
                  className={cx(
                    'inline-block rounded-2xl px-3.5 py-2 text-left text-[15px] leading-snug break-words whitespace-pre-wrap',
                    mine ? 'rounded-br-md bg-hot-500 text-white' : 'rounded-bl-md bg-white/10 text-ink-100',
                  )}
                >
                  {m.text}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>
      <AnimatePresence>
        {unread > 0 && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => {
              scrollToBottom(true);
              setUnread(0);
            }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-sky-400 px-4 py-2 text-sm font-extrabold text-ink-950 shadow-glow-sky"
          >
            ⬇ {unread} {unread === 1 ? 'nova mensagem' : 'novas mensagens'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChatInput({ disabled, disabledText }) {
  const { state, actions } = useGame();
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const max = state.meta?.limits.chatMax ?? 200;

  const send = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    const res = await actions.sendChat(value);
    setSending(false);
    if (res.ok) {
      setText('');
      setError(null);
    } else {
      setError(res.message);
      playSound('error');
    }
  };

  if (disabled) {
    return <p className="rounded-2xl bg-white/5 px-4 py-3 text-center text-sm font-bold text-ink-300">{disabledText}</p>;
  }

  const remaining = max - text.length;
  return (
    <form onSubmit={send} className="grid gap-1" noValidate>
      <div className="flex items-center gap-2">
        <label htmlFor="chat-input" className="sr-only">Mensagem</label>
        <input
          id="chat-input"
          className="field min-h-13 flex-1 text-base font-semibold"
          placeholder="Escreva uma mensagem…"
          value={text}
          maxLength={max}
          autoComplete="off"
          enterKeyHint="send"
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Enviar mensagem"
          className="grid size-13 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-hot-400 to-hot-600 text-xl text-white shadow-glow-hot transition-opacity disabled:opacity-40"
        >
          ➤
        </button>
      </div>
      {(error || remaining <= 40) && (
        <p className={cx('px-1 text-xs font-bold', error ? 'text-bad-400' : 'text-ink-300')} role={error ? 'alert' : undefined}>
          {error ? `⚠️ ${error}` : `${remaining} caracteres restantes`}
        </p>
      )}
    </form>
  );
}
