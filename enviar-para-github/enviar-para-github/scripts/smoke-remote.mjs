#!/usr/bin/env node
// Teste de fumaça contra um servidor JÁ PUBLICADO (ex.: Render).
// 6 jogadores robôs entram numa sala nova, jogam uma rodada completa e saem.
//
//   npm run smoke -- https://seu-jogo.onrender.com
//
// Não mexe em nada além da sala criada pelo próprio teste.

import assert from 'node:assert/strict';
import {
  createRoomWith, everyone, finishDiscussion, playClueRound, roles, startAndReveal, vote,
} from '../server/test/helpers.js';

const url = (process.argv[2] || process.env.SMOKE_URL || '').replace(/\/$/, '');
if (!/^https?:\/\//.test(url)) {
  console.error('Uso: npm run smoke -- https://seu-jogo.onrender.com');
  process.exit(1);
}

const started = Date.now();
let bots = [];
try {
  const health = await fetch(`${url}/health`).then((r) => r.json());
  assert.equal(health.ok, true, '/health não respondeu ok');
  console.log(`✔ /health ok (${health.rooms} salas ativas, ${health.online} jogadores online)`);

  const room = await createRoomWith(url, 6, { names: ['Bot1', 'Bot2', 'Bot3', 'Bot4', 'Bot5', 'Bot6'] });
  bots = room.bots;
  console.log(`✔ sala ${room.code} criada com 6 jogadores`);

  const secret = await startAndReveal(bots);
  const { impostor } = roles(bots);
  console.log(`✔ cartas distribuídas (palavra: ${secret}, impostor: ${impostor.nickname})`);

  await playClueRound(bots);
  await finishDiscussion(bots);
  console.log('✔ pistas e discussão');

  const other = bots.find((b) => b !== impostor);
  await vote(bots, Object.fromEntries(bots.map((b) => [b.nickname, b === impostor ? other.nickname : impostor.nickname])));
  await impostor.waitPhase('lastChance', { timeout: 15000 });
  await impostor.request('guess:submit', { text: 'palpite-errado' });
  await everyone(bots, (b) => b.waitPhase('result', { timeout: 15000 }));
  assert.equal(bots[0].state.game.result.outcome, 'caught');
  console.log('✔ votação, última chance e resultado (+2 para cada inocente)');

  for (const b of bots) await b.request('room:leave');
  console.log(`\n✅ Servidor OK em ${((Date.now() - started) / 1000).toFixed(1)}s — pronto para 6 jogadores.`);
} catch (err) {
  console.error('\n❌ Falhou:', err.message);
  process.exitCode = 1;
} finally {
  bots.forEach((b) => b.close());
}
