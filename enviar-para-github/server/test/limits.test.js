// Expiração de salas e limites anti-abuso (roda em processo separado com env própria).

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Bot, createRoomWith, everyone, playClueRound, setTestEnv, sleep, startAndReveal, startServer,
} from './helpers.js';

setTestEnv({ MAX_CONNECTIONS_PER_IP: '8' });

let server;
const bots = [];

before(async () => {
  server = await startServer({ ttlMs: 400 });
});

after(async () => {
  bots.forEach((b) => b.close());
  await server.close();
});

test('sala inativa expira e o jogador recebe "sessão expirada"', async () => {
  const { bots: three, code } = await createRoomWith(server.url, 3, { names: ['Exp1', 'Exp2', 'Exp3'] });
  bots.push(...three);
  await three[0].waitFor((b) => b.closed, { timeout: 3000, label: 'room:closed' });
  assert.equal(three[0].closed.reason, 'expired');
  assert.match(three[0].closed.message, /30 minutos/);
  const res = await three[1].resume(code);
  assert.equal(res.code, 'ROOM_EXPIRED');
  assert.equal(server.manager.rooms.has(code), false, 'memória liberada');
  three.forEach((b) => b.close());
  await sleep(100);
});

test('discussão sem tempo com gente online não expira (estão conversando na chamada)', async () => {
  const { bots: three, host, code } = await createRoomWith(server.url, 3, { names: ['Papo1', 'Papo2', 'Papo3'] });
  bots.push(...three);
  assert.equal((await host.request('settings:update', { discussionSeconds: 0 })).ok, true);
  await startAndReveal(three);
  await playClueRound(three);
  await everyone(three, (b) => b.waitPhase('discussion'));
  await sleep(1200); // 3x o tempo de expiração deste servidor (400ms)
  assert.equal(server.manager.rooms.has(code), true, 'sala continua viva');
  assert.equal(three[0].closed, null);
  assert.equal((await host.request('discussion:startVoting')).ok, true);
  three.forEach((b) => b.close());
  await sleep(100);
});

test('limite de conexões por IP', async () => {
  const many = Array.from({ length: 10 }, (_, i) => new Bot(server.url, `Ip${i}`));
  bots.push(...many);
  const results = await Promise.allSettled(many.map((b) => b.ready().then(() => true)));
  await sleep(300);
  const connected = many.filter((b) => b.socket.connected).length;
  assert.ok(connected <= 8, `conectados: ${connected}`);
  assert.ok(results.length === 10);
  many.forEach((b) => b.close());
  await sleep(200);
});

test('flood de eventos inválidos derruba só o abusador', async () => {
  const bad = new Bot(server.url, 'Flood');
  const good = new Bot(server.url, 'Legit');
  bots.push(bad, good);
  await Promise.all([bad.ready(), good.ready()]);
  for (let i = 0; i < 80; i += 1) bad.socket.emit(`evento:falso:${i}`, { lixo: i });
  await bad.waitFor((b) => !b.socket.connected, { timeout: 3000, label: 'desconexão do abusador' });
  assert.equal(good.socket.connected, true);
  const created = await good.create();
  assert.equal(created.ok, true);
});
