// Programas · Anuncios, directorio y cuentas de la congregación.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- anuncios (los leen todos; los publican los ancianos) ----------
const stampMs = t => t && t.toMillis ? t.toMillis() : Date.now(); // recién creado: la hora del servidor aún no llega
const seenKey = () => 'anuncios-vistos-' + (nube.user ? nube.user.uid : '');
const seenAt = () => { try { return +localStorage.getItem(seenKey()) || 0; } catch (e) { return 0; } };
// Los vencidos solo los siguen viendo los ancianos (marcados como vencidos)
function visibleAnnouncements() {
  const today = todayISO();
  return nube.anuncios.filter(a => isElder() || !a.vence || a.vence >= today)
    .sort((a, b) => b.fijado - a.fijado || stampMs(b.fecha) - stampMs(a.fecha));
}
const unreadAnnouncements = () => {
  const seen = seenAt(), today = todayISO();
  return nube.anuncios.filter(a => a.autor !== nube.user.uid && stampMs(a.fecha) > seen && (!a.vence || a.vence >= today)).length;
};
// Texto con saltos de línea y enlaces que se pueden tocar
function richText(text) {
  const out = [];
  for (const part of (text || '').split(/(https?:\/\/[^\s<>"]+)/g)) {
    if (/^https?:\/\//.test(part)) out.push(h('a', { href: part, target: '_blank', rel: 'noopener' }, part));
    else part.split('\n').forEach((line, i) => { if (i) out.push(h('br')); if (line) out.push(line); });
  }
  return out;
}

function openAnnouncementDialog(a) {
  const title = h('input', { type: 'text', maxlength: 150, value: a ? a.titulo : '', placeholder: 'Ej.: Asamblea de circuito' });
  const text = h('textarea', { rows: 8, maxlength: 5000, placeholder: 'Escribe el anuncio. Puedes pegar enlaces.' }, a ? a.texto : '');
  const pin = h('input', { type: 'checkbox', checked: a ? a.fijado : false });
  const until = h('input', { type: 'date', value: a && a.vence ? a.vence : '' });
  const err = h('div', { class: 'err' });
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, a ? 'Editar anuncio' : 'Nuevo anuncio'),
      h('label', { class: 'field' }, 'Título', title),
      h('label', { class: 'field' }, 'Texto', text),
      h('div', { class: 'row', style: { gap: '20px', alignItems: 'flex-end' } },
        h('label', { class: 'row', style: { gap: '6px', color: 'var(--text)' } }, pin, '📌 Fijar arriba'),
        h('label', { class: 'field' }, 'Mostrar hasta (opcional)', until)),
      err),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async e => {
        if (!squash(title.value)) return err.textContent = 'Escribe un título.';
        const data = { titulo: squash(title.value), texto: text.value.trim(), fijado: pin.checked, vence: until.value || null };
        e.target.disabled = true;
        try {
          if (a) await F.updateDoc(congRef('anuncios', a.id), { ...data, editado: F.serverTimestamp() });
          else await F.addDoc(F.collection(F.db, 'congregaciones', nube.cong, 'anuncios'),
            { ...data, autor: nube.user.uid, autorNombre: nube.me.nombre, fecha: F.serverTimestamp() });
          toast(a ? 'Anuncio actualizado' : 'Anuncio publicado'); dlg.close(); dlg.remove();
        } catch (ex) { err.textContent = errMsg(ex); e.target.disabled = false; }
      } }, a ? 'Guardar' : 'Publicar')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal(); title.focus();
}

function renderAnnouncements() {
  const seen = seenAt(), today = todayISO(), list = visibleAnnouncements();
  try { localStorage.setItem(seenKey(), String(Date.now())); } catch (e) {}
  const card = a => {
    const isNew = a.autor !== nube.user.uid && stampMs(a.fecha) > seen, expired = a.vence && a.vence < today;
    return h('div', { class: 'card', style: { padding: '16px', marginBottom: '12px', borderLeft: a.fijado ? '4px solid var(--accent)' : null, opacity: expired ? '.6' : null } },
      h('div', { class: 'row spread', style: { alignItems: 'flex-start' } },
        h('div', null,
          h('strong', { style: { fontSize: '17px' } }, a.fijado ? '📌 ' : '', a.titulo),
          isNew ? h('span', { class: 'badge s-stale', style: { marginLeft: '8px' } }, 'Nuevo') : null,
          h('div', { class: 'muted small-text' }, [a.autorNombre, a.fecha ? fmtStamp(a.fecha) : 'ahora',
            a.vence ? (expired ? `vencido el ${fmtShort(a.vence)}` : `hasta el ${fmtShort(a.vence)}`) : null].filter(Boolean).join(' · '))),
        isElder() ? h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: () => openAnnouncementDialog(a) }, 'Editar'),
          h('button', { class: 'btn small danger', onclick: async () => {
            if (!confirm(`¿Borrar el anuncio “${a.titulo}”?`)) return;
            try { await F.deleteDoc(congRef('anuncios', a.id)); toast('Anuncio borrado'); } catch (e) { toast(errMsg(e)); }
          } }, 'Borrar')) : null),
      a.texto ? h('div', { style: { marginTop: '10px', whiteSpace: 'normal', overflowWrap: 'anywhere' } }, richText(a.texto)) : null);
  };
  return h('div', null,
    h('div', { class: 'row spread', style: { marginBottom: '14px' } },
      h('div', null, h('h1', null, 'Anuncios'),
        h('p', { class: 'sub', style: { margin: 0 } }, isElder() ? 'Los ven todos los hermanos de la congregación.' : 'Avisos de los ancianos de la congregación.')),
      isElder() ? h('button', { class: 'btn primary', onclick: () => openAnnouncementDialog(null) }, '+ Nuevo anuncio') : null),
    list.length ? list.map(card) : h('div', { class: 'card empty' }, 'No hay anuncios por ahora.'));
}

// ---------- directorio (solo ancianos) ----------
const telLink = t => 'tel:' + (t || '').replace(/[^\d+]/g, '');
const waLink = t => 'https://wa.me/' + (t || '').replace(/\D/g, '');

// ---------- cuentas de la congregación (función "Cuentas") ----------
// Movimientos en cuentas/{id}: entrada o salida de un fondo (efectivo o banco), o transferencia
// entre los dos. El saldo inicial (cuentasConfig/inicial) cuenta desde su fecha.
const FONDOS = { caja: 'Efectivo', banco: 'Banco' };
const CATS = {
  entrada: [['donacion_cong', 'Donaciones para la congregación'], ['donacion_mundial', 'Donaciones para la obra mundial'], ['otra_entrada', 'Otra entrada']],
  salida: [['gasto', 'Gastos de la congregación'], ['envio_mundial', 'Envío a la sucursal (obra mundial)'], ['resolucion', 'Resolución'], ['otra_salida', 'Otra salida']],
  transferencia: [['deposito', 'Depósito de efectivo al banco'], ['retiro', 'Retiro del banco a efectivo']],
};
const catLabel = (tipo, k) => ((CATS[tipo] || []).find(([x]) => x === k) || [k, k])[1];
const round2 = n => Math.round(n * 100) / 100;
const money = n => (n < 0 ? '-$' : '$') + Math.abs(round2(n)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Cuánto cambia cada fondo con un movimiento
function effect(m) {
  const d = { caja: 0, banco: 0 };
  if (m.tipo === 'entrada') d[m.fondo] += m.monto;
  else if (m.tipo === 'salida') d[m.fondo] -= m.monto;
  else { d[m.fondo] -= m.monto; d[m.fondo === 'caja' ? 'banco' : 'caja'] += m.monto; }
  return d;
}
const byDate = (a, b) => a.fecha.localeCompare(b.fecha) || stampMs(a.creado) - stampMs(b.creado);

function openMovementDialog(tipo, m, month) {
  const today = todayISO();
  const fecha = h('input', { type: 'date', value: m ? m.fecha : (today.startsWith(month) ? today : month + '-01') });
  const cat = h('select', null, CATS[tipo].map(([k, label]) => h('option', { value: k, selected: m && m.categoria === k ? true : null }, label)));
  const fondo = h('select', null, Object.entries(FONDOS).map(([k, label]) => h('option', { value: k, selected: m && m.fondo === k ? true : null }, label)));
  const monto = h('input', { type: 'number', min: 0.01, step: 0.01, value: m ? m.monto : '', placeholder: '0.00', style: { width: '160px' } });
  const desc = h('input', { type: 'text', maxlength: 300, value: m ? m.descripcion : '', placeholder: tipo === 'salida' ? 'Ej.: Recibo de luz de octubre' : 'Ej.: Cajas de contribuciones' });
  const err = h('div', { class: 'err' });
  const close = () => { dlg.close(); dlg.remove(); };
  const title = { entrada: 'Entrada', salida: 'Salida', transferencia: 'Transferencia' }[tipo];
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, (m ? 'Editar ' : 'Nueva ') + title.toLowerCase()),
      h('div', { class: 'row', style: { gap: '16px', alignItems: 'flex-end' } },
        h('label', { class: 'field' }, 'Fecha', fecha),
        h('label', { class: 'field' }, 'Monto', monto),
        tipo === 'transferencia' ? null : h('label', { class: 'field' }, tipo === 'entrada' ? 'Entra a' : 'Sale de', fondo)),
      h('label', { class: 'field' }, tipo === 'transferencia' ? 'Tipo' : 'Categoría', cat),
      h('label', { class: 'field' }, 'Descripción', desc),
      err),
    h('div', { class: 'dlg-foot' },
      m ? h('button', { class: 'btn danger', style: { marginRight: 'auto' }, onclick: async () => {
        if (!confirm(`¿Borrar “${m.descripcion || catLabel(m.tipo, m.categoria)}” por ${money(m.monto)}?`)) return;
        try { await F.deleteDoc(congRef('cuentas', m.id)); toast('Movimiento borrado'); close(); } catch (e) { err.textContent = errMsg(e); }
      } }, 'Borrar') : null,
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async e => {
        const amount = round2(Number(monto.value));
        if (!fecha.value) return err.textContent = 'Elige la fecha.';
        if (!(amount > 0)) return err.textContent = 'Escribe el monto.';
        const data = { fecha: fecha.value, tipo, categoria: cat.value, descripcion: squash(desc.value), monto: amount,
          fondo: tipo === 'transferencia' ? (cat.value === 'deposito' ? 'caja' : 'banco') : fondo.value, por: nube.user.uid };
        e.target.disabled = true;
        try {
          if (m) await F.setDoc(congRef('cuentas', m.id), { ...data, creado: m.creado || F.serverTimestamp() });
          else await F.addDoc(F.collection(F.db, 'congregaciones', nube.cong, 'cuentas'), { ...data, creado: F.serverTimestamp() });
          toast('Guardado'); close();
        } catch (ex) { err.textContent = errMsg(ex); e.target.disabled = false; }
      } }, 'Guardar')));
  document.body.append(dlg); dlg.showModal(); monto.focus();
}

function openInitialDialog() {
  const ini = nube.cuentasIni || {};
  const d = new Date(); d.setDate(1);
  const fecha = h('input', { type: 'date', value: ini.fecha || isoOf(d) });
  const caja = h('input', { type: 'number', step: 0.01, value: ini.caja ?? 0, style: { width: '160px' } });
  const banco = h('input', { type: 'number', step: 0.01, value: ini.banco ?? 0, style: { width: '160px' } });
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, 'Saldo inicial'),
      h('p', { class: 'muted small-text' }, 'Lo que había en efectivo y en el banco el día en que empiezas a llevar las cuentas en la app. Los movimientos anteriores a esa fecha no cuentan.'),
      h('label', { class: 'field' }, 'Fecha', fecha),
      h('div', { class: 'row', style: { gap: '16px' } }, h('label', { class: 'field' }, 'Efectivo', caja), h('label', { class: 'field' }, 'Banco', banco))),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async () => {
        if (!fecha.value) return;
        try {
          await F.setDoc(congRef('cuentasConfig', 'inicial'), { fecha: fecha.value, caja: round2(Number(caja.value) || 0), banco: round2(Number(banco.value) || 0) });
          toast('Saldo inicial guardado'); close();
        } catch (e) { toast(errMsg(e)); }
      } }, 'Guardar')));
  document.body.append(dlg); dlg.showModal();
}

function renderAccounts() {
  const ini = nube.cuentasIni;
  if (!ini) return h('div', null, h('h1', null, 'Cuentas'),
    h('div', { class: 'card settings' },
      h('p', null, 'Para empezar, anota cuánto hay hoy en efectivo y en el banco.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: openInitialDialog }, 'Poner saldo inicial'))));
  let month = renderAccounts.month || todayISO().slice(0, 7);
  const months = [...new Set([...recentMonths(12), month])].sort().reverse();
  const counted = nube.cuentas.filter(m => m.fecha >= ini.fecha).sort(byDate);
  const add = (a, b) => ({ caja: a.caja + b.caja, banco: a.banco + b.banco });
  const sum = list => list.reduce((acc, m) => add(acc, effect(m)), { caja: 0, banco: 0 });
  const start = add({ caja: ini.caja, banco: ini.banco }, sum(counted.filter(m => m.fecha < month + '-01')));
  const inMonth = counted.filter(m => m.fecha.startsWith(month));
  const end = add(start, sum(inMonth));
  const total = (tipo, fondo) => round2(inMonth.filter(m => m.tipo === tipo && (!fondo || m.fondo === fondo)).reduce((a, m) => a + m.monto, 0));
  const byCat = tipo => CATS[tipo].map(([k, label]) => [label, round2(inMonth.filter(m => m.tipo === tipo && m.categoria === k).reduce((a, m) => a + m.monto, 0))]).filter(([, v]) => v);
  // Donaciones para la obra mundial recibidas y aún no enviadas a la sucursal (hasta el fin del mes)
  const upTo = counted.filter(m => m.fecha.slice(0, 7) <= month);
  const pendingWorld = round2(upTo.filter(m => m.categoria === 'donacion_mundial').reduce((a, m) => a + m.monto, 0)
    - upTo.filter(m => m.categoria === 'envio_mundial').reduce((a, m) => a + m.monto, 0));
  const before = nube.cuentas.length - counted.length;

  let run = start.caja + start.banco;
  const rows = inMonth.map(m => {
    const d = effect(m); run += d.caja + d.banco;
    const cell = v => h('td', { style: { color: v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--muted)', whiteSpace: 'nowrap' } }, v ? (v > 0 ? '+' : '') + money(v) : '—');
    return h('tr', { onclick: () => openMovementDialog(m.tipo, m, month), title: 'Tocar para editar o borrar' },
      h('td', { style: { whiteSpace: 'nowrap' } }, fmtShort(m.fecha)),
      h('td', null, h('strong', null, m.descripcion || catLabel(m.tipo, m.categoria)), h('div', { class: 'muted small-text' }, catLabel(m.tipo, m.categoria))),
      cell(d.caja), cell(d.banco), h('td', { style: { whiteSpace: 'nowrap' } }, money(run)));
  });

  const summary = [`Cuentas de la congregación · ${fmtMonth(month)}`,
    `Saldo inicial: efectivo ${money(start.caja)}, banco ${money(start.banco)}, total ${money(start.caja + start.banco)}`,
    `Entradas: ${money(total('entrada'))}`, ...byCat('entrada').map(([l, v]) => `  · ${l}: ${money(v)}`),
    `Salidas: ${money(total('salida'))}`, ...byCat('salida').map(([l, v]) => `  · ${l}: ${money(v)}`),
    `Saldo final: efectivo ${money(end.caja)}, banco ${money(end.banco)}, total ${money(end.caja + end.banco)}`,
    pendingWorld ? `Obra mundial por enviar a la sucursal: ${money(pendingWorld)}` : 'Obra mundial: todo enviado a la sucursal.'].join('\n');
  const csv = () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Efectivo', 'Banco'],
      ...inMonth.map(m => { const d = effect(m); return [m.fecha, m.tipo, catLabel(m.tipo, m.categoria), m.descripcion, round2(d.caja), round2(d.banco)]; })];
    saveBlob(new Blob(['﻿' + lines.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }), `Cuentas ${fmtMonth(month)}.csv`);
  };
  const box = (label, a, b, strong) => h('div', { class: 'card', style: { padding: '12px 14px', flex: '1', minWidth: '150px' } },
    h('div', { class: 'muted small-text' }, label),
    h('div', { style: { fontSize: '20px', fontWeight: 700 } }, money(b)),
    h('div', { class: 'small-text muted' }, `Al inicio del mes: ${money(a)}`), strong);

  return h('div', null,
    h('div', { class: 'row spread', style: { marginBottom: '12px' } },
      h('div', null, h('h1', null, 'Cuentas'),
        h('p', { class: 'sub', style: { margin: 0 } }, 'Solo quien lleva las cuentas y el coordinador ven esta sección.')),
      h('label', { class: 'field' }, 'Mes', monthSelect(months, month, v => { renderAccounts.month = v; render(); }))),
    h('div', { class: 'row', style: { gap: '10px', alignItems: 'stretch', marginBottom: '12px' } },
      box('Efectivo', start.caja, end.caja), box('Banco', start.banco, end.banco), box('Total', start.caja + start.banco, end.caja + end.banco)),
    pendingWorld > 0 ? h('div', { class: 'notice warn' }, `🌎 Donaciones para la obra mundial por enviar a la sucursal: ${money(pendingWorld)}`) : null,
    before ? h('div', { class: 'notice warn' }, `Hay ${before} movimiento${before > 1 ? 's' : ''} con fecha anterior al saldo inicial (${fmtShort(ini.fecha)}); no se cuentan.`) : null,
    h('div', { class: 'row', style: { marginBottom: '12px' } },
      h('button', { class: 'btn primary', onclick: () => openMovementDialog('entrada', null, month) }, '+ Entrada'),
      h('button', { class: 'btn primary', onclick: () => openMovementDialog('salida', null, month) }, '− Salida'),
      h('button', { class: 'btn', onclick: () => openMovementDialog('transferencia', null, month) }, '⇄ Depósito o retiro')),
    h('div', { class: 'card', style: { padding: '14px', marginBottom: '12px' } },
      h('div', { class: 'totals' },
        h('span', null, 'Entradas ', h('strong', { style: { color: 'var(--green)' } }, money(total('entrada')))),
        h('span', null, 'Salidas ', h('strong', { style: { color: 'var(--red)' } }, money(total('salida')))),
        h('span', null, 'Diferencia ', h('strong', null, money(total('entrada') - total('salida'))))),
      h('div', { class: 'tablewrap' }, h('table', { class: 'stats' },
        h('thead', null, h('tr', null, ['Fecha', 'Concepto', 'Efectivo', 'Banco', 'Saldo total'].map(t => h('th', null, t)))),
        h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 5, class: 'empty' }, 'No hay movimientos este mes.'))))),
      h('div', { class: 'row', style: { marginTop: '12px' } },
        h('button', { class: 'btn small', onclick: () => navigator.clipboard.writeText(summary).then(() => toast('Resumen copiado')) }, '📋 Copiar resumen'),
        h('button', { class: 'btn small', onclick: csv }, '⬇ Descargar en Excel'),
        h('button', { class: 'btn small', onclick: openInitialDialog }, `Saldo inicial (${fmtShort(ini.fecha)})`))));
}
