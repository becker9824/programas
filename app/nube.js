// Programas · Firebase: sesión, datos de la congregación y guardado.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- congregación en la nube (Firebase) ----------
// Firestore: codigos/{código} → congregación; congregaciones/{id} con miembros/{uid},
// privado/estado (todos los datos, solo admins), publico/programa (semanas con nombres,
// para todos) e informes/{uid_AAAA-MM}. Quién puede qué lo deciden las reglas (firestore.rules).
// Desde la 1.3 los datos van por partes (perfiles/, familias/, semanas/, config/ajustes) en vez de
// un solo privado/estado (que tenía límite de 1 MB); privado/estado queda como copia de la 1.2.
const nube = { user: null, cong: null, congData: null, me: null, acceso: '', listo: false, publico: null,
  miembros: [], anuncios: [], contactos: new Map(), cuentas: [], cuentasIni: null, territorios: [], grupos: [], capitanes: [], capitanesHermanos: [], trabajos: [], asistencia: new Map(), eventos: [], salidas: [], publica: [], pastoreo: [], solicitudes: [], limpieza: null, ausencias: new Map(), confirmaciones: new Map(), vista: null, sent: {}, ultimoPub: '', registro: null, inicial: null, unsubMe: null, unsubDatos: [] };
// Funciones que el coordinador puede dar a cada cuenta (el coordinador tiene todas)
const PERMS = [
  ['programa', 'Programa VyM', 'Semanas, hermanos, familias y ajustes de la reunión'],
  ['secretario', 'Secretario', 'Informes de todos: verlos y capturarlos'],
  ['ancianos', 'Anciano', 'Anuncios y directorio (las otras funciones ya los incluyen)'],
  ['cuentas', 'Cuentas', 'Entradas, salidas y saldos de la congregación'],
  ['territorios', 'Territorios', 'Dibujar, asignar y terminar territorios (todos pueden ver el mapa)'],
  ['capitan', 'Capitán', 'Ve los territorios que se le asignan y registra lo que se trabajó'],
];
// Cuentas de la congregación (solo el coordinador las ve: nube.miembros)
const memberOfProfile = pid => nube.miembros.find(m => m.estado === 'activo' && m.perfil === pid);
async function memberUpdate(m, data, msg) {
  try { await F.updateDoc(congRef('miembros', m.id), data); if (msg) { toast(msg); logChange(msg); } }
  catch (e) { toast(errMsg(e)); render(); }
}
// Casillas de Coordinador y de cada función; cada cambio se guarda al momento y solo toca esa función
function memberFunctions(m) {
  const self = m.id === nube.user.uid, perms = m.permisos || [];
  const admins = nube.miembros.filter(x => x.estado === 'activo' && x.admin).length;
  const boxes = PERMS.filter(([key]) => key !== 'capitan').map(([key, label, desc]) => {
    const box = h('input', { type: 'checkbox', checked: m.admin || perms.includes(key), disabled: m.admin ? true : null, onchange: e => {
      const on = e.target.checked;
      memberUpdate(m, { permisos: on ? F.arrayUnion(key) : F.arrayRemove(key) }, on ? `${m.nombre}: ahora tiene “${label}”` : `${m.nombre}: ya no tiene “${label}”`);
      on ? perms.push(key) : perms.splice(perms.indexOf(key), 1);
    } });
    return { key, box, el: h('label', { class: 'row', title: desc, style: { gap: '6px' } }, box, label) };
  });
  const adminBox = h('input', { type: 'checkbox', checked: !!m.admin, disabled: self && admins <= 1 ? true : null, onchange: e => {
    const on = e.target.checked;
    if (on && !confirm(`${m.nombre} podrá ver y cambiar todo, incluidos los informes, las cuentas de usuario y quién tiene cada función. ¿Hacerlo coordinador?`)) return e.target.checked = false;
    if (!on && self && !confirm('Dejarás de ser coordinador y ya no verás estas opciones. ¿Continuar?')) return e.target.checked = true;
    memberUpdate(m, { admin: on }, on ? `${m.nombre} ahora es coordinador` : `${m.nombre} ya no es coordinador`);
    m.admin = on;
    boxes.forEach(b => { b.box.disabled = on; b.box.checked = on || perms.includes(b.key); });
  } });
  return h('div', { class: 'row', style: { gap: '14px', color: 'var(--text)', fontSize: '14px' } },
    h('label', { class: 'row', style: { gap: '6px' }, title: self && admins <= 1 ? 'La congregación necesita al menos un coordinador' : 'Puede todo' }, adminBox, h('strong', null, 'Coordinador')),
    boxes.map(b => b.el));
}
// capitanes/lista: cuentas con la función Capitán, para que el siervo de territorios (que no ve
// las cuentas) pueda asignarles. La escribe el coordinador cuando cambian las cuentas.
let captainsSent = '';
function publishCaptains() {
  const lista = nube.miembros.filter(m => m.estado === 'activo' && (m.permisos || []).includes('capitan'))
    .map(m => ({ uid: m.id, perfil: m.perfil || '', nombre: (m.perfil && profById(m.perfil) || {}).name || m.nombre })).sort(byNombre);
  const json = JSON.stringify(lista);
  if (json === captainsSent) return;
  captainsSent = json;
  F.setDoc(congRef('capitanes', 'lista'), { lista }).catch(() => { captainsSent = ''; });
}
// Grupos de servicio del campo: grupos/{id} = { nombre, superintendente, auxiliar, miembros: [perfiles] }
const byGrupo = (a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { numeric: true });
const grupoOf = pid => nube.grupos.find(g => (g.miembros || []).includes(pid)) || null;
function setGroupMember(pid, from, to) {
  const w = [];
  if (from) w.push(F.updateDoc(congRef('grupos', from.id), { miembros: F.arrayRemove(pid) }));
  if (to) w.push(F.updateDoc(congRef('grupos', to.id), { miembros: F.arrayUnion(pid) }));
  return Promise.all(w).catch(e => toast(errMsg(e)));
}
// Colecciones que se guardan por documento: [colección, parte de state, permisos para leer]
const COLLS = [['perfiles', 'profiles', ['programa', 'secretario', 'ancianos']], ['familias', 'families', ['programa']], ['semanas', 'programs', ['programa', 'secretario', 'ancianos']]];
let F = null; // funciones de Firebase, cargadas al abrir

async function loadFirebase() {
  // Firebase va dentro de la app (vendor/firebase, copiado de node_modules/firebase): abre aunque no haya internet
  const base = new URL('vendor/firebase/firebase-', location.href).href;
  const [app, auth, fs] = await Promise.all(['app', 'auth', 'firestore'].map(m => import(base + m + '.js')));
  const a = app.initializeApp(FB_CONFIG);
  // Los datos se guardan también en el equipo: sin internet se ven y los cambios se suben al volver la conexión
  F = { ...auth, ...fs, auth: auth.getAuth(a), db: fs.initializeFirestore(a, { ignoreUndefinedProperties: true,
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }) };
  F.auth.languageCode = 'es'; // los correos (enlace para entrar, cambiar contraseña) llegan en español
  // Al guardar no se espera para siempre a que el servidor conteste: con internet lento o bloqueado la app se
  // quedaba "pensando" y el botón trabado. Lo guardado ya queda en el equipo y se sube solo; si el servidor
  // lo rechaza después, se avisa.
  const settle = p => new Promise((ok, no) => {
    let done = false;
    const t = setTimeout(() => { done = true; ok(); toast('Guardado en este equipo. Se sube a la nube en cuanto haya buena conexión.'); }, navigator.onLine ? 8000 : 300);
    p.then(v => { if (!done) { done = true; clearTimeout(t); ok(v); } },
      e => { if (!done) { done = true; clearTimeout(t); no(e); } else toast('No se pudo guardar en la nube: ' + errMsg(e)); });
  });
  for (const k of ['setDoc', 'updateDoc', 'deleteDoc']) F[k] = (...a) => settle(fs[k](...a));
  F.addDoc = (col, data) => { const d = fs.doc(col); return settle(fs.setDoc(d, data)).then(() => d); };
  if (EMU) {
    auth.connectAuthEmulator(F.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fs.connectFirestoreEmulator(F.db, '127.0.0.1', 8080);
  }
}
const ref = (...path) => F.doc(F.db, ...path);
const congRef = (...path) => ref('congregaciones', nube.cong, ...path);
const isAdmin = () => !!(nube.me && nube.me.estado === 'activo' && nube.me.admin); // coordinador
const can = p => isAdmin() || !!(nube.me && nube.me.estado === 'activo' && (nube.me.permisos || []).includes(p));
// Todas las funciones son de ancianos: cualquiera da anuncios (publicar) y directorio
const isElder = () => can('ancianos') || can('programa') || can('secretario');
const accessKey = () => nube.me ? JSON.stringify([!!nube.me.admin, [...(nube.me.permisos || [])].sort()]) : '';
const reportsByMembers = () => !nube.congData || nube.congData.modo !== 'encargados';
// JSON con las claves ordenadas, para saber si un documento cambió de verdad
const stable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x);
const clean = v => JSON.parse(JSON.stringify(v));
const configOf = s => ({ settings: s.settings, songs: s.songs, missing: s.missing, lastSync: s.lastSync, talks: s.talks || {} });
const byNombre = (a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es');
const fmtStamp = t => t && t.toDate ? t.toDate().toLocaleString('es', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : '';
// ¿Está escribiendo o con un diálogo abierto? Entonces no se vuelve a dibujar la pantalla.
// Las casillas y opciones no cuentan: no se pierde nada al redibujar.
const busy = () => {
  const a = document.activeElement || {};
  return !!document.querySelector('dialog[open], .tile.dragging') || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'
    || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(a.type));
};

function errMsg(e) {
  const c = (e && e.code) || '';
  return ({
    'auth/invalid-email': 'El correo no es válido.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No hay ninguna cuenta con ese correo.',
    'auth/missing-password': 'Escribe la contraseña.',
    'auth/email-already-in-use': 'Ya hay una cuenta con ese correo. Usa “Entrar”.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a intentar.',
    'auth/network-request-failed': 'No hay conexión a internet.',
    'auth/missing-email': 'Escribe tu correo.',
    'auth/invalid-action-code': 'Ese enlace ya se usó o ya venció. Pide uno nuevo.',
    'auth/expired-action-code': 'Ese enlace ya venció. Pide uno nuevo.',
    'auth/quota-exceeded': 'Por hoy ya no se pueden mandar más enlaces. Entra con tu contraseña o intenta mañana.',
    'auth/operation-not-allowed': 'Entrar con enlace todavía no está activado en Firebase. Entra con tu contraseña.',
    'auth/unauthorized-continue-uri': 'Entrar con enlace todavía no está activado en Firebase. Entra con tu contraseña.',
    'enlace-malo': 'Eso no es un enlace para entrar. Copia el enlace del botón del correo.',
    'permission-denied': 'No tienes permiso para hacer esto.',
    'unavailable': 'No hay conexión con el servidor. Revisa tu internet.',
    'codigo': 'Ese código de congregación no existe. Pídeselo de nuevo a un administrador.',
    'cuenta-existe': 'Ya hay una cuenta con ese correo, pero la contraseña no coincide. Usa “Entrar” o “¿Olvidaste tu contraseña?”.',
  })[c] || 'Ocurrió un error: ' + ((e && e.message) || c);
}

function newCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', n = crypto.getRandomValues(new Uint8Array(6));
  return [...n].map(x => abc[x % abc.length]).join('');
}
async function freeCode() {
  for (let i = 0; i < 5; i++) { const c = newCode(); if (!(await F.getDoc(ref('codigos', c))).exists()) return c; }
  throw new Error('No se pudo crear un código, intenta de nuevo.');
}

async function joinCongregation(codigo, nombre) {
  const code = (codigo || '').toUpperCase().replace(/\s+/g, '');
  const c = code && await F.getDoc(ref('codigos', code));
  if (!c || !c.exists()) throw { code: 'codigo' };
  const cid = c.data().cong, u = nube.user;
  await F.setDoc(ref('congregaciones', cid, 'miembros', u.uid), { nombre: squash(nombre), email: u.email, estado: 'pendiente',
    admin: false, permisos: [], perfil: null, codigo: code, creado: F.serverTimestamp() });
  await F.setDoc(ref('usuarios', u.uid), { cong: cid });
  nube.cong = cid;
}

async function createCongregation(nombreCong, nombre) {
  const u = nube.user, cid = F.doc(F.collection(F.db, 'congregaciones')).id, code = await freeCode();
  await F.setDoc(ref('congregaciones', cid), { nombre: squash(nombreCong), codigo: code, creador: u.uid, modo: 'todos' });
  await F.setDoc(ref('codigos', code), { cong: cid });
  await F.setDoc(ref('congregaciones', cid, 'miembros', u.uid), { nombre: squash(nombre), email: u.email, estado: 'activo',
    admin: true, permisos: [], perfil: null, codigo: code, creado: F.serverTimestamp() });
  // Si esta PC ya tenía datos (versión sin cuentas), se pueden llevar a la congregación nueva.
  // Se suben al entrar (firstLoad), por el mismo camino que cualquier cambio.
  let datos = defaults();
  const local = load();
  if ((local.programs.length || local.profiles.length) &&
    confirm(`En este equipo hay ${local.profiles.length} perfiles y ${local.programs.length} semanas guardados. ¿Subirlos a la congregación nueva?`)) datos = local;
  datos.settings.congregation = squash(nombreCong);
  nube.inicial = datos;
  await F.setDoc(ref('usuarios', u.uid), { cong: cid });
  nube.cong = cid;
}

async function changeCode() {
  if (!confirm('Se creará un código nuevo y el actual dejará de servir para crear cuentas. Las cuentas que ya existen no cambian. ¿Continuar?')) return;
  try {
    const old = nube.congData.codigo, code = await freeCode();
    await F.setDoc(ref('codigos', code), { cong: nube.cong });
    await F.updateDoc(congRef(), { codigo: code });
    if (old) await F.deleteDoc(ref('codigos', old)).catch(() => {});
    toast('Código nuevo: ' + code);
  } catch (e) { toast(errMsg(e)); }
}

// Al abrir: carga Firebase y sigue la sesión (entrar, salir, aprobación, cambio de rol)
async function startCloud() {
  screen(h('div', { class: 'card auth-card' }, h('p', { class: 'muted' }, 'Conectando…')));
  try { await loadFirebase(); }
  catch (e) { return screenMessage('No se pudo conectar. Revisa tu internet y vuelve a abrir la app.'); }
  // Enlace que llegó a la app de PC o al APK antes de cargar Firebase, o la página web abierta desde el correo
  const fromApp = nube.enlace; nube.enlace = null;
  const href = fromApp || location.href;
  if (F.isSignInWithEmailLink(F.auth, href)) {
    const forApp = !fromApp && /[?&]para-app=1/.test(location.search);
    if (!fromApp) history.replaceState(null, '', location.pathname + (EMU ? '?emu' : ''));
    if (forApp && !LINK_APP) return renderLinkForApp(href);
    if (!linkEmail()) return renderLinkEmail(href);
    await completeLink(href, linkEmail()).catch(e => toast(errMsg(e)));
  }
  watchAuth();
}
function watchAuth() {
  if (nube.watching) { if (!nube.user) renderAuth(); return; }
  nube.watching = true;
  F.onAuthStateChanged(F.auth, async user => {
    stopListening(); if (nube.unsubMe) { nube.unsubMe(); nube.unsubMe = null; }
    histCache = null; reportsCache = { key: '', docs: [] }; // lo leído con la cuenta anterior no se queda
    nube.consOk = false;
    Object.assign(nube, { user, mesInforme: null, mesInformes: null, cong: null, congData: null, me: null, acceso: '', listo: false, miembros: [], anuncios: [],
      contactos: new Map(), cuentas: [], cuentasIni: null, territorios: [], grupos: [], capitanes: [], capitanesHermanos: [], trabajos: [], asistencia: new Map(), eventos: [], salidas: [], publica: [], pastoreo: [], solicitudes: [], limpieza: null, ausencias: new Map(), confirmaciones: new Map(), vista: null, publico: null, sent: {}, ultimoPub: '' });
    if (!user) return renderAuth();
    screen(h('div', { class: 'card auth-card' }, h('p', { class: 'muted' }, 'Cargando tu cuenta…')));
    let joinErr = '';
    try {
      const reg = nube.registro; nube.registro = null;
      const prev = await F.getDoc(ref('usuarios', user.uid)), prevCong = prev.exists() ? prev.data().cong : null;
      nube.vista = prev.exists() ? prev.data().vista || null : null;
      // Si la cuenta ya es miembro de una congregación, se queda en la suya (no se cambia por error)
      let member = false;
      if (reg && prevCong) { try { member = (await F.getDoc(ref('congregaciones', prevCong, 'miembros', user.uid))).exists(); } catch (e) {} }
      if (reg && member) toast('Esa cuenta ya pertenece a una congregación: entraste a la suya.');
      else if (reg && reg.tipo === 'unirse') await joinCongregation(reg.codigo, reg.nombre).catch(e => { joinErr = errMsg(e); });
      else if (reg && reg.tipo === 'crear') await createCongregation(reg.cong, reg.nombre);
      if (reg && reg.acepta && nube.cong) await saveConsent(reg.nombre).catch(() => {}); // aceptó al crear la cuenta
      if (!nube.cong && !joinErr) nube.cong = prevCong;
    } catch (e) { return screenMessage(errMsg(e)); }
    if (!nube.cong) return renderJoin(joinErr);
    nube.unsubMe = F.onSnapshot(congRef('miembros', user.uid), snap => {
      nube.me = snap.exists() ? snap.data() : null;
      if (!nube.me || nube.me.estado !== 'activo') {
        stopListening(); nube.acceso = ''; nube.listo = false;
        return nube.me ? renderWaiting() : renderJoin('Tu solicitud fue rechazada o se quitó tu cuenta de la congregación.');
      }
      // Antes de cargar nada: que esta cuenta haya aceptado el aviso vigente (app/legal.js)
      if (!nube.consOk) {
        if (nube.consChecking) return;
        nube.consChecking = true;
        consentOk().then(ok => {
          nube.consChecking = false;
          const go = () => { nube.consOk = true; nube.acceso = accessKey(); enterCongregation(); };
          if (!nube.me || nube.me.estado !== 'activo') return;
          if (ok) go(); else renderConsent(go);
        });
        return;
      }
      // Si cambian sus funciones, se vuelve a cargar con lo que ahora puede ver
      const key = accessKey();
      if (key !== nube.acceso) { nube.acceso = key; enterCongregation(); }
      else if (nube.listo && !busy()) render();
    }, e => screenMessage(errMsg(e)));
  });
}

function stopListening() { nube.unsubDatos.forEach(f => f()); nube.unsubDatos = []; stopViewSubs(); }

// Escucha lo que esta cuenta puede ver según sus funciones. Los cambios de otros llegan solos.
function enterCongregation() {
  stopListening();
  nube.listo = false; nube.sent = {}; nube.ultimoPub = ''; captainsSent = ''; view = { name: 'inicio' };
  state = defaults();
  screen(h('div', { class: 'card auth-card' }, h('p', { class: 'muted' }, 'Cargando la congregación…')));
  const waiting = new Set();
  // fn devuelve true si cambió algo que hay que volver a dibujar
  // soft: si esa parte falla (por ejemplo, sin permiso), la app sigue sin ella en vez de mostrar el error
  const listen = (name, r, fn, soft) => {
    waiting.add(name);
    nube.unsubDatos.push(F.onSnapshot(r, s => {
      const changed = fn(s);
      if (waiting.delete(name) && !waiting.size) return firstLoad();
      if (nube.listo && changed) {
        // Informes e Historial no se redibujan por cambios de otras partes: se cortaba su carga (con internet
        // lento se quedaba en “Cargando…”) y se perdía lo que se iba llenando del informe. Se actualizan solos.
        if (['report', 'historial'].includes(view.name)) return;
        if (!busy()) render();
        else { nube.redraw = true; if (!['cong', 'anuncios', 'contactos'].includes(name)) toast('Otro hermano hizo cambios; se verán al terminar de editar.'); }
      }
    }, e => {
      if (!soft) return screenMessage(errMsg(e));
      if (waiting.delete(name) && !waiting.size) firstLoad();
    }));
  };
  listen('cong', congRef(), s => { nube.congData = s.data() || {}; return true; });
  if (isAdmin()) listen('miembros', F.collection(F.db, 'congregaciones', nube.cong, 'miembros'), s => {
    nube.miembros = s.docs.map(d => ({ id: d.id, ...d.data() }));
    publishCaptains();
    if (nube.listo && view.name !== 'people') buildNav();
    return view.name === 'people';
  });
  // Capitanes (cuentas con la función): el coordinador publica la lista para que el siervo de territorios asigne
  if (can('territorios') || isElder()) {
    listen('capitanes', congRef('capitanes', 'lista'), s => { nube.capitanes = (s.exists() && s.data().lista) || []; return false; });
    listen('capitanesHermanos', congRef('capitanes', 'hermanos'), s => { nube.capitanesHermanos = (s.exists() && s.data().lista) || []; return false; });
  }
  // Registros de lo trabajado en territorios (desde el año pasado)
  if (can('territorios') || can('capitan')) listen('trabajos', F.query(F.collection(F.db, 'congregaciones', nube.cong, 'trabajos'),
    F.where('fecha', '>=', `${new Date().getFullYear() - 1}-01-01`)), s => {
    nube.trabajos = s.docs.map(d => ({ id: d.id, ...d.data() }));
    if (view.name === 'territorios' && terr && terr.refresh) terr.refresh();
    return false;
  });
  // Calendario y arreglos: los ven todos
  listen('eventos', F.collection(F.db, 'congregaciones', nube.cong, 'eventos'), s => { nube.eventos = s.docs.map(d => ({ id: d.id, ...d.data() })); return ['calendario', 'list', 'inicio', 'edit'].includes(view.name); }, true);
  listen('salidas', F.collection(F.db, 'congregaciones', nube.cong, 'salidas'), s => { nube.salidas = s.docs.map(d => ({ id: d.id, ...d.data() })); return view.name === 'arreglos'; }, true);
  // Predicación pública (turnos desde hace una semana) y pastoreo (solo ancianos)
  listen('publica', F.query(F.collection(F.db, 'congregaciones', nube.cong, 'publica'), F.where('fecha', '>=', addDays(todayISO(), -7))), s => { nube.publica = s.docs.map(d => ({ id: d.id, ...d.data() })); return ['arreglos', 'inicio'].includes(view.name); }, true);
  if (isElder()) listen('pastoreo', F.collection(F.db, 'congregaciones', nube.cong, 'pastoreo'), s => { nube.pastoreo = s.docs.map(d => ({ id: d.id, ...d.data() })); return ['pastoreo', 'inicio'].includes(view.name); }, true);
  if (isAdmin()) listen('solicitudes', F.query(F.collection(F.db, 'congregaciones', nube.cong, 'solicitudes'), F.where('estado', '==', 'pendiente')), s => { nube.solicitudes = s.docs.map(d => ({ id: d.id, ...d.data() })); return view.name === 'inicio'; }, true);
  listen('limpieza', congRef('arreglos', 'limpieza'), s => { nube.limpieza = s.exists() ? s.data() : null; return ['arreglos', 'inicio'].includes(view.name); }, true);
  // Ausencias: los ancianos ven todas; cada quien, la suya
  const gotAway = () => ['inicio', 'people', 'mecanicas', 'finsemana'].includes(view.name);
  if (isElder()) listen('ausencias', F.collection(F.db, 'congregaciones', nube.cong, 'ausencias'), s => { nube.ausencias = new Map(s.docs.map(d => [d.id, d.data()])); return gotAway(); }, true);
  else if (nube.me.perfil) listen('ausencias', congRef('ausencias', nube.me.perfil), s => { nube.ausencias = new Map(s.exists() ? [[s.id, s.data()]] : []); return gotAway(); }, true);
  const gotConf = () => ['inicio', 'list', 'edit', 'mecanicas'].includes(view.name);
  if (can('programa')) listen('confirmaciones', F.collection(F.db, 'congregaciones', nube.cong, 'confirmaciones'), s => { nube.confirmaciones = new Map(s.docs.map(d => [d.id, d.data()])); return gotConf(); }, true);
  else if (nube.me.perfil) listen('confirmaciones', congRef('confirmaciones', nube.me.perfil), s => { nube.confirmaciones = new Map(s.exists() ? [[s.id, s.data()]] : []); return gotConf(); }, true);
  trackSession();
  if (isElder()) listen('asistencia', F.collection(F.db, 'congregaciones', nube.cong, 'asistencia'), s => {
    nube.asistencia = new Map(s.docs.map(d => [d.id, d.data()]));
    return view.name === 'asistencia';
  });
  if (isElder()) listen('grupos', F.collection(F.db, 'congregaciones', nube.cong, 'grupos'), s => {
    nube.grupos = s.docs.map(d => ({ id: d.id, ...d.data() }));
    return ['grupos', 'people'].includes(view.name);
  });
  for (const [col, key, perms] of COLLS) if (perms.some(can)) listen(col, F.collection(F.db, 'congregaciones', nube.cong, col), s => receiveDocs(col, key, s));
  // Anuncios: los ancianos ven todos; los demás, solo los compartidos con la congregación
  const annCol = F.collection(F.db, 'congregaciones', nube.cong, 'anuncios');
  listen('anuncios', isElder() ? annCol : F.query(annCol, F.where('publico', '==', true)), s => {
    nube.anuncios = s.docs.map(d => ({ id: d.id, ...d.data() }));
    if (nube.listo && view.name !== 'anuncios') buildNav();
    return ['anuncios', 'list', 'inicio'].includes(view.name);
  }, true); // si falla (por ejemplo, reglas más nuevas), la app sigue sin anuncios
  if (isElder()) listen('contactos', F.collection(F.db, 'congregaciones', nube.cong, 'contactos'), s => {
    nube.contactos = new Map(s.docs.map(d => [d.id, d.data()]));
    return view.name === 'people';
  });
  // Territorios: si el mapa está abierto se actualizan los colores ahí mismo, sin redibujar la página
  listen('territorios', F.collection(F.db, 'congregaciones', nube.cong, 'territorios'), s => {
    nube.territorios = s.docs.map(d => ({ id: d.id, ...d.data() }));
    if (view.name === 'territorios' && terr && terr.refresh) { terr.refresh(); return false; }
    return false;
  });
  if (can('cuentas')) {
    listen('cuentas', F.collection(F.db, 'congregaciones', nube.cong, 'cuentas'), s => {
      nube.cuentas = s.docs.map(d => ({ id: d.id, ...d.data() }));
      return view.name === 'cuentas';
    });
    listen('cuentasIni', congRef('cuentasConfig', 'inicial'), s => { nube.cuentasIni = s.exists() ? s.data() : null; return view.name === 'cuentas'; });
  }
  if (can('programa')) listen('config', congRef('config', 'ajustes'), receiveConfig);
  // Los demás ancianos leen los ajustes (día y hora del fin de semana, temas de bosquejos) para ver Fin de semana
  if (!can('programa') && isElder()) listen('config', congRef('config', 'ajustes'), receiveConfig, true);
  if (!can('programa')) listen('publico', congRef('publico', 'programa'), s => { nube.publico = s.exists() ? s.data() : null; if (nube.listo) scheduleReminders(); return true; });
}

// Cambios de otros en una colección (los propios ya están en state)
function receiveDocs(col, key, snap) {
  const sent = nube.sent[col] || (nube.sent[col] = new Map());
  let changed = false;
  for (const ch of snap.docChanges()) {
    if (ch.doc.metadata.hasPendingWrites) continue;
    const id = ch.doc.id, list = state[key], i = list.findIndex(o => o.id === id);
    if (ch.type === 'removed') {
      if (sent.has(id)) { sent.delete(id); if (i >= 0) list.splice(i, 1); changed = true; }
      continue;
    }
    const data = { ...ch.doc.data(), id }, json = stable(data);
    if (sent.get(id) === json) continue;
    sent.set(id, json);
    if (i >= 0) list[i] = data; else list.push(data);
    changed = true;
  }
  if (changed && key !== 'programs') refreshDatalist();
  return changed;
}
function receiveConfig(snap) {
  if (!snap.exists() || snap.metadata.hasPendingWrites) return false;
  const d = snap.data(), json = stable(d);
  if (nube.sent.config === json) return false;
  nube.sent.config = json;
  Object.assign(state, hydrate({ ...configOf(state), ...d, profiles: [], families: [], programs: [] }), {
    profiles: state.profiles, families: state.families, programs: state.programs });
  return true;
}

// Ya llegó todo por primera vez: si la congregación está vacía, se suben los datos
// iniciales (congregación nueva) o los de la versión 1.2 (privado/estado).
async function firstLoad() {
  if (can('programa') && !state.profiles.length && !state.programs.length && !nube.sent.config) {
    let datos = nube.inicial; nube.inicial = null;
    if (!datos && isAdmin()) {
      try {
        const old = await F.getDoc(congRef('privado', 'estado'));
        if (old.exists() && !old.data().migrado) { datos = JSON.parse(old.data().datos); nube.migrar = true; }
      } catch (e) {}
    }
    if (datos) {
      const fresh = hydrate(datos);
      state.profiles.push(...fresh.profiles); state.families.push(...fresh.families); state.programs.push(...fresh.programs);
      Object.assign(state, configOf(fresh));
      await uploadState();
      if (nube.migrar) { await F.updateDoc(congRef('privado', 'estado'), { migrado: true }).catch(() => {}); nube.migrar = false; }
    }
  }
  // El nombre de la congregación se cambia en Ajustes (coordinador); el PDF lo toma de aquí
  if (can('programa') && nube.congData.nombre && state.settings.congregation !== nube.congData.nombre) {
    state.settings.congregation = nube.congData.nombre; save();
  }
  nube.listo = true;
  // Una sola vez por congregación: los estudiantes varones también quedan para la lectura de la Biblia
  if (can('programa') && !state.settings.lecturaAuto) {
    const fix = state.profiles.filter(p => p.sex === 'M' && Array.isArray(p.puede) && p.puede.includes('estudiante') && !p.puede.includes('lectura'));
    fix.forEach(p => p.puede.push('lectura'));
    state.settings.lecturaAuto = true; save();
    if (fix.length) setTimeout(() => toast(`Se activó la lectura de la Biblia a ${fix.length} estudiante${fix.length > 1 ? 's' : ''} ${fix.length > 1 ? 'varones' : 'varón'}`), 1500);
  }
  render();
  if (can('programa')) startJw();
  setTimeout(maybeShowGuide, 700);
  setTimeout(publishPioneers, 2000);
  setTimeout(scheduleReminders, 1500);
  setTimeout(startPush, 2500); // avisos al celular (mas.js)
  if (isAdmin()) setTimeout(autoBackup, 6000);
  // Antes de la 1.33 todos los anuncios eran para todos: se marcan como compartidos para que se sigan viendo
  if (isElder()) setTimeout(() => nube.anuncios.filter(a => !('publico' in a))
    .forEach(a => F.updateDoc(congRef('anuncios', a.id), { publico: true }).catch(() => {})), 3000);
}

function saveCloud() {
  if (!can('programa') || !nube.listo) return;
  clearTimeout(saveCloud.t);
  saveCloud.t = setTimeout(uploadState, 800);
}
// Sube solo los documentos que cambiaron (y borra los que ya no están)
async function uploadState() {
  clearTimeout(saveCloud.t); saveCloud.t = null;
  if (!nube.cong || !can('programa')) return; // ya se cerró la sesión
  const writes = [];
  for (const [col, key] of COLLS) {
    const sent = nube.sent[col] || (nube.sent[col] = new Map()), now = new Map(state[key].map(o => [o.id, o]));
    for (const [id, o] of now) {
      const json = stable(o), prev = sent.get(id);
      if (prev !== json) {
        if (nube.listo) describeChanges(col, prev ? JSON.parse(prev) : null, o).forEach(logChange);
        sent.set(id, json); writes.push(F.setDoc(congRef(col, id), clean(o)));
      }
    }
    for (const id of [...sent.keys()]) if (!now.has(id)) {
      if (nube.listo) describeChanges(col, JSON.parse(sent.get(id)), null).forEach(logChange);
      sent.delete(id); writes.push(F.deleteDoc(congRef(col, id)));
    }
  }
  const caps = state.profiles.filter(p => p.capitan).map(p => ({ perfil: p.id, nombre: p.name })).sort(byNombre), capsJson = JSON.stringify(caps);
  if (nube.sent.capitanes !== capsJson) { nube.sent.capitanes = capsJson; writes.push(F.setDoc(congRef('capitanes', 'hermanos'), { lista: caps })); }
  const config = clean(configOf(state)), json = stable(config);
  if (nube.sent.config !== json) {
    if (nube.listo && nube.sent.config && stable(JSON.parse(nube.sent.config).settings) !== stable(config.settings)) logChange('Cambió los ajustes del programa');
    nube.sent.config = json; writes.push(F.setDoc(congRef('config', 'ajustes'), config));
  }
  try { await Promise.all(writes); await publishProgram(); }
  catch (e) { toast('No se pudo guardar en la nube: ' + errMsg(e)); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveCloud.t) uploadState(); });

// Lo que ven todos: semanas desde hace un mes, ya con horas y nombres (sin edades ni notas)
function publicWeeks() {
  const from = addDays(mondayOf(todayISO()), -28);
  const person = id => { const pr = id && profById(id); return pr ? { id, n: pr.name } : null; };
  return state.programs.filter(p => p.date >= from).sort((a, b) => a.date.localeCompare(b.date)).map(p => {
    const t = timesFor(p);
    return { id: p.id, date: p.date, day: meetingDate(p), title: p.title, reading: p.reading || '', meeting: fmtMeeting(p),
      rows: p.rows.map(r => ({ id: r.id, kind: r.kind, section: r.section || '', t: displayTitle(r), min: r.kind === 'part' ? +r.min || null : null,
        time: fmtTime(t[r.id]), detail: r.kind === 'part' ? r.detail || '' : '', labels: slotLabels(r),
        a: isAssignable(r) ? person(r.a) : null, b: isAssignable(r) && r.helper ? person(r.b) : null,
        ...(auxOn(p) && isAssignable(r) && hasAux(r) ? { xa: person(r.xa), xb: r.helper && r.kind !== 'chair' ? person(r.xb) : null,
          labels: { ...slotLabels(r), xa: r.kind === 'chair' ? auxLabel(r, 'xa') : auxLabel(r, 'xa') ? auxLabel(r, 'xa') + ' (sala aux.)' : 'Sala auxiliar',
          xb: slotLabels(r).b ? slotLabels(r).b + ' (sala aux.)' : 'Sala auxiliar' } } : {}) })),
      // Asignaciones mecánicas (sin repetir presidente y lector de entre semana, que ya están arriba)
      fin: p.fin && (p.fin.tema || p.fin.orador) ? { tema: p.fin.tema || '', bosquejo: p.fin.bosquejo || '', orador: p.fin.orador || '', cong: p.fin.cong || '', oradorId: p.fin.oradorId || null, day: mecDate(p, 'fin') } : null,
      mec: MEETINGS.map(([mtg, label]) => ({ mtg, label, day: mecDate(p, mtg),
        items: MEC.filter(r => !mecLinked(p, mtg, r.key)).map(r => ({ l: r.label, k: r.key, ...person(mecGet(p, mtg, r.key)) })).filter(x => x.id) }))
        .filter(m => m.items.length) };
  });
}
async function publishProgram() {
  const semanas = JSON.stringify(publicWeeks());
  if (semanas === nube.ultimoPub) return;
  nube.ultimoPub = semanas;
  await F.setDoc(congRef('publico', 'programa'), { semanas, actualizado: F.serverTimestamp() });
}

const congName = () => (nube.congData && nube.congData.nombre) || '';
// Antes de salir se sube lo que esté pendiente de guardar
const signOutBtn = () => h('button', { class: 'btn', onclick: async () => { if (saveCloud.t) await uploadState(); await forgetSession(); F.signOut(F.auth); } }, 'Cerrar sesión');
// Si llegaron cambios mientras había un diálogo abierto, se dibujan al cerrarlo
// (todos los diálogos se quitan de la página al cerrarse)
new MutationObserver(muts => {
  if (!nube.redraw || !muts.some(m => [...m.removedNodes].some(n => n.tagName === 'DIALOG'))) return;
  setTimeout(() => { if (nube.listo && !busy()) { nube.redraw = false; render(); } });
}).observe(document.body, { childList: true });
