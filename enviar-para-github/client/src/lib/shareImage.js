// Gera uma imagem (PNG) com o resultado da rodada para compartilhar no
// WhatsApp/Instagram. Tudo desenhado em canvas, com as cores do tema atual.

const W = 1080;
const H = 1350;

const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth, size, family) {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 20) {
    s -= 4;
    ctx.font = `${s}px ${family}`;
  }
  return s;
}

const OUTCOME_TEXT = {
  caught: 'O GRUPO VENCEU!',
  stolen: 'O IMPOSTOR ROUBOU A VITÓRIA!',
  escaped: 'O IMPOSTOR ESCAPOU!',
};

/**
 * @param {{ result: any, game: any, players: any[], playerInfo: Function }} data
 * @returns {Promise<Blob>}
 */
export async function createResultImage({ result, game, players, playerInfo }) {
  const display = '"Lilita One", system-ui, sans-serif';
  const body = '"Nunito Variable", system-ui, sans-serif';
  try {
    await Promise.all([document.fonts.load(`80px "Lilita One"`), document.fonts.load(`700 40px "Nunito Variable"`)]);
  } catch {
    /* usa a fonte do sistema */
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const ink950 = cssVar('--color-ink-950', '#07051a');
  const ink800 = cssVar('--color-ink-800', '#18113f');
  const hot = cssVar('--color-hot-500', '#ff3d8b');
  const sky = cssVar('--color-sky-500', '#14c8f0');
  const good = cssVar('--color-good-400', '#4ef0a3');
  const bad = cssVar('--color-bad-400', '#ff6b7a');
  const sun = cssVar('--color-sun-400', '#ffb547');

  // Fundo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, ink800);
  bg.addColorStop(1, ink950);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [[120, 80, 520, hot], [980, 1250, 560, sky]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${c}66`);
    g.addColorStop(1, `${c}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Título
  ctx.fillStyle = '#ffffff';
  ctx.font = `64px ${display}`;
  ctx.fillText('QUEM É O IMPOSTOR?', W / 2, 130);

  // Resultado
  const outcomeColor = result.outcome === 'caught' ? good : bad;
  ctx.fillStyle = outcomeColor;
  fitText(ctx, OUTCOME_TEXT[result.outcome], W - 120, 70, display);
  ctx.fillText(OUTCOME_TEXT[result.outcome], W / 2, 250);

  // Impostor(es)
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `700 34px ${body}`;
  ctx.fillText(result.impostorIds.length > 1 ? 'OS IMPOSTORES ERAM' : 'O IMPOSTOR ERA', W / 2, 340);
  const imps = result.impostorIds.map(playerInfo).filter(Boolean);
  const names = imps.map((p) => `${p.avatar} ${p.nickname}`).join('  ·  ');
  ctx.fillStyle = bad;
  fitText(ctx, names, W - 120, 96, display);
  ctx.fillText(names, W / 2, 450);

  // Palavra
  roundRect(ctx, 90, 510, W - 180, 230, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `700 32px ${body}`;
  ctx.fillText(`A PALAVRA ERA  ·  ${game.category.emoji} ${game.category.label}`, W / 2, 575);
  ctx.fillStyle = '#ffffff';
  fitText(ctx, result.word, W - 260, 110, display);
  ctx.fillText(result.word, W / 2, 695);

  // Placar
  const ranked = [...players].sort((a, b) => b.score - a.score).slice(0, 5);
  ctx.fillStyle = sun;
  ctx.font = `48px ${display}`;
  ctx.fillText('🏆 PLACAR', W / 2, 830);
  const medals = ['🥇', '🥈', '🥉'];
  ranked.forEach((p, i) => {
    // Empate na pontuação = mesma posição
    const rank = players.filter((o) => o.score > p.score).length;
    const y = 910 + i * 72;
    ctx.textAlign = 'center';
    ctx.font = rank < 3 ? `44px ${body}` : `700 38px ${body}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(medals[rank] || `${rank + 1}º`, 205, y);
    ctx.font = `44px ${body}`;
    ctx.fillText(p.avatar, 285, y);
    ctx.textAlign = 'left';
    ctx.font = `700 42px ${body}`;
    ctx.fillText(p.nickname, 340, y);
    ctx.textAlign = 'right';
    ctx.font = `48px ${display}`;
    ctx.fillStyle = rank === 0 ? sun : '#ffffff';
    ctx.fillText(`${p.score} pts`, W - 180, y);
  });

  // Rodapé
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `700 30px ${body}`;
  ctx.fillText(`Jogue com os amigos: ${window.location.host}`, W / 2, H - 60);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('falha ao gerar imagem'))), 'image/png');
  });
}

/** Compartilha (celular) ou baixa (desktop) a imagem. */
export async function shareResultImage(data) {
  const blob = await createResultImage(data);
  const file = new File([blob], 'quem-e-o-impostor.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Quem é o Impostor?', text: 'Olha como foi a rodada! 🎭' });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quem-e-o-impostor.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
