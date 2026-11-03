// Programa de escritorio: muestra la app en su propia ventana y consulta la
// Guía de actividades en wol.jw.org (hace lo mismo que servidor.ps1, pero dentro del programa).
const { app, BrowserWindow, Menu, dialog, net, protocol, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs/promises');

const ROOT = __dirname;
// Prueba de pantallas: siempre en una carpeta nueva (sin sesión ni datos de antes)
if (process.argv.includes('--pantallas')) app.setPath('userData', path.join(require('node:os').tmpdir(), 'programas-pantallas-' + Date.now()));
// --emu: usa el Firebase local de prueba (npm run nube-local)
const START_URL = 'app://programas/index.html' + (process.argv.includes('--emu') ? '?emu' : '');
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
    if (FB_CONFIG) { for (let i = 0; i < 50 && !F; i++) await new Promise(r => setTimeout(r, 200)); out.firebase = !!F; }
    out.mapa = await loadLeaflet().then(L => !!L.map, () => false);
    out.qr = await loadQR().then(q => typeof q === 'function', () => false);
    out.excel = await loadExcel().then(async X => { const wb = new X.Workbook(); wb.addWorksheet('Prueba').getCell('A1').value = 1; return (await wb.xlsx.writeBuffer()).byteLength; }).catch(e => 'error ' + e.message);
    out.imagen = await (async () => { const d = new window.jspdf.jsPDF(); d.text('Prueba', 20, 20); const [b] = await pdfToImages(d, 'png'); return b.size; })().catch(e => 'error ' + e.message);
    out.teselas = await new Promise(res => { const i = new Image(); i.onload = () => res(i.width); i.onerror = () => res('error');
      i.src = 'https://tile.openstreetmap.org/5/7/14.png'; });
    return out;
  })()`);
  console.log('PRUEBA ' + JSON.stringify(result));
  app.quit();
}

// Prueba de pantallas (npm run prueba-pantallas): con el Firebase local de prueba crea una congregación,
// abre cada sección y las ventanas principales, y avisa si alguna falla. Corre en una carpeta temporal nueva.
async function screenTest(win) {
  const run = code => win.webContents.executeJavaScript(code);
  const phase = await run(`localStorage.getItem('pantallas')`);
  if (!phase) {
    await run(`(async () => {
      for (let i = 0; i < 100 && !F; i++) await new Promise(r => setTimeout(r, 100));
      await F.createUserWithEmailAndPassword(F.auth, 'pantallas' + Date.now() + '@prueba.test', crypto.randomUUID());
      for (let i = 0; i < 100 && !nube.user; i++) await new Promise(r => setTimeout(r, 100));
      await createCongregation('Congregación de prueba', 'Coordinador Prueba');
      localStorage.setItem('pantallas', '2'); location.reload();
    })()`);
    return; // sigue al volver a cargar
  }
  const result = await run(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), errors = [];
    addEventListener('error', e => errors.push(e.message));
    addEventListener('unhandledrejection', e => errors.push(String(e.reason && e.reason.message || e.reason)));
    for (let i = 0; i < 150 && !nube.listo; i++) await wait(100);
    if (!nube.listo) return { error: 'No entró a la congregación' };
    const closeAll = () => document.querySelectorAll('dialog').forEach(d => { d.close(); d.remove(); });
    await wait(800); closeAll();
    const mk = (name, sex, nom) => ({ id: uid(), name, sex, age: 40, nombramiento: nom || '', bautizado: true });
    state.profiles.push(mk('Ana Prueba', 'F'), mk('Beto Anciano', 'M', 'anciano'), mk('Carlos Siervo', 'M', 'sm'), mk('Dario Prueba', 'M'));
    save(); await wait(800);
    const views = {}, dialogs = {};
    for (const [v] of navItems(true)) {
      const before = errors.length;
      try { go({ name: v }); await wait(700); closeAll(); views[v] = document.getElementById('app').childElementCount ? (errors.length > before ? 'error' : 'ok') : 'vacía'; }
      catch (e) { views[v] = 'error: ' + e.message; }
    }
    const tryDlg = async (name, fn) => { const before = errors.length; try { go({ name: 'inicio' }); await wait(300); await fn(); await wait(300);
      dialogs[name] = document.querySelector('dialog[open]') || document.querySelector('.tiles.editing') ? (errors.length > before ? 'error' : 'ok') : 'no abrió'; }
      catch (e) { dialogs[name] = 'error: ' + e.message; } closeAll(); };
    await tryDlg('guia', () => openGuide());
    await tryDlg('busqueda', () => openSearch());
    await tryDlg('anuncio', () => openAnnouncementDialog(null));
    await tryDlg('turno', () => openTurnDialog(null));
    await tryDlg('visita', () => openVisitDialog(state.profiles[0], null));
    await tryDlg('hermano', () => openProfileDialog(state.profiles[1]));
    await tryDlg('ausencia', () => openAbsenceDialog(state.profiles[0].id, 'Ana', () => {}));
    await tryDlg('editarInicio', () => startHomeEdit());
    homeEdit = null;
    const bad = [...Object.entries(views), ...Object.entries(dialogs)].filter(([, s]) => s !== 'ok').map(([k, s]) => k + ': ' + s);
    return { secciones: Object.keys(views).length, ventanas: Object.keys(dialogs).length, fallas: bad, errores: errors.slice(0, 10) };
  })()`);
  console.log('PANTALLAS ' + JSON.stringify(result));
  app.exit(result.error || result.fallas.length || result.errores.length ? 1 : 0);
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

// Entrar con enlace al correo: la página web abre programas://entrar?l=… y Windows se lo pasa al programa
const isLink = a => /^programas:/i.test(a);
const sendLink = (win, url) => win.webContents.executeJavaScript(`receiveLink(${JSON.stringify(url)})`).catch(() => {});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 420, minHeight: 500,
    title: 'Programas', icon: path.join(ROOT, 'icon.png'), autoHideMenuBar: true,
    show: !process.argv.includes('--prueba') && !process.argv.includes('--pantallas'),
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadURL(START_URL);
  // Enlaces externos se abren en el navegador normal
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  const link = process.argv.find(isLink);
  if (link) win.webContents.once('did-finish-load', () => sendLink(win, link));
  if (process.argv.includes('--prueba')) win.webContents.once('did-finish-load', () => selfTest(win).catch(e => { console.log('PRUEBA ERROR ' + e.message); app.quit(); }));
  if (process.argv.includes('--pantallas')) win.webContents.on('did-finish-load', () => screenTest(win).catch(e => { console.log('PANTALLAS ERROR ' + e.message); app.exit(1); }));
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  if (app.isPackaged) app.setAsDefaultProtocolClient('programas');
  app.on('second-instance', (e, argv) => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    const link = argv.find(isLink);
    if (win && link) sendLink(win, link);
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle('app', handleRequest);
    checkUpdates(createWindow());
  });
  app.on('window-all-closed', () => app.quit());
}
