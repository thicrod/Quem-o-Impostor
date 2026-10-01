// Reações, ferramentas do host (remover jogador, passar a coroa) e a
// estatística de "bode expiatório".

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Bot, createRoomWith, everyone, finishDiscussion, playClueRound, roles, setTestEnv, sleep,
  startAndReveal, startServer, vote,
} from './helpers.js';

setTestEnv();

let server;
const bots = [];

before(async () => {
  server = await startServer();
});

after(async () => {
  bots.forEach((b) => b.close());
  await server.close();
});

async function room(n, names) {
  const r = await createRoomWith(server.url, n, { names });
  bots.push(...r.bots);
  return r;
}

const reactionsOf = (bot) => bot.received.filter((r) => r.event === 'reaction').map((r) => r.payload);

test('reações chegam para todos da sala, só emojis permitidos', async () => {
  const { bots: three, host } = await room(3, ['Rea1', 'Rea2', 'Rea3']);
  assert.ok(host.meta.reactions.includes('😂'));
  const sent = await three[1].request('reaction:send', { emoji: '😂' });
  assert.equal(sent.ok, true);
  await everyone(three, (b) => b.waitFor((x) => reactionsOf(x).length === 1, { label: 'reação' }));
  const [r] = reactionsOf(three[2]);
  assert.equal(r.emoji, '😂');
  assert.equal(r.playerId, three[1].id);
  assert.ok(r.id);
  assert.equal((await three[1].request('reaction:send', { emoji: '💩' })).ok, false);
  assert.equal((await three[1].request('reaction:send', { emoji: '<script>' })).ok, false);

  // Outra sala não recebe
  const { bots: other } = await room(3, ['Fora1', 'Fora2', 'Fora3']);
  await sleep(150);
  assert.equal(reactionsOf(other[0]).length, 0);
});

test('spam de reações é limitado sem derrubar o jogador', async () => {
  const { bots: three } = await room(3, ['Spm1', 'Spm2', 'Spm3']);
  const results = [];
  for (let i = 0; i < 80; i += 1) results.push(await three[0].request('reaction:send', { emoji: '👏' }));
  const limited = results.filter((r) => r.code === 'RATE_LIMITED').length;
  assert.ok(limited > 50, `esperava muitos bloqueios, veio ${limited}`);
  assert.equal(three[0].socket.connected, true, 'continua conectado (reação não conta como abuso)');
});

test('host remove um jogador: ele sai e não consegue voltar', async () => {
  const { bots: four, host, code } = await room(4, ['Kick1', 'Kick2', 'Kick3', 'Kick4']);
  const [, target, other] = four;
  assert.equal((await other.request('player:kick', { targetId: target.id })).code, 'NOT_HOST');
  assert.equal((await host.request('player:kick', { targetId: host.id })).code, 'BAD_TARGET');
  assert.equal((await host.request('player:kick', { targetId: 'abcdef123456' })).code, 'BAD_TARGET');

  const kickedEvent = new Promise((resolve) => target.socket.once('room:kicked', resolve));
  assert.equal((await host.request('player:kick', { targetId: target.id })).ok, true);
  const payload = await kickedEvent;
  assert.match(payload.message, /removeu/);
  await host.waitFor((b) => b.state.players.length === 3, { label: '3 jogadores' });
  assert.ok(host.notices.some((n) => /removido pelo host/.test(n.text)));

  // Não consegue voltar com a mesma identidade (nem por resume nem por join)
  assert.equal((await target.resume(code)).code, 'SESSION_GONE');
  assert.equal((await target.join(code)).code, 'KICKED');
  // Ações de sala não funcionam mais para ele
  assert.equal((await target.request('reaction:send', { emoji: '😂' })).code, 'NOT_IN_ROOM');
  // Um jogador novo entra normalmente na vaga
  const fresh = new Bot(server.url, 'Novato');
  bots.push(fresh);
  await fresh.ready();
  assert.equal((await fresh.join(code)).ok, true);

  // Durante a rodada não dá para remover
  await startAndReveal([host, other, four[3], fresh]);
  assert.equal((await host.request('player:kick', { targetId: other.id })).code, 'WRONG_PHASE');
});

test('host passa a coroa para outro jogador (a qualquer momento)', async () => {
  const { bots: three, host } = await room(3, ['Coroa1', 'Coroa2', 'Coroa3']);
  const [, heir, other] = three;
  assert.equal((await other.request('host:transfer', { targetId: heir.id })).code, 'NOT_HOST');
  assert.equal((await host.request('host:transfer', { targetId: host.id })).code, 'BAD_TARGET');
  assert.equal((await host.request('host:transfer', { targetId: heir.id })).ok, true);
  await everyone(three, (b) => b.waitFor((x) => x.state.hostId === heir.id, { label: 'novo host' }));
  assert.equal(heir.state.you.isHost, true);
  assert.equal(host.state.you.isHost, false);
  assert.equal((await host.request('game:start')).code, 'NOT_HOST');
  assert.ok(other.notices.some((n) => n.kind === 'host' && n.text.includes(heir.nickname)));

  // Durante a rodada também funciona; jogador desconectado não pode receber
  await startAndReveal(three);
  other.disconnect();
  await heir.waitFor((b) => b.state.players.find((p) => p.id === other.id)?.connected === false, { label: 'caiu' });
  assert.equal((await heir.request('host:transfer', { targetId: other.id })).code, 'BAD_TARGET');
  assert.equal((await heir.request('host:transfer', { targetId: host.id })).ok, true);
  await host.waitFor((b) => b.state.you.isHost, { label: 'coroa de volta' });
});

test('estatística: inocente eliminado vira "bode expiatório"', async () => {
  const { bots: three, host } = await room(3, ['Bode1', 'Bode2', 'Bode3']);
  await startAndReveal(three);
  const { impostor, innocents } = roles(three);
  await playClueRound(three);
  await finishDiscussion(three);
  const scapegoat = innocents[0];
  const plan = Object.fromEntries(three.map((b) => [
    b.nickname, b === scapegoat ? innocents[1].nickname : scapegoat.nickname,
  ]));
  await vote(three, plan);
  await host.waitPhase('result', { timeout: 8000 });
  const stats = (id) => host.state.players.find((p) => p.id === id).stats;
  assert.equal(host.state.game.result.outcome, 'escaped');
  assert.equal(stats(scapegoat.id).framed, 1);
  assert.equal(stats(innocents[1].id).framed, 0);
  assert.equal(stats(impostor.id).framed, 0);
});
