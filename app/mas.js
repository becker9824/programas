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

// ---------- avisos al celular (Firebase Cloud Messaging) ----------
// Cada celular guarda su token en avisos/{uid} = { perfil, tokens: [hasta 3] }; el intermediario (intermediario/avisos.js)
// los manda. En la web llegan al service worker (sw.js, evento push); en el APK, con el plugin PushNotifications.
// En la app de PC no hay avisos de este tipo.
const VAPID = 'BER4_t75U3fRWKCERfXVQQVelyZwRM-86UbTwbvZcBnX44pw3Ms44cEAYFkUH-PbJ3tFMgfPLJSGnoMwbazjKNw';
const PushN = NATIVE ? capacitorExports.registerPlugin('PushNotifications') : null;
const pushKey = () => 'avisos-' + (nube.user ? nube.user.uid : '');
const pushOn = () => { try { return !!localStorage.getItem(pushKey()); } catch (e) { return false; } };
const messaging = () => import(new URL('vendor/firebase/firebase-messaging.js', location.href).href);
async function pushSupported() {
  if (!FB_CONFIG || EMU) return false;
  if (NATIVE) return true;
  if (location.protocol === 'app:' || !('serviceWorker' in navigator) || !('Notification' in window)) return false;
  try { return await (await messaging()).isSupported(); } catch (e) { return false; }
}
// ask: pedir permiso (al tocar "Activar"); sin ask solo se renueva el token si ya se dio permiso
async function pushToken(ask) {
  if (NATIVE) {
    let perm = await PushN.checkPermissions();
    if (perm.receive !== 'granted' && ask) perm = await PushN.requestPermissions();
    if (perm.receive !== 'granted') throw new Error('permiso');
    return new Promise((ok, no) => {
      PushN.addListener('registration', t => ok(t.value));
      PushN.addListener('registrationError', e => no(new Error(e.error || 'registro')));
      PushN.register();
    });
  }
  if (Notification.permission !== 'granted' && (!ask || await Notification.requestPermission() !== 'granted')) throw new Error('permiso');
  const m = await messaging();
  return m.getToken(m.getMessaging(), { vapidKey: VAPID, serviceWorkerRegistration: await navigator.serviceWorker.ready });
}
async function enablePush(ask = true) {
  const token = await pushToken(ask);
  const ref = congRef('avisos', nube.user.uid), cur = await F.getDoc(ref).then(s => s.exists() ? s.data().tokens || [] : [], () => []);
  await F.setDoc(ref, { perfil: nube.me.perfil || null, tokens: [...cur.filter(t => t !== token), token].slice(-3), actualizado: F.serverTimestamp() });
  try { localStorage.setItem(pushKey(), token); } catch (e) {}
  if (NATIVE) scheduleReminders(); // ya no hace falta el recordatorio local de “mañana”
  return token;
}
async function disablePush() {
  let token = null;
  try { token = localStorage.getItem(pushKey()); localStorage.removeItem(pushKey()); } catch (e) {}
  if (!token) return;
  const ref = congRef('avisos', nube.user.uid), cur = await F.getDoc(ref).then(s => s.exists() ? s.data().tokens || [] : [], () => []);
  await F.setDoc(ref, { perfil: nube.me.perfil || null, tokens: cur.filter(t => t !== token), actualizado: F.serverTimestamp() }).catch(() => {});
  if (NATIVE) { PushN.unregister().catch(() => {}); scheduleReminders(); }
}
// Pide al intermediario que mande; va por tandas hasta terminar. Devuelve { enviados, sinCelular }.
async function sendPush(payload) {
  const auth = 'Bearer ' + await F.auth.currentUser.getIdToken();
  let desde = 0, enviados = 0, sinCelular = 0;
  for (let i = 0; i < 40 && desde != null; i++) {
    const r = await fetch(JW_PROXY + '/avisos/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ cong: nube.cong, desde, ...payload }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'No se pudo mandar el aviso');
    enviados += j.enviados || 0; if (!i) sinCelular = j.sinCelular || 0; desde = j.siguiente;
  }
  return { enviados, sinCelular };
}
// Al abrir: renueva el token si ya estaban activados; al tocar un aviso, abre su sección
function startPush() {
  if (!FB_CONFIG || EMU) return;
  if (NATIVE) {
    PushN.addListener('pushNotificationActionPerformed', a => {
      const d = (a.notification && a.notification.data) || {};
      if (d.vista && navItems(true).some(i => i[0] === d.vista)) go({ name: d.vista });
      if (d.confirmar) askConfirm(d.confirmar);
    });
    // Con la app abierta Android no muestra el aviso: se muestra como recordatorio del celular
    PushN.addListener('pushNotificationReceived', n => LN.schedule({ notifications: [{ id: Math.floor(Math.random() * 2e9), title: n.title || 'Programas', body: n.body || '' }] }).catch(() => {}));
  }
  if (pushOn()) enablePush(false).catch(() => {});
  const q = new URLSearchParams(location.search), ir = q.get('ir'), conf = q.get('confirmar');
  if (ir && navItems(true).some(i => i[0] === ir)) go({ name: ir });
  if (conf) askConfirm(conf);
  if (ir || conf) history.replaceState(null, '', location.pathname);
}
// Al tocar el recordatorio de una asignación: “¿La recibiste?” con un solo botón
function askConfirm(key) {
  const x = myAssignments(myWeeks()).find(y => y.key === key);
  if (!x) return;
  if (confirmedOn(nube.me.perfil, key)) return toast('Ya habías confirmado esta asignación. ¡Gracias!');
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, '📋 ' + x.title), h('p', { style: { margin: 0 } }, x.when),
      x.role ? h('p', { class: 'muted', style: { margin: 0 } }, x.role + (x.with ? ` · con ${x.with}` : '')) : null,
      h('p', { class: 'muted small-text', style: { margin: 0 } }, 'Avísale al encargado que ya la viste.')),
    h('div', { class: 'dlg-foot' }, h('button', { class: 'btn', onclick: close }, 'Después'),
      h('button', { class: 'btn primary', onclick: () => { close(); confirmAssignment(key); } }, '✔ Recibido')));
  document.body.append(dlg); dlg.showModal();
}
// Tarjeta para activar o apagar los avisos (Ajustes y, mientras no estén activos, Inicio)
function pushCard(compact) {
  const box = h('div', { class: compact ? 'card push-card' : 'push-card-flat' });
  const paint = async () => {
    if (!(await pushSupported())) { box.replaceChildren(compact ? '' : h('p', { class: 'muted small-text' }, location.protocol === 'app:'
      ? '🔔 Los avisos al celular llegan en la app del celular o en la página web; en la app de PC no.' : '🔔 Este navegador no puede recibir avisos.')); if (compact) box.remove(); return; }
    const on = pushOn();
    if (compact && (on || (() => { try { return localStorage.getItem('avisos-no-' + nube.user.uid); } catch (e) { return null; } })())) { box.remove(); return; }
    box.replaceChildren(
      h('div', { class: 'push-ic' }, '🔔'),
      h('div', { class: 'push-txt' }, h('strong', null, on ? 'Avisos activados en este equipo' : 'Recibe avisos en este celular'),
        h('span', { class: 'muted small-text' }, on ? 'Te llegan tus asignaciones, los anuncios y el recordatorio del informe.' : 'Tus asignaciones, los anuncios y el recordatorio del informe, aunque no abras la app.')),
      h('div', { class: 'row' },
        on ? h('button', { class: 'btn small', onclick: async e => { e.target.disabled = true; try { const r = await sendPush({ tipo: 'prueba' }); toast(r.enviados ? 'Aviso de prueba enviado' : 'No se pudo entregar; vuelve a activarlos'); } catch (x) { toast(x.message); } e.target.disabled = false; } }, 'Probar') : null,
        on ? h('button', { class: 'btn small', onclick: async () => { await disablePush(); toast('Avisos apagados en este equipo'); paint(); } }, 'Apagar')
          : h('button', { class: 'btn small primary', onclick: async e => {
            e.target.disabled = true;
            try { await enablePush(true); toast('¡Listo! Los avisos están activados'); paint(); }
            catch (x) { e.target.disabled = false; toast(x.message === 'permiso' ? 'Hay que permitir las notificaciones (en los ajustes del celular o del navegador).' : 'No se pudieron activar: ' + x.message); }
          } }, 'Activar'),
        compact && !on ? h('button', { class: 'btn small', onclick: () => { try { localStorage.setItem('avisos-no-' + nube.user.uid, '1'); } catch (e) {} box.remove(); } }, 'Ahora no') : null));
  };
  paint();
  return box;
}

// ---------- pantalla del Salón del Reino ----------
// Pantalla completa para una tele o monitor: programa de la semana, fin de semana, mecánicas y avisos.
// Cambia sola cada 20 segundos (o con las flechas), toma los datos de nuevo en cada cambio. Solo muestra
// anuncios compartidos con la congregación (nunca los de solo ancianos). Esc o “Salir” la cierra.
function openKiosk() {
  if (document.querySelector('.kiosk')) return;
  let at = 0, timer = null;
  const stage = h('div', { class: 'kiosk-stage' }), dots = h('div', { class: 'kiosk-dots' }), clock = h('div', { class: 'kiosk-clock' });
  const today = () => todayISO();
  const slides = () => {
    const weeks = myWeeks(), t = today();
    const lastDay = w => [w.day || addDays(w.date, 6), w.fin && w.fin.day, ...(w.mec || []).map(m => m.day)].filter(Boolean).sort().pop();
    const w = weeks.find(x => lastDay(x) >= t), out = [];
    if (w) {
      const names = r => ['a', 'b', 'xa', 'xb'].filter(k => r[k]).map(k => (r.labels[k] ? r.labels[k] + ': ' : '') + r[k].n).join(' · ');
      out.push(h('div', { class: 'k-slide' }, h('div', { class: 'k-kicker' }, 'Reunión de entre semana'), h('h2', null, w.meeting),
        h('div', { class: 'k-rows' }, w.rows.filter(r => r.kind !== 'song' || names(r)).slice(0, 14).map(r => h('div', { class: 'k-row' },
          h('span', { class: 'k-time' }, r.time), h('span', { class: 'k-t' }, r.t), h('span', { class: 'k-n' }, names(r)))))));
      const fin = (w.mec || []).find(m => m.mtg === 'fin');
      if (w.fin || fin) out.push(h('div', { class: 'k-slide' }, h('div', { class: 'k-kicker' }, 'Reunión del fin de semana'),
        h('h2', null, capFirst(toDate((w.fin && w.fin.day) || (fin && fin.day)).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }))),
        w.fin ? h('div', { class: 'k-big' }, h('small', null, 'Discurso público' + (w.fin.bosquejo ? ` · núm. ${w.fin.bosquejo}` : '')), h('strong', null, w.fin.tema || '—'),
          h('span', null, w.fin.orador ? `${w.fin.orador}${w.fin.cong ? ' · ' + w.fin.cong : ''}` : '')) : null,
        fin ? h('div', { class: 'k-grid' }, fin.items.filter(i => ['presidente', 'lector'].includes(i.k)).map(i => h('div', null, h('small', null, i.l), h('strong', null, i.n)))) : null));
      if ((w.mec || []).length) out.push(h('div', { class: 'k-slide' }, h('div', { class: 'k-kicker' }, 'Asignaciones mecánicas'), h('h2', null, w.title),
        h('div', { class: 'k-cols' }, w.mec.map(m => h('div', null, h('h3', null, m.label),
          m.items.map(i => h('div', { class: 'k-pair' }, h('small', null, i.l), h('strong', null, i.n))))))));
    }
    const ann = FB_CONFIG ? nube.anuncios.filter(a => a.publico && (!a.vence || a.vence >= t)).sort((a, b) => b.fijado - a.fijado || stampMs(b.fecha) - stampMs(a.fecha)).slice(0, 4) : [];
    const evs = FB_CONFIG ? nube.eventos.filter(e => (e.hasta || e.desde) >= t).sort((a, b) => a.desde.localeCompare(b.desde)).slice(0, 4) : [];
    const clean = FB_CONFIG ? cleaningOf(mondayOf(t)) : '';
    if (ann.length || evs.length || clean) out.push(h('div', { class: 'k-slide' }, h('div', { class: 'k-kicker' }, 'Avisos'), h('h2', null, congName() || 'Congregación'),
      h('div', { class: 'k-cols' },
        ann.length ? h('div', null, h('h3', null, '📢 Anuncios'), ann.map(a => h('div', { class: 'k-pair' }, h('strong', null, annType(a).emoji + ' ' + a.titulo),
          a.cuando ? h('small', null, fmtShort(a.cuando)) : null))) : null,
        evs.length || clean ? h('div', null,
          evs.length ? [h('h3', null, '📅 Próximos eventos'), evs.map(e => h('div', { class: 'k-pair' }, h('strong', null, evTitle(e)), h('small', null, fmtRange(e))))] : null,
          clean ? [h('h3', null, '🧹 Limpieza esta semana'), h('div', { class: 'k-pair' }, h('strong', null, clean))] : null) : null)));
    return out.length ? out : [h('div', { class: 'k-slide' }, h('h2', null, congName() || 'Programas'), h('p', null, 'Todavía no hay programa publicado para esta semana.'))];
  };
  const show = () => {
    const list = slides(); at = (at + list.length) % list.length;
    stage.replaceChildren(list[at]);
    dots.replaceChildren(...list.map((_, i) => h('span', { class: i === at ? 'on' : '' })));
  };
  const step = d => { at += d; show(); clearInterval(timer); timer = setInterval(() => step(1), 20000); };
  const tick = () => { clock.textContent = new Date().toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' }); };
  const close = () => { clearInterval(timer); clearInterval(clock.t); removeEventListener('keydown', keys); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); el.remove(); };
  const keys = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); };
  const el = h('div', { class: 'kiosk' },
    h('div', { class: 'kiosk-top' }, h('div', { class: 'kiosk-brand' }, h('span', { class: 'logo' }), congName() || 'Programas'), clock,
      h('div', { class: 'kiosk-ctl' },
        h('button', { onclick: () => (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen()).catch(() => {}) }, '⛶'),
        h('button', { onclick: close }, 'Salir'))),
    stage, dots);
  el.querySelector('.logo').replaceWith(logo(30));
  addEventListener('keydown', keys);
  el.addEventListener('click', e => { if (!e.target.closest('button')) step(1); });
  document.body.append(el);
  tick(); clock.t = setInterval(tick, 15000);
  show(); timer = setInterval(() => step(1), 20000);
  el.requestFullscreen && el.requestFullscreen().catch(() => {});
}
function renderKioskPage() {
  return h('div', null,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Pantalla del Salón'),
      h('p', { class: 'sub', style: { margin: 0 } }, 'Para una tele o monitor en el Salón del Reino: muestra el programa de la semana, el fin de semana, las mecánicas y los avisos, y cambia sola cada 20 segundos.'))),
    h('div', { class: 'card kiosk-intro' },
      h('div', { class: 'kiosk-preview' }, icon('pantalla', 54)),
      h('div', null,
        h('ul', null,
          h('li', null, 'Se actualiza sola cuando cambia el programa.'),
          h('li', null, 'Solo salen los anuncios compartidos con la congregación (nunca los de solo ancianos).'),
          h('li', null, 'Flechas ← → para cambiar; Esc o “Salir” para cerrar. Tocar la pantalla pasa a la siguiente.'),
          h('li', null, 'Consejo: en la computadora del Salón, abre la web, entra con una cuenta y deja esta pantalla abierta.')),
        h('button', { class: 'btn primary', style: { marginTop: '8px' }, onclick: openKiosk }, '📺 Abrir pantalla completa'))));
}

// ---------- lista para configurar una congregación nueva (coordinador, en Inicio) ----------
// Se marca sola según lo que ya existe; se oculta al terminar o con “Ocultar”.
function setupChecklist() {
  if (!FB_CONFIG || !isAdmin()) return null;
  const hideKey = 'config-oculta-' + nube.cong;
  try { if (localStorage.getItem(hideKey)) return null; } catch (e) {}
  const steps = [
    ['Agrega a los hermanos', 'Uno por uno o con una lista de Excel.', state.profiles.length >= 3, () => go({ name: 'people' })],
    ['Invita a los hermanos a la app', 'Comparte el código de la congregación (en Hermanos).', nube.miembros.length > 1, () => go({ name: 'people' })],
    ['Une tu cuenta con tu nombre', 'En Hermanos → Cuentas, elige tu nombre.', !!nube.me.perfil, () => go({ name: 'people' })],
    ['Carga el programa de las reuniones', 'En Semanas, las guías de jw.org se bajan solas.', state.programs.some(p => p.date >= mondayOf(todayISO())), () => go({ name: 'list' })],
    ['Arma los grupos de servicio', 'Para informes, limpieza y predicación.', nube.grupos.length > 0, () => go({ name: 'grupos' })],
    ['Activa los avisos en tu celular', 'Para recibir anuncios y recordatorios.', pushOn(), () => go({ name: 'settings' })],
  ];
  const done = steps.filter(s => s[2]).length;
  if (done === steps.length) return null;
  const box = h('div', { class: 'card setup' },
    h('div', { class: 'row spread' }, h('div', null, h('strong', null, '🚀 Configura tu congregación'),
      h('div', { class: 'muted small-text' }, `${done} de ${steps.length} pasos listos`)),
      h('button', { class: 'linkbtn', onclick: () => { try { localStorage.setItem(hideKey, '1'); } catch (e) {} box.remove(); } }, 'Ocultar')),
    h('div', { class: 'setup-bar' }, h('span', { style: { width: (done / steps.length * 100) + '%' } })),
    steps.map(([t, s, ok, fn]) => h('button', { class: 'setup-step' + (ok ? ' ok' : ''), onclick: fn },
      h('span', { class: 'setup-check' }, ok ? '✓' : ''), h('span', { class: 'setup-txt' }, h('strong', null, t), h('small', null, s)), ok ? null : icon('chev', 16))));
  return box;
}

// ---------- cargar hermanos desde una lista de Excel o CSV (Programa VyM) ----------
// Columnas que reconoce (en cualquier orden, la primera fila son los títulos): Nombre, Sexo, Edad o Nacimiento,
// Nombramiento, Bautizado, Teléfono, Dirección. Los que ya existen (mismo nombre) se saltan.
const IMPORT_COLS = { name: ['nombre', 'nombre completo', 'hermano', 'hermana', 'publicador'], sex: ['sexo', 'genero'], age: ['edad'],
  born: ['nacimiento', 'fecha de nacimiento'], nom: ['nombramiento', 'privilegio'], bapt: ['bautizado', 'bautizada', 'bautismo'],
  tel: ['telefono', 'celular', 'tel', 'whatsapp'], dir: ['direccion', 'domicilio'] };
function parseCSV(text) {
  const first = text.split('\n')[0], sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim()));
}
async function readTable(file) {
  if (/\.(csv|txt)$/i.test(file.name)) return parseCSV((await file.text()).replace(/^﻿/, ''));
  const X = await loadExcel(), wb = new X.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0], rows = [];
  const plain = v => v && typeof v === 'object' && !(v instanceof Date) ? (v.text || v.result || (v.richText || []).map(t => t.text).join('')) : v;
  ws.eachRow(r => rows.push(r.values.slice(1).map(plain)));
  return rows;
}
function rowsToPeople(rows) {
  const head = (rows[0] || []).map(x => norm(String(x || '')).trim());
  const idx = Object.fromEntries(Object.keys(IMPORT_COLS).map(k => [k, head.findIndex(x => IMPORT_COLS[k].includes(x))]));
  if (idx.name < 0) throw new Error('No encontré la columna “Nombre” en la primera fila.');
  const get = (r, k) => idx[k] < 0 ? '' : (r[idx[k]] ?? '');
  // Sexo: H/M (hombre/mujer) o M/F (masculino/femenino), según lo que traiga la lista
  const hScheme = rows.slice(1).some(r => { const v = norm(String(get(r, 'sex'))).trim(); return v === 'h' || v.startsWith('hom'); });
  const sexOf = v => {
    v = norm(String(v)).trim();
    if (!v) return null;
    if (v.startsWith('hom') || v.startsWith('var') || v.startsWith('masc') || v === 'h' || (v === 'm' && !hScheme)) return 'M';
    if (v.startsWith('muj') || v.startsWith('fem') || v === 'f' || (v === 'm' && hScheme)) return 'F';
    return null;
  };
  const dateOf = v => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    v = String(v).trim();
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  };
  const ageFrom = iso => { const b = toDate(iso), n = new Date(); return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0); };
  return rows.slice(1).map(r => {
    const name = squash(String(get(r, 'name'))), sex = sexOf(get(r, 'sex')), born = dateOf(get(r, 'born'));
    const nomV = norm(String(get(r, 'nom'))).trim();
    const nombramiento = sex === 'M' ? (nomV.includes('anc') ? 'anciano' : /siervo|ministerial|^sm$/.test(nomV) ? 'sm' : '') : '';
    const ageV = parseInt(get(r, 'age'), 10);
    return { name, sex, nombramiento, born, age: born ? ageFrom(born) : Number.isFinite(ageV) ? ageV : null,
      bautizado: /^(si|sí|x|1|true|yes|s)$/i.test(String(get(r, 'bapt')).trim()) || !!nombramiento,
      tel: squash(String(get(r, 'tel'))), dir: squash(String(get(r, 'dir'))), dup: !!profByName(name) };
  }).filter(p => p.name);
}
function openImportDialog() {
  const fileI = h('input', { type: 'file', accept: '.xlsx,.csv,.txt' });
  const box = h('div'), err = h('div', { class: 'err' });
  let people = [];
  const close = () => { dlg.close(); dlg.remove(); };
  const addBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => {
    const add = people.filter(p => !p.dup && p.sex);
    for (const p of add) {
      // Ancianos y siervos ministeriales: con los privilegios de su nombramiento; los demás, sin marcar (salen para todo)
      const preset = PRIV_PRESETS.find(x => x[2] && x[2] === p.nombramiento);
      const prof = { id: uid(), name: p.name, sex: p.sex, age: p.age, notes: '', familyId: null, tipo: 'pub', auxMeses: [], nombramiento: p.nombramiento,
        situacion: '', bautizado: p.bautizado, capitan: false, nacimiento: p.born, bautismoFecha: null, esperanza: '' };
      if (preset) prof.puede = [...preset[1]];
      state.profiles.push(prof);
      if (FB_CONFIG && (p.tel || p.dir) && isElder()) F.setDoc(congRef('contactos', prof.id), { tel: p.tel, dir: p.dir, emergencia: '', emergenciaTel: '' }).catch(() => {});
    }
    save(); refreshDatalist();
    if (FB_CONFIG) logChange(`Cargó ${add.length} hermanos desde una lista`);
    close(); render(); toast(`Se agregaron ${add.length} hermano${add.length === 1 ? '' : 's'}`);
  } }, 'Agregar');
  fileI.addEventListener('change', async () => {
    err.textContent = ''; box.replaceChildren(h('p', { class: 'muted' }, 'Leyendo…'));
    try {
      people = rowsToPeople(await readTable(fileI.files[0]));
      const ok = people.filter(p => !p.dup && p.sex), dups = people.filter(p => p.dup).length, nosex = people.filter(p => !p.sex).length;
      box.replaceChildren(h('p', { class: 'small-text' }, `${people.length} en la lista · `, h('strong', null, `${ok.length} nuevos`),
        dups ? ` · ${dups} ya existen (se saltan)` : '', nosex ? ` · ${nosex} sin sexo (se saltan)` : ''),
        h('div', { class: 'tablewrap', style: { maxHeight: '45vh' } }, h('table', { class: 'stats' },
          h('thead', null, h('tr', null, ['Nombre', 'Sexo', 'Edad', 'Nombramiento', ''].map(t => h('th', null, t)))),
          h('tbody', null, people.map(p => h('tr', { class: p.dup || !p.sex ? 'muted' : null },
            h('td', null, p.name), h('td', null, p.sex === 'M' ? 'Hombre' : p.sex === 'F' ? 'Mujer' : '¿?'), h('td', null, p.age ?? '—'),
            h('td', null, nomLabel(p.nombramiento) === 'Ninguno' ? '—' : nomLabel(p.nombramiento)), h('td', { class: 'small-text' }, p.dup ? 'Ya existe' : !p.sex ? 'Falta el sexo' : '✓')))))));
      addBtn.disabled = !ok.length; addBtn.textContent = `Agregar ${ok.length} hermano${ok.length === 1 ? '' : 's'}`;
    } catch (e) { box.replaceChildren(); err.textContent = e.message || 'No se pudo leer el archivo.'; }
  });
  const template = () => saveBlob(new Blob(['﻿Nombre,Sexo,Edad,Nombramiento,Bautizado,Teléfono,Dirección\nJuan Pérez,Hombre,45,Anciano,Sí,,\nMaría López,Mujer,32,,Sí,,\n'], { type: 'text/csv' }), 'plantilla-hermanos.csv');
  const dlg = h('dialog', { class: 'dlg wide' },
    h('div', { class: 'dlg-body' }, h('h3', null, 'Cargar hermanos desde Excel'),
      h('p', { class: 'muted small-text', style: { margin: 0 } }, 'La primera fila lleva los títulos: Nombre, Sexo (Hombre/Mujer), Edad o Nacimiento, Nombramiento (Anciano/Siervo ministerial), Bautizado (Sí), Teléfono y Dirección. Solo “Nombre” y “Sexo” son necesarios.'),
      h('div', { class: 'row' }, fileI, h('button', { class: 'btn small', onclick: template }, '⬇ Plantilla de ejemplo')),
      box, err),
    h('div', { class: 'dlg-foot' }, h('button', { class: 'btn', onclick: close }, 'Cancelar'), addBtn));
  document.body.append(dlg); dlg.showModal();
}

// ---------- tamaño de letra (en cada equipo; para quien ve mejor con letra grande) ----------
const TEXT_SIZES = [['1', 'Normal'], ['1.12', 'Grande'], ['1.25', 'Muy grande']];
const textSize = () => { try { return localStorage.getItem('letra') || '1'; } catch (e) { return '1'; } };
function applyTextSize() { document.documentElement.style.zoom = textSize() === '1' ? '' : textSize(); }
applyTextSize();
function textSizeRow() {
  const box = h('div', { class: 'chips wide', style: { margin: '6px 0 0' } });
  const paint = () => box.replaceChildren(...TEXT_SIZES.map(([v, t], i) => h('button', { class: textSize() === v ? 'on' : '', style: { fontSize: (13 + i * 2) + 'px' },
    onclick: () => { try { localStorage.setItem('letra', v); } catch (e) {} applyTextSize(); paint(); } }, t)));
  paint();
  return h('div', { style: { margin: '10px 0' } }, h('strong', { class: 'small-text' }, '🔠 Tamaño de letra (en este equipo)'), box);
}
