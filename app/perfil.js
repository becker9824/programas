// Programas · Ficha de cada hermano.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- diálogo de perfil ----------
function openProfileDialog(prof, opts = {}) {
  let saved = false;
  const nameI = h('input', { type: 'text', value: prof ? prof.name : (opts.name || ''), placeholder: 'Nombre y apellido' });
  const ageI = h('input', { type: 'number', min: 0, max: 120, value: prof && prof.age != null ? prof.age : '', style: { width: '120px' } });
  const sex = prof ? prof.sex : '';
  const sexM = h('input', { type: 'radio', name: 'sexo', value: 'M', checked: sex === 'M' });
  const sexF = h('input', { type: 'radio', name: 'sexo', value: 'F', checked: sex === 'F' });
  const notesI = h('input', { type: 'text', value: prof ? (prof.notes || '') : '', placeholder: 'Opcional' });
  const tipo = prof && prof.tipo || 'pub';
  const tipoSel = h('select', null, [['pub', 'Publicador'], ['reg', 'Precursor regular'], ['no', 'No es publicador']].map(([v, t]) =>
    h('option', { value: v, selected: tipo === v ? true : null }, t)));
  const famSel = h('select', null, h('option', { value: '' }, '(Sin familia)'),
    [...state.families].sort((a, b) => a.name.localeCompare(b.name, 'es')).map(f =>
      h('option', { value: f.id, selected: prof && prof.familyId === f.id ? true : null }, f.name)));
  const nomSel = h('select', null, NOMBRAMIENTOS.map(([v, t]) => h('option', { value: v, selected: (prof && prof.nombramiento || '') === v ? true : null }, t)));
  const birthI = h('input', { type: 'date', value: prof && prof.nacimiento || '', max: todayISO() });
  const baptI = h('input', { type: 'date', value: prof && prof.bautismoFecha || '', max: todayISO() });
  const hopeSel = h('select', null, [['', 'Otras ovejas'], ['ungido', 'Ungido']].map(([v, t]) => h('option', { value: v, selected: (prof && prof.esperanza || '') === v ? true : null }, t)));
  const sitSel = h('select', null, SITUACIONES.map(([v, t]) => h('option', { value: v, selected: (prof && prof.situacion || '') === v ? true : null }, t)));
  const bautI = h('input', { type: 'checkbox', checked: !!(prof && prof.bautizado) });
  // Capitán de territorios: una sola cosa con la función Capitán de su cuenta (si tiene)
  const acct0 = FB_CONFIG && isAdmin() && prof ? memberOfProfile(prof.id) : null;
  const capI = h('input', { type: 'checkbox', checked: !!(prof && (prof.capitan || (acct0 && (acct0.permisos || []).includes('capitan')))) });
  // Solo los varones pueden tener nombramiento
  const syncNom = () => { const f = sexF.checked; nomSel.disabled = f; if (f) nomSel.value = ''; };
  sexM.addEventListener('change', syncNom); sexF.addEventListener('change', syncNom); syncNom();
  // Grupo: se guarda en grupos/{id}.miembros; lo cambian el secretario y el coordinador
  const oldGroup = prof ? grupoOf(prof.id) : null;
  const groupSel = h('select', { disabled: FB_CONFIG && !can('secretario') ? true : null }, h('option', { value: '' }, '(Sin grupo)'),
    [...nube.grupos].sort(byGrupo).map(g => h('option', { value: g.id, selected: oldGroup && oldGroup.id === g.id ? true : null }, g.nombre)));
  // Cuenta (solo el coordinador): funciones de quien ya tiene cuenta, o unir una cuenta sin hermano
  const account = FB_CONFIG && isAdmin() ? (prof && memberOfProfile(prof.id)) || null : null;
  const freeAccounts = FB_CONFIG && isAdmin() ? nube.miembros.filter(m => m.estado === 'activo' && (!m.perfil || !profById(m.perfil))).sort(byNombre) : [];
  const accountSel = h('select', null, h('option', { value: '' }, '— Sin cuenta —'), freeAccounts.map(m => h('option', { value: m.id }, `${m.nombre} (${m.email})`)));
  const accountField = !FB_CONFIG || !isAdmin() ? null : account
    ? h('div', { class: 'field' },
      h('div', { class: 'small-text', style: { color: 'var(--text)' } }, account.email),
      memberFunctions(account),
      h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } },
        h('button', { class: 'btn small', type: 'button', onclick: async e => {
          if (!confirm(`¿Separar la cuenta ${account.email} de este hermano? La cuenta sigue en la congregación, pero ya no verá sus asignaciones ni su informe.`)) return;
          e.target.disabled = true; await memberUpdate(account, { perfil: null }, 'Cuenta separada'); dlg.close();
        } }, 'Separar la cuenta'),
        account.id === nube.user.uid ? null : h('button', { class: 'btn small danger', type: 'button', onclick: async e => {
          if (!confirm(`¿Quitar la cuenta ${account.email} de la congregación? Ya no podrá entrar. El hermano sigue en la lista.`)) return;
          e.target.disabled = true;
          try { await F.deleteDoc(congRef('miembros', account.id)); toast('Se quitó la cuenta'); dlg.close(); } catch (ex) { toast(errMsg(ex)); }
        } }, 'Quitar la cuenta')))
    : h('div', { class: 'field' },
      freeAccounts.length ? h('label', { class: 'field' }, 'Unir con una cuenta que ya está en la congregación', accountSel) : null,
      h('span', { class: 'small-text' }, `Sin cuenta también sale en el programa y las asignaciones. Si tiene correo, que cree su cuenta con el código ${(nube.congData && nube.congData.codigo) || ''}; luego apruébala arriba en Hermanos.`));
  // Privilegios: casillas, con botones para marcar varios a la vez
  const has = prof && Array.isArray(prof.puede) ? new Set(prof.puede) : new Set();
  const privBoxes = PRIVS.map(([k, label]) => {
    const box = h('input', { type: 'checkbox', checked: has.has(k), 'data-priv': k });
    return { k, box, el: h('label', { class: 'row', style: { gap: '6px', color: 'var(--text)', fontSize: '14px' } }, box, label) };
  });
  const privField = h('div', { class: 'field' },
    h('div', { class: 'row', style: { gap: '6px', margin: '2px 0 4px' } }, h('span', { class: 'small-text' }, 'Marcar como:'),
      PRIV_PRESETS.map(([name, keys, nom, baut]) => h('button', { class: 'btn small', type: 'button', onclick: () => {
        privBoxes.forEach(p => { p.box.checked = keys.includes(p.k); });
        if (!sexF.checked) nomSel.value = nom;
        if (baut != null) bautI.checked = baut;
      } }, name)),
      h('button', { class: 'btn small', type: 'button', onclick: () => privBoxes.forEach(p => { p.box.checked = false; }) }, 'Ninguno')),
    // En dos grupos: la reunión de entre semana y las asignaciones mecánicas
    [['Vida y Ministerio', privBoxes.filter(p => !MEC_PRIVS.includes(p.k))], ['Mecánicas y fin de semana', privBoxes.filter(p => MEC_PRIVS.includes(p.k))]].map(([t, list]) =>
      h('div', { class: 'priv-group' }, h('span', { class: 'priv-title' }, t),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px 12px' } }, list.map(p => p.el)))),
    prof && !Array.isArray(prof.puede) ? h('span', { class: 'small-text' }, 'Todavía no se marcan: mientras tanto sale en las sugerencias para todo.') : null);
  const err = h('div', { class: 'err' });
  // Directorio (solo los ancianos): contactos/{perfil}, aparte para que los demás no lo vean
  const showContact = FB_CONFIG && isElder(), ro = FB_CONFIG && !can('programa');
  const c0 = prof && showContact ? nube.contactos.get(prof.id) || {} : {};
  const telI = h('input', { type: 'tel', value: c0.tel || '', placeholder: 'Con lada, ej.: +52 55 1234 5678' });
  const dirI = h('textarea', { rows: 2, maxlength: 300, placeholder: 'Calle, número, colonia…' }, c0.dir || '');
  const emI = h('input', { type: 'text', value: c0.emergencia || '', placeholder: 'Nombre y parentesco' });
  const emTelI = h('input', { type: 'tel', value: c0.emergenciaTel || '', placeholder: '+52 …' });
  const quick = (href, text) => h('a', { href, target: href.startsWith('http') ? '_blank' : null, rel: 'noopener', class: 'btn small', style: { textDecoration: 'none' } }, text);
  const contactField = showContact ? h('div', { class: 'field' }, h('span', { class: 'small-text' }, 'Solo lo ven los ancianos.'),
    h('div', { class: 'row', style: { gap: '12px', alignItems: 'flex-start' } },
      h('label', { class: 'field', style: { flex: 1, minWidth: '180px' } }, 'Teléfono', telI),
      h('label', { class: 'field', style: { flex: 2, minWidth: '220px' } }, 'Dirección', dirI)),
    h('div', { class: 'row', style: { gap: '12px' } },
      h('label', { class: 'field', style: { flex: 1, minWidth: '180px' } }, 'Contacto de emergencia', emI),
      h('label', { class: 'field', style: { flex: 1, minWidth: '180px' } }, 'Teléfono de emergencia', emTelI)),
    c0.tel || c0.dir || c0.emergenciaTel ? h('div', { class: 'row', style: { gap: '6px' } },
      c0.tel ? quick(telLink(c0.tel), '📞 Llamar') : null, c0.tel ? quick(waLink(c0.tel), '💬 WhatsApp') : null,
      c0.dir ? quick('https://maps.google.com/?q=' + encodeURIComponent(c0.dir), '🧭 Mapa') : null,
      c0.emergenciaTel ? quick(telLink(c0.emergenciaTel), '🚑 Emergencia') : null) : null) : null;
  async function saveContact(pid) {
    if (!showContact) return;
    const data = { tel: squash(telI.value).slice(0, 60), dir: dirI.value.trim().slice(0, 300), emergencia: squash(emI.value).slice(0, 150), emergenciaTel: squash(emTelI.value).slice(0, 60) };
    const was = { tel: c0.tel || '', dir: c0.dir || '', emergencia: c0.emergencia || '', emergenciaTel: c0.emergenciaTel || '' };
    if (stable(data) === stable(was)) return;
    try {
      if (Object.values(data).some(Boolean)) await F.setDoc(congRef('contactos', pid), data);
      else await F.deleteDoc(congRef('contactos', pid));
    } catch (e) { toast('No se guardó el directorio: ' + errMsg(e)); }
  }
  // Sin Programa VyM (secretario, función Anciano): solo ve los datos y cambia el directorio
  if (ro) {
    [nameI, ageI, sexM, sexF, notesI, tipoSel, famSel, nomSel, sitSel, bautI, capI, birthI, baptI, hopeSel, ...privBoxes.map(p => p.box)].forEach(el => { el.disabled = true; });
    privField.querySelectorAll('button').forEach(b => b.remove());
  }

  // Ausencia: la ponen Programa VyM y el secretario (cada quien, la suya en Inicio)
  const awayBox = FB_CONFIG && prof && (can('programa') || can('secretario')) ? h('div', { class: 'row spread' }) : null;
  const paintAway = () => { if (!awayBox) return; const a = awayNow(prof.id);
    awayBox.replaceChildren(h('span', { class: 'small-text', style: a ? { color: 'var(--orange)' } : null }, a ? awayText(a) + (a.nota ? ` · ${a.nota}` : '') : 'No está ausente.'),
      h('button', { class: 'btn small', type: 'button', onclick: () => openAbsenceDialog(prof.id, prof.name, () => setTimeout(paintAway, 300)) }, a ? 'Cambiar' : 'Poner ausencia')); };
  paintAway();
  const hist = [];
  if (prof) for (const q of sortedPrograms()) for (const x of assignmentsOf(q)) if (x.pid === prof.id) hist.push({ q, x });

  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' },
      h('h3', null, ro ? prof.name : prof ? 'Editar hermano' : 'Nuevo hermano'),
      h('div', { class: 'dlg-sec' }, 'Datos'),
      h('label', { class: 'field' }, 'Nombre', nameI),
      h('div', { class: 'row', style: { gap: '24px', alignItems: 'flex-start' } },
        h('label', { class: 'field' }, 'Edad', ageI),
        h('div', { class: 'field' }, h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Sexo'),
          h('div', { class: 'radios' }, h('label', null, sexM, 'Masculino'), h('label', null, sexF, 'Femenino')))),
      h('div', { class: 'row', style: { gap: '20px', alignItems: 'flex-end' } },
        h('label', { class: 'field' }, 'Informe mensual', tipoSel),
        h('label', { class: 'field' }, 'Situación', sitSel),
        h('label', { class: 'row', style: { gap: '6px', color: 'var(--text)', fontSize: '14px', paddingBottom: '8px' } }, bautI, 'Bautizado')),
      h('div', { class: 'row', style: { gap: '20px', alignItems: 'flex-end' } },
        h('label', { class: 'field' }, 'Fecha de nacimiento', birthI),
        h('label', { class: 'field' }, 'Fecha de bautismo', baptI),
        h('label', { class: 'field' }, 'Esperanza', hopeSel)),
      state.families.length || nube.grupos.length ? h('div', { class: 'row', style: { gap: '20px', alignItems: 'flex-end' } },
        state.families.length ? h('label', { class: 'field' }, 'Familia', famSel) : null,
        nube.grupos.length ? h('label', { class: 'field' }, 'Grupo', groupSel) : null) : null,
      h('label', { class: 'field' }, 'Notas', notesI),
      h('div', { class: 'dlg-sec' }, 'Nombramiento y responsabilidades'),
      h('div', { class: 'row', style: { gap: '20px', alignItems: 'flex-end' } },
        h('label', { class: 'field' }, 'Nombramiento', nomSel),
        h('label', { class: 'row', style: { gap: '6px', color: 'var(--text)', fontSize: '14px', paddingBottom: '8px' } }, capI, 'Capitán de territorios')),
      h('span', { class: 'small-text' }, 'El capitán sale en la lista al asignar tarjetas de territorio; si tiene cuenta, también registra lo trabajado en la app.'),
      h('div', { class: 'dlg-sec' }, 'Asignaciones que puede recibir'),
      privField,
      awayBox ? h('div', { class: 'dlg-sec' }, 'Ausencia') : null,
      awayBox,
      contactField ? h('div', { class: 'dlg-sec' }, 'Directorio') : null,
      contactField,
      accountField ? h('div', { class: 'dlg-sec' }, 'Cuenta en la app') : null,
      accountField,
      err,
      prof ? h('div', { class: 'hist' },
        h('strong', null, `Historial (${hist.length})`),
        hist.length ? hist.map(({ q, x }) => h('div', null, h('span', null, roleLabel(x.row, x.slot)), h('span', { class: 'muted' }, fmtShort(q.date))))
          : h('div', { class: 'muted' }, 'Todavía no tiene asignaciones.')) : null),
    h('div', { class: 'dlg-foot' },
      prof && !ro ? h('button', { class: 'btn danger', style: { marginRight: 'auto' }, onclick: () => {
        if (!confirm(`¿Eliminar a ${prof.name}?${hist.length ? ' Se quitará de las ' + hist.length + ' asignaciones donde aparece.' : ''}${account ? ' Su cuenta sigue en la congregación, sin hermano.' : ''}`)) return;
        state.profiles = state.profiles.filter(x => x !== prof);
        for (const q of state.programs) for (const r of q.rows) for (const k of ['a', 'b', 'xa', 'xb']) if (r[k] === prof.id) r[k] = null;
        if (account) memberUpdate(account, { perfil: null });
        if (oldGroup && (!FB_CONFIG || can('secretario'))) setGroupMember(prof.id, oldGroup, null);
        save(); saved = true; dlg.close(); render();
      } }, 'Eliminar') : null,
      h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: submit }, 'Guardar')));

  async function submit() {
    if (ro) {
      const ng = nube.grupos.find(g => g.id === groupSel.value) || null;
      if (!groupSel.disabled && ng !== oldGroup) setGroupMember(prof.id, oldGroup, ng);
      await saveContact(prof.id); saved = true; dlg.close(); toast('Datos guardados'); return render(); }
    const name = squash(nameI.value);
    const sexV = sexM.checked ? 'M' : sexF.checked ? 'F' : '';
    if (!name) return err.textContent = 'Escribe el nombre.';
    if (!sexV) return err.textContent = 'Elige el sexo.';
    const other = profByName(name);
    if (other && other !== prof) return err.textContent = 'Ya existe un hermano con ese nombre.';
    // Con fecha de nacimiento, la edad se calcula sola
    const born = birthI.value ? toDate(birthI.value) : null, now = new Date();
    const age = born ? now.getFullYear() - born.getFullYear() - (now < new Date(now.getFullYear(), born.getMonth(), born.getDate()) ? 1 : 0)
      : ageI.value === '' ? null : Math.max(0, Math.round(+ageI.value));
    const p = prof || { id: uid() };
    Object.assign(p, { name, sex: sexV, age, notes: squash(notesI.value), familyId: famSel.value || null, tipo: tipoSel.value,
      nombramiento: sexV === 'M' ? nomSel.value : '', situacion: sitSel.value, bautizado: bautI.checked || !!baptI.value, capitan: capI.checked,
      nacimiento: birthI.value || null, bautismoFecha: baptI.value || null, esperanza: hopeSel.value });
    // Si tiene cuenta, también se le da (o quita) la función Capitán para que registre en la app
    if (account && !account.admin && capI.checked !== (account.permisos || []).includes('capitan'))
      memberUpdate(account, { permisos: capI.checked ? F.arrayUnion('capitan') : F.arrayRemove('capitan') });
    // Si nunca se marcaron y se deja todo en blanco, sigue "sin configurar" (sale para todo)
    const puede = privBoxes.filter(x => x.box.checked).map(x => x.k);
    if (puede.length || Array.isArray(p.puede)) p.puede = puede;
    if (!prof) state.profiles.push(p);
    const newGroup = nube.grupos.find(g => g.id === groupSel.value) || null;
    if (!groupSel.disabled && newGroup !== oldGroup) setGroupMember(p.id, oldGroup, newGroup);
    const link = !account && nube.miembros.find(m => m.id === accountSel.value);
    if (link) memberUpdate(link, { perfil: p.id }, `${p.name} ya está unido a la cuenta ${link.email}`);
    await saveContact(p.id);
    save(); refreshDatalist(); saved = true; dlg.close();
    if (opts.onSave) opts.onSave(p); else render();
  }
  dlg.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); } });
  dlg.addEventListener('close', () => { dlg.remove(); if (!saved && opts.onCancel) opts.onCancel(); });
  document.body.append(dlg);
  dlg.showModal();
  if (!ro) nameI.focus();
}
