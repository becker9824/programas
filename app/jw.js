// Programas · Guía de actividades de wol.jw.org.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- guía de jw.org ----------
function newRow(kind, fields) {
  return { id: uid(), kind, section: '', title: '', detail: '', num: null, min: null, song: null, songHref: null,
    intro: false, a: null, b: null, helper: null, men: false, ...fields };
}

function rowsFromHeading(piece, after, section, songHrefs) {
  const minIn = piece.match(/\((\d+)\s*mins?\.?\)/i);
  const title = squash(piece.replace(/\(\d+\s*mins?\.?\)/i, ''));
  const song = title.match(/^canci[oó]n\s+(\d+)/i);
  if (song && /oraci[oó]n/i.test(title)) return [newRow('prayer', { section, song: +song[1], songHref: songHrefs[song[1]] || null, men: true })];
  if (song) return [newRow('song', { section, song: +song[1], songHref: songHrefs[song[1]] || null })];
  if (/palabras de (introducci|conclusi)/i.test(title)) {
    return [newRow('chair', { section, title, min: minIn ? +minIn[1] : null, intro: /introducci/i.test(title) })];
  }
  const numbered = title.match(/^(\d+)\.\s*(.*)$/);
  let t = numbered ? numbered[2] : title;
  const minAfter = after.match(/^\((\d+)\s*mins?\.?\)/i);
  let rest = squash(after.replace(/^\(\d+\s*mins?\.?\)/i, '').replace(/\bRespuesta\b/g, ''));
  const kind = rest.match(/^([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ ]{3,})\.\s*/);
  if (kind) { t += ` (${capFirst(kind[1].toLowerCase())})`; rest = rest.slice(kind[0].length); }
  const isMaestros = section === SECTIONS[1].name;
  const isDiscurso = /discurso/i.test(t);
  return [newRow('part', {
    section, title: t, num: numbered ? +numbered[1] : null,
    detail: rest.length > 400 ? rest.slice(0, 397) + '…' : rest,
    min: minIn ? +minIn[1] : minAfter ? +minAfter[1] : null,
    helper: isMaestros && !isDiscurso ? 'Ayudante' : /estudio b[ií]blico de la congregaci/i.test(t) ? 'Lector' : null,
    men: !isMaestros || isDiscurso,
  })];
}

function parseGuide(html, monday) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const art = doc.querySelector('#article') || doc.querySelector('article') || doc.body;
  const heads = [...art.querySelectorAll('h1, h2, h3')];
  let reading = '', section = '', title = '';
  const rows = [];
  heads.forEach((el, i) => {
    const text = squash(el.textContent);
    if (!text) return;
    if (el.tagName === 'H1') { title = capFirst(text.toLowerCase()); return; }
    if (el.tagName === 'H2') {
      const sec = SECTIONS.find(s => norm(text).includes(s.key));
      if (sec) section = sec.name;
      else if (!reading && !section) reading = titleCase(text);
      return;
    }
    const songHrefs = {};
    for (const a of el.querySelectorAll('a[href]')) {
      const m = squash(a.textContent).match(/canci[oó]n\s+(\d+)/i);
      if (m) songHrefs[m[1]] = a.getAttribute('href');
    }
    const range = doc.createRange();
    range.setStartAfter(el);
    if (heads[i + 1]) range.setEndBefore(heads[i + 1]); else range.setEndAfter(art.lastChild);
    const after = squash(range.toString());
    for (const piece of text.split('|').map(squash).filter(Boolean)) rows.push(...rowsFromHeading(piece, after, section, songHrefs));
  });
  return { title: title || weekLabel(monday), reading, rows };
}

function blankRows() {
  const [T, M, V] = SECTIONS.map(s => s.name);
  return [
    newRow('prayer', { men: true }),
    newRow('chair', { title: 'Palabras de introducción', min: 1, intro: true }),
    newRow('part', { section: T, num: 1, title: '', min: 10, men: true }),
    newRow('part', { section: T, num: 2, title: 'Busquemos perlas escondidas', min: 10, men: true }),
    newRow('part', { section: T, num: 3, title: 'Lectura de la Biblia', min: 4, men: true }),
    newRow('part', { section: M, num: 4, title: '', min: 3, helper: 'Ayudante' }),
    newRow('part', { section: M, num: 5, title: '', min: 4, helper: 'Ayudante' }),
    newRow('part', { section: M, num: 6, title: '', min: 5, helper: 'Ayudante' }),
    newRow('song', { section: V }),
    newRow('part', { section: V, num: 7, title: '', min: 15, men: true }),
    newRow('part', { section: V, num: 8, title: 'Estudio bíblico de la congregación', min: 30, men: true, helper: 'Lector' }),
    newRow('chair', { section: V, title: 'Palabras de conclusión', min: 3 }),
    newRow('prayer', { section: V, men: true }),
  ];
}

// Dónde se lee jw.org: el programa de PC y servidor.ps1 lo hacen ellos mismos (/jw/…); la versión web
// usa el intermediario en Cloudflare (carpeta intermediario/), porque jw.org no deja leerlo desde otro sitio.
// La app de Android lo lee directo (sus peticiones no tienen esa limitación), igual que intermediario/worker.js.
const JW_PROXY = 'https://programas-jw.marperjamin007.workers.dev';
const JW_BASE = location.protocol === 'https:' ? JW_PROXY : '';
async function jwFetch(path) {
  if (!NATIVE) return fetch(JW_BASE + path, { cache: 'no-store' });
  const wol = async p => {
    const r = await NP.http.get({ url: 'https://wol.jw.org' + p, responseType: 'text', headers: { 'User-Agent': 'Mozilla/5.0 (Programas congregacion)' } });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return r.data;
  };
  const reply = (text, status = 200) => ({ ok: status === 200, status, text: async () => text });
  const url = new URL(path, 'https://x');
  try {
    if (url.pathname === '/jw/ping') return reply('ok');
    if (url.pathname === '/jw/semana') {
      const week = await wol(`/es/wol/meetings/r4/lp-s/${url.searchParams.get('y')}/${url.searchParams.get('w')}`);
      const m = week.match(/href="(\/es\/wol\/d\/r4\/lp-s\/\d+)"\s+class="[^"]*pub-mwb/);
      return m ? reply(await wol(m[1])) : reply('', 404);
    }
    if (url.pathname === '/jw/titulo') {
      const t = ((await wol(url.searchParams.get('path'))).match(/<title>([^<]*)<\/title>/) || [])[1] || '';
      const box = document.createElement('textarea'); box.innerHTML = t.split('&mdash;')[0]; // decodifica &amp;, &#233;…
      return reply(box.value.trim());
    }
  } catch (e) { return reply('', 502); }
  return reply('', 404);
}
async function serverAvailable() {
  if (serverOK !== null) return serverOK;
  if (NATIVE) return serverOK = true;
  if (location.protocol === 'file:' || (location.protocol === 'https:' && !JW_PROXY)) return serverOK = false;
  try { const r = await jwFetch('/jw/ping'); serverOK = r.ok && (await r.text()) === 'ok'; }
  catch (e) { serverOK = false; }
  return serverOK;
}

async function fetchGuide(monday) {
  const { y, w } = isoWeek(monday);
  const r = await jwFetch(`/jw/semana?y=${y}&w=${w}`);
  if (!r.ok) return null;
  const g = parseGuide(await r.text(), monday);
  return g.rows.some(x => x.kind === 'part') ? g : null;
}

// Títulos de las canciones (se guardan una sola vez)
async function ensureSongTitles(programs) {
  const need = new Map();
  for (const p of programs) for (const r of p.rows) if (r.song && !state.songs[r.song] && !need.has(r.song)) need.set(r.song, r.songHref);
  if (!need.size || !await serverAvailable()) return;
  for (const [n, href] of need) {
    const path = n >= 1 && n <= 151 ? `/es/wol/d/r4/lp-s/${1102016800 + n}` : href;
    if (!path) continue;
    try {
      const r = await jwFetch('/jw/titulo?path=' + encodeURIComponent(path));
      const t = r.ok ? squash(await r.text()) : '';
      if (t) {
        state.songs[n] = t;
        document.querySelectorAll(`[data-song="${n}"]`).forEach(el => { el.textContent = ' - ' + t; });
      }
    } catch (e) {}
  }
  save();
}

function setSync(text, warn = false) {
  syncMsg = { text, warn };
  const el = document.getElementById('sync-text');
  if (el) { el.textContent = text; el.className = warn ? 'notice warn' : 'muted small-text'; }
}

async function syncGuides(manual) {
  if (syncing) return;
  syncing = true;
  setSync('Buscando guías en jw.org…');
  if (manual) serverOK = null;
  if (!await serverAvailable()) {
    syncing = false;
    setSync(location.protocol === 'https:'
      ? (JW_PROXY ? 'No se pudo conectar con jw.org. Revisa tu internet y vuelve a intentar.'
        : 'Desde la versión web no se puede leer jw.org. Busca las semanas desde el programa de PC y aparecerán aquí solas.')
      : 'Para buscar las guías en jw.org, abre la app con el archivo “Programas.bat”.', true);
    return;
  }
  const start = mondayOf(todayISO());
  let added = 0, failed = 0;
  for (let i = 0; i < state.settings.weeksAhead; i++) {
    const monday = addDays(start, i * 7), key = weekKey(monday);
    if (state.programs.some(p => p.week === key)) continue;
    if (!manual && state.missing[key] && Date.now() - state.missing[key] < 12 * 36e5) continue;
    setSync(`Buscando la semana del ${fmtDay(monday)}…`);
    try {
      const g = await fetchGuide(monday);
      if (!g) { state.missing[key] = Date.now(); continue; }
      state.programs.push({ id: uid(), week: key, date: monday, source: 'jw', ...g });
      delete state.missing[key];
      added++;
    } catch (e) { failed++; }
  }
  state.lastSync = Date.now();
  save();
  setSync('Buscando los títulos de las canciones…');
  await ensureSongTitles(state.programs);
  syncing = false;
  setSync(failed ? 'No se pudo conectar con jw.org. Revisa tu conexión a internet.'
    : added ? `Se agregaron ${added} semana${added > 1 ? 's' : ''} desde jw.org.`
      : 'Todo al día: no hay semanas nuevas publicadas todavía.', !!failed);
  if (view.name === 'list') render();
}

async function addWeek(dateISO) {
  const monday = mondayOf(dateISO), key = weekKey(monday);
  const existing = state.programs.find(p => p.week === key);
  if (existing) return go({ name: 'edit', id: existing.id });
  let g = null;
  if (await serverAvailable()) {
    toast('Buscando la guía en jw.org…');
    try { g = await fetchGuide(monday); } catch (e) {}
    if (!g) toast('No se encontró la guía de esa semana. Se creó un programa en blanco.');
  }
  const p = { id: uid(), week: key, date: monday, source: g ? 'jw' : 'manual', ...(g || { title: weekLabel(monday), reading: '', rows: blankRows() }) };
  state.programs.push(p); save();
  go({ name: 'edit', id: p.id });
  ensureSongTitles([p]);
}
