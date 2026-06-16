self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Новое сообщение', body: '' };
  const options = {
    body: data.body ?? '',
    icon: data.icon ?? '/favicon.png',
    badge: '/favicon.png',
    data: data.data ?? {},
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  if (chatId) {
    const url = chatId ? `/?chat=${chatId}` : '/';
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
    );
  }
});
