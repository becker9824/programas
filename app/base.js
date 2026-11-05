// Programas · Datos de la app, utilidades, intervenciones, mecánicas y reglas para sugerir.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// Con FIREBASE_CONFIG (firebase-config.js) los datos viven en la nube de la congregación;
// sin él, la app funciona como antes, solo en esta PC. "?emu" usa el Firebase local de prueba.
const EMU = /[?&]emu\b/.test(location.search);
const FB_CONFIG = EMU ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-programas' } : window.FIREBASE_CONFIG;
// App de Android (carpeta movil/, Capacitor): la app va dentro del APK y usa funciones del celular
// (movil/copiar.js le agrega capacitor.js; sin él, como en la PC y la web, NATIVE es false)
const NATIVE = !!(window.capacitorExports && Capacitor.isNativePlatform());
const NP = NATIVE ? { http: capacitorExports.CapacitorHttp, files: capacitorExports.registerPlugin('Filesystem'), share: capacitorExports.registerPlugin('Share') } : null;
const OLD_PDF_TITLE = 'Reunión Vida y Ministerio Cristianos';
// Preferir nombrados en cada asignación (Ajustes): privilegio → 'nom', 'anciano' o 'sm'
const DEFAULT_NOM_PREFS = { microfonos: 'nom', acomodador: 'nom', audio: 'nom' };
// Filtros de sugerencias que trae la app (se pueden cambiar en Ajustes)
const DEFAULT_FILTERS = [
  { nombre: 'Escuela', palabras: 'escuela, colegio, secundaria, primaria, compañero de clase, compañera de clase, compañeros de clase, maestro, maestra, profesor, profesora, salón de clases, escolar', min: 8, max: 17, sexo: '' },
  { nombre: 'Universidad', palabras: 'universidad, facultad, universitario, universitaria', min: 17, max: 30, sexo: '' },
  { nombre: 'Trabajo', palabras: 'trabajo, compañero de trabajo, compañera de trabajo, jefe, jefa, empleado, empleada, cliente', min: 18, max: null, sexo: '' },
  { nombre: 'Persona mayor', palabras: 'jubilado, jubilada, persona mayor, personas mayores, abuelo, abuela, edad avanzada', min: 50, max: null, sexo: '' },
];
const defaults = () => ({
  profiles: [], families: [], programs: [], songs: {}, missing: {}, lastSync: 0,
  settings: {
    staleDays: 60, restDays: 28, mecRestDays: 14, weekendDay: 6, weekendTime: '10:00', weeksAhead: 8, congregation: '',
    pdfTitle: 'Programa para la reunión de entre semana', meetingDay: 2, startTime: '19:00', paper: 'letter',
    slipNote: 'En la Guía de actividades está la información para preparar su intervención. Repase también las indicaciones para la reunión Vida y Ministerio Cristianos.',
    slipFooter: '',
    // Diseño y opciones del PDF del programa y de las hojas de asignación
    pdfDesign: 's140', pdfDate: 'semana', pdfShowMin: true, auxRoom: false,
    slipDate: 'larga', slipShowMin: true, slipShowText: true, slipShowLesson: true,
    filters: DEFAULT_FILTERS.map(f => ({ ...f })),
    waCountry: '52',
    nomPrefs: { ...DEFAULT_NOM_PREFS },
  },
});
const SECTIONS = [
  { key: 'tesoros', name: 'Tesoros de la Biblia', css: 'var(--sec-tesoros)', rgb: [60, 127, 139] },
  { key: 'maestros', name: 'Seamos mejores maestros', css: 'var(--sec-maestros)', rgb: [190, 137, 0] },
  { key: 'vida cristiana', name: 'Nuestra vida cristiana', css: 'var(--sec-vida)', rgb: [126, 0, 36] },
];
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function hydrate(s) {
  const d = defaults();
  const out = { ...d, ...s, songs: { ...(s && s.songs) }, talks: { ...(s && s.talks) }, settings: { ...d.settings, ...(s && s.settings) } };
  if (out.settings.pdfTitle === OLD_PDF_TITLE) out.settings.pdfTitle = d.settings.pdfTitle;
  for (const p of out.programs) migrateProgram(p);
  return out;
}
// Programas guardados con la versión anterior: el presidente pasa a "Palabras de introducción"
// y las canciones guardan su número.
function migrateProgram(p) {
  const role = p.rows.find(r => r.kind === 'role');
  const intro = p.rows.find(r => r.kind === 'chair' && /introducci/i.test(r.title));
  if (intro) intro.intro = true;
  if (role) { if (intro && !intro.a) intro.a = role.a; p.rows = p.rows.filter(r => r !== role); }
  if (p.source === 'jw' && !p.rows.some(r => r.num)) { let n = 0; for (const r of p.rows) if (r.kind === 'part') r.num = ++n; }
  for (const r of p.rows) {
    if (r.kind === 'part' && /\)$/.test(r.title || '') && r.detail) r.detail = r.detail.replace(/^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ ]{3,}\.\s*/, '');
    if ((r.kind === 'prayer' || r.kind === 'song') && r.song == null) {
      const m = (r.title || '').match(/canci[oó]n\s+(\d+)/i);
      r.song = m ? +m[1] : null;
    }
  }
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.programs)) return hydrate(s); } catch (e) {}
  return defaults();
}
function save() {
  if (FB_CONFIG) return saveCloud();
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('No se pudo guardar en este navegador'); }
}
let state = FB_CONFIG ? defaults() : load();
let view = { name: 'list' };
let syncMsg = { text: '', warn: false };
let syncing = false;
let serverOK = null;

// ---------- utilidades ----------
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
    }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
// Íconos de línea (24×24, toman el color del texto)
const ICONS = {
  inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  list: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  people: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  families: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 14.5c3 0 6 1.5 6 4.5"/>',
  users: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/>',
  arreglos: '<path d="M9 4h6a1 1 0 011 1v2H8V5a1 1 0 011-1z"/><rect x="5" y="6" width="14" height="15" rx="2"/><path d="M9 12l2 2 4-4"/>',
  historial: '<path d="M3 12a9 9 0 103-6.7"/><path d="M3 4v4h4"/><path d="M12 8v4l3 2"/>',
  ausencia: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18"/>',
  finsemana: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M2 10l10-6 10 6"/><path d="M10 20v-5h4v5"/>',
  asistencia: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  grupos: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/><path d="M7 20c0-3 2.2-5 5-5s5 2 5 5"/><path d="M1.5 19c0-2.4 1.5-4 3.5-4M22.5 19c0-2.4-1.5-4-3.5-4"/>',
  report: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  anuncios: '<path d="M3 11v2a1 1 0 001 1h3l7 4V6l-7 4H4a1 1 0 00-1 1z"/><path d="M18 9a3 3 0 010 6"/>',
  directorio: '<path d="M5 4h12a2 2 0 012 2v14H7a2 2 0 01-2-2z"/><path d="M5 18a2 2 0 012-2h12"/><circle cx="12" cy="9" r="2"/>',
  cuentas: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="15" r="1.3"/>',
  territorios: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  mecanicas: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M8 21h8"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  privacidad: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10 11V9.5a2 2 0 014 0V11"/>',
  pantalla: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  pastoreo: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  estadisticas: '<path d="M4 20V4M4 20h16"/><rect x="7" y="12" width="3" height="5" rx="1"/><rect x="12" y="8" width="3" height="9" rx="1"/><rect x="17" y="5" width="3" height="12" rx="1"/>',
  publica: '<rect x="6" y="3" width="12" height="13" rx="1.5"/><path d="M9 7h6M9 10h6M8 16l-2 5M16 16l2 5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0114 0v1"/><path d="M16 4l2-2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  grip: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 005.4-1.6"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
};
function icon(name, size = 20) {
  const el = document.createElement('span');
  el.className = 'ic';
  el.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return el;
}
// El logo de la app (el mismo de icon.svg)
function logo(size = 28) {
  const el = document.createElement('span');
  el.className = 'ic';
  el.innerHTML = `<svg viewBox="0 0 512 512" width="${size}" height="${size}" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#1d5fd0"/><rect x="136" y="96" width="240" height="320" rx="24" fill="#fff"/><rect x="196" y="72" width="120" height="56" rx="16" fill="#123f91"/><rect x="172" y="176" width="168" height="20" rx="10" fill="#9dbcf3"/><rect x="172" y="236" width="168" height="20" rx="10" fill="#9dbcf3"/><rect x="172" y="296" width="120" height="20" rx="10" fill="#9dbcf3"/></svg>`;
  return el;
}
document.querySelector('.logo').replaceWith(logo());
const setBrand = text => { document.querySelector('.brand-name').textContent = text; };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const toDate = iso => new Date(iso + 'T12:00:00');
function addDays(iso, n) { const d = toDate(iso); d.setDate(d.getDate() + n); return isoOf(d); }
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
const fmtShort = iso => iso ? toDate(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtDay = iso => iso ? toDate(iso).toLocaleDateString('es', { day: 'numeric', month: 'long' }) : '';
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
const squash = s => (s || '').replace(/[\s ]+/g, ' ').trim();
const capFirst = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const titleCase = s => s.toLowerCase().replace(/(^|[\s(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

// Semanas ISO (las que usa wol.jw.org)
function thursdayOf(iso) { const d = toDate(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3); return d; }
function isoWeek(iso) {
  const thu = thursdayOf(iso);
  const first = thursdayOf(`${thu.getFullYear()}-01-04`);
  return { y: thu.getFullYear(), w: 1 + Math.round((thu - first) / (7 * 864e5)) };
}
const mondayOf = iso => addDays(iso, -((toDate(iso).getDay() + 6) % 7));
const weekKey = iso => { const { y, w } = isoWeek(iso); return `${y}-W${pad(w)}`; };
function weekLabel(monday) {
  const end = addDays(monday, 6), a = toDate(monday), b = toDate(end);
  const month = d => d.toLocaleDateString('es', { month: 'long' });
  return a.getMonth() === b.getMonth() ? `${a.getDate()}-${b.getDate()} de ${month(a)}` : `${a.getDate()} de ${month(a)} a ${b.getDate()} de ${month(b)}`;
}
const meetingDate = p => addDays(p.date, state.settings.meetingDay);
const fmtMeeting = p => capFirst(toDate(meetingDate(p)).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
function fmtTime(m) { const h24 = Math.floor(m / 60) % 24; return `${((h24 + 11) % 12) + 1}:${pad(m % 60)}`; }

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- intervenciones ----------
const sectionOf = name => SECTIONS.find(s => s.name === name);
const secClass = name => 'sec-' + ((sectionOf(name) || { key: 'otra' }).key.replace(/\s+/g, '-'));
// Clase del diseño elegido en Ajustes: el programa en pantalla se ve como el PDF
const themeClass = () => 'theme-' + (state.settings.pdfDesign || 's140');
const isAssignable = r => r.kind === 'prayer' || r.kind === 'part' || (r.kind === 'chair' && r.intro);
const hasCounsel = r => r.kind === 'part' && (r.section === SECTIONS[1].name || /lectura de la biblia/i.test(r.title));
const songText = r => r.song ? `Canción ${r.song}${state.songs[r.song] ? ' - ' + state.songs[r.song] : ''}` : 'Canción';

function displayTitle(r) {
  if (r.kind === 'prayer' || r.kind === 'song') return songText(r);
  return (r.num ? r.num + '. ' : '') + (r.title || 'Intervención');
}
function slotLabels(r) {
  if (r.kind === 'prayer') return { a: 'Oración' };
  if (r.kind === 'chair') return { a: 'Presidente' };
  if (r.helper === 'Lector') return { a: 'Conductor', b: 'Lector' };
  if (r.helper === 'Ayudante') return { a: 'Estudiante', b: 'Ayudante', soft: true };
  return { a: '' };
}
// Sala auxiliar (Ajustes): las partes de estudiantes llevan también 'xa' y 'xb' (estudiante y ayudante
// en la sala auxiliar) y las palabras de introducción, 'xa' = consejero de la sala auxiliar.
// Se activa en cada semana (p.aux); las semanas de antes siguen lo que decía Ajustes
const auxOn = p => !!(p && (p.aux ?? state.settings.auxRoom));
const hasAux = r => r.kind === 'chair' ? !!r.intro : hasCounsel(r);
const isAux = slot => slot === 'xa' || slot === 'xb';
const baseSlot = slot => slot === 'xa' ? 'a' : slot === 'xb' ? 'b' : slot;
const mateSlot = slot => ({ a: 'b', b: 'a', xa: 'xb', xb: 'xa' })[slot];
const auxLabel = (r, slot) => r.kind === 'chair' ? 'Consejero de la sala auxiliar' : slotLabels(r)[baseSlot(slot)];
function slotNeedsMen(r, slot) {
  slot = baseSlot(slot);
  if (r.kind === 'prayer' || r.kind === 'chair') return true;
  if (slot === 'b') return r.helper === 'Lector';
  return !!r.men;
}
const roleLabel = (r, slot) => isAux(slot) && r.kind === 'chair' ? 'Consejero de la sala auxiliar'
  : (baseSlot(slot) === 'b' ? `${r.helper}: ${displayTitle(r)}` : r.kind === 'prayer' ? 'Oración' : r.kind === 'chair' ? 'Presidente' : displayTitle(r))
    + (isAux(slot) ? ' (sala auxiliar)' : '');

// Privilegios: qué asignaciones puede recibir cada perfil (perfil.puede). Un perfil sin
// privilegios marcados todavía (perfil.puede no existe) sale para todo, como antes.
const PRIVS = [
  ['presidente', 'Presidente'],
  ['oracion', 'Oraciones'],
  ['tesoros', 'Discurso y Perlas escondidas'],
  ['lectura', 'Lectura de la Biblia'],
  ['estudiante', 'Seamos mejores maestros'],
  ['vida', 'Nuestra vida cristiana'],
  ['conductor', 'Conductor del estudio bíblico'],
  ['lector', 'Lector del estudio bíblico'],
  // Asignaciones mecánicas
  ['presidente_fin', 'Presidente del fin de semana'],
  ['atalaya', 'Lector de La Atalaya'],
  ['microfonos', 'Micrófonos'],
  ['acomodador', 'Acomodador'],
  ['audio', 'Audio y video'],
];
const MEC_PRIVS = ['presidente_fin', 'atalaya', 'microfonos', 'acomodador', 'audio'];
// Para marcar varios de un jalón en el perfil: [nombre, privilegios, nombramiento, bautizado]
const PRIV_PRESETS = [
  ['Anciano', ['presidente', 'oracion', 'tesoros', 'lectura', 'vida', 'conductor', 'lector', ...MEC_PRIVS], 'anciano', true],
  ['Siervo ministerial', ['oracion', 'tesoros', 'lectura', 'vida', 'lector', ...MEC_PRIVS], 'sm', true],
  ['Varón bautizado', ['oracion', 'lectura', 'estudiante', 'lector', 'atalaya', 'microfonos', 'acomodador', 'audio'], '', true],
  ['Estudiante', ['estudiante'], '', null],
];
// Datos de cada hermano (perfil.nombramiento, perfil.situacion)
const NOMBRAMIENTOS = [['', 'Ninguno'], ['anciano', 'Anciano'], ['sm', 'Siervo ministerial']];
const SITUACIONES = [['', '(Sin indicar)'], ['ama', 'Ama de casa'], ['estudiante', 'Estudiante'], ['trabaja', 'Trabaja'], ['jubilado', 'Jubilado(a)'], ['otra', 'Otra']];
const nomLabel = k => (NOMBRAMIENTOS.find(([key]) => key === (k || '')) || ['', ''])[1];
const sitLabel = k => k ? (SITUACIONES.find(([key]) => key === k) || ['', ''])[1] : '';
// Filtro de nombrados en las listas para elegir (programa y mecánicas): '', 'nom', 'anciano' o 'sm'
const NOM_FILTERS = [['', 'Todos'], ['nom', 'Nombrados'], ['anciano', 'Ancianos'], ['sm', 'Siervos ministeriales']];
let nomFilter = '';
const nomIs = (pr, k) => k === 'nom' ? !!pr.nombramiento : pr.nombramiento === k;
const nomOk = pr => !nomFilter || nomIs(pr, nomFilter);
// ¿Esta asignación prefiere nombrados y este hermano lo es? (sale antes en las sugerencias)
const nomPref = priv => ((state.settings.nomPrefs || {})[priv]) || '';
const prefersMe = (pr, priv) => !!nomPref(priv) && nomIs(pr, nomPref(priv));
// Botones del filtro; no quitan el foco del campo donde se está escribiendo
const nomChips = onChange => h('div', { class: 'chips nom-chips' }, NOM_FILTERS.map(([k, t]) =>
  h('button', { type: 'button', class: nomFilter === k ? 'on' : '', onmousedown: e => e.preventDefault(),
    onclick: () => { nomFilter = k; onChange(); } }, t)));
// En el celular la lista para elegir quedaba tapada por la barra de abajo (o el teclado) y no se veían
// los filtros ni los nombres: si abajo no hay lugar, se sube la página para que el campo quede arriba.
function roomForPick(inp) {
  const fit = () => {
    const r = inp.getBoundingClientRect(), bar = document.querySelector('.tabbar');
    const bottom = (window.visualViewport ? visualViewport.height : innerHeight) - (bar ? bar.offsetHeight : 0);
    const head = (document.querySelector('header') || {}).offsetHeight || 0;
    if (bottom - r.bottom < Math.min(320, bottom * .55)) window.scrollBy({ top: r.top - head - 10, behavior: 'smooth' });
  };
  fit(); setTimeout(fit, 400); // otra vez cuando ya salió el teclado
}
const privLabel = k =>(PRIVS.find(([key]) => key === k) || [k, k])[1];
function privFor(row, slot) {
  slot = baseSlot(slot);
  if (row.kind === 'prayer') return 'oracion';
  if (row.kind === 'chair') return 'presidente';
  if (row.helper === 'Lector') return slot === 'b' ? 'lector' : 'conductor';
  if (/lectura de la biblia/i.test(row.title || '')) return 'lectura';
  if (row.section === SECTIONS[1].name) return 'estudiante';
  if (row.section === SECTIONS[0].name) return 'tesoros';
  return 'vida';
}
const canDo = (prof, priv) => !Array.isArray(prof.puede) || prof.puede.includes(priv);

// Filtros de sugerencias: si el título o la descripción de una parte tiene alguna de las
// palabras, se prefiere a quien tenga esa edad (y ese sexo, si se pone). Se editan en Ajustes.
function ruleFor(row) {
  const text = ' ' + norm(`${row.title || ''} ${row.detail || ''}`).replace(/[^a-z0-9ñ]+/g, ' ') + ' ';
  return (state.settings.filters || []).find(f => (f.palabras || '').split(',')
    .map(w => norm(w).replace(/[^a-z0-9ñ]+/g, ' ').trim()).filter(Boolean).some(w => text.includes(' ' + w + ' '))) || null;
}
const ruleText = f => [
  f.min != null && f.max != null ? `${f.min} a ${f.max} años` : f.min != null ? `${f.min} años o más` : f.max != null ? `hasta ${f.max} años` : '',
  f.sexo === 'M' ? 'hombres' : f.sexo === 'F' ? 'mujeres' : ''].filter(Boolean).join(', ');
const fitsRule = (pr, f) => !f || ((f.min == null || (pr.age != null && pr.age >= f.min))
  && (f.max == null || (pr.age != null && pr.age <= f.max)) && (!f.sexo || pr.sex === f.sexo));

// ---------- asignaciones mecánicas ----------
// Por reunión: entre semana ('entre') y fin de semana ('fin'). Se guardan en cada semana como
// p.mec = { entre: { clave: perfil }, fin: { … } }. El presidente y el lector de entre semana
// son los mismos del programa de Vida y Ministerio (se leen y escriben ahí).
const MEC = [
  { key: 'presidente', label: 'Presidente', priv: { entre: 'presidente', fin: 'presidente_fin' } },
  { key: 'lector', label: 'Lector', priv: { entre: 'lector', fin: 'atalaya' } },
  { key: 'micPlat', label: 'Micrófono plataforma', priv: 'microfonos' },
  { key: 'micAud1', label: 'Micrófono auditorio', priv: 'microfonos' },
  { key: 'micAud2', label: 'Micrófono auditorio', priv: 'microfonos' },
  { key: 'acomInt', label: 'Acomodador interior', priv: 'acomodador' },
  { key: 'acomExt', label: 'Acomodador exterior', priv: 'acomodador' },
  { key: 'audio', label: 'Audio y video', priv: 'audio' },
];
const MEETINGS = [['entre', 'Entre semana'], ['fin', 'Fin de semana']];
const mecPriv = (mtg, key) => { const r = MEC.find(x => x.key === key); return typeof r.priv === 'string' ? r.priv : r.priv[mtg]; };
const mecDate = (p, mtg) => mtg === 'entre' ? meetingDate(p) : addDays(p.date, state.settings.weekendDay ?? 6);
// Fila del programa enlazada (solo presidente y lector de entre semana)
function mecLinked(p, mtg, key) {
  if (mtg !== 'entre') return null;
  if (key === 'presidente') { const r = p.rows.find(x => x.kind === 'chair' && x.intro); return r ? [r, 'a'] : null; }
  if (key === 'lector') { const r = p.rows.find(x => x.helper === 'Lector'); return r ? [r, 'b'] : null; }
  return null;
}
function mecGet(p, mtg, key) {
  const l = mecLinked(p, mtg, key);
  return l ? l[0][l[1]] || null : ((p.mec || {})[mtg] || {})[key] || null;
}
function mecSet(p, mtg, key, pid) {
  const l = mecLinked(p, mtg, key);
  if (l) { l[0][l[1]] = pid; return; }
  p.mec = p.mec || {}; p.mec[mtg] = p.mec[mtg] || {}; p.mec[mtg][key] = pid;
}
// Quiénes tienen asignación mecánica en una reunión (sin contar presidente y lector enlazados)
const mecIds = (p, mtg) => Object.values(((p.mec || {})[mtg]) || {}).filter(Boolean);
// Fechas de asignaciones mecánicas de cada hermano (para "hace cuánto" y el descanso)
function mecHistory(skip) {
  const hist = new Map();
  for (const q of state.programs) for (const [mtg] of MEETINGS) for (const { key } of MEC) {
    if (skip && skip.p === q && skip.mtg === mtg && skip.key === key) continue;
    const id = mecGet(q, mtg, key);
    if (id) (hist.get(id) || hist.set(id, []).get(id)).push(mecDate(q, mtg));
  }
  return hist;
}
// Recomendados para una asignación mecánica: varones con el privilegio, sin otra asignación
// en esa reunión, sin mecánica en los últimos mecRestDays días; primero quien lleva más tiempo.
function mecCandidates(p, mtg, key) {
  const priv = mecPriv(mtg, key), date = mecDate(p, mtg), rest = state.settings.mecRestDays ?? 14;
  const busy = new Set();
  for (const r of MEC) if (r.key !== key) { const id = mecGet(p, mtg, r.key); if (id) busy.add(id); }
  const linked = mecLinked(p, mtg, key); // su propia fila del programa no cuenta como "ocupado"
  if (mtg === 'entre') for (const x of slotsOf(p)) if (x.pid && !(linked && x.row === linked[0] && x.slot === linked[1])) busy.add(x.pid);
  const hist = mecHistory({ p, mtg, key });
  return state.profiles.filter(pr => pr.sex === 'M' && pr.tipo !== 'no').map(pr => {
    const dates = hist.get(pr.id) || [];
    const before = dates.filter(d => d < date).sort().pop();
    const near = dates.some(d => Math.abs(daysBetween(d, date)) < rest);
    const why = busy.has(pr.id) ? 'Ya tiene asignación en esta reunión' : awayOn(pr.id, date) ? 'Ausente' : !canDo(pr, priv) ? 'Sin privilegio' : near ? 'Descansando' : '';
    return { pr, why, pref: prefersMe(pr, priv), days: before ? daysBetween(before, date) : Infinity };
  }).sort((a, b) => (!b.why - !a.why) || b.pref - a.pref || b.days - a.days || a.pr.name.localeCompare(b.pr.name, 'es'));
}

// En Seamos mejores maestros se prefiere a las hermanas: 2 por cada hermano, sin dejar de
// mostrar hermanos. Respeta el orden que ya traía cada grupo (sexo).
function preferWomen(list, prOf = x => x.pr) {
  const f = list.filter(x => prOf(x).sex === 'F'), m = list.filter(x => prOf(x).sex !== 'F'), out = [];
  while (f.length || m.length) out.push(...f.splice(0, 2), ...m.splice(0, 1));
  return out;
}
// ¿Se aplica la preferencia? Solo al estudiante (o a quien no tiene pareja aún) de Seamos mejores maestros
const womenFirst = (row, slot, partnerId) => privFor(row, slot) === 'estudiante' && !slotNeedsMen(row, slot)
  && !(row.helper === 'Ayudante' && partnerId);

// Quiénes conviene poner en una asignación, en orden: cumplen el filtro, tienen el privilegio,
// no están descansando y llevan más tiempo sin participar. reserved: ya usados en la semana.
function candidatesFor(p, row, slot, ctx, reserved, partnerId) {
  const priv = privFor(row, slot), rule = ruleFor(row), men = slotNeedsMen(row, slot);
  const partner = row.helper === 'Ayudante' && partnerId ? profById(partnerId) : null;
  const list = state.profiles
    .filter(pr => !reserved.has(pr.id) && canDo(pr, priv) && !(men && pr.sex === 'F') && !ctx.recent.has(pr.id) && !awayOn(pr.id, meetingDate(p))
      && (!partner || partner.sex === pr.sex || sameFamily(partner.id, pr.id)))
    .map(pr => { const l = ctx.last.get(pr.id); return { pr, rule, fits: fitsRule(pr, rule), pref: prefersMe(pr, priv), days: l ? daysBetween(l.q.date, p.date) : Infinity }; })
    .sort((a, b) => (rule ? b.fits - a.fits : 0) || b.pref - a.pref || b.days - a.days || a.pr.name.localeCompare(b.pr.name, 'es'));
  if (!womenFirst(row, slot, partnerId)) return list;
  // Los que cumplen el filtro siguen yendo primero; dentro de cada grupo se intercala
  return [...preferWomen(list.filter(c => c.fits || !rule)), ...(rule ? preferWomen(list.filter(c => !c.fits)) : [])];
}

// Horario: canción y oración inicial 5 min, canción intermedia 4 min, 1 min de consejo tras cada
// intervención de estudiante; la canción final queda a los 100 minutos del inicio.
function timesFor(p) {
  const [hh, mm] = (state.settings.startTime || '19:00').split(':').map(Number);
  const start = hh * 60 + mm;
  let t = start, prayers = 0;
  const out = {};
  for (const r of p.rows) {
    if (r.kind === 'prayer' && prayers > 0) t = Math.max(t, start + 100);
    out[r.id] = t;
    if (r.kind === 'prayer') { t += 5; prayers++; }
    else if (r.kind === 'song') t += 4;
    else t += (+r.min || 0) + (hasCounsel(r) ? 1 : 0);
  }
  out.end = t;
  return out;
}

// ---------- perfiles y asignaciones ----------
const profById = id => state.profiles.find(p => p.id === id);
const profByName = name => state.profiles.find(p => norm(p.name) === norm(name));
const famById = id => state.families.find(f => f.id === id);
const famOf = pid => { const pr = profById(pid); return pr && pr.familyId ? famById(pr.familyId) : null; };
const sameFamily = (a, b) => { const f = famOf(a); return !!f && f === famOf(b); };
const familyMembers = fam => state.profiles.filter(p => p.familyId === fam.id).sort((a, b) => a.name.localeCompare(b.name, 'es'));
const sortedPrograms = () => [...state.programs].sort((a, b) => b.date.localeCompare(a.date));

function slotsOf(p) {
  const out = [];
  for (const row of p.rows) {
    if (!isAssignable(row)) continue;
    out.push({ row, slot: 'a', pid: row.a });
    if (row.helper) out.push({ row, slot: 'b', pid: row.b });
    if (auxOn(p) && hasAux(row)) {
      out.push({ row, slot: 'xa', pid: row.xa });
      if (row.helper && row.kind !== 'chair') out.push({ row, slot: 'xb', pid: row.xb });
    }
  }
  return out;
}
const assignmentsOf = p => slotsOf(p).filter(x => x.pid && profById(x.pid));

// Cuántas intervenciones tiene cada persona en la semana. Que el presidente haga
// también la oración inicial es normal, así que no cuenta como repetido.
function countsFor(p) {
  const counts = {};
  const intro = p.rows.find(r => r.kind === 'chair' && r.intro);
  const firstPrayer = p.rows.find(r => r.kind === 'prayer');
  for (const x of slotsOf(p)) {
    if (!x.pid) continue;
    if (x.row === firstPrayer && intro && intro.a === x.pid) continue;
    counts[x.pid] = (counts[x.pid] || 0) + 1;
  }
  return counts;
}

function contextFor(p) {
  const priors = sortedPrograms().filter(q => q !== p && q.date <= p.date);
  const last = new Map();
  for (const q of priors) for (const x of assignmentsOf(q)) if (!last.has(x.pid)) last.set(x.pid, { q, ...x });
  // "Descansando": tiene otra asignación a menos de restDays días, antes o después de esta semana
  const recent = new Map(), rest = state.settings.restDays || 28;
  for (const q of state.programs) {
    const d = Math.abs(daysBetween(q.date, p.date));
    if (q === p || d >= rest) continue;
    for (const x of assignmentsOf(q)) {
      const prev = recent.get(x.pid);
      if (!prev || Math.abs(daysBetween(prev.q.date, p.date)) > d) recent.set(x.pid, { q, ...x });
    }
  }
  return { last, recent };
}
const restText = (r, p) => {
  const d = daysBetween(p.date, r.q.date);
  return d < 0 ? `↻ Participó hace ${-d} días: ${roleLabel(r.row, r.slot)}` : `↻ Tiene asignación en ${d} días: ${roleLabel(r.row, r.slot)}`;
};

function statusFor(pid, p, ctx, counts, row, slot) {
  const prof = profById(pid);
  if (!prof) return { cls: 's-warn', text: 'Perfil eliminado' };
  if (counts[pid] > 1) return { cls: 's-dup', text: '⚠ Ya tiene otra intervención en esta semana' };
  const mec = Object.entries(((p.mec || {}).entre) || {}).find(([, id]) => id === pid);
  if (mec) return { cls: 's-dup', text: `⚠ Tiene asignación mecánica en esta reunión: ${MEC.find(r => r.key === mec[0]).label}` };
  if (slotNeedsMen(row, slot) && prof.sex === 'F') return { cls: 's-warn', text: '⚠ Normalmente la asigna un varón' };
  if (!canDo(prof, privFor(row, slot))) return { cls: 's-warn', text: `⚠ No tiene marcado el privilegio “${privLabel(privFor(row, slot))}”` };
  if (row.helper === 'Ayudante') {
    const other = profById(row[mateSlot(slot)]);
    if (other && other.sex !== prof.sex && !sameFamily(prof.id, other.id)) return { cls: 's-warn', text: '⚠ Pareja de distinto sexo que no es de la misma familia' };
  }
  const r = ctx.recent.get(pid);
  if (r) return { cls: 's-recent', text: restText(r, p) };
  const l = ctx.last.get(pid);
  if (!l) return { cls: 's-never', text: '★ Nunca ha participado' };
  const d = daysBetween(l.q.date, p.date);
  if (d >= state.settings.staleDays) return { cls: 's-stale', text: `★ Hace ${d} días · ${roleLabel(l.row, l.slot)}` };
  return { cls: 's-ok', text: `Última vez hace ${d} días · ${roleLabel(l.row, l.slot)}` };
}

function refreshDatalist() {
  document.getElementById('profiles-list').replaceChildren(
    ...[...state.profiles].sort((a, b) => a.name.localeCompare(b.name, 'es')).map(p => h('option', { value: p.name })));
}
