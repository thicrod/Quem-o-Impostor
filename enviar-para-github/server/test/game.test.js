// Testes de integração: servidor real + 6 clientes Socket.IO.
// Timers acelerados (TIMER_SCALE=0.05) para rodar partidas inteiras em segundos.

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Bot, createRoomWith, everyone, finishDiscussion, playClueRound, roles, setTestEnv, sleep,
  startAndReveal, startServer, vote,
} from './helpers.js';

setTestEnv();

let server;
const bots = [];
const track = (list) => {
  bots.push(...list);
  return list;
};

before(async () => {
  server = await startServer();
});

after(async () => {
  bots.forEach((b) => b.close());
  await server.close();
});

async function sixPlayers(settings = {}) {
  const room = await createRoomWith(server.url, 6);
  track(room.bots);
  if (Object.keys(settings).length) {
    const res = await room.host.request('settings:update', settings);
    assert.equal(res.ok, true, res.message);
  }
  return room;
}

/** Plano de votos: todo mundo vota no alvo; o alvo vota em outra pessoa. */
function everyoneVotes(allBots, target) {
  const other = allBots.find((b) => b !== target);
  return Object.fromEntries(allBots.map((b) => [b.nickname, b === target ? other.nickname : target.nickname]));
}

describe('fluxo completo com 6 jogadores', () => {
  test('lobby → carta → pistas → discussão → votação → resultado (grupo acerta, impostor erra)', async () => {
    const { bots: six, host, code } = await sixPlayers({ category: 'comida', impostorMode: 'similar', discussionMode: 'chat' });
    assert.match(code, /^[A-Z2-9]{6}$/);
    assert.equal(host.state.you.isHost, true);
    assert.equal(host.state.settings.impostorMode, 'similar');

    const secret = await startAndReveal(six);
    const { impostors, innocents, impostor } = roles(six);
    assert.equal(impostors.length, 1, 'exatamente 1 impostor');
    assert.equal(innocents.length, 5);
    for (const b of innocents) assert.equal(b.card.word, secret, 'inocentes têm a mesma palavra');
    assert.ok(impostor.card.word && impostor.card.word !== secret, 'impostor recebe palavra parecida');
    assert.equal(host.state.game.category.key, 'comida');

    // Pista da própria palavra (e variações) é recusada pelo servidor
    await host.waitFor((b) => b.state.game.currentTurnId && !b.state.game.intro, { label: 'primeira vez' });
    const first = six.find((b) => b.id === host.state.game.currentTurnId);
    const notTurn = six.find((b) => b !== first);
    assert.equal((await notTurn.request('clue:submit', { text: 'qualquer' })).code, 'NOT_YOUR_TURN');
    assert.equal((await first.request('clue:submit', { text: 'duas palavras' })).code, 'CLUE_ONE_WORD');
    const ownWord = first.card.word;
    if (ownWord) {
      for (const variant of [ownWord.toUpperCase(), `${ownWord.toLowerCase()}s`]) {
        const r = await first.request('clue:submit', { text: variant.replace(/\s+/g, '') });
        assert.equal(r.ok, false, `variação "${variant}" deveria ser bloqueada`);
      }
    }

    await playClueRound(six);
    await everyone(six, (b) => b.waitPhase('discussion'));
    assert.equal(host.state.game.clues.length, 6);

    // Chat: sanitizado e entregue a todos
    const sent = await six[1].request('chat:send', { text: '  achei a pista do​ Jogador3   estranha  ' });
    assert.equal(sent.ok, true);
    await everyone(six, (b) => b.waitFor((x) => x.chat.length >= 1, { label: 'chat' }));
    assert.equal(six[4].chat[0].text, 'achei a pista do Jogador3 estranha');

    await finishDiscussion(six);

    // Votos ficam ocultos até a revelação
    await vote(six, Object.fromEntries(Object.entries(everyoneVotes(six, impostor)).slice(0, 3)));
    await host.waitFor((b) => b.state.game.votedIds.length === 3, { label: '3 votos' });
    assert.equal(host.state.game.voteHistory.length, 0, 'nenhum voto revelado durante a votação');
    assert.equal(six[5].state.you.votedFor, null);
    await vote(six, Object.fromEntries(Object.entries(everyoneVotes(six, impostor)).slice(3)));

    await host.waitPhase('voteReveal');
    const record = host.state.game.voteHistory.at(-1);
    assert.equal(record.eliminatedId, impostor.id);
    assert.equal(record.tallies[impostor.id], 5);

    await impostor.waitPhase('lastChance');
    const wrong = await impostor.request('guess:submit', { text: 'palavraerrada' });
    assert.equal(wrong.ok, true);
    await everyone(six, (b) => b.waitPhase('result'));
    const { result } = host.state.game;
    assert.equal(result.outcome, 'caught');
    assert.equal(result.word, secret);
    for (const b of innocents) {
      assert.equal(result.pointsDelta[b.id], 2);
      const me = host.state.players.find((p) => p.id === b.id);
      assert.equal(me.score, 2);
      assert.equal(me.stats.wins, 1);
      assert.equal(me.stats.impostorsFound, 1);
      assert.equal(me.stats.rounds, 1);
    }
    const imp = host.state.players.find((p) => p.id === impostor.id);
    assert.equal(imp.score, 0);
    assert.equal(imp.stats.timesImpostor, 1);
    assert.equal(imp.stats.wins, 0);

    // Jogar novamente: mesmos jogadores, configurações e pontos; nova palavra
    const again = await host.request('game:playAgain');
    assert.equal(again.ok, true);
    await everyone(six, (b) => b.waitFor((x) => x.state.phase === 'reveal' && x.state.game.number === 2, { label: 'rodada 2' }));
    assert.equal(host.state.players.length, 6);
    assert.deepEqual(host.state.settings.categories, ['comida']);
    assert.equal(host.state.players.find((p) => p.id === innocents[0].id).score, 2);
    const newSecret = six.find((b) => b.card.role === 'innocent').card.word;
    assert.notEqual(newSecret, secret, 'palavra nova');
    assert.equal(six[0].chat.length, 0, 'chat zerado');
  });

  test('impostor eliminado que adivinha a palavra rouba a vitória (+2 impostor, 0 grupo)', async () => {
    const { bots: six, host } = await sixPlayers({ category: 'animais' });
    const secret = await startAndReveal(six);
    const { impostor, innocents } = roles(six);
    assert.equal(impostor.card.word, null, 'modo sem palavra: impostor não recebe palavra');
    await playClueRound(six);
    await finishDiscussion(six);
    await vote(six, everyoneVotes(six, impostor));
    await impostor.waitPhase('lastChance');
    // palpite com acento/caixa diferentes ainda vale
    const guess = secret.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    assert.equal((await innocents[0].request('guess:submit', { text: secret })).code, 'NOT_YOUR_TURN');
    await impostor.request('guess:submit', { text: guess });
    await host.waitPhase('result');
    const { result } = host.state.game;
    assert.equal(result.outcome, 'stolen');
    assert.equal(result.guessCorrect, true);
    assert.equal(result.pointsDelta[impostor.id], 2);
    for (const b of innocents) assert.equal(result.pointsDelta[b.id], 0);
    assert.equal(host.state.players.find((p) => p.id === impostor.id).stats.steals, 1);
  });

  test('impostor escapa quando o grupo elimina um inocente (+3 impostor)', async () => {
    const { bots: six, host } = await sixPlayers();
    await startAndReveal(six);
    const { impostor, innocents } = roles(six);
    await playClueRound(six);
    await finishDiscussion(six);
    await vote(six, everyoneVotes(six, innocents[0]));
    await host.waitPhase('result', { timeout: 8000 });
    const { result } = host.state.game;
    assert.equal(result.outcome, 'escaped');
    assert.equal(result.reason, 'wrongVote');
    assert.equal(result.eliminatedId, innocents[0].id);
    assert.equal(result.pointsDelta[impostor.id], 3);
    for (const b of innocents) assert.equal(result.pointsDelta[b.id], 0);
    const imp = host.state.players.find((p) => p.id === impostor.id);
    assert.equal(imp.stats.escapes, 1);
    assert.equal(imp.stats.wins, 1);
  });

  test('dois impostores só com 6 jogadores', async () => {
    const small = await createRoomWith(server.url, 5);
    track(small.bots);
    const denied = await small.host.request('settings:update', { impostorCount: 2 });
    assert.equal(denied.ok, false);
    const { bots: six, host } = await sixPlayers({ impostorCount: 2 });
    assert.equal(host.state.settings.impostorCount, 2);
    await startAndReveal(six);
    assert.equal(roles(six).impostors.length, 2);
    assert.equal(host.state.game.impostorCount, 2);
  });

  test('categoria aleatória é sorteada pelo servidor e exibida', async () => {
    const { bots: six, host } = await sixPlayers({ category: 'aleatoria' });
    await startAndReveal(six);
    const cat = host.state.game.category;
    assert.ok(cat.key !== 'aleatoria' && cat.label && cat.emoji);
    assert.equal(host.state.game.randomCategory, true);
  });
});

describe('segurança e autoridade do servidor', () => {
  test('a palavra nunca vaza para quem não deve recebê-la', async () => {
    const { bots: six, host } = await sixPlayers({ category: 'paises', impostorMode: 'similar' });
    const secret = await startAndReveal(six);
    const { impostor, innocents } = roles(six);
    const similar = impostor.card.word;
    await playClueRound(six);
    await finishDiscussion(six);
    await vote(six, everyoneVotes(six, innocents[0]));
    await host.waitPhase('result', { timeout: 8000 });
    const beforeResult = (bot) => bot.received.filter((r) => r.event !== 'room:state' || r.payload.phase !== 'result');
    const leaks = (bot, word) => beforeResult(bot).some((r) => JSON.stringify(r.payload ?? '').includes(`"${word}"`));
    assert.equal(leaks(impostor, secret), false, 'impostor não recebe a palavra secreta');
    for (const b of innocents) assert.equal(leaks(b, similar), false, 'inocente não recebe a palavra do impostor');
    // ninguém recebe clientId de outro jogador nem a lista de impostores antes do fim
    for (const b of six) {
      const dump = JSON.stringify(beforeResult(b).map((r) => r.payload));
      for (const other of six) if (other !== b) assert.ok(!dump.includes(other.clientId), 'clientId vazou');
      assert.ok(!dump.includes('impostorIds'), 'impostorIds vazou antes do resultado');
    }
  });

  test('cliente não consegue manipular jogo, votos ou outro jogador', async () => {
    const { bots: six, host } = await sixPlayers();
    const guest = six[1];
    assert.equal((await guest.request('game:start')).code, 'NOT_HOST');
    assert.equal((await guest.request('settings:update', { category: 'filmes' })).code, 'NOT_HOST');
    assert.equal((await host.request('settings:update', { clueSeconds: 999 })).ok, false);
    assert.equal((await host.request('settings:update', { category: 'naoexiste' })).code, 'BAD_SETTING');
    assert.equal((await host.request('settings:update', {})).code, 'BAD_SETTING');
    assert.equal((await guest.request('chat:send', { text: 'oi' })).code, 'WRONG_PHASE');
    assert.equal((await guest.request('vote:cast', { targetId: host.id })).code, 'WRONG_PHASE');
    assert.equal((await guest.request('vote:skip')).code, 'WRONG_PHASE');
    assert.equal((await guest.request('discussion:startVoting')).code, 'NOT_HOST');
    assert.equal((await guest.request('game:end')).code, 'NOT_HOST');
    assert.equal((await host.request('game:end')).code, 'WRONG_PHASE');

    await startAndReveal(six);
    await host.waitFor((b) => b.state.game.currentTurnId, { label: 'vez' });
    const turn = six.find((b) => b.id === host.state.game.currentTurnId);
    const other = six.find((b) => b !== turn);
    // tentar mandar pista "em nome" de outro: o servidor ignora qualquer id do payload
    const spoof = await other.request('clue:submit', { text: 'fake', playerId: turn.id });
    assert.equal(spoof.code, 'NOT_YOUR_TURN');
    await playClueRound(six);
    await finishDiscussion(six);
    assert.equal((await six[0].request('vote:cast', { targetId: six[0].id })).code, 'SELF_VOTE');
    assert.equal((await six[0].request('vote:cast', { targetId: 'abcdef123456' })).code, 'BAD_TARGET');
    assert.equal((await six[0].request('vote:cast', { targetId: { $gt: '' } })).code, 'BAD_REQUEST');
    assert.equal((await six[0].request('vote:cast', { targetId: six[1].id })).ok, true);
    assert.equal((await six[0].request('vote:cast', { targetId: six[2].id })).code, 'ALREADY_VOTED');
    assert.equal((await six[0].request('vote:skip')).code, 'ALREADY_VOTED');
    assert.equal((await six[0].request('game:playAgain')).code, 'WRONG_PHASE');
  });

  test('eventos e payloads inválidos não derrubam o servidor', async () => {
    const bot = track([new Bot(server.url, 'Hacker')])[0];
    await bot.ready();
    const garbage = [
      ['room:create', 'string'], ['room:create', null], ['room:create', []], ['room:create', { clientId: 1 }],
      ['room:join', { clientId: bot.clientId, code: 'ZZ', nickname: 'x' }],
      ['room:join', { clientId: bot.clientId, code: 12345, nickname: 'Hack' }],
      ['room:resume', { clientId: '../../', code: 'ABCDEF' }],
      ['clue:submit', { text: 'x' }], ['vote:cast', {}], ['settings:update', { impostorMode: 'god' }],
    ];
    for (const [event, payload] of garbage) {
      const res = await bot.request(event, payload);
      assert.equal(res.ok, false, `${event} deveria falhar`);
      assert.ok(res.message && !/at .*\.js/.test(res.message), 'sem stack trace');
    }
    // evento desconhecido e emit sem callback: ignorados
    bot.socket.emit('admin:giveMePoints', { points: 999 });
    bot.socket.emit('room:create', { clientId: bot.clientId, nickname: 'SemAck' });
    await sleep(100);
    assert.equal(bot.socket.connected, true);
    const health = await fetch(`${server.url}/health`).then((r) => r.json());
    assert.equal(health.ok, true);
  });

  test('rate limit do chat contra spam', async () => {
    const { bots: three } = await (async () => {
      const r = await createRoomWith(server.url, 3, { names: ['Spam1', 'Spam2', 'Spam3'] });
      track(r.bots);
      assert.equal((await r.host.request('settings:update', { discussionMode: 'chat' })).ok, true);
      return r;
    })();
    await startAndReveal(three);
    await playClueRound(three);
    await everyone(three, (b) => b.waitPhase('discussion'));
    const results = [];
    for (let i = 0; i < 12; i += 1) results.push(await three[0].request('chat:send', { text: `msg ${i}` }));
    const limited = results.filter((r) => r.code === 'RATE_LIMITED').length;
    assert.ok(limited >= 5, `esperava bloqueios por spam, veio ${limited}`);
    await sleep(1500); // deixa o balde recarregar
    const tooLong = await three[1].request('chat:send', { text: 'x'.repeat(1000) });
    assert.equal(tooLong.ok, false, 'mensagem acima do limite é recusada');
    // pacote gigante (> 4 KB) derruba só a conexão do abusador
    three[2].socket.emit('chat:send', { text: 'x'.repeat(10_000) });
    await three[2].waitFor((b) => !b.socket.connected, { label: 'desconexão por payload gigante' });
    assert.equal(three[0].socket.connected, true);
  });
});

describe('validações de entrada na sala', () => {
  test('sala cheia, inexistente, código inválido, apelido duplicado, menos de 3 jogadores', async () => {
    const { code } = await sixPlayers();
    const seventh = track([new Bot(server.url, 'Setimo')])[0];
    assert.equal((await seventh.join(code)).code, 'ROOM_FULL');
    assert.equal((await seventh.join('ZZZZZZ')).code, 'ROOM_NOT_FOUND');
    assert.equal((await seventh.join('abc')).code, 'INVALID_CODE');
    assert.equal((await seventh.join('ABC10O')).code, 'INVALID_CODE');

    const pair = track([new Bot(server.url, 'João'), new Bot(server.url, 'joao'), new Bot(server.url, 'Ana')]);
    const created = await pair[0].create();
    assert.equal((await pair[1].join(created.code)).code, 'NICK_TAKEN', 'João == joao');
    assert.equal((await pair[1].join(created.code, 'JOÃO ')).code, 'NICK_TAKEN');
    assert.equal((await pair[1].join(created.code, 'X')).code, 'NICK_SHORT');
    assert.equal((await pair[1].join(created.code, 'Joana')).ok, true);
    assert.equal((await pair[0].request('game:start')).code, 'NOT_ENOUGH_PLAYERS');
    assert.equal((await pair[2].join(created.code)).ok, true);
    await pair[0].waitFor((b) => b.state.players.length === 3);
    assert.equal((await pair[0].request('game:start')).ok, true);
  });
});

describe('reconexão', () => {
  test('cair e voltar no lobby, pistas, discussão e votação mantém sala, papel e pontos', async () => {
    const { bots: six, host, code } = await sixPlayers({
      category: 'objetos', impostorMode: 'similar', clueSeconds: 60, discussionMode: 'chat',
    });
    const victim = six[3];
    const originalId = victim.id;

    // Lobby
    await victim.reconnect();
    assert.equal((await victim.resume(code)).ok, true);
    await victim.waitFor((b) => b.state?.you?.id === originalId, { label: 'mesmo id' });
    assert.equal(host.state.players.length, 6, 'sem jogador duplicado');

    await startAndReveal(six);
    const card = { ...victim.card };

    // Pistas: cai e volta com a mesma carta
    victim.disconnect();
    await host.waitFor((b) => b.state.players.find((p) => p.id === originalId)?.connected === false, { label: 'desconectado' });
    await victim.reconnect();
    assert.equal((await victim.resume(code)).ok, true);
    await victim.waitFor((b) => b.state?.phase === 'clues' && b.state.you.card, { label: 'estado após reconectar' });
    assert.deepEqual(victim.card, card, 'mesmo papel e palavra');
    assert.equal(victim.id, originalId);
    await playClueRound(six);

    // Discussão: histórico do chat volta junto
    await everyone(six, (b) => b.waitPhase('discussion'));
    await six[0].request('chat:send', { text: 'mensagem antes da queda' });
    await victim.waitFor((b) => b.chat.length === 1);
    await victim.reconnect();
    // Entrar de novo pelo código (em vez de resume) também reconecta sem duplicar
    assert.equal((await victim.join(code, 'OutroNome')).ok, true);
    await victim.waitFor((b) => b.state?.phase === 'discussion');
    assert.equal(victim.chat.length, 1, 'histórico do chat restaurado');
    assert.equal(victim.state.players.find((p) => p.id === originalId).nickname, victim.nickname);
    assert.equal(host.state.players.length, 6);
    await finishDiscussion(six);

    // Votação: cai antes de votar, volta e vota normalmente
    victim.disconnect();
    await host.waitFor((b) => b.state.players.find((p) => p.id === originalId)?.connected === false);
    const { impostor } = roles(six);
    const target = impostor === victim ? six[0] : impostor;
    const others = six.filter((b) => b !== victim);
    const firstVoters = others.filter((b) => b !== target).slice(0, 2);
    await vote(firstVoters, Object.fromEntries(firstVoters.map((b) => [b.nickname, target.nickname])), six);
    await victim.reconnect();
    assert.equal((await victim.resume(code)).ok, true);
    await victim.waitPhase('voting');
    assert.equal((await victim.request('vote:cast', { targetId: target.id })).ok, true);
    const rest = others.filter((b) => b !== target && !firstVoters.includes(b));
    await vote(rest, Object.fromEntries(rest.map((b) => [b.nickname, target.nickname])), six);
    await target.request('vote:cast', { targetId: six.find((b) => b !== target).id });
    await host.waitPhase('voteReveal');
    assert.equal(host.state.game.voteHistory.at(-1).eliminatedId, target.id);
    await host.waitPhase('result', { timeout: 8000 });
    const scoreBefore = host.state.players.find((p) => p.id === originalId).score;

    // Resultado: fecha e reabre o "navegador" e mantém a pontuação
    await victim.reconnect();
    assert.equal((await victim.resume(code)).ok, true);
    await victim.waitPhase('result');
    assert.equal(victim.state.players.find((p) => p.id === originalId).score, scoreBefore);
  });

  test('outra aba com a mesma identidade assume a sessão (sem duplicar)', async () => {
    const { bots: three, code } = await createRoomWith(server.url, 3, { names: ['Aba1', 'Aba2', 'Aba3'] });
    track(three);
    const twin = track([new Bot(server.url, 'Aba2', { clientId: three[1].clientId })])[0];
    assert.equal((await twin.resume(code)).ok, true);
    await three[1].waitFor((b) => b.replaced, { label: 'sessão substituída' });
    await twin.waitFor((b) => b.state?.you?.id === three[1].id);
    assert.equal(twin.state.players.length, 3);
  });

  test('jogador que sai de verdade perde a sessão', async () => {
    const { bots: three, code } = await createRoomWith(server.url, 4, { names: ['Sai1', 'Sai2', 'Sai3', 'Sai4'] });
    track(three);
    assert.equal((await three[3].request('room:leave')).ok, true);
    await three[0].waitFor((b) => b.state.players.length === 3);
    assert.equal((await three[3].resume(code)).code, 'SESSION_GONE');
  });
});

describe('host', () => {
  test('host cai → cargo passa para o próximo conectado; ao voltar não recupera', async () => {
    const { bots: four, host, code } = await createRoomWith(server.url, 4, { names: ['Host1', 'Seg2', 'Ter3', 'Qua4'] });
    track(four);
    const hostId = host.id;
    host.disconnect();
    await four[1].waitFor((b) => b.state.hostId !== hostId, { label: 'novo host', timeout: 4000 });
    assert.equal(four[1].state.hostId, four[1].id, 'próximo por ordem de entrada');
    await four[2].waitFor((b) => b.notices.some((n) => n.kind === 'host' && n.text.includes('Seg2')), { label: 'aviso de novo host' });
    assert.equal(four[1].state.you.isHost, true);
    await host.reconnect();
    assert.equal((await host.resume(code)).ok, true);
    await host.waitFor((b) => b.state?.you);
    assert.equal(host.state.you.isHost, false, 'não recupera o cargo');
    assert.equal((await host.request('game:start')).code, 'NOT_HOST');
  });

  test('host sai da sala → transferência imediata', async () => {
    const { bots: three, host } = await createRoomWith(server.url, 3, { names: ['Chefe', 'Vice', 'Tri'] });
    track(three);
    await host.request('room:leave');
    await three[1].waitFor((b) => b.state.you.isHost, { timeout: 1000 });
  });

  test('queda rápida do host (refresh) não troca o host', async () => {
    const { bots: three, host, code } = await createRoomWith(server.url, 3, { names: ['Rapido', 'B2', 'B3'] });
    track(three);
    const hostId = host.id;
    await host.reconnect();
    await host.resume(code);
    await sleep(600);
    assert.equal(three[1].state.hostId, hostId);
  });
});

describe('saídas e timers', () => {
  test('inocente sai durante as pistas: o jogo continua; impostor sai: rodada cancelada', async () => {
    const { bots: six, host } = await sixPlayers({ clueSeconds: 60 });
    await startAndReveal(six);
    const { impostor, innocents } = roles(six);
    const leaver = innocents.find((b) => b !== host);
    await leaver.request('room:leave');
    await host.waitFor((b) => b.state.players.length === 5);
    assert.equal(host.state.phase, 'clues');
    assert.ok(!host.state.game.turnOrder.includes(leaver.id));
    const remaining = six.filter((b) => b !== leaver);
    await playClueRound(remaining);
    await host.waitPhase('discussion');
    if (impostor !== host) {
      await impostor.request('room:leave');
      await host.waitPhase('lobby');
      assert.ok(host.notices.some((n) => n.kind === 'abort'));
    }
  });

  test('timers do servidor: vez sem pista é pulada e votação encerra no tempo', async () => {
    const { bots: three, host } = await createRoomWith(server.url, 3, { names: ['Lento1', 'Lento2', 'Lento3'] });
    track(three);
    await host.request('settings:update', { clueSeconds: 20, discussionSeconds: 45 });
    await startAndReveal(three);
    // ninguém manda pista: 3 vezes puladas pelo timer (20s * 0.05 = 1s cada)
    await host.waitPhase('discussion', { timeout: 8000 });
    assert.equal(host.state.game.clues.filter((c) => c.skipped).length, 3);
    await host.waitPhase('voting', { timeout: 6000 });
    assert.ok(host.state.timer.remainingMs > 0 && host.state.timer.remainingMs <= host.state.timer.durationMs);
    await host.waitPhase('voteReveal', { timeout: 6000 });
    const rec = host.state.game.voteHistory.at(-1);
    assert.equal(rec.verdict, 'noVotes', 'sem votos = ninguém sai');
    assert.equal(rec.eliminatedId, null);
    await host.waitPhase('tie', { timeout: 6000 });
    await host.waitFor((b) => b.state.phase === 'clues' && b.state.game.round === 2, { label: 'rodada 2', timeout: 6000 });
  });
});

describe('várias salas simultâneas', () => {
  test('20 salas jogando ao mesmo tempo continuam estáveis', async () => {
    const rooms = await Promise.all(
      Array.from({ length: 20 }, (_, i) => createRoomWith(server.url, 3, { names: [`R${i}a`, `R${i}b`, `R${i}c`] })),
    );
    rooms.forEach((r) => track(r.bots));
    await Promise.all(rooms.map(async ({ bots: three }) => {
      await startAndReveal(three);
      await playClueRound(three);
      await finishDiscussion(three);
      const { impostor } = roles(three);
      await vote(three, everyoneVotes(three, impostor));
      await three[0].waitFor((b) => ['lastChance', 'result'].includes(b.state.phase), { timeout: 8000 });
    }));
    const stats = server.manager.stats();
    assert.ok(stats.rooms >= 20);
  });
});
