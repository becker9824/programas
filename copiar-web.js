// Copia a web/ solo lo que lleva la versión web (Firebase Hosting: https://programas-congregacion.web.app).
// Es una lista cerrada para no subir nada más de esta carpeta (PDF con nombres reales, pruebas, etc.).
// Lo corre solo `firebase deploy --only hosting` (predeploy en firebase.json).
const fs = require('fs'), path = require('path');
const web = path.join(__dirname, 'web');
fs.rmSync(web, { recursive: true, force: true });
for (const f of ['index.html', 'app', 'vendor', 'firebase-config.js', 'icon.png', 'icon.svg', 'manifest.webmanifest', 'sw.js', '.well-known'])
  fs.cpSync(path.join(__dirname, f), path.join(web, f), { recursive: true });
console.log('Copiado a web/');
