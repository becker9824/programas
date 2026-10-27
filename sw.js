// Guarda la app en el celular para que abra rápido y funcione sin internet.
// Sube el número de versión cada vez que cambies index.html.
const CACHE = 'programas-v21';
const FILES = [
  './',
  './index.html',
  './firebase-config.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon.png',
  './vendor/jspdf.umd.min.js',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/qrcode.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
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
