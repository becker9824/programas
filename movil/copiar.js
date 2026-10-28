// Copia la app (los mismos archivos que lleva el programa de PC) a www/ para meterla en el APK,
// y le agrega capacitor.js (el puente con las funciones del celular: jw.org, archivos, compartir).
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), www = path.join(__dirname, 'www');
fs.rmSync(www, { recursive: true, force: true });
for (const f of ['index.html', 'firebase-config.js', 'icon.png', 'icon.svg', 'manifest.webmanifest', 'vendor'])
  fs.cpSync(path.join(raiz, f), path.join(www, f), { recursive: true });
fs.copyFileSync(require.resolve('@capacitor/core/dist/capacitor.js'), path.join(www, 'capacitor.js'));
const html = path.join(www, 'index.html'), marca = "<script>\nconst KEY = ";
const src = fs.readFileSync(html, 'utf8');
if (!src.includes(marca)) throw new Error('No encontré dónde poner capacitor.js en index.html');
fs.writeFileSync(html, src.replace(marca, '<script src="capacitor.js"></script>\n' + marca));
console.log('Copiado a www/');
