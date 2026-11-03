// Programas · Discursos públicos, calendario personal, predicación pública, pastoreo, estadísticas y búsqueda.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- discursos públicos ----------
// Todo sale de las semanas (p.fin y p.fin.salen): no hay otra colección.
function talkHistory() {
  const out = [];
  for (const p of state.programs) {
    const f = p.fin || {};
    if (f.bosquejo || f.tema || f.orador) out.push({ fecha: mecDate(p, 'fin'), bosquejo: f.bosquejo || '', tema: f.tema || '', orador: f.orador || '',
      cong: f.cong || '', tel: f.oradorTel || '', aqui: true });
    for (const s of f.salen || []) if (s.orador || s.bosquejo || s.tema) out.push({ fecha: s.fecha || mecDate(p, 'fin'), bosquejo: s.bosquejo || '',
      tema: s.tema || '', orador: s.orador || '', cong: s.cong || '', aqui: false });
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
}
// ¿Ese bosquejo ya se dio (o se va a dar) aquí en menos de un año?
function talkRepeat(num, fecha) {
  if (!num || !fecha) return '';
  const t = talkHistory().find(x => x.aqui && x.bosquejo === num && x.fecha !== fecha && Math.abs(daysBetween(x.fecha, fecha)) < 365);
  if (!t) return '';
  const months = Math.round(Math.abs(daysBetween(t.fecha, fecha)) / 30);
  return `⚠ El bosquejo ${num} ${t.fecha < fecha ? 'ya se dio' : 'se dará'} aquí el ${fmtShort(t.fecha)}${months ? ` (${months} mes${months > 1 ? 'es' : ''} de diferencia)` : ''}.`;
}

let weekendTab = 'programa';
function weekendTabs() {
  return h('div', { class: 'tabs', style: { maxWidth: '520px', margin: '4px 0 16px' } },
    [['programa', 'Programa'], ['historial', 'Discursos dados'], ['oradores', 'Oradores']].map(([k, t]) =>
      h('button', { class: weekendTab === k ? 'on' : '', onclick: () => { weekendTab = k; render(); } }, t)));
}
function renderTalkHistory() {
  const all = talkHistory().filter(t => t.fecha <= addDays(todayISO(), 120));
  const search = h('input', { type: 'search', placeholder: 'Buscar número, tema, orador o congregación…', style: { width: '100%', maxWidth: '420px' } });
  let where = 'aqui';
  const tbody = h('tbody'), chips = h('div', { class: 'chips wide' });
  const fill = () => {
    const q = norm(search.value);
    const rows = all.filter(t => (where === 'todos' || (where === 'aqui') === t.aqui) && (!q || norm(`${t.bosquejo} ${t.tema} ${t.orador} ${t.cong}`).includes(q)));
    chips.replaceChildren(...[['aqui', 'Aquí'], ['salen', 'Salen'], ['todos', 'Todos']].map(([k, l]) =>
      h('button', { class: where === k ? 'on' : '', onclick: () => { where = k; fill(); } }, l)));
    tbody.replaceChildren(...(rows.length ? rows.map(t => h('tr', { class: t.fecha > todayISO() ? 'muted' : null },
      h('td', { style: { whiteSpace: 'nowrap' } }, fmtShort(t.fecha), t.fecha > todayISO() ? h('div', { class: 'small-text muted' }, 'Próximo') : null),
      h('td', null, t.bosquejo ? h('strong', null, t.bosquejo) : '—'),
      h('td', null, t.tema || '—'),
      h('td', null, t.orador || '—', t.cong ? h('div', { class: 'small-text muted' }, t.aqui ? t.cong : `Va a ${t.cong}`) : null)))
      : [h('tr', null, h('td', { colspan: 4, class: 'empty' }, all.length ? 'Nada coincide.' : 'Todavía no hay discursos anotados en Fin de semana.'))]));
  };
  search.addEventListener('input', fill);
  fill();
  return h('div', { class: 'card', style: { padding: '14px' } },
    h('div', { class: 'row', style: { marginBottom: '10px', gap: '10px' } }, search, chips),
    h('p', { class: 'muted small-text', style: { margin: '0 0 8px' } }, 'Al escribir el número de un bosquejo en el programa, la app avisa si ya se dio aquí en menos de un año.'),
    h('div', { class: 'tablewrap' }, h('table', { class: 'stats' },
      h('thead', null, h('tr', null, ['Fecha', 'Núm.', 'Tema', 'Orador'].map(t => h('th', null, t)))), tbody)));
}
function renderSpeakers() {
  const hist = talkHistory().filter(t => t.orador);
  const group = list => {
    const m = new Map();
    for (const t of list) {
      const k = norm(t.orador), g = m.get(k) || { orador: t.orador, cong: '', tel: '', veces: 0, ultima: '', temas: [] };
      g.veces++; if (!g.ultima || t.fecha > g.ultima) g.ultima = t.fecha;
      if (t.cong && !g.cong) g.cong = t.cong; if (t.tel && !g.tel) g.tel = t.tel;
      if (t.tema && !g.temas.includes(t.tema)) g.temas.push(t.tema);
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.ultima.localeCompare(a.ultima));
  };
  const visitors = group(hist.filter(t => t.aqui && t.cong)), ours = group(hist.filter(t => !t.cong || !t.aqui));
  const list = (items, empty, visitor) => h('div', { class: 'card', style: { padding: '4px 14px' } },
    items.length ? items.map(g => h('div', { class: 'urow' },
      h('div', { class: 'info' }, h('strong', null, g.orador), visitor && g.cong ? h('span', { class: 'tag-fam' }, g.cong) : null,
        h('div', { class: 'small-text muted' }, `${g.veces} ${g.veces === 1 ? 'vez' : 'veces'} · última: ${fmtShort(g.ultima)}`),
        g.temas.length ? h('div', { class: 'small-text muted' }, g.temas.slice(0, 3).join(' · ')) : null),
      g.tel ? h('span', { class: 'row' }, h('a', { class: 'btn small', href: telLink(g.tel) }, '📞'), h('a', { class: 'btn small', href: waLink(g.tel), target: '_blank', rel: 'noopener' }, 'WhatsApp')) : null))
      : h('div', { class: 'empty' }, empty));
  return h('div', null,
    h('h2', { class: 'group' }, 'Oradores visitantes'),
    list(visitors, 'Aquí aparecen los oradores de otras congregaciones que ya dieron discurso aquí.', true),
    h('h2', { class: 'group' }, 'Oradores de aquí'),
    list(ours, 'Aquí aparecen los hermanos de la congregación que dan discursos aquí o en otras congregaciones.'));
}

// ---------- mis asignaciones en el calendario del celular (.ics) ----------
function icsFile(list) {
  const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const day = iso => iso.replace(/-/g, ''), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Programas//Asignaciones//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const x of list) lines.push('BEGIN:VEVENT', `UID:${esc((x.key || x.day + x.title).replace(/[^\w|-]/g, ''))}@programas`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day(x.day)}`, `DTEND;VALUE=DATE:${day(addDays(x.day, 1))}`, `SUMMARY:${esc(x.title)}`,
    `DESCRIPTION:${esc([x.when, x.role, x.with ? 'Con ' + x.with : ''].filter(Boolean).join('\n'))}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(x.title)}`, 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT');
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
function calendarButton(list) {
  if (!list.length) return null;
  return h('button', { class: 'btn small', title: 'Se abre en tu calendario (Google, del celular u Outlook) con un recordatorio la tarde anterior',
    onclick: () => saveBlob(new Blob([icsFile(list)], { type: 'text/calendar' }), 'mis-asignaciones.ics') }, '📅 Agregar a mi calendario');
}

// ---------- predicación pública (exhibidores) ----------
// publica/{id} = { fecha, hora, horaFin, lugar, cupo, inscritos: { perfil: nombre }, notas }.
// Lo ven todos; lo arman los ancianos; cada hermano se apunta o se quita él mismo.
const turnsAhead = () => nube.publica.filter(t => t.fecha >= todayISO()).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
const myTurns = () => nube.me && nube.me.perfil ? turnsAhead().filter(t => (t.inscritos || {})[nube.me.perfil]) : [];
async function toggleTurn(t) {
  const pid = nube.me.perfil, on = !!(t.inscritos || {})[pid];
  if (!on && Object.keys(t.inscritos || {}).length >= t.cupo) return toast('Ese turno ya está lleno.');
  try {
    await F.updateDoc(congRef('publica', t.id), { ['inscritos.' + pid]: on ? F.deleteField() : (nube.me.nombre || 'Hermano').slice(0, 80) });
    toast(on ? 'Te quitaste del turno' : '¡Listo! Te apuntaste');
  } catch (e) { toast(errMsg(e)); }
}
function publicTurnsSection() {
  const editor = isElder(), pid = nube.me && nube.me.perfil, list = turnsAhead().slice(0, 40);
  const byDay = [...new Set(list.map(t => t.fecha))].map(d => [d, list.filter(t => t.fecha === d)]);
  return [
    h('div', { class: 'row spread', style: { margin: '18px 0 8px' } },
      h('h2', { class: 'group', style: { margin: 0 } }, 'Predicación pública'),
      editor ? h('button', { class: 'btn small primary', onclick: () => openTurnDialog(null) }, '+ Nuevo turno') : null),
    h('div', { class: 'card', style: { padding: '4px 14px' } },
      byDay.length ? byDay.map(([d, ts]) => h('div', { class: 'out-day' },
        h('div', { class: 'out-dayname' }, capFirst(toDate(d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }))),
        ts.map(t => {
          const ins = Object.entries(t.inscritos || {}), mine = pid && (t.inscritos || {})[pid], full = ins.length >= t.cupo;
          return h('div', { class: 'urow' },
            h('strong', { class: 'out-time' }, fmtHora(t.hora), t.horaFin ? h('div', { class: 'small-text muted' }, fmtHora(t.horaFin)) : null),
            h('div', { class: 'info' }, h('strong', null, t.lugar),
              h('span', { class: 'progress' + (full ? ' done' : ''), style: { marginLeft: '8px' } }, `${ins.length}/${t.cupo}`),
              h('div', { class: 'small-text', style: { marginTop: '2px' } }, ins.length ? ins.map(([id, n]) => h('span', { class: 'tag-fam', style: { marginLeft: 0, marginRight: '4px', color: id === pid ? 'var(--green)' : null } }, n)) : h('span', { class: 'muted' }, 'Nadie todavía')),
              t.notas ? h('div', { class: 'small-text muted' }, t.notas) : null),
            h('span', { class: 'row' },
              pid && (mine || !full) ? h('button', { class: 'btn small' + (mine ? '' : ' primary'), onclick: () => toggleTurn(t) }, mine ? 'Quitarme' : 'Apuntarme') : null,
              editor ? h('button', { class: 'btn small', onclick: () => openTurnDialog(t) }, 'Editar') : null));
        })))
        : h('div', { class: 'empty' }, editor ? 'No hay turnos próximos. Toca “+ Nuevo turno” (se puede repetir cada semana).' : 'No hay turnos próximos.')),
  ];
}
function openTurnDialog(t) {
  const fecha = h('input', { type: 'date', value: t ? t.fecha : todayISO() }), hora = h('input', { type: 'time', value: t ? t.hora : '10:00' });
  const horaFin = h('input', { type: 'time', value: t ? t.horaFin || '' : '12:00' });
  const lugar = h('input', { type: 'text', maxlength: 120, value: t ? t.lugar : '', placeholder: 'Ej.: Plaza principal, exhibidor 1' });
  const cupo = h('input', { type: 'number', min: 1, max: 10, value: t ? t.cupo : 2, style: { width: '90px' } });
  const notas = h('input', { type: 'text', maxlength: 300, value: t ? t.notas || '' : '', placeholder: 'Opcional' });
  const repeat = h('input', { type: 'number', min: 1, max: 12, value: 1, style: { width: '90px' } });
  const ins = { ...(t && t.inscritos) }, insBox = h('div', { class: 'members' });
  const who = h('input', { type: 'text', list: 'profiles-list', placeholder: 'Agregar hermano…' });
  const paintIns = () => insBox.replaceChildren(...Object.entries(ins).map(([id, n]) => h('span', { class: 'member' }, n,
    h('button', { type: 'button', title: 'Quitar', onclick: () => { delete ins[id]; paintIns(); } }, '×'))));
  who.addEventListener('change', () => { const pr = profByName(squash(who.value)); if (pr) { ins[pr.id] = pr.name; paintIns(); } else toast('No hay un hermano con ese nombre'); who.value = ''; });
  paintIns(); refreshDatalist();
  const err = h('div', { class: 'err' });
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, t ? 'Editar turno' : 'Nuevo turno de predicación pública'),
      h('label', { class: 'field' }, 'Lugar', lugar),
      h('div', { class: 'row', style: { gap: '10px' } }, h('label', { class: 'field' }, 'Fecha', fecha), h('label', { class: 'field' }, 'De', hora), h('label', { class: 'field' }, 'A', horaFin)),
      h('div', { class: 'row', style: { gap: '10px' } }, h('label', { class: 'field' }, 'Hermanos por turno', cupo),
        t ? null : h('label', { class: 'field' }, 'Repetir (semanas)', repeat)),
      h('label', { class: 'field' }, 'Notas', notas),
      state.profiles.length ? h('div', { class: 'field' }, 'Apuntados', insBox, who) : null,
      err),
    h('div', { class: 'dlg-foot' },
      t ? h('button', { class: 'btn danger', style: { marginRight: 'auto' }, onclick: async () => {
        if (!confirm('¿Borrar este turno?')) return;
        try { await F.deleteDoc(congRef('publica', t.id)); close(); toast('Turno borrado'); } catch (e) { err.textContent = errMsg(e); }
      } }, 'Borrar') : null,
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async e => {
        const n = Math.round(+cupo.value);
        if (!squash(lugar.value)) return err.textContent = 'Escribe el lugar.';
        if (!fecha.value || !hora.value) return err.textContent = 'Pon la fecha y la hora.';
        if (!(n >= 1 && n <= 10)) return err.textContent = 'De 1 a 10 hermanos por turno.';
        const data = { fecha: fecha.value, hora: hora.value, horaFin: horaFin.value || '', lugar: squash(lugar.value), cupo: n, notas: notas.value.trim(), inscritos: ins };
        e.target.disabled = true;
        try {
          if (t) await F.setDoc(congRef('publica', t.id), data);
          else for (let k = 0; k < Math.min(12, Math.max(1, Math.round(+repeat.value) || 1)); k++)
            await F.addDoc(F.collection(F.db, 'congregaciones', nube.cong, 'publica'), { ...data, fecha: addDays(data.fecha, k * 7), inscritos: k ? {} : ins });
          logChange(`${t ? 'Cambió' : 'Agregó'} turno de predicación pública: ${data.lugar} (${fmtShort(data.fecha)})`);
          close(); toast('Turno guardado');
        } catch (ex) { err.textContent = errMsg(ex); e.target.disabled = false; }
      } }, 'Guardar')));
  document.body.append(dlg); dlg.showModal();
}

// ---------- pastoreo (solo ancianos) ----------
// pastoreo/{id} = { perfil, fecha, quien, notas, por }. Para que ningún hermano se quede sin visita.
let pastoreoFilter = 'todos';
const lastVisits = () => {
  const m = new Map();
  for (const v of nube.pastoreo) { const cur = m.get(v.perfil); if (!cur || v.fecha > cur.fecha) m.set(v.perfil, v); }
  return m;
};
function renderShepherding() {
  const last = lastVisits(), today = todayISO();
  const search = h('input', { type: 'search', placeholder: 'Buscar hermano…', style: { width: '100%', maxWidth: '320px' } });
  const tbody = h('tbody'), chips = h('div', { class: 'chips wide' });
  const monthsAgo = v => v ? Math.floor(daysBetween(v.fecha, today) / 30) : Infinity;
  const fill = () => {
    const q = norm(search.value);
    const rows = state.profiles.map(pr => ({ pr, v: last.get(pr.id) })).filter(x => (!q || norm(x.pr.name).includes(q))
      && (pastoreoFilter === 'todos' || (pastoreoFilter === 'nunca' ? !x.v : monthsAgo(x.v) >= 6)))
      .sort((a, b) => monthsAgo(b.v) - monthsAgo(a.v) || a.pr.name.localeCompare(b.pr.name, 'es'));
    chips.replaceChildren(...[['todos', 'Todos'], ['seis', 'Sin visita en 6 meses'], ['nunca', 'Nunca visitados']].map(([k, l]) =>
      h('button', { class: pastoreoFilter === k ? 'on' : '', onclick: () => { pastoreoFilter = k; fill(); } }, l)));
    tbody.replaceChildren(...(rows.length ? rows.map(({ pr, v }) => {
      const mo = monthsAgo(v), grp = grupoOf(pr.id);
      return h('tr', { onclick: () => openVisitsDialog(pr) },
        h('td', null, h('strong', null, pr.name), grp ? h('div', { class: 'small-text muted' }, grp.nombre) : null),
        h('td', null, v ? fmtShort(v.fecha) : '—', v && v.quien ? h('div', { class: 'small-text muted' }, v.quien) : null),
        h('td', null, h('span', { class: 'badge ' + (mo === Infinity ? 's-recent' : mo >= 6 ? 's-dup' : 's-stale') },
          mo === Infinity ? 'Nunca' : mo < 1 ? 'Este mes' : `Hace ${mo} mes${mo > 1 ? 'es' : ''}`)),
        h('td', null, h('button', { class: 'btn small', onclick: e => { e.stopPropagation(); openVisitDialog(pr, null); } }, '+ Visita')));
    }) : [h('tr', null, h('td', { colspan: 4, class: 'empty' }, state.profiles.length ? 'Nadie en esta lista. ¡Bien!' : 'Aún no hay hermanos.'))]));
  };
  search.addEventListener('input', fill);
  fill();
  const due = state.profiles.filter(pr => monthsAgo(last.get(pr.id)) >= 6).length;
  return h('div', null,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Pastoreo'),
      h('p', { class: 'sub', style: { margin: 0 } }, 'Anota las visitas de pastoreo para que ningún hermano se quede sin atención. Solo lo ven los ancianos.'))),
    h('div', { class: 'notice warn' }, '🔒 Anota solo lo necesario (fecha y quién visitó). No escribas detalles personales o delicados.'),
    h('div', { class: 'totals' }, h('span', null, h('strong', null, state.profiles.length), ' hermanos'),
      h('span', null, h('strong', null, due), ' sin visita en 6 meses o más')),
    h('div', { class: 'card', style: { padding: '14px' } },
      h('div', { class: 'row', style: { marginBottom: '10px', gap: '10px' } }, search, chips),
      h('div', { class: 'tablewrap' }, h('table', { class: 'stats' },
        h('thead', null, h('tr', null, ['Hermano', 'Última visita', '', ''].map(t => h('th', null, t)))), tbody))));
}
function openVisitsDialog(pr) {
  const list = nube.pastoreo.filter(v => v.perfil === pr.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, pr.name),
      list.length ? h('div', null, list.map(v => h('div', { class: 'urow', style: { cursor: 'pointer' }, onclick: () => { close(); openVisitDialog(pr, v); } },
        h('div', { class: 'info' }, h('strong', null, fmtShort(v.fecha)), v.quien ? ` · ${v.quien}` : '', v.notas ? h('div', { class: 'small-text muted' }, v.notas) : null))))
        : h('p', { class: 'muted' }, 'Todavía no hay visitas anotadas.')),
    h('div', { class: 'dlg-foot' }, h('button', { class: 'btn', onclick: close }, 'Cerrar'),
      h('button', { class: 'btn primary', onclick: () => { close(); openVisitDialog(pr, null); } }, '+ Anotar visita')));
  document.body.append(dlg); dlg.showModal();
}
function openVisitDialog(pr, v) {
  const fecha = h('input', { type: 'date', value: v ? v.fecha : todayISO() });
  const quien = h('input', { type: 'text', maxlength: 120, value: v ? v.quien || '' : (nube.me.nombre || ''), placeholder: 'Quiénes visitaron' });
  const notas = h('input', { type: 'text', maxlength: 200, value: v ? v.notas || '' : '', placeholder: 'Opcional y breve (ej.: visita de ánimo)' });
  const err = h('div', { class: 'err' });
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, (v ? 'Visita a ' : 'Anotar visita a ') + pr.name),
      h('label', { class: 'field' }, 'Fecha', fecha), h('label', { class: 'field' }, 'Visitaron', quien), h('label', { class: 'field' }, 'Nota', notas), err),
    h('div', { class: 'dlg-foot' },
      v ? h('button', { class: 'btn danger', style: { marginRight: 'auto' }, onclick: async () => {
        if (!confirm('¿Borrar esta visita?')) return;
        try { await F.deleteDoc(congRef('pastoreo', v.id)); close(); toast('Visita borrada'); } catch (e) { err.textContent = errMsg(e); }
      } }, 'Borrar') : null,
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async e => {
        if (!fecha.value) return err.textContent = 'Pon la fecha.';
        if (fecha.value > todayISO()) return err.textContent = 'La fecha no puede ser futura.';
        const data = { perfil: pr.id, fecha: fecha.value, quien: squash(quien.value), notas: squash(notas.value), por: nube.user.uid };
        e.target.disabled = true;
        try {
          if (v) await F.setDoc(congRef('pastoreo', v.id), data); else await F.addDoc(F.collection(F.db, 'congregaciones', nube.cong, 'pastoreo'), data);
          close(); toast('Visita guardada');
        } catch (ex) { err.textContent = errMsg(ex); e.target.disabled = false; }
      } }, 'Guardar')));
  document.body.append(dlg); dlg.showModal();
}

// ---------- estadísticas (ancianos; las de informes, solo el secretario) ----------
// Barras en SVG: una o dos series, con leyenda, valores al pasar el dedo o el ratón y la tabla debajo.
// Colores revisados para daltonismo en claro y oscuro (--chart-1, --chart-2 en estilos.css).
function barChart(labels, series, opts = {}) {
  const W = Math.min(640, Math.max(330, innerWidth - 70)), H = 220, L = 34, B = 26, T = 10, // ancho de la pantalla: letras legibles en el celular
    max = Math.max(1, ...series.flatMap(s => s.values.map(v => v || 0)));
  const step = Math.pow(10, Math.floor(Math.log10(max))), top = Math.max(4, Math.ceil(max / step) * step); // al menos 4: las 5 líneas sin números repetidos
  const gw = (W - L - 8) / labels.length, bw = Math.max(4, Math.min(22, (gw - 6) / series.length - 2));
  const y = v => T + (H - T - B) * (1 - v / top);
  const svg = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.title || ''}" class="chart-svg">`];
  for (let k = 0; k <= 4; k++) { const v = Math.round(top * k / 4), yy = y(v);
    svg.push(`<line x1="${L}" x2="${W - 4}" y1="${yy}" y2="${yy}" class="ch-grid"/><text x="${L - 6}" y="${yy + 4}" class="ch-ax" text-anchor="end">${v}</text>`); }
  labels.forEach((lab, i) => {
    const x0 = L + i * gw + (gw - series.length * (bw + 2)) / 2;
    series.forEach((s, j) => { const v = s.values[i]; if (v == null) return;
      const x = x0 + j * (bw + 2), yy = y(v), hh = Math.max(0, H - B - yy), r = Math.min(4, hh);
      svg.push(`<path d="M${x},${H - B} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${H - B} Z" fill="var(--chart-${j + 1})" class="ch-bar"><title>${lab}: ${s.name} ${v}</title></path>`); });
    svg.push(`<text x="${L + i * gw + gw / 2}" y="${H - 8}" class="ch-ax" text-anchor="middle">${lab}</text>`);
  });
  svg.push('</svg>');
  const el = h('div', { class: 'chart' });
  el.innerHTML = svg.join('');
  return h('div', null,
    series.length > 1 ? h('div', { class: 'ch-legend' }, series.map((s, j) => h('span', null, h('i', { style: { background: `var(--chart-${j + 1})` } }), s.name))) : null,
    el,
    h('details', { class: 'ch-table' }, h('summary', null, 'Ver como tabla'),
      h('div', { class: 'tablewrap' }, h('table', { class: 'stats' },
        h('thead', null, h('tr', null, h('th', null, ''), series.map(s => h('th', null, s.name)))),
        h('tbody', null, labels.map((lab, i) => h('tr', null, h('td', null, lab), series.map(s => h('td', null, s.values[i] ?? '—')))))))));
}
const shortMonthLabel = m => toDate(m + '-15').toLocaleDateString('es', { month: 'short' }).replace('.', '');
let statsCache = null;
function renderStats() {
  const sy = serviceYearOf(todayISO()), months = serviceMonths(sy); // los 12 meses del año de servicio (los que faltan, vacíos)
  const prevMonths = serviceMonths(sy - 1);
  const att = k => ms => ms.map(m => avg(monthAttendance(m)[k]));
  const n = f => state.profiles.filter(f).length;
  const tile = (v, t) => h('div', { class: 'card stat-tile' }, h('strong', null, v), h('span', null, t));
  const reportsBox = h('div');
  if (can('secretario')) {
    const last12 = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11 + i); return d.toISOString().slice(0, 7); });
    const draw = docs => {
      const per = m => docs.filter(r => r.mes === m);
      reportsBox.replaceChildren(
        h('h2', { class: 'group' }, 'Informes (últimos 12 meses)'),
        h('div', { class: 'card', style: { padding: '14px', marginBottom: '12px' } }, h('strong', null, 'Hermanos que informaron'),
          barChart(last12.map(shortMonthLabel), [{ name: 'Informaron', values: last12.map(m => per(m).length) }], { title: 'Hermanos que informaron' })),
        h('div', { class: 'card', style: { padding: '14px', marginBottom: '12px' } }, h('strong', null, 'Precursores cada mes'),
          barChart(last12.map(shortMonthLabel), [
            { name: 'Auxiliares', values: last12.map(m => per(m).filter(r => r.grupo === 'aux').length) },
            { name: 'Regulares', values: last12.map(m => per(m).filter(r => r.grupo === 'reg').length) }], { title: 'Precursores' })),
        h('div', { class: 'card', style: { padding: '14px', marginBottom: '12px' } }, h('strong', null, 'Cursos bíblicos'),
          barChart(last12.map(shortMonthLabel), [{ name: 'Cursos', values: last12.map(m => per(m).reduce((a, r) => a + (r.cursos || 0), 0)) }], { title: 'Cursos bíblicos' })));
    };
    if (statsCache && statsCache.key === last12.join()) draw(statsCache.docs);
    else {
      reportsBox.replaceChildren(h('p', { class: 'muted' }, 'Cargando informes…'));
      F.getDocs(F.query(F.collection(F.db, 'congregaciones', nube.cong, 'informes'), F.where('mes', 'in', last12)))
        .then(s => { statsCache = { key: last12.join(), docs: s.docs.map(d => d.data()) }; if (view.name === 'estadisticas') draw(statsCache.docs); })
        .catch(e => reportsBox.replaceChildren(h('p', { class: 'err' }, errMsg(e))));
    }
  }
  return h('div', null,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Estadísticas'),
      h('p', { class: 'sub', style: { margin: 0 } }, `Año de servicio ${sy}-${sy + 1}. Toca o pasa el ratón sobre una barra para ver el número.`))),
    state.profiles.length ? h('div', { class: 'stat-tiles' },
      tile(state.profiles.length, 'Hermanos'), tile(n(p => p.bautizado), 'Bautizados'), tile(n(p => p.nombramiento === 'anciano'), 'Ancianos'),
      tile(n(p => p.nombramiento === 'sm'), 'Siervos ministeriales'), tile(n(p => p.tipo === 'reg'), 'Precursores regulares')) : null,
    h('h2', { class: 'group' }, 'Asistencia a las reuniones (promedio por mes)'),
    h('div', { class: 'card', style: { padding: '14px', marginBottom: '12px' } },
      months.length && months.some(m => avg(monthAttendance(m).entre) != null || avg(monthAttendance(m).fin) != null)
        ? barChart(months.map(shortMonthLabel), [{ name: 'Entre semana', values: att('entre')(months) }, { name: 'Fin de semana', values: att('fin')(months) }], { title: 'Asistencia' })
        : h('p', { class: 'muted', style: { margin: 0 } }, 'Todavía no hay asistencia anotada este año. Se anota en Asistencia.'),
      prevMonths.some(m => avg(monthAttendance(m).fin) != null) ? h('p', { class: 'small-text muted', style: { margin: '8px 0 0' } },
        `Año anterior: entre semana ${yearAverage(prevMonths, 'entre')}, fin de semana ${yearAverage(prevMonths, 'fin')}.`) : null),
    reportsBox);
}
const yearAverage = (ms, k) => { const v = ms.map(m => avg(monthAttendance(m)[k])).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : '—'; };

// ---------- búsqueda rápida (lupa de arriba o Ctrl+K) ----------
function openSearch() {
  if (document.querySelector('dialog.search-dlg')) return;
  const input = h('input', { type: 'search', placeholder: 'Buscar hermano, sección, anuncio o evento…', autocomplete: 'off' });
  const box = h('div', { class: 'search-results' });
  let items = [], at = 0;
  const close = () => { dlg.close(); dlg.remove(); };
  const pick = it => { close(); it.go(); };
  const upcoming = pid => {
    const today = todayISO(), out = [];
    for (const q of state.programs) if (q.date >= mondayOf(today)) for (const x of assignmentsOf(q)) if (x.pid === pid) out.push(`${fmtShort(q.date)} · ${roleLabel(x.row, x.slot)}`);
    return out.sort().slice(0, 2);
  };
  const fill = () => {
    const q = norm(input.value.trim());
    items = [];
    if (q) {
      for (const [v, t] of navItems(true)) if (norm(t).includes(q)) items.push({ ic: v, t, s: 'Sección', go: () => go({ name: v }) });
      if (isElder()) for (const pr of state.profiles) if ((' ' + norm(pr.name)).includes(' ' + q)) {
        const next = upcoming(pr.id);
        items.push({ ic: 'person', t: pr.name, s: [pr.nombramiento ? nomLabel(pr.nombramiento) : 'Hermano', next.length ? 'Próxima: ' + next[0] : ''].filter(Boolean).join(' · '),
          go: () => can('programa') ? openProfileDialog(pr) : go({ name: 'people' }) });
      }
      for (const a of FB_CONFIG ? visibleAnnouncements() : []) if (norm(`${a.titulo} ${a.texto}`).includes(q)) items.push({ ic: 'anuncios', t: a.titulo, s: 'Anuncio', go: () => go({ name: 'anuncios' }) });
      for (const e of FB_CONFIG ? nube.eventos : []) if (norm(evTitle(e)).includes(q)) items.push({ ic: 'calendario', t: evTitle(e), s: 'Evento · ' + fmtRange(e), go: () => go({ name: 'calendario' }) });
      for (const p of state.programs) if (norm(p.title || '').includes(q)) items.push({ ic: 'list', t: 'Semana ' + p.title, s: 'Programa', go: () => go({ name: 'edit', id: p.id }) });
    }
    items = items.slice(0, 30); at = Math.min(at, Math.max(0, items.length - 1));
    box.replaceChildren(...(items.length ? items.map((it, i) => h('button', { class: 'search-item' + (i === at ? ' on' : ''), onclick: () => pick(it), onmousemove: () => { if (at !== i) { at = i; fill(); } } },
      h('span', { class: 'search-ic' }, icon(it.ic, 18)), h('span', { class: 'search-txt' }, h('strong', null, it.t), h('small', null, it.s))))
      : [h('div', { class: 'search-empty' }, q ? 'Nada coincide.' : 'Escribe para buscar. Usa ↑ ↓ y Enter para elegir.')]));
  };
  input.addEventListener('input', () => { at = 0; fill(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); at = Math.max(0, Math.min(items.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1))); fill(); const on = box.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && items[at]) { e.preventDefault(); pick(items[at]); }
  });
  const dlg = h('dialog', { class: 'dlg search-dlg', onclick: e => { if (e.target === dlg) close(); } },
    h('div', { class: 'search-head' }, h('span', { class: 'search-lens' }, icon('search', 20)), input, h('kbd', null, 'Esc')), box);
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  fill();
  document.body.append(dlg); dlg.showModal(); input.focus();
}
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && (!FB_CONFIG || nube.listo)) { e.preventDefault(); openSearch(); }
});
