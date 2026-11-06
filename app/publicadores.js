// Programas · Lo que ven los publicadores: semanas, su asignación y ajustes.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- vista de publicadores ----------
// Próximas asignaciones de la persona (programa y mecánicas), por fecha
function myAssignments(weeks) {
  const pid = nube.me && nube.me.perfil, today = todayISO(), out = [];
  if (!pid) return out;
  for (const w of weeks) {
    if ((w.day || addDays(w.date, 6)) >= today) for (const r of w.rows) for (const k of ['a', 'b', 'xa', 'xb']) {
      if (!r[k] || r[k].id !== pid) continue;
      const other = r[mateSlot(k)];
      out.push({ key: r.id && `${w.id}|${r.id}|${k}`, day: w.day || w.date, title: r.t, when: `${w.meeting} · ${r.time}`, role: r.labels[k] || '', with: other ? other.n : '', detail: r.detail });
    }
    if (w.fin && w.fin.oradorId === pid && w.fin.day >= today)
      out.push({ key: `${w.id}|fin|orador`, day: w.fin.day, title: `Discurso público${w.fin.tema ? ': ' + w.fin.tema : ''}`, when: `Reunión del fin de semana · ${capFirst(toDate(w.fin.day).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }))}`, role: '', with: '', detail: '' });
    for (const m of w.mec || []) if (m.day >= today) for (const it of m.items) if (it.id === pid)
      out.push({ key: m.mtg && it.k && `${w.id}|mec|${m.mtg}|${it.k}`, day: m.day, title: it.l, when: `${m.label} · ${capFirst(toDate(m.day).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }))}`,
        role: 'Asignación mecánica', with: '', detail: '' });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

function nextAssignmentCard(weeks) {
  const title = h('div', { class: 'small-text muted' }, 'Tu próxima asignación');
  if (!nube.me || !nube.me.perfil) return h('div', { class: 'card mine' }, title,
    h('div', null, 'Un administrador todavía no ha unido tu cuenta con tu nombre en la lista de hermanos. Cuando lo haga, aquí verás tus asignaciones.'));
  const [x, ...rest] = myAssignments(weeks);
  if (!x) return h('div', { class: 'card mine' }, title, h('div', null, 'No tienes asignaciones en las próximas semanas.'));
  return h('div', { class: 'card mine' }, title,
    h('div', { class: 'mine-t' }, x.title),
    h('div', null, x.when),
    x.role ? h('div', null, h('strong', null, x.role), x.with ? ` · con ${x.with}` : '') : null,
    x.detail ? h('div', { class: 'detail' }, x.detail) : null,
    h('div', { class: 'row', style: { marginTop: '8px' } }, confirmButton(x), calendarButton([x, ...rest])),
    rest.length ? h('div', { class: 'small-text muted', style: { marginTop: '10px' } }, 'Después:',
      rest.map(y => h('div', { class: 'row mine-next' }, h('span', null, `${fmtShort(y.day)} · ${y.title}`), confirmButton(y, true)))) : null);
}

function publicWeekCard(w, open) {
  const pid = nube.me && nube.me.perfil, body = [];
  let sec = null;
  for (const r of w.rows) {
    if (r.section && r.section !== sec) {
      sec = r.section; const s = sectionOf(sec);
      body.push(h('div', { class: 'psec ' + secClass(sec), style: { '--sec': s ? s.css : 'var(--sec-none)' } }, h('i'), sec));
    }
    const names = ['a', 'b', 'xa', 'xb'].filter(k => r[k]).map(k =>
      h('span', { class: r[k].id === pid ? 'yo' : null }, (r.labels[k] ? r.labels[k] + ': ' : '') + r[k].n));
    body.push(h('div', { class: 'vrow' }, h('span', { class: 'ptime' }, r.time),
      h('div', null, h('div', { class: 'pt' }, r.t, r.min ? h('span', { class: 'min' }, ` (${r.min} mins.)`) : null),
        names.length ? h('div', { class: 'vnames' }, names) : null)));
  }
  if (w.fin) {
    body.push(h('div', { class: 'psec', style: { '--sec': 'var(--sec-none)' } }, h('i'), 'Reunión del fin de semana'));
    body.push(h('div', { class: 'vrow' }, h('span', { class: 'ptime small-text' }, capFirst(toDate(w.fin.day).toLocaleDateString('es', { weekday: 'short' }))),
      h('div', null, h('div', { class: 'pt' }, 'Discurso público', w.fin.tema ? `: ${w.fin.tema}` : ''),
        h('div', { class: 'vnames' }, h('span', { class: w.fin.oradorId === pid ? 'yo' : null }, `Orador: ${w.fin.orador || '—'}${w.fin.cong ? ' (' + w.fin.cong + ')' : ''}`)))));
  }
  if ((w.mec || []).length) {
    body.push(h('div', { class: 'psec', style: { '--sec': 'var(--sec-none)' } }, h('i'), 'Asignaciones mecánicas'));
    for (const m of w.mec) body.push(h('div', { class: 'vrow' },
      h('span', { class: 'ptime small-text' }, m.label.split(' ')[0]),
      h('div', { class: 'vnames', style: { marginTop: 0 } }, m.items.map(it => h('span', { class: it.id === pid ? 'yo' : null }, `${it.l}: ${it.n}`)))));
  }
  return h('details', { class: 'card vweek ' + themeClass(), open: open || null },
    h('summary', null, h('strong', null, w.title), h('span', { class: 'muted small-text' }, ' · ' + w.meeting),
      FB_CONFIG ? eventsBetween(w.date, addDays(w.date, 6)).map(e => [' ', eventChip(e)]) : null),
    h('div', { class: 'vbody' }, body));
}

function renderPubList() {
  const weeks = nube.publico ? JSON.parse(nube.publico.semanas || '[]') : [];
  const today = todayISO();
  // Una semana se sigue viendo hasta su última reunión (la del fin de semana)
  const lastDay = w => [w.day || addDays(w.date, 6), w.fin && w.fin.day, ...(w.mec || []).map(m => m.day)].filter(Boolean).sort().pop();
  const next = weeks.filter(w => lastDay(w) >= today);
  return h('div', null,
    h('h1', null, 'Semanas'),
    h('p', { class: 'sub' }, congName() || 'Programa de la reunión de entre semana'),
    nextAssignmentCard(weeks),
    next.length ? next.map((w, i) => publicWeekCard(w, i === 0))
      : h('div', { class: 'card empty' }, 'Todavía no hay programas publicados.'));
}

// Tu cuenta: nombre, correo y funciones (cada quien ve solo las suyas)
function accountCard() {
  const roles = isAdmin() ? ['Coordinador'] : PERMS.filter(([k]) => can(k)).map(([, label]) => label);
  return h('div', { class: 'card settings', style: { marginBottom: '14px' } },
    h('div', null, h('strong', null, nube.me.nombre),
      h('div', { class: 'muted small-text' }, nube.user.email + (roles.length ? ' · ' + roles.join(', ') : ''))),
    h('label', { class: 'field', style: { margin: '10px 0' } }, 'Al descargar programas y hojas',
      h('select', { style: { maxWidth: '260px' }, onchange: e => { setDlFormat(e.target.value); toast('Listo'); } },
        DL_FORMATS.map(([v, t]) => h('option', { value: v, selected: dlFormat() === v ? true : null }, t)))),
    h('div', { class: 'row' },
      nube.me.perfil ? h('button', { class: 'btn', onclick: () => openAbsenceDialog(nube.me.perfil, nube.me.nombre, render) }, awayNow(nube.me.perfil) ? 'Mi ausencia' : 'Avisar una ausencia') : null,
      h('button', { class: 'btn', onclick: openGuide }, 'Ver la guía de la app'), signOutBtn()),
    accountExtras());
}

// Solo el coordinador: nombre de la congregación y quién usa la app
function congregationSettings() {
  const c = nube.congData || {};
  const update = async (data, msg) => {
    try { await F.updateDoc(congRef(), data); toast(msg); } catch (e) { toast(errMsg(e)); }
  };
  const nameI = h('input', { type: 'text', value: c.nombre || '', onchange: e => {
    const v = squash(e.target.value);
    if (!v) { e.target.value = c.nombre || ''; return; }
    state.settings.congregation = v; uploadState();
    update({ nombre: v }, 'Nombre actualizado');
  } });
  const mode = c.modo === 'encargados' ? 'encargados' : 'todos';
  const radio = (value, label, desc) => h('label', { class: 'row', style: { flexWrap: 'nowrap', alignItems: 'flex-start', gap: '8px', color: 'var(--text)', fontSize: '14px' } },
    h('input', { type: 'radio', name: 'modo', checked: mode === value, style: { marginTop: '3px' }, onchange: () =>
      update({ modo: value }, value === 'todos' ? 'Los publicadores ya pueden enviar su informe' : 'Ahora solo el secretario registra los informes') }),
    h('span', null, h('strong', null, label), h('div', { class: 'muted small-text' }, desc)));
  return [
    h('h2', { class: 'group' }, 'Congregación'),
    h('div', { class: 'card settings', style: { marginBottom: '14px' } },
      h('label', { class: 'field' }, 'Nombre de la congregación', nameI),
      h('div', { class: 'field' }, h('span', null, '¿Quién usa la app?'),
        radio('todos', 'Todos los publicadores', 'Cada hermano tiene su cuenta, ve su asignación y envía su informe.'),
        radio('encargados', 'Solo los encargados', 'Los publicadores pueden ver el programa, pero los informes los registra el secretario.')),
      h('label', { class: 'row', style: { flexWrap: 'nowrap', alignItems: 'flex-start', gap: '8px', color: 'var(--text)', fontSize: '14px' } },
        h('input', { type: 'checkbox', checked: soloServicio() || null, style: { marginTop: '3px' }, onchange: e =>
          update({ soloServicio: e.target.checked }, e.target.checked ? 'Ahora solo Servicio y el coordinador hacen esos cambios' : 'Ahora también pueden los demás encargados') }),
        h('span', null, h('strong', null, 'Solo Servicio cambia grupos, predicación y territorios'),
          h('div', { class: 'muted small-text' }, 'Salidas, predicación pública, territorios y grupos: los cambian Servicio y el coordinador; los demás solo los ven. Si lo desactivas, también pueden el secretario (grupos), los ancianos (salidas y turnos) y la función Territorios (territorios).'))))];
}

function renderPubSettings() {
  const version = h('div');
  if (location.protocol === 'app:') fetch('/version').then(r => r.text()).then(v => { version.textContent = 'Versión ' + v; }).catch(() => {});
  else version.textContent = `Versión ${APP_VERSION} (${NATIVE ? 'Android' : 'web'})`;
  const item = (label, value) => h('div', { class: 'field' }, h('span', null, label), h('div', { style: { color: 'var(--text)', fontSize: '15px' } }, value));
  const roles = PERMS.filter(([k]) => can(k)).map(([, label]) => label);
  return h('div', null,
    h('h1', null, 'Ajustes'),
    h('p', { class: 'sub' }, 'Estos datos los administra tu congregación.'),
    h('div', { class: 'card settings' },
      item('Congregación', congName() || '—'),
      item('Tu nombre', nube.me.nombre),
      item('Correo', nube.user.email),
      roles.length ? item('Tus funciones', roles.join(', ')) : null,
      item('Aplicación', version),
      h('div', { class: 'row' }, signOutBtn()), accountExtras()));
}
