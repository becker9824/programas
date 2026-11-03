// Guarda la llave de la cuenta de servicio de Firebase como secreto FCM_CUENTA del intermediario (Cloudflare).
// Uso (en E:\PUblishr):  node intermediario/guardar-llave.js E:\clave-firebase.json
// No muestra la llave: solo revisa que sea una llave de Firebase y se la pasa a wrangler directamente.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.log('No encuentro el archivo. Ejemplo: node intermediario/guardar-llave.js E:\\clave-firebase.json'); process.exit(1); }
let key;
try { key = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { console.log('Ese archivo no es una llave válida (no es JSON).'); process.exit(1); }
if (key.type !== 'service_account' || !key.private_key || !key.client_email) { console.log('Ese archivo no es una llave de cuenta de servicio de Firebase.'); process.exit(1); }
if (key.project_id !== 'programas-congregacion') { console.log(`La llave es de otro proyecto (${key.project_id}). Usa la de programas-congregacion.`); process.exit(1); }
const r = spawnSync('npx.cmd', ['wrangler', 'secret', 'put', 'FCM_CUENTA', '--config', path.join(__dirname, 'wrangler.toml')],
  { input: JSON.stringify(key), stdio: ['pipe', 'inherit', 'inherit'], shell: true });
if (r.status) { console.log('\nNo se pudo guardar. Revisa el mensaje de arriba.'); process.exit(1); }
console.log('\nListo: la llave quedó guardada en Cloudflare. Ya puedes borrar el archivo ' + file);
