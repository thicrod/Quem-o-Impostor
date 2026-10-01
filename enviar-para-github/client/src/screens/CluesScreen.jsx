import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { normalize } from '../lib/format.js';
import { playSound, vibrate } from '../lib/sound.js';
import { Avatar, Button, Chip, Panel, cx } from '../components/ui.jsx';
import { TimerRing } from '../components/Timer.jsx';
import { ClueList } from '../components/ClueList.jsx';
import { SpectatorBanner } from '../components/Shell.jsx';

function RoundIntro({ game, playerInfo }) {
  return (
    <motion.div
      className="flex flex-1 flex-col items-center justify-center py-10 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <motion.p
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        className="font-display text-[2.7rem] leading-none text-white text-outline"
      >
        RODADA DE PISTAS
      </motion.p>
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-4"
      >
        <Chip tone="hot" className="px-4 py-1 text-base">Rodada {game.round}</Chip>
        {game.clueRounds > 1 && (
          <Chip tone="sky" className="ml-2 px-4 py-1 text-base">Volta {game.passInRound}/{game.clueRounds}</Chip>
        )}
      </motion.div>
      {game.passInRound > 1 ? (
        <p className="mt-3 max-w-xs text-sm font-bold text-sky-400">🔁 {game.passInRound}ª volta: cada um dá mais uma pista!</p>
      ) : game.round > 1 && (
        <p className="mt-3 max-w-xs text-sm font-bold text-sun-400">🔁 Ninguém saiu: todo mundo dá mais uma pista!</p>
      )}
      <p className="mt-6 text-xs font-extrabold tracking-[0.2em] text-ink-300 uppercase">Ordem sorteada</p>
      <ol className="mt-3 flex flex-wrap justify-center gap-3">
        {game.turnOrder.map((id, i) => {
          const p = playerInfo(id);
          return (
            <motion.li
              key={id}
              initial={{ y: 20, opacity: 0, scale: 0.6 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.12, type: 'spring', stiffness: 300, damping: 18 }}
              className="flex flex-col items-center gap-1"
            >
              <Avatar player={p} size="md" />
              <span className="max-w-16 truncate text-xs font-bold text-ink-200">{i + 1}. {p?.nickname}</span>
            </motion.li>
          );
        })}
      </ol>
    </motion.div>
  );
}

function TurnOrderStrip({ game, playerInfo, meId }) {
  const done = new Set(game.clues.filter((c) => (c.pass ?? c.round) === game.pass).map((c) => c.playerId));
  return (
    <ol className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 py-2" aria-label="Ordem das pistas">
      {game.turnOrder.map((id, i) => {
        const p = playerInfo(id);
        const current = id === game.currentTurnId;
        const finished = done.has(id);
        return (
          <li
            key={id}
            className={cx('flex w-16 shrink-0 flex-col items-center gap-1 transition-opacity', !current && !finished && 'opacity-60')}
            aria-current={current ? 'step' : undefined}
          >
            <div className="relative">
              <motion.div animate={current ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ repeat: current ? Infinity : 0, duration: 1.2 }}>
                <Avatar player={p} size={current ? 'md' : 'sm'} className={current ? 'ring-4 ring-sun-400/70' : ''} />
              </motion.div>
              {finished && (
                <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-good-500 text-[11px] font-black text-ink-950" aria-hidden="true">✓</span>
              )}
            </div>
            <span className={cx('w-full truncate text-center text-[11px] font-bold', current ? 'text-sun-400' : 'text-ink-300')}>
              {id === meId ? 'Você' : p?.nickname}
            </span>
            <span className="sr-only">{i + 1}º{finished ? ', já enviou' : current ? ', vez atual' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ClueInput({ card, onSubmit, maxLength }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [shake, setShake] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: false });
  }, []);

  const localCheck = (value) => {
    const v = value.trim();
    if (!v) return 'Digite uma pista.';
    if (/\s/.test(v)) return 'Só UMA palavra!';
    if (card?.word && normalize(v) === normalize(card.word)) return 'Não vale usar a palavra secreta!';
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const problem = localCheck(text);
    if (problem) {
      setError(problem);
      setShake((n) => n + 1);
      playSound('error');
      return;
    }
    setSending(true);
    const res = await onSubmit(text.trim());
    setSending(false);
    if (!res.ok) {
      setError(res.message);
      setShake((n) => n + 1);
      playSound('error');
      inputRef.current?.focus();
    }
  };

  const liveProblem = text.includes(' ') && text.trim().includes(' ') ? 'Só UMA palavra!' : null;
  const shown = error || liveProblem;

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-3"
      noValidate
    >
      <label htmlFor="clue-input" className="sr-only">Sua pista (uma palavra)</label>
      <motion.input
        key={shake}
        animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
        transition={{ duration: 0.35 }}
        id="clue-input"
        ref={inputRef}
        className="field min-h-16 text-center text-2xl"
        placeholder="Digite sua pista..."
        value={text}
        maxLength={maxLength}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="send"
        aria-invalid={Boolean(shown)}
        aria-describedby="clue-help"
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
      />
      <p id="clue-help" role={shown ? 'alert' : undefined} className={cx('min-h-5 text-center text-sm font-bold', shown ? 'text-bad-400' : 'text-ink-300')}>
        {shown
          ? `⚠️ ${shown}`
          : card?.role === 'impostor'
            ? '🤫 Impostor: uma palavra vaga, mas que pareça certeira!'
            : 'Uma palavra só. Nada de usar a palavra secreta!'}
      </p>
      <Button type="submit" size="xl" block loading={sending} disabled={!text.trim()}>
        Enviar pista ➤
      </Button>
    </motion.form>
  );
}

export default function CluesScreen() {
  const room = useRoom();
  const { state, actions } = useGame();
  const { game, you, playerInfo } = room;
  const current = playerInfo(game.currentTurnId);
  const myTurn = game.currentTurnId === you.id;
  const myPosition = game.turnOrder.indexOf(you.id);
  const alreadySent = game.clues.some((c) => (c.pass ?? c.round) === game.pass && c.playerId === you.id);
  const cluesCount = game.clues.length;
  const prevCount = useRef(cluesCount);

  useEffect(() => {
    if (cluesCount > prevCount.current) playSound('clue');
    prevCount.current = cluesCount;
  }, [cluesCount]);

  useEffect(() => {
    if (myTurn) {
      playSound('turn');
      vibrate([80, 60, 80]);
    }
  }, [myTurn]);

  return (
    <AnimatePresence mode="wait">
      {game.intro ? (
        <RoundIntro key="intro" game={game} playerInfo={playerInfo} />
      ) : (
        <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 pb-8">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-3xl text-white text-outline">RODADA DE PISTAS</h1>
            <div className="flex flex-col items-end gap-1">
              <Chip tone="hot">Rodada {game.round}</Chip>
              {game.clueRounds > 1 && <Chip tone="sky">Volta {game.passInRound}/{game.clueRounds}</Chip>}
            </div>
          </div>

          {!you.isParticipant && <SpectatorBanner />}

          <Panel
            className={cx('flex items-center gap-4', myTurn && 'border-sun-400/70 shadow-[0_0_0_2px_rgb(255_181_71/0.5),0_20px_40px_-16px_rgb(255_181_71/0.5)]')}
            aria-live="polite"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={game.currentTurnId}
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar player={current} size="lg" showStatus />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold tracking-widest text-ink-300 uppercase">
                    {myTurn ? 'É a sua vez!' : 'Agora é a vez de:'}
                  </p>
                  <p className={cx('truncate font-display text-3xl leading-tight', myTurn ? 'text-sun-400' : 'text-white')}>
                    {myTurn ? 'VOCÊ' : current?.nickname}
                  </p>
                  {current && !current.connected && (
                    <p className="text-xs font-bold text-sun-400">💤 Desconectado — pulando em instantes…</p>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
            <TimerRing size={76} tick={myTurn} label="Tempo da vez" />
          </Panel>

          <TurnOrderStrip game={game} playerInfo={playerInfo} meId={you.id} />

          {myTurn ? (
            <Panel strong>
              <ClueInput
                key={`${game.pass}-${game.turnIndex}`}
                card={you.card}
                maxLength={state.meta?.limits.clueMax ?? 24}
                onSubmit={actions.submitClue}
              />
            </Panel>
          ) : you.isParticipant ? (
            <p className="rounded-2xl bg-white/5 px-4 py-3 text-center text-sm font-bold text-ink-200" role="status">
              {alreadySent
                ? '✓ Sua pista foi enviada. Fique de olho nas dos outros!'
                : myPosition >= 0
                  ? `Aguarde sua vez — você é o ${myPosition + 1}º da ordem.`
                  : 'Aguarde…'}
            </p>
          ) : null}

          <section aria-label="Pistas enviadas">
            <h2 className="mb-2 font-display text-lg tracking-wide text-ink-200 uppercase">Pistas</h2>
            <ClueList game={game} playerInfo={playerInfo} meId={you.id} emptyText="Ninguém mandou pista ainda. Suspense…" />
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
