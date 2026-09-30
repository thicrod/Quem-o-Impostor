// Revelação dramática + resultado da rodada + placar.
// Sequência: "O IMPOSTOR ERA..." (suspense) -> nome do impostor -> vitória/derrota -> pontos.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useGame, useRoom } from '../hooks/useGame.jsx';
import { playSound, vibrate } from '../lib/sound.js';
import { shareResultImage } from '../lib/shareImage.js';
import { Avatar, Button, Chip, Panel, cx } from '../components/ui.jsx';
import { Leaderboard, CountUp } from '../components/Leaderboard.jsx';
import { ClueList } from '../components/ClueList.jsx';
import { Confetti } from '../components/Confetti.jsx';

const OUTCOMES = {
  caught: { title: '🟢 O GRUPO VENCEU!', tone: 'good', sub: 'O impostor foi descoberto.' },
  stolen: { title: '🎉 O IMPOSTOR ROUBOU A VITÓRIA!', tone: 'bad', sub: 'Eliminado, mas acertou a palavra!' },
  escaped: { title: '🔴 O IMPOSTOR ESCAPOU!', tone: 'bad', sub: '' },
};

function Suspense({ ids, playerInfo }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % ids.length), 160);
    return () => clearInterval(id);
  }, [ids.length]);
  const p = playerInfo(ids[index]);
  return (
    <motion.div
      key="suspense"
      className="flex flex-col items-center gap-6 py-10"
      exit={{ opacity: 0, scale: 0.8 }}
    >
      <p className="font-display text-4xl text-white text-outline">O IMPOSTOR ERA...</p>
      <div className="grid size-36 place-items-center rounded-full bg-white/5 ring-4 ring-white/10">
        <Avatar player={p} size="2xl" dim />
      </div>
      <div className="flex gap-2" aria-hidden="true">
        {ids.map((id, i) => (
          <span key={id} className={cx('size-2.5 rounded-full transition-colors', i === index ? 'bg-hot-400' : 'bg-white/15')} />
        ))}
      </div>
    </motion.div>
  );
}

/** Tela cheia rápida de VITÓRIA/DERROTA (toque para pular). */
function OutcomeSplash({ show, win, champion, text, onDone }) {
  useEffect(() => {
    if (!show) return undefined;
    vibrate(win ? [40, 60, 40, 60, 120] : [200]);
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [show, win, onDone]);
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          aria-label="Continuar"
          onClick={onDone}
          className="fixed inset-0 z-40 grid cursor-pointer place-items-center overflow-hidden bg-ink-950/85 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          {win ? (
            <div className="rays absolute top-1/2 left-1/2 size-[170vmax] -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(circle, transparent 25%, color-mix(in srgb, var(--color-bad-500) 40%, transparent))' }}
              aria-hidden="true"
            />
          )}
          <motion.div
            className="relative flex flex-col items-center px-6 text-center"
            initial={{ scale: 0.2, rotate: win ? -12 : 0 }}
            animate={win ? { scale: 1, rotate: 0 } : { scale: 1, x: [0, -16, 16, -10, 10, -4, 0] }}
            transition={win ? { type: 'spring', stiffness: 260, damping: 11 } : { duration: 0.6 }}
          >
            <motion.span
              className="text-[7rem] leading-none"
              animate={win ? { y: [0, -14, 0] } : { rotate: [0, -8, 8, 0] }}
              transition={{ repeat: Infinity, duration: win ? 1.1 : 1.6 }}
              aria-hidden="true"
            >
              {champion ? '👑' : win ? '🏆' : '💀'}
            </motion.span>
            <p
              className={cx('mt-2 font-display text-[3.6rem] leading-none text-outline', win ? 'text-sun-400' : 'text-bad-400')}
            >
              {champion ? 'CAMPEÃO!' : win ? 'VITÓRIA!' : 'DERROTA'}
            </p>
            <p className="mt-3 max-w-xs font-display text-xl text-white">{text}</p>
            <p className="mt-6 text-xs font-bold text-ink-300">toque para continuar</p>
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** Fim de partida (pontuação-alvo atingida). */
function ChampionBanner({ champions, target, meId }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 14 }}
      className="relative overflow-hidden rounded-3xl border-2 border-sun-400/80 bg-sun-400/10 px-4 py-5 text-center"
      role="status"
    >
      <div className="rays absolute top-1/2 left-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 opacity-70" aria-hidden="true" />
      <div className="relative">
        <p className="text-xs font-extrabold tracking-[0.25em] text-sun-400 uppercase">🏁 Fim de partida · {target} pontos</p>
        <p className="mt-1 font-display text-4xl text-white text-outline">
          {champions.length > 1 ? '👑 CAMPEÕES' : '👑 CAMPEÃO'}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-4">
          {champions.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-1">
              <Avatar player={p} size="lg" className="ring-4 ring-sun-400" />
              <span className="font-display text-xl text-sun-400">{p.id === meId ? 'VOCÊ' : p.nickname}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-200">O placar zera na próxima partida.</p>
      </div>
    </motion.div>
  );
}

export default function ResultScreen() {
  const room = useRoom();
  const { actions } = useGame();
  const { game, you, playerInfo } = room;
  const result = game.result;
  const [stage, setStage] = useState(0); // 0 suspense, 1 revelado, 2 detalhes
  const [busy, setBusy] = useState(null);
  const [skipped, setSkipped] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [sharing, setSharing] = useState(false);

  const impostors = result.impostorIds.map(playerInfo).filter(Boolean);
  const outcome = OUTCOMES[result.outcome];
  const iWasImpostor = result.impostorIds.includes(you.id);
  const participated = game.participants.includes(you.id) || result.pointsDelta[you.id] !== undefined;
  const iWon = participated && (result.winner === 'impostors') === iWasImpostor;
  const eliminated = playerInfo(result.eliminatedId);
  const champions = (result.champions || []).map(playerInfo).filter(Boolean);
  const iAmChampion = champions.some((p) => p.id === you.id);
  const showSplash = stage === 2 && participated && !skipped && !splashDone;
  const endSplash = useCallback(() => setSplashDone(true), []);

  const share = async () => {
    setSharing(true);
    try {
      const r = await shareResultImage({ result, game, players: room.players, playerInfo });
      if (r === 'downloaded') actions.toast('Imagem salva! Mande no grupo. 📸', 'join');
    } catch {
      actions.toast('Não deu para gerar a imagem.', 'error');
    }
    setSharing(false);
  };

  const escapedReason = result.outcome === 'escaped'
    ? result.reason === 'tie'
      ? 'Três empates seguidos: o grupo não chegou a um consenso.'
      : `Vocês eliminaram ${eliminated?.nickname ?? 'um inocente'}, que era inocente.`
    : outcome.sub;

  const suspenseIds = useMemo(() => {
    const ids = [...game.participants];
    for (const id of result.impostorIds) if (!ids.includes(id)) ids.push(id);
    return ids;
  }, [game.participants, result.impostorIds]);

  // A tela é remontada a cada rodada (key inclui o número da partida).
  useEffect(() => {
    playSound('drumroll');
    const t1 = setTimeout(() => {
      setStage((s) => Math.max(s, 1));
      playSound('impostor');
    }, 2300);
    const t2 = setTimeout(() => setStage(2), 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (stage === 2 && participated) playSound(iWon ? 'win' : 'lose');
  }, [stage, iWon, participated]);

  const act = async (kind) => {
    setBusy(kind);
    const res = kind === 'again' ? await actions.playAgain() : await actions.toLobby();
    setBusy(null);
    if (!res.ok) actions.toast(res.message, 'error');
  };

  const roundPlayers = Object.keys(result.pointsDelta).map((id) => ({ id, info: playerInfo(id), points: result.pointsDelta[id] }));

  return (
    <div className="grid gap-4 pb-40">
      <Confetti fire={stage === 2 && (iWon || iAmChampion) && !showSplash} />
      <OutcomeSplash
        show={showSplash}
        win={iWon || iAmChampion}
        champion={iAmChampion}
        text={outcome.title.replace(/^\S+\s/, '')}
        onDone={endSplash}
      />
      {stage < 2 && (
        <button
          type="button"
          onClick={() => { setSkipped(true); setStage(2); }}
          className="min-h-11 justify-self-end rounded-full px-4 text-sm font-bold text-ink-300 hover:text-white"
        >
          Pular animação ›
        </button>
      )}
      <AnimatePresence mode="wait">
        {stage === 0 ? (
          <Suspense ids={suspenseIds} playerInfo={playerInfo} />
        ) : (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 pt-4 text-center">
            <p className="text-sm font-extrabold tracking-[0.25em] text-ink-300 uppercase">
              {impostors.length > 1 ? 'Os impostores eram' : 'O impostor era'}
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              {impostors.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: i * 0.15, type: 'spring', stiffness: 260, damping: 13 }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="rounded-full p-1 shadow-glow-bad ring-4 ring-bad-400">
                    <Avatar player={p} size="2xl" />
                  </div>
                  <p className="font-display text-4xl text-bad-400" style={{ textShadow: '0 0 24px rgb(255 59 82 / 0.5)' }}>
                    🔴 {p.id === you.id ? 'VOCÊ' : p.nickname.toUpperCase()}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {stage === 2 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
          <div
            className={cx(
              'rounded-3xl border-2 px-4 py-4 text-center',
              outcome.tone === 'good' ? 'border-good-400/70 bg-good-500/12' : 'border-bad-400/70 bg-bad-500/12',
            )}
            role="status"
          >
            <p className={cx('font-display text-3xl leading-tight', outcome.tone === 'good' ? 'text-good-400' : 'text-bad-400')}>
              {outcome.title}
            </p>
            <p className="mt-1 text-sm text-ink-200">{escapedReason}</p>
            {participated && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 12 }}
                className="mt-3"
              >
                <Chip tone={iWon ? 'good' : 'bad'} className="px-4 py-1.5 text-lg">
                  {iWon ? '🏆 VITÓRIA!' : '💀 DERROTA'}
                </Chip>
              </motion.div>
            )}
            <button
              type="button"
              onClick={share}
              disabled={sharing}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/8 px-4 text-sm font-extrabold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
            >
              <span aria-hidden="true">📸</span> {sharing ? 'Gerando…' : 'Compartilhar resultado'}
            </button>
          </div>

          {result.matchOver && champions.length > 0 && (
            <ChampionBanner champions={champions} target={result.targetScore} meId={you.id} />
          )}

          <Panel className="text-center">
            <p className="text-xs font-extrabold tracking-[0.25em] text-ink-300 uppercase">A palavra era</p>
            <p className="font-display text-5xl break-words text-white">{result.word}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Chip tone="grape" className="normal-case">{game.category.emoji} {game.category.label}</Chip>
              {result.similar && <Chip tone="bad" className="normal-case">Palavra do impostor: {result.similar}</Chip>}
            </div>
            {result.guess && (
              <p className={cx('mt-3 text-sm font-bold', result.guessCorrect ? 'text-good-400' : 'text-bad-400')}>
                Palpite do impostor: “{result.guess}” {result.guessCorrect ? '✓ acertou!' : '✗ errou'}
              </p>
            )}
            {result.outcome === 'caught' && !result.guess && (
              <p className="mt-3 text-sm font-bold text-ink-300">O impostor não arriscou um palpite a tempo.</p>
            )}
          </Panel>

          <Panel>
            <h2 className="mb-3 font-display text-xl tracking-wide text-white uppercase">Resultado da rodada</h2>
            <ul className="grid gap-2">
              {roundPlayers.map(({ id, info, points }, i) => {
                const imp = result.impostorIds.includes(id);
                return (
                  <motion.li
                    key={id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2"
                  >
                    <span aria-hidden="true">{imp ? '🔴' : '🟢'}</span>
                    <Avatar player={info} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-extrabold text-white">
                      {id === you.id ? 'Você' : info?.nickname}
                      <span className="ml-2 text-xs font-bold text-ink-300">{imp ? 'impostor' : 'inocente'}</span>
                    </span>
                    <span className={cx('font-display text-2xl', points > 0 ? 'text-good-400' : 'text-ink-300')}>
                      +<CountUp from={0} to={points} delay={0.3 + i * 0.06} duration={0.6} />
                    </span>
                  </motion.li>
                );
              })}
            </ul>
          </Panel>

          <Panel>
            <Leaderboard players={room.players} meId={you.id} gained={result.pointsDelta} title="Placar total" delay={0.2} />
            {!result.matchOver && result.targetScore > 0 && (
              <p className="mt-3 text-center text-sm font-bold text-sun-400">🏁 Partida até {result.targetScore} pontos</p>
            )}
          </Panel>

          <Panel>
            <h2 className="mb-3 font-display text-lg tracking-wide text-ink-200 uppercase">Todas as pistas</h2>
            <ClueList game={game} playerInfo={playerInfo} meId={you.id} highlightIds={result.impostorIds} />
          </Panel>
        </motion.div>
      )}

      {stage === 2 && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent px-4 pt-6 safe-bottom">
          <div className="mx-auto grid max-w-md gap-2">
            {you.isHost ? (
              <Button size="xl" block onClick={() => act('again')} loading={busy === 'again'} disabled={Boolean(busy)}>
                {result.matchOver ? '🏁 Nova partida' : '🔁 Jogar novamente'}
              </Button>
            ) : (
              <div className="glass rounded-2xl px-4 py-3 text-center" role="status">
                <p className="shimmer-text font-display text-lg">Aguardando o host começar outra rodada…</p>
              </div>
            )}
            <div className={cx('grid gap-2', you.isHost && 'grid-cols-2')}>
              {you.isHost && (
                <Button variant="ghost" size="md" onClick={() => act('lobby')} loading={busy === 'lobby'} disabled={Boolean(busy)}>
                  ⚙️ Lobby
                </Button>
              )}
              <Button variant="ghost" size="md" block onClick={actions.leaveRoom} aria-label="Sair da sala">
                {you.isHost ? '🚪 Sair' : '🚪 Sair da sala'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
