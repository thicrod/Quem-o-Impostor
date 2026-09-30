#!/usr/bin/env node
// Simulação multiplayer narrada: 6 jogadores robôs jogam várias rodadas
// completas contra um servidor real (em memória, timers acelerados).
//
//   npm run simulate
//
// Cobre: lobby, avatares, cartas, pistas (inclusive pista bloqueada),
// chat, votação, empate, última chance, os 3 tipos de pontuação,
// reconexão no meio da partida, troca de host e "jogar novamente".

import assert from 'node:assert/strict';
import {
  createRoomWith, everyone, finishDiscussion, playClueRound, roles, setTestEnv, sleep,
  startAndReveal, startServer, vote,
} from '../server/test/helpers.js';

setTestEnv({ TIMER_SCALE: process.env.TIMER_SCALE || '0.05' });

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
};
const log = (...a) => console.log(...a);
const step = (title) => log(`\n${c.magenta('━━')} ${c.bold(title)}`);
const checks = [];
const check = (label, fn) => {
  fn();
  checks.push(label);
  log(`   ${c.green('✔')} ${label}`);
};

const NAMES = ['João', 'Pedro', 'Lucas', 'Thiago', 'Maria', 'Ana'];
const AVATARS = ['🦊', '🐼', '🐸', '🐙', '🦁', '🤖'];

function everyoneVotes(bots, target) {
  const other = bots.find((b) => b !== target);
  return Object.fromEntries(bots.map((b) => [b.nickname, b === target ? other.nickname : target.nickname]));
}

function printScoreboard(state) {
  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  ranked.forEach((p, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || '  ';
    log(`   ${medal} ${p.avatar} ${p.nickname.padEnd(8)} ${String(p.score).padStart(2)} pts  ${c.dim(`vitórias ${p.stats.wins} · rodadas ${p.stats.rounds} · impostor ${p.stats.timesImpostor}x · descobriu ${p.stats.impostorsFound}`)}`);
  });
}

async function playRound(bots, { label, plan, guess, reconnectDuring }) {
  const host = bots.find((b) => b.state.you.isHost);
  step(label);
  const secret = await startAndReveal(bots.filter((b) => b.socket.connected));
  await everyone(bots, (b) => b.waitPhase('clues'));
  const { impostor, innocents } = roles(bots);
  log(`   Categoria: ${host.state.game.category.emoji} ${host.state.game.category.label} · palavra secreta: ${c.cyan(secret)}`);
  log(`   Impostor sorteado: ${c.red(`${impostor.nickname}`)} ${impostor.card.word ? c.dim(`(palavra parecida: ${impostor.card.word})`) : c.dim('(sem palavra)')}`);
  check('cada jogador recebeu só a própria carta', () => {
    assert.equal(roles(bots).impostors.length, 1);
    innocents.forEach((b) => assert.equal(b.card.word, secret));
  });

  if (reconnectDuring === 'clues') {
    const victim = innocents[1];
    const card = { ...victim.card };
    log(`   ${c.yellow('⚡')} ${victim.nickname} fechou o navegador no meio das pistas…`);
    await victim.reconnect();
    await victim.resume(host.state.code);
    await victim.waitFor((b) => b.state.phase === 'clues');
    check(`${victim.nickname} voltou com o mesmo papel e palavra`, () => assert.deepEqual(victim.card, card));
  }

  const order = host.state.game.turnOrder.map((id) => bots.find((b) => b.id === id).nickname);
  log(`   Ordem das pistas: ${order.join(' → ')}`);
  const first = bots.find((b) => b.id === host.state.game.turnOrder[0]);
  await host.waitFor((b) => !b.state.game.intro);
  if (first.card.word) {
    const cheat = first.card.word.replace(/\s+/g, '').toUpperCase();
    const res = await first.request('clue:submit', { text: cheat });
    check(`pista "${cheat}" recusada pelo servidor (é a própria palavra)`, () => assert.equal(res.ok, false));
  }
  await playClueRound(bots, { clueFor: (b, r) => `pista${r}${b.nickname.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}` });
  await everyone(bots, (b) => b.waitPhase('discussion'));
  const clues = host.state.game.clues.filter((x) => x.round === host.state.game.round);
  log(`   Pistas: ${clues.map((x) => `${bots.find((b) => b.id === x.playerId).nickname}: "${x.text}"`).join(' · ')}`);
  await bots[2].request('chat:send', { text: `Achei a pista de ${impostor.nickname} meio estranha…` });
  await bots[0].waitFor((b) => b.chat.length >= 1);
  log(`   💬 ${bots[2].nickname}: "${bots[0].chat.at(-1).text}"`);

  if (reconnectDuring === 'discussion') {
    const victim = bots[4];
    log(`   ${c.yellow('⚡')} ${victim.nickname} perdeu a conexão na discussão…`);
    await victim.reconnect();
    await victim.resume(host.state.code);
    await victim.waitFor((b) => b.state.phase === 'discussion' && b.chat.length >= 1);
    check(`${victim.nickname} voltou e recebeu o histórico do chat`, () => assert.ok(victim.chat.length >= 1));
  }

  await finishDiscussion(bots);
  const finalPlan = typeof plan === 'function' ? plan({ impostor, innocents }) : plan;
  let voteRounds = 0;
  for (const p of Array.isArray(finalPlan) ? finalPlan : [finalPlan]) {
    voteRounds += 1;
    if (voteRounds > 1) {
      await host.waitFor((b) => b.state.phase === 'clues' && b.state.game.round === voteRounds, { timeout: 8000 });
      log(`   ${c.yellow('⚡ EMPATE!')} Rodada ${voteRounds}/3: nova rodada de pistas`);
      await playClueRound(bots);
      await finishDiscussion(bots);
    }
    await vote(bots, p);
    await host.waitPhase('voteReveal');
    const rec = host.state.game.voteHistory.at(-1);
    const tally = Object.entries(rec.tallies).filter(([, n]) => n > 0)
      .map(([id, n]) => `${bots.find((b) => b.id === id).nickname} ${n}`).join(', ');
    log(`   🗳️  Votação ${voteRounds}: ${tally}${rec.tie ? c.yellow(' → empate') : ` → eliminado: ${bots.find((b) => b.id === rec.eliminatedId).nickname}`}`);
  }

  if (host.state.game.voteHistory.at(-1).eliminatedId === impostor.id) {
    await impostor.waitPhase('lastChance');
    const attempt = guess === 'correct' ? secret : 'chutei-errado';
    log(`   🚨 Última chance: ${impostor.nickname} chuta "${attempt}"`);
    await impostor.request('guess:submit', { text: attempt });
  }
  await everyone(bots, (b) => b.waitPhase('result', { timeout: 10000 }));
  const { result } = host.state.game;
  const outcomeText = {
    caught: c.green('🟢 O GRUPO VENCEU!'),
    stolen: c.red('🎉 O IMPOSTOR ROUBOU A VITÓRIA!'),
    escaped: c.red('🔴 O IMPOSTOR ESCAPOU!'),
  }[result.outcome];
  log(`   ${outcomeText} ${c.dim(`(palavra: ${result.word})`)}`);
  log(`   Pontos da rodada: ${Object.entries(result.pointsDelta).map(([id, n]) => `${bots.find((b) => b.id === id).nickname} +${n}`).join(', ')}`);
  return { result, impostor, innocents };
}

async function main() {
  const started = Date.now();
  const server = await startServer();
  log(c.bold('\n🎭 Simulação "Quem é o Impostor?" — 6 jogadores'));
  log(c.dim(`   servidor de teste em ${server.url} (timers x${process.env.TIMER_SCALE})`));
  let bots = [];
  try {
    step('Lobby');
    const room = await createRoomWith(server.url, 6, { names: NAMES });
    bots = room.bots;
    const { host, code } = room;
    for (const [i, b] of bots.entries()) await b.request('player:avatar', { avatar: AVATARS[i] });
    await host.waitFor((b) => b.state.players.every((p, i) => p.avatar === AVATARS[i]));
    log(`   Sala ${c.cyan(code)} criada por ${host.nickname}; jogadores: ${host.state.players.map((p) => `${p.avatar} ${p.nickname}`).join(', ')}`);
    check('6 jogadores no lobby, host definido, avatares salvos no servidor', () => {
      assert.equal(host.state.players.length, 6);
      assert.equal(host.state.hostId, host.id);
    });
    await host.request('settings:update', { category: 'comida', impostorMode: 'similar', clueSeconds: 30, discussionSeconds: 90 });

    // Rodada 1: grupo acerta, impostor erra o palpite, com reconexão durante as pistas
    const r1 = await playRound(bots, {
      label: 'Rodada 1 — grupo encontra o impostor',
      plan: ({ impostor }) => everyoneVotes(bots, impostor),
      guess: 'wrong',
      reconnectDuring: 'clues',
    });
    check('+2 para cada inocente, 0 para o impostor', () => {
      r1.innocents.forEach((b) => assert.equal(r1.result.pointsDelta[b.id], 2));
      assert.equal(r1.result.pointsDelta[r1.impostor.id], 0);
    });

    // Rodada 2: empate duas vezes, depois o impostor é pego mas acerta a palavra
    await host.request('game:playAgain');
    await host.waitFor((b) => b.state.game?.number === 2);
    const r2 = await playRound(bots, {
      label: 'Rodada 2 — empates e impostor roubando a vitória',
      plan: ({ impostor }) => {
        const [a, b] = bots.filter((x) => x !== impostor);
        const rest = bots.filter((x) => x !== a && x !== b);
        const tie = {
          [a.nickname]: b.nickname,
          [b.nickname]: a.nickname,
          [rest[0].nickname]: a.nickname,
          [rest[1].nickname]: a.nickname,
          [rest[2].nickname]: b.nickname,
          [rest[3].nickname]: b.nickname,
        };
        return [tie, tie, everyoneVotes(bots, impostor)];
      },
      guess: 'correct',
      reconnectDuring: 'discussion',
    });
    check('empate gerou novas rodadas (3 votações)', () => assert.equal(host.state.game.voteHistory.length, 3));
    check('+2 para o impostor que adivinhou, 0 para o grupo', () => {
      assert.equal(r2.result.outcome, 'stolen');
      assert.equal(r2.result.pointsDelta[r2.impostor.id], 2);
      r2.innocents.forEach((b) => assert.equal(r2.result.pointsDelta[b.id], 0));
    });

    // Troca de host: o host cai e o cargo passa para o próximo
    step('Host cai');
    host.disconnect();
    await bots[1].waitFor((b) => b.state.hostId !== host.id, { timeout: 5000 });
    const newHost = bots.find((b) => b.id === bots[1].state.hostId);
    log(`   👑 ${newHost.nickname} virou host automaticamente`);
    await host.reconnect();
    await host.resume(code);
    await host.waitFor((b) => b.state?.you);
    check('host antigo voltou sem recuperar o cargo', () => assert.equal(host.state.you.isHost, false));

    // Rodada 3: impostor escapa
    await newHost.request('game:playAgain');
    await newHost.waitFor((b) => b.state.game?.number === 3);
    const r3 = await playRound(bots, {
      label: 'Rodada 3 — impostor escapa',
      plan: ({ innocents }) => everyoneVotes(bots, innocents[0]),
    });
    check('+3 para o impostor que escapou', () => {
      assert.equal(r3.result.outcome, 'escaped');
      assert.equal(r3.result.pointsDelta[r3.impostor.id], 3);
    });

    step('Placar final');
    printScoreboard(newHost.state);
    check('pontuação acumulada = soma das rodadas', () => {
      for (const p of newHost.state.players) {
        const sum = [r1, r2, r3].reduce((acc, r) => acc + (r.result.pointsDelta[p.id] || 0), 0);
        assert.equal(p.score, sum);
      }
    });
    await sleep(50);
    log(`\n${c.green(c.bold(`✅ Simulação concluída: ${checks.length} verificações OK em ${((Date.now() - started) / 1000).toFixed(1)}s`))}\n`);
  } finally {
    bots.forEach((b) => b.close());
    await server.close();
  }
}

main().catch((err) => {
  console.error(`\n${c.red(c.bold('❌ Simulação falhou:'))}`, err);
  process.exit(1);
});
