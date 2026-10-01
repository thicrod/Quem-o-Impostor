// Testes das configurações avançadas: mix de categorias, voltas de pistas,
// tempo de votação, votos anônimos, pontuação-alvo e ajuda do impostor.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoomWith, everyone, finishDiscussion, playClueRound, roles, setTestEnv,
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

function everyoneVotes(all, target) {
  const other = all.find((b) => b !== target);
  return Object.fromEntries(all.map((b) => [b.nickname, b === target ? other.nickname : target.nickname]));
}

test('valida as novas configurações', async () => {
  const { host } = await room(3, null, ['Cfg1', 'Cfg2', 'Cfg3']);
  const bad = [
    { clueRounds: 3 }, { votingSeconds: 10 }, { anonymousVotes: 'sim' }, { targetScore: 5 },
    { impostorHint: 'deus' }, { categories: [] }, { categories: ['naoexiste'] }, { categories: 'comida' },
    { categories: Array.from({ length: 50 }, (_, i) => `c${i}`) },
  ];
  for (const patch of bad) {
    const res = await host.request('settings:update', patch);
    assert.equal(res.ok, false, JSON.stringify(patch));
  }
  const ok = await host.request('settings:update', {
    categories: ['comida', 'animais', 'comida'], clueRounds: 2, votingSeconds: 30,
    anonymousVotes: true, targetScore: 10, impostorHint: 'easy',
  });
  assert.equal(ok.ok, true, ok.message);
  await host.waitFor((b) => b.state.settings.targetScore === 10);
  assert.deepEqual(host.state.settings.categories, ['comida', 'animais']);
  // compatibilidade: "aleatoria" = todas as categorias
  await host.request('settings:update', { category: 'aleatoria' });
  await host.waitFor((b) => b.state.settings.categories.length > 10);
});

test('mix de categorias: o servidor sorteia entre as escolhidas', async () => {
  const { bots: three } = await room(3, { categories: ['comida', 'animais'] }, ['Mix1', 'Mix2', 'Mix3']);
  await startAndReveal(three);
  const game = three[0].state.game;
  assert.ok(['comida', 'animais'].includes(game.category.key));
  assert.equal(game.randomCategory, true);
});

test('duas voltas de pistas antes da discussão + tempo de votação configurável', async () => {
  const { bots: three, host } = await room(3, { clueRounds: 2, votingSeconds: 30 }, ['Volta1', 'Volta2', 'Volta3']);
  await startAndReveal(three);
  // o helper joga as duas voltas (a fase continua "clues" entre elas)
  await playClueRound(three);
  await host.waitPhase('discussion');
  assert.equal(host.state.game.clues.length, 6);
  assert.deepEqual([...new Set(host.state.game.clues.map((c) => c.pass))], [1, 2]);
  await finishDiscussion(three);
  // 30s * TIMER_SCALE(0.05) = 1500ms
  assert.ok(host.state.timer.durationMs <= 1500 && host.state.timer.durationMs >= 1400, `duração ${host.state.timer.durationMs}`);
});

test('votos anônimos: ninguém recebe quem votou em quem', async () => {
  const { bots: three, host } = await room(3, { anonymousVotes: true }, ['Anon1', 'Anon2', 'Anon3']);
  await startAndReveal(three);
  const { impostor } = roles(three);
  await playClueRound(three);
  await finishDiscussion(three);
  await vote(three, everyoneVotes(three, impostor));
  await host.waitPhase('voteReveal');
  const rec = host.state.game.voteHistory.at(-1);
  assert.deepEqual(rec.votes, []);
  assert.equal(rec.tallies[impostor.id], 2);
  for (const b of three) {
    const leaked = b.received.some((r) => r.event === 'room:state'
      && r.payload.game?.voteHistory?.some((v) => v.votes.length > 0));
    assert.equal(leaked, false, `${b.nickname} recebeu votos individuais`);
  }
  await impostor.waitPhase('lastChance');
  await impostor.request('guess:submit', { text: 'errado' });
  await host.waitPhase('result');
  const innocent = three.find((b) => b !== impostor);
  assert.equal(host.state.players.find((p) => p.id === innocent.id).stats.impostorsFound, 1);
});

test('pontuação-alvo: primeiro a chegar vence a partida e o placar zera na nova partida', async () => {
  const { bots: three, host } = await room(3, { targetScore: 10 }, ['Meta1', 'Meta2', 'Meta3']);
  let result;
  for (let i = 0; i < 12; i += 1) {
    if (i > 0) {
      const res = await host.request('game:playAgain');
      assert.equal(res.ok, true, res.message);
    }
    await startAndReveal(three);
    const { impostor } = roles(three);
    await playClueRound(three);
    await finishDiscussion(three);
    // o grupo sempre elimina um inocente: o impostor ganha +3 por rodada
    const innocent = three.find((b) => b !== impostor);
    await vote(three, everyoneVotes(three, innocent));
    await everyone(three, (b) => b.waitPhase('result', { timeout: 8000 }));
    result = host.state.game.result;
    if (result.matchOver) break;
    assert.equal(result.champions.length, 0);
  }
  assert.equal(result.matchOver, true);
  const top = Math.max(...host.state.players.map((p) => p.score));
  assert.ok(top >= 10);
  for (const id of result.champions) {
    const p = host.state.players.find((x) => x.id === id);
    assert.equal(p.score, top);
    assert.equal(p.stats.matchesWon, 1);
  }
  await host.request('game:playAgain');
  await host.waitFor((b) => b.state.phase === 'reveal' && b.state.players.every((p) => p.score === 0), { label: 'placar zerado' });
});

test('ajuda do impostor: difícil esconde a categoria, fácil mostra o formato da palavra', async () => {
  const hard = await room(3, { impostorHint: 'hard', category: 'comida' }, ['Hard1', 'Hard2', 'Hard3']);
  await startAndReveal(hard.bots);
  const { impostor, innocents } = roles(hard.bots);
  assert.equal(impostor.state.game.category.key, 'secreta');
  assert.equal(impostor.state.game.categoryHidden, true);
  for (const b of innocents) assert.equal(b.state.game.category.key, 'comida');
  const leaked = impostor.received.some((r) => r.event === 'room:state' && r.payload.game?.category?.key === 'comida');
  assert.equal(leaked, false, 'categoria vazou para o impostor');
  assert.equal(innocents[0].card.hint, undefined);

  const easy = await room(3, { impostorHint: 'easy', category: 'lugares' }, ['Easy1', 'Easy2', 'Easy3']);
  const secret = await startAndReveal(easy.bots);
  const r2 = roles(easy.bots);
  const expected = secret.split(/[\s-]+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length).filter(Boolean);
  assert.deepEqual(r2.impostor.card.hint, { level: 'easy', shape: expected });
  assert.equal(r2.impostor.state.game.category.key, 'lugares');
});
