// Programas · Informe mensual, hoja de informes (PDF y Excel).
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- informe mensual ----------
function recentMonths(n) {
  const out = [], d = new Date(); d.setDate(1);
  for (let i = 0; i < n; i++) { out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); d.setMonth(d.getMonth() - 1); }
  return out;
}
const fmtMonth = m => capFirst(new Date(m + '-15T12:00:00').toLocaleDateString('es', { month: 'long', year: 'numeric' }));
// Del 1 al 20 normalmente se informa el mes anterior
const defaultMonth = () => recentMonths(2)[new Date().getDate() <= 20 ? 1 : 0];
const monthSelect = (months, value, onchange) => h('select', { onchange: e => onchange(e.target.value) },
  months.map(m => h('option', { value: m, selected: m === value ? true : null }, fmtMonth(m))));

// Grupo del informe de cada mes (el precursor auxiliar puede cambiar de un mes a otro).
// En el perfil, tipo: 'pub' (o sin poner) publicador, 'reg' precursor regular, 'no' no es publicador.
const GRUPOS = [['pub', 'Publicador', 'Publicadores'], ['aux', 'Precursor auxiliar', 'Precursores auxiliares'],
  ['reg', 'Precursor regular', 'Precursores regulares']];
const grupoLabel = g => (GRUPOS.find(([k]) => k === g) || GRUPOS[0])[1];
const isPublisher = pr => pr.tipo !== 'no';
function monthsBefore(m, n) {
  const out = [], d = new Date(m + '-15T12:00:00');
  for (let i = 0; i < n; i++) { out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); d.setMonth(d.getMonth() - 1); }
  return out;
}

// Formulario de un informe (el propio, o el de otro si lo captura el secretario).
// grupoDefault: el que se propone si todavía no hay informe de ese mes.
function reportForm(perfil, nombre, month, prev, onSaved, own, grupoDefault) {
  const id = `${perfil}_${month}`;
  let part = prev ? prev.participo : null, grupo = (prev && prev.grupo) || grupoDefault || 'pub';
  const yes = h('input', { type: 'radio', name: 'participo-' + id, checked: part === true, onchange: () => { part = true; } });
  const no = h('input', { type: 'radio', name: 'participo-' + id, checked: part === false, onchange: () => { part = false; } });
  const hours = h('input', { type: 'number', min: 0, max: 744, step: 'any', style: { width: '140px' },
    value: prev && prev.horas != null ? prev.horas : '' });
  const hoursField = h('label', { class: 'field' }, 'Horas', hours);
  const showHours = () => { hoursField.style.display = grupo === 'pub' ? 'none' : ''; };
  showHours();
  const grupos = GRUPOS.map(([k, label]) => h('label', null,
    h('input', { type: 'radio', name: 'grupo-' + id, checked: grupo === k, onchange: () => { grupo = k; showHours(); } }), label));
  const studies = h('input', { type: 'number', min: 0, max: 99, step: 1, style: { width: '100px' }, value: prev ? prev.cursos : 0 });
  const notes = h('textarea', { rows: 3, maxlength: 1000, placeholder: 'Opcional' }, prev ? prev.notas : '');
  const err = h('div', { class: 'err' });
  const btn = h('button', { class: 'btn primary', onclick: async () => {
    err.textContent = '';
    if (part === null) return err.textContent = own ? 'Indica si participaste en la predicación.' : 'Indica si participó en la predicación.';
    const hv = grupo === 'pub' || hours.value.trim() === '' ? null : Math.round(Number(hours.value) * 100) / 100;
    if (hv != null && !(hv >= 0 && hv <= 744)) return err.textContent = 'Revisa las horas.';
    if (grupo !== 'pub' && part && hv == null) return err.textContent = 'Los precursores anotan sus horas del mes.';
    const cv = Math.round(Number(studies.value) || 0);
    if (cv < 0 || cv > 99) return err.textContent = 'Revisa los cursos bíblicos.';
    btn.disabled = true;
    try {
      await F.setDoc(congRef('informes', id), { perfil, nombre, mes: month, grupo, participo: part, horas: hv, cursos: cv,
        notas: notes.value.trim().slice(0, 1000), enviado: F.serverTimestamp(), por: nube.user.uid });
      toast(own ? 'Informe enviado. ¡Gracias!' : `Informe de ${nombre} guardado`);
      onSaved();
    } catch (e) { err.textContent = errMsg(e); btn.disabled = false; }
  } }, prev ? 'Actualizar informe' : own ? 'Enviar informe' : 'Guardar informe');
  return h('div', { class: 'settings' },
    h('div', { class: 'field' }, h('span', null, own ? 'Este mes fuiste' : 'Este mes fue'),
      h('div', { class: 'radios', style: { flexWrap: 'wrap', gap: '6px 16px' } }, grupos)),
    h('div', { class: 'field' }, h('span', null, own ? '¿Participaste en alguna forma de la predicación este mes?' : '¿Participó en alguna forma de la predicación este mes?'),
      h('div', { class: 'radios' }, h('label', null, yes, 'Sí'), h('label', null, no, 'No'))),
    h('div', { class: 'row', style: { gap: '20px', alignItems: 'flex-end' } }, hoursField,
      h('label', { class: 'field' }, 'Cursos bíblicos', studies)),
    h('label', { class: 'field' }, 'Notas', notes),
    prev ? h('div', { class: 'small-text muted' }, `Enviado ${prev.enviado ? 'el ' + fmtStamp(prev.enviado) : ''}. Se puede corregir y volver a guardar.`) : null,
    err, h('div', { class: 'row' }, btn));
}

function renderReport() {
  let month = defaultMonth();
  const box = h('div');
  const secre = can('secretario') ? congregationReports() : null;
  const perfil = nube.me.perfil, ownAllowed = reportsByMembers() && perfil;

  async function load() {
    if (!ownAllowed) return box.replaceChildren(h('div', { class: 'card settings muted' }, !reportsByMembers()
      ? 'En tu congregación los informes los registra el secretario.'
      : 'Un encargado todavía no ha unido tu cuenta con tu nombre en la lista de hermanos. Cuando lo haga, podrás enviar tu informe aquí.'));
    box.replaceChildren(h('div', { class: 'card settings muted' }, 'Cargando…'));
    let prev = null, last = null;
    // Sin conexión (y sin copia en el equipo) se puede llenar igual: se sube al volver el internet
    const get = m => F.getDoc(congRef('informes', `${perfil}_${m}`)).then(s => s.exists() ? s.data() : null,
      e => { if (e.code === 'unavailable') return null; throw e; });
    try { [prev, last] = await Promise.all([get(month), get(monthsBefore(month, 2)[1])]); }
    catch (e) { return box.replaceChildren(h('div', { class: 'card settings err' }, errMsg(e))); }
    const name = (profById(perfil) || {}).name || nube.me.nombre;
    // Si no hay informe de este mes, se propone el grupo del mes anterior
    box.replaceChildren(h('div', { class: 'card' },
      reportForm(perfil, name, month, prev, () => { load(); if (secre) secre.reload(); }, true, last && last.grupo)));
  }
  load();
  return h('div', null,
    h('h1', null, secre ? 'Informes' : 'Informe mensual'),
    ownAllowed || !secre ? [
      h('p', { class: 'sub' }, 'Llena lo que te corresponda: los precursores también anotan sus horas.'),
      ownAllowed ? h('div', { class: 'row', style: { marginBottom: '12px' } },
        h('label', { class: 'field' }, 'Mes de tu informe', monthSelect(recentMonths(6), month, m => { month = m; load(); }))) : null,
      box] : null,
    secre ? secre.el : null);
}

// Secretario (o coordinador): resumen del mes por grupo y los informes de cada publicador.
// Tocar una fila abre el informe para capturarlo o corregirlo.
function congregationReports() {
  let month = defaultMonth();
  const box = h('div');
  async function reload() {
    box.replaceChildren(h('div', { class: 'muted' }, 'Cargando…'));
    // Este mes y los 5 anteriores: los "publicadores activos" informaron en los últimos 6 meses
    const months = monthsBefore(month, 6);
    let docs;
    try {
      const q = F.query(F.collection(F.db, 'congregaciones', nube.cong, 'informes'), F.where('mes', 'in', months));
      docs = (await F.getDocs(q)).docs.map(d => d.data());
    } catch (e) { return box.replaceChildren(h('div', { class: 'err' }, errMsg(e))); }
    const cur = docs.filter(d => d.mes === month);
    const byProfile = new Map(cur.map(d => [d.perfil, d]));
    const lastGroup = new Map(docs.filter(d => d.mes === months[1]).map(d => [d.perfil, d.grupo]));
    const people = state.profiles.filter(isPublisher).map(p => ({ id: p.id, nombre: p.name, tipo: p.tipo, r: byProfile.get(p.id) }));
    for (const d of cur) if (!people.some(p => p.r === d)) {
      const pr = profById(d.perfil);
      people.push({ id: d.perfil, nombre: pr ? pr.name : d.nombre + ' (perfil eliminado)', tipo: pr && pr.tipo, r: d });
    }
    people.sort(byNombre);
    const active = new Set(docs.filter(d => d.participo).map(d => d.perfil)).size;
    const groups = GRUPOS.map(([k, , label]) => {
      const rs = cur.filter(d => d.participo && (d.grupo || 'pub') === k);
      return { k, label, n: rs.length, hours: Math.round(rs.reduce((a, d) => a + (d.horas || 0), 0) * 100) / 100,
        studies: rs.reduce((a, d) => a + (d.cursos || 0), 0) };
    });
    const missing = people.filter(p => !p.r);
    const summary = [`Informe de la congregación · ${fmtMonth(month)}`, `Publicadores activos: ${active}`,
      ...groups.map(g => `${g.label}: ${g.n} informaron${g.k !== 'pub' ? `, ${g.hours} horas` : ''}, ${g.studies} cursos bíblicos`),
      missing.length ? `Sin informe (${missing.length}): ${missing.map(p => p.nombre).join(', ')}` : 'Todos informaron.'].join('\n');
    const sheet = () => reportSheet(month, cur);
    const designSel = h('select', { title: 'Diseño del PDF', onchange: e => { try { localStorage.setItem('diseno-informes', e.target.value); } catch (x) {} } },
      REPORT_DESIGNS.map(([k, t]) => h('option', { value: k, selected: reportDesign() === k ? true : null }, t)));
    const busy = (btn, fn) => async () => { btn.disabled = true; try { await fn(); } finally { btn.disabled = false; } };
    const xlsMonth = h('button', { class: 'btn small' }, '⬇ Excel del mes'), xlsYear = h('button', { class: 'btn small' }, '⬇ Excel del año de servicio');
    xlsMonth.onclick = busy(xlsMonth, () => reportsExcel([sheet()], `Informes ${fmtMonth(month)}`));
    xlsYear.onclick = busy(xlsYear, () => reportsYearExcel(month));
    const open = p => {
      const dlg = h('dialog', { class: 'dlg' },
        h('div', { class: 'dlg-body' }, h('h3', null, `${p.nombre} · ${fmtMonth(month)}`),
          reportForm(p.id, p.nombre, month, p.r || null, () => { dlg.close(); reload(); }, false,
            p.tipo === 'reg' ? 'reg' : lastGroup.get(p.id))),
        h('div', { class: 'dlg-foot' }, h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cerrar')));
      dlg.addEventListener('close', () => dlg.remove());
      document.body.append(dlg); dlg.showModal();
    };
    box.replaceChildren(
      h('div', { class: 'totals' },
        h('span', null, h('strong', null, `${people.length - missing.length} de ${people.length}`), ' con informe'),
        h('span', null, h('strong', null, active), ' publicadores activos')),
      h('div', { class: 'tablewrap', style: { marginBottom: '12px' } }, h('table', { class: 'stats' },
        h('thead', null, h('tr', null, ['Grupo', 'Informaron', 'Horas', 'Cursos bíblicos'].map(t => h('th', null, t)))),
        h('tbody', null, groups.map(g => h('tr', { style: { cursor: 'default' } },
          h('td', null, h('strong', null, g.label)), h('td', null, g.n), h('td', null, g.k === 'pub' ? '—' : g.hours), h('td', null, g.studies)))))),
      h('div', { class: 'row', style: { marginBottom: '14px' } },
        h('button', { class: 'btn small', onclick: () => navigator.clipboard.writeText(summary).then(() => toast('Resumen copiado')) }, '📋 Copiar resumen'),
        h('button', { class: 'btn small', onclick: openPublisherCardsDialog }, '🗂 Tarjetas del publicador (S-21)')),
      h('div', { class: 'row', style: { marginBottom: '14px', gap: '8px' } },
        h('span', { class: 'small-text muted' }, 'Hoja de informes del mes:'),
        designSel, h('button', { class: 'btn small primary', onclick: () => reportsPDF(sheet(), designSel.value) }, '⬇ PDF'), xlsMonth, xlsYear),
      h('div', { class: 'tablewrap' }, h('table', { class: 'stats' },
        h('thead', null, h('tr', null, ['Nombre', 'Grupo', '¿Participó?', 'Horas', 'Cursos', 'Notas'].map(t => h('th', null, t)))),
        h('tbody', null, people.length ? people.map(p => h('tr', { onclick: () => open(p), title: 'Tocar para capturar o corregir' },
          h('td', null, h('strong', null, p.nombre)),
          p.r ? [h('td', { class: 'small-text' }, grupoLabel(p.r.grupo)), h('td', null, p.r.participo ? 'Sí' : 'No'),
            h('td', null, p.r.horas ?? '—'), h('td', null, p.r.cursos || 0), h('td', { class: 'small-text' }, p.r.notas || '')]
            : h('td', { colspan: 5 }, h('span', { class: 'badge s-warn' }, 'Sin informe'))))
          : h('tr', null, h('td', { colspan: 6, class: 'empty' }, 'Todavía no hay publicadores. Se agregan en Hermanos.'))))));
  }
  reload();
  const el = h('div', { style: { marginTop: '28px' } },
    h('h2', { style: { fontSize: '18px', margin: '0 0 4px' } }, 'Informes de la congregación'),
    h('p', { class: 'sub' }, 'Solo el secretario y el coordinador ven esta parte. Toca un nombre para capturar o corregir su informe.'),
    h('div', { class: 'card', style: { padding: '14px' } },
      h('div', { class: 'row', style: { marginBottom: '10px' } },
        monthSelect(recentMonths(12), month, m => { month = m; reload(); }),
        h('button', { class: 'btn small', onclick: () => reload() }, '↻ Actualizar')),
      box));
  return { el, reload };
}

// ---------- hoja de informes del mes (PDF en varios diseños y Excel) ----------
// "hoja" copia la hoja de Excel del secretario: totales arriba; publicadores, precursores regulares y
// auxiliares, cada quien con el número y el color de su grupo de servicio. El diseño se guarda en el equipo.
const REPORT_DESIGNS = [['hoja', 'Hoja de informes'], ['grupos', 'Por grupos de servicio'], ['sencillo', 'Sencillo en blanco y negro']];
const reportDesign = () => { try { const v = localStorage.getItem('diseno-informes'); return REPORT_DESIGNS.some(([k]) => k === v) ? v : 'hoja'; } catch (e) { return 'hoja'; } };
const GROUP_COLORS = ['FFFF00', '808080', '92D050', '9BC2E6', 'F4B084', 'FFD966', 'FF99FF', 'B4A7D6', '8EA9DB', 'D9D9D9'];
const REPORT_SECTIONS = [
  { k: 'pub', title: 'PUBLICADORES', col: 'ACTIVIDAD', head: 'A9D08E', name: 'A9D08E' },
  { k: 'reg', title: 'PRECURSORES REGULARES', col: 'HORAS', head: 'BDD7EE', name: 'BDD7EE' },
  { k: 'aux', title: 'PRECURSORES AUXILIARES', col: 'HORAS', head: 'FFF2CC', name: 'FFE699' }];
const monthName = m => new Date(m + '-15T12:00:00').toLocaleDateString('es', { month: 'long' });
// Los grupos de servicio en orden ("Grupo 2" antes que "Grupo 10"), con su número y color
function serviceGroupInfo() {
  const groups = [...(FB_CONFIG ? nube.grupos : [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
  const byPid = new Map();
  groups.forEach((g, i) => {
    const num = (g.nombre.match(/\d+/) || [String(i + 1)])[0];
    for (const pid of g.miembros || []) byPid.set(pid, { n: num, nombre: g.nombre, color: GROUP_COLORS[i % GROUP_COLORS.length], order: i, g });
  });
  return { groups, byPid };
}
// cur: los informes de ese mes
function reportSheet(month, cur) {
  const { groups, byPid } = serviceGroupInfo();
  const byProfile = new Map(cur.map(d => [d.perfil, d]));
  const people = state.profiles.filter(isPublisher).map(p => ({ id: p.id, nombre: p.name, tipo: p.tipo, r: byProfile.get(p.id) }));
  for (const d of cur) if (!people.some(p => p.r === d)) people.push({ id: d.perfil, nombre: d.nombre || '(sin nombre)', tipo: null, r: d });
  const kindOf = p => p.r ? (p.r.grupo || 'pub') : p.tipo === 'reg' ? 'reg' : 'pub';
  let n = 0;
  const sections = REPORT_SECTIONS.map(s => {
    const rows = people.filter(p => kindOf(p) === s.k).map(p => ({ ...p, g: byPid.get(p.id) || null }))
      .sort((a, b) => ((a.g ? a.g.order : 999) - (b.g ? b.g.order : 999)) || a.nombre.localeCompare(b.nombre, 'es'));
    rows.forEach(p => { p.n = ++n; });
    const rs = rows.filter(p => p.r);
    return { ...s, rows, inf: rs.length, activos: rs.filter(p => p.r.participo).length,
      horas: Math.round(rs.reduce((a, p) => a + (p.r.horas || 0), 0) * 100) / 100, cursos: rs.reduce((a, p) => a + (p.r.cursos || 0), 0) };
  });
  const sum = k => sections.reduce((a, s) => a + s[k], 0);
  return { month, groups, sections, informes: sum('inf'), noInf: people.length - sum('inf'), horas: Math.round(sum('horas') * 100) / 100, cursos: sum('cursos'), total: people.length };
}
const actText = r => r ? (r.participo ? 'Sí' : 'No') : '';
const hoursText = r => r && r.horas != null ? String(r.horas) : '';

function reportsPDF(sheet, design = reportDesign()) {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) return toast('Se necesita internet para crear el PDF.');
  const doc = new J({ unit: 'pt', format: state.settings.paper === 'a4' ? 'a4' : 'letter' });
  ({ hoja: reportsHojaPDF, grupos: reportsGroupsPDF, sencillo: reportsPlainPDF }[design] || reportsHojaPDF)(doc, sheet);
  savePDF(doc, `Informes ${fmtMonth(sheet.month)}`);
}
const rgb = hex => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];

// Copia de la hoja de Excel: celdas con borde, encabezados de color y el grupo pintado
function reportsHojaPDF(doc, S) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40, RH = 14.5;
  const cols = [24, 26, 168, 44, 60, 52]; cols.push(W - 2 * M - cols.reduce((a, b) => a + b, 0)); // INF # NOMBRE GRUPO ACT CURSOS COMENTARIOS
  const xs = cols.reduce((a, w, i) => (a.push(a[i] + w), a), [M]);
  const cell = (i, y, text, o = {}) => {
    const x = xs[i], w = o.span ? xs[i + o.span] - x : cols[i];
    if (o.fill) { doc.setFillColor(...rgb(o.fill)); doc.rect(x, y, w, RH, 'F'); }
    doc.setDrawColor(0); doc.setLineWidth(o.thick ? 1.2 : 0.6); doc.rect(x, y, w, RH);
    if (text === '' || text == null) return;
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(9);
    doc.setTextColor(...(o.white ? [255, 255, 255] : [0, 0, 0]));
    const t = doc.splitTextToSize(String(text), w - 5)[0];
    if (o.align === 'right') doc.text(t, x + w - 3, y + RH - 4, { align: 'right' });
    else if (o.align === 'center') doc.text(t, x + w / 2, y + RH - 4, { align: 'center' });
    else doc.text(t, x + 3, y + RH - 4);
  };
  let y = 54;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0);
  doc.text(`TOTALES DE LA CONGREGACIÓN EN ${monthName(S.month).toUpperCase()} DE ${S.month.slice(0, 4)}`, xs[2], y - 4);
  const name = congName() || state.settings.congregation || '';
  if (name) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90); doc.text(name, W - M, y - 4, { align: 'right' }); }
  ['INFORMES', 'NO INF', 'HORAS', 'CURSOS'].forEach((t, i) => cell(2 + i, y, t, { fill: 'F8CBAD', bold: true }));
  y += RH;
  [S.informes, S.noInf, S.horas, S.cursos].forEach((v, i) => cell(2 + i, y, String(v), { bold: true, align: 'right' }));
  y += RH + 18;
  const header = (s, y) => {
    cell(0, y, 'INF'); cell(1, y, '#');
    cell(2, y, s.title, { fill: s.name }); cell(3, y, 'GRUPO', { fill: s.head }); cell(4, y, s.col, { fill: s.head });
    cell(5, y, 'CURSOS', { fill: s.head }); cell(6, y, 'COMENTARIOS', { fill: s.head });
  };
  for (const s of S.sections) {
    if (!s.rows.length && s.k === 'aux') continue;
    if (y + RH * 4 > H - 40) { doc.addPage(); y = 50; }
    header(s, y); y += RH;
    for (const p of s.rows) {
      if (y + RH > H - 40) { doc.addPage(); y = 50; header(s, y); y += RH; }
      const g = p.g, dark = g && g.color === '808080';
      cell(0, y, p.r ? '1' : '', { align: 'center' });
      cell(1, y, String(p.n), { align: 'right' });
      cell(2, y, p.nombre);
      cell(3, y, g ? g.n : '', { fill: g ? g.color : null, align: 'center', white: dark });
      cell(4, y, s.k === 'pub' ? actText(p.r) : hoursText(p.r), { align: s.k === 'pub' ? 'center' : 'right' });
      cell(5, y, p.r ? String(p.r.cursos || 0) : '', { align: 'right' });
      cell(6, y, p.r ? p.r.notas || '' : '');
      y += RH;
    }
    if (y + RH > H - 40) { doc.addPage(); y = 50; }
    cell(0, y, String(s.inf), { bold: true, align: 'center', thick: true });
    cell(1, y, '', { span: 2, thick: true });
    cell(3, y, 'TOTAL', { bold: true, align: 'center', thick: true });
    cell(4, y, s.k === 'pub' ? String(s.activos) : String(s.horas), { bold: true, align: s.k === 'pub' ? 'center' : 'right', thick: true });
    cell(5, y, String(s.cursos), { bold: true, align: 'right', thick: true });
    cell(6, y, '', { thick: true });
    y += RH + 26;
  }
}

// Una tabla por grupo de servicio, con su superintendente y subtotales
function reportsGroupsPDF(doc, S) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40, RH = 16, acc = [37, 99, 235];
  const prName = id => (profById(id) || {}).name || '';
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20);
  doc.text(`Informes de ${monthName(S.month)} de ${S.month.slice(0, 4)}`, M, 56);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
  doc.text(`${congName() || state.settings.congregation || ''} · ${S.informes} de ${S.total} informaron · ${S.horas} horas de precursores · ${S.cursos} cursos bíblicos`, M, 74);
  let y = 96;
  const kinds = { pub: 'Publicador', aux: 'Prec. auxiliar', reg: 'Prec. regular' };
  const cx = [M, M + 190, M + 280, M + 330, M + 375];
  const all = S.sections.flatMap(s => s.rows.map(p => ({ ...p, k: s.k })));
  const blocks = [...S.groups.map(g => ({ g, rows: all.filter(p => p.g && p.g.g === g) })), { g: null, rows: all.filter(p => !p.g) }].filter(b => b.rows.length);
  for (const b of blocks) {
    if (y + RH * 4 > H - 40) { doc.addPage(); y = 50; }
    doc.setFillColor(...(b.g ? rgb(GROUP_COLORS[S.groups.indexOf(b.g) % GROUP_COLORS.length]) : [220, 220, 220])); doc.rect(M, y, 6, 20, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(20);
    doc.text(b.g ? b.g.nombre : 'Sin grupo', M + 12, y + 14);
    if (b.g && b.g.superintendente) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100); doc.text(`Superintendente: ${prName(b.g.superintendente)}`, W - M, y + 14, { align: 'right' }); }
    y += 26;
    doc.setFillColor(...acc); doc.rect(M, y, W - 2 * M, RH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255);
    ['Nombre', 'Tipo', 'Participó', 'Horas', 'Cursos', ''].forEach((t, i) => t && doc.text(t, cx[i] + 4, y + 11));
    doc.text('Notas', M + 420, y + 11);
    y += RH;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    b.rows.forEach((p, i) => {
      if (y + RH > H - 40) { doc.addPage(); y = 50; }
      if (i % 2) { doc.setFillColor(243, 246, 252); doc.rect(M, y, W - 2 * M, RH, 'F'); }
      doc.setTextColor(p.r ? 20 : 180, p.r ? 20 : 60, p.r ? 20 : 60);
      doc.text(doc.splitTextToSize(p.nombre, 182)[0], cx[0] + 4, y + 11);
      doc.setTextColor(60);
      doc.text(kinds[p.k], cx[1] + 4, y + 11);
      doc.text(p.r ? actText(p.r) : 'Sin informe', cx[2] + 4, y + 11);
      doc.text(hoursText(p.r), cx[3] + 4, y + 11);
      doc.text(p.r ? String(p.r.cursos || 0) : '', cx[4] + 4, y + 11);
      doc.text(doc.splitTextToSize(p.r ? p.r.notas || '' : '', W - M - (M + 420) - 4)[0] || '', M + 424, y + 11);
      y += RH;
    });
    const rs = b.rows.filter(p => p.r);
    doc.setDrawColor(...acc); doc.setLineWidth(1); doc.line(M, y, W - M, y);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
    doc.text(`${rs.length} de ${b.rows.length} informaron`, cx[0] + 4, y + 12);
    if (b.rows.some(p => p.k !== 'pub')) doc.text(String(Math.round(rs.reduce((a, p) => a + (p.r.horas || 0), 0) * 100) / 100), cx[3] + 4, y + 12);
    doc.text(String(rs.reduce((a, p) => a + (p.r.cursos || 0), 0)), cx[4] + 4, y + 12);
    y += 34;
  }
}

// Blanco y negro: los números para el informe de la congregación y la lista por orden alfabético
function reportsPlainPDF(doc, S) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48, RH = 15;
  doc.setTextColor(0); doc.setFont('times', 'bold'); doc.setFontSize(15);
  doc.text('INFORME DE LA CONGREGACIÓN', W / 2, 56, { align: 'center' });
  doc.setFont('times', 'normal'); doc.setFontSize(11);
  doc.text(`${congName() || state.settings.congregation || ''}`, M, 80);
  doc.text(capFirst(fmtMonth(S.month)), W - M, 80, { align: 'right' });
  let y = 100;
  doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 18;
  doc.setFont('times', 'bold'); doc.setFontSize(10.5);
  ['', 'Informaron', 'Horas', 'Cursos bíblicos'].forEach((t, i) => doc.text(t, [M, M + 230, M + 320, M + 400][i], y));
  doc.setFont('times', 'normal');
  for (const s of S.sections) {
    y += 18;
    doc.text(capFirst(s.title.toLowerCase()), M, y);
    doc.text(String(s.inf), M + 230, y); doc.text(s.k === 'pub' ? '—' : String(s.horas), M + 320, y); doc.text(String(s.cursos), M + 400, y);
  }
  y += 10; doc.setLineWidth(0.4); doc.line(M, y, W - M, y); y += 16;
  doc.setFont('times', 'bold');
  doc.text(`Sin informe: ${S.noInf}`, M, y);
  y += 30;
  const list = S.sections.flatMap(s => s.rows.map(p => ({ ...p, t: { pub: 'Pub.', aux: 'Aux.', reg: 'Reg.' }[s.k] }))).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const cx = [M, M + 210, M + 250, M + 300, M + 345, M + 390];
  const head = () => {
    doc.setFont('times', 'bold'); doc.setFontSize(9.5);
    ['Nombre', 'Tipo', 'Grupo', 'Particip.', 'Horas', 'Cursos'].forEach((t, i) => doc.text(t, cx[i], y));
    y += 5; doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += RH - 4;
    doc.setFont('times', 'normal');
  };
  head();
  for (const p of list) {
    if (y > H - 46) { doc.addPage(); y = 54; head(); }
    doc.text(doc.splitTextToSize(p.nombre, 200)[0], cx[0], y);
    doc.text(p.t, cx[1], y); doc.text(p.g ? p.g.n : '', cx[2], y);
    doc.text(p.r ? actText(p.r) : 'Sin inf.', cx[3], y); doc.text(hoursText(p.r), cx[4], y); doc.text(p.r ? String(p.r.cursos || 0) : '', cx[5], y);
    doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(M, y + 4, W - M, y + 4);
    y += RH;
  }
}

// Excel de verdad (.xlsx) con el diseño de la hoja: una pestaña por mes, con fórmulas en los totales
const loadExcel = () => loadScript('vendor/exceljs.min.js').then(() => window.ExcelJS);
function addReportSheet(wb, S) {
  const ws = wb.addWorksheet(capFirst(monthName(S.month)), { pageSetup: { paperSize: state.settings.paper === 'a4' ? 9 : 1, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [5, 5, 30, 8, 12, 10, 34].map(width => ({ width }));
  const thin = { style: 'thin', color: { argb: 'FF000000' } }, med = { style: 'medium', color: { argb: 'FF000000' } };
  const box = (c, b = thin) => { c.border = { top: b, left: b, bottom: b, right: b }; };
  const fill = (c, hex) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } }; };
  const font = { name: 'Calibri', size: 11 };
  const put = (r, col, v, o = {}) => {
    const c = ws.getCell(r, col); c.value = v; c.font = { ...font, bold: !!o.bold, color: o.white ? { argb: 'FFFFFFFF' } : undefined };
    if (o.fill) fill(c, o.fill);
    if (o.align) c.alignment = { horizontal: o.align, vertical: 'middle' };
    if (o.border !== false) box(c, o.thick ? med : thin);
    return c;
  };
  ws.getCell(1, 3).value = `TOTALES DE LA CONGREGACIÓN EN ${monthName(S.month).toUpperCase()} DE ${S.month.slice(0, 4)}`;
  ws.getCell(1, 3).font = { ...font, bold: true };
  ['INFORMES', 'NO INF', 'HORAS', 'CURSOS'].forEach((t, i) => put(2, 3 + i, t, { fill: 'F8CBAD', bold: true }));
  let r = 5;
  const totalRows = [];
  for (const s of S.sections) {
    if (!s.rows.length && s.k === 'aux') continue;
    put(r, 1, 'INF'); put(r, 2, '#');
    put(r, 3, s.title, { fill: s.name }); put(r, 4, 'GRUPO', { fill: s.head }); put(r, 5, s.col, { fill: s.head });
    put(r, 6, 'CURSOS', { fill: s.head }); put(r, 7, 'COMENTARIOS', { fill: s.head });
    const first = ++r;
    for (const p of s.rows) {
      const g = p.g;
      put(r, 1, p.r ? 1 : null, { align: 'center' });
      put(r, 2, p.n, { align: 'right' });
      put(r, 3, p.nombre);
      put(r, 4, g ? Number(g.n) || g.n : null, { fill: g ? g.color : null, align: 'center', white: g && g.color === '808080' });
      put(r, 5, s.k === 'pub' ? (p.r ? (p.r.participo ? 'Sí' : 'No') : null) : (p.r && p.r.horas != null ? p.r.horas : null), { align: s.k === 'pub' ? 'center' : 'right' });
      put(r, 6, p.r ? p.r.cursos || 0 : null, { align: 'right' });
      put(r, 7, p.r ? p.r.notas || null : null);
      r++;
    }
    const last = r - 1, rng = col => first <= last ? `${col}${first}:${col}${last}` : null;
    const f = (col, result) => rng(col) ? { formula: `SUM(${rng(col)})`, result } : result;
    put(r, 1, f('A', s.inf), { bold: true, align: 'center', thick: true });
    put(r, 2, null, { thick: true }); put(r, 3, null, { thick: true });
    put(r, 4, 'TOTAL', { bold: true, align: 'center', thick: true });
    put(r, 5, s.k === 'pub' ? (rng('E') ? { formula: `COUNTIF(${rng('E')},"Sí")`, result: s.activos } : s.activos) : f('E', s.horas), { bold: true, align: s.k === 'pub' ? 'center' : 'right', thick: true });
    put(r, 6, f('F', s.cursos), { bold: true, align: 'right', thick: true });
    put(r, 7, null, { thick: true });
    totalRows.push({ r, k: s.k });
    r += 3;
  }
  const refs = col => totalRows.map(t => `${col}${t.r}`).join(',');
  const hoursRefs = totalRows.filter(t => t.k !== 'pub').map(t => `E${t.r}`).join(',');
  put(3, 3, refs('A') ? { formula: `SUM(${refs('A')})`, result: S.informes } : S.informes, { bold: true, align: 'right' });
  put(3, 4, S.noInf, { bold: true, align: 'right' });
  put(3, 5, hoursRefs ? { formula: `SUM(${hoursRefs})`, result: S.horas } : S.horas, { bold: true, align: 'right' });
  put(3, 6, refs('F') ? { formula: `SUM(${refs('F')})`, result: S.cursos } : S.cursos, { bold: true, align: 'right' });
  return ws;
}
async function reportsExcel(sheets, fname) {
  toast('Preparando el Excel…');
  let ExcelJS;
  try { ExcelJS = await loadExcel(); } catch (e) { return toast('No se pudo abrir el creador de Excel. Revisa tu internet.'); }
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Programas';
  for (const S of sheets) addReportSheet(wb, S);
  const buf = await wb.xlsx.writeBuffer();
  await saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), cleanName(fname) + '.xlsx');
}
// Excel del año de servicio (septiembre a agosto): una pestaña por mes, hasta el mes elegido
async function reportsYearExcel(month) {
  const y = serviceYearOf(month + '-15') + 1, months = serviceMonths(y - 1).filter(m => m <= month);
  toast('Preparando el Excel…');
  let docs;
  try { docs = (await F.getDocs(F.query(F.collection(F.db, 'congregaciones', nube.cong, 'informes'), F.where('mes', 'in', months)))).docs.map(d => d.data()); }
  catch (e) { return toast(errMsg(e)); }
  await reportsExcel(months.map(m => reportSheet(m, docs.filter(d => d.mes === m))), `Informes año de servicio ${y}`);
}
