import { useEffect, useRef } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { RoomScope, useGame, useRoom } from './hooks/useGame.jsx';
import { playSound } from './lib/sound.js';
import { ConnectionOverlay, LiveAnnouncer, Logo, Toasts, TopBar } from './components/Shell.jsx';
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
  tie: 'Empate!',
  lastChance: 'Última chance do impostor.',
  result: 'Resultado da rodada.',
};

// Telas que ocupam exatamente a altura da tela (chat com rolagem interna).
const FULL_HEIGHT = new Set(['discussion']);
const WIDE = new Set(['lobby', 'result', 'voting', 'voteReveal']);

function Splash() {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-4" role="status">
      <div className="animate-float"><Logo size="lg" /></div>
      <Spinner className="size-8 text-hot-400" />
      <p className="text-sm font-bold text-ink-300">Carregando…</p>
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
          <AnimatePresence mode="wait">
            <motion.main
              key={`${room.phase}-${room.game?.number ?? 0}`}
              className={['flex flex-col', full ? 'min-h-0 flex-1' : 'flex-1'].join(' ')}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
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
      <AnimatePresence mode="wait">
        <motion.div key={key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {content}
        </motion.div>
      </AnimatePresence>
      <Toasts />
      <ConnectionOverlay />
      <LiveAnnouncer message={announce} />
    </MotionConfig>
  );
}
