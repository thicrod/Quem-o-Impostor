// Service worker do "Quem é o Impostor?".
// - Deixa o jogo instalável e faz a tela abrir rápido (casca do app em cache).
// - Se o servidor demorar (ex.: acordando no plano grátis), abre a versão em
//   cache e o jogo conecta sozinho assim que o servidor responder.
// - Nunca intercepta o Socket.IO nem /health (tempo real sempre direto).
// __BUILD_ID__ é trocado a cada build (ver vite.config.js): cache novo por versão.

const CACHE = 'impostor-__BUILD_ID__';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];
const NAV_TIMEOUT_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('impostor-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function putInCache(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
}

function navigate(event) {
  const network = fetch(event.request).then((res) => {
    putInCache('/', res);
    return res;
  });
  network.catch(() => {}); // evita aviso de rejeição não tratada quando o cache vence a corrida
  const fallback = new Promise((resolve) => {
    setTimeout(() => caches.match('/').then((hit) => hit && resolve(hit)), NAV_TIMEOUT_MS);
  });
  return Promise.race([network, fallback]).catch(() => caches.match('/').then((hit) => hit || Response.error()));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/socket.io') || url.pathname === '/health') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(event));
    return;
  }

  // Arquivos com hash no nome (/assets/…): nunca mudam, cache primeiro.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        putInCache(request, res);
        return res;
      })),
    );
    return;
  }

  // Demais (ícones, manifest): usa o cache e atualiza em segundo plano.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request).then((res) => {
        putInCache(request, res);
        return res;
      }).catch(() => hit || Response.error());
      return hit || network;
    }),
  );
});
