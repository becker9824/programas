// Programas · Aviso de privacidad, consentimiento, derechos de cada quien y sección Privacidad del coordinador.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones). Los textos están en legal-textos.js.
//
// consentimientos/{uid} = { version, estado: 'aceptado' | 'revocado', sensibles, mayor, nombre, email, plataforma, fecha }:
// constancia de que esa cuenta, ya autenticada, aceptó (fecha de la hora del servidor).
// solicitudes/{id} = { uid, nombre, email, perfil, tipo, detalle, estado, fecha, respuesta, atendida }.
// congregaciones/{c}.legal = { responsable, domicilio, correo }: quién responde por los datos.
// perfil.consentimiento = fecha en que firmó en papel (hermanos sin cuenta y menores de edad).

function openLegal(key) {
  const d = LEGAL_DOCS[key], close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg wide' },
    h('div', { class: 'dlg-body legal-text' }, h('h3', null, d.titulo),
      h('div', { class: 'muted small-text' }, `Última actualización: ${LEGAL_FECHA}`),
      legalResponsible(),
      d.secciones.map(([t, ...blocks]) => [h('h4', null, t),
        blocks.map(b => typeof b === 'string' ? h('p', null, b) : h('ul', null, b.map(x => h('li', null, x))))])),
    h('div', { class: 'dlg-foot' }, h('button', { class: 'btn primary', onclick: close }, 'Cerrar')));
  document.body.append(dlg); dlg.showModal();
}
const legalLinks = () => h('div', { class: 'legal-links' }, Object.entries(LEGAL_DOCS).map(([k, d]) =>
  h('button', { type: 'button', class: 'linkbtn', onclick: () => openLegal(k) }, d.titulo)));
// Identidad y domicilio del responsable (los escribe el coordinador en Privacidad)
function legalResponsible() {
  const l = nube.congData && nube.congData.legal;
  if (!nube.cong || !nube.congData) return null;
  return h('div', { class: 'legal-who' }, h('strong', null, 'Responsable de tus datos'),
    h('div', null, (l && l.responsable) || `Ancianos de ${congName() || 'tu congregación'}`),
    l && l.domicilio ? h('div', null, l.domicilio) : null,
    l && l.correo ? h('div', null, l.correo) : h('div', { class: 'muted' }, 'El coordinador todavía no pone el correo de contacto.'));
}

// ---------- consentimiento ----------
const consentRef = () => congRef('consentimientos', nube.user.uid);
const platformName = () => NATIVE ? 'Android' : location.protocol === 'app:' ? 'PC' : 'Web';
const saveConsent = nombre => F.setDoc(consentRef(), { version: LEGAL_VERSION, estado: 'aceptado', sensibles: true, mayor: true,
  nombre: nombre || (nube.me && nube.me.nombre) || '', email: nube.user.email || '', plataforma: platformName(), fecha: F.serverTimestamp() });
// Sin internet y sin nada guardado no se deja a nadie fuera: se pregunta cuando vuelva la conexión
async function consentOk() {
  try {
    const s = await F.getDoc(consentRef()), d = s.exists() ? s.data() : null;
    if (d && d.estado === 'aceptado' && d.version === LEGAL_VERSION) return true;
    // La pantalla de aceptación debe decir quién responde por los datos
    nube.congData = (await F.getDoc(congRef())).data() || nube.congData;
    return false;
  } catch (e) { return true; }
}
const check = text => { const box = h('input', { type: 'checkbox' }); return { box, el: h('label', { class: 'legal-check' }, box, h('span', null, text)) }; };
// Casillas de aceptación (al crear cuenta y al entrar). ok() dice si están todas marcadas.
function consentBoxes() {
  const a = check('Leí y acepto el Aviso de privacidad, los Términos y condiciones y el Uso de datos.');
  const b = check('Doy mi consentimiento expreso para que se guarden y usen mis datos sensibles, incluidos los que revelan mis creencias religiosas.');
  const c = check('Soy mayor de edad, o mi madre, padre o tutor me autorizó.');
  return { el: h('div', { class: 'legal-boxes' }, a.el, b.el, c.el), ok: () => a.box.checked && b.box.checked && c.box.checked };
}
function renderConsent(done) {
  const boxes = consentBoxes(), err = h('div', { class: 'err' });
  const btn = h('button', { class: 'btn primary', onclick: async () => {
    if (!boxes.ok()) return void (err.textContent = 'Para usar la app hay que marcar las tres casillas.');
    btn.disabled = true;
    try { await saveConsent(); done(); } catch (e) { err.textContent = errMsg(e); btn.disabled = false; }
  } }, 'Aceptar y continuar');
  screen(h('div', { class: 'card auth-card' }, h('h2', null, '🔒 Tu privacidad'),
    h('p', { class: 'muted' }, 'Tu congregación guarda datos tuyos para organizar las reuniones y asignaciones. Algunos son sensibles porque revelan tus creencias religiosas, y la ley pide tu consentimiento. No se venden ni se usan para publicidad, y puedes retirarlo cuando quieras.'),
    legalResponsible(), legalLinks(), boxes.el, err, btn,
    h('div', { class: 'row' }, signOutBtn())));
}

// ---------- Ajustes: privacidad y mis datos ----------
const REQUEST_TYPES = [['acceso', 'Acceso', 'Saber qué datos míos tiene la congregación'], ['rectificacion', 'Corrección', 'Corregir un dato que está mal'],
  ['cancelacion', 'Cancelación', 'Que se borren mis datos'], ['oposicion', 'Oposición o límite', 'Que no se use un dato para algo en particular']];
const requestLabel = k => k === 'revocacion' ? 'Retiro del consentimiento' : k === 'baja' ? 'Eliminación de cuenta' : (REQUEST_TYPES.find(t => t[0] === k) || [k, k])[1];
const sendRequest = (tipo, detalle) => F.addDoc(F.collection(F.db, 'congregaciones', nube.cong, 'solicitudes'),
  { uid: nube.user.uid, nombre: nube.me.nombre || '', email: nube.user.email || '', perfil: nube.me.perfil || null, tipo, detalle: detalle.slice(0, 1000), estado: 'pendiente', fecha: F.serverTimestamp() });

function privacyCard() {
  const close = dlg => { dlg.close(); dlg.remove(); };
  const request = () => {
    const tipo = segmented(REQUEST_TYPES.map(([k, t, s]) => [k, t, s]), 'acceso');
    const text = h('textarea', { rows: 4, maxlength: 1000, placeholder: 'Cuéntanos qué necesitas. Por ejemplo, qué dato está mal y cuál es el correcto.' });
    const err = h('div', { class: 'err' });
    const dlg = h('dialog', { class: 'dlg' },
      h('div', { class: 'dlg-body' }, h('h3', null, 'Hacer una solicitud'),
        h('p', { class: 'muted small-text', style: { margin: 0 } }, 'Le llega al coordinador. Debe responderte en un máximo de 20 días hábiles.'),
        tipo.el, h('label', { class: 'field' }, 'Detalle', text), err),
      h('div', { class: 'dlg-foot' }, h('button', { class: 'btn', onclick: () => close(dlg) }, 'Cancelar'),
        h('button', { class: 'btn primary', onclick: async e => {
          if (!squash(text.value)) return void (err.textContent = 'Escribe el detalle.');
          e.target.disabled = true;
          try { await sendRequest(tipo.get(), text.value.trim()); close(dlg); toast('Solicitud enviada'); } catch (x) { err.textContent = errMsg(x); e.target.disabled = false; }
        } }, 'Enviar')));
    document.body.append(dlg); dlg.showModal();
  };
  return [h('h2', { class: 'group' }, 'Privacidad y mis datos'),
    h('div', { class: 'card settings', style: { marginBottom: '14px' } }, legalResponsible(), legalLinks(),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: downloadMyData }, '⬇ Descargar mis datos'),
        h('button', { class: 'btn small', onclick: request }, 'Hacer una solicitud'),
        h('button', { class: 'btn small', onclick: showMyRequests }, 'Mis solicitudes')),
      h('div', { class: 'row' },
        h('button', { class: 'btn small danger', onclick: withdrawConsent }, 'Retirar mi consentimiento'),
        h('button', { class: 'btn small danger', onclick: deleteMyAccount }, 'Eliminar mi cuenta')))];
}
async function downloadMyData() {
  const pid = nube.me.perfil, read = async r => { try { const s = await F.getDoc(r); return s.exists() ? s.data() : null; } catch (e) { return null; } };
  const out = { fecha: new Date().toISOString(), congregacion: congName(), cuenta: nube.me, correo: nube.user.email, consentimiento: await read(consentRef()) };
  if (pid) {
    out.ausencia = await read(congRef('ausencias', pid));
    out.confirmaciones = await read(congRef('confirmaciones', pid));
    out.asignaciones = myAssignments(myWeeks());
    const col = F.collection(F.db, 'congregaciones', nube.cong, 'informes');
    out.informes = await F.getDocs(F.query(col, F.where('perfil', '==', pid))).then(s => s.docs.map(d => d.data()), () => []);
    if (isElder()) { out.ficha = profById(pid) || null; out.contacto = nube.contactos.get(pid) || null; }
  }
  saveBlob(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), 'mis-datos-programas.json');
}
async function showMyRequests() {
  const col = F.collection(F.db, 'congregaciones', nube.cong, 'solicitudes');
  const list = await F.getDocs(F.query(col, F.where('uid', '==', nube.user.uid))).then(s => s.docs.map(d => d.data()), () => []);
  list.sort((a, b) => stampMs(b.fecha) - stampMs(a.fecha));
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, 'Mis solicitudes'),
      list.length ? list.map(r => h('div', { class: 'urow' }, h('div', { class: 'info' }, h('strong', null, requestLabel(r.tipo)),
        h('span', { class: 'badge ' + (r.estado === 'pendiente' ? 's-dup' : 's-stale'), style: { marginLeft: '8px' } }, r.estado === 'pendiente' ? 'Pendiente' : 'Atendida'),
        h('div', { class: 'small-text muted' }, `${fmtStamp(r.fecha)}${r.detalle ? ' · ' + r.detalle : ''}`),
        r.respuesta ? h('div', { class: 'small-text' }, 'Respuesta: ' + r.respuesta) : null)))
        : h('p', { class: 'muted' }, 'Todavía no has hecho ninguna solicitud.')),
    h('div', { class: 'dlg-foot' }, h('button', { class: 'btn primary', onclick: close }, 'Cerrar')));
  document.body.append(dlg); dlg.showModal();
}
async function withdrawConsent() {
  if (!confirm('Si retiras tu consentimiento ya no podrás usar la app, y el coordinador recibirá tu solicitud para decidir qué datos se borran. Lo que ya se hizo antes no cambia. ¿Continuar?')) return;
  try {
    await F.setDoc(consentRef(), { version: LEGAL_VERSION, estado: 'revocado', sensibles: false, mayor: false, nombre: nube.me.nombre || '', email: nube.user.email || '', plataforma: platformName(), fecha: F.serverTimestamp() });
    await sendRequest('revocacion', 'Retiró su consentimiento desde la app.');
    toast('Consentimiento retirado'); setTimeout(() => location.reload(), 900);
  } catch (e) { toast(errMsg(e)); }
}
async function deleteMyAccount() {
  if (isAdmin()) return toast('Eres coordinador: primero pasa esa función a otro hermano en Hermanos.');
  if (!confirm('Se eliminará tu cuenta y ya no podrás entrar. El coordinador recibirá una solicitud para tratar tus demás datos, como tu ficha e informes. ¿Eliminar mi cuenta?')) return;
  const uid = nube.user.uid, user = F.auth.currentUser;
  try {
    await sendRequest('baja', 'Eliminó su cuenta desde la app.');
    await Promise.resolve(forgetSession()).catch(() => {});
    await F.deleteDoc(congRef('avisos', uid)).catch(() => {});
    await F.deleteDoc(ref('usuarios', uid));
    await F.deleteDoc(congRef('miembros', uid));
    await F.deleteUser(user);
    toast('Tu cuenta se eliminó');
  } catch (e) {
    toast(e.code === 'auth/requires-recent-login' ? 'Tu solicitud se envió. Por seguridad, cierra sesión, vuelve a entrar e inténtalo otra vez para terminar.' : errMsg(e));
    setTimeout(() => location.reload(), 2500);
  }
}

// ---------- sección Privacidad (coordinador) ----------
let privacyData = null;
function renderPrivacy() {
  const box = h('div');
  const load = async () => {
    box.replaceChildren(h('p', { class: 'muted' }, 'Cargando…'));
    try {
      const [c, r] = await Promise.all(['consentimientos', 'solicitudes'].map(n => F.getDocs(F.collection(F.db, 'congregaciones', nube.cong, n))));
      privacyData = { consents: new Map(c.docs.map(d => [d.id, d.data()])), requests: r.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => stampMs(b.fecha) - stampMs(a.fecha)) };
      box.replaceChildren(...privacyBody(load));
    } catch (e) { box.replaceChildren(h('p', { class: 'err' }, errMsg(e))); }
  };
  load();
  return h('div', null,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Privacidad'),
      h('p', { class: 'sub', style: { margin: 0 } }, 'Lo que tu congregación debe tener en orden como responsable de los datos.'))),
    h('div', { class: 'notice warn' }, 'Estos textos son una base y no sustituyen la revisión de un abogado.'), box);
}
function privacyBody(reload) {
  const { consents, requests } = privacyData, l = (nube.congData && nube.congData.legal) || {};
  const input = (ph, v, type = 'text') => h('input', { type, value: v || '', placeholder: ph, maxlength: 200 });
  const who = input('Ej.: Cuerpo de ancianos de la congregación', l.responsable), dom = input('Domicilio del Salón del Reino', l.domicilio), mail = input('Correo de contacto', l.correo, 'email');
  const pend = requests.filter(r => r.estado === 'pendiente');
  const attend = r => {
    const text = h('textarea', { rows: 3, maxlength: 1000, placeholder: 'Qué se hizo o por qué no procede' });
    const close = () => { dlg.close(); dlg.remove(); };
    const dlg = h('dialog', { class: 'dlg' },
      h('div', { class: 'dlg-body' }, h('h3', null, `${requestLabel(r.tipo)} · ${r.nombre}`), h('p', { style: { margin: 0 } }, r.detalle),
        h('p', { class: 'muted small-text', style: { margin: 0 } }, `${r.email} · ${fmtStamp(r.fecha)}`), h('label', { class: 'field' }, 'Respuesta', text)),
      h('div', { class: 'dlg-foot' }, h('button', { class: 'btn', onclick: close }, 'Cancelar'),
        h('button', { class: 'btn primary', onclick: async () => {
          try { await F.updateDoc(congRef('solicitudes', r.id), { estado: 'atendida', respuesta: text.value.trim().slice(0, 1000), atendida: F.serverTimestamp() }); close(); logChange(`Atendió una solicitud de privacidad de ${r.nombre}`); reload(); }
          catch (e) { toast(errMsg(e)); }
        } }, 'Marcar como atendida')));
    document.body.append(dlg); dlg.showModal();
  };
  // Hermanos: cuenta que aceptó, papel firmado o falta
  const accountOf = pid => nube.miembros.find(m => m.perfil === pid);
  const statusOf = pr => {
    const acc = accountOf(pr.id), c = acc && consents.get(acc.id);
    if (c && c.estado === 'aceptado') return ['s-stale', c.version === LEGAL_VERSION ? 'Aceptó en la app' : 'Falta aceptar lo nuevo'];
    if (pr.consentimiento) return ['s-stale', 'Papel: ' + fmtShort(pr.consentimiento)];
    return ['s-recent', c && c.estado === 'revocado' ? 'Retiró su consentimiento' : 'Falta'];
  };
  const people = [...state.profiles].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const missing = people.filter(p => statusOf(p)[1] === 'Falta').length;
  return [
    h('h2', { class: 'group' }, 'Responsable de los datos'),
    h('div', { class: 'card settings', style: { marginBottom: '14px' } },
      h('p', { class: 'muted small-text', style: { margin: 0 } }, 'La ley pide decir quién responde y su domicilio. Se muestra a los hermanos antes de aceptar.'),
      h('label', { class: 'field' }, 'Quién responde', who), h('label', { class: 'field' }, 'Domicilio', dom), h('label', { class: 'field' }, 'Correo para solicitudes', mail),
      h('div', null, h('button', { class: 'btn primary', onclick: async () => {
        try { await F.updateDoc(congRef(), { legal: { responsable: squash(who.value), domicilio: squash(dom.value), correo: mail.value.trim() } }); toast('Guardado'); } catch (e) { toast(errMsg(e)); }
      } }, 'Guardar'))),
    h('h2', { class: 'group' }, `Solicitudes (${pend.length} pendiente${pend.length === 1 ? '' : 's'})`),
    h('div', { class: 'card', style: { padding: '4px 14px', marginBottom: '14px' } },
      requests.length ? requests.map(r => h('div', { class: 'urow' }, h('div', { class: 'info' }, h('strong', null, `${requestLabel(r.tipo)} · ${r.nombre}`),
        h('div', { class: 'small-text muted' }, `${fmtStamp(r.fecha)}${r.detalle ? ' · ' + r.detalle : ''}`),
        r.respuesta ? h('div', { class: 'small-text' }, 'Respuesta: ' + r.respuesta) : null),
        r.estado === 'pendiente' ? h('button', { class: 'btn small primary', onclick: () => attend(r) }, 'Responder') : h('span', { class: 'badge s-stale' }, 'Atendida')))
        : h('div', { class: 'empty' }, 'No hay solicitudes. Debes responder en un máximo de 20 días hábiles.')),
    h('h2', { class: 'group' }, `Consentimientos (${missing} falta${missing === 1 ? '' : 'n'})`),
    h('div', { class: 'card', style: { padding: '14px', marginBottom: '14px' } },
      h('p', { class: 'muted small-text', style: { marginTop: 0 } }, 'Quien no tiene cuenta debe firmar en papel. Si es menor de edad, firma su madre, padre o tutor. Guarda las hojas firmadas en un lugar seguro.'),
      h('div', { class: 'row', style: { marginBottom: '8px' } }, h('button', { class: 'btn small', onclick: consentSheetPDF }, '⬇ Hoja para firmar')),
      people.length ? h('div', { class: 'tablewrap' }, h('table', { class: 'stats' }, h('tbody', null, people.map(pr => {
        const [cls, text] = statusOf(pr), minor = pr.age != null && pr.age < 18;
        return h('tr', { style: { cursor: 'default' } }, h('td', null, h('strong', null, pr.name), minor ? h('span', { class: 'tag-fam' }, 'Menor') : null),
          h('td', null, h('span', { class: 'badge ' + cls }, text)),
          h('td', { style: { textAlign: 'right' } }, h('input', { type: 'date', value: pr.consentimiento || '', max: todayISO(), title: 'Fecha en que firmó en papel',
            onchange: e => { if (e.target.value) pr.consentimiento = e.target.value; else delete pr.consentimiento; save(); logChange(`Anotó el consentimiento en papel de ${pr.name}`); privacyBodyRefresh(reload); } })));
      })))) : h('div', { class: 'empty' }, 'Aún no hay hermanos.')),
  ];
}
const privacyBodyRefresh = reload => setTimeout(reload, 300);
// Hoja para firmar a mano: quien no tiene cuenta o es menor de edad
function consentSheetPDF() {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) return toast('No se pudo crear el PDF.');
  const doc = new J({ unit: 'pt', format: state.settings.paper === 'a4' ? 'a4' : 'letter' }), W = doc.internal.pageSize.getWidth(), M = 54, l = (nube.congData && nube.congData.legal) || {};
  let y = 66;
  const para = (t, size = 11, bold = false, gap = 10) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    const lines = doc.splitTextToSize(t, W - 2 * M); doc.text(lines, M, y); y += lines.length * size * 1.35 + gap;
  };
  para('Consentimiento para el tratamiento de datos personales', 16, true, 16);
  para(`Responsable: ${l.responsable || 'Ancianos de ' + (congName() || 'la congregación')}. Domicilio: ${l.domicilio || '__________________________________'}. Correo: ${l.correo || '____________________'}.`);
  para('La congregación guarda en la app Programas datos como nombre, sexo, edad o fecha de nacimiento, familia, teléfono, dirección y contacto de emergencia. También datos sensibles porque revelan creencias religiosas: pertenencia a la congregación, bautismo, nombramiento y privilegios, asignaciones, informes de predicación y visitas de pastoreo.');
  para('Se usan solo para organizar las reuniones, las asignaciones y los registros de la congregación. No se venden ni se usan para publicidad. Se guardan con servicios de terceros, cuyos servidores pueden estar fuera de México.');
  para('Puede pedir acceso a sus datos, corregirlos, cancelarlos, oponerse a su uso o retirar este consentimiento con los ancianos de la congregación o por el correo indicado. El aviso de privacidad completo está en:');
  para(LEGAL_URL, 10);
  para('Doy mi consentimiento expreso y por escrito para que se guarden y usen estos datos, incluidos los sensibles.', 11, true, 34);
  for (const t of ['Nombre de la persona:', 'Firma:', 'Fecha:', 'Si es menor de edad, nombre y firma de su madre, padre o tutor:']) {
    para(t, 11, false, 26); doc.setDrawColor(120); doc.line(M, y - 16, W - M, y - 16);
  }
  savePDF(doc, 'Consentimiento de datos personales');
}
