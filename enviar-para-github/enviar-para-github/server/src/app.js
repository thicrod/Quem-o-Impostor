// Monta o servidor HTTP + Socket.IO. Exportado como função para os testes
// poderem subir instâncias isoladas em portas aleatórias.

import { createServer as createHttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { ENV, LIMITS, isProd } from './config.js';
import { RoomManager } from './roomManager.js';
import { attachSocketHandlers } from './socketHandlers.js';
import { wordBank } from './wordBank.js';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = process.env.CLIENT_DIST || join(__dirname, '../../client/dist');

function corsOrigin() {
  if (ENV.CLIENT_ORIGIN) return ENV.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
  return isProd ? false : true; // produção: mesma origem; dev: libera o Vite
}

export function createGameServer({ ttlMs } = {}) {
  if (wordBank.categories.size === 0) wordBank.load();

  const app = express();
  app.disable('x-powered-by');
  if (ENV.TRUST_PROXY) app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    next();
  });

  const manager = new RoomManager({ wordBank, ttlMs });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()), ...manager.stats() });
  });

  // Em produção o próprio servidor entrega o build do React.
  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, {
      maxAge: isProd ? '1h' : 0,
      index: false,
      setHeaders(res, filePath) {
        // Arquivos com hash nunca mudam; o service worker e o manifest sempre revalidam.
        if (/[\\/]assets[\\/]/.test(filePath)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        else if (/(sw\.js|\.webmanifest)$/.test(filePath)) res.set('Cache-Control', 'no-cache');
        if (filePath.endsWith('.webmanifest')) res.type('application/manifest+json');
      },
    }));
    app.get(/^(?!\/socket\.io\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(join(CLIENT_DIST, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('text').send('Servidor do "Quem é o Impostor?" rodando. Em dev, abra o cliente Vite (porta 5173).');
    });
  }

  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin() },
    maxHttpBufferSize: LIMITS.MAX_PAYLOAD_BYTES,
    pingInterval: 20_000,
    pingTimeout: 20_000,
    serveClient: false,
  });

  attachSocketHandlers(io, manager, wordBank);
  manager.startSweeper();

  const close = () => new Promise((resolve) => {
    manager.closeAll();
    io.close(() => resolve());
  });

  return { app, httpServer, io, manager, close };
}

export function listen(server, port = ENV.PORT) {
  return new Promise((resolve) => {
    server.httpServer.listen(port, () => {
      const { port: actual } = server.httpServer.address();
      logger.info(`Servidor ouvindo na porta ${actual} (${ENV.NODE_ENV})`);
      resolve(actual);
    });
  });
}
