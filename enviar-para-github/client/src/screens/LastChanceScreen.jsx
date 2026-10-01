import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { playSound, vibrate } from '../lib/sound.js';
import { Avatar, Button, Panel } from '../components/ui.jsx';
import { TimerRing } from '../components/Timer.jsx';
import { ClueList } from '../components/ClueList.jsx';
import { ReactionBar } from '../components/Reactions.jsx';

export default function LastChanceScreen() {
  const room = useRoom();
  const { state, actions } = useGame();
  const { game, you, playerInfo } = room;
  const impostor = playerInfo(game.lastChanceId);
  const isMe = game.lastChanceId === you.id;
  const [guess, setGuess] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    playSound('impostor');
    vibrate([100, 50, 100]);
    if (isMe) inputRef.current?.focus();
  }, [isMe]);

  const submit = async (e) => {
    e.preventDefault();
    if (!guess.trim()) return;
    setSending(true);
    const res = await actions.submitGuess(guess.trim());
    setSending(false);
    if (!res.ok) {
      setError(res.message);
      playSound('error');
    }
  };

  return (
    <div className="grid gap-5 pb-10">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 250, damping: 14 }}
        className="text-center"
      >
        <motion.p
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
          className="font-display text-5xl text-bad-400"
          style={{ textShadow: '0 0 30px rgb(255 59 82 / 0.6)' }}
        >
          🚨 ÚLTIMA CHANCE
        </motion.p>
        <p className="mt-2 text-lg text-ink-100">“O impostor ainda pode roubar a vitória.”</p>
      </motion.div>

      <Panel className="flex items-center gap-4 border-bad-400/50">
        <Avatar player={impostor} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold tracking-widest text-bad-400 uppercase">🔴 Impostor descoberto</p>
          <p className="truncate font-display text-3xl text-white">{isMe ? 'VOCÊ' : impostor?.nickname}</p>
        </div>
        <TimerRing size={80} tick label="Tempo para adivinhar" />
      </Panel>

      {isMe ? (
        <Panel strong>
          <form onSubmit={submit} className="grid gap-3" noValidate>
            <label htmlFor="guess-input" className="text-center font-display text-2xl text-white">Qual era a palavra?</label>
            {you.card?.word && (
              <p className="text-center text-sm text-ink-300">A sua era “{you.card.word}” — a dos outros é parecida.</p>
            )}
            <input
              id="guess-input"
              ref={inputRef}
              className="field min-h-16 text-center text-2xl"
              placeholder="Qual era a palavra?"
              value={guess}
              maxLength={state.meta?.limits.guessMax ?? 40}
              autoComplete="off"
              autoCorrect="off"
              enterKeyHint="send"
              aria-invalid={Boolean(error)}
              onChange={(e) => {
                setGuess(e.target.value);
                setError(null);
              }}
            />
            {error && <p className="text-center text-sm font-bold text-bad-400" role="alert">⚠️ {error}</p>}
            <Button type="submit" variant="danger" size="xl" block loading={sending} disabled={!guess.trim()}>
              🎯 Tentar
            </Button>
            <p className="text-center text-xs text-ink-300">Você só tem uma tentativa. Acento e plural não importam.</p>
          </form>
        </Panel>
      ) : (
        <div className="text-center" role="status">
          <p className="shimmer-text font-display text-2xl">O impostor está pensando…</p>
          <p className="mt-1 text-sm text-ink-300">Se ele acertar a palavra, rouba a vitória!</p>
          <ReactionBar className="mt-4" />
        </div>
      )}

      <section aria-label="Pistas da partida">
        <h2 className="mb-2 font-display text-lg tracking-wide text-ink-200 uppercase">Pistas dadas</h2>
        <ClueList game={game} playerInfo={playerInfo} meId={you.id} highlightIds={[game.lastChanceId]} />
      </section>
    </div>
  );
}
