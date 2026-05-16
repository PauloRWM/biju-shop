// Service Worker stub — apenas se autodesregistra.
//
// O SW original (workbox) estava causando telas brancas aleatórias e foi
// desativado. Este arquivo é um placeholder que substitui o sw.js antigo
// no servidor; navegadores que já tinham o SW antigo registrado vão baixar
// este arquivo na próxima checagem (a cada 24h por padrão, ou a cada
// navegação) e o `self.registration.unregister()` se livra dele.
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      // ignore
    }
    try {
      await self.registration.unregister();
    } catch {
      // ignore
    }
    // Força que clientes existentes recarreguem sem o SW
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      try { client.navigate(client.url); } catch { /* ignore */ }
    }
  })());
});
self.addEventListener('fetch', () => {
  // Não intercepta nada — deixa o navegador buscar direto.
});
