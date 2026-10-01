// Regras para jogar em chamada de voz: pular voto, rodadas sem limite quando
// ninguém sai, chat desligado, discussão sem tempo e controles do host.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKIP, createRoomWith, everyone, finishDiscussion, playClueRound, roles, setTestEnv, sleep,
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

async function room(n, settings, names) {
  const r = await createRoomWith(server.url, n, names ? { names } : {});
  bots.push(...r.bots);
  if (settings) {
    const res = await r.host.request('settings:update', settings);
    assert.equal(res.ok, true, res.message);
  }
  return r;
}

/** Joga pistas + discussão de uma rodada e espera a votação. */
async function toVoting(list, round) {
  const host = list[0];
  await host.waitFor((x) => x.state.phase === 'clues' && x.state.game.round === round, { label: `pistas rodada ${round}` });
  await playClueRound(list);
  await finishDiscussion(list);
}

test('pular voto: "pular" vence → ninguém sai e começa outra rodada', async () => {
  const { bots: four, host } = await room(4, null, ['Pula1', 'Pula2', 'Pula3', 'Pula4']);
  await startAndReveal(four);
  await toVoting(four, 1);
  const [a, b, c, d] = four;

  assert.equal((await a.request('vote:skip')).ok, true);
  await a.waitFor((x) => x.state.you.votedFor === 'skip', { label: 'meu voto = pular' });
  assert.equal((await a.request('vote:skip')).code, 'ALREADY_VOTED');
  assert.equal((await a.request('vote:cast', { targetId: b.id })).code, 'ALREADY_VOTED');
  await host.waitFor((x) => x.state.game.votedIds.includes(a.id), { label: 'pular conta como votou' });
  assert.equal(host.state.game.voteHistory.length, 0, 'nada revelado antes da hora');

  await vote(four, { [b.nickname]: SKIP, [c.nickname]: SKIP, [d.nickname]: a.nickname });
  await host.waitPhase('voteReveal');
  const rec = host.state.game.voteHistory.at(-1);
  assert.equal(rec.verdict, 'skipped');
  assert.equal(rec.eliminatedId, null);
  assert.equal(rec.skipCount, 3);
  assert.deepEqual([...rec.skips].sort(), [a.id, b.id, c.id].sort());
  assert.equal(rec.tallies[a.id], 1);
  assert.deepEqual(rec.tiedIds, []);

  await host.waitPhase('tie');
  await host.waitFor((x) => x.state.phase === 'clues' && x.state.game.round === 2, { label: 'rodada 2' });
  assert.equal(host.state.game.maxRounds, undefined, 'sem limite de rodadas');
});

test('empate com o "pular" também não elimina ninguém', async () => {
  const { bots: four, host } = await room(4, null, ['EmpP1', 'EmpP2', 'EmpP3', 'EmpP4']);
  await startAndReveal(four);
  await toVoting(four, 1);
  const [a, b, c, d] = four;
  // 2 votos em A x 2 "pular"
  await vote(four, { [a.nickname]: SKIP, [b.nickname]: a.nickname, [c.nickname]: a.nickname, [d.nickname]: SKIP });
  await host.waitPhase('voteReveal');
  const rec = host.state.game.voteHistory.at(-1);
  assert.equal(rec.verdict, 'tie');
  assert.equal(rec.eliminatedId, null);
  assert.deepEqual(rec.tiedIds, [a.id]);
  await host.waitPhase('tie');
  assert.deepEqual(host.state.game.tiedIds, [a.id]);
});

test('rodadas sem limite: 4 votações sem eliminação e depois o grupo acerta', async () => {
  const { bots: six, host } = await room(6, null, ['Sem1', 'Sem2', 'Sem3', 'Sem4', 'Sem5', 'Sem6']);
  await startAndReveal(six);
  const { impostor, innocents } = roles(six);
  const [a, b, ...rest] = six;
  const tiePlan = {
    [a.nickname]: b.nickname,
    [b.nickname]: a.nickname,
    [rest[0].nickname]: a.nickname,
    [rest[1].nickname]: a.nickname,
    [rest[2].nickname]: b.nickname,
    [rest[3].nickname]: b.nickname,
  };
  const skipPlan = Object.fromEntries(six.map((x) => [x.nickname, SKIP]));
  const plans = [tiePlan, skipPlan, tiePlan, skipPlan];
  for (const [i, plan] of plans.entries()) {
    const round = i + 1;
    await toVoting(six, round);
    await vote(six, plan);
    await host.waitPhase('voteReveal');
    const rec = host.state.game.voteHistory.at(-1);
    assert.equal(rec.eliminatedId, null, `rodada ${round}: ninguém sai`);
    assert.equal(rec.verdict, plan === skipPlan ? 'skipped' : 'tie');
    await host.waitPhase('tie');
  }
  // 5ª rodada: todo mundo vota no impostor
  await toVoting(six, 5);
  const other = innocents[0];
  await vote(six, Object.fromEntries(six.map((x) => [x.nickname, x === impostor ? other.nickname : impostor.nickname])));
  await host.waitPhase('voteReveal');
  assert.equal(host.state.game.voteHistory.at(-1).eliminatedId, impostor.id);
  await host.waitPhase('result', { timeout: 8000 });
  const { game } = host.state;
  assert.equal(game.voteHistory.length, 5);
  assert.equal(game.clues.length, 30, '5 rodadas de pistas');
  assert.equal(game.result.outcome, 'caught');
  for (const x of innocents) assert.equal(game.result.pointsDelta[x.id], 2);
});

test('votos secretos: esconde quem pulou, mas mostra quantos pularam', async () => {
  const { bots: three, host } = await room(3, { anonymousVotes: true }, ['SegP1', 'SegP2', 'SegP3']);
  await startAndReveal(three);
  await toVoting(three, 1);
  const [a, b, c] = three;
  await vote(three, { [a.nickname]: SKIP, [b.nickname]: SKIP, [c.nickname]: a.nickname });
  await everyone(three, (x) => x.waitPhase('voteReveal'));
  for (const x of three) {
    const rec = x.state.game.voteHistory.at(-1);
    assert.equal(rec.skipCount, 2);
    assert.deepEqual(rec.skips, []);
    assert.deepEqual(rec.votes, []);
    assert.equal(rec.verdict, 'skipped');
  }
});

test('modo chamada (padrão) desliga o chat; modo chat liga', async () => {
  const { bots: three, host } = await room(3, null, ['Voz1', 'Voz2', 'Voz3']);
  assert.equal(host.state.settings.discussionMode, 'call');
  await startAndReveal(three);
  await playClueRound(three);
  await everyone(three, (x) => x.waitPhase('discussion'));
  assert.equal(host.state.game.discussionMode, 'call');
  const off = await three[1].request('chat:send', { text: 'oi' });
  assert.equal(off.code, 'CHAT_OFF');

  const { bots: other } = await room(3, { discussionMode: 'chat' }, ['Txt1', 'Txt2', 'Txt3']);
  await startAndReveal(other);
  await playClueRound(other);
  await everyone(other, (x) => x.waitPhase('discussion'));
  assert.equal((await other[1].request('chat:send', { text: 'oi' })).ok, true);
  assert.equal((await host.request('settings:update', { discussionMode: 'radio' })).ok, false);
});

test('discussão sem limite de tempo: sem timer; o host abre a votação', async () => {
  const { bots: three, host } = await room(3, { discussionSeconds: 0 }, ['Livre1', 'Livre2', 'Livre3']);
  assert.equal(host.state.settings.discussionSeconds, 0);
  await startAndReveal(three);
  await playClueRound(three);
  await everyone(three, (x) => x.waitPhase('discussion'));
  assert.equal(host.state.timer, null, 'sem cronômetro');
  assert.equal(host.state.game.discussionSeconds, 0);
  // mais que o menor tempo de discussão com cronômetro (45s x 0.05 = 2,25s)
  await sleep(2600);
  assert.equal(host.state.phase, 'discussion', 'continua conversando');
  const guest = three.find((x) => x !== host);
  assert.equal((await guest.request('discussion:startVoting')).code, 'NOT_HOST');
  // "pronto" de alguns não encerra; o host pode abrir a votação a qualquer momento
  await guest.request('discussion:ready');
  assert.equal((await host.request('discussion:startVoting')).ok, true);
  await everyone(three, (x) => x.waitPhase('voting'));
  assert.ok(host.state.timer?.remainingMs > 0, 'a votação tem tempo');
});

test('host encerra a rodada: todos voltam ao lobby, sem pontos', async () => {
  const { bots: three, host } = await room(3, null, ['Fim1', 'Fim2', 'Fim3']);
  await startAndReveal(three);
  const guest = three.find((x) => x !== host);
  assert.equal((await guest.request('game:end')).code, 'NOT_HOST');
  assert.equal((await host.request('game:end')).ok, true);
  await everyone(three, (x) => x.waitPhase('lobby'));
  assert.equal(host.state.game, null);
  assert.ok(guest.notices.some((n) => n.kind === 'abort' && /encerrou a rodada/.test(n.text)));
  assert.ok(host.state.players.every((p) => p.score === 0 && p.stats.rounds === 0));
  // e dá para começar de novo normalmente
  await startAndReveal(three);
  assert.equal(host.state.game.number, 2);
});
