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
// Escuta por notificações push chegando do servidor
self.addEventListener('push', (event) => {
  const dados = event.data ? event.data.json() : {};
  const titulo = dados.titulo || 'Farmácia Fácil';
  const opcoes = {
    body: dados.corpo || 'Você tem um lembrete de medicamento.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png'
  };

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// Quando o usuário toca na notificação, abre o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});