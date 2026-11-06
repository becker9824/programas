// Programas · Guía, historial, confirmar, recordatorios, sesiones, respaldos, vista propia y ausencias.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- guía de primeros pasos ----------
// Sale sola la primera vez que alguien entra (por cuenta y equipo) y se puede ver de nuevo en Ajustes.
// Los pasos dependen de las funciones de cada quien.
function guideSteps() {
  const steps = [{ icon: 'inicio', title: `Bienvenido${nube.me && nube.me.nombre ? ', ' + nube.me.nombre.split(' ')[0] : ''}`,
    text: 'Aquí está todo lo de la congregación: el programa de las reuniones, tus asignaciones, anuncios y más. Esta guía te muestra lo principal en un minuto.' }];
  if (isAdmin()) steps.push({ icon: 'people', title: 'Coordinador: invita a los hermanos',
    text: 'En Hermanos está el código de la congregación: compártelo para que cada quien cree su cuenta. Tú las apruebas, las unes con su nombre y eliges qué funciones tiene cada uno.' });
  if (can('programa')) steps.push(
    { icon: 'list', title: 'Programa de Vida y Ministerio', text: 'En Semanas, las guías de jw.org se bajan solas. Toca un espacio y elige de la lista de recomendados, o usa “Sugerencias” para llenar toda la semana. Si hay sala auxiliar, actívala en la semana.' },
    { icon: 'mecanicas', title: 'Mecánicas y fin de semana', text: 'En Mecánicas van micrófonos, acomodadores y audio; en Fin de semana, el discurso público, el orador y el lector de La Atalaya. “Avisar por WhatsApp” manda a cada quien su asignación.' });
  if (can('secretario')) steps.push({ icon: 'report', title: 'Informes y registros', text: 'En Informes ves quién falta, capturas informes y sacas las tarjetas S-21. En Asistencia anotas cuántos asistieron a cada reunión (S-88).' });
  if (canTerritories()) steps.push({ icon: 'territorios', title: 'Territorios', text: 'Dibuja cada tarjeta en el mapa, asígnala a un capitán y revisa lo que se trabajó. Cuando se completan todas, empieza otra vuelta sola.' });
  else if (can('capitan')) steps.push({ icon: 'territorios', title: 'Capitán de territorios', text: 'En Territorios salen “Mis tarjetas”. Al llegar, toca “Empezar salida con GPS”: graba lo que recorren y al terminar lo registra. También puedes marcar casas y hasta dónde llegaron.' });
  if (isElder()) steps.push({ icon: 'calendario', title: 'Calendario y arreglos', text: 'En Calendario van la visita del superintendente de circuito, asambleas y la Conmemoración. En Arreglos, las salidas de predicación y la limpieza del Salón. En Historial ves quién cambió qué.' });
  steps.push({ icon: 'report', title: 'Tu parte', text: 'En Inicio ves tu próxima asignación. ' + (reportsByMembers() ? 'Cada mes mandas tu informe desde Informe. ' : '') + 'Si vas a faltar un tiempo, activa tu Ausencia en Inicio y no te tomarán en cuenta para asignaciones. Si se va el internet, la app sigue funcionando y guarda los cambios para subirlos después.' });
  return steps;
}
// Color de cada paso (según su ícono) y la sección donde está, para la etiqueta “Lo encuentras en…”
const GUIDE_LOOK = {
  inicio: ['#2563eb', '#60a5fa'], people: ['#7c3aed', '#a78bfa'], list: ['#0f766e', '#2dd4bf'], mecanicas: ['#c2410c', '#fb923c'],
  report: ['#15803d', '#4ade80'], territorios: ['#047857', '#34d399'], calendario: ['#be185d', '#f472b6'],
};
const GUIDE_WHERE = { people: 'Hermanos', list: 'Semanas', mecanicas: 'Mecánicas', territorios: 'Territorios', calendario: 'Calendario' };
function openGuide() {
  const steps = guideSteps();
  let i = 0, dir = 1;
  const hero = h('div', { class: 'gd-hero' }), text = h('div', { class: 'gd-text' }), bars = h('div', { class: 'gd-bars' });
  const count = h('span', { class: 'gd-count' }), back = h('button', { class: 'btn', onclick: () => go(-1) }, 'Anterior');
  const next = h('button', { class: 'btn primary gd-next' });
  const close = () => { try { localStorage.setItem('guia-' + (nube.user ? nube.user.uid : 'local'), '1'); } catch (e) {} dlg.close(); dlg.remove(); };
  const go = d => { const n = i + d; if (n < 0 || n >= steps.length) return; dir = d; i = n; paint(); };
  const paint = () => {
    const st = steps[i], [c1, c2] = GUIDE_LOOK[st.icon] || GUIDE_LOOK.inicio, last = i === steps.length - 1;
    dlg.style.setProperty('--g1', c1); dlg.style.setProperty('--g2', c2);
    // Ícono con anillos y destellos; en el último paso, una palomita que se dibuja sola
    hero.replaceChildren(h('span', { class: 'gd-orb o1' }), h('span', { class: 'gd-orb o2' }), h('span', { class: 'gd-orb o3' }),
      h('div', { class: 'gd-ring r1' }), h('div', { class: 'gd-ring r2' }),
      h('div', { class: 'gd-icon' + (last ? ' done' : '') }, last ? h('span', { class: 'ic' }) : icon(st.icon, 40)));
    if (last) hero.querySelector('.gd-icon .ic').innerHTML = '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="gd-check" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    text.replaceChildren(h('div', { class: 'gd-slide ' + (dir > 0 ? 'from-r' : 'from-l') },
      GUIDE_WHERE[st.icon] ? h('span', { class: 'gd-where' }, icon(st.icon, 14), 'En ', GUIDE_WHERE[st.icon]) : null,
      h('h3', null, st.title), h('p', null, st.text)));
    bars.replaceChildren(...steps.map((_, k) => h('button', { type: 'button', class: k < i ? 'done' : k === i ? 'on' : '', 'aria-label': `Paso ${k + 1}`,
      onclick: () => { if (k !== i) { dir = k > i ? 1 : -1; i = k; paint(); } } }, h('span'))));
    count.textContent = `${i + 1} de ${steps.length}`;
    back.style.visibility = i ? 'visible' : 'hidden';
    next.replaceChildren(...(last ? ['¡Empezar!'] : ['Siguiente', icon('chev', 16)]));
    next.onclick = last ? close : () => go(1);
  };
  const dlg = h('dialog', { class: 'dlg guide' },
    h('div', { class: 'gd-top' }, bars, h('button', { class: 'gd-skip', onclick: close }, 'Saltar')),
    hero, text,
    h('div', { class: 'gd-foot' }, back, count, next));
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dlg.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); });
  // Deslizar con el dedo para cambiar de paso
  let sx = null;
  dlg.addEventListener('pointerdown', e => { sx = e.clientX; });
  dlg.addEventListener('pointerup', e => { if (sx != null && Math.abs(e.clientX - sx) > 50 && !e.target.closest('button')) go(e.clientX < sx ? 1 : -1); sx = null; });
  paint();
  document.body.append(dlg); dlg.showModal(); next.focus();
}
function maybeShowGuide() {
  let seen = true;
  try { seen = !!localStorage.getItem('guia-' + (nube.user ? nube.user.uid : 'local')); } catch (e) {}
  if (!seen && !document.querySelector('dialog[open]')) openGuide();
}

// ---------- historial de cambios ----------
// historial/{id} = { fecha, por, porNombre, cambios: [texto] }. Lo escribe cada quien al guardar; lo ven los ancianos.
let pendingLog = [], logTimer = null;
function logChange(text) {
  if (!FB_CONFIG || !nube.cong || !nube.listo || !text) return;
  pendingLog.push(String(text).slice(0, 300));
  clearTimeout(logTimer);
  logTimer = setTimeout(flushLog, 1500); // junta los cambios que se hacen seguidos
}
function flushLog() {
  if (!pendingLog.length || !nube.cong) return;
  const cambios = pendingLog.splice(0, 30);
  F.addDoc(F.collection(F.db, 'congregaciones', nube.cong, 'historial'),
    { fecha: F.serverTimestamp(), por: nube.user.uid, porNombre: (nube.me && nube.me.nombre) || '', cambios }).catch(() => {});
  if (pendingLog.length) flushLog();
}
// Qué cambió en los datos del programa entre lo que había y lo que se sube (para el historial)
function describeChanges(col, before, after) {
  const nm = id => (profById(id) || {}).name || (id ? '(hermano borrado)' : '');
  if (col === 'perfiles') return !before ? [`Agregó al hermano ${after.name}`] : !after ? [`Quitó al hermano ${before.name}`] : [`Cambió los datos de ${after.name}`];
  if (col === 'familias') return !before ? [`Agregó la familia ${after.name}`] : !after ? [`Quitó la familia ${before.name}`] : [`Cambió la familia ${after.name}`];
  if (col !== 'semanas') return [];
  if (!before) return [`Agregó la semana ${after.title}`];
  if (!after) return [`Quitó la semana ${before.title}`];
  const out = [], rowsB = new Map(before.rows.map(r => [r.id, r]));
  for (const r of after.rows) {
    const b = rowsB.get(r.id) || {};
    for (const k of ['a', 'b', 'xa', 'xb']) if ((b[k] || null) !== (r[k] || null))
      out.push(`${after.title} · ${roleLabel(r, k)}: ${r[k] ? nm(r[k]) : 'sin asignar'}${b[k] ? ` (antes ${nm(b[k])})` : ''}`);
  }
  for (const [mtg, label] of MEETINGS) for (const m of MEC) {
    const x = ((before.mec || {})[mtg] || {})[m.key] || null, y = ((after.mec || {})[mtg] || {})[m.key] || null;
    if (x !== y && !mecLinked(after, mtg, m.key)) out.push(`${after.title} · ${m.label} (${label.toLowerCase()}): ${y ? nm(y) : 'sin asignar'}${x ? ` (antes ${nm(x)})` : ''}`);
  }
  const fb = before.fin || {}, fa = after.fin || {};
  if ((fb.tema || '') !== (fa.tema || '') || (fb.orador || '') !== (fa.orador || '')) out.push(`${after.title} · Discurso público: ${fa.tema || '—'}, orador ${fa.orador || '—'}`);
  return out.length ? out.slice(0, 12) : [`Editó la semana ${after.title}`];
}

let histFilter = '', histCache = null; // lo último leído: se ve al instante mientras se actualiza
function renderHistory() {
  const box = h('div', { class: 'card', style: { padding: '4px 14px' } }, h('div', { class: 'empty' }, 'Cargando…'));
  const search = h('input', { type: 'search', placeholder: 'Buscar: un nombre, una semana…', value: histFilter, style: { width: '100%', maxWidth: '380px' },
    oninput: () => { histFilter = search.value; fill(); } });
  let items = histCache || [];
  function fill() {
    const f = norm(histFilter);
    const list = items.filter(x => !f || norm([x.porNombre, ...(x.cambios || [])].join(' ')).includes(f));
    let day = '';
    box.replaceChildren(...(list.length ? list.flatMap(x => {
      const d = x.fecha && x.fecha.toDate ? x.fecha.toDate() : new Date();
      const dk = isoOf(d), head = dk !== day ? (day = dk, h('div', { class: 'hist-day' }, capFirst(d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })))) : null;
      return [head, h('div', { class: 'hist-item' },
        h('span', { class: 'hist-time' }, d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })),
        h('div', null, h('strong', null, x.porNombre || 'Alguien'), h('ul', null, (x.cambios || []).map(c => h('li', null, c)))))];
    }).filter(Boolean) : [h('div', { class: 'empty' }, items.length ? 'Nada coincide con la búsqueda.' : 'Todavía no hay cambios registrados.')]));
  }
  if (histCache) fill();
  F.getDocs(F.query(F.collection(F.db, 'congregaciones', nube.cong, 'historial'), F.orderBy('fecha', 'desc'), F.limit(300)))
    .then(s => { items = histCache = s.docs.map(d => d.data()); fill(); })
    .catch(e => box.replaceChildren(h('div', { class: 'empty' }, errMsg(e))));
  return h('div', null,
    h('h1', null, 'Historial de cambios'),
    h('p', { class: 'sub' }, 'Quién cambió qué y cuándo: asignaciones, hermanos, territorios, cuentas, calendario y más. Se ven los últimos 300 movimientos.'),
    h('div', { style: { marginBottom: '12px' } }, search),
    box);
}

// ---------- confirmar asignaciones ----------
// confirmaciones/{perfil} = { lista: { 'semana|fila|espacio': 'AAAA-MM-DD' } } (mecánicas: 'semana|mec|reunión|clave';
// discurso: 'semana|fin|orador'). Cada quien confirma las suyas; Programa VyM ve las de todos.
const confirmedOn = (pid, key) => !!(FB_CONFIG && pid && key && ((nube.confirmaciones.get(pid) || {}).lista || {})[key]);
async function confirmAssignment(key) {
  const pid = nube.me && nube.me.perfil;
  if (!pid || !key) return;
  const all = { ...((nube.confirmaciones.get(pid) || {}).lista || {}), [key]: todayISO() };
  const lista = Object.fromEntries(Object.entries(all).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 60));
  nube.confirmaciones.set(pid, { lista });
  if (!busy()) render();
  try { await F.setDoc(congRef('confirmaciones', pid), { lista }); toast('¡Gracias! Ya saben que recibiste tu asignación.'); }
  catch (e) { toast(errMsg(e)); }
}
function confirmButton(x, small) {
  if (!FB_CONFIG || !x.key) return null;
  return confirmedOn(nube.me && nube.me.perfil, x.key) ? h('span', { class: 'conf-ok' }, '✓ Confirmaste')
    : h('button', { class: 'btn small' + (small ? '' : ' primary'), title: 'Avisa al encargado que ya la recibiste',
      onclick: e => { e.stopPropagation(); e.target.disabled = true; confirmAssignment(x.key); } }, '✔ Recibido');
}

// ---------- recordatorios de asignaciones ----------
// APK: avisos del celular (plugin LocalNotifications), 3 días antes a las 10:00 y un día antes a las 18:00, aunque la app esté cerrada.
// PC y web: al abrir (y cada hora mientras está abierta) avisa una vez al día si hay una asignación en los próximos 2 días.
const remindersOn = () => { try { return localStorage.getItem('recordatorios') !== 'no'; } catch (e) { return true; } };
const LN = NATIVE ? capacitorExports.registerPlugin('LocalNotifications') : null;
const myWeeks = () => can('programa') ? publicWeeks() : nube.publico ? JSON.parse(nube.publico.semanas || '[]') : [];
async function scheduleReminders() {
  if (!FB_CONFIG || !nube.listo || !nube.me) return;
  const list = nube.me.perfil ? myAssignments(myWeeks()) : [];
  if (LN) {
    try {
      const pend = await LN.getPending();
      if (pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
      if (!remindersOn() || !list.length) return;
      let perm = await LN.checkPermissions();
      if (perm.display !== 'granted') perm = await LN.requestPermissions();
      if (perm.display !== 'granted') return;
      const now = Date.now(), notifications = [];
      list.slice(0, 20).forEach((x, i) => {
        // Con los avisos al celular activados, el de “mañana” lo manda el intermediario (con el botón para confirmar)
        for (const [days, hour, pre] of pushOn() ? [[3, 10, 'En 3 días']] : [[3, 10, 'En 3 días'], [1, 18, 'Mañana']]) {
          const at = toDate(addDays(x.day, -days)); at.setHours(hour, 0, 0, 0);
          if (at.getTime() > now) notifications.push({ id: 1000 + i * 2 + (days === 1 ? 1 : 0), title: `${pre}: ${x.title}`,
            body: x.when + (x.with ? ` · con ${x.with}` : ''), schedule: { at, allowWhileIdle: true } });
        }
      });
      if (notifications.length) await LN.schedule({ notifications });
    } catch (e) {}
    return;
  }
  if (!scheduleReminders.timer) scheduleReminders.timer = setInterval(scheduleReminders, 36e5);
  const today = todayISO(), soon = list.filter(x => daysBetween(today, x.day) <= 2);
  let seen = ''; try { seen = localStorage.getItem('recordatorio-' + nube.user.uid) || ''; } catch (e) {}
  if (!remindersOn() || !soon.length || seen === today) return;
  try { localStorage.setItem('recordatorio-' + nube.user.uid, today); } catch (e) {}
  const x = soon[0], when = x.day === today ? 'Hoy' : x.day === addDays(today, 1) ? 'Mañana' : capFirst(toDate(x.day).toLocaleDateString('es', { weekday: 'long' }));
  const text = `${when}: ${x.title}${x.with ? ` (con ${x.with})` : ''}`;
  toast('🔔 Recordatorio · ' + text);
  try { if (window.Notification && Notification.permission === 'granted') new Notification('Programas: tu asignación', { body: text, icon: 'icon.png' }); } catch (e) {}
}
function remindersToggle() {
  const box = h('input', { type: 'checkbox', checked: remindersOn() || null, onchange: async e => {
    const on = e.target.checked;
    try { localStorage.setItem('recordatorios', on ? 'si' : 'no'); } catch (x) {}
    if (on && !LN && window.Notification && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (x) {} }
    if (LN) scheduleReminders();
    toast(on ? 'Te avisaremos antes de tus asignaciones' : 'Recordatorios apagados');
  } });
  return h('label', { class: 'row', style: { flexWrap: 'nowrap', gap: '8px', margin: '10px 0 4px', color: 'var(--text)', fontSize: '14px' } }, box,
    h('span', null, '🔔 Recordarme mis asignaciones', h('div', { class: 'muted small-text' },
      LN ? 'El celular te avisa 3 días antes y el día anterior, aunque la app esté cerrada.'
        : 'Al abrir la app te avisa si tienes una asignación en los próximos 2 días.')));
}

// ---------- cambios de una semana (del historial) ----------
function openWeekHistory(p) {
  const box = h('div', null, h('p', { class: 'muted' }, 'Cargando…'));
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, `Cambios · ${p.title}`), box),
    h('div', { class: 'dlg-foot' }, h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cerrar')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
  F.getDocs(F.query(F.collection(F.db, 'congregaciones', nube.cong, 'historial'), F.orderBy('fecha', 'desc'), F.limit(300))).then(s => {
    const list = s.docs.map(d => d.data()).map(x => ({ ...x, cambios: (x.cambios || []).filter(c => c.includes(p.title)) })).filter(x => x.cambios.length);
    box.replaceChildren(...(list.length ? list.map(x => {
      const d = x.fecha && x.fecha.toDate ? x.fecha.toDate() : new Date();
      return h('div', { class: 'hist-item' },
        h('span', { class: 'hist-time' }, d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })),
        h('div', null, h('strong', null, x.porNombre || 'Alguien'), h('ul', null, x.cambios.map(c => h('li', null, c.replace(p.title + ' · ', ''))))));
    }) : [h('p', { class: 'muted' }, 'Todavía no hay cambios registrados en esta semana.')]));
  }).catch(e => box.replaceChildren(h('p', { class: 'muted' }, errMsg(e))));
}

// ---------- sesiones abiertas ----------
// sesiones/{uid}_{equipo} = { uid, nombre, equipo, visto, cerrar }. Cada equipo anota la suya al entrar. Si la persona
// (desde otro equipo) o el coordinador piden cerrarla, ese equipo cierra la sesión solo en cuanto tiene internet.
// Si alguien sabe la contraseña, puede volver a entrar: en ese caso hay que cambiarla.
const deviceId = () => { try { let d = localStorage.getItem('equipo-id'); if (!d) { d = uid(); localStorage.setItem('equipo-id', d); } return d; } catch (e) { return 'equipo'; } };
const sessionId = () => nube.user.uid + '_' + deviceId();
function deviceName() {
  if (location.protocol === 'app:') return 'Programa de PC';
  if (NATIVE) return 'App de Android';
  const u = navigator.userAgent;
  const b = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Navegador';
  const os = /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iPhone' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : '';
  return `${b}${os ? ' en ' + os : ''} (web)`;
}
function trackSession() {
  const r = congRef('sesiones', sessionId());
  F.setDoc(r, { uid: nube.user.uid, nombre: (nube.me.nombre || '').slice(0, 100), equipo: deviceName(), visto: F.serverTimestamp() }, { merge: true }).catch(() => {});
  nube.unsubDatos.push(F.onSnapshot(r, s => {
    if (!s.exists() || !s.data().cerrar) return;
    F.deleteDoc(r).catch(() => {}).finally(() => {
      F.signOut(F.auth);
      setTimeout(() => toast('Se cerró la sesión en este equipo desde otro lugar.'), 600);
    });
  }, () => {}));
}
const forgetSession = () => FB_CONFIG && nube.cong && nube.user ? F.deleteDoc(congRef('sesiones', sessionId())).catch(() => {}) : Promise.resolve();
async function openSessionsDialog(all) {
  const box = h('div', null, h('p', { class: 'muted' }, 'Cargando…'));
  const foot = h('div', { class: 'dlg-foot' });
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' },
      h('h3', null, all ? 'Sesiones de la congregación' : 'Mis sesiones abiertas'),
      h('p', { class: 'muted small-text', style: { marginTop: 0 } }, all
        ? 'Equipos donde cada hermano tiene la app abierta. Si se pierde un celular, cierra su sesión aquí.'
        : 'Equipos donde tienes tu cuenta abierta. Si ves uno que no reconoces, ciérralo y cambia tu contraseña.'),
      box), foot);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
  const col = F.collection(F.db, 'congregaciones', nube.cong, 'sesiones');
  const close = async list => {
    try {
      for (const x of list) {
        if (x.id === sessionId()) { await forgetSession(); dlg.close(); return F.signOut(F.auth); }
        await F.updateDoc(F.doc(col, x.id), { cerrar: true });
      }
      toast(list.length > 1 ? 'Se cerrarán en cuanto esos equipos tengan internet' : 'Se cerrará en cuanto ese equipo tenga internet');
      logChange(`Cerró ${list.length > 1 ? list.length + ' sesiones' : 'la sesión'} de ${[...new Set(list.map(x => x.nombre || 'alguien'))].join(', ')}`);
      load();
    } catch (e) { toast(errMsg(e)); }
  };
  async function load() {
    try {
      const s = await F.getDocs(all ? col : F.query(col, F.where('uid', '==', nube.user.uid)));
      const list = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es') || stampMs(b.visto) - stampMs(a.visto));
      const others = list.filter(x => x.id !== sessionId() && !x.cerrar && x.uid === nube.user.uid);
      box.replaceChildren(...(list.length ? list.map(x => h('div', { class: 'ses-row' },
        h('div', null, h('strong', null, (all ? (x.nombre || 'Sin nombre') + ' · ' : '') + (x.equipo || 'Equipo')),
          h('div', { class: 'muted small-text' }, x.id === sessionId() ? 'Este equipo' : x.cerrar ? 'Cerrándose… (en cuanto tenga internet)' : 'Última vez: ' + (fmtStamp(x.visto) || '—'))),
        x.cerrar ? null : h('button', { class: 'btn small', onclick: () => close([x]) }, 'Cerrar'))) : [h('p', { class: 'muted' }, 'No hay sesiones registradas.')]));
      foot.replaceChildren(...[
        others.length ? h('button', { class: 'btn danger', style: { marginRight: 'auto' }, onclick: () => close(others) }, 'Cerrar en todos los demás') : null,
        h('button', { class: 'btn', onclick: () => dlg.close() }, 'Listo')].filter(Boolean));
    } catch (e) { box.replaceChildren(h('p', { class: 'muted' }, errMsg(e))); foot.replaceChildren(h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cerrar')); }
  }
  load();
}
// Ajustes → cuenta: recordatorios, sesiones y (coordinador) vista propia
function accountExtras() {
  return h('div', null,
    nube.me.perfil ? remindersToggle() : null,
    pushCard(false),
    textSizeRow(),
    privacyCard(),
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn', onclick: () => openSessionsDialog(false) }, '📱 Mis sesiones abiertas'),
      isAdmin() ? h('button', { class: 'btn', onclick: () => openSessionsDialog(true) }, '👥 Sesiones de todos') : null,
      isAdmin() ? h('button', { class: 'btn', onclick: openViewDialog }, '🎨 Personalizar mi vista') : null));
}

// ---------- respaldo automático (coordinador) ----------
// respaldos/{AAAA-MM-DD} = { fecha, creado, por, partes, tam, gzip } y respaldos/{id}/partes/{n} = { d } (JSON comprimido en base64).
// Al abrir la app el coordinador, si el último tiene 7 días o más, se hace uno solo. Se guardan los últimos 8.
// El archivo descargado sirve en "Cargar respaldo" (programa, hermanos y ajustes); lo demás queda en "congregacion".
const BACKUP_COLS = ['miembros', 'contactos', 'informes', 'territorios', 'trabajos', 'cuentas', 'cuentasConfig', 'grupos', 'asistencia',
  'eventos', 'salidas', 'arreglos', 'ausencias', 'anuncios', 'capitanes', 'confirmaciones', 'publica', 'pastoreo', 'consentimientos', 'solicitudes'];
const backupsCol = () => F.collection(F.db, 'congregaciones', nube.cong, 'respaldos');
const toB64 = bytes => { let out = ''; for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(out); };
const fromB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
async function streamBytes(bytes, Stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Stream('gzip'))).arrayBuffer()); }
async function makeBackup() {
  const datos = {};
  for (const n of BACKUP_COLS) {
    datos[n] = await F.getDocs(F.collection(F.db, 'congregaciones', nube.cong, n)).then(s => s.docs.map(d => ({ id: d.id, ...d.data() })), () => []);
  }
  const json = JSON.stringify({ ...clean(state), congregacion: { nombre: congName(), fecha: todayISO(), version: APP_VERSION, datos: clean(datos) } });
  const raw = new TextEncoder().encode(json), gzip = typeof CompressionStream === 'function';
  const b64 = toB64(gzip ? await streamBytes(raw, CompressionStream) : raw), size = 700000, partes = Math.ceil(b64.length / size) || 1;
  const id = todayISO();
  for (let i = 0; i < partes; i++) await F.setDoc(F.doc(backupsCol(), id, 'partes', String(i)), { d: b64.slice(i * size, (i + 1) * size) });
  await F.setDoc(F.doc(backupsCol(), id), { fecha: id, creado: F.serverTimestamp(), por: nube.user.uid, partes, tam: raw.length, gzip });
  // Solo los últimos 8
  const old = (await F.getDocs(F.query(backupsCol(), F.orderBy('fecha', 'desc')))).docs.slice(8);
  for (const d of old) {
    for (let i = 0; i < (d.data().partes || 1); i++) await F.deleteDoc(F.doc(backupsCol(), d.id, 'partes', String(i))).catch(() => {});
    await F.deleteDoc(d.ref).catch(() => {});
  }
  return id;
}
async function autoBackup() {
  if (!isAdmin() || !navigator.onLine || autoBackup.done) return;
  autoBackup.done = true;
  try {
    const last = (await F.getDocs(F.query(backupsCol(), F.orderBy('fecha', 'desc'), F.limit(1)))).docs[0];
    if (!last || daysBetween(last.data().fecha, todayISO()) >= 7) await makeBackup();
  } catch (e) { console.log('Respaldo automático: ' + e.message); }
}
async function downloadBackup(b) {
  try {
    const parts = [];
    for (let i = 0; i < (b.partes || 1); i++) parts.push((await F.getDoc(F.doc(backupsCol(), b.fecha, 'partes', String(i)))).data().d);
    let bytes = fromB64(parts.join(''));
    if (b.gzip) bytes = await streamBytes(bytes, DecompressionStream);
    saveBlob(new Blob([bytes], { type: 'application/json' }), `respaldo-programas-${b.fecha}.json`);
  } catch (e) { toast('No se pudo bajar el respaldo: ' + errMsg(e)); }
}
function backupsCard() {
  const list = h('div', null, h('p', { class: 'muted small-text' }, 'Cargando…'));
  const fill = () => F.getDocs(F.query(backupsCol(), F.orderBy('fecha', 'desc'))).then(s => {
    const items = s.docs.map(d => d.data());
    list.replaceChildren(...(items.length ? items.map(b => h('div', { class: 'ses-row' },
      h('div', null, h('strong', null, capFirst(toDate(b.fecha).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))),
        h('div', { class: 'muted small-text' }, `${Math.max(1, Math.round((b.tam || 0) / 1024))} KB de datos`)),
      h('button', { class: 'btn small', onclick: () => downloadBackup(b) }, '⬇ Descargar'))) : [h('p', { class: 'muted small-text' }, 'Todavía no hay respaldos.')]));
  }).catch(e => list.replaceChildren(h('p', { class: 'muted small-text' }, errMsg(e))));
  const now = h('button', { class: 'btn', onclick: async () => {
    now.disabled = true; now.textContent = 'Haciendo respaldo…';
    try { await makeBackup(); toast('Respaldo hecho'); fill(); } catch (e) { toast(errMsg(e)); }
    now.disabled = false; now.textContent = 'Hacer un respaldo ahora';
  } }, 'Hacer un respaldo ahora');
  fill();
  return [h('h2', { class: 'group' }, 'Respaldos automáticos'),
    h('div', { class: 'card settings', style: { marginBottom: '14px' } },
      h('p', { class: 'muted small-text', style: { marginTop: 0 } }, 'Cada semana, al abrir la app el coordinador, se guarda una copia de todo (programa, hermanos, informes, territorios, cuentas…). Se quedan las últimas 8. El archivo descargado se puede cargar en “Cargar respaldo”.'),
      list, h('div', { class: 'row', style: { marginTop: '10px' } }, now))];
}

// ---------- vista propia (coordinador) ----------
// usuarios/{uid}.vista = { nav: [vistas en orden], navOcultas: [...], inicio: [tarjetas en orden], inicioOcultas: [...], sinAsignacion }.
// Solo la ve esa cuenta; los demás siguen viendo el orden de siempre.
const HOME_TILES = [['list', 'Próxima reunión'], ['report', 'Tu informe del mes'], ['ausencia', 'Ausencia'], ['anuncios', 'Anuncios'],
  ['people', 'Asignaciones por completar'], ['mecanicas', 'Asignaciones mecánicas'], ['users', 'Cuentas nuevas'], ['informes', 'Informes de la congregación'],
  ['cuentas', 'Cuentas'], ['calendario', 'Próximo evento'], ['arreglos', 'Limpieza del Salón'], ['territorios', 'Territorios'],
  ['publica', 'Predicación pública'], ['pastoreo', 'Pastoreo'], ['privacidad', 'Solicitudes de privacidad']];
const myView = () => (FB_CONFIG && isAdmin() && nube.vista) || null;
const arrangeBy = (list, key, order, hidden, keep) => {
  const pos = k => { const i = (order || []).indexOf(k); return i < 0 ? 1000 + list.findIndex(x => key(x) === k) : i; };
  const hide = new Set(hidden || []);
  return list.filter(x => keep(key(x)) || !hide.has(key(x))).sort((a, b) => pos(key(a)) - pos(key(b)));
};
function customNav(items) {
  const v = myView();
  return v ? arrangeBy(items, x => x[0], v.nav, v.navOcultas, k => k === 'settings') : items;
}
function customTiles(tiles) {
  const v = myView();
  return v ? arrangeBy(tiles, t => t.dataset.k, v.inicio, v.inicioOcultas, () => false) : tiles;
}
function openViewDialog() {
  const v = myView() || {};
  const navAll = arrangeBy(navItems(true), x => x[0], v.nav, [], () => true).map(([k, t]) => ({ k, t, on: !(v.navOcultas || []).includes(k), fixed: k === 'settings' }));
  const tilesAll = arrangeBy(HOME_TILES, x => x[0], v.inicio, [], () => true).map(([k, t]) => ({ k, t, on: !(v.inicioOcultas || []).includes(k) }));
  let showMine = !v.sinAsignacion;
  const navBox = h('div'), tileBox = h('div');
  const list = (box, arr) => box.replaceChildren(...arr.map((x, i) => h('div', { class: 'ord-row' + (x.on ? '' : ' off') },
    h('label', null, h('input', { type: 'checkbox', checked: x.on || null, disabled: x.fixed || null, onchange: e => { x.on = e.target.checked; list(box, arr); } }), x.t),
    h('button', { class: 'btn small', title: 'Subir', disabled: i === 0 || null, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; list(box, arr); } }, '↑'),
    h('button', { class: 'btn small', title: 'Bajar', disabled: i === arr.length - 1 || null, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; list(box, arr); } }, '↓'))));
  list(navBox, navAll); list(tileBox, tilesAll);
  const store = async vista => {
    try {
      await F.setDoc(ref('usuarios', nube.user.uid), { vista }, { merge: true });
      nube.vista = vista; homeEdit = null; dlg.close(); render(); toast('Listo: así se verá solo en tu cuenta');
    } catch (e) { toast(errMsg(e)); }
  };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' },
      h('h3', null, '🎨 Personalizar mi vista'),
      h('p', { class: 'muted small-text', style: { marginTop: 0 } }, 'Cambia el orden con ↑ ↓ y quita la marca para ocultar algo. Solo cambia en tu cuenta; los demás lo siguen viendo igual.'),
      h('div', { class: 'dlg-sec' }, 'Pestañas de arriba'), h('p', { class: 'muted small-text', style: { margin: '4px 0' } }, 'En el celular, las primeras 4 van en la barra de abajo.'), navBox,
      h('div', { class: 'dlg-sec', style: { marginTop: '14px' } }, 'Tarjetas de Inicio'),
      h('label', { class: 'row', style: { gap: '8px', margin: '8px 0', fontSize: '14px', color: 'var(--text)' } }, h('input', { type: 'checkbox', checked: showMine || null, onchange: e => { showMine = e.target.checked; } }), 'Mostrar “Tu próxima asignación” arriba'),
      tileBox),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', style: { marginRight: 'auto' }, onclick: () => store({}) }, 'Como venía'),
      h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => store({
        nav: navAll.map(x => x.k), navOcultas: navAll.filter(x => !x.on).map(x => x.k),
        inicio: tilesAll.map(x => x.k), inicioOcultas: tilesAll.filter(x => !x.on).map(x => x.k), sinAsignacion: !showMine }) }, 'Guardar')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}

// Modo de edición de Inicio (coordinador): se arrastran las tarjetas con ⠿ y el ojo las oculta o muestra.
// homeEdit = { order: [claves], hidden: Set, mine } mientras se edita; se guarda en la vista propia al tocar “Listo”.
let homeEdit = null;
function startHomeEdit() {
  const v = myView() || {};
  homeEdit = { order: (v.inicio || []).slice(), hidden: new Set(v.inicioOcultas || []), mine: !v.sinAsignacion };
  render(); scrollTo({ top: 0, behavior: 'smooth' });
}
function homeEditor(hero, tiles, weeks) {
  const e = homeEdit, grid = h('div', { class: 'tiles editing' });
  const keys = () => [...grid.children].map(t => t.dataset.k);
  for (const t of arrangeBy(tiles, t => t.dataset.k, e.order, [], () => true)) {
    const k = t.dataset.k, eye = h('span', { class: 'tile-eye', role: 'button', title: 'Mostrar u ocultar' });
    const paint = () => { t.classList.toggle('off', e.hidden.has(k)); eye.replaceChildren(icon(e.hidden.has(k) ? 'eyeoff' : 'eye', 18)); };
    eye.addEventListener('click', ev => { ev.stopPropagation(); e.hidden.has(k) ? e.hidden.delete(k) : e.hidden.add(k); paint(); });
    t.lastChild.replaceWith(eye); // en vez de la flecha
    t.prepend(h('span', { class: 'tile-grip', title: 'Arrastra para mover' }, icon('grip', 18)));
    t.tabIndex = -1; paint();
    grid.append(t);
  }
  // En edición las tarjetas no abren su sección (se detiene el clic antes de que llegue)
  grid.addEventListener('click', ev => { if (!ev.target.closest('.tile-eye')) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  // Arrastrar con el dedo o el ratón desde ⠿: la tarjeta se cambia de lugar al pasar sobre otra
  let drag = null;
  grid.addEventListener('pointerdown', ev => {
    const grip = ev.target.closest('.tile-grip');
    if (!grip) return;
    ev.preventDefault();
    drag = { t: grip.closest('.tile'), id: ev.pointerId };
    drag.t.classList.add('dragging');
    grid.setPointerCapture(ev.pointerId);
  });
  grid.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.id) return;
    const over = [...grid.children].find(o => { const r = o.getBoundingClientRect(); return o !== drag.t && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; });
    if (!over) return;
    const all = [...grid.children];
    over[all.indexOf(drag.t) < all.indexOf(over) ? 'after' : 'before'](drag.t);
  });
  const drop = ev => {
    if (!drag || ev.pointerId !== drag.id) return;
    drag.t.classList.remove('dragging'); drag = null;
    e.order = keys();
  };
  grid.addEventListener('pointerup', drop); grid.addEventListener('pointercancel', drop);

  const finish = async vista => {
    try {
      await F.setDoc(ref('usuarios', nube.user.uid), { vista }, { merge: true });
      nube.vista = vista; homeEdit = null; render(); toast('Listo: así se verá solo en tu cuenta');
    } catch (ex) { toast(errMsg(ex)); }
  };
  const v = myView() || {};
  const done = () => {
    const shown = keys(), order = [...shown, ...(e.order || []).filter(k => !shown.includes(k)), ...HOME_TILES.map(x => x[0]).filter(k => !shown.includes(k) && !(e.order || []).includes(k))];
    finish({ ...v, inicio: order, inicioOcultas: [...e.hidden], sinAsignacion: !e.mine });
  };
  const mine = h('label', { class: 'switch-row' }, h('input', { type: 'checkbox', checked: e.mine || null, onchange: ev => { e.mine = ev.target.checked; } }),
    h('span', null, 'Mostrar “Tu próxima asignación” arriba'));
  return h('div', null,
    hero,
    h('div', { class: 'edit-bar card' },
      h('div', null, h('strong', null, 'Editando Inicio'),
        h('div', { class: 'muted small-text' }, 'Arrastra ⠿ para cambiar el orden y toca el ojo para ocultar o mostrar. Solo cambia en tu cuenta.')),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => { homeEdit = null; render(); } }, 'Cancelar'),
        h('button', { class: 'btn small primary', onclick: done }, 'Listo'))),
    mine,
    h('div', { class: 'tiles-hint muted small-text' }, 'Algunas tarjetas solo aparecen cuando hay algo que mostrar (por ejemplo, cuentas nuevas por aprobar).'),
    grid,
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '16px' } },
      h('button', { class: 'btn small', onclick: openViewDialog }, '☰ Ordenar las pestañas'),
      h('button', { class: 'btn small', onclick: () => confirm('¿Volver al orden de siempre en Inicio?') && finish({ ...v, inicio: [], inicioOcultas: [], sinAsignacion: false }) }, '↺ Como venía')));
}

// ---------- ausencias ----------
// ausencias/{perfil} = { desde, hasta, nota, por }. Cada quien avisa la suya desde Inicio (o Programa VyM
// y el secretario la ponen en la ficha del hermano). Mientras dure, no se le recomienda para nada.
const awayOn = (pid, iso) => { const a = FB_CONFIG && pid && nube.ausencias.get(pid); return a && a.desde <= iso && iso <= a.hasta ? a : null; };
const awayNow = pid => { const a = FB_CONFIG && pid && nube.ausencias.get(pid); return a && a.hasta >= todayISO() ? a : null; };
const awayText = a => a.desde > todayISO() ? `Ausente del ${fmtShort(a.desde)} al ${fmtShort(a.hasta)}` : `Ausente hasta el ${fmtShort(a.hasta)}`;
// En el editor: asignados que estarán ausentes esa semana
function awayWarning(p) {
  const names = [...new Set(slotsOf(p).filter(x => x.pid && awayOn(x.pid, meetingDate(p))).map(x => profById(x.pid)).filter(Boolean))];
  return names.length ? h('div', { class: 'notice warn' }, `Estará${names.length > 1 ? 'n' : ''} ausente${names.length > 1 ? 's' : ''} esa semana: `,
    names.map(pr => pr.name).join(', '), '. Conviene cambiar su asignación.') : null;
}
function openAbsenceDialog(pid, name, done) {
  const cur = awayNow(pid), own = !!nube.me && nube.me.perfil === pid, today = todayISO();
  const fromI = h('input', { type: 'date', value: cur ? cur.desde : today });
  const toI = h('input', { type: 'date', value: cur ? cur.hasta : addDays(today, 14) });
  const noteI = h('input', { type: 'text', maxlength: 200, value: cur ? cur.nota || '' : '', placeholder: 'Opcional: por ejemplo, de viaje' });
  const err = h('div', { class: 'small-text', style: { color: 'var(--orange)' } });
  const who = own ? '' : ` de ${name}`;
  const finish = msg => { toast(msg); logChange(msg + who); dlg.close(); if (done) done(); };
  async function saveIt() {
    const desde = fromI.value, hasta = toI.value;
    if (!desde || !hasta) return void (err.textContent = 'Pon las dos fechas.');
    if (hasta < desde) return void (err.textContent = 'La fecha de regreso va después de la de salida.');
    try {
      await F.setDoc(congRef('ausencias', pid), { desde, hasta, nota: squash(noteI.value).slice(0, 200), por: nube.user.uid });
      finish(`Ausencia guardada: ${fmtShort(desde)} – ${fmtShort(hasta)}`);
    } catch (e) { err.textContent = errMsg(e); }
  }
  async function removeIt() {
    try { await F.deleteDoc(congRef('ausencias', pid)); finish('Ausencia quitada'); } catch (e) { err.textContent = errMsg(e); }
  }
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' },
      h('h3', null, own ? 'Mi ausencia' : 'Ausencia' + who),
      h('p', { class: 'muted small-text', style: { marginTop: 0 } }, own
        ? 'Si vas a faltar un tiempo (viaje, enfermedad, trabajo…), ponlo aquí. Mientras dure, el programa no te recomendará para ninguna asignación.'
        : 'Mientras dure, el programa no lo recomendará para ninguna asignación.'),
      h('div', { class: 'row', style: { gap: '12px' } },
        h('label', { class: 'field' }, 'Desde', fromI),
        h('label', { class: 'field' }, 'Hasta (último día)', toI)),
      h('label', { class: 'field' }, 'Motivo', noteI),
      err),
    h('div', { class: 'dlg-foot' },
      cur ? h('button', { class: 'btn danger', style: { marginRight: 'auto' }, onclick: removeIt }, 'Quitar ausencia') : null,
      h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: saveIt }, 'Guardar')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}
