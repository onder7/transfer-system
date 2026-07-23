/* Web Push handler'ları — vite-plugin-pwa'nın ürettiği SW'e importScripts ile eklenir.
   Düz JS (workbox importScripts gerektirmez). */

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data && event.data.text() }; }

  const title = data.title || 'Sipahi VIP Transfer';
  const options = {
    body:  data.body || '',
    icon:  '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    tag:   data.tag || 'transfer',
    renotify: true,
    data:  { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
