import { createGameServer, listen } from './app.js';
import { logger } from './logger.js';

const server = createGameServer();
await listen(server);

const shutdown = async (signal) => {
  logger.info(`${signal} recebido, encerrando…`);
  await server.close();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error('Promise rejeitada sem tratamento:', err));
