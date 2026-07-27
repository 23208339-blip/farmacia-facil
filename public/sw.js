const CACHE_NAME = 'farmacia-facil-v1';
const ARQUIVOS_PARA_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Instala o service worker e guarda os arquivos essenciais em cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE))
  );
});

// Remove caches antigos quando uma nova versão é ativada
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes.filter((nome) => nome !== CACHE_NAME).map((nome) => caches.delete(nome))
      )
    )
  );
});

// Serve do cache quando estiver offline, senão busca da rede
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((respostaCache) => {
      return respostaCache || fetch(event.request);
    })
  );
});