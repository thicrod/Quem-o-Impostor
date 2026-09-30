import { motion } from 'motion/react';
import { useGame } from '../hooks/useGame.jsx';
import { Button, Panel } from '../components/ui.jsx';

/** Tela amigável para erros "fatais" (sala expirada, sessão aberta em outra aba…). */
export default function ErrorScreen() {
  const { state, actions } = useGame();
  const { fatal } = state;
  return (
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 safe-top safe-bottom">
      <Panel className="w-full text-center" role="alert">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          className="text-7xl"
          aria-hidden="true"
        >
          {fatal.icon}
        </motion.div>
        <h1 className="mt-3 font-display text-3xl text-white">{fatal.title}</h1>
        <p className="mt-2 text-ink-200">{fatal.message}</p>
        <div className="mt-6 grid gap-3">
          {fatal.code === 'REPLACED' && (
            <Button variant="secondary" size="lg" block onClick={actions.retryResume}>
              📲 Jogar neste aparelho
            </Button>
          )}
          <Button size="lg" block onClick={actions.dismissFatal}>
            🏠 Voltar ao início
          </Button>
        </div>
      </Panel>
    </div>
  );
}
