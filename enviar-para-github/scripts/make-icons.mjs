#!/usr/bin/env node
// Gera os ícones do app (PWA) a partir do logo em SVG, usando o Chromium do
// Playwright. Só precisa rodar de novo se o logo mudar:
//   node scripts/make-icons.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const OUT = join(process.cwd(), 'client/public/icons');
mkdirSync(OUT, { recursive: true });

const MASK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff6fb5"/><stop offset="0.55" stop-color="#ff3d8b"/><stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <path d="M4 26c0-6 6-10 13-10 6 0 11 3 15 6 4-3 9-6 15-6 7 0 13 4 13 10 0 12-8 21-17 21-5 0-8-2-11-6-3 4-6 6-11 6C12 47 4 38 4 26z" fill="url(#g)"/>
  <ellipse cx="20" cy="30" rx="6.5" ry="4.8" fill="#120c34"/>
  <ellipse cx="44" cy="30" rx="6.5" ry="4.8" fill="#120c34"/>
  <circle cx="22" cy="29.5" r="2" fill="#3ee0ff"/>
  <circle cx="46" cy="29.5" r="2" fill="#3ee0ff"/>
  <path d="M26 41q6 3 12 0" stroke="#120c34" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`;

// full: fundo até a borda (iOS/maskable arredondam sozinhos); logo ocupa `logo` do lado.
const ICONS = [
  { file: 'icon-192.png', size: 192, radius: 0.22, logo: 0.78 },
  { file: 'icon-512.png', size: 512, radius: 0.22, logo: 0.78 },
  { file: 'maskable-512.png', size: 512, radius: 0, logo: 0.62 },
  { file: 'apple-touch-icon.png', size: 180, radius: 0, logo: 0.74 },
];

const html = ({ size, radius, logo }) => `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;border-radius:${radius * size}px;overflow:hidden;position:relative;
  background: radial-gradient(circle at 30% 20%, #2a1f6b, #0d0927 70%);display:grid;place-items:center">
  <div style="position:absolute;inset:-20%;background:radial-gradient(circle at 25% 15%, rgba(255,61,139,.45), transparent 45%),
    radial-gradient(circle at 85% 90%, rgba(20,200,240,.35), transparent 45%)"></div>
  <div style="width:${logo * size}px;height:${logo * size}px;position:relative;filter:drop-shadow(0 ${size * 0.03}px ${size * 0.05}px rgba(255,61,139,.55))">
    ${MASK.replace('<svg ', `<svg width="100%" height="100%" `)}
  </div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(html(icon));
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: icon.size, height: icon.size } });
  writeFileSync(join(OUT, icon.file), buf);
  console.log('✓', icon.file);
}
await browser.close();
