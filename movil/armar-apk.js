// Arma movil/Programas.apk: copia la app a www/, la mete al proyecto Android, compila y firma.
// Herramientas y llave en E:\AndroidTools (ver CLAUDE.md, sección "App de Android").
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const TOOLS = 'E:\\AndroidTools';
const env = { ...process.env, ANDROID_HOME: TOOLS + '\\sdk', GRADLE_USER_HOME: TOOLS + '\\gradle-home', ANDROID_USER_HOME: TOOLS + '\\android-home' };
const run = (cmd, args, cwd = __dirname) => execFileSync(cmd, args, { cwd, env, stdio: 'inherit', shell: true });

run('node', ['copiar.js']);
run('npx.cmd', ['cap', 'sync', 'android']);
const android = path.join(__dirname, 'android');
fs.writeFileSync(path.join(android, 'local.properties'), 'sdk.dir=' + TOOLS.replace(/\\/g, '/').replace(':', '\\:') + '/sdk\n');
run(path.join(android, 'gradlew.bat'), ['assembleRelease', '--quiet'], android);

const buildTools = fs.readdirSync(TOOLS + '\\sdk\\build-tools').sort().pop();
const bt = f => `${TOOLS}\\sdk\\build-tools\\${buildTools}\\${f}`;
const unsigned = path.join(android, 'app/build/outputs/apk/release/app-release-unsigned.apk');
const aligned = path.join(__dirname, 'alineado.apk'), out = path.join(__dirname, 'Programas.apk');
const clave = fs.readFileSync(TOOLS + '\\llaves\\clave.txt', 'utf8').trim();
run(bt('zipalign.exe'), ['-f', '-p', '4', unsigned, aligned]);
run(bt('apksigner.bat'), ['sign', '--ks', TOOLS + '\\llaves\\programas.keystore', '--ks-key-alias', 'programas',
  '--ks-pass', 'pass:' + clave, '--key-pass', 'pass:' + clave, '--out', out, aligned]);
fs.rmSync(aligned);
console.log('APK listo:', out);
