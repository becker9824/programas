// Programa de escritorio: muestra la app en su propia ventana y consulta la
// Guía de actividades en wol.jw.org (hace lo mismo que servidor.ps1, pero dentro del programa).
const { app, BrowserWindow, Menu, dialog, net, protocol, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs/promises');

const ROOT = __dirname;
const START_URL = 'app://programas/index.html';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const reply = (body, status = 200, type = 'text/plain; charset=utf-8') =>
  new Response(body, { status, headers: { 'Content-Type': type, 'Cache-Control': 'no-store' } });

const decodeHtml = s => s
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e]));

async function wol(urlPath) {
  const r = await net.fetch('https://wol.jw.org' + urlPath, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  return r.text();
}

async function handleJw(url) {
  const q = url.searchParams;
  if (url.pathname === '/jw/ping') return reply('ok');

  if (url.pathname === '/jw/semana') {
    // Guía de actividades de una semana: ?y=2026&w=43 (semana ISO)
    const y = Number(q.get('y')), w = Number(q.get('w'));
    if (!Number.isInteger(y) || !Number.isInteger(w) || y < 2020 || y > 2100 || w < 1 || w > 53) return reply('Semana no valida', 400);
    const week = await wol(`/es/wol/meetings/r4/lp-s/${y}/${w}`);
    const m = week.match(/href="(\/es\/wol\/d\/r4\/lp-s\/\d+)"\s+class="[^"]*pub-mwb/);
    if (!m) return reply('Sin guia para esta semana', 404);
    return reply(await wol(m[1]), 200, 'text/html; charset=utf-8');
  }

  if (url.pathname === '/jw/titulo') {
    // Título de un documento de wol.jw.org (se usa para los nombres de las canciones)
    const p = q.get('path') || '';
    if (!/^\/es\/wol\/(d|pc)\/r4\/lp-s\/[0-9/]+$/.test(p)) return reply('Ruta no valida', 400);
    const html = await wol(p);
    const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    return reply(decodeHtml(t.split('&mdash;')[0]).trim());
  }
  return reply('No encontrado', 404);
}

async function handleRequest(req) {
  const url = new URL(req.url);
  try {
    if (url.pathname.startsWith('/jw/')) return await handleJw(url);
    if (url.pathname === '/version') return reply(app.getVersion());
    const rel = decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT + path.sep)) return reply('No encontrado', 404);
    const data = await fs.readFile(file);
    return new Response(data, { headers: { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' } });
  } catch (e) {
    return reply('Error: ' + e.message, e.code === 'ENOENT' || e.status === 404 ? 404 : 502);
  }
}

// Modo de prueba (npm run prueba): revisa que todo funcione y cierra el programa.
async function selfTest(win) {
  const result = await win.webContents.executeJavaScript(`(async () => {
    const out = { jspdf: !!(window.jspdf && window.jspdf.jsPDF), protocol: location.protocol };
    out.ping = await (await fetch('/jw/ping')).text();
    out.version = await (await fetch('/version')).text();
    const { y, w } = isoWeek(todayISO());
    const r = await fetch('/jw/semana?y=' + y + '&w=' + w);
    out.semana = r.status;
    if (r.ok) { const g = parseGuide(await r.text(), mondayOf(todayISO())); out.titulo = g.title; out.intervenciones = g.rows.length; }
    out.cancion = await (await fetch('/jw/titulo?path=' + encodeURIComponent('/es/wol/d/r4/lp-s/1102016821'))).text();
    localStorage.setItem('prueba', '1'); out.guardado = localStorage.getItem('prueba') === '1'; localStorage.removeItem('prueba');
    return out;
  })()`);
  console.log('PRUEBA ' + JSON.stringify(result));
  app.quit();
}

// Actualizaciones: busca versiones nuevas en GitHub Releases, las descarga
// en segundo plano y pregunta si reiniciar. Si se dice "Más tarde", se vuelve a preguntar la próxima vez.
// El instalador se muestra (no silencioso) para que se vea el avance; en discos lentos
// o con antivirus puede tardar, y si es invisible parece que el programa se congeló.
function checkUpdates(win) {
  if (!app.isPackaged || process.argv.includes('--prueba')) return;
  autoUpdater.autoInstallOnAppQuit = false; // instalar al cerrar sería invisible; se vuelve a preguntar al abrir
  autoUpdater.on('error', e => console.log('Actualización: ' + e.message)); // sin internet, etc.
  autoUpdater.on('update-downloaded', async info => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info', title: 'Actualización lista',
      message: `Ya se descargó la versión ${info.version} de Programas.`,
      detail: 'Al reiniciar, el programa se cierra y aparece el instalador con su barra de avance. '
        + 'Puede tardar unos minutos; no apagues la computadora. Al terminar, el programa se abre solo. Tus datos no se borran.',
      buttons: ['Reiniciar ahora', 'Más tarde'], defaultId: 0, cancelId: 1,
    });
    if (response !== 0) return;
    // Sin esto, 'window-all-closed' llama a app.quit() antes de que arranque el instalador
    app.removeAllListeners('window-all-closed');
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
  });
  autoUpdater.checkForUpdates().catch(() => {});
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 420, minHeight: 500,
    title: 'Programas', icon: path.join(ROOT, 'icon.png'), autoHideMenuBar: true,
    show: !process.argv.includes('--prueba'),
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadURL(START_URL);
  // Enlaces externos se abren en el navegador normal
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (process.argv.includes('--prueba')) win.webContents.once('did-finish-load', () => selfTest(win).catch(e => { console.log('PRUEBA ERROR ' + e.message); app.quit(); }));
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle('app', handleRequest);
    checkUpdates(createWindow());
  });
  app.on('window-all-closed', () => app.quit());
}
