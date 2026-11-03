// Programas · Menú, editor de la semana, hermanos, familias, ajustes y arranque de la app.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- usuarios (solo admins) ----------
// Coordinador, arriba de la lista de Hermanos: código, cuentas por aprobar y cuentas que no están
// unidas a ningún hermano. Las funciones de las demás cuentas se cambian en el diálogo de cada hermano.
function accountsPanel() {
  const ms = [...nube.miembros].sort(byNombre);
  const pending = ms.filter(m => m.estado !== 'activo');
  const loose = ms.filter(m => m.estado === 'activo' && (!m.perfil || !profById(m.perfil)));
  const profiles = [...state.profiles].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const linked = new Map(ms.filter(m => m.estado === 'activo' && m.perfil).map(m => [m.perfil, m]));
  const profileSelect = (m, value, onchange) => h('select', { onchange: e => onchange(e.target.value || null) },
    h('option', { value: '' }, '— Sin hermano —'),
    profiles.map(p => {
      const other = linked.get(p.id);
      return h('option', { value: p.id, selected: p.id === value ? true : null }, p.name + (other && other.id !== m.id ? ` (cuenta de ${other.nombre})` : ''));
    }));

  const pendingRow = m => {
    let perfil = (profByName(m.nombre) || {}).id || null;
    const sel = profileSelect(m, perfil, v => { perfil = v; });
    return h('div', { class: 'urow' },
      h('div', { class: 'info' }, h('strong', null, m.nombre), h('div', { class: 'muted small-text' }, m.email)),
      h('label', { class: 'field' }, 'Es el hermano', sel),
      h('button', { class: 'btn small', onclick: () => openProfileDialog(null, { name: m.nombre, onSave: p => { perfil = p.id; render(); } }) }, '+ Nuevo hermano'),
      h('button', { class: 'btn small primary', onclick: () => memberUpdate(m, { estado: 'activo', perfil }, `${m.nombre} ya puede entrar`) }, 'Aprobar'),
      h('button', { class: 'btn small danger', onclick: async () => {
        if (!confirm(`¿Rechazar la solicitud de ${m.nombre}?`)) return;
        try { await F.deleteDoc(congRef('miembros', m.id)); } catch (e) { toast(errMsg(e)); }
      } }, 'Rechazar'));
  };

  const looseRow = m => h('div', { class: 'urow' },
    h('div', { class: 'info' }, h('strong', null, m.nombre, m.id === nube.user.uid ? ' (tú)' : ''), h('div', { class: 'muted small-text' }, m.email)),
    h('label', { class: 'field' }, 'Es el hermano', profileSelect(m, null, v => memberUpdate(m, { perfil: v }, 'Cuenta unida al hermano'))),
    h('div', { class: 'field' }, h('span', null, 'Funciones'), memberFunctions(m)),
    m.id === nube.user.uid ? null : h('button', { class: 'btn small danger', onclick: async () => {
      if (!confirm(`¿Quitar a ${m.nombre} de la congregación? Ya no podrá entrar.`)) return;
      try { await F.deleteDoc(congRef('miembros', m.id)); toast('Se quitó la cuenta'); } catch (e) { toast(errMsg(e)); }
    } }, 'Quitar'));

  const code = (nube.congData && nube.congData.codigo) || '';
  return h('div', null,
    h('div', { class: 'card', style: { padding: '14px', marginBottom: '14px' } },
      h('div', { class: 'row spread' },
        h('div', null, h('div', { class: 'muted small-text' }, 'Código para crear cuenta'), h('div', { class: 'code' }, code || '—')),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: () => navigator.clipboard.writeText(code).then(() => toast('Código copiado')) }, 'Copiar'),
          h('button', { class: 'btn small', onclick: changeCode }, 'Cambiar código'))),
      h('p', { class: 'muted small-text', style: { margin: '8px 0 0' } }, 'Compártelo solo con hermanos de la congregación. Aunque alguien lo tenga, no entra hasta que el coordinador lo apruebe. Las funciones de cada cuenta se cambian tocando al hermano en la lista.')),
    pending.length ? [h('h2', { class: 'group' }, `Cuentas esperando aprobación (${pending.length})`),
      h('div', { class: 'card', style: { padding: '4px 14px', marginBottom: '14px' } }, pending.map(pendingRow))] : null,
    loose.length ? [h('h2', { class: 'group' }, `Cuentas sin hermano (${loose.length})`),
      h('div', { class: 'card', style: { padding: '4px 14px', marginBottom: '14px' } }, loose.map(looseRow))] : null);
}

// ---------- vistas ----------
function go(v) { view = v; render(); window.scrollTo(0, 0); }

// Cada quien ve solo las secciones de sus funciones
// Secciones del menú: [vista, nombre, aviso con número]. Cada quien ve solo las de sus funciones.
function navItems(all = false) {
  if (!FB_CONFIG) return [['list', 'Semanas'], ['mecanicas', 'Mecánicas'], ['people', 'Hermanos'], ['families', 'Familias'], ['settings', 'Ajustes']];
  if (!nube.acceso) return [];
  const items = [['inicio', 'Inicio'], ['list', 'Semanas']];
  // Hermanos: perfiles y, para el coordinador, cuentas por aprobar y funciones (antes "Usuarios")
  if (can('programa')) items.push(['mecanicas', 'Mecánicas']);
  // Fin de semana: lo ven todos los ancianos; lo cambia Programa VyM
  if (isElder()) items.push(['finsemana', 'Fin de semana']);
  // Hermanos incluye el directorio: lo ven todos los ancianos (cualquier función)
  if (isElder()) items.push(['people', 'Hermanos', isAdmin() ? nube.miembros.filter(m => m.estado !== 'activo').length : 0]);
  if (can('programa')) items.push(['families', 'Familias']);
  if (isElder()) items.push(['grupos', 'Grupos'], ['pastoreo', 'Pastoreo'], ['asistencia', 'Asistencia'], ['estadisticas', 'Estadísticas'], ['historial', 'Historial']);
  if (isElder()) items.push(['pantalla', 'Pantalla del Salón']);
  if (can('secretario')) items.push(['report', 'Informes']);
  else if (reportsByMembers()) items.push(['report', 'Informe']);
  items.push(['anuncios', 'Anuncios', unreadAnnouncements()], ['calendario', 'Calendario'], ['arreglos', 'Arreglos']);
  if (can('cuentas')) items.push(['cuentas', 'Cuentas']);
  items.push(['territorios', 'Territorios']);
  items.push(['settings', 'Ajustes']);
  return all ? items : customNav(items);
}
const isActiveView = v => view.name === v || (view.name === 'edit' && v === 'list');
const badge = n => n ? h('span', { class: 'nbadge' }, n) : null;
// Arriba en la PC; en el celular, barra de abajo con las principales y "Más" para el resto
function buildNav(items = navItems()) {
  fitTopNav(items);
  const order = ['inicio', 'list', 'report', 'anuncios', 'territorios'];
  const main = items.length <= 5 ? items : myView() && (myView().nav || []).length ? items.slice(0, 4)
    : order.map(v => items.find(i => i[0] === v)).filter(Boolean).slice(0, 4);
  const rest = items.filter(i => !main.includes(i));
  const tab = ([v, t, n], onclick, active) => h('button', { class: active ? 'active' : null, onclick }, icon(v, 22), t, badge(n));
  document.querySelector('.tabbar').replaceChildren(...[
    ...main.map(i => tab(i, () => go({ name: i[0] }), isActiveView(i[0]))),
    rest.length ? tab(['mas', 'Más', rest.reduce((a, i) => a + (i[2] || 0), 0)], () => openMoreSheet(rest), rest.some(i => isActiveView(i[0]))) : null,
  ].filter(Boolean));
  const name = FB_CONFIG && nube.listo ? congName() : '';
  setBrand(name || 'Programas');
  // Lupa de búsqueda rápida (también con Ctrl+K)
  const sb = document.querySelector('.search-btn');
  if (sb) { sb.hidden = !items.length; if (!sb.childElementCount) { sb.append(icon('search', 19)); sb.onclick = openSearch; } }
  // Píldora que se desliza a la sección activa; el ícono da un saltito solo al cambiar de sección
  const changed = buildNav.last !== view.name; buildNav.last = view.name;
  const top = document.querySelector('header nav'), bottom = document.querySelector('.tabbar');
  slideInk(top, top.querySelector(':scope > button.active'));
  slideInk(bottom, bottom.querySelector('button.active'), '.ic');
  if (changed) document.querySelectorAll('header nav > button.active, .tabbar button.active').forEach(b => b.classList.add('pop'));
}
// Las barras se vuelven a armar en cada render: la píldora parte de donde estaba (bar._ink) y se anima a la nueva
function slideInk(bar, target, inner) {
  const ink = h('span', { class: 'nav-ink', 'aria-hidden': 'true' });
  bar.append(ink);
  const el = target && (inner ? target.querySelector(inner) : target);
  if (!el || !el.offsetWidth) { ink.style.opacity = '0'; bar._ink = null; return; }
  const b = bar.getBoundingClientRect(), r = el.getBoundingClientRect();
  const to = { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
  const put = p => Object.assign(ink.style, { transform: `translate(${p.x}px, ${p.y}px)`, width: p.w + 'px', height: p.h + 'px' });
  ink.style.transition = 'none'; put(bar._ink || to); void ink.offsetWidth;
  ink.style.transition = ''; put(to);
  bar._ink = to;
}
// Arriba (PC y tableta) van las secciones que caben; las demás, en "Más ▾". Se vuelve a acomodar
// al cambiar el tamaño de la ventana.
function fitTopNav(items) {
  const nav = document.querySelector('header nav');
  const btn = ([v, t, n]) => h('button', { class: isActiveView(v) ? 'active' : null, onclick: () => go({ name: v }) }, icon(v, 18), t, badge(n));
  const shown = items.map(i => ({ i, el: btn(i) }));
  nav.replaceChildren(...shown.map(x => x.el));
  // Lo que miden los botones juntos (con la barra a la derecha, lo que no cabe se sale por la izquierda)
  const tooWide = () => [...nav.children].reduce((a, c) => a + c.offsetWidth + 2, 0) > nav.clientWidth;
  if (!nav.offsetParent || !tooWide()) return; // cabe todo (o es el celular)
  const hidden = [];
  const more = h('button', { class: 'nav-more' });
  nav.append(more);
  const paint = () => more.replaceChildren(...[icon('mas', 18), 'Más', badge(hidden.reduce((a, x) => a + (x.i[2] || 0), 0)), ' ▾'].filter(Boolean));
  paint();
  // Se quitan desde el final, pero la sección abierta se queda a la vista
  while (tooWide() && shown.length > 1) {
    let k = shown.length - 1;
    if (isActiveView(shown[k].i[0]) && k > 0) k--;
    const [x] = shown.splice(k, 1);
    x.el.remove(); hidden.unshift(x); paint();
  }
  more.classList.toggle('active', hidden.some(x => isActiveView(x.i[0])));
  more.onclick = e => { e.stopPropagation(); openNavMenu(more, hidden.map(x => x.i)); };
}
function openNavMenu(anchor, items) {
  const old = document.querySelector('.nav-menu');
  if (old) return old.remove();
  const box = anchor.getBoundingClientRect();
  const menu = h('div', { class: 'nav-menu', style: { top: (box.bottom + 6) + 'px', right: Math.max(8, innerWidth - box.right) + 'px' } },
    items.map(([v, t, n]) => h('button', { class: isActiveView(v) ? 'active' : null, onclick: () => { menu.remove(); go({ name: v }); } }, icon(v, 18), t, badge(n))));
  document.body.append(menu);
  setTimeout(() => document.addEventListener('click', function off(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', off); } }));
}
let navResize = null;
addEventListener('resize', () => { clearTimeout(navResize); navResize = setTimeout(() => { if (document.querySelector('header nav').childElementCount) buildNav(); }, 150); });

function openMoreSheet(items) {
  const close = () => { dlg.close(); dlg.remove(); };
  // Cuadrícula de íconos, como el menú de apps del celular; aparecen uno tras otro
  const dlg = h('dialog', { class: 'sheet more-sheet', onclick: e => { if (e.target === dlg) close(); } },
    h('div', { class: 'grab' }),
    h('div', { class: 'more-title' }, 'Más secciones'),
    h('div', { class: 'more-grid' }, items.map(([v, t, n], k) => h('button', { class: 'more-item' + (isActiveView(v) ? ' active' : ''),
      style: { '--d': (k * 25) + 'ms' }, onclick: () => { close(); go({ name: v }); } },
      h('span', { class: 'more-ic' }, icon(v, 24), badge(n)), h('span', { class: 'more-t' }, t)))));
  document.body.append(dlg); dlg.showModal();
}

function render() {
  if (FB_CONFIG && !(nube.acceso && nube.listo)) return; // las pantallas de acceso se dibujan aparte
  stopViewSubs();
  if (view.name !== 'inicio') homeEdit = null; // salir de Inicio cancela su modo de edición
  const items = navItems();
  if (!navItems(true).some(([v]) => isActiveView(v))) view = { name: items[0][0] };
  buildNav(items);
  const app = document.getElementById('app');
  // Entrada suave solo al cambiar de sección (no cada vez que llegan cambios de otros)
  if (render.last !== view.name) { render.last = view.name; app.classList.remove('page-in'); void app.offsetWidth; app.classList.add('page-in'); }
  const program = !FB_CONFIG || can('programa');
  if (view.name === 'inicio') return app.replaceChildren(renderHome());
  if (view.name === 'report') return app.replaceChildren(renderReport());
  if (view.name === 'grupos') return app.replaceChildren(renderGroups());
  if (view.name === 'asistencia') return app.replaceChildren(renderAttendance());
  if (view.name === 'calendario') return app.replaceChildren(renderCalendar());
  if (view.name === 'arreglos') return app.replaceChildren(renderArrangements());
  if (view.name === 'pastoreo') return app.replaceChildren(renderShepherding());
  if (view.name === 'estadisticas') return app.replaceChildren(renderStats());
  if (view.name === 'pantalla') return app.replaceChildren(renderKioskPage());
  if (view.name === 'historial') return app.replaceChildren(renderHistory());
  if (view.name === 'finsemana') return app.replaceChildren(renderWeekend());
  if (view.name === 'anuncios') { app.replaceChildren(renderAnnouncements()); return buildNav(); }
  if (view.name === 'cuentas') return app.replaceChildren(renderAccounts());
  if (view.name === 'territorios') return app.replaceChildren(renderTerritories());
  if (view.name === 'mecanicas') return app.replaceChildren(renderMecanicas());
  if (view.name === 'settings') return app.replaceChildren(program ? renderSettings() : renderPubSettings());
  if (view.name === 'people') { refreshDatalist(); return app.replaceChildren(renderPeople()); }
  if (!program) return app.replaceChildren(renderPubList());
  refreshDatalist();
  const p = view.name === 'edit' && state.programs.find(x => x.id === view.id);
  app.replaceChildren(
    p ? renderEditor(p) : view.name === 'people' ? renderPeople() : view.name === 'families' ? renderFamilies() : renderList());
}

function renderList() {
  const thisMonday = mondayOf(todayISO());
  const all = sortedPrograms();
  const upcoming = all.filter(p => p.date >= thisMonday).reverse();
  const past = all.filter(p => p.date < thisMonday);
  const selected = new Set();
  const pdfBtn = h('button', { class: 'btn', disabled: true, onclick: () => downloadPDF(state.programs.filter(p => selected.has(p.id))) }, '⬇ PDF de seleccionadas');
  const dateI = h('input', { type: 'date', value: todayISO() });

  const card = p => {
    const slots = slotsOf(p), filled = slots.filter(x => x.pid).length;
    return h('div', { class: 'card pitem' },
      h('input', { type: 'checkbox', title: 'Seleccionar para PDF', onchange: e => {
        e.target.checked ? selected.add(p.id) : selected.delete(p.id);
        pdfBtn.disabled = !selected.size;
        pdfBtn.textContent = selected.size ? `⬇ PDF de ${selected.size} semana${selected.size > 1 ? 's' : ''}` : '⬇ PDF de seleccionadas';
      } }),
      h('div', { class: 'info', onclick: () => go({ name: 'edit', id: p.id }) },
        h('div', { class: 't' }, p.title, p.date === thisMonday ? h('span', { class: 'progress', style: { marginLeft: '8px' } }, 'Esta semana') : null),
        h('div', { class: 'd' }, [fmtMeeting(p), p.reading].filter(Boolean).join(' · ')),
        weekEvents(p).length ? h('div', { class: 'row', style: { gap: '4px', marginTop: '4px' } }, weekEvents(p).map(eventChip)) : null),
      h('span', { class: 'progress' + (filled === slots.length && slots.length ? ' done' : '') }, `${filled}/${slots.length} asignaciones`),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => go({ name: 'edit', id: p.id }) }, 'Abrir'),
        h('button', { class: 'btn small', onclick: () => downloadPDF([p]) }, 'Programa PDF'),
        h('button', { class: 'btn small', onclick: () => openSlipsDialog(p) }, 'Hojas de asignación')));
  };

  return h('div', null,
    h('div', { class: 'row spread', style: { marginBottom: '14px' } },
      h('div', null, h('h1', null, 'Semanas'), h('p', { class: 'sub', style: { margin: 0 } }, 'Programas de la reunión con sus asignaciones.')),
      h('div', { class: 'row' }, monthDownload(state.programs, downloadPDF), pdfBtn)),
    FB_CONFIG && nube.me.perfil ? nextAssignmentCard(publicWeeks()) : null,
    location.protocol === 'file:' ? h('div', { class: 'notice warn' },
      'Abriste la app directamente. Para que busque las guías en jw.org, ciérrala y ábrela con el archivo “Programas.bat”.') : null,
    h('div', { class: 'card sync' },
      h('div', { class: 'row spread' },
        h('div', null,
          h('strong', null, 'Guías de actividades de jw.org'),
          h('div', { id: 'sync-text', class: syncMsg.warn ? 'notice warn' : 'muted small-text', style: syncMsg.warn ? { margin: '6px 0 0' } : null },
            syncMsg.text || (state.lastSync ? `Última revisión: ${new Date(state.lastSync).toLocaleString('es')}` : 'Aún no se ha revisado.'))),
        h('button', { class: 'btn primary', onclick: () => syncGuides(true) }, '↻ Buscar semanas nuevas')),
      h('div', { class: 'row', style: { marginTop: '10px' } },
        h('span', { class: 'muted small-text' }, 'Agregar otra semana (por ejemplo, una pasada):'),
        dateI,
        h('button', { class: 'btn small', onclick: () => dateI.value && addWeek(dateI.value) }, '+ Agregar'))),
    h('h2', { class: 'group' }, 'Próximas semanas'),
    upcoming.length ? h('div', { class: 'plist' }, upcoming.map(card))
      : h('div', { class: 'card empty' }, 'No hay semanas próximas. Pulsa “Buscar semanas nuevas”.'),
    past.length ? [h('h2', { class: 'group' }, 'Semanas anteriores'), h('div', { class: 'plist' }, past.map(card))] : null);
}

function renderEditor(p) {
  let focus = null;              // { rowId, slot }
  let sexFilter = 'all';
  let privOnly = true;           // sugerir solo a quien tiene el privilegio de la asignación
  let editing = false;
  const privToggle = h('div');
  const s = state.settings;
  const body = h('div');
  const metaBox = h('div');
  const toolbar = h('div', { class: 'row' });
  const suggList = h('div', { class: 'sugg' });
  const suggFor = h('p');
  const suggFilter = h('input', { type: 'search', placeholder: 'Buscar hermano…', oninput: () => updateSide() });
  const chips = h('div', { class: 'chips' }), nomBox = h('div');
  const totalEl = h('span', { class: 'total' });
  const heading = h('div', { class: 'ph2' });
  const rebuild = () => { save(); build(); };
  let suggesting = false, proposals = new Map();
  const skips = new Map();
  const suggestBar = h('div');

  // Botón "Sugerencias": propone a alguien para cada asignación vacía (sin asignarlo).
  // "Otra" pasa a la siguiente opción de esa asignación.
  function computeProposals(ctx) {
    proposals = new Map();
    const reserved = new Set([...slotsOf(p).map(x => x.pid).filter(Boolean), ...mecIds(p, 'entre')]);
    for (const x of slotsOf(p)) {
      if (x.pid) continue;
      const key = x.row.id + '|' + x.slot;
      const mate = mateSlot(x.slot), other = x.row[mate] || (/b$/.test(x.slot) ? (proposals.get(x.row.id + '|' + mate) || {}).pr?.id : undefined);
      const list = candidatesFor(p, x.row, x.slot, ctx, reserved, other);
      const c = list.length ? list[(skips.get(key) || 0) % list.length] : null;
      proposals.set(key, c);
      if (c) reserved.add(c.pr.id);
    }
  }
  function applyProposal(row, slot) {
    const c = proposals.get(row.id + '|' + slot);
    if (c) assign(row, slot, c.pr.id);
  }

  function updateHints() {
    const ctx = contextFor(p);
    const counts = countsFor(p);
    if (suggesting) computeProposals(ctx);
    body.querySelectorAll('input[data-slot]').forEach(inp => {
      const row = p.rows.find(r => r.id === inp.dataset.row), slot = inp.dataset.slot;
      const hint = inp.nextElementSibling, line = hint.nextElementSibling;
      inp.classList.remove('s-dup', 's-recent', 's-warn');
      const pid = row[slot];
      const c = suggesting && !pid ? proposals.get(row.id + '|' + slot) : undefined;
      line.replaceChildren(c === undefined ? '' : c ? h('div', { class: 'propose' },
        h('span', null, '✨ ', h('strong', null, c.pr.name),
          h('span', { class: 'muted' }, [c.pr.age != null ? ` · ${c.pr.age} años` : '', c.days === Infinity ? ' · nunca' : ` · hace ${c.days} d`].join('')),
          c.rule ? h('span', { class: 'tag-fam', style: c.fits ? null : { color: 'var(--orange)' }, title: c.fits ? 'Cumple el filtro' : 'Nadie disponible cumple el filtro' },
            (c.fits ? '✓ ' : '≈ ') + c.rule.nombre) : null),
        h('span', { class: 'row', style: { gap: '4px' } },
          h('button', { class: 'btn small primary', onclick: () => applyProposal(row, slot) }, 'Aplicar'),
          h('button', { class: 'btn small', onclick: () => { const k = row.id + '|' + slot; skips.set(k, (skips.get(k) || 0) + 1); updateHints(); } }, 'Otra')))
        : h('div', { class: 'propose muted' }, '✨ Nadie disponible para sugerir'));
      if (!pid) { hint.textContent = ''; hint.className = 'hint'; return; }
      const st = statusFor(pid, p, ctx, counts, row, slot);
      hint.textContent = [st.text, confirmedOn(pid, `${p.id}|${row.id}|${slot}`) ? '✔ confirmó' : ''].filter(Boolean).join(' · '); hint.className = 'hint ' + st.cls;
      if (['s-dup', 's-recent', 's-warn'].includes(st.cls)) inp.classList.add(st.cls);
    });
    const slots = slotsOf(p);
    const conf = FB_CONFIG ? slots.filter(x => x.pid && confirmedOn(x.pid, `${p.id}|${x.row.id}|${x.slot}`)).length : 0;
    totalEl.textContent = `${slots.filter(x => x.pid).length} de ${slots.length} asignaciones${conf ? ` · ${conf} confirmaron` : ''} · termina aprox. a las ${fmtTime(timesFor(p).end)}`;
    const n = [...proposals.values()].filter(Boolean).length, none = proposals.size - n;
    suggestBar.replaceChildren(suggesting ? h('div', { class: 'notice row spread', style: { background: 'var(--accent-2)', color: 'var(--text)', margin: '10px 0 0' } },
      h('span', null, n ? `✨ ${n} sugerencia${n > 1 ? 's' : ''}: según privilegios, filtros de edad, descanso de ${s.restDays} días y quien lleva más tiempo sin participar.`
        + (none ? ` Para ${none} no hay nadie disponible.` : '')
        : none ? `✨ Quedan ${none} vacía${none > 1 ? 's' : ''}, pero no hay nadie disponible que no esté asignado esta semana o descansando.`
          : '✨ Ya no hay asignaciones vacías.'),
      h('span', { class: 'row' },
        n ? h('button', { class: 'btn small primary', onclick: () => {
          for (const [key, c] of proposals) if (c) { const [rid, slot] = key.split('|'); p.rows.find(r => r.id === rid)[slot] = c.pr.id; }
          save(); build(); toast(`Se aplicaron ${n} sugerencias`);
        } }, `Aplicar todas (${n})`) : null,
        h('button', { class: 'btn small', onclick: () => { suggesting = false; proposals = new Map(); build(); } }, 'Ocultar'))) : '');
    updateSide(ctx);
  }

  // Sugerencias para la asignación seleccionada: primero quien puede hacerla y lleva más
  // tiempo sin participar; abajo, aparte, quien está "descansando" (regla de los 28 días).
  function updateSide(ctx = contextFor(p)) {
    const used = new Set([...slotsOf(p).map(x => x.pid).filter(Boolean), ...mecIds(p, 'entre')]);
    const f = norm(suggFilter.value);
    chips.replaceChildren(...[['all', 'Todos'], ['M', 'Hombres'], ['F', 'Mujeres']].map(([v, t]) =>
      h('button', { class: sexFilter === v ? 'on' : '', onclick: () => { sexFilter = v; updateSide(); } }, t)));
    nomBox.replaceChildren(nomChips(() => { updateSide(); if (pick) fillPick(); }));
    const fr = focus && p.rows.find(r => r.id === focus.rowId);
    const priv = fr ? privFor(fr, focus.slot) : null;
    privToggle.replaceChildren(priv ? h('label', { class: 'row small-text muted', style: { gap: '6px', margin: '0 0 8px' } },
      h('input', { type: 'checkbox', checked: privOnly, onchange: e => { privOnly = e.target.checked; updateSide(); } }),
      `Solo quien tiene “${privLabel(priv)}”`) : '');
    // En una pareja de estudiantes, los familiares de la otra persona salen primero;
    // luego quien cumple el filtro de la parte (por ejemplo, edad escolar si habla de la escuela)
    const partner = fr && fr.helper === 'Ayudante' ? fr[mateSlot(focus.slot)] : null;
    const rule = fr ? ruleFor(fr) : null;
    const items = state.profiles
      .filter(pr => !used.has(pr.id) && (!f || norm(pr.name).includes(f)))
      .map(pr => {
        const l = ctx.last.get(pr.id);
        return { pr, fam: !!partner && sameFamily(partner, pr.id), days: l ? daysBetween(l.q.date, p.date) : Infinity,
          rest: ctx.recent.get(pr.id), able: !priv || canDo(pr, priv), fits: !!rule && fitsRule(pr, rule), pref: !!priv && prefersMe(pr, priv), away: awayOn(pr.id, meetingDate(p)) };
      })
      .filter(it => (it.fam || sexFilter === 'all' || it.pr.sex === sexFilter) && (!privOnly || it.able) && nomOk(it.pr))
      .sort((a, b) => b.fam - a.fam || b.able - a.able || b.fits - a.fits || b.pref - a.pref || b.days - a.days || a.pr.name.localeCompare(b.pr.name, 'es'));
    const item = it => h('button', { onclick: () => insertProfile(it.pr), title: it.rest ? restText(it.rest, p).slice(2) : null },
      h('span', { class: 'nm' }, it.pr.name, ' ', h('small', null, `${it.pr.sex === 'M' ? '♂' : '♀'}${it.pr.age != null ? ' ' + it.pr.age : ''}`),
        it.fam ? h('span', { class: 'tag-fam' }, 'Familia') : null,
        it.fits ? h('span', { class: 'tag-fam', title: 'Cumple el filtro de esta parte' }, '✓ ' + rule.nombre) : null,
        it.able ? null : h('span', { class: 'tag-fam', style: { color: 'var(--orange)' } }, 'Sin privilegio'),
        it.away ? h('span', { class: 'tag-fam', style: { color: 'var(--orange)' } }, awayText(it.away)) : null),
      h('span', { class: 'hint ' + (it.rest ? 's-recent' : it.days === Infinity || it.days >= s.staleDays ? 's-stale' : 's-ok') },
        it.days === Infinity ? 'nunca' : `hace ${it.days} d`));
    const away = items.filter(it => it.away);
    let ready = items.filter(it => !it.rest && !it.away), resting = items.filter(it => it.rest && !it.away);
    // Seamos mejores maestros: 2 hermanas por cada hermano (familiares, con privilegio y filtro siguen primero)
    if (fr && womenFirst(fr, focus.slot, partner) && sexFilter === 'all') {
      const key = it => `${+it.fam}${+it.able}${+it.fits}`;
      const groups = [...new Set(ready.map(key))];
      ready = groups.flatMap(g => preferWomen(ready.filter(it => key(it) === g)));
    }
    const unset = state.profiles.filter(pr => !Array.isArray(pr.puede)).length;
    suggList.replaceChildren(...(items.length ? [
      ...ready.map(item),
      resting.length ? h('div', { class: 'small-text muted', style: { padding: '8px 8px 2px', borderTop: ready.length ? '1px solid var(--border)' : null } },
        `Descansando (menos de ${s.restDays} días)`) : null,
      ...resting.map(it => { const b = item(it); b.style.opacity = '.6'; return b; }),
      away.length ? h('div', { class: 'small-text muted', style: { padding: '8px 8px 2px', borderTop: '1px solid var(--border)' } }, 'Ausentes') : null,
      ...away.map(it => { const b = item(it); b.style.opacity = '.5'; return b; }),
      priv && unset ? h('div', { class: 'small-text muted', style: { padding: '8px' } },
        `${unset} perfil${unset > 1 ? 'es' : ''} sin privilegios marcados sale${unset > 1 ? 'n' : ''} para todo. Márcalos en Hermanos.`) : null,
    ].filter(Boolean)
      : [h('p', null, state.profiles.length ? 'Nadie disponible con estos filtros.' : 'Aún no hay hermanos. Agrégalos en la pestaña “Hermanos” o escribiendo un nombre nuevo en el programa.')]));
  }

  function setFocus(row, slot) {
    focus = { rowId: row.id, slot };
    const partner = row.helper === 'Ayudante' && profById(row[mateSlot(slot)]);
    sexFilter = slotNeedsMen(row, slot) ? 'M' : partner ? partner.sex : 'all';
    const lb = slotLabels(row);
    const rule = ruleFor(row);
    suggFor.textContent = `Para: ${isAux(slot) && row.kind === 'chair' ? 'Consejero de la sala auxiliar' : baseSlot(slot) === 'b' ? lb.b : lb.a && !lb.soft ? lb.a : displayTitle(row)}${isAux(slot) && row.kind !== 'chair' ? ' (sala auxiliar)' : ''}`
      + (rule ? ` · filtro “${rule.nombre}”${ruleText(rule) ? ` (${ruleText(rule)})` : ''}` : '');
    privOnly = true;
    body.querySelectorAll('input.focused').forEach(i => i.classList.remove('focused'));
    const inp = body.querySelector(`input[data-row="${row.id}"][data-slot="${slot}"]`);
    if (inp) inp.classList.add('focused');
    updateSide();
  }

  function assign(row, slot, pid) {
    row[slot] = pid; save();
    const inp = body.querySelector(`input[data-row="${row.id}"][data-slot="${slot}"]`);
    if (inp) inp.value = pid ? profById(pid).name : '';
    updateHints();
  }

  function insertProfile(prof) {
    const fr = focus && p.rows.find(r => r.id === focus.rowId);
    let target = fr && { row: fr, slot: focus.slot };
    if (!target || target.row[target.slot]) target = slotsOf(p).find(x => !x.pid);
    if (!target) return toast('Todas las asignaciones ya están cubiertas');
    assign(target.row, target.slot, prof.id);
    // Sigue con la siguiente vacía hacia abajo; si ya no hay, la primera vacía
    const all = slotsOf(p), at = all.findIndex(x => x.row === target.row && x.slot === target.slot);
    const next = all.slice(at + 1).find(x => !x.pid) || all.find(x => !x.pid);
    if (next) setFocus(next.row, next.slot);
  }

  // Lista desplegable al tocar un espacio: primero los más recomendados (mismos criterios que
  // el botón Sugerencias); al escribir, busca entre todos y dice por qué no se recomienda a otros.
  let pick = null; // { el, inp, row, slot, items, at }
  function closePick() { if (pick) { pick.el.remove(); pick = null; } }
  function openPick(row, slot, inp) {
    closePick();
    pick = { el: h('div', { class: 'pick', role: 'listbox' }), inp, row, slot, items: [], at: 0 };
    pick.el.style.top = (inp.offsetTop + inp.offsetHeight + 4) + 'px'; // justo debajo del campo
    // Al menos 260 px de ancho, pero sin salirse de la pantalla (en el celular la columna es angosta)
    const box = inp.parentNode.getBoundingClientRect(), width = Math.min(Math.max(box.width, 260), innerWidth - 16);
    const over = box.left + width - (innerWidth - 8);
    Object.assign(pick.el.style, { width: width + 'px', right: 'auto', left: (over > 0 ? -over : 0) + 'px' });
    inp.parentNode.append(pick.el);
    fillPick();
    roomForPick(inp);
  }
  // Busca por el inicio de cada palabra del nombre: "ana" encuentra "Ana María", no "Hermana"
  const nameMatch = (name, typed) => (' ' + norm(name)).includes(' ' + typed);
  function fillPick() {
    const { row, slot, inp } = pick;
    const ctx = contextFor(p), counts = new Set([...slotsOf(p).filter(x => x.pid && !(x.row === row && x.slot === slot)).map(x => x.pid), ...mecIds(p, 'entre')]);
    const current = row[slot], typed = current && profById(current) && profById(current).name === inp.value ? '' : norm(inp.value);
    const partner = row[mateSlot(slot)];
    const best = candidatesFor(p, row, slot, ctx, counts, partner).filter(c => c.pr.id !== current);
    const priv = privFor(row, slot), rule = ruleFor(row), men = slotNeedsMen(row, slot);
    let items;
    if (!typed) items = best.filter(c => nomOk(c.pr)).slice(0, 8).map(c => ({ ...c, why: '' }));
    else {
      const shown = new Set();
      items = best.filter(c => nameMatch(c.pr.name, typed)).map(c => { shown.add(c.pr.id); return { ...c, why: '' }; });
      for (const pr of state.profiles) {
        if (shown.has(pr.id) || pr.id === current || !nameMatch(pr.name, typed)) continue;
        const l = ctx.last.get(pr.id);
        const why = counts.has(pr.id) ? 'Ya asignado esta semana' : awayOn(pr.id, meetingDate(p)) ? 'Ausente' : ctx.recent.has(pr.id) ? 'Descansando'
          : !canDo(pr, priv) ? 'Sin privilegio' : men && pr.sex === 'F' ? 'Normalmente un varón' : 'Pareja de distinto sexo';
        items.push({ pr, rule, fits: fitsRule(pr, rule), days: l ? daysBetween(l.q.date, p.date) : Infinity, why });
      }
      items = items.slice(0, 30);
    }
    pick.items = items; pick.at = Math.min(pick.at, Math.max(items.length - 1, 0));
    pick.el.replaceChildren(
      h('div', { class: 'pick-head' }, typed ? 'Coincidencias' : `Recomendados${rule ? ` · filtro “${rule.nombre}”` : ''}`),
      typed ? null : nomChips(() => { fillPick(); updateSide(); }),
      ...(items.length ? items.map((it, i) => h('button', { class: 'pick-item' + (i === pick.at ? ' on' : '') + (it.why ? ' other' : ''),
        type: 'button', onmousedown: e => e.preventDefault(), onclick: () => choose(it.pr) },
        h('span', { class: 'nm' }, it.pr.name, ' ',
          h('small', null, `${it.pr.sex === 'M' ? '♂' : '♀'}${it.pr.age != null ? ' ' + it.pr.age : ''}`),
          it.rule && it.fits && !it.why ? h('span', { class: 'tag-fam' }, '✓ ' + it.rule.nombre) : null,
          it.pref && !it.why ? h('span', { class: 'tag-fam', style: { color: 'var(--accent)' } }, nomLabel(it.pr.nombramiento)) : null,
          it.why ? h('span', { class: 'tag-fam', style: { color: 'var(--orange)' } }, it.why) : null),
        h('span', { class: 'hint ' + (it.why ? 's-recent' : it.days === Infinity || it.days >= s.staleDays ? 's-stale' : 's-ok') },
          it.days === Infinity ? 'nunca' : `hace ${it.days} d`)))
        : [h('div', { class: 'pick-empty' }, typed ? 'Nadie con ese nombre. Al salir del campo se puede agregar el hermano.' : 'Nadie disponible. Escribe un nombre para buscar entre todos.')]));
  }
  function choose(pr) {
    const { row, slot, inp } = pick;
    closePick();
    inp.value = pr.name;
    assign(row, slot, pr.id);
    inp.blur();
  }
  function pickKeys(e) {
    if (!pick) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      pick.at = Math.max(0, Math.min(pick.items.length - 1, pick.at + (e.key === 'ArrowDown' ? 1 : -1)));
      fillPick();
      const on = pick.el.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && pick.items[pick.at]) {
      e.preventDefault(); choose(pick.items[pick.at].pr);
    } else if (e.key === 'Escape') closePick();
  }

  function slotNode(row, slot, label, soft) {
    const pid = row[slot];
    return h('div', { class: 'slot' },
      h('span', { class: 'slabel' + (soft ? ' soft' : '') }, label),
      h('div', { style: { position: 'relative' } },
        h('input', {
          type: 'text', autocomplete: 'off', value: pid && profById(pid) ? profById(pid).name : '',
          placeholder: 'Asignar…', 'data-row': row.id, 'data-slot': slot,
          onfocus: e => { setFocus(row, slot); openPick(row, slot, e.target); },
          onclick: e => { if (!pick) openPick(row, slot, e.target); },
          oninput: () => { if (pick) { pick.at = 0; fillPick(); } },
          onkeydown: pickKeys,
          onblur: () => setTimeout(() => { if (pick && document.activeElement !== pick.inp) closePick(); }, 150),
          onchange: e => {
            const val = squash(e.target.value);
            if (!val) return assign(row, slot, null);
            const prof = profByName(val);
            if (prof) return assign(row, slot, prof.id);
            openProfileDialog(null, { name: val, onSave: np => assign(row, slot, np.id), onCancel: () => assign(row, slot, row[slot]) });
          },
        }),
        h('div', { class: 'hint' }),
        h('div')));                // aquí sale la sugerencia del botón "Sugerencias"
  }

  function titleNode(row) {
    if (row.kind === 'prayer' || row.kind === 'song') {
      return h('div', { class: 'pt' }, `Canción ${row.song || '—'}`,
        h('span', { class: 'songname', 'data-song': row.song || '' }, row.song && state.songs[row.song] ? ' - ' + state.songs[row.song] : ''));
    }
    return [
      h('div', { class: 'pt' }, displayTitle(row), row.min ? h('span', { class: 'min' }, ` (${row.min} min.)`) : null),
      row.detail ? h('div', { class: 'detail', title: row.detail }, row.detail) : null,
    ];
  }

  function titleEditor(row) {
    if (row.kind === 'prayer' || row.kind === 'song') {
      return h('div', { class: 'edit-in' }, 'Canción n.º',
        h('input', { type: 'number', min: 1, value: row.song ?? '', onchange: e => {
          row.song = e.target.value === '' ? null : +e.target.value; rebuild(); ensureSongTitles([p]);
        } }));
    }
    return h('div', { class: 'edit-in' },
      h('input', { type: 'text', value: row.title, placeholder: 'Título de la intervención', oninput: e => { row.title = e.target.value; save(); } }),
      h('input', { type: 'number', min: 0, value: row.min ?? '', title: 'Minutos', onchange: e => { row.min = e.target.value === '' ? null : +e.target.value; rebuild(); } }),
      h('span', { class: 'muted small-text' }, 'min'));
  }

  function build() {
    closePick();
    const times = timesFor(p);
    const nodes = [];
    let sec = '';
    p.rows.forEach((row, i) => {
      if (row.section && row.section !== sec) {
        sec = row.section;
        const so = sectionOf(sec);
        nodes.push(h('div', { class: 'psec ' + secClass(sec), style: { '--sec': so ? so.css : 'var(--sec-none)' } }, h('i'), sec));
      }
      const so = sectionOf(row.section);
      const lb = slotLabels(row);
      nodes.push(h('div', { class: 'prow' },
        h('div', { class: 'ptime' }, fmtTime(times[row.id])),
        h('div', { class: 'pdot', style: { background: so ? so.css : 'var(--sec-none)' } }),
        h('div', { class: 'ptitle' }, editing ? titleEditor(row) : titleNode(row)),
        h('div', { class: 'pslots' },
          isAssignable(row) ? (auxOn(p) && hasAux(row)
            // Con sala auxiliar: principal y auxiliar, cada una con su etiqueta
            ? row.kind === 'chair' ? [slotNode(row, 'a', lb.a, lb.soft), slotNode(row, 'xa', 'Consejero sala aux.', false)]
              : [h('div', { class: 'room' }, 'Auditorio principal'), slotNode(row, 'a', lb.a, lb.soft), row.helper ? slotNode(row, 'b', lb.b, lb.soft) : null,
                h('div', { class: 'room' }, 'Sala auxiliar'), slotNode(row, 'xa', lb.a, lb.soft), row.helper ? slotNode(row, 'xb', lb.b, lb.soft) : null]
            : [slotNode(row, 'a', lb.a, lb.soft), row.helper ? slotNode(row, 'b', lb.b, lb.soft) : null]) : null),
        editing ? h('div', { class: 'pacts' },
          h('button', { class: 'btn icon small', title: 'Subir', disabled: i === 0,
            onclick: () => { [p.rows[i - 1], p.rows[i]] = [p.rows[i], p.rows[i - 1]]; rebuild(); } }, '↑'), ' ',
          h('button', { class: 'btn icon small', title: 'Bajar', disabled: i === p.rows.length - 1,
            onclick: () => { [p.rows[i + 1], p.rows[i]] = [p.rows[i], p.rows[i + 1]]; rebuild(); } }, '↓'), ' ',
          h('button', { class: 'btn icon small danger', title: 'Quitar', onclick: () => {
            if (confirm(`¿Quitar “${displayTitle(row)}”?`)) { p.rows.splice(i, 1); rebuild(); }
          } }, '×')) : h('div')));
    });
    body.replaceChildren(...nodes);
    heading.textContent = weekHeading(p, !['elegante', 'clasico'].includes(s.pdfDesign));
    metaBox.replaceChildren(editing ? h('div', { class: 'meta' },
      h('label', { class: 'field' }, 'Semana', h('input', { type: 'text', value: p.title, oninput: e => { p.title = e.target.value; save(); } })),
      h('label', { class: 'field' }, 'Lectura de la Biblia', h('input', { type: 'text', value: p.reading || '', oninput: e => { p.reading = e.target.value; save(); heading.textContent = weekHeading(p, !['elegante', 'clasico'].includes(s.pdfDesign)); } })),
      h('label', { class: 'field' }, 'Fecha de la reunión', h('input', { type: 'date', value: meetingDate(p), onchange: e => {
        if (!e.target.value) return;
        p.date = mondayOf(e.target.value); p.week = weekKey(p.date); rebuild();
      } }))) : '');
    toolbar.replaceChildren(...[
      editing ? h('button', { class: 'btn danger', onclick: () => {
        if (confirm(`¿Eliminar la semana “${p.title}”? Se perderán sus asignaciones.`)) { state.programs = state.programs.filter(x => x !== p); save(); go({ name: 'list' }); }
      } }, 'Eliminar semana') : null,
      editing ? null : h('button', { class: 'btn' + (suggesting ? ' primary' : ''), onclick: () => {
        suggesting = !suggesting; skips.clear(); build();
        if (suggesting) suggestBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } }, '✨ Sugerencias'),
      editing ? null : h('button', { class: 'btn' + (auxOn(p) ? ' primary' : ''), title: 'Activa o quita la sala auxiliar en esta semana', onclick: () => {
        if (auxOn(p) && slotsOf(p).some(x => isAux(x.slot) && x.pid) && !confirm('¿Quitar la sala auxiliar de esta semana? También se quitan los hermanos asignados en ella.')) return;
        p.aux = !auxOn(p);
        if (!p.aux) for (const r of p.rows) { delete r.xa; delete r.xb; }
        rebuild();
      } }, auxOn(p) ? 'Sala auxiliar: sí' : 'Sala auxiliar: no'),
      h('button', { class: 'btn', onclick: () => { editing = !editing; build(); } }, editing ? '✓ Listo' : '✎ Editar programa'),
      h('button', { class: 'btn', onclick: () => openSlipsDialog(p) }, '📄 Hojas de asignación'),
      h('button', { class: 'btn', onclick: () => openWhatsAppDialog(p) }, '💬 Avisar por WhatsApp'),
      FB_CONFIG && isElder() ? h('button', { class: 'btn', onclick: () => openWeekHistory(p) }, '🕓 Cambios') : null,
      h('button', { class: 'btn primary', onclick: () => downloadPDF([p]) }, '⬇ Programa PDF')].filter(Boolean));
    updateHints();
    if (focus) { const fr = p.rows.find(r => r.id === focus.rowId); if (fr && isAssignable(fr)) setFocus(fr, focus.slot); }
  }

  function addRow() {
    const sec = h('select', null, h('option', { value: '' }, '(sin sección)'), SECTIONS.map(x => h('option', { value: x.name }, x.name)));
    const title = h('input', { type: 'text', placeholder: 'Ej.: Necesidades de la congregación' });
    const min = h('input', { type: 'number', min: 0, value: 5, style: { width: '90px' } });
    const helper = h('select', null, h('option', { value: '' }, 'No'), h('option', { value: 'Ayudante' }, 'Ayudante'), h('option', { value: 'Lector' }, 'Lector'));
    const men = h('input', { type: 'checkbox' });
    const dlg = h('dialog', { class: 'dlg' },
      h('div', { class: 'dlg-body' }, h('h3', null, 'Agregar intervención'),
        h('label', { class: 'field' }, 'Título', title),
        h('div', { class: 'row', style: { gap: '16px' } },
          h('label', { class: 'field' }, 'Sección', sec), h('label', { class: 'field' }, 'Minutos', min), h('label', { class: 'field' }, '¿Con ayudante?', helper)),
        h('label', { class: 'row' }, men, 'La suele presentar un varón')),
      h('div', { class: 'dlg-foot' },
        h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancelar'),
        h('button', { class: 'btn primary', onclick: () => {
          const row = newRow('part', { section: sec.value, title: squash(title.value), min: min.value === '' ? null : +min.value, helper: helper.value || null, men: men.checked });
          // Al final de su sección; si no tiene sección, antes de las palabras de conclusión
          let at = -1;
          p.rows.forEach((r, i) => { if (row.section && r.section === row.section && r.kind === 'part') at = i; });
          if (at < 0) { const c = p.rows.findIndex(r => r.kind === 'chair' && !r.intro); at = c < 0 ? p.rows.length - 1 : c - 1; }
          p.rows.splice(at + 1, 0, row);
          dlg.close(); rebuild();
        } }, 'Agregar')));
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg); dlg.showModal(); title.focus();
  }

  queueMicrotask(() => {
    build();
    const first = slotsOf(p).find(x => !x.pid) || slotsOf(p)[0];
    if (first) setFocus(first.row, first.slot);
    ensureSongTitles([p]);
  });

  const side = h('aside', { class: 'card side' },
    h('h3', null, 'Sugerencias'),
    suggFor,
    chips, nomBox, privToggle, suggFilter, suggList,
    h('button', { class: 'btn small', style: { marginTop: '10px', width: '100%' }, onclick: () => openProfileDialog(null, { onSave: () => updateSide() }) }, '+ Nuevo hermano'));
  const grid = h('div', { class: 'editor' },
      h('div', { class: 'card sheet ' + themeClass() },
        h('div', { class: 'ph1' }, h('span', null, s.pdfTitle || 'Programa'), s.congregation ? h('span', null, s.congregation) : null),
        heading,
        awayWarning(p),
        weekEvents(p).length ? h('div', { class: 'ev-banner' }, weekEvents(p).map(e => h('div', { class: 'row spread' },
          h('span', null, eventChip(e), ' ', h('span', { class: 'small-text muted' }, fmtRange(e) + (e.notas ? ' · ' + e.notas : ''))),
          e.tipo === 'visita' ? h('button', { class: 'btn small', onclick: () => { if (adjustForVisit(p)) build(); } }, 'Ajustar el programa para la visita') : null))) : null,
        metaBox,
        suggestBar,
        body,
        h('div', { class: 'pfoot' },
          h('button', { class: 'btn small', onclick: addRow }, '+ Agregar intervención'), totalEl),
        h('div', { class: 'legend' },
          h('span', { class: 'hint s-recent' }, `↻ tiene otra asignación a menos de ${s.restDays} días`),
          h('span', { class: 'hint s-dup' }, '⚠ repetido en esta semana o revisar'),
          h('span', { class: 'hint s-stale' }, `★ ${s.staleDays}+ días sin participar o nunca`))),
      side);
  return h('div', null,
    h('div', { class: 'row spread', style: { marginBottom: '14px' } },
      h('button', { class: 'btn', onclick: () => go({ name: 'list' }) }, '← Semanas'),
      toolbar),
    grid);
}

// Los ancianos (cualquier función) ven la lista y el directorio; solo Programa VyM cambia los demás datos
const awayTag = pr => { const a = awayNow(pr.id); return a ? h('span', { class: 'tag-fam', style: { color: 'var(--orange)' }, title: a.nota || null }, awayText(a)) : null; };
function renderPeople() {
  const prog = !FB_CONFIG || can('programa'), elder = FB_CONFIG && isElder();
  let sort = prog ? 'stale' : 'az', sexF = 'all';
  const filter = h('input', { type: 'search', placeholder: 'Buscar…', oninput: () => fill() });
  const tbody = h('tbody');
  const today = todayISO();

  function stats() {
    const progs = sortedPrograms();
    const recentPids = new Set(progs.filter(q => Math.abs(daysBetween(q.date, mondayOf(today))) < state.settings.restDays).flatMap(q => assignmentsOf(q).map(x => x.pid)));
    return state.profiles.map(pr => {
      let count = 0, last = null, next = null;
      for (const q of progs) for (const x of assignmentsOf(q)) {
        if (x.pid !== pr.id) continue;
        count++;
        if (q.date <= today) { if (!last) last = { q, ...x }; } else next = { q, ...x }; // progs va de más nuevo a más viejo
      }
      return { pr, count, last, next, days: last ? daysBetween(last.q.date, today) : Infinity, recent: recentPids.has(pr.id) };
    });
  }

  function fill() {
    const f = norm(filter.value);
    const byName = (a, b) => a.pr.name.localeCompare(b.pr.name, 'es');
    const contact = pr => elder ? nube.contactos.get(pr.id) || {} : {};
    const rows = stats().filter(x => (!f || norm(x.pr.name).includes(f) || norm(Object.values(contact(x.pr)).join(' ')).includes(f)) && (sexF === 'all' || x.pr.sex === sexF) && nomOk(x.pr)).sort(
      sort === 'stale' ? (a, b) => b.days - a.days || byName(a, b)
        : sort === 'count' ? (a, b) => b.count - a.count || byName(a, b)
          : sort === 'age' ? (a, b) => (b.pr.age ?? -1) - (a.pr.age ?? -1) || byName(a, b) : byName);
    tbody.replaceChildren(...(rows.length ? rows.map(x => {
      const badge = x.days === Infinity ? ['s-never', x.next ? 'Programado' : 'Nunca']
        : x.days >= state.settings.staleDays ? ['s-stale', 'Hace mucho'] : x.recent ? ['s-recent', 'Reciente'] : ['s-ok', 'Normal'];
      const acc = FB_CONFIG && isAdmin() ? memberOfProfile(x.pr.id) : null, grp = grupoOf(x.pr.id), c = contact(x.pr);
      const link = (href, text) => h('a', { href, target: href.startsWith('http') ? '_blank' : null, rel: 'noopener', onclick: e => e.stopPropagation() }, text);
      const phone = c.tel ? h('div', { class: 'small-text' }, '📞 ', link(telLink(c.tel), c.tel), ' · ', link(waLink(c.tel), 'WhatsApp')) : null;
      if (!prog) return h('tr', { onclick: () => openProfileDialog(x.pr) },
        h('td', null, h('strong', null, x.pr.name), x.pr.nombramiento ? h('span', { class: 'tag-fam', style: { color: 'var(--accent)' } }, nomLabel(x.pr.nombramiento)) : null, awayTag(x.pr), phone,
          c.dir ? h('div', { class: 'small-text muted' }, c.dir) : null),
        h('td', null, x.pr.sex === 'M' ? 'Masculino' : 'Femenino'), h('td', null, x.pr.age ?? '—'), h('td', { class: 'small-text' }, grp ? grp.nombre : '—'));
      return h('tr', { onclick: () => openProfileDialog(x.pr) },
        h('td', null, h('strong', null, x.pr.name),
          x.pr.nombramiento ? h('span', { class: 'tag-fam', style: { color: 'var(--accent)' } }, nomLabel(x.pr.nombramiento)) : null,
          x.pr.capitan ? h('span', { class: 'tag-fam' }, 'Capitán') : null,
          awayTag(x.pr),
          pioneerTag(x.pr) ? h('span', { class: 'tag-fam' }, pioneerTag(x.pr)) : null,
          grp ? h('span', { class: 'tag-fam' }, grp.nombre) : null,
          acc ? h('div', { class: 'muted small-text', title: 'Tiene cuenta en la app' }, '🔑 ', acc.email,
            acc.admin ? ' · Coordinador' : (acc.permisos || []).length ? ' · ' + acc.permisos.map(k => (PERMS.find(p => p[0] === k) || [k, k])[1]).join(', ') : '') : null,
          phone,
          Array.isArray(x.pr.puede)
            ? h('div', { class: 'muted small-text' }, x.pr.puede.length ? x.pr.puede.map(privLabel).join(' · ') : 'Sin asignaciones')
            : h('div', { class: 'small-text', style: { color: 'var(--orange)' } }, 'Privilegios sin marcar'),
          x.pr.notes ? h('div', { class: 'muted small-text' }, x.pr.notes) : null),
        h('td', null, x.pr.sex === 'M' ? 'Masculino' : 'Femenino'),
        h('td', null, x.pr.age ?? '—'),
        h('td', { class: 'small-text' }, (famOf(x.pr.id) || {}).name || '—'),
        h('td', null, x.count),
        h('td', null, x.last ? fmtShort(x.last.q.date) : '—'),
        h('td', null, x.days === Infinity ? '—' : `${x.days} días`),
        h('td', { class: 'small-text' }, x.last ? roleLabel(x.last.row, x.last.slot) : '—'),
        h('td', null, x.next ? fmtShort(x.next.q.date) : '—'),
        h('td', null, h('span', { class: 'badge ' + badge[0] }, badge[1])));
    }) : [h('tr', null, h('td', { colspan: 10, class: 'empty' }, state.profiles.length ? 'Nadie coincide.' : 'Aún no hay hermanos. Pulsa “+ Nuevo hermano”.'))]));
    chips.replaceChildren(nomChips(() => fill()));
  }
  const chips = h('div');

  fill();
  return h('div', null,
    h('div', { class: 'row spread', style: { marginBottom: '14px' } },
      h('div', null, h('h1', null, 'Hermanos'),
        h('p', { class: 'sub', style: { margin: 0 } }, prog ? `Datos, nombramiento, asignaciones que puede recibir${elder ? ', teléfono y dirección (solo los ancianos los ven)' : ''} y, si tiene, su cuenta de la app. Toca a un hermano para editarlo.`
          : 'Teléfono, dirección y contacto de emergencia de cada hermano. Solo los ancianos ven esta información. Toca a un hermano para ver o cambiar sus datos de contacto.')),
      prog ? h('div', { class: 'row' }, h('button', { class: 'btn', onclick: openImportDialog }, '⬆ Cargar de Excel'),
        h('button', { class: 'btn primary', onclick: () => openProfileDialog(null) }, '+ Nuevo hermano')) : null),
    FB_CONFIG && isAdmin() ? accountsPanel() : null,
    h('div', { class: 'card', style: { padding: '14px' } },
      chips,
      h('div', { class: 'row', style: { marginBottom: '10px' } }, filter,
        h('select', { onchange: e => { sexF = e.target.value; fill(); } },
          h('option', { value: 'all' }, 'Todos'), h('option', { value: 'M' }, 'Hombres'), h('option', { value: 'F' }, 'Mujeres')),
        prog ? h('select', { onchange: e => { sort = e.target.value; fill(); } },
          h('option', { value: 'stale' }, 'Más tiempo sin participar'),
          h('option', { value: 'count' }, 'Más veces asignado'),
          h('option', { value: 'age' }, 'Edad'),
          h('option', { value: 'az' }, 'Alfabético')) : null),
      h('div', { class: 'tablewrap' }, h('table', { class: 'stats' },
        h('thead', null, h('tr', null, (prog ? ['Nombre', 'Sexo', 'Edad', 'Familia', 'Veces', 'Última vez', 'Hace', 'Última asignación', 'Próxima', 'Estado'] : ['Nombre', 'Sexo', 'Edad', 'Grupo']).map(t => h('th', null, t)))),
        tbody))));
}

function openFamilyDialog(fam) {
  const nameI = h('input', { type: 'text', value: fam ? fam.name : '', placeholder: 'Ej.: Familia Tapia' });
  const err = h('div', { class: 'err' });
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' },
      h('h3', null, fam ? 'Cambiar nombre' : 'Nueva familia'),
      h('label', { class: 'field' }, 'Nombre de la familia', nameI), err),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: submit }, 'Guardar')));
  function submit() {
    const name = squash(nameI.value);
    if (!name) return err.textContent = 'Escribe el nombre de la familia.';
    if (state.families.some(f => f !== fam && norm(f.name) === norm(name))) return err.textContent = 'Ya existe una familia con ese nombre.';
    if (fam) fam.name = name; else state.families.push({ id: uid(), name });
    save(); dlg.close(); render();
  }
  dlg.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal(); nameI.focus();
}

function renderFamilies() {
  const fams = [...state.families].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const free = state.profiles.filter(p => !p.familyId || !famById(p.familyId)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const card = f => {
    const members = familyMembers(f);
    return h('div', { class: 'card fam' },
      h('div', { class: 'fam-head' },
        h('strong', null, f.name),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: () => openFamilyDialog(f) }, 'Renombrar'),
          h('button', { class: 'btn small danger', onclick: () => {
            if (!confirm(`¿Eliminar “${f.name}”? Los hermanos no se borran, solo dejan de estar en esta familia.`)) return;
            state.families = state.families.filter(x => x !== f);
            for (const p of state.profiles) if (p.familyId === f.id) p.familyId = null;
            save(); render();
          } }, 'Eliminar'))),
      members.length ? h('div', { class: 'members' }, members.map(m => h('span', { class: 'member' },
        m.name, h('small', null, `${m.sex === 'M' ? '♂' : '♀'}${m.age != null ? ' ' + m.age : ''}`),
        h('button', { title: 'Quitar de la familia', onclick: () => { m.familyId = null; save(); render(); } }, '×'))))
        : h('div', { class: 'muted small-text' }, 'Todavía no tiene miembros.'),
      free.length ? h('select', { onchange: e => {
        const pr = profById(e.target.value); if (!pr) return;
        pr.familyId = f.id; save(); render();
      } }, h('option', { value: '' }, '+ Agregar miembro…'), free.map(p => h('option', { value: p.id }, p.name)))
        : h('div', { class: 'muted small-text' }, state.profiles.length ? 'Todos los hermanos ya tienen familia.' : 'Primero agrega hermanos en la pestaña “Hermanos”.'));
  };
  return h('div', null,
    h('div', { class: 'row spread', style: { marginBottom: '14px' } },
      h('div', null, h('h1', null, 'Familias'),
        h('p', { class: 'sub', style: { margin: 0 } },
          'Agrupa a las personas que son familia. Al elegir ayudante, la app muestra primero a los familiares y avisa si la pareja es de distinto sexo y no es de la misma familia.')),
      h('button', { class: 'btn primary', onclick: () => openFamilyDialog(null) }, '+ Nueva familia')),
    fams.length ? h('div', { class: 'fgrid' }, fams.map(card))
      : h('div', { class: 'card empty' }, 'Aún no hay familias. Pulsa “+ Nueva familia” para crear la primera.'));
}

function renderSettings() {
  const s = state.settings;
  const num = (label, key, min, max) => h('label', { class: 'field' }, label,
    h('input', { type: 'number', min, max, value: s[key], style: { width: '120px' }, onchange: e => { s[key] = Math.min(max, Math.max(min, Math.round(+e.target.value) || min)); e.target.value = s[key]; save(); } }));
  const text = (label, key, ph) => h('label', { class: 'field' }, label,
    h('input', { type: 'text', value: s[key], placeholder: ph, oninput: e => { s[key] = e.target.value; save(); } }));
  const pick = (label, key, opts, after) => h('label', { class: 'field' }, label,
    h('select', { onchange: e => { s[key] = e.target.value; save(); if (after) after(); } }, opts.map(([v, t]) => h('option', { value: v, selected: (s[key] || opts[0][0]) === v ? true : null }, t))));
  // Botones que se prenden y apagan (lo prendido se pone)
  const toggles = (label, items) => h('div', { class: 'field' }, label,
    h('div', { class: 'chips nom-chips' }, items.map(([t, key]) => h('button', { type: 'button', class: s[key] !== false ? 'on' : '',
      onclick: e => { s[key] = s[key] === false; e.target.classList.toggle('on', s[key] !== false); save(); } }, t))));
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => {
      const data = JSON.parse(txt);
      if (!Array.isArray(data.programs) || !Array.isArray(data.profiles)) throw new Error();
      delete data.congregacion;
      if (!confirm(FB_CONFIG ? 'Esto reemplazará todos los datos de la congregación por los del respaldo. ¿Continuar?'
        : 'Esto reemplazará todos los datos actuales por los del respaldo. ¿Continuar?')) return;
      state = hydrate(data); save(); toast('Respaldo cargado'); go({ name: 'list' });
    }).catch(() => toast('El archivo no es un respaldo válido de esta app'));
    e.target.value = '';
  } });
  // Versión del programa de escritorio (se actualiza solo desde GitHub)
  const version = h('p', { class: 'sub' });
  if (location.protocol === 'app:') fetch('/version').then(r => r.text()).then(v => { version.textContent = `Versión ${v} · se actualiza sola al abrir el programa`; }).catch(() => {});
  else if (NATIVE) version.textContent = `Versión ${APP_VERSION} (Android) · avisa al abrir si hay una nueva`;
  else if (FB_CONFIG) version.textContent = `Versión ${APP_VERSION} (web)`;
  return h('div', null,
    h('h1', null, 'Ajustes'),
    h('p', { class: 'sub' }, FB_CONFIG ? 'Los datos se guardan en la nube de la congregación; solo los administradores los ven completos.'
      : 'Los datos se guardan en este navegador. Descarga un respaldo de vez en cuando.'),
    FB_CONFIG ? accountCard() : null,
    FB_CONFIG && isAdmin() ? congregationSettings() : null,
    FB_CONFIG && isAdmin() ? backupsCard() : null,
    h('h2', { class: 'group' }, 'Horarios de las reuniones'),
    meetingTimesCard(),
    h('h2', { class: 'group' }, 'Programa y PDF'),
    h('div', { class: 'card settings' },
      h('div', { class: 'row', style: { gap: '16px', alignItems: 'flex-end' } },
        pick('Diseño del programa', 'pdfDesign', PDF_DESIGNS, () => render()),
        pick('Fecha de cada semana', 'pdfDate', DATE_HEADERS)),
      toggles('El programa lleva', [['Minutos de cada parte', 'pdfShowMin']]),
      text('Título del programa', 'pdfTitle', 'Programa para la reunión de entre semana'),
      FB_CONFIG ? null : text('Nombre de la congregación', 'congregation', 'Opcional'),
      h('div', { class: 'row', style: { gap: '20px', alignItems: 'flex-end' } },
        h('label', { class: 'field' }, 'Tamaño de papel del PDF',
          h('select', { onchange: e => { s.paper = e.target.value; save(); } },
            h('option', { value: 'letter', selected: s.paper !== 'a4' ? true : null }, 'Carta'),
            h('option', { value: 'a4', selected: s.paper === 'a4' ? true : null }, 'A4')))),
      h('label', { class: 'field' }, 'Nota al estudiante (en las hojas de asignación)',
        h('textarea', { rows: 3, oninput: e => { s.slipNote = e.target.value; save(); } }, s.slipNote)),
      text('Texto al pie de las hojas de asignación', 'slipFooter', 'Opcional (por ejemplo, el código del formulario)'),
      toggles('Las hojas de asignación llevan', [['Minutos', 'slipShowMin'], ['Texto de la parte', 'slipShowText'], ['Lección', 'slipShowLesson']]),
      pick('Fecha en las hojas de asignación', 'slipDate', DATE_FORMATS),
      num('No repetir a nadie en … días (antes o después de su asignación)', 'restDays', 7, 120),
      num('Asignaciones mecánicas: no repetir a nadie en … días', 'mecRestDays', 0, 120),
      num('Marcar como “hace mucho” después de … días', 'staleDays', 1, 3650),
      num('Cuántas semanas hacia adelante buscar en jw.org', 'weeksAhead', 1, 16),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => {
          saveBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `respaldo-programas-${todayISO()}.json`);
        } }, '⬇ Descargar respaldo'),
        h('button', { class: 'btn', onclick: () => fileIn.click() }, '⬆ Cargar respaldo'), fileIn)),
    filtersCard(),
    nomPrefsCard(),
    waTemplateCard(),
    version);
}

// Ajustes: día y hora de cada reunión (entre semana: lunes a viernes; fin de semana: sábado o domingo)
function meetingTimesCard() {
  const s = state.settings;
  const meeting = (title, desc, dayKey, days, timeKey, fallbackDay, fallbackTime) => h('div', { class: 'meet-row' },
    h('div', null, h('strong', null, title), h('div', { class: 'muted small-text' }, desc)),
    h('label', { class: 'field' }, 'Día',
      h('select', { onchange: e => { s[dayKey] = +e.target.value; save(); } },
        days.map(i => h('option', { value: i, selected: (s[dayKey] ?? fallbackDay) === i ? true : null }, WEEKDAYS[i])))),
    h('label', { class: 'field' }, 'Hora',
      h('input', { type: 'time', value: s[timeKey] || fallbackTime, onchange: e => { if (e.target.value) { s[timeKey] = e.target.value; save(); } } })));
  // Si antes se había elegido un día fuera de rango, se acomoda al más cercano
  if (s.meetingDay > 4) s.meetingDay = 4;
  if ((s.weekendDay ?? 6) < 5) s.weekendDay = 6;
  return h('div', { class: 'card settings', style: { gap: '4px' } },
    meeting('Entre semana', 'Vida y Ministerio Cristianos', 'meetingDay', [0, 1, 2, 3, 4], 'startTime', 2, '19:00'),
    meeting('Fin de semana', 'Reunión pública y estudio de La Atalaya', 'weekendDay', [5, 6], 'weekendTime', 6, '10:00'),
    h('p', { class: 'muted small-text', style: { margin: '6px 0 0' } }, 'Se usan en el programa, en las asignaciones mecánicas y en los PDF.'));
}
// "19:00" → "7:00 p. m."
const fmtClock = hm => { const [hh, mm] = (hm || '0:0').split(':').map(Number); return new Date(2000, 0, 1, hh, mm).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }); };

// Ajustes: filtros de sugerencias (palabras de la parte → edad y sexo preferidos)
function filtersCard() {
  const s = state.settings;
  if (!Array.isArray(s.filters)) s.filters = DEFAULT_FILTERS.map(f => ({ ...f }));
  const box = h('div', { style: { display: 'grid', gap: '10px' } });
  const ageIn = (f, key) => h('input', { type: 'number', min: 0, max: 120, value: f[key] ?? '', placeholder: '—', style: { width: '74px' },
    onchange: e => { f[key] = e.target.value === '' ? null : Math.max(0, Math.round(+e.target.value)); save(); } });
  function fill() {
    box.replaceChildren(...(s.filters.length ? s.filters.map((f, i) => h('div', { class: 'card', style: { padding: '12px', display: 'grid', gap: '8px', boxShadow: 'none' } },
      h('div', { class: 'row', style: { gap: '12px', alignItems: 'flex-end' } },
        h('label', { class: 'field', style: { flex: '1', minWidth: '140px' } }, 'Nombre',
          h('input', { type: 'text', value: f.nombre, oninput: e => { f.nombre = e.target.value; save(); } })),
        h('label', { class: 'field' }, 'Edad desde', ageIn(f, 'min')),
        h('label', { class: 'field' }, 'hasta', ageIn(f, 'max')),
        h('label', { class: 'field' }, 'Sexo', h('select', { onchange: e => { f.sexo = e.target.value; save(); } },
          [['', 'Cualquiera'], ['M', 'Hombres'], ['F', 'Mujeres']].map(([v, t]) => h('option', { value: v, selected: (f.sexo || '') === v ? true : null }, t)))),
        h('button', { class: 'btn small danger', onclick: () => { if (confirm(`¿Quitar el filtro “${f.nombre}”?`)) { s.filters.splice(i, 1); save(); fill(); } } }, 'Quitar')),
      h('label', { class: 'field' }, 'Palabras que lo activan (separadas por comas)',
        h('input', { type: 'text', value: f.palabras, placeholder: 'Ej.: escuela, compañero de clase', oninput: e => { f.palabras = e.target.value; save(); } }))))
      : [h('div', { class: 'muted' }, 'No hay filtros.')]));
  }
  fill();
  return [
    h('h2', { class: 'group' }, 'Filtros de sugerencias'),
    h('div', { class: 'card settings', style: { marginTop: 0 } },
      h('p', { class: 'muted small-text', style: { margin: 0 } },
        'Si el título o la descripción de una parte tiene alguna de estas palabras, las sugerencias ponen primero a quien tenga esa edad. Para que funcionen, los hermanos necesitan tener la edad.'),
      box,
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => { s.filters.push({ nombre: 'Nuevo filtro', palabras: '', min: null, max: null, sexo: '' }); save(); fill(); } }, '+ Agregar filtro'),
        h('button', { class: 'btn small', onclick: () => {
          if (!confirm('¿Volver a los filtros que trae la app? Se pierden los cambios que hayas hecho.')) return;
          s.filters = DEFAULT_FILTERS.map(f => ({ ...f })); save(); fill();
        } }, 'Volver a los predeterminados')))];
}

// Ajustes: en qué asignaciones salen primero los nombrados (aparte de los filtros por edad)
function nomPrefsCard() {
  const s = state.settings;
  if (!s.nomPrefs) s.nomPrefs = { ...DEFAULT_NOM_PREFS };
  const opts = [['', 'No preferir'], ['nom', 'Ancianos y siervos ministeriales'], ['anciano', 'Ancianos'], ['sm', 'Siervos ministeriales']];
  const row = ([k, label]) => h('label', { class: 'row spread', style: { gap: '10px', color: 'var(--text)', fontSize: '14px' } }, label,
    h('select', { onchange: e => { s.nomPrefs[k] = e.target.value; save(); } }, opts.map(([v, t]) => h('option', { value: v, selected: (s.nomPrefs[k] || '') === v ? true : null }, t))));
  return [
    h('h2', { class: 'group' }, 'Preferir nombrados'),
    h('div', { class: 'card settings', style: { marginTop: 0 } },
      h('p', { class: 'muted small-text', style: { margin: 0 } }, 'En las asignaciones que elijas, las sugerencias ponen primero a los ancianos, a los siervos ministeriales o a los dos. Los demás siguen saliendo, después. Va aparte de los filtros por edad.'),
      h('strong', { class: 'small-text' }, 'Asignaciones mecánicas'),
      PRIVS.filter(([k]) => MEC_PRIVS.includes(k)).map(row),
      h('strong', { class: 'small-text' }, 'Programa de Vida y Ministerio'),
      PRIVS.filter(([k]) => !MEC_PRIVS.includes(k)).map(row))];
}

// Revisa jw.org al abrir, como máximo cada 12 horas (o siempre si faltan semanas próximas).
// En la versión web no se puede leer jw.org, así que no se intenta solo.
function startJw() {
  if (location.protocol === 'https:' && !JW_PROXY) return;
  if (Date.now() - state.lastSync > 12 * 36e5 || !state.programs.some(p => p.date >= mondayOf(todayISO()))) syncGuides(false);
  else ensureSongTitles(state.programs);
}
// Sin internet: se puede seguir usando; los cambios se suben solos al volver la conexión
const offlineBar = h('div', { class: 'offline-bar', hidden: navigator.onLine ? true : null }, 'Sin internet: puedes seguir usando la app. Los cambios se guardan y se suben solos al volver la conexión.');
document.querySelector('header').after(offlineBar);
addEventListener('online', () => { offlineBar.hidden = true; toast('Volvió la conexión'); });
addEventListener('offline', () => { offlineBar.hidden = false; });
// iPhone: Safari no respeta user-scalable=no; así se evita el zoom con dos dedos fuera del mapa
document.addEventListener('gesturestart', e => { if (!e.target.closest || !e.target.closest('.leaflet-container')) e.preventDefault(); });
if (NATIVE) {
  const AppP = capacitorExports.registerPlugin('App');
  AppP.addListener('appUrlOpen', e => receiveLink(e.url));
  AppP.getLaunchUrl().then(r => r && r.url && receiveLink(r.url)).catch(() => {});
}
if (/^#ver&/.test(location.hash)) renderSharedTerritory(); // QR de una tarjeta de territorio
else if (FB_CONFIG) startCloud();
else { render(); startJw(); }
// App de Android: no se actualiza sola; al abrir revisa GitHub y ofrece bajar el APK nuevo.
const APK_URL = 'https://github.com/becker9824/programas/releases/latest/download/Programas.apk';
const newerVersion = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
async function checkApkUpdate() {
  try {
    const r = await fetch('https://api.github.com/repos/becker9824/programas/releases/latest', { cache: 'no-store' });
    const v = r.ok ? String((await r.json()).tag_name || '').replace(/^v/, '') : '';
    if (!v || !newerVersion(v, APP_VERSION)) return;
    // Se baja dentro de la app y se abre el instalador de Android (plugin propio Actualizar, desde la 1.31.0).
    // Si algo falla, como antes: se baja con el navegador.
    const bar = h('div', { style: { height: '100%', width: '0%', background: 'var(--accent)', borderRadius: '6px', transition: 'width .2s' } });
    const barBox = h('div', { style: { height: '10px', background: 'var(--accent-2)', borderRadius: '6px', overflow: 'hidden', marginTop: '10px', display: 'none' } }, bar);
    const msg = h('p', null, `Tienes la ${APP_VERSION} y ya salió la ${v}. Toca “Actualizar ahora”: se baja aquí mismo y Android te pide confirmar la instalación. Tus datos no se pierden.`);
    const later = h('button', { class: 'btn', onclick: () => dlg.close() }, 'Después');
    const go = h('button', { class: 'btn primary', onclick: async () => {
      const UP = capacitorExports.registerPlugin('Actualizar');
      go.disabled = true; later.disabled = true;
      try {
        if (!(await UP.puedeInstalar()).valor) {
          msg.textContent = 'Android necesita tu permiso (solo esta vez): activa “Permitir de esta fuente” y vuelve a la app con la flecha de atrás.';
          await UP.pedirPermiso();
          await new Promise(ok => document.addEventListener('visibilitychange', function back() {
            if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', back); ok(); } }));
          if (!(await UP.puedeInstalar()).valor) { msg.textContent = 'Sin ese permiso no se puede instalar. Vuelve a tocar “Actualizar ahora” cuando quieras.'; go.disabled = false; later.disabled = false; return; }
        }
        msg.textContent = 'Bajando la versión ' + v + '…'; barBox.style.display = '';
        const sub = await UP.addListener('progreso', e => { if (e.p >= 0) { bar.style.width = e.p + '%'; msg.textContent = `Bajando la versión ${v}… ${e.p}%`; } });
        await UP.descargarEInstalar({ url: APK_URL });
        sub.remove();
        msg.textContent = 'Listo: toca “Actualizar” en la ventana de Android.'; later.disabled = false; later.textContent = 'Cerrar';
      } catch (e) {
        msg.textContent = 'No se pudo bajar aquí (' + ((e && e.message) || e) + '). Se abrirá el navegador para bajarla.';
        setTimeout(() => { window.open(APK_URL, '_blank'); dlg.close(); }, 2500);
      }
    } }, '⬇ Actualizar ahora');
    const dlg = h('dialog', { class: 'dlg' },
      h('div', { class: 'dlg-body' }, h('h3', null, 'Hay una versión nueva'), msg, barBox),
      h('div', { class: 'dlg-foot' }, later, go));
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg); dlg.showModal();
  } catch (e) {}
}
if (NATIVE) checkApkUpdate();
else if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // Cuando llega una versión nueva de la web, se recarga una vez para usarla
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !busy()) location.reload(); });
  // Si la página se queda abierta (o la app del celular en segundo plano), revisa al volver a ella
  // y cada 15 minutos; si hay versión nueva, el evento de arriba la recarga.
  navigator.serviceWorker.register('sw.js').then(reg => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 15 * 6e4);
  }).catch(() => {});
}
