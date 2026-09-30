#!/usr/bin/env node
// Teste visual/E2E: abre o jogo em 6 navegadores (celulares, tablet e desktop),
// joga uma partida inteira pela interface e tira screenshots de todas as telas.
// Também verifica: erros no console, scroll horizontal e alvos de toque pequenos.
//
//   npm run build && npm run visual
//   (screenshots em ./screenshots)
//
// Variáveis: CHROMIUM_PATH (executável do Chromium), SHOTS_DIR (pasta de saída).

import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

process.env.LOG_LEVEL ??= 'warn';
process.env.MAX_CONNECTIONS_PER_IP ??= '1000';
const { createGameServer, listen } = await import('../server/src/app.js');

const OUT = process.env.SHOTS_DIR || join(process.cwd(), 'screenshots');
mkdirSync(OUT, { recursive: true });

// Cada aparelho usa um tema diferente, para conferir todos os temas em todas as telas.
const DEVICES = [
  { key: 'iphone-se', name: 'João', viewport: { width: 375, height: 667 }, mobile: true, scale: 2, theme: 'neon', tutorial: true },
  { key: 'iphone-pro-max', name: 'Pedro', viewport: { width: 430, height: 932 }, mobile: true, scale: 3, theme: 'sunset' },
  { key: 'android', name: 'Lucas', viewport: { width: 412, height: 915 }, mobile: true, scale: 2.6, theme: 'ocean' },
  { key: 'tablet', name: 'Thiago', viewport: { width: 820, height: 1180 }, mobile: true, scale: 2, theme: 'galaxy' },
  { key: 'desktop', name: 'Maria', viewport: { width: 1440, height: 900 }, mobile: false, scale: 1, theme: 'hacker' },
  { key: 'android-small', name: 'Ana Clara', viewport: { width: 360, height: 740 }, mobile: true, scale: 2, theme: 'vampire' },
];

const problems = [];
const shots = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function executablePath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined; // usa o Chromium do próprio Playwright
}

async function inspect(p, label) {
  const report = await p.page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth > window.innerWidth + 1;
    const small = [];
    for (const el of document.querySelectorAll('button, input, [role="radio"], a[href]')) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!r.width || !r.height || style.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) continue;
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      if (r.height < 40 || r.width < 40) {
        small.push(`${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 28)} (${Math.round(r.width)}x${Math.round(r.height)})`);
      }
    }
    return { overflow, width: doc.scrollWidth, small };
  });
  if (report.overflow) problems.push(`[${p.device.key}] ${label}: scroll horizontal (largura ${report.width}px)`);
  if (report.small.length) problems.push(`[${p.device.key}] ${label}: alvos de toque < 40px: ${report.small.join(', ')}`);
}

async function shot(p, name, { fullPage = false } = {}) {
  const file = join(OUT, `${name}--${p.device.key}.png`);
  await p.page.screenshot({ path: file, fullPage });
  shots.push(file);
  await inspect(p, name);
}

async function openPlayer(browser, device, url) {
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.scale,
    isMobile: device.mobile,
    hasTouch: device.mobile,
    locale: 'pt-BR',
    reducedMotion: 'no-preference',
  });
  // Preferências salvas antes de abrir (tema do aparelho; tutorial só para quem tem tutorial: true).
  const prefs = { theme: device.theme || 'neon', onboarded: !device.tutorial };
  await context.addInitScript((value) => {
    if (!localStorage.getItem('impostor:prefs')) localStorage.setItem('impostor:prefs', value);
  }, JSON.stringify(prefs));
  const page = await context.newPage();
  const p = { device, context, page, logs: [] };
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) p.logs.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => p.logs.push(`pageerror: ${err.message}`));
  await page.goto(url);
  return p;
}

const byName = (page, role, name) => page.getByRole(role, { name });

async function waitText(p, text, timeout = 15000) {
  await p.page.getByText(text, { exact: false }).first().waitFor({ timeout });
}

async function main() {
  const server = createGameServer();
  const port = await listen(server, 0);
  const url = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ executablePath: executablePath() });
  const players = [];
  try {
    // ── Home + criar sala ──
    const host = await openPlayer(browser, DEVICES[0], url);
    players.push(host);
    // Tutorial da primeira visita
    await host.page.getByRole('dialog', { name: 'Como jogar' }).waitFor();
    await sleep(600);
    await shot(host, '00a-tutorial');
    for (let i = 0; i < 4; i += 1) {
      await byName(host.page, 'button', /próximo/i).click();
      await sleep(350);
    }
    await shot(host, '00b-tutorial-fim');
    await byName(host.page, 'button', /bora jogar/i).click();
    await host.page.getByRole('dialog', { name: 'Como jogar' }).waitFor({ state: 'detached' });
    // Ajustes (tema, som, música, instalar)
    await byName(host.page, 'button', 'Ajustes').click();
    await host.page.getByRole('dialog', { name: 'Ajustes' }).waitFor();
    await sleep(500);
    await shot(host, '00c-ajustes');
    await byName(host.page, 'button', 'Fechar ajustes').click();
    await host.page.getByRole('dialog', { name: 'Ajustes' }).waitFor({ state: 'detached' });
    await waitText(host, 'IMPOSTOR?');
    await host.page.getByRole('button', { name: /criar sala/i }).waitFor();
    await sleep(700);
    await shot(host, '01-home');
    await byName(host.page, 'button', /criar sala/i).click();
    await waitText(host, 'Mínimo de 2 letras');
    await shot(host, '02-home-erro-apelido');
    await host.page.getByLabel('Seu apelido').fill(host.device.name);
    await byName(host.page, 'button', /criar sala/i).click();
    await waitText(host, 'Código da sala');
    await sleep(900);
    const code = (await host.page.getByTitle('Código da sala').textContent()).match(/[A-Z2-9]{6}/)[0];
    await shot(host, '03-lobby-host-sozinho');

    // ── Erros ao entrar ──
    const stranger = await openPlayer(browser, DEVICES[5], url);
    await byName(stranger.page, 'button', /entrar em uma sala/i).click();
    await stranger.page.getByLabel('Seu apelido').fill('Visitante');
    await stranger.page.getByLabel('Código da sala').fill('ZZZZZZ');
    await byName(stranger.page, 'button', /^entrar$/i).click();
    await waitText(stranger, 'Não encontramos essa sala');
    await shot(stranger, '04-entrar-sala-inexistente');
    await stranger.page.getByLabel('Código da sala').fill('AB0');
    await waitText(stranger, 'Códigos usam só letras');
    await shot(stranger, '05-entrar-codigo-invalido');
    await stranger.context.close();

    // ── Outros jogadores entram pelo link de convite ──
    for (const device of DEVICES.slice(1)) {
      const p = await openPlayer(browser, device, `${url}/?sala=${code}`);
      players.push(p);
      await p.page.getByLabel('Código da sala').waitFor();
      if (device.key === 'android-small') {
        // tenta um apelido repetido primeiro (acentos/maiúsculas não enganam)
        await p.page.getByLabel('Seu apelido').fill('JOAO');
        await byName(p.page, 'button', /^entrar$/i).click();
        await waitText(p, 'Esse apelido já está sendo usado');
        await shot(p, '06-entrar-apelido-duplicado');
      }
      await p.page.getByLabel('Seu apelido').fill(device.name);
      if (device.key === 'iphone-pro-max') await shot(p, '07-entrar-pelo-convite');
      await byName(p.page, 'button', /^entrar$/i).click();
      await waitText(p, 'Configurações');
    }
    await waitText(host, 'Ana Clara');
    await sleep(800);
    for (const p of players) await shot(p, '08-lobby', { fullPage: true });

    // ── Host muda configurações ──
    await host.page.getByRole('button', { name: /categorias:/i }).click();
    await waitText(host, 'Escolha as categorias');
    await byName(host.page, 'button', 'Limpar').click();
    await host.page.getByRole('checkbox', { name: /comida/i }).click();
    await host.page.getByRole('checkbox', { name: /animais/i }).click();
    await sleep(400);
    await shot(host, '09-lobby-categorias');
    await byName(host.page, 'button', /salvar \(2\)/i).click();
    await host.page.getByRole('radio', { name: /palavra parecida/i }).click();
    await sleep(500);
    await shot(players[4], '10-lobby-config-desktop');

    // ── Início: carta ──
    await byName(host.page, 'button', /iniciar partida/i).click();
    for (const p of players) await p.page.getByRole('button', { name: /revelar sua carta/i }).waitFor();
    await sleep(900);
    await shot(host, '11-carta-fechada');
    let impostor = null;
    for (const p of players) {
      const isImpostor = (await p.page.getByTestId('card-face').getAttribute('data-role')) === 'impostor';
      p.impostor = isImpostor;
      if (isImpostor) impostor = p;
      p.word = isImpostor ? null : (await p.page.getByTestId('card-word').textContent()).trim();
      await p.page.getByRole('button', { name: /revelar sua carta/i }).click();
    }
    await sleep(1100);
    const innocent = players.find((p) => !p.impostor);
    await shot(innocent, '12-carta-inocente');
    await shot(impostor, '13-carta-impostor');
    const secret = innocent.word;
    for (const p of players) await byName(p.page, 'button', /toquei e vi/i).click();

    // ── Pistas ──
    await waitText(host, 'RODADA DE PISTAS');
    await sleep(500);
    await shot(host, '14-pistas-intro');
    let turns = 0;
    let blockedShot = false;
    while (turns < 6) {
      let current = null;
      for (let tries = 0; tries < 60 && !current; tries += 1) {
        for (const p of players) {
          if (await p.page.locator('#clue-input').isVisible()) current = p;
        }
        if (!current) await sleep(150);
      }
      if (!current) throw new Error('não encontrei de quem é a vez');
      const input = current.page.getByLabel('Sua pista (uma palavra)');
      await input.waitFor();
      if (!blockedShot && !current.impostor) {
        await input.fill(secret.replace(/\s+/g, '').toLowerCase());
        await byName(current.page, 'button', /enviar pista/i).click();
        await waitText(current, 'palavra secreta');
        await shot(current, '15-pista-bloqueada');
        blockedShot = true;
      }
      if (turns === 2) {
        const watcher = players.find((p) => p !== current);
        await shot(current, '16-pistas-minha-vez');
        await shot(watcher, '17-pistas-aguardando');
      }
      await input.fill(['forno', 'queijo', 'redonda', 'massa', 'delivery', 'fatia'][turns]);
      await byName(current.page, 'button', /enviar pista/i).click();
      await current.page.locator('#clue-input').waitFor({ state: 'detached' });
      turns += 1;
      await sleep(250);
    }

    // ── Discussão ──
    await waitText(host, 'DISCUSSÃO');
    const lines = ['Achei a pista “delivery” muito estranha 🤔', 'Eu falei forno porque é óbvio né', 'Quem falou fatia tá suspeito!', 'Calma gente, vamos votar com calma.'];
    for (const [i, text] of lines.entries()) {
      const p = players[i % players.length];
      await p.page.getByRole('textbox', { name: 'Mensagem' }).fill(text);
      await byName(p.page, 'button', 'Enviar mensagem').click();
      await sleep(250);
    }
    await sleep(500);
    await shot(host, '18-discussao');
    await shot(players[4], '19-discussao-desktop');
    await shot(players[5], '20-discussao-android-pequeno');

    // Reconexão: fecha a aba do Lucas e abre de novo (mesmo navegador/localStorage)
    const lucas = players[2];
    await lucas.page.close();
    await waitText(host, 'caiu');
    lucas.page = await lucas.context.newPage();
    lucas.page.on('console', (msg) => {
      if (['error', 'warning'].includes(msg.type())) lucas.logs.push(`${msg.type()}: ${msg.text()}`);
    });
    lucas.page.on('pageerror', (err) => lucas.logs.push(`pageerror: ${err.message}`));
    lucas.page.on('websocket', (ws) => ws.on('framereceived', (f) => {
      const t = String(f.payload);
      if (process.env.DEBUG_WS) lucas.logs.push(`ws<- ${t.slice(0, 90)}`);
    }));
    await lucas.page.goto(url);
    await waitText(lucas, 'DISCUSSÃO');
    await sleep(600);
    await shot(lucas, '21-reconectou-na-discussao');

    // "Reconectando…" (Thiago fica offline por um instante)
    const thiago = players[3];
    await thiago.context.setOffline(true);
    await waitText(thiago, 'Reconectando', 20000);
    await shot(thiago, '22-reconectando');
    await thiago.context.setOffline(false);
    await thiago.page.getByText('Reconectando').waitFor({ state: 'hidden', timeout: 20000 });

    for (const p of players) await byName(p.page, 'button', /pronto para votar/i).click();

    // ── Votação ──
    await waitText(host, 'QUEM É O IMPOSTOR?');
    await sleep(600);
    await shot(host, '23-votacao');
    const impName = impostor.device.name;
    const scapegoat = players.find((p) => !p.impostor);
    for (const [i, p] of players.entries()) {
      const target = p === impostor ? scapegoat.device.name : impName;
      await p.page.getByRole('radio', { name: new RegExp(`^${target}\\.`) }).click();
      if (i === 0) await shot(p, '24-votacao-escolhido');
      await byName(p.page, 'button', /votar em/i).click();
      if (i === 0) {
        await waitText(p, 'VOTO CONFIRMADO');
        await shot(p, '25-voto-confirmado');
      }
    }
    await waitText(host, 'Revelando em');
    await sleep(300);
    await shot(host, '26-revelando-votos');
    await waitText(host, 'Eliminado', 10000);
    await sleep(700);
    await shot(host, '27-votos-revelados');
    await shot(players[4], '28-votos-revelados-desktop');

    // ── Última chance ──
    await waitText(impostor, 'Qual era a palavra?', 12000);
    await sleep(500);
    await shot(impostor, '29-ultima-chance-impostor');
    await shot(innocent, '30-ultima-chance-grupo');
    await impostor.page.getByLabel('Qual era a palavra?').fill('lasanha');
    await byName(impostor.page, 'button', /tentar/i).click();

    // ── Resultado ──
    await waitText(host, 'O IMPOSTOR ERA');
    await sleep(600);
    await shot(host, '31-resultado-suspense');
    await sleep(2200);
    await shot(host, '32-resultado-revelacao');
    await waitText(host, 'Placar total', 8000);
    await sleep(300);
    await innocent.page.getByRole('button', { name: 'Continuar' }).waitFor({ timeout: 4000 });
    await impostor.page.getByRole('button', { name: 'Continuar' }).waitFor({ timeout: 4000 });
    await shot(impostor, '32c-splash-derrota');
    await shot(innocent, '32b-splash-vitoria');
    for (const p of players) await p.page.getByRole('button', { name: 'Continuar' }).waitFor({ state: 'detached', timeout: 8000 });
    await sleep(1200);
    await shot(host, '33-resultado', { fullPage: true });
    await shot(players[4], '34-resultado-desktop', { fullPage: true });
    await shot(impostor, '35-resultado-derrota', { fullPage: true });
    // imagem para compartilhar (no desktop vira download)
    const [download] = await Promise.all([
      players[4].page.waitForEvent('download', { timeout: 10000 }),
      byName(players[4].page, 'button', /compartilhar resultado/i).click(),
    ]);
    const shareFile = join(OUT, '35c-imagem-compartilhar--desktop.png');
    await download.saveAs(shareFile);
    shots.push(shareFile);
    // abre as estatísticas de um jogador no placar
    await host.page.getByRole('button', { name: new RegExp(`${host.device.name}.*pts`) }).first().click();
    await sleep(500);
    await shot(host, '35b-estatisticas');

    // ── Lobby: modo sem palavra + ajuda fácil + votos secretos + partida até 10 ──
    await byName(host.page, 'button', /^⚙️ lobby$/i).click();
    await waitText(host, 'Configurações');
    await host.page.getByRole('radio', { name: /sem palavra/i }).click();
    await host.page.getByRole('radio', { name: /fácil/i }).click();
    await host.page.getByRole('radio', { name: /rápido/i }).click();
    await byName(host.page, 'button', /mais opções/i).click();
    await host.page.getByRole('radio', { name: /secretos/i }).click();
    await host.page.getByRole('radio', { name: /^10 pts$/i }).click();
    await sleep(600);
    await shot(players[4], '35d-lobby-mais-opcoes-desktop', { fullPage: true });
    await shot(host, '35e-lobby-mais-opcoes', { fullPage: true });

    // ── Nova rodada + empate ──
    await byName(host.page, 'button', /iniciar partida/i).click();
    for (const p of players) await p.page.getByRole('button', { name: /revelar sua carta/i }).waitFor();
    for (const p of players) {
      await p.page.getByRole('button', { name: /revelar sua carta/i }).click();
      p.impostor = (await p.page.getByTestId('card-face').getAttribute('data-role')) === 'impostor';
    }
    await sleep(900);
    await shot(host, '36-jogar-novamente-carta');
    await shot(players.find((p) => p.impostor), '36b-carta-impostor-facil');
    for (const p of players) await byName(p.page, 'button', /toquei e vi/i).click();
    turns = 0;
    const words = ['pista', 'ideia', 'sabor', 'cheiro', 'textura', 'cor'];
    while (turns < 6) {
      let current = null;
      for (let tries = 0; tries < 60 && !current; tries += 1) {
        for (const p of players) if (await p.page.locator('#clue-input').isVisible()) current = p;
        if (!current) await sleep(150);
      }
      await current.page.getByLabel('Sua pista (uma palavra)').fill(words[turns]);
      await byName(current.page, 'button', /enviar pista/i).click();
      await current.page.locator('#clue-input').waitFor({ state: 'detached' });
      turns += 1;
      await sleep(250);
    }
    await waitText(host, 'DISCUSSÃO');
    for (const p of players) await byName(p.page, 'button', /pronto para votar/i).click();
    await waitText(host, 'QUEM É O IMPOSTOR?');
    // 3 x 3 entre dois jogadores
    const [a, b, ...rest] = players;
    const plan = new Map([[a, b], [b, a], [rest[0], a], [rest[1], a], [rest[2], b], [rest[3], b]]);
    for (const [voter, target] of plan) {
      await voter.page.getByRole('radio', { name: new RegExp(`^${target.device.name}\\.`) }).click();
      await byName(voter.page, 'button', /votar em/i).click();
    }
    await waitText(host, 'EMPATE', 15000);
    await sleep(900);
    await shot(host, '36c-votos-secretos');
    await waitText(host, 'terão que se explicar', 12000);
    await sleep(700);
    await shot(host, '37-empate');
    await waitText(host, 'Rodada 2/3', 10000);
    await sleep(300);
    await shot(host, '38-rodada-2-intro');

    // ── Sair da sala ──
    await host.page.getByRole('button', { name: 'Sair da sala' }).click();
    await sleep(400);
    await shot(host, '39-confirmar-saida');

    // ── Console ──
    for (const p of players) {
      const relevant = p.logs.filter((l) => !/ERR_INTERNET_DISCONNECTED|net::ERR|WebSocket connection|Failed to load resource/.test(l));
      if (relevant.length) problems.push(`[${p.device.key}] console: ${relevant.join(' | ')}`);
    }
  } catch (err) {
    // Em caso de falha, salva o que cada jogador estava vendo para facilitar o diagnóstico.
    for (const p of players) {
      await p.page.screenshot({ path: join(OUT, `FALHA--${p.device.key}.png`) }).catch(() => {});
      if (p.logs.length) console.error(`[${p.device.key}] console:\n  ${p.logs.slice(-8).join('\n  ')}`);
    }
    throw err;
  } finally {
    await browser.close();
    await server.close();
  }

  // ── Sessão expirada (servidor com TTL curtíssimo) ──
  const shortServer = createGameServer({ ttlMs: 1500 });
  const shortPort = await listen(shortServer, 0);
  const browser2 = await chromium.launch({ executablePath: executablePath() });
  try {
    const p = await openPlayer(browser2, { ...DEVICES[0], tutorial: false }, `http://127.0.0.1:${shortPort}`);
    await p.page.getByLabel('Seu apelido').fill('Dorminhoco');
    await byName(p.page, 'button', /criar sala/i).click();
    await waitText(p, 'Código da sala');
    await waitText(p, 'Sessão expirada', 15000);
    await sleep(500);
    await shot(p, '40-sessao-expirada');
  } finally {
    await browser2.close();
    await shortServer.close();
  }

  console.log(`\n📸 ${shots.length} screenshots em ${OUT}`);
  if (problems.length) {
    console.log(`\n⚠️  ${problems.length} problema(s) encontrados:`);
    problems.forEach((p) => console.log(`  - ${p}`));
    process.exitCode = 1;
  } else {
    console.log('✅ Nenhum erro de console, scroll horizontal ou alvo de toque pequeno.');
  }
}

main().catch((err) => {
  console.error('❌ Teste visual falhou:', err);
  process.exit(1);
});
