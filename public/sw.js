const CACHE_NAME = 'farmacia-facil-v2';
const ARQUIVOS_PARA_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes.filter((nome) => nome !== CACHE_NAME).map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((respostaRede) => {
        const clone = respostaRede.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return respostaRede;
      })
      .catch(() => caches.match(event.request))
  );
});