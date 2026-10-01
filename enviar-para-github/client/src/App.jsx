import { useEffect, useRef } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { RoomScope, useGame, useRoom } from './hooks/useGame.jsx';
import { playSound } from './lib/sound.js';
import { setMusicMood } from './lib/music.js';
import { useWakeLock } from './hooks/useWakeLock.js';
import { ConnectionOverlay, LiveAnnouncer, Logo, Toasts, TopBar } from './components/Shell.jsx';
import { SettingsSheet } from './components/SettingsSheet.jsx';
import { ServerWaking, useSecondsWhile } from './components/ServerWaking.jsx';
import { ReactionLayer } from './components/Reactions.jsx';
import { Onboarding } from './components/Onboarding.jsx';
import { Spinner } from './components/ui.jsx';
import HomeScreen from './screens/HomeScreen.jsx';
import LobbyScreen from './screens/LobbyScreen.jsx';
import RevealScreen from './screens/RevealScreen.jsx';
import CluesScreen from './screens/CluesScreen.jsx';
import DiscussionScreen from './screens/DiscussionScreen.jsx';
import VotingScreen from './screens/VotingScreen.jsx';
import VoteRevealScreen from './screens/VoteRevealScreen.jsx';
import TieScreen from './screens/TieScreen.jsx';
import LastChanceScreen from './screens/LastChanceScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import ErrorScreen from './screens/ErrorScreen.jsx';

const SCREENS = {
  lobby: LobbyScreen,
  reveal: RevealScreen,
  clues: CluesScreen,
  discussion: DiscussionScreen,
  voting: VotingScreen,
  voteReveal: VoteRevealScreen,
  tie: TieScreen,
  lastChance: LastChanceScreen,
  result: ResultScreen,
};

const PHASE_ANNOUNCE = {
  lobby: 'Lobby da sala.',
  reveal: 'Nova rodada! Revele sua carta.',
  discussion: 'Discussão aberta.',
  voting: 'Hora de votar: quem é o impostor?',
  voteReveal: 'Revelando os votos.',
  tie: 'Ninguém saiu. Mais uma rodada!',
  lastChance: 'Última chance do impostor.',
  result: 'Resultado da rodada.',
};

// Telas que ocupam exatamente a altura da tela (chat com rolagem interna).
const FULL_HEIGHT = new Set(['discussion']);
const WIDE = new Set(['lobby', 'result', 'voting', 'voteReveal']);

function Splash() {
  const { state, actions } = useGame();
  const waiting = useSecondsWhile(state.connection !== 'online');
  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-4 px-4" role="status">
      <div className="animate-float"><Logo size="lg" /></div>
      <Spinner className="size-8 text-hot-400" />
      <p className="text-sm font-bold text-ink-300">Carregando…</p>
      {waiting >= 4 && (
        <ServerWaking
          className="w-full max-w-sm"
          seconds={waiting}
          offline={state.connection === 'offline'}
          onRetry={actions.reconnectNow}
        />
      )}
    </div>
  );
}

/** Efeitos sonoros ligados a mudanças de estado vindas do servidor. */
function useRoomSounds(room) {
  const prev = useRef(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = room;
    if (!room || !before || before.code !== room.code) return;
    if (before.phase !== room.phase) {
      if (room.phase === 'reveal') playSound('start');
      if (room.phase === 'voting' || room.phase === 'discussion') playSound('join');
    }
    if (room.phase === 'lobby' || room.phase === 'result') {
      if (room.players.length > before.players.length) playSound('join');
      if (room.players.length < before.players.length) playSound('leave');
    }
  }, [room]);
}

// Clima da música de fundo (se ligada nos ajustes) para cada fase.
const MUSIC_MOOD = {
  lobby: 'calm',
  reveal: 'tension',
  clues: 'tension',
  discussion: 'tension',
  voting: 'tension',
  voteReveal: 'suspense',
  tie: 'suspense',
  lastChance: 'suspense',
  result: 'calm',
};

/** Texto para a região aria-live (leitores de tela). */
function announcementFor(room) {
  if (!room) return '';
  const turnId = room.game?.currentTurnId;
  if (room.phase === 'clues' && turnId) {
    return turnId === room.you.id ? 'É a sua vez de dar a pista!' : `Vez de ${room.byId[turnId]?.nickname ?? 'outro jogador'}.`;
  }
  if (room.phase === 'clues') return 'Rodada de pistas.';
  return PHASE_ANNOUNCE[room.phase] || '';
}

export default function App() {
  const { state } = useGame();
  const room = useRoom();
  useRoomSounds(room);
  const announce = announcementFor(room);
  const phase = room?.phase ?? null;
  // Tela sempre acesa enquanto estiver numa sala (o celular não apaga no meio da rodada).
  useWakeLock(Boolean(room));
  useEffect(() => {
    setMusicMood(phase ? MUSIC_MOOD[phase] ?? 'calm' : 'calm');
  }, [phase]);

  let content;
  let key;
  if (!state.clientId || (state.resuming && !state.room)) {
    content = <Splash />;
    key = 'splash';
  } else if (state.fatal) {
    content = <ErrorScreen />;
    key = 'fatal';
  } else if (!room) {
    content = <HomeScreen />;
    key = 'home';
  } else {
    const Screen = SCREENS[room.phase] || LobbyScreen;
    const full = FULL_HEIGHT.has(room.phase);
    const wide = WIDE.has(room.phase);
    key = 'room';
    content = (
      <RoomScope room={state.room}>
        <div
          className={[
            'relative z-10 mx-auto flex w-full flex-col px-4',
            full ? 'h-dvh overflow-hidden safe-bottom' : 'min-h-dvh',
            wide ? 'max-w-5xl' : 'max-w-xl',
          ].join(' ')}
        >
          <TopBar />
          {/* popLayout: a tela nova entra na hora, sem esperar a antiga sair
              (antes, com "wait", a troca podia travar com a aba em segundo plano). */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.main
              key={`${room.phase}-${room.game?.number ?? 0}`}
              className={['flex flex-col', full ? 'min-h-0 flex-1' : 'flex-1'].join(' ')}
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14, ease: 'easeIn' } }}
              transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.8 }}
            >
              {/* Cada tela recebe a "sua" sala congelada (ver RoomScope). */}
              <RoomScope room={state.room}>
                <Screen />
              </RoomScope>
            </motion.main>
          </AnimatePresence>
        </div>
      </RoomScope>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-bg" aria-hidden="true" />
      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={key}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </div>
      <ReactionLayer />
      <Toasts />
      <SettingsSheet />
      <Onboarding />
      <ConnectionOverlay />
      <LiveAnnouncer message={announce} />
    </MotionConfig>
  );
}
