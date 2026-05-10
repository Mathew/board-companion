const CACHE = 'dq-v6';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './icons/icon.svg',
  './games/dungeonquest.json',
  './themes/dungeonquest.css',
  './images/cards/dungeon-back.svg',
  './images/cards/door-back.svg',
  './images/cards/search-back.svg',
  './images/cards/crypt-back.svg',
  './images/cards/corpse-back.svg',
  './images/cards/catacomb-back.svg',
  './images/cards/monster-back.svg',
  './images/cards/trap-back.svg',
  './images/cards/treasure-back.svg',
  './images/cards/dragon-back.svg',
  './images/cards/rune-back.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(
        ASSETS.map(url => {
          const req = new Request(url);
          return fetch(req)
            .then(res => cache.put(req, res))
            .catch(err => console.warn('SW: failed to cache', url, err));
        })
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  const url = new URL(e.request.url);
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
