
self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {};
    const title = data.title || 'Recordatorio de Deuda';
    const options = {
      body: data.body || 'Tienes un pago pendiente.',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: {
        url: data.url || '/',
      },
    };
  
    event.waitUntil(self.registration.showNotification(title, options));
});
  
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
  
    const urlToOpen = event.notification.data.url || '/';
  
    event.waitUntil(
      clients.openWindow(urlToOpen)
    );
});
  
// This is required to make the service worker installable.
self.addEventListener('fetch', (event) => {
    // You can add caching strategies here if needed.
});
