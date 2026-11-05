// Service worker da Farmácia Fácil: recebe as notificações (push) mesmo com o app fechado.
// Não guarda arquivos nem dados no aparelho (o app não funciona offline).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Apaga caches de versões antigas (inclusive dados que o service worker anterior guardou)
  event.waitUntil(
    caches.keys().then((nomes) => Promise.all(nomes.map((nome) => caches.delete(nome))))
  );
  self.clients.claim();
});

// Sem respondWith: o navegador faz todos os pedidos normalmente.
// Mantido apenas para o app continuar instalável como PWA.
self.addEventListener('fetch', () => {});

// Recebe a notificação enviada pelo servidor
self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch (e) {
    dados = {};
  }
  const titulo = dados.titulo || 'Farmácia Fácil';
  const opcoes = {
    body: dados.corpo || 'Você tem um lembrete de medicamento.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: dados.tag || 'lembrete-medicamento',
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// Ao tocar na notificação, abre o app (ou volta para a janela já aberta)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) return janela.focus();
      }
      return clients.openWindow('/');
    })
  );
});