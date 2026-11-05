// Guarda la app en el celular para que abra rápido y funcione sin internet.
// Sube el número de versión cada vez que cambies index.html o app/.
const CACHE = 'programas-v50';
const FILES = [
  './',
  './index.html',
  './app/acceso.js',
  './app/anuncios-cuentas.js',
  './app/base.js',
  './app/congregacion.js',
  './app/estilos.css',
  './app/extras.js',
  './app/informes.js',
  './app/jw.js',
  './app/legal-textos.js',
  './app/legal.js',
  './app/legal.html',
  './app/mas.js',
  './app/mecanicas.js',
  './app/nube.js',
  './app/pdf.js',
  './app/perfil.js',
  './app/publicadores.js',
  './app/territorios.js',
  './app/vistas.js',
  './firebase-config.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon.png',
  './vendor/jspdf.umd.min.js',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/qrcode.js',
  './vendor/firebase/firebase-app.js',
  './vendor/firebase/firebase-auth.js',
  './vendor/firebase/firebase-firestore.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    // Los mapas guardados para usar sin internet (mapas-…) se quedan
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && !k.startsWith('mapas-')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Primero intenta la red (para recibir actualizaciones); si no hay conexión, usa lo guardado.
// "no-cache" pregunta siempre al servidor: sin eso el navegador puede dar una copia de hasta
// 10 minutos y alguien seguiría con la versión anterior. Firebase maneja sus propias conexiones.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});

// Avisos al celular (Firebase Cloud Messaging, ver app/mas.js): se muestran aunque la app esté cerrada.
// Al tocarlo se abre la app en la sección del aviso (?ir=…).
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) {}
  const n = d.notification || {}, data = d.data || {};
  e.waitUntil(self.registration.showNotification(n.title || 'Programas', {
    body: n.body || '', icon: n.icon || 'icon.png', badge: 'icon.png', tag: data.vista || 'programas', renotify: true,
    data: { link: data.link || (d.fcmOptions && d.fcmOptions.link) || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => new URL(c.url).origin === location.origin);
    return w ? w.navigate(link).then(c => (c || w).focus()) : self.clients.openWindow(link);
  }));
});
