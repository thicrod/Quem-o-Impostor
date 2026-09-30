import { Component } from 'react';

/**
 * Se algum componente quebrar, mostra uma tela amigável (nunca stack trace)
 * em vez de deixar a página em branco. A sessão continua salva: recarregar
 * reconecta o jogador na mesma sala.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Só no console (útil para depurar); o jogador vê a tela amigável.
    console.error('[impostor] erro de interface:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-7xl" aria-hidden="true">😵‍💫</div>
        <h1 className="font-display text-3xl text-white">Ops! Algo deu errado.</h1>
        <p className="text-ink-200">Sua vaga na sala continua guardada. Recarregue para voltar ao jogo.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-14 rounded-2xl bg-gradient-to-b from-hot-400 to-hot-600 px-6 font-display text-lg text-white uppercase"
        >
          Recarregar
        </button>
      </div>
    );
  }
}
