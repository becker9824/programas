// Programas · Grupos, WhatsApp, fin de semana, asistencia, S-21, calendario y arreglos.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- sección Grupos (grupos de servicio del campo) ----------
// Los ven los ancianos; los arman el secretario y el coordinador. Cada hermano está en un solo grupo.
function groupStats(people) {
  const n = f => people.filter(f).length;
  return [['Hermanos', people.length], ['Publicadores', n(p => p.tipo !== 'no')], ['Precursores regulares', n(p => p.tipo === 'reg')], ['Precursores auxiliares este mes', n(p => auxIn(p, todayISO().slice(0, 7)))],
    ['Ancianos', n(p => p.nombramiento === 'anciano')], ['Siervos ministeriales', n(p => p.nombramiento === 'sm')], ['Bautizados', n(p => p.bautizado)]];
}
const statsRow = people => h('div', { class: 'totals' }, groupStats(people).map(([label, v]) => h('span', null, h('strong', null, v), ' ', label.toLowerCase())));

function openGroupDialog(g) {
  const byName = (a, b) => a.name.localeCompare(b.name, 'es');
  const nameI = h('input', { type: 'text', maxlength: 60, value: g ? g.nombre : '', placeholder: 'Ej.: Grupo 1 o Grupo Centro' });
  const men = state.profiles.filter(p => p.sex === 'M').sort(byName);
  const sel = cur => h('select', null, h('option', { value: '' }, '(Nadie)'),
    men.map(p => h('option', { value: p.id, selected: p.id === cur ? true : null }, p.name + (p.nombramiento ? ` · ${nomLabel(p.nombramiento)}` : ''))));
  const sgSel = sel(g && g.superintendente), auxSel = sel(g && g.auxiliar);
  const search = h('input', { type: 'search', placeholder: 'Buscar…', oninput: () => fillList() });
  const chosen = new Set(g ? g.miembros || [] : []);
  const list = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '4px 12px', maxHeight: '38vh', overflow: 'auto' } });
  const count = h('span', { class: 'muted small-text' });
  function fillList() {
    const f = norm(search.value);
    list.replaceChildren(...[...state.profiles].sort(byName).filter(p => !f || norm(p.name).includes(f)).map(p => {
      const other = grupoOf(p.id);
      return h('label', { class: 'row', style: { gap: '6px', color: 'var(--text)', fontSize: '14px' } },
        h('input', { type: 'checkbox', checked: chosen.has(p.id), onchange: e => { e.target.checked ? chosen.add(p.id) : chosen.delete(p.id); count.textContent = `${chosen.size} marcados`; } }),
        p.name, other && (!g || other.id !== g.id) ? h('span', { class: 'tag-fam' }, other.nombre) : null);
    }));
    count.textContent = `${chosen.size} marcados`;
  }
  fillList();
  const err = h('div', { class: 'err' });
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, g ? `Editar ${g.nombre}` : 'Nuevo grupo'),
      h('label', { class: 'field' }, 'Nombre', nameI),
      h('div', { class: 'row', style: { gap: '16px' } },
        h('label', { class: 'field', style: { flex: 1 } }, 'Superintendente de grupo', sgSel),
        h('label', { class: 'field', style: { flex: 1 } }, 'Auxiliar de grupo', auxSel)),
      h('div', { class: 'field' }, h('div', { class: 'row spread' }, h('span', null, 'Hermanos del grupo'), count),
        search, list,
        h('span', { class: 'small-text' }, 'Si marcas a alguien que está en otro grupo, se cambia a este.')),
      err),
    h('div', { class: 'dlg-foot' },
      g ? h('button', { class: 'btn danger', style: { marginRight: 'auto' }, onclick: async () => {
        if (!confirm(`¿Borrar ${g.nombre}? Sus hermanos quedan sin grupo.`)) return;
        try { await F.deleteDoc(congRef('grupos', g.id)); toast('Grupo borrado'); close(); } catch (e) { err.textContent = errMsg(e); }
      } }, 'Borrar') : null,
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async e => {
        const nombre = squash(nameI.value);
        if (!nombre) return err.textContent = 'Escribe el nombre del grupo.';
        if (nube.grupos.some(x => norm(x.nombre) === norm(nombre) && (!g || x.id !== g.id))) return err.textContent = 'Ya hay un grupo con ese nombre.';
        // El superintendente y el auxiliar también son del grupo
        for (const id of [sgSel.value, auxSel.value]) if (id) chosen.add(id);
        if (sgSel.value && sgSel.value === auxSel.value) return err.textContent = 'El superintendente y el auxiliar deben ser hermanos distintos.';
        const data = { nombre, superintendente: sgSel.value || null, auxiliar: auxSel.value || null, miembros: [...chosen] };
        e.target.disabled = true;
        try {
          const id = g ? g.id : F.doc(F.collection(F.db, 'congregaciones', nube.cong, 'grupos')).id;
          // Quien se pasó a este grupo sale del anterior
          await Promise.all(nube.grupos.filter(x => x.id !== id).map(x => {
            const moved = (x.miembros || []).filter(pid => chosen.has(pid));
            const patch = moved.length ? { miembros: F.arrayRemove(...moved) } : {};
            if (chosen.has(x.superintendente)) patch.superintendente = null;
            if (chosen.has(x.auxiliar)) patch.auxiliar = null;
            return Object.keys(patch).length ? F.updateDoc(congRef('grupos', x.id), patch) : null;
          }));
          await F.setDoc(congRef('grupos', id), data);
          toast('Grupo guardado'); logChange(`Guardó el grupo ${nombre}`); close();
        } catch (ex) { err.textContent = errMsg(ex); e.target.disabled = false; }
      } }, 'Guardar')));
  document.body.append(dlg); dlg.showModal(); if (!g) nameI.focus();
}

function renderGroups() {
  const editor = can('secretario');
  const groups = [...nube.grupos].sort(byGrupo);
  const name = id => { const p = id && profById(id); return p ? p.name : '—'; };
  const free = state.profiles.filter(p => !grupoOf(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const tags = p => [p.nombramiento ? h('span', { class: 'tag-fam', style: { color: 'var(--accent)' } }, nomLabel(p.nombramiento)) : null,
    pioneerTag(p) ? h('span', { class: 'tag-fam' }, pioneerTag(p)) : null];
  const card = g => {
    const people = (g.miembros || []).map(profById).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return h('div', { class: 'card', style: { padding: '14px', marginBottom: '12px' } },
      h('div', { class: 'row spread', style: { alignItems: 'flex-start' } },
        h('div', null, h('strong', { style: { fontSize: '17px' } }, g.nombre),
          h('div', { class: 'small-text', style: { marginTop: '4px' } }, 'Superintendente: ', h('strong', null, name(g.superintendente)), ' · Auxiliar: ', h('strong', null, name(g.auxiliar)))),
        editor ? h('button', { class: 'btn small', onclick: () => openGroupDialog(g) }, 'Editar') : null),
      statsRow(people),
      h('div', { class: 'hist', style: { marginTop: '8px' } },
        people.length ? people.map(p => h('div', null, h('span', null, p.name, p.id === g.superintendente ? ' (superintendente)' : p.id === g.auxiliar ? ' (auxiliar)' : '', ...tags(p)),
          h('span', { class: 'muted' }, p.age != null ? `${p.age} años` : '')))
          : h('div', { class: 'muted' }, 'Todavía no tiene hermanos.')));
  };
  return h('div', null,
    h('div', { class: 'row spread', style: { marginBottom: '14px' } },
      h('div', null, h('h1', null, 'Grupos'),
        h('p', { class: 'sub', style: { margin: 0 } }, editor ? 'Arma los grupos de servicio del campo: su superintendente, su auxiliar y sus hermanos.' : 'Grupos de servicio del campo. Los arman el secretario y el coordinador.')),
      editor ? h('button', { class: 'btn primary', onclick: () => openGroupDialog(null) }, '+ Nuevo grupo') : null),
    h('div', { class: 'card', style: { padding: '14px', marginBottom: '14px' } }, h('strong', null, 'Toda la congregación'), statsRow(state.profiles)),
    groups.length ? groups.map(card) : h('div', { class: 'card empty', style: { padding: '20px' } }, editor ? 'Todavía no hay grupos. Toca “+ Nuevo grupo”.' : 'Todavía no hay grupos.'),
    free.length && groups.length ? h('div', { class: 'card', style: { padding: '14px' } },
      h('strong', null, `Sin grupo (${free.length})`),
      h('div', { class: 'small-text', style: { marginTop: '6px' } }, free.map(p => p.name).join(' · '))) : null);
}

// ---------- avisar por WhatsApp ----------
// El mensaje sale de una plantilla que se cambia en Ajustes (settings.waTemplate) y, antes de
// mandarlo, se puede corregir. El teléfono sale del directorio (solo lo ven los ancianos).
const WA_TEMPLATE = 'Hola, {nombre}. Te recordamos tu asignación:\n\n*{asignacion}*\n{reunion}\n{fecha} · {hora}\n{companero}\n{sala}\n\n¡Muchas gracias!';
const WA_FIELDS = [['{nombre}', 'nombre del hermano'], ['{asignacion}', 'la asignación'], ['{reunion}', 'la reunión'], ['{fecha}', 'la fecha'],
  ['{hora}', 'la hora'], ['{companero}', 'con quién la tiene'], ['{sala}', 'la sala'], ['{congregacion}', 'la congregación']];
// Teléfono para wa.me: solo números; si no trae lada de país, se le pone la de Ajustes
function waPhone(tel) {
  const raw = (tel || '').trim(), digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+') || digits.length > 10) return digits;
  return String(state.settings.waCountry || '52').replace(/\D/g, '') + digits;
}
function waMessage(a) {
  const first = (a.nombre || '').split(' ')[0];
  const vals = { '{nombre}': first, '{asignacion}': a.asignacion, '{reunion}': a.reunion, '{fecha}': a.fecha, '{hora}': a.hora,
    '{companero}': a.companero || '', '{sala}': a.sala || '', '{congregacion}': state.settings.congregation || congName() || '' };
  // Un renglón con una palabra entre llaves que quedó vacío (por ejemplo, sin compañero) no se pone
  const lines = (state.settings.waTemplate || WA_TEMPLATE).split('\n').map(line => {
    let out = line;
    for (const [k, v] of Object.entries(vals)) out = out.split(k).join(v);
    return /\{\w+\}/.test(line) && !out.trim() ? null : out;
  }).filter(l => l !== null);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
// Todas las asignaciones de una semana (programa, sala auxiliar, mecánicas y discurso público)
function weekAssignments(p) {
  const out = [], times = timesFor(p), nm = id => (profById(id) || {}).name || '';
  const midweek = 'Reunión de entre semana', dayMid = fmtDate(meetingDate(p), 'larga');
  for (const x of slotsOf(p)) {
    if (!x.pid || !profById(x.pid)) continue;
    const r = x.row, base = baseSlot(x.slot), mate = r[mateSlot(x.slot)];
    const asignacion = isAux(x.slot) && r.kind === 'chair' ? 'Consejero de la sala auxiliar' : roleLabel(r, base);
    const companero = mate && profById(mate) && r.helper && r.kind === 'part'
      ? `${base === 'a' ? r.helper : r.helper === 'Lector' ? 'Conductor' : 'Estudiante'}: ${nm(mate)}` : '';
    out.push({ pid: x.pid, nombre: nm(x.pid), asignacion, reunion: midweek, fecha: dayMid, hora: fmtTime(times[r.id]),
      companero, sala: isAux(x.slot) && r.kind !== 'chair' ? 'Sala auxiliar' : '' });
  }
  for (const [mtg, label] of MEETINGS) for (const m of MEC) {
    if (mecLinked(p, mtg, m.key)) continue;
    const id = mecGet(p, mtg, m.key);
    if (id && profById(id)) out.push({ pid: id, nombre: nm(id), asignacion: m.label, reunion: mtg === 'entre' ? midweek : 'Reunión del fin de semana',
      fecha: fmtDate(mecDate(p, mtg), 'larga'), hora: mecTime(mtg), companero: '', sala: '' });
  }
  const f = p.fin || {};
  if (f.oradorId && profById(f.oradorId)) out.push({ pid: f.oradorId, nombre: nm(f.oradorId), asignacion: `Discurso público${f.tema ? ': ' + f.tema : ''}`,
    reunion: 'Reunión del fin de semana', fecha: fmtDate(mecDate(p, 'fin'), 'larga'), hora: mecTime('fin'), companero: '', sala: '' });
  for (const s of f.salen || []) if (s.oradorId && profById(s.oradorId)) out.push({ pid: s.oradorId, nombre: nm(s.oradorId),
    asignacion: `Discurso público${s.tema ? ': ' + s.tema : ''}${s.cong ? ' en la congregación ' + s.cong : ''}`, reunion: 'Discurso fuera de la congregación',
    fecha: s.fecha ? fmtDate(s.fecha, 'larga') : fmtDate(mecDate(p, 'fin'), 'larga'), hora: s.hora || '', companero: '', sala: '' });
  return out;
}

// Lista de la semana: a cada quien su mensaje, que se puede cambiar antes de mandarlo
function openWhatsAppDialog(p) {
  const list = weekAssignments(p);
  const box = h('div', { class: 'wa-list' });
  const close = () => { dlg.close(); dlg.remove(); };
  const sent = new Set();
  const row = (a, i) => {
    const tel = h('input', { type: 'tel', value: (nube.contactos.get(a.pid) || {}).tel || '', placeholder: 'Teléfono (opcional)' });
    const text = h('textarea', { rows: 7 }, waMessage(a));
    const status = h('span', { class: 'small-text muted' });
    const open = () => {
      const n = waPhone(tel.value);
      window.open(`https://wa.me/${n}?text=${encodeURIComponent(text.value)}`, '_blank');
      sent.add(i); status.textContent = '✓ Abierto en WhatsApp';
    };
    const editor = h('div', { class: 'wa-edit', hidden: true },
      h('label', { class: 'field' }, 'Mensaje (puedes cambiarlo antes de mandarlo)', text),
      h('div', { class: 'row', style: { gap: '8px', alignItems: 'flex-end' } },
        h('label', { class: 'field', style: { flex: 1 } }, 'Teléfono', tel),
        h('button', { class: 'btn small', onclick: () => navigator.clipboard.writeText(text.value).then(() => toast('Mensaje copiado')) }, 'Copiar'),
        h('button', { class: 'btn small primary', onclick: open }, 'Abrir WhatsApp')),
      h('span', { class: 'small-text muted' }, (nube.contactos.get(a.pid) || {}).tel ? '' : 'Sin teléfono en el directorio: WhatsApp te deja elegir el contacto.'));
    return h('div', { class: 'wa-row' },
      h('div', { class: 'row spread', style: { gap: '8px' } },
        h('div', null, h('strong', null, a.nombre), h('div', { class: 'small-text muted' }, `${a.asignacion}${a.sala ? ' · ' + a.sala : ''} · ${a.reunion}`)),
        h('div', { class: 'row', style: { gap: '6px' } }, status,
          h('button', { class: 'btn small', onclick: () => { editor.hidden = !editor.hidden; } }, 'Ver mensaje'),
          h('button', { class: 'btn small primary', onclick: open }, 'Enviar'))),
      editor);
  };
  box.append(...(list.length ? list.map(row) : [h('div', { class: 'empty' }, 'Esta semana todavía no tiene asignaciones.')]));
  const dlg = h('dialog', { class: 'dlg wide' },
    h('div', { class: 'dlg-body' }, h('h3', null, `Avisar por WhatsApp · ${p.title}`),
      h('p', { class: 'small-text muted', style: { margin: 0 } }, 'Toca “Enviar” y se abre WhatsApp con el mensaje listo; solo falta darle enviar. El texto se cambia en “Ver mensaje”, y el modelo de todos los mensajes, en Ajustes.'),
      box),
    h('div', { class: 'dlg-foot' },
      // Avisos al celular: a cada quien la suya (solo les llega a quienes los activaron)
      list.length && FB_CONFIG && !EMU ? h('button', { class: 'btn', style: { marginRight: 'auto' }, onclick: async e => {
        e.target.disabled = true; e.target.textContent = 'Avisando…';
        try {
          const r = await sendPush({ tipo: 'asignaciones', lista: list.map(a => ({ perfil: a.pid, titulo: a.asignacion,
            texto: [a.reunion, [a.fecha, a.hora].filter(Boolean).join(' · '), a.companero, a.sala].filter(Boolean).join('\n') })) });
          toast(r.enviados ? `Aviso enviado a ${r.enviados} celular${r.enviados > 1 ? 'es' : ''}${r.sinCelular ? ` · ${r.sinCelular} sin avisos activados` : ''}`
            : 'Nadie de esta semana tiene los avisos activados todavía.');
          logChange(`Mandó avisos al celular de la semana ${p.title}`);
        } catch (x) { toast(x.message); }
        e.target.disabled = false; e.target.textContent = '🔔 Avisar al celular';
      } }, '🔔 Avisar al celular') : null,
      h('button', { class: 'btn primary', onclick: close }, 'Listo')));
  document.body.append(dlg); dlg.showModal();
}

// Ajustes: el mensaje modelo
function waTemplateCard() {
  const s = state.settings;
  const area = h('textarea', { rows: 9, oninput: e => { s.waTemplate = e.target.value; save(); preview(); } }, s.waTemplate || WA_TEMPLATE);
  const sample = h('pre', { class: 'wa-preview' });
  const preview = () => { sample.textContent = waMessage({ nombre: 'Juan Pérez', asignacion: '3. Lectura de la Biblia', reunion: 'Reunión de entre semana',
    fecha: 'Miércoles, 28 de octubre de 2026', hora: '7:26', companero: '', sala: 'Sala auxiliar' }); };
  preview();
  return [
    h('h2', { class: 'group' }, 'Mensaje de WhatsApp'),
    h('div', { class: 'card settings', style: { marginTop: 0 } },
      h('p', { class: 'muted small-text', style: { margin: 0 } }, 'Es el modelo para avisar a cada hermano de su asignación. Las palabras entre llaves se cambian solas: ',
        WA_FIELDS.map(([k, d]) => `${k} ${d}`).join(' · '), '. Los renglones que quedan vacíos no se ponen.'),
      area,
      h('div', { class: 'row', style: { gap: '16px', alignItems: 'flex-end' } },
        h('label', { class: 'field' }, 'Lada del país (para los teléfonos sin ella)',
          h('input', { type: 'text', value: s.waCountry || '52', style: { width: '90px' }, oninput: e => { s.waCountry = e.target.value.replace(/\D/g, ''); save(); } })),
        h('button', { class: 'btn small', onclick: () => { s.waTemplate = WA_TEMPLATE; area.value = WA_TEMPLATE; save(); preview(); } }, 'Volver al mensaje de fábrica')),
      h('div', { class: 'small-text muted' }, 'Así se ve:'), sample)];
}

// ---------- reunión del fin de semana (función Programa VyM) ----------
// En cada semana: p.fin = { bosquejo, tema, orador, oradorId (si es de la congregación), cong, hosp,
// notas, salen: [{ orador, oradorId, cong, bosquejo, tema, fecha }] }. El presidente y el lector de
// La Atalaya son las mecánicas del fin de semana (las mismas de la sección Mecánicas).
// Los temas de los bosquejos que se escriben se recuerdan (state.talks) para no volver a escribirlos.
const finOf = p => (p.fin = p.fin || {});
// Campo con la lista de recomendados, como en Mecánicas
function mecField(p, mtg, key, onDone) {
  const id = mecGet(p, mtg, key), wrap = h('div', { style: { position: 'relative' } });
  const inp = h('input', { type: 'text', autocomplete: 'off', placeholder: 'Asignar…', value: id && profById(id) ? profById(id).name : '', style: { width: '100%' },
    onchange: e => {
      const val = squash(e.target.value);
      if (!val) { mecSet(p, mtg, key, null); save(); return; }
      const pr = profByName(val);
      if (pr) { mecSet(p, mtg, key, pr.id); save(); onDone(); } else { toast('No hay un hermano con ese nombre'); e.target.value = id && profById(id) ? profById(id).name : ''; }
    } });
  attachPicker(inp, () => mecCandidates(p, mtg, key), pid => { mecSet(p, mtg, key, pid); save(); onDone(); });
  wrap.append(inp);
  if (confirmedOn(id, `${p.id}|mec|${mtg}|${key}`)) wrap.append(h('span', { class: 'conf-mark', title: 'Confirmó que la recibió' }, '✔'));
  return wrap;
}
// Orador: si el nombre es de un hermano de la congregación se guarda también su id
// Al tocarlo sale la lista de varones de aquí (nombrados primero, con los filtros de nombrados);
// un orador de otra congregación se escribe a mano.
function speakerInput(obj) {
  const inp = h('input', { type: 'text', autocomplete: 'off', value: obj.orador || '', placeholder: 'Nombre del orador', style: { width: '100%' },
    onchange: e => { obj.orador = squash(e.target.value); const pr = profByName(obj.orador); obj.oradorId = pr ? pr.id : null; save(); } });
  attachPicker(inp, speakerCandidates, pid => { const pr = profById(pid); obj.orador = pr.name; obj.oradorId = pid; save(); });
  return h('div', { style: { position: 'relative' } }, inp);
}
// Última vez que dio el discurso público (aquí o en otra congregación)
function speakerCandidates() {
  const last = new Map(), today = todayISO();
  for (const p of state.programs) {
    const f = p.fin || {}, d = mecDate(p, 'fin');
    if (d > today) continue;
    for (const id of [f.oradorId, ...(f.salen || []).map(s => s.oradorId)]) if (id && (!last.has(id) || last.get(id) < d)) last.set(id, d);
  }
  return state.profiles.filter(pr => pr.sex === 'M')
    .map(pr => ({ pr, days: last.has(pr.id) ? daysBetween(last.get(pr.id), today) : Infinity, pref: !!pr.nombramiento }))
    .sort((a, b) => b.pref - a.pref || b.days - a.days || a.pr.name.localeCompare(b.pr.name, 'es'));
}
// fecha: la del discurso aquí; con ella se avisa si el bosquejo ya se dio en menos de un año
function talkInputs(obj, fecha) {
  const warn = h('div', { class: 'hint s-warn' }), check = () => { warn.textContent = talkRepeat(obj.bosquejo, fecha); };
  const tema = h('input', { type: 'text', value: obj.tema || '', placeholder: 'Tema del discurso', style: { flex: 1, minWidth: '200px' },
    onchange: e => { obj.tema = squash(e.target.value); if (obj.bosquejo && obj.tema) state.talks[obj.bosquejo] = obj.tema; save(); } });
  const num = h('input', { type: 'text', inputmode: 'numeric', value: obj.bosquejo || '', placeholder: 'Núm.', style: { width: '80px' },
    onchange: e => { obj.bosquejo = squash(e.target.value); if (!tema.value && state.talks[obj.bosquejo]) { tema.value = obj.tema = state.talks[obj.bosquejo]; } save(); check(); } });
  check();
  return h('div', null, h('div', { class: 'row', style: { gap: '8px' } }, num, tema), fecha ? warn : null);
}

function renderWeekend() {
  const ro = FB_CONFIG && !can('programa'); // los demás ancianos solo lo ven
  const thisMonday = mondayOf(todayISO());
  const weeks = [...state.programs].filter(p => p.date >= addDays(thisMonday, -7)).sort((a, b) => a.date.localeCompare(b.date));
  refreshDatalist();
  const field = (label, el) => h('label', { class: 'field' }, label, el);
  const text = (obj, key, ph) => h('input', { type: 'text', value: obj[key] || '', placeholder: ph, onchange: e => { obj[key] = squash(e.target.value); save(); } });
  const card = p => {
    const f = finOf(p), salenBox = h('div');
    const fillSalen = () => salenBox.replaceChildren(...(f.salen || []).map((s, i) => h('div', { class: 'card', style: { padding: '10px', boxShadow: 'none', marginTop: '8px' } },
      h('div', { class: 'row', style: { gap: '8px', alignItems: 'flex-end' } },
        field('Orador', speakerInput(s)), field('Va a la congregación', text(s, 'cong', 'Congregación')),
        field('Fecha', h('input', { type: 'date', value: s.fecha || mecDate(p, 'fin'), onchange: e => { s.fecha = e.target.value; save(); } })),
        ro ? null : h('button', { class: 'btn small danger', onclick: () => { f.salen.splice(i, 1); save(); fillSalen(); } }, 'Quitar')),
      field('Discurso', talkInputs(s)))));
    fillSalen();
    const el = h('div', { class: 'card', style: { padding: '14px', marginBottom: '12px' } },
      h('div', { class: 'row spread', style: { marginBottom: '8px' } },
        h('strong', { style: { fontSize: '16px' } }, fmtDate(mecDate(p, 'fin'), 'larga')),
        h('span', { class: 'row' }, h('span', { class: 'muted small-text' }, `${mecTime('fin')} · semana ${p.title}`),
          ro ? null : h('button', { class: 'btn small', onclick: () => openWhatsAppDialog(p) }, '💬 WhatsApp'))),
      h('div', { class: 'fin-grid' },
        field('Presidente', mecField(p, 'fin', 'presidente', render)),
        field('Lector de La Atalaya', mecField(p, 'fin', 'lector', render))),
      field('Discurso público', talkInputs(f, mecDate(p, 'fin'))),
      h('div', { class: 'fin-grid' },
        field('Orador', speakerInput(f)),
        field('Congregación del orador', text(f, 'cong', 'Vacío si es de aquí')),
        field('Teléfono del orador', h('input', { type: 'tel', value: f.oradorTel || '', placeholder: 'Para avisarle o confirmar', onchange: e => { f.oradorTel = squash(e.target.value); save(); } })),
        field('Hospitalidad', text(f, 'hosp', 'Quién atiende al orador')),
        field('Notas', text(f, 'notas', 'Opcional'))),
      h('details', { class: 'fin-out', open: (f.salen || []).length ? true : null },
        h('summary', null, `Oradores de aquí que salen esta semana (${(f.salen || []).length})`),
        salenBox,
        ro ? null : h('button', { class: 'btn small', style: { marginTop: '8px' }, onclick: () => { (f.salen = f.salen || []).push({}); save(); fillSalen(); } }, '+ Agregar orador que sale')));
    if (ro) el.querySelectorAll('input, textarea, select').forEach(x => { x.disabled = true; if (x.placeholder) x.placeholder = '—'; });
    return el;
  };
  return h('div', null,
    h('div', { class: 'row spread', style: { alignItems: 'flex-start' } },
      h('h1', null, 'Reunión del fin de semana'),
      h('div', { class: 'row' }, monthDownload(state.programs, weekendPDF), weeks.length ? h('button', { class: 'btn primary', onclick: () => weekendPDF(weeks.slice(0, 8)) }, '⬇ PDF de las próximas') : null)),
    h('p', { class: 'sub' }, ro ? 'Discurso público, orador, presidente, lector de La Atalaya y hospitalidad. Aquí solo se ve: lo cambia el encargado de Programa VyM.'
      : 'Discurso público, orador, presidente, lector de La Atalaya y hospitalidad. El presidente y el lector son los mismos de Mecánicas. Al escribir el número de un bosquejo que ya usaste, el tema sale solo.'),
    weekendTabs(),
    weekendTab === 'historial' ? renderTalkHistory() : weekendTab === 'oradores' ? renderSpeakers()
      : weeks.length ? weeks.map(card) : h('div', { class: 'card empty' }, 'No hay semanas próximas. Agrégalas en Semanas.'));
}

// PDF: una tabla por hoja horizontal, un renglón por fin de semana
function weekendPDF(weeks) {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) return toast('Se necesita internet para crear el PDF.');
  weeks = [...weeks].sort((a, b) => a.date.localeCompare(b.date));
  if (!weeks.length) return toast('No hay semanas para el PDF.');
  const s = state.settings, doc = new J({ orientation: 'landscape', unit: 'pt', format: s.paper === 'a4' ? 'a4' : 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 32;
  const nm = id => (profById(id) || {}).name || '';
  const cols = [['Fecha', 0.12], ['Presidente', 0.14], ['Discurso público', 0.27], ['Orador', 0.17], ['Lector de La Atalaya', 0.15], ['Hospitalidad', 0.15]];
  const widths = cols.map(([, f]) => f * (W - 2 * M));
  const header = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(0);
    doc.text('Programa de la reunión del fin de semana', M, 42);
    doc.setFontSize(11); doc.setTextColor(90); if (congName() || s.congregation) doc.text((congName() || s.congregation).toUpperCase(), W - M, 42, { align: 'right' });
    doc.setDrawColor(110); doc.setLineWidth(2); doc.line(M, 50, W - M, 50);
    let x = M; doc.setFillColor(238); doc.rect(M, 60, W - 2 * M, 20, 'F');
    doc.setFontSize(9); doc.setTextColor(40);
    cols.forEach(([t], i) => { doc.text(t, x + 5, 74); x += widths[i]; });
    return 92;
  };
  let y = header();
  for (const p of weeks) {
    const f = p.fin || {};
    const cells = [
      [capFirst(toDate(mecDate(p, 'fin')).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })), mecTime('fin')],
      [nm(mecGet(p, 'fin', 'presidente'))],
      [[f.bosquejo ? `Núm. ${f.bosquejo}` : '', f.tema].filter(Boolean).join(' · ') || '—'],
      [f.orador || '—', f.cong ? `(${f.cong})` : ''],
      [nm(mecGet(p, 'fin', 'lector'))],
      [f.hosp || ''],
    ].map((lines, i) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); return lines.filter(Boolean).flatMap(l => doc.splitTextToSize(l, widths[i] - 10)); });
    const hgt = Math.max(...cells.map(c => c.length), 1) * 12 + 10;
    if (y + hgt > H - 40) { doc.addPage(); y = header(); }
    let x = M;
    cells.forEach((lines, i) => { doc.setTextColor(i === 0 ? 0 : 20); doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); doc.text(lines, x + 5, y, { lineHeightFactor: 1.25 }); x += widths[i]; });
    doc.setDrawColor(215); doc.setLineWidth(0.5); doc.line(M, y + hgt - 14, W - M, y + hgt - 14);
    y += hgt;
    // Oradores que salen esa semana, en letra pequeña debajo
    for (const o of f.salen || []) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(90);
      doc.text(`Sale: ${o.orador || '—'} a ${o.cong || '—'}${o.fecha ? ' (' + fmtShort(o.fecha) + ')' : ''}${o.tema ? ' · ' + (o.bosquejo ? 'Núm. ' + o.bosquejo + ' · ' : '') + o.tema : ''}`, M + widths[0] + 5, y - 4);
      y += 12;
    }
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(140);
  doc.text(`Impreso ${new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, W - M, H - 20, { align: 'right' });
  savePDF(doc, `Fin de semana ${weeks[0].title} a ${weeks[weeks.length - 1].title}`);
}

// ---------- asistencia a las reuniones (S-88) ----------
// asistencia/{AAAA-MM} = { entre: { 'AAAA-MM-DD': número }, fin: { … } }. La anotan y la ven los
// ancianos (cualquier función). El año de servicio va de septiembre a agosto.
const serviceYearOf = iso => { const [y, m] = iso.split('-').map(Number); return m >= 9 ? y : y - 1; };
const serviceMonths = y => Array.from({ length: 12 }, (_, i) => { const m = (8 + i) % 12 + 1, yy = m >= 9 ? y : y + 1; return `${yy}-${String(m).padStart(2, '0')}`; });
function monthAttendance(m) {
  const d = nube.asistencia.get(m) || {};
  const sum = obj => { const v = Object.values(obj || {}).filter(n => typeof n === 'number'); return { n: v.length, total: v.reduce((a, b) => a + b, 0) }; };
  return { entre: sum(d.entre), fin: sum(d.fin) };
}
const avg = x => x.n ? Math.round(x.total / x.n) : null;
// Fechas de las reuniones de un mes según el día de cada reunión (Ajustes)
function meetingDatesOf(m, weekday) {
  const out = [], d = new Date(m + '-01T12:00:00');
  while (d.getMonth() === new Date(m + '-01T12:00:00').getMonth()) {
    if ((d.getDay() + 6) % 7 === weekday) out.push(isoOf(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function openAttendanceDialog(m) {
  const data = nube.asistencia.get(m) || {}, s = state.settings;
  const rows = { entre: [], fin: [] };
  const block = (kind, label, weekday) => {
    const dates = [...new Set([...meetingDatesOf(m, weekday), ...Object.keys(data[kind] || {})])].sort();
    const box = h('div', { class: 'att-list' });
    const add = (date, n) => {
      const di = h('input', { type: 'date', value: date }), ni = h('input', { type: 'number', min: 0, max: 9999, value: n ?? '', placeholder: '—', style: { width: '90px' } });
      const el = h('div', { class: 'row', style: { gap: '8px' } }, di, ni, h('button', { class: 'btn small', title: 'Quitar esta fecha', onclick: () => { el.remove(); rows[kind] = rows[kind].filter(x => x.el !== el); } }, '✕'));
      rows[kind].push({ di, ni, el }); box.append(el);
    };
    dates.forEach(d => add(d, (data[kind] || {})[d]));
    return h('div', { class: 'field' }, h('strong', null, label), box,
      h('button', { class: 'btn small', onclick: () => add(m + '-01', null) }, '+ Otra fecha'));
  };
  const close = () => { dlg.close(); dlg.remove(); };
  const err = h('div', { class: 'err' });
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, `Asistencia · ${fmtMonth(m)}`),
      h('p', { class: 'small-text muted', style: { margin: 0 } }, 'Escribe cuántos asistieron a cada reunión (incluidos los que se conectaron). Deja vacía la que no hubo, por ejemplo por asamblea.'),
      block('entre', 'Reunión de entre semana', s.meetingDay ?? 2),
      block('fin', 'Reunión del fin de semana', s.weekendDay ?? 6), err),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async e => {
        const out = { entre: {}, fin: {} };
        for (const kind of ['entre', 'fin']) for (const { di, ni } of rows[kind]) {
          if (!di.value || ni.value === '') continue;
          if (!di.value.startsWith(m)) return err.textContent = `La fecha ${fmtShort(di.value)} no es de ${fmtMonth(m).toLowerCase()}.`;
          out[kind][di.value] = Math.max(0, Math.round(+ni.value));
        }
        e.target.disabled = true;
        try { await F.setDoc(congRef('asistencia', m), out); toast('Asistencia guardada'); logChange(`Anotó la asistencia de ${fmtMonth(m).toLowerCase()}`); close(); }
        catch (ex) { err.textContent = errMsg(ex); e.target.disabled = false; }
      } }, 'Guardar')));
  document.body.append(dlg); dlg.showModal();
}

let attYear = null;
function renderAttendance() {
  const year = attYear ?? serviceYearOf(todayISO());
  const months = serviceMonths(year), today = todayISO().slice(0, 7);
  const tot = { entre: { n: 0, total: 0 }, fin: { n: 0, total: 0 } };
  const cell = x => [h('td', null, x.n || '—'), h('td', null, x.n ? x.total : '—'), h('td', null, h('strong', null, avg(x) ?? '—'))];
  const rows = months.map(m => {
    const a = monthAttendance(m);
    for (const k of ['entre', 'fin']) { tot[k].n += a[k].n; tot[k].total += a[k].total; }
    return h('tr', { class: m > today ? 'muted' : null },
      h('td', null, fmtMonth(m)), ...cell(a.entre), ...cell(a.fin),
      h('td', null, m <= today ? h('button', { class: 'btn small', onclick: () => openAttendanceDialog(m) }, a.entre.n || a.fin.n ? 'Cambiar' : 'Anotar') : null));
  });
  // Promedio del año: promedio de los promedios mensuales, como en el S-88
  const yearAvg = k => { const v = months.map(m => avg(monthAttendance(m)[k])).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : '—'; };
  return h('div', null,
    h('div', { class: 'row spread', style: { alignItems: 'flex-start' } },
      h('div', null, h('h1', null, 'Asistencia a las reuniones'),
        h('p', { class: 'sub', style: { margin: 0 } }, 'Como el formulario S-88: cuántas reuniones hubo, el total de asistentes y el promedio de cada mes.')),
      h('div', { class: 'row' },
        h('select', { onchange: e => { attYear = +e.target.value; render(); } },
          [serviceYearOf(todayISO()) - 2, serviceYearOf(todayISO()) - 1, serviceYearOf(todayISO())].map(y => h('option', { value: y, selected: y === year ? true : null }, `Año de servicio ${y}-${y + 1}`))),
        h('button', { class: 'btn primary', onclick: () => attendancePDF(year) }, '⬇ PDF (S-88)'))),
    h('div', { class: 'card', style: { padding: '14px', marginTop: '12px' } },
      h('div', { class: 'tablewrap' }, h('table', { class: 'stats att' },
        h('thead', null,
          h('tr', null, h('th', null, ''), h('th', { colspan: 3 }, 'Entre semana'), h('th', { colspan: 3 }, 'Fin de semana'), h('th', null, '')),
          h('tr', null, ['Mes', 'Reuniones', 'Total', 'Promedio', 'Reuniones', 'Total', 'Promedio', ''].map(t => h('th', null, t)))),
        h('tbody', null, ...rows,
          h('tr', { class: 'att-total' }, h('td', null, h('strong', null, 'Promedio del año')), h('td', { colspan: 2 }), h('td', null, h('strong', null, yearAvg('entre'))),
            h('td', { colspan: 2 }), h('td', null, h('strong', null, yearAvg('fin'))), h('td')))))));
}

function attendancePDF(year) {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) return toast('Se necesita internet para crear el PDF.');
  const s = state.settings, doc = new J({ unit: 'pt', format: s.paper === 'a4' ? 'a4' : 'letter' });
  const W = doc.internal.pageSize.getWidth(), M = 40;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(0);
  doc.text('REGISTRO DE ASISTENCIA A LAS REUNIONES DE CONGREGACIÓN', W / 2, 50, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(`Congregación: ${congName() || s.congregation || ''}`, M, 78);
  doc.text(`Año de servicio: ${year}-${year + 1}`, W - M, 78, { align: 'right' });
  const y0 = 100;
  const table = (title, k, y) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(title, M, y);
    y += 10;
    doc.setFillColor(235); doc.rect(M, y, W - 2 * M, 18, 'F');
    doc.setFontSize(9); ['Mes', 'Número de reuniones', 'Asistencia total', 'Promedio semanal'].forEach((t, i) => doc.text(t, [M + 4, M + 150, M + 270, M + 390][i], y + 12));
    y += 18;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const avgs = [];
    for (const m of serviceMonths(year)) {
      const a = monthAttendance(m)[k];
      doc.text(fmtMonth(m), M + 4, y + 13);
      if (a.n) { doc.text(String(a.n), M + 150, y + 13); doc.text(String(a.total), M + 270, y + 13); doc.text(String(avg(a)), M + 390, y + 13); avgs.push(avg(a)); }
      doc.setDrawColor(210); doc.setLineWidth(0.5); doc.line(M, y + 18, W - M, y + 18);
      y += 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Promedio de asistencia mensual', M + 4, y + 14);
    if (avgs.length) doc.text(String(Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length)), M + 390, y + 14);
    return y + 40;
  };
  let y = table('Reunión de entre semana', 'entre', y0);
  table('Reunión del fin de semana', 'fin', y);
  savePDF(doc, `Asistencia ${year}-${year + 1}`);
}

// ---------- Registro de publicador de la congregación (S-21) ----------
// Con los informes de un año de servicio. Los datos del hermano (nacimiento, bautismo, esperanza)
// se ponen en su ficha. Dos tarjetas por hoja.
async function publisherCardsPDF(year, people) {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) return toast('Se necesita internet para crear el PDF.');
  if (!people.length) return toast('Elige al menos un hermano.');
  const months = serviceMonths(year);
  let docs = [];
  try {
    const q = F.query(F.collection(F.db, 'congregaciones', nube.cong, 'informes'), F.where('mes', '>=', months[0]), F.where('mes', '<=', months[11]));
    docs = (await F.getDocs(q)).docs.map(d => d.data());
  } catch (e) { return toast(errMsg(e)); }
  const byKey = new Map(docs.map(d => [`${d.perfil}_${d.mes}`, d]));
  const doc = new J({ unit: 'pt', format: state.settings.paper === 'a4' ? 'a4' : 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 34, ch = (H - M * 3) / 2;
  const box = (x, y, on, label) => {
    doc.setDrawColor(60); doc.setLineWidth(0.7); doc.rect(x, y - 8, 9, 9);
    if (on) { doc.setLineWidth(1.4); doc.lines([[2, 3], [5, -7]], x + 1.5, y - 3.5); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(20); doc.text(label, x + 13, y);
  };
  const fmtD = iso => iso ? toDate(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  people.forEach((pr, i) => {
    if (i && i % 2 === 0) doc.addPage();
    let y = M + (i % 2) * (ch + M);
    doc.setDrawColor(150); doc.setLineWidth(0.4); doc.rect(M, y, W - 2 * M, ch);
    y += 18;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(0);
    doc.text('REGISTRO DE PUBLICADOR DE LA CONGREGACIÓN', W / 2, y, { align: 'center' });
    y += 20;
    const line = (label, value, x, w) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(label, x, y);
      const lx = x + doc.getTextWidth(label) + 4;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(value || '', lx + 2, y - 1);
      doc.setDrawColor(150); doc.setLineWidth(0.4); doc.line(lx, y + 2, x + w, y + 2);
    };
    const X = M + 10, IW = W - 2 * M - 20;
    line('Nombre:', pr.name, X, IW);
    y += 17;
    line('Fecha de nacimiento:', fmtD(pr.nacimiento), X, IW * 0.55);
    box(X + IW * 0.62, y, pr.sex === 'M', 'Hombre'); box(X + IW * 0.78, y, pr.sex === 'F', 'Mujer');
    y += 17;
    line('Fecha de bautismo:', pr.bautizado ? fmtD(pr.bautismoFecha) : '', X, IW * 0.55);
    box(X + IW * 0.62, y, pr.esperanza !== 'ungido', 'Otras ovejas'); box(X + IW * 0.78, y, pr.esperanza === 'ungido', 'Ungido');
    y += 18;
    [[pr.nombramiento === 'anciano', 'Anciano'], [pr.nombramiento === 'sm', 'Siervo ministerial'], [pr.tipo === 'reg', 'Precursor regular'],
      [pr.tipo === 'esp', 'Precursor especial'], [false, 'Misionero']].forEach(([on, label], k) => box(X + k * IW / 5, y, on, label));
    y += 12;
    // Tabla
    const cols = [['Año de servicio\n' + `${year}-${year + 1}`, 0.2], ['Participó en\nel ministerio', 0.13], ['Cursos\nbíblicos', 0.1], ['Precursor\nauxiliar', 0.11], ['Horas\n(precursores)', 0.16], ['Notas', 0.3]];
    const ws = cols.map(([, f]) => f * IW), xs = ws.map((_, k) => X + ws.slice(0, k).reduce((a, b) => a + b, 0));
    doc.setFillColor(238); doc.rect(X, y, IW, 24, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(30);
    cols.forEach(([t], k) => doc.text(t.split('\n'), xs[k] + 3, y + 9, { lineHeightFactor: 1.2 }));
    y += 24;
    const rowH = Math.min(15, (ch - (y - (M + (i % 2) * (ch + M))) - 26) / 13);
    let horas = 0;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    for (const m of months) {
      const r = byKey.get(`${pr.id}_${m}`);
      doc.setTextColor(20);
      doc.text(capFirst(new Date(m + '-15T12:00:00').toLocaleDateString('es', { month: 'long' })), xs[0] + 3, y + rowH - 4);
      if (r) {
        if (r.participo) doc.text('Sí', xs[1] + 3, y + rowH - 4);
        if (r.cursos) doc.text(String(r.cursos), xs[2] + 3, y + rowH - 4);
        if (groupFor(pr, m) === 'aux' || r.grupo === 'aux') doc.text('Sí', xs[3] + 3, y + rowH - 4);
        if (r.horas != null) { doc.text(String(r.horas), xs[4] + 3, y + rowH - 4); horas += r.horas; }
        if (r.notas) doc.text(doc.splitTextToSize(r.notas, ws[5] - 6)[0], xs[5] + 3, y + rowH - 4);
      }
      doc.setDrawColor(200); doc.setLineWidth(0.4); doc.line(X, y + rowH, X + IW, y + rowH);
      y += rowH;
    }
    doc.setFont('helvetica', 'bold'); doc.text('Total', xs[0] + 3, y + rowH - 4);
    if (horas) doc.text(String(horas), xs[4] + 3, y + rowH - 4);
    doc.setDrawColor(120); doc.setLineWidth(0.5);
    xs.slice(1).forEach(x => doc.line(x, y - 12 * rowH - 24, x, y + rowH));
    doc.rect(X, y - 12 * rowH - 24, IW, 12 * rowH + 24 + rowH);
  });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(140);
  savePDF(doc, people.length === 1 ? `S-21 ${people[0].name} ${year}-${year + 1}` : `S-21 tarjetas ${year}-${year + 1}`);
}

function openPublisherCardsDialog() {
  const sy = serviceYearOf(todayISO());
  const yearSel = h('select', null, [sy - 2, sy - 1, sy].map(y => h('option', { value: y, selected: y === sy ? true : null }, `${y}-${y + 1}`)));
  const people = state.profiles.filter(p => p.tipo !== 'no').sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const who = h('select', null, h('option', { value: '' }, `Todos los publicadores (${people.length})`), people.map(p => h('option', { value: p.id }, p.name)));
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, 'Registro de publicador (S-21)'),
      h('p', { class: 'small-text muted', style: { margin: 0 } }, 'Se llena con los informes del año de servicio. La fecha de nacimiento, de bautismo y la esperanza se ponen en la ficha de cada hermano (Hermanos).'),
      h('div', { class: 'row', style: { gap: '16px' } }, h('label', { class: 'field' }, 'Año de servicio', yearSel), h('label', { class: 'field', style: { flex: 1 } }, 'Hermano', who))),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => { publisherCardsPDF(+yearSel.value, who.value ? people.filter(p => p.id === who.value) : people); close(); } }, '⬇ Crear PDF')));
  document.body.append(dlg); dlg.showModal();
}

// ---------- calendario de la congregación ----------
// eventos/{id} = { tipo, titulo, desde, hasta, notas }. Lo ven todos; lo cambian los ancianos.
// Las semanas con un evento lo muestran en Semanas y en el programa; la visita del superintendente
// de circuito ofrece ajustar el programa (su discurso en lugar del estudio bíblico).
const EVENT_TYPES = {
  visita: { label: 'Visita del superintendente de circuito', color: '#2f6fd6' },
  asamblea: { label: 'Asamblea', color: '#7b2cbf' },
  conmemoracion: { label: 'Conmemoración', color: '#b7791f' },
  campana: { label: 'Campaña de predicación', color: '#1b9e4b' },
  otro: { label: 'Otro', color: '#6b7280' },
};
const evTitle = e => e.titulo || (EVENT_TYPES[e.tipo] || EVENT_TYPES.otro).label;
const evColor = e => (EVENT_TYPES[e.tipo] || EVENT_TYPES.otro).color;
const eventsBetween = (from, to) => nube.eventos.filter(e => e.desde <= to && (e.hasta || e.desde) >= from).sort((a, b) => a.desde.localeCompare(b.desde));
const weekEvents = p => FB_CONFIG ? eventsBetween(p.date, addDays(p.date, 6)) : [];
const fmtRange = e => !e.hasta || e.hasta === e.desde ? fmtShort(e.desde) : `${fmtShort(e.desde)} – ${fmtShort(e.hasta)}`;
const eventChip = e => h('span', { class: 'ev-chip', style: { '--ev': evColor(e) } }, evTitle(e));

function openEventDialog(ev, day) {
  const tipo = h('select', null, Object.entries(EVENT_TYPES).map(([k, v]) => h('option', { value: k, selected: (ev ? ev.tipo : 'visita') === k ? true : null }, v.label)));
  const titulo = h('input', { type: 'text', maxlength: 120, value: ev ? ev.titulo || '' : '', placeholder: 'Opcional: por ejemplo “Asamblea regional”' });
  const desde = h('input', { type: 'date', value: ev ? ev.desde : day || todayISO() }), hasta = h('input', { type: 'date', value: ev ? ev.hasta || ev.desde : day || todayISO() });
  const notas = h('textarea', { rows: 3, maxlength: 1000, placeholder: 'Opcional: lugar, horario, indicaciones…' }, ev ? ev.notas || '' : '');
  const err = h('div', { class: 'err' });
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, ev ? 'Editar evento' : 'Nuevo evento'),
      h('label', { class: 'field' }, 'Tipo', tipo), h('label', { class: 'field' }, 'Título', titulo),
      h('div', { class: 'row', style: { gap: '16px' } }, h('label', { class: 'field' }, 'Desde', desde), h('label', { class: 'field' }, 'Hasta', hasta)),
      h('label', { class: 'field' }, 'Notas', notas), err),
    h('div', { class: 'dlg-foot' },
      ev ? h('button', { class: 'btn danger', style: { marginRight: 'auto' }, onclick: async () => {
        if (!confirm(`¿Borrar “${evTitle(ev)}”?`)) return;
        try { await F.deleteDoc(congRef('eventos', ev.id)); logChange(`Borró el evento “${evTitle(ev)}” (${fmtRange(ev)})`); close(); } catch (e) { err.textContent = errMsg(e); }
      } }, 'Borrar') : null,
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async e => {
        if (!desde.value) return err.textContent = 'Elige la fecha.';
        const data = { tipo: tipo.value, titulo: squash(titulo.value), desde: desde.value, hasta: hasta.value && hasta.value >= desde.value ? hasta.value : desde.value, notas: notas.value.trim() };
        e.target.disabled = true;
        try {
          if (ev) await F.setDoc(congRef('eventos', ev.id), data); else await F.addDoc(F.collection(F.db, 'congregaciones', nube.cong, 'eventos'), data);
          logChange(`${ev ? 'Cambió' : 'Agregó'} el evento “${evTitle(data)}” (${fmtRange(data)})`);
          toast('Evento guardado'); close();
        } catch (ex) { err.textContent = errMsg(ex); e.target.disabled = false; }
      } }, 'Guardar')));
  document.body.append(dlg); dlg.showModal();
}

let calMonth = null;
function renderCalendar() {
  const editor = isElder(), today = todayISO();
  const month = calMonth || today.slice(0, 7);
  const first = toDate(month + '-01'), start = addDays(month + '-01', -((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const shift = n => { const d = toDate(month + '-01'); d.setMonth(d.getMonth() + n); calMonth = isoOf(d).slice(0, 7); render(); };
  const grid = h('div', { class: 'cal-grid' },
    ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => h('div', { class: 'cal-head' }, d)),
    days.map(d => {
      const evs = eventsBetween(d, d);
      return h('div', { class: 'cal-day' + (d.slice(0, 7) !== month ? ' out' : '') + (d === today ? ' today' : ''),
        onclick: editor ? () => openEventDialog(null, d) : null },
        h('span', { class: 'cal-num' }, String(+d.slice(8))),
        evs.map(e => h('span', { class: 'cal-ev', style: { '--ev': evColor(e) }, title: evTitle(e),
          onclick: x => { x.stopPropagation(); if (editor) openEventDialog(e); } }, evTitle(e))));
    }));
  const upcoming = nube.eventos.filter(e => (e.hasta || e.desde) >= today).sort((a, b) => a.desde.localeCompare(b.desde)).slice(0, 12);
  return h('div', null,
    h('div', { class: 'row spread', style: { alignItems: 'flex-start' } },
      h('div', null, h('h1', null, 'Calendario'),
        h('p', { class: 'sub', style: { margin: 0 } }, 'Visitas del superintendente de circuito, asambleas, la Conmemoración y campañas.' + (editor ? ' Toca un día para agregar un evento.' : ''))),
      editor ? h('button', { class: 'btn primary', onclick: () => openEventDialog(null) }, '+ Nuevo evento') : null),
    h('div', { class: 'card', style: { padding: '14px', marginTop: '12px' } },
      h('div', { class: 'row spread', style: { marginBottom: '10px' } },
        h('button', { class: 'btn small', onclick: () => shift(-1) }, '‹ Anterior'),
        h('strong', { style: { fontSize: '17px' } }, fmtMonth(month)),
        h('button', { class: 'btn small', onclick: () => shift(1) }, 'Siguiente ›')),
      grid),
    h('h2', { class: 'group' }, 'Próximos'),
    h('div', { class: 'card', style: { padding: '4px 14px' } },
      upcoming.length ? upcoming.map(e => h('div', { class: 'urow', style: { cursor: editor ? 'pointer' : null }, onclick: editor ? () => openEventDialog(e) : null },
        h('span', { class: 'ev-dot', style: { background: evColor(e) } }),
        h('div', { class: 'info' }, h('strong', null, evTitle(e)), h('div', { class: 'small-text muted' }, fmtRange(e) + (e.notas ? ' · ' + e.notas : '')))))
        : h('div', { class: 'empty' }, 'No hay eventos próximos.')));
}

// Visita del superintendente: su discurso de 30 minutos en lugar del estudio bíblico de la congregación
function adjustForVisit(p) {
  const r = p.rows.find(x => x.helper === 'Lector' || /estudio b[ií]blico de la congregaci/i.test(x.title || ''));
  if (!r) return toast('No encontré el estudio bíblico de esta semana.');
  if (!confirm('Se cambia el estudio bíblico de la congregación por el discurso de servicio del superintendente de circuito (30 min). ¿Continuar?')) return false;
  Object.assign(r, { title: 'Discurso de servicio del superintendente de circuito', min: 30, helper: null, a: null, b: null, detail: '', men: true });
  save(); logChange(`Ajustó la semana ${p.title} para la visita del superintendente de circuito`);
  return true;
}

// ---------- arreglos: salidas de predicación y limpieza del Salón ----------
// salidas/{id} = { dia (0 lunes … 6 domingo), hora 'HH:MM', lugar, dirige, grupo, notas }: cada semana igual.
// arreglos/limpieza = { semanas: { lunes 'AAAA-MM-DD': 'Grupo 2' } }. Los ven todos; los cambian los ancianos.
const fmtHora = hhmm => hhmm ? fmtClock(hhmm) : '';
const PREACH_TYPES = ['Casa en casa', 'Revisitas y cursos', 'Predicación pública', 'Negocios', 'Zona rural', 'Cartas', 'Teléfono', 'Otro'];
// Elegir capitán: la lista de capitanes y, por si hace falta, escribir otro nombre
function captainPicker(current) {
  const caps = captainOptions().map(c => c.nombre), known = caps.includes(current);
  const other = h('input', { type: 'text', maxlength: 100, list: 'profiles-list', value: known ? '' : current || '', placeholder: 'Nombre del hermano o grupo' });
  const sel = h('select', { onchange: () => { other.hidden = !!sel.value; } }, caps.map(n => h('option', { value: n, selected: n === current ? true : null }, n)),
    h('option', { value: '', selected: !known && (current || !caps.length) ? true : null }, 'Otro (escribir el nombre)'));
  other.hidden = !!sel.value;
  refreshDatalist();
  return { el: h('div', { class: 'row', style: { gap: '8px' } }, sel, other,
    caps.length ? null : h('span', { class: 'small-text muted' }, 'Todavía no hay capitanes. Se marcan en la ficha del hermano.')), get: () => sel.value || squash(other.value) };
}
function openOutingDialog(o) {
  const dia = h('select', null, WEEKDAYS.map((d, i) => h('option', { value: i, selected: (o ? o.dia : 5) === i ? true : null }, d)));
  const hora = h('input', { type: 'time', value: o ? o.hora : '09:30' });
  const lugar = h('input', { type: 'text', maxlength: 120, value: o ? o.lugar : '', placeholder: 'Ej.: Salón del Reino, casa de la familia Pérez' });
  const capi = captainPicker(o ? o.dirige : '');
  const tipo = h('select', null, PREACH_TYPES.map(t => h('option', { value: t, selected: (o && o.tipo || PREACH_TYPES[0]) === t ? true : null }, t)),
    o && o.tipo && !PREACH_TYPES.includes(o.tipo) ? h('option', { value: o.tipo, selected: true }, o.tipo) : null);
  const fecha = h('input', { type: 'date', value: o ? o.fecha || '' : '', onchange: () => { dia.disabled = !!fecha.value; } });
  dia.disabled = !!fecha.value;
  const cards = [...nube.territorios].sort(byNumero).map(terrTitle);
  const terrI = h('input', { type: 'text', maxlength: 120, list: 'terr-list', value: o ? o.territorio || '' : '', placeholder: 'Opcional: elige o escribe' });
  const grupo = h('input', { type: 'text', maxlength: 60, value: o ? o.grupo || '' : '', placeholder: 'Opcional: Grupo 1, todos…', list: 'grupos-list' });
  const notas = h('input', { type: 'text', maxlength: 300, value: o ? o.notas || '' : '', placeholder: 'Opcional: territorio, tipo de predicación…' });
  const err = h('div', { class: 'err' });
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, o ? 'Editar salida' : 'Nueva salida de predicación'),
      h('datalist', { id: 'grupos-list' }, nube.grupos.map(g => h('option', { value: g.nombre }))),
      h('datalist', { id: 'terr-list' }, cards.map(t => h('option', { value: t }))),
      h('div', { class: 'row', style: { gap: '16px' } }, h('label', { class: 'field' }, 'Día (cada semana)', dia),
        h('label', { class: 'field' }, 'Solo esta fecha (opcional)', fecha), h('label', { class: 'field' }, 'Hora', hora)),
      h('div', { class: 'field' }, 'Capitán', capi.el),
      h('label', { class: 'field' }, 'Tipo de predicación', tipo),
      h('label', { class: 'field' }, 'Lugar de la salida', lugar), h('label', { class: 'field' }, 'Territorio', terrI),
      h('label', { class: 'field' }, 'Grupo', grupo), h('label', { class: 'field' }, 'Notas', notas), err),
    h('div', { class: 'dlg-foot' },
      o ? h('button', { class: 'btn danger', style: { marginRight: 'auto' }, onclick: async () => {
        if (!confirm('¿Borrar esta salida?')) return;
        try { await F.deleteDoc(congRef('salidas', o.id)); logChange(`Borró la salida del ${WEEKDAYS[o.dia].toLowerCase()} en ${o.lugar}`); close(); } catch (e) { err.textContent = errMsg(e); }
      } }, 'Borrar') : null,
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async e => {
        const when = fecha.value || '';
        const data = { dia: when ? (toDate(when).getDay() + 6) % 7 : +dia.value, fecha: when, hora: hora.value || '', lugar: squash(lugar.value), dirige: capi.get(), tipo: tipo.value,
          territorio: squash(terrI.value), grupo: squash(grupo.value), notas: squash(notas.value) };
        if (!data.lugar) return err.textContent = 'Escribe el lugar.';
        e.target.disabled = true;
        try {
          if (o) await F.setDoc(congRef('salidas', o.id), data); else await F.addDoc(F.collection(F.db, 'congregaciones', nube.cong, 'salidas'), data);
          logChange(`${o ? 'Cambió' : 'Agregó'} la salida del ${WEEKDAYS[data.dia].toLowerCase()} ${fmtHora(data.hora)} en ${data.lugar}`);
          toast('Salida guardada'); close();
        } catch (ex) { err.textContent = errMsg(ex); e.target.disabled = false; }
      } }, 'Guardar')));
  refreshDatalist();
  document.body.append(dlg); dlg.showModal();
}

// Limpieza: las próximas semanas y qué grupo limpia cada una
const cleaningOf = monday => ((nube.limpieza && nube.limpieza.semanas) || {})[monday] || '';
async function setCleaning(changes, msg) {
  try { await F.setDoc(congRef('arreglos', 'limpieza'), { semanas: { ...((nube.limpieza && nube.limpieza.semanas) || {}), ...changes } }); if (msg) { logChange(msg); toast(msg); } }
  catch (e) { toast(errMsg(e)); }
}

function renderArrangements() {
  const editor = isElder(), thisMonday = mondayOf(todayISO());
  // Las de una sola fecha se dejan de ver cuando ya pasaron
  const outings = nube.salidas.filter(o => !o.fecha || o.fecha >= todayISO()).sort((a, b) => a.dia - b.dia || (a.hora || '').localeCompare(b.hora || ''));
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(thisMonday, i * 7));
  const groups = [...nube.grupos].sort(byGrupo).map(g => g.nombre);
  const weekLabelOf = m => `${fmtShort(m)} – ${fmtShort(addDays(m, 6))}`;
  // Llena las semanas vacías siguiendo el orden de los grupos, después del último que limpió
  const rotate = () => {
    if (!groups.length) return toast('Primero arma los grupos en la sección Grupos.');
    const changes = {};
    let last = groups.indexOf([...weeks].reverse().map(cleaningOf).find(Boolean) || '');
    for (const m of weeks) if (!cleaningOf(m)) { last = (last + 1) % groups.length; changes[m] = groups[last]; }
    if (!Object.keys(changes).length) return toast('Todas las semanas ya tienen grupo.');
    setCleaning(changes, `Repartió la limpieza de ${Object.keys(changes).length} semanas entre los grupos`);
  };
  const byDay = WEEKDAYS.map((d, i) => [d, outings.filter(o => o.dia === i)]).filter(([, l]) => l.length);
  return h('div', null,
    h('div', { class: 'row spread', style: { alignItems: 'flex-start' } },
      h('div', null, h('h1', null, 'Arreglos'),
        h('p', { class: 'sub', style: { margin: 0 } }, 'El programa de predicación y el programa de aseo del Salón del Reino.'))),
    h('div', { class: 'row spread', style: { margin: '18px 0 8px' } },
      h('h2', { class: 'group', style: { margin: 0 } }, 'Programa de predicación'),
      h('span', { class: 'row' }, h('button', { class: 'btn small', onclick: () => preachingPDF(outings) }, '⬇ PDF o imagen'),
        editor ? h('button', { class: 'btn small primary', onclick: () => openOutingDialog(null) }, '+ Nueva salida') : null)),
    h('div', { class: 'card', style: { padding: '4px 14px' } },
      byDay.length ? byDay.map(([d, list]) => h('div', { class: 'out-day' },
        h('div', { class: 'out-dayname' }, d),
        list.map(o => h('div', { class: 'urow', style: { cursor: editor ? 'pointer' : null }, onclick: editor ? () => openOutingDialog(o) : null },
          h('strong', { class: 'out-time' }, fmtHora(o.hora)),
          h('div', { class: 'info' }, h('strong', null, o.lugar), o.tipo ? h('span', { class: 'tag-fam' }, o.tipo) : null,
            o.fecha ? h('span', { class: 'tag-fam' }, 'Solo el ' + fmtShort(o.fecha)) : null,
            h('div', { class: 'small-text muted' }, [o.dirige ? 'Capitán: ' + o.dirige : '', o.territorio ? 'Territorio: ' + o.territorio : '', o.grupo, o.notas].filter(Boolean).join(' · ')))))))
        : h('div', { class: 'empty' }, editor ? 'Todavía no hay salidas. Toca “+ Nueva salida”.' : 'Todavía no hay salidas.')),
    ...publicTurnsSection(),
    h('div', { class: 'row spread', style: { margin: '18px 0 8px' } },
      h('h2', { class: 'group', style: { margin: 0 } }, 'Programa de aseo del Salón del Reino'),
      h('span', { class: 'row' }, h('button', { class: 'btn small', onclick: () => openCleaningPDF(weeks) }, '⬇ PDF o imagen'),
        editor ? h('button', { class: 'btn small', onclick: rotate }, 'Repartir entre los grupos') : null)),
    h('div', { class: 'card', style: { padding: '4px 14px' } },
      weeks.map(m => h('div', { class: 'urow' },
        h('div', { class: 'info' }, h('strong', null, weekLabelOf(m)), m === thisMonday ? h('span', { class: 'progress', style: { marginLeft: '8px' } }, 'Esta semana') : null),
        editor ? h('input', { type: 'text', list: 'grupos-list2', value: cleaningOf(m), placeholder: 'Grupo…', style: { width: '180px' },
          onchange: e => setCleaning({ [m]: squash(e.target.value) }, `Limpieza de la semana del ${fmtShort(m)}: ${squash(e.target.value) || 'sin grupo'}`) })
          : h('span', null, cleaningOf(m) || '—'))),
      h('datalist', { id: 'grupos-list2' }, groups.map(g => h('option', { value: g })))));
}

// PDF (o imagen) en tabla: hoja horizontal con encabezado de la app y renglones que crecen según el texto
function tablePDF(title, cols, rows, fname) {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) return toast('Se necesita internet para crear el PDF.');
  const s = state.settings, doc = new J({ orientation: 'landscape', unit: 'pt', format: s.paper === 'a4' ? 'a4' : 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 36, total = W - 2 * M;
  const sum = cols.reduce((a, c) => a + c[1], 0), widths = cols.map(c => c[1] / sum * total);
  const head = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(0); doc.text(title, M, 44);
    doc.setFontSize(10); doc.setTextColor(90); doc.text((congName() || s.congregation || '').toUpperCase(), W - M, 44, { align: 'right' });
    doc.setDrawColor(110); doc.setLineWidth(2); doc.line(M, 52, W - M, 52);
    doc.setFillColor(238); doc.rect(M, 62, total, 20, 'F'); doc.setFontSize(9); doc.setTextColor(40);
    let x = M; cols.forEach((c, i) => { doc.text(c[0], x + 5, 76); x += widths[i]; });
    return 96;
  };
  let y = head();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  for (const row of rows) {
    const cells = row.map((t, i) => doc.splitTextToSize(String(t || '—'), widths[i] - 10));
    const tall = Math.max(...cells.map(c => c.length)) * 13 + 6;
    if (y + tall > H - 30) { doc.addPage(); y = head(); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); }
    doc.setTextColor(20);
    let x = M; cells.forEach((c, i) => { doc.text(c, x + 5, y); x += widths[i]; });
    y += tall; doc.setDrawColor(220); doc.setLineWidth(0.5); doc.line(M, y - 11, W - M, y - 11);
  }
  if (!rows.length) { doc.setTextColor(120); doc.text('Sin datos por ahora.', M + 5, y); }
  savePDF(doc, fname);
}
function preachingPDF(outings) {
  const when = o => o.fecha ? capFirst(toDate(o.fecha).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })) : `Cada ${WEEKDAYS[o.dia].toLowerCase()}`;
  tablePDF('Programa de predicación', [['Cuándo', 15], ['Hora', 8], ['Capitán', 16], ['Tipo', 13], ['Lugar de la salida', 20], ['Territorio', 15], ['Grupo y notas', 17]],
    outings.map(o => [when(o), fmtHora(o.hora), o.dirige, o.tipo, o.lugar, o.territorio, [o.grupo, o.notas].filter(Boolean).join(' · ')]), 'Programa de predicación');
}
// Programa de aseo; a elegir, con las tareas mecánicas de esa semana
function openCleaningPDF(weeks) {
  const has = state.programs.length > 0;
  let on = false; try { on = has && localStorage.getItem('aseo-mecanicas') === '1'; } catch (e) {}
  const box = h('input', { type: 'checkbox', checked: on || null, disabled: has ? null : true });
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, 'Programa de aseo'),
      h('label', { class: 'row', style: { gap: '8px', color: 'var(--text)' } }, box, 'Agregar las tareas mecánicas de cada semana'),
      h('p', { class: 'muted small-text', style: { margin: 0 } }, has ? 'Micrófonos, acomodadores y audio y video.' : 'Las tareas mecánicas solo están disponibles para los ancianos.')),
    h('div', { class: 'dlg-foot' }, h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => {
        try { localStorage.setItem('aseo-mecanicas', box.checked ? '1' : '0'); } catch (e) {}
        close(); cleaningPDF(weeks, box.checked);
      } }, 'Descargar')));
  document.body.append(dlg); dlg.showModal();
}
function cleaningPDF(weeks, withMec) {
  const week = m => `${fmtShort(m)} – ${fmtShort(addDays(m, 6))}`;
  const names = (m, keys) => {
    const p = state.programs.find(x => x.date === m);
    if (!p) return '';
    return [...new Set(MEETINGS.flatMap(([mtg]) => keys.map(k => (profById(mecGet(p, mtg, k)) || {}).name)).filter(Boolean))].join(', ');
  };
  const cols = [['Semana', 20], ['Grupo de aseo', 20]], rows = weeks.map(m => [week(m), cleaningOf(m)]);
  if (withMec) {
    for (const [t, keys] of [['Micrófonos', ['micPlat', 'micAud1', 'micAud2']], ['Acomodadores', ['acomInt', 'acomExt']], ['Audio y video', ['audio']]]) {
      cols.push([t, 24]); weeks.forEach((m, i) => rows[i].push(names(m, keys)));
    }
  }
  tablePDF('Programa de aseo del Salón del Reino', cols, rows, 'Programa de aseo');
}
