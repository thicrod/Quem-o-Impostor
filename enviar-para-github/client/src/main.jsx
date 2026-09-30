import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fontes empacotadas no build (funciona offline e sem requisições externas).
import '@fontsource/lilita-one';
import '@fontsource-variable/nunito';
import './index.css';
import App from './App.jsx';
import { GameProvider } from './hooks/useGame.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <GameProvider>
        <App />
      </GameProvider>
    </ErrorBoundary>
  </StrictMode>,
);
