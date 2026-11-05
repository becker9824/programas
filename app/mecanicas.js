// Programas · Asignaciones mecánicas e Inicio.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- sección Mecánicas (función Programa VyM) ----------
// Lista de recomendados al tocar un espacio (como en el programa). getList(texto) devuelve
// [{ pr, why, days }]; los que tienen "why" salen al final con el motivo.
function attachPicker(inp, getList, onChoose) {
  let el = null, items = [], at = 0;
  const close = () => { if (el) { el.remove(); el = null; } };
  const fill = () => {
    const typed = norm(inp.value), all = getList();
    items = (typed ? all.filter(x => (' ' + norm(x.pr.name)).includes(' ' + typed)) : all.filter(x => !x.why && nomOk(x.pr)).slice(0, 8)).slice(0, 30);
    at = Math.min(at, Math.max(items.length - 1, 0));
    el.replaceChildren(h('div', { class: 'pick-head' }, typed ? 'Coincidencias' : 'Recomendados'),
      typed ? null : nomChips(fill),
      ...(items.length ? items.map((x, i) => h('button', { class: 'pick-item' + (i === at ? ' on' : '') + (x.why ? ' other' : ''), type: 'button',
        onmousedown: e => e.preventDefault(), onclick: () => choose(x.pr) },
        h('span', { class: 'nm' }, x.pr.name, x.pref && !x.why ? h('span', { class: 'tag-fam', style: { color: 'var(--accent)' } }, nomLabel(x.pr.nombramiento)) : null,
          x.why ? h('span', { class: 'tag-fam', style: { color: 'var(--orange)' } }, x.why) : null),
        h('span', { class: 'hint ' + (x.why ? 's-recent' : x.days === Infinity ? 's-stale' : 's-ok') }, x.days === Infinity ? 'nunca' : `hace ${x.days} d`)))
        : [h('div', { class: 'pick-empty' }, typed ? 'Nadie con ese nombre.' : 'Nadie disponible. Escribe un nombre para buscar entre todos.')]));
  };
  const open = () => {
    close();
    el = h('div', { class: 'pick' });
    const box = inp.parentNode.getBoundingClientRect(), width = Math.min(Math.max(box.width, 260), innerWidth - 16);
    const over = box.left + width - (innerWidth - 8);
    Object.assign(el.style, { top: (inp.offsetTop + inp.offsetHeight + 4) + 'px', width: width + 'px', right: 'auto', left: (over > 0 ? -over : 0) + 'px' });
    inp.parentNode.append(el); fill(); roomForPick(inp);
  };
  const choose = pr => { close(); inp.value = pr.name; onChoose(pr.id); inp.blur(); };
  inp.addEventListener('focus', () => { inp.select(); open(); });
  inp.addEventListener('input', () => { if (el) { at = 0; fill(); } });
  inp.addEventListener('keydown', e => {
    if (!el) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); at = Math.max(0, Math.min(items.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1))); fill(); }
    else if (e.key === 'Enter' && items[at]) { e.preventDefault(); choose(items[at].pr); }
    else if (e.key === 'Escape') close();
  });
  inp.addEventListener('blur', () => setTimeout(close, 150));
}

const mecTime = mtg => fmtClock(mtg === 'entre' ? state.settings.startTime || '19:00' : state.settings.weekendTime || '10:00');

// PDF: tabla en hoja horizontal, una fila por reunión, columnas por asignación
function mecanicasPDF(weeks) {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) return toast('No se pudo crear el PDF.');
  weeks = [...weeks].sort((a, b) => a.date.localeCompare(b.date));
  const s = state.settings;
  const doc = new J({ orientation: 'landscape', unit: 'mm', format: s.paper === 'a4' ? 'a4' : 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 10;
  // Columnas: fecha + una por asignación (micrófono auditorio junta sus 2 hermanos)
  const cols = [{ t: 'Reunión', keys: [] }, ...MEC.filter(r => r.key !== 'micAud2').map(r => ({ t: r.label, keys: r.key === 'micAud1' ? ['micAud1', 'micAud2'] : [r.key] }))];
  const dateW = 40, colW = (W - 2 * M - dateW) / (cols.length - 1);
  const xs = cols.map((c, i) => M + (i ? dateW + (i - 1) * colW : 0)), widths = cols.map((c, i) => i ? colW : dateW);
  const blue = [29, 95, 208];
  const fmtD = iso => capFirst(toDate(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' }));
  const range = `${fmtShort(mecDate(weeks[0], 'entre'))} – ${fmtShort(mecDate(weeks[weeks.length - 1], 'fin'))}`;
  let y;
  const header = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20);
    doc.text('Asignaciones mecánicas', M, M + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
    doc.text(range, M, M + 12);
    if (s.congregation) { doc.setFont('helvetica', 'bold'); doc.setTextColor(20); doc.text(s.congregation, W - M, M + 6, { align: 'right' }); }
    y = M + 17;
    doc.setFillColor(...blue); doc.rect(M, y, W - 2 * M, 11, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255);
    cols.forEach((c, i) => {
      const lines = doc.splitTextToSize(c.t, widths[i] - 3);
      lines.forEach((t, j) => doc.text(t, xs[i] + widths[i] / 2, y + 5.5 - (lines.length - 1) * 1.7 + j * 3.4, { align: 'center', baseline: 'middle' }));
    });
    y += 11;
  };
  header();
  weeks.forEach((p, wi) => {
    for (const [mtg, label] of MEETINGS) {
      const cells = cols.map((c, i) => i === 0
        ? [label, fmtD(mecDate(p, mtg)), mecTime(mtg)]
        : c.keys.map(k => (profById(mecGet(p, mtg, k)) || {}).name).filter(Boolean).flatMap(n => doc.splitTextToSize(n, widths[i] - 3)));
      const lines = Math.max(2, ...cells.map(l => l.length || 1));
      const rh = Math.max(11, lines * 3.9 + 3);
      if (y + rh > H - M) { doc.addPage(); header(); }
      if (wi % 2 === 0) { doc.setFillColor(242, 245, 250); doc.rect(M, y, W - 2 * M, rh, 'F'); }
      doc.setDrawColor(205); doc.setLineWidth(0.2);
      cols.forEach((c, i) => doc.rect(xs[i], y, widths[i], rh));
      cells.forEach((lines, i) => {
        if (!lines.length) { doc.setTextColor(170); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('—', xs[i] + widths[i] / 2, y + rh / 2, { align: 'center', baseline: 'middle' }); return; }
        const top = y + rh / 2 - (lines.length - 1) * 1.95;
        lines.forEach((t, j) => {
          if (i === 0) { doc.setFont('helvetica', j === 0 ? 'bold' : 'normal'); doc.setFontSize(j === 0 ? 9 : 8.5); doc.setTextColor(j === 0 ? 20 : 80); }
          else { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20); }
          doc.text(t, i === 0 ? xs[i] + 2.5 : xs[i] + widths[i] / 2, top + j * 3.9, { align: i === 0 ? 'left' : 'center', baseline: 'middle' });
        });
      });
      y += rh;
    }
    // Línea más gruesa entre semanas
    doc.setDrawColor(120); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
  });
  savePDF(doc, `Asignaciones mecánicas ${range}`);
}

// Elegir las semanas del PDF (marcadas las próximas 8)
// Descargar todo un mes de una vez: se elige el mes (de las semanas que hay) y se arma el PDF
function monthDownload(list, run) {
  const months = [...new Set(list.map(p => meetingDate(p).slice(0, 7)))].sort();
  if (!months.length) return null;
  const cur = todayISO().slice(0, 7), def = months.includes(cur) ? cur : months[months.length - 1];
  const sel = h('select', { title: 'Mes' }, months.map(m => h('option', { value: m, selected: m === def ? true : null }, fmtMonth(m))));
  return h('div', { class: 'row', style: { gap: '6px' } }, sel,
    h('button', { class: 'btn', onclick: () => run(list.filter(p => meetingDate(p).slice(0, 7) === sel.value)) }, '⬇ Mes completo'));
}

function openMecanicasPDFDialog(weeks) {
  const boxes = weeks.map((p, i) => ({ p, box: h('input', { type: 'checkbox', checked: i < 8 }) }));
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, 'PDF de asignaciones mecánicas'),
      h('p', { class: 'muted small-text', style: { margin: 0 } }, 'Elige las semanas que quieres en la tabla.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => boxes.forEach(b => { b.box.checked = true; }) }, 'Todas'),
        h('button', { class: 'btn small', onclick: () => boxes.forEach(b => { b.box.checked = false; }) }, 'Ninguna')),
      h('div', { class: 'slips' }, boxes.map(({ p, box }) => h('label', { class: 'slip' }, box, h('span', null, p.title))))),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => {
        const sel = boxes.filter(b => b.box.checked).map(b => b.p);
        if (!sel.length) return toast('Elige al menos una semana');
        close(); mecanicasPDF(sel);
      } }, '⬇ Crear PDF')));
  document.body.append(dlg); dlg.showModal();
}

function renderMecanicas() {
  const thisMonday = mondayOf(todayISO());
  const weeks = [...state.programs].filter(p => p.date >= thisMonday).sort((a, b) => a.date.localeCompare(b.date));
  const fmtD = iso => capFirst(toDate(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }));

  const slotInput = (p, mtg, key) => {
    const id = mecGet(p, mtg, key), wrap = h('div', { style: { position: 'relative' } });
    const inp = h('input', { type: 'text', autocomplete: 'off', placeholder: 'Asignar…', value: id && profById(id) ? profById(id).name : '', style: { width: '100%' },
      onchange: e => {
        const val = squash(e.target.value);
        if (!val) { mecSet(p, mtg, key, null); save(); return; }
        const pr = profByName(val);
        if (pr) { mecSet(p, mtg, key, pr.id); save(); render(); } else { toast('No hay un hermano con ese nombre'); e.target.value = id && profById(id) ? profById(id).name : ''; }
      } });
    attachPicker(inp, () => mecCandidates(p, mtg, key), pid => { mecSet(p, mtg, key, pid); save(); render(); });
    wrap.append(inp);
    if (confirmedOn(id, `${p.id}|mec|${mtg}|${key}`)) wrap.append(h('span', { class: 'conf-mark', title: 'Confirmó que la recibió' }, '✔'));
    return wrap;
  };

  // "Sugerir": llena los espacios vacíos de la semana con el mejor disponible de cada uno
  const suggestWeek = p => {
    let n = 0;
    for (const [mtg] of MEETINGS) for (const { key } of MEC) {
      if (mecGet(p, mtg, key)) continue;
      const best = mecCandidates(p, mtg, key).find(x => !x.why);
      if (best) { mecSet(p, mtg, key, best.pr.id); n++; }
    }
    save(); render();
    toast(n ? `Se sugirieron ${n} asignaciones. Puedes cambiar las que quieras.` : 'No hay a quién sugerir para los espacios vacíos.');
  };

  const card = p => h('div', { class: 'card', style: { padding: '14px', marginBottom: '12px' } },
    h('div', { class: 'row spread', style: { marginBottom: '10px' } },
      h('strong', { style: { fontSize: '16px' } }, p.title),
      h('div', { class: 'row' },
        h('button', { class: 'btn small primary', onclick: () => suggestWeek(p) }, '✨ Sugerir'),
        h('button', { class: 'btn small', onclick: () => openWhatsAppDialog(p) }, '💬 WhatsApp'),
        h('button', { class: 'btn small', onclick: () => {
          if (!confirm('¿Quitar las asignaciones mecánicas de esta semana? (El presidente y el lector de entre semana se quedan en el programa.)')) return;
          delete p.mec; save(); render();
        } }, 'Limpiar'))),
    h('div', { class: 'mec-grid' }, MEETINGS.map(([mtg, label]) => h('div', null,
      h('div', { class: 'small-text muted', style: { fontWeight: 600, marginBottom: '6px' } }, `${label} · ${fmtD(mecDate(p, mtg))} · ${mecTime(mtg)}`),
      MEC.map(({ key, label: l }) => h('div', { class: 'mec-row' },
        h('span', { class: 'small-text' }, l, mtg === 'entre' && mecLinked(p, mtg, key) ? h('span', { class: 'muted', title: 'Es el mismo del programa de Vida y Ministerio' }, ' (programa)') : null),
        slotInput(p, mtg, key)))))));

  return h('div', null,
    h('div', { class: 'row spread', style: { alignItems: 'flex-start' } },
      h('h1', null, 'Asignaciones mecánicas'),
      h('div', { class: 'row' }, monthDownload(state.programs, mecanicasPDF), weeks.length ? h('button', { class: 'btn primary', onclick: () => openMecanicasPDFDialog(weeks) }, '⬇ PDF') : null)),
    h('p', { class: 'sub' }, `Toca un espacio para ver a los hermanos más recomendados, o usa “✨ Sugerir” para llenar los vacíos de la semana. No se repite a nadie en ${state.settings.mecRestDays ?? 14} días ni en la misma reunión.`),
    weeks.length ? weeks.map(card) : h('div', { class: 'card empty' }, 'No hay semanas próximas. Agrégalas en Semanas.'));
}

// ---------- inicio: lo importante de un vistazo, según las funciones de cada quien ----------
function renderHome() {
  const today = todayISO(), hour = new Date().getHours();
  const hello = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = (nube.me.nombre || '').split(' ')[0];
  const weeks = can('programa') ? publicWeeks() : nube.publico ? JSON.parse(nube.publico.semanas || '[]') : [];
  const tile = (ic, title, value, sub, onclick, tone) => h('button', { class: 'tile' + (tone ? ' ' + tone : ''), onclick, 'data-k': ic },
    h('span', { class: 'tile-ic' }, icon(ic, 22)),
    h('span', { class: 'tile-body' }, h('span', { class: 'tile-t' }, title), h('strong', { class: 'tile-v' }, value), sub ? h('span', { class: 'tile-s' }, sub) : null),
    icon('chev', 18));
  const tiles = [];

  const next = weeks.find(w => (w.day || addDays(w.date, 6)) >= today);
  tiles.push(next ? tile('list', 'Próxima reunión', next.meeting.replace(/ de \d{4}$/, ''), next.title, () => go({ name: 'list' }))
    : tile('list', 'Reuniones', 'Sin programa publicado', null, () => go({ name: 'list' })));

  // Informe del mes: se revisa si ya lo envió
  if (reportsByMembers() && nube.me.perfil) {
    const month = defaultMonth();
    // Se recuerda lo último que se supo (sin “Revisando…” cada vez que se dibuja Inicio)
    const key = `${nube.me.perfil}_${month}`, known = nube.miInforme && nube.miInforme.key === key ? nube.miInforme.sent : null;
    const paint = sent => sent ? tile('report', `Tu informe de ${fmtMonth(month).toLowerCase()}`, '✓ Enviado', 'Puedes corregirlo si hace falta', () => go({ name: 'report' }), 'ok')
      : tile('report', `Tu informe de ${fmtMonth(month).toLowerCase()}`, 'Pendiente', 'Toca para enviarlo', () => go({ name: 'report' }), 'warn');
    const t = known == null ? tile('report', `Tu informe de ${fmtMonth(month).toLowerCase()}`, 'Revisando…', null, () => go({ name: 'report' })) : paint(known);
    F.getDoc(congRef('informes', key)).then(s => {
      nube.miInforme = { key, sent: s.exists() };
      if (s.exists() === known) return;
      t.replaceWith(paint(s.exists()));
    }).catch(() => {});
    tiles.push(t);
  }

  if (nube.me.perfil) {
    const a = awayNow(nube.me.perfil);
    tiles.push(tile('ausencia', 'Ausencia', a ? awayText(a) : 'No estás ausente', a ? 'Toca para cambiarla o quitarla' : 'Avisa si vas a faltar un tiempo',
      () => openAbsenceDialog(nube.me.perfil, nube.me.nombre, render), a ? 'warn' : null));
  }
  const unread = unreadAnnouncements(), ann = visibleAnnouncements();
  tiles.push(tile('anuncios', 'Anuncios', unread ? `${unread} nuevo${unread > 1 ? 's' : ''}` : ann.length ? 'Al día' : 'Sin anuncios',
    ann[0] ? ann[0].titulo : null, () => go({ name: 'anuncios' }), unread ? 'warn' : null));

  // Según la función
  if (can('programa')) {
    const thisMonday = mondayOf(today);
    const open = state.programs.filter(p => p.date >= thisMonday && slotsOf(p).some(x => !x.pid)).length;
    tiles.push(tile('people', 'Asignaciones', open ? `${open} semana${open > 1 ? 's' : ''} por completar` : 'Todo asignado',
      'Próximas semanas', () => go({ name: 'list' }), open ? 'warn' : 'ok'));
    // Mecánicas de las próximas 4 semanas
    const soon = state.programs.filter(p => p.date >= thisMonday && p.date < addDays(thisMonday, 28));
    const empty = soon.reduce((a, p) => a + MEETINGS.reduce((b, [mtg]) => b + MEC.filter(r => !mecGet(p, mtg, r.key)).length, 0), 0);
    if (soon.length) tiles.push(tile('mecanicas', 'Asignaciones mecánicas', empty ? `${empty} espacio${empty > 1 ? 's' : ''} por llenar` : 'Todo asignado',
      'Próximas 4 semanas', () => go({ name: 'mecanicas' }), empty ? 'warn' : 'ok'));
  }
  if (isAdmin()) {
    const waiting = nube.miembros.filter(m => m.estado !== 'activo').length;
    if (waiting) tiles.push(tile('users', 'Cuentas nuevas', `${waiting} esperando aprobación`, 'Toca para revisarlas en Hermanos', () => go({ name: 'people' }), 'warn'));
  }
  if (can('secretario')) { const t = tile('report', 'Informes de la congregación', fmtMonth(defaultMonth()), 'Ver quién falta y capturar', () => go({ name: 'report' })); t.dataset.k = 'informes'; tiles.push(t); }
  if (can('cuentas') && nube.cuentasIni) {
    const ini = nube.cuentasIni;
    const bal = nube.cuentas.filter(m => m.fecha >= ini.fecha).reduce((a, m) => { const d = effect(m); return a + d.caja + d.banco; }, ini.caja + ini.banco);
    tiles.push(tile('cuentas', 'Cuentas', money(bal), 'Saldo total (efectivo y banco)', () => go({ name: 'cuentas' })));
  }
  const nextEv = nube.eventos.filter(e => (e.hasta || e.desde) >= today).sort((a, b) => a.desde.localeCompare(b.desde))[0];
  if (nextEv) tiles.push(tile('calendario', 'Próximo evento', evTitle(nextEv), fmtRange(nextEv), () => go({ name: 'calendario' })));
  const cleaningGroup = cleaningOf(mondayOf(today));
  if (cleaningGroup) tiles.push(tile('arreglos', 'Limpieza del Salón', cleaningGroup, 'Esta semana', () => go({ name: 'arreglos' })));
  if (nube.territorios.length) {
    const base = vueltaBase(), n = k => nube.territorios.filter(x => estadoDe(x, base) === k).length;
    const count = (k, word) => `${n(k)} ${word}${n(k) === 1 ? '' : 's'}`;
    tiles.push(tile('territorios', 'Territorios', count('disponible', 'disponible'),
      `${count('asignado', 'asignado')} · ${count('terminado', 'completado')}`, () => go({ name: 'territorios' })));
  }

  const hero = h('div', { class: 'card hello' },
    h('div', { class: 'hello-text' },
      h('span', { class: 'hello-date' }, capFirst(new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }))),
      h('h1', null, `${hello}${firstName ? ', ' + firstName : ''}`),
      h('p', null, congName() || 'Programas y asignaciones')),
    isAdmin() && !homeEdit ? h('button', { class: 'hello-edit', title: 'Ordenar u ocultar las tarjetas de Inicio', onclick: startHomeEdit }, icon('edit', 16), 'Editar') : null);
  if (homeEdit && isAdmin()) return homeEditor(hero, tiles, weeks);
  if (isAdmin() && nube.solicitudes.length) tiles.push(tile('privacidad', 'Solicitudes de privacidad', `${nube.solicitudes.length} pendiente${nube.solicitudes.length > 1 ? 's' : ''}`,
    'Responder en máximo 20 días hábiles', () => go({ name: 'privacidad' }), 'warn'));
  // Predicación pública: tu próximo turno, o cuántos hay con lugar
  const mt = myTurns()[0], openTurns = turnsAhead().filter(t => Object.keys(t.inscritos || {}).length < t.cupo).length;
  if (mt) tiles.push(tile('publica', 'Predicación pública', `${capFirst(toDate(mt.fecha).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }))} · ${fmtHora(mt.hora)}`, mt.lugar, () => go({ name: 'arreglos' }), 'ok'));
  else if (openTurns) tiles.push(tile('publica', 'Predicación pública', `${openTurns} turno${openTurns > 1 ? 's' : ''} con lugar`, 'Toca para apuntarte', () => go({ name: 'arreglos' })));
  // Pastoreo: hermanos sin visita en 6 meses
  if (isElder() && state.profiles.length) {
    const last = lastVisits(), due = state.profiles.filter(pr => { const v = last.get(pr.id); return !v || daysBetween(v.fecha, today) >= 180; }).length;
    tiles.push(tile('pastoreo', 'Pastoreo', due ? `${due} sin visita en 6 meses` : 'Todos visitados', 'Visitas de los ancianos', () => go({ name: 'pastoreo' }), due ? 'warn' : 'ok'));
  }

  return h('div', null,
    hero,
    setupChecklist(),
    FB_CONFIG && !EMU ? pushCard(true) : null,
    (myView() || {}).sinAsignacion ? null : nextAssignmentCard(weeks),
    h('div', { class: 'tiles' }, customTiles(tiles)));
}
