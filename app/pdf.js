// Programas · PDF del programa, imágenes y hojas de asignación.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- PDF ----------
// En el celular abre "Compartir" (WhatsApp, Drive, guardar…); en la PC lo descarga.
// En la app de Android no hay descargas: el archivo se guarda dentro de la app y se abre "Compartir".
const nativeShareFile = (blob, name) => nativeShareFiles([[blob, name]]);
async function nativeShareFiles(list) {
  const uris = [];
  for (const [blob, name] of list) {
    const data = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
    uris.push((await NP.files.writeFile({ path: name, data, directory: 'CACHE' })).uri);
  }
  await NP.share.share({ title: list[0][1], files: uris }).catch(() => {});
}
if (NATIVE) {
  // Los CSV y el respaldo se "descargan" con un enlace temporal (a.click()); aquí se comparten.
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download || !this.href.startsWith('blob:')) return click.call(this);
    const name = this.download;
    fetch(this.href).then(r => r.blob()).then(b => nativeShareFile(b, name)).catch(() => toast('No se pudo guardar el archivo'));
  };
  navigator.share = d => NP.share.share({ title: d.title, text: d.text, url: d.url });
}
// Cualquier PDF de la app también se baja como imagen: cada hoja del mismo PDF se dibuja con
// pdf.js (vendor/pdfjs). El formato se elige al descargar o queda fijo en Ajustes (en cada equipo).
const DL_FORMATS = [['ask', 'Preguntar cada vez'], ['pdf', 'PDF'], ['png', 'Imagen PNG'], ['jpg', 'Imagen JPG']];
const dlFormat = () => { try { return localStorage.getItem('formato-descarga') || 'ask'; } catch (e) { return 'ask'; } };
const setDlFormat = v => { try { localStorage.setItem('formato-descarga', v); } catch (e) {} };
const cleanName = s => s.replace(/[\\/:*?"<>|]+/g, '');
function savePDF(doc, fname) {
  const fmt = dlFormat();
  if (fmt === 'ask') return askFormat(f => saveAs(doc, fname, f));
  return saveAs(doc, fname, fmt);
}
function saveAs(doc, fname, fmt) {
  return fmt === 'png' || fmt === 'jpg' ? saveImages(doc, fname, fmt) : savePdfFile(doc, fname);
}
// Guarda un archivo: en el APK y en celulares se comparte; en la PC se descarga.
// El enlace temporal vive un minuto (antes 1 s: en algunos navegadores la descarga se cortaba).
async function saveBlob(blob, name) {
  if (NATIVE) return nativeShareFile(blob, name).catch(() => toast('No se pudo guardar el archivo'));
  const file = typeof File === 'function' ? new File([blob], name, { type: blob.type }) : null;
  if (file && navigator.canShare && matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: [file] })) {
    try { return await navigator.share({ files: [file], title: name }); } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function savePdfFile(doc, fname) {
  const name = cleanName(fname) + '.pdf';
  if (NATIVE) return nativeShareFile(doc.output('blob'), name).catch(() => toast('No se pudo guardar el PDF'));
  const file = typeof File === 'function' ? new File([doc.output('blob')], name, { type: 'application/pdf' }) : null;
  if (file && navigator.canShare && matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: [file] })) {
    return navigator.share({ files: [file], title: name }).catch(e => { if (e.name !== 'AbortError') doc.save(name); });
  }
  doc.save(name);
}
function askFormat(done) {
  const remember = h('input', { type: 'checkbox' });
  const choose = f => { if (remember.checked) setDlFormat(f); dlg.close(); done(f); };
  const opt = (f, title, sub) => h('button', { class: 'fmt-opt', onclick: () => choose(f) },
    h('strong', null, title), h('span', { class: 'small-text muted' }, sub));
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' },
      h('h3', null, '¿Cómo lo quieres descargar?'),
      h('div', { class: 'fmt-opts' },
        opt('pdf', 'PDF', 'Para imprimir'),
        opt('png', 'Imagen PNG', 'Se ve nítida; para mandarla por WhatsApp'),
        opt('jpg', 'Imagen JPG', 'Más ligera; la abre cualquier celular')),
      h('label', { class: 'row small-text muted', style: { gap: '6px', marginTop: '12px' } }, remember, 'Recordar mi elección (se cambia en Ajustes)')),
    h('div', { class: 'dlg-foot' }, h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancelar')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}
let pdfjsLib = null;
async function loadPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import(new URL('vendor/pdfjs/pdf.min.js', location.href).href);
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.js', location.href).href;
  }
  return pdfjsLib;
}
// Cada hoja como imagen, a 2.5× (nítida al imprimir o al hacer zoom en el celular)
async function pdfToImages(doc, fmt) {
  const lib = await loadPdfjs();
  const pdf = await lib.getDocument({ data: doc.output('arraybuffer'), standardFontDataUrl: new URL('vendor/pdfjs/standard_fonts/', location.href).href }).promise;
  const out = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i), vp = page.getViewport({ scale: 2.5 });
      const cv = h('canvas', { width: Math.ceil(vp.width), height: Math.ceil(vp.height) }), ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      out.push(await new Promise(ok => cv.toBlob(ok, fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.92)));
    }
  } finally { pdf.destroy(); }
  return out;
}
async function saveImages(doc, fname, fmt) {
  toast('Preparando la imagen…');
  let blobs;
  try { blobs = await pdfToImages(doc, fmt); } catch (e) { console.error(e); return toast('No se pudo hacer la imagen. Prueba con PDF.'); }
  const base = cleanName(fname), ext = fmt === 'jpg' ? '.jpg' : '.png';
  const names = blobs.map((b, i) => base + (blobs.length > 1 ? ` (${i + 1} de ${blobs.length})` : '') + ext);
  if (NATIVE) return nativeShareFiles(blobs.map((b, i) => [b, names[i]])).catch(() => toast('No se pudo guardar la imagen'));
  const files = typeof File === 'function' ? blobs.map((b, i) => new File([b], names[i], { type: b.type })) : null;
  if (files && navigator.canShare && matchMedia('(pointer: coarse)').matches && navigator.canShare({ files })) {
    try { return await navigator.share({ files, title: base }); } catch (e) { if (e.name === 'AbortError') return; }
  }
  // En la PC: una descarga por hoja
  for (const [i, b] of blobs.entries()) {
    const a = h('a', { href: URL.createObjectURL(b), download: names[i] });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    if (i < blobs.length - 1) await new Promise(ok => setTimeout(ok, 400));
  }
}
// Diseños del programa (Ajustes → Programa y PDF). El de fábrica es el S-140.
const PDF_DESIGNS = [
  ['s140', 'S-140'],
  ['clasico', 'Clásico'],
  ['compacto', 'Compacto en blanco y negro'],
  ['elegante', 'Elegante'],
];
const DATE_HEADERS = [['semana', 'La semana'], ['reunion', 'El día de la reunión'], ['ambas', 'Las dos']];
// Encabezado de cada semana según Ajustes
function weekHeading(p, upper) {
  const s = state.settings, wk = upper ? (p.title || '').toUpperCase() : p.title || '';
  const day = fmtMeeting(p), read = p.reading ? (upper ? p.reading.toUpperCase() : p.reading) : '';
  const main = s.pdfDate === 'reunion' ? day : s.pdfDate === 'ambas' ? `${wk} · ${day}` : wk;
  return main + (read ? '  |  ' + read : '');
}
const minText = r => state.settings.pdfShowMin !== false && (r.kind === 'part' || r.kind === 'chair') && r.min ? ` (${r.min} ${+r.min === 1 ? 'min.' : 'mins.'})` : '';

function downloadPDF(programs) {
  programs = [...programs].sort((a, b) => a.date.localeCompare(b.date));
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) return toast('Se necesita internet para crear el PDF.');
  if (!programs.length) return toast('No hay semanas para el PDF.');
  const s = state.settings, design = s.pdfDesign || 's140';
  const doc = new J({ unit: 'pt', format: s.paper === 'a4' ? 'a4' : 'letter' });
  if (design === 'clasico') pdfClassic(doc, programs); else pdfFlow(doc, programs, design);
  const fname = programs.length === 1 ? `Programa ${programs[0].title}` : `Programas ${programs[0].title} a ${programs[programs.length - 1].title}`;
  savePDF(doc, fname);
}

// S-140, compacto y elegante: varias semanas seguidas por hoja, con columnas de nombres a la derecha
// (y la de la sala auxiliar, si se usa).
function pdfFlow(doc, programs, design) {
  const s = state.settings, W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const ST = {
    s140: { font: 'helvetica', head: 'times', size: 9.5, lh: 1.2, color: true, bar: 'fill', gapWeek: 16, songName: false },
    compacto: { font: 'helvetica', head: 'helvetica', size: 9, lh: 1.18, color: false, bar: 'text', gapWeek: 14, songName: false },
    elegante: { font: 'times', head: 'times', size: 10.5, lh: 1.22, color: true, bar: 'line', gapWeek: 22, songName: true },
  }[design];
  const M = 40, L = ST.size * ST.lh, name = id => (profById(id) || {}).name || '';
  let aux = false, xAux = 0; // cambian en cada semana (sala auxiliar sí o no)
  const xTime = M, xDot = M + 38, xTitle = M + 46;
  const xMain = W - M - 140, colW = W - M - xMain;
  const gray = ST.color ? [90, 90, 90] : [70, 70, 70];
  // En el S-140 la barra de Tesoros va en gris, como en el formulario
  const secRgb = sec => !ST.color ? [40, 40, 40] : design === 's140' && sec === SECTIONS[0].name ? [87, 90, 93] : (sectionOf(sec) || { rgb: [87, 90, 93] }).rgb;
  const font = (bold, size, f = ST.font) => { doc.setFont(f, bold ? 'bold' : 'normal'); doc.setFontSize(size); };
  let y = 0;

  function pageHeader() {
    font(true, 11); doc.setTextColor(0);
    if (design === 'elegante') {
      font(true, 18, ST.head); doc.text(s.pdfTitle || 'Programa', W / 2, 46, { align: 'center' });
      font(false, 11, ST.head); doc.setTextColor(80); if (s.congregation) doc.text(s.congregation.toUpperCase(), W / 2, 62, { align: 'center' });
      doc.setDrawColor(120); doc.setLineWidth(0.6); doc.line(M, 70, W - M, 70); doc.line(M, 72.5, W - M, 72.5);
      y = 96; return;
    }
    if (s.congregation) doc.text(s.congregation.toUpperCase(), M, 48);
    font(true, design === 's140' ? 18 : 14, ST.head); doc.text(s.pdfTitle || 'Programa', W - M, 48, { align: 'right' });
    doc.setDrawColor(110); doc.setLineWidth(design === 's140' ? 3 : 1.2); doc.line(M, 56, W - M, 56);
    y = 80;
  }
  // Una línea de la semana: [hora, punto de color, título, etiqueta, auxiliar, principal]
  function rowItems(p) {
    const times = timesFor(p), out = [];
    let sec = '';
    for (const r of p.rows) {
      if (r.section && r.section !== sec) { sec = r.section; out.push({ section: sec, student: p.rows.some(x => x.section === sec && hasCounsel(x)) }); }
      const title = r.kind === 'prayer' || r.kind === 'song' ? (ST.songName ? songText(r) : `Canción ${r.song || ''}`) : displayTitle(r) + minText(r);
      const lb = slotLabels(r), pair = (a, b) => [name(a), name(b)].filter(Boolean).join(' / ');
      let label = '', main = '', side = '';
      if (r.kind === 'prayer') { label = 'Oración:'; main = name(r.a); }
      else if (r.kind === 'part' && isAssignable(r)) {
        if (r.helper) { label = r.helper === 'Lector' ? 'Conductor/Lector:' : 'Estudiante/Ayudante:'; main = pair(r.a, r.b); if (aux && hasAux(r)) side = pair(r.xa, r.xb); }
        else { label = hasCounsel(r) ? 'Estudiante:' : ''; main = name(r.a); if (aux && hasAux(r)) side = name(r.xa); }
      }
      out.push({ time: fmtTime(times[r.id]), sec: r.section, title, label, main, side, student: aux && hasAux(r) && r.kind === 'part' });
    }
    return out;
  }
  // Dibuja (o solo mide, si dry) una semana desde y; devuelve la altura
  function week(p, y0, dry) {
    aux = auxOn(p); xAux = aux ? xMain - 132 : xMain;
    let yy = y0;
    const intro = p.rows.find(r => r.kind === 'chair' && r.intro);
    const head = weekHeading(p, design !== 'elegante');
    font(true, ST.size + 0.5, design === 'elegante' ? 'times' : ST.font);
    const headLines = doc.splitTextToSize(head, xMain - 70 - M);
    if (!dry) {
      font(true, ST.size + 0.5, design === 'elegante' ? 'times' : ST.font); doc.setTextColor(design === 'elegante' ? 30 : 0);
      doc.text(headLines, M, yy);
      const tag = (label, value, yt) => { font(true, 7.5); doc.setTextColor(...gray); doc.text(label, xMain - 6, yt, { align: 'right' }); font(false, ST.size); doc.setTextColor(0); doc.text(value, xMain, yt); };
      tag('Presidente:', name(intro && intro.a), yy);
      if (aux) tag('Consejero de la sala auxiliar:', name(intro && intro.xa), yy + L);
    }
    yy += Math.max(headLines.length, aux ? 2 : 1) * L + 8;
    for (const it of rowItems(p)) {
      if (it.section) {
        yy += 6;
        if (!dry) {
          const c = secRgb(it.section);
          if (ST.bar === 'fill') {
            doc.setFillColor(...c); doc.rect(M, yy - 10, Math.min((W - 2 * M) * 0.52, (aux ? xAux : xMain) - 12 - M), 13, 'F');
            font(true, 8.5); doc.setTextColor(255); doc.text(it.section.toUpperCase(), M + 4, yy);
          } else if (ST.bar === 'line') {
            font(true, 9.5, 'times'); doc.setTextColor(...c); doc.text(it.section.toUpperCase(), M, yy);
            doc.setDrawColor(...c); doc.setLineWidth(0.6); doc.line(M, yy + 3, W - M, yy + 3);
          } else {
            font(true, 9); doc.setTextColor(0); doc.text(it.section.toUpperCase(), M, yy);
            doc.setDrawColor(60); doc.setLineWidth(0.8); doc.line(M, yy + 3, W - M, yy + 3);
          }
          if (aux && it.student) { font(true, 7); doc.setTextColor(...gray); doc.text('Sala auxiliar', xAux, yy); doc.text('Auditorio principal', xMain, yy); }
        }
        yy += ST.bar === 'fill' ? 14 : 13;
        continue;
      }
      const labX = (it.student ? xAux : xMain) - 6;
      font(true, 7.5);
      const titleW = (it.label ? labX - doc.getTextWidth(it.label) - 10 : (it.student ? xAux : xMain) - 8) - xTitle;
      font(false, ST.size);
      const tl = doc.splitTextToSize(it.title, Math.max(120, titleW));
      const ml = it.main ? doc.splitTextToSize(it.main, colW) : [], sl = it.side ? doc.splitTextToSize(it.side, xMain - xAux - 6) : [];
      const n = Math.max(tl.length, ml.length, sl.length, 1);
      if (!dry) {
        font(true, 8); doc.setTextColor(...gray); doc.text(it.time, xTime, yy);
        const c = secRgb(it.sec);
        doc.setFillColor(...c); doc.circle(xDot, yy - 3, 2.2, 'F');
        font(false, ST.size); doc.setTextColor(0); doc.text(tl, xTitle, yy, { lineHeightFactor: ST.lh });
        if (it.label) { font(true, 7.5); doc.setTextColor(...gray); doc.text(it.label, labX, yy, { align: 'right' }); }
        font(false, ST.size); doc.setTextColor(0);
        if (sl.length) doc.text(sl, xAux, yy, { lineHeightFactor: ST.lh });
        if (ml.length) doc.text(ml, xMain, yy, { lineHeightFactor: ST.lh });
      }
      yy += n * L + 1.5;
    }
    return yy - y0;
  }

  pageHeader();
  programs.forEach((p, i) => {
    const hgt = week(p, y, true);
    if (i && y + hgt > H - 50) { doc.addPage(); pageHeader(); }
    week(p, y, false);
    y += hgt + ST.gapWeek;
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); font(false, 7.5); doc.setTextColor(140);
    if (design === 's140') doc.text('S-140-S', M, H - 26);
    doc.text(`Impreso ${new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, W - M, H - 26, { align: 'right' });
  }
}

// Diseño clásico: una semana por hoja, con el título de cada sección en color
function pdfClassic(doc, programs) {
  const s = state.settings;
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 36, LINE = 13;
  const xTime = M, xDot = M + 36, xTitle = M + 46, xNames = W - M - 170, xLabelR = xNames - 8;
  const name = id => (profById(id) || {}).name || '';
  const printed = new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });

  programs.forEach((p, idx) => {
    if (idx) doc.addPage();
    const times = timesFor(p);
    // Encabezado
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(0);
    doc.text(s.pdfTitle || 'Programa', M, 46);
    if (s.congregation) doc.text(s.congregation, W - M, 46, { align: 'right' });
    doc.setDrawColor(0); doc.setLineWidth(1.4); doc.line(M, 54, W - M, 54);
    doc.setFontSize(13); doc.setTextColor(0, 112, 192);
    doc.text(weekHeading(p, false), M, 80);

    let y = 106, sec = '';
    for (const r of p.rows) {
      if (r.section && r.section !== sec) {
        sec = r.section;
        const c = (sectionOf(sec) || { rgb: [87, 90, 93] }).rgb;
        y += 10;
        doc.setFillColor(...c); doc.roundedRect(M, y - 11, 14, 14, 3, 3, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...c);
        doc.text(sec.toUpperCase(), M + 22, y);
        doc.setDrawColor(...c); doc.setLineWidth(0.9); doc.line(M, y + 6, W - M, y + 6);
        y += 24;
      }
      // Título (con minutos)
      const min = minText(r);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
      const labels = slotLabels(r);
      const titleLines = doc.splitTextToSize(displayTitle(r) + min, xLabelR - xTitle - (labels.a && !labels.soft ? 62 : 6));
      // Nombres
      const slots = [];
      if (isAssignable(r)) {
        if (labels.soft) {
          const pair = [name(r.a), name(r.b)].filter(Boolean).join(' & ');
          slots.push({ label: '', lines: doc.splitTextToSize(pair, W - M - xNames) });
        } else {
          slots.push({ label: labels.a, lines: doc.splitTextToSize(name(r.a), W - M - xNames) });
          if (r.helper) slots.push({ label: labels.b, lines: doc.splitTextToSize(name(r.b), W - M - xNames) });
        }
        if (auxOn(p) && hasAux(r)) slots.push({ label: r.kind === 'chair' ? 'Consejero aux.' : 'Sala aux.', lines: doc.splitTextToSize([name(r.xa), r.kind !== 'chair' && r.helper ? name(r.xb) : ''].filter(Boolean).join(' / '), W - M - xNames) });
      }
      const nameLines = slots.reduce((t, x) => t + Math.max(1, x.lines.length), 0);
      const lines = Math.max(titleLines.length, nameLines, 1);
      if (y + lines * LINE > H - 40) { doc.addPage(); y = 50; }

      const c = (sectionOf(r.section) || { rgb: [87, 90, 93] }).rgb;
      doc.setFontSize(10); doc.setTextColor(60); doc.text(fmtTime(times[r.id]), xTime, y);
      doc.setFillColor(...c); doc.circle(xDot, y - 3.5, 2.6, 'F');
      doc.setFontSize(10.5); doc.setTextColor(20);
      doc.text(titleLines, xTitle, y, { lineHeightFactor: LINE / 10.5 });
      let ny = y;
      for (const sl of slots) {
        if (sl.label) { doc.setFont('helvetica', 'bold'); doc.setTextColor(20); doc.text(sl.label, xLabelR, ny, { align: 'right' }); }
        doc.setFont('helvetica', 'normal'); doc.setTextColor(20);
        if (sl.lines.length) doc.text(sl.lines, xNames, ny, { lineHeightFactor: LINE / 10.5 });
        ny += Math.max(1, sl.lines.length) * LINE;
      }
      y += lines * LINE + 8;
      doc.setDrawColor(228); doc.setLineWidth(0.5); doc.line(xTitle, y - 12, W - M, y - 12);
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140);
    doc.text('Impreso ' + printed, W - M, H - 22, { align: 'right' });
  });
}

// Formatos de fecha (Ajustes): 'larga' martes, 28 de octubre de 2026 · 'media' 28 de octubre de 2026 · 'corta' 28/10/2026
const DATE_FORMATS = [['larga', 'Martes, 28 de octubre de 2026'], ['media', '28 de octubre de 2026'], ['corta', '28/10/2026']];
function fmtDate(iso, how) {
  const d = toDate(iso);
  if (how === 'corta') return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (how === 'media') return d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  return capFirst(d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
}
// La descripción de la guía: el texto (cita, tema) y la lección aparte: "Jer 50:24-10 (th lección 11)"
function splitDetail(detail) {
  const m = (detail || '').match(/\((th|lmd|lff|be)\s[^)]*\)\.?\s*$/i);
  return m ? { text: detail.slice(0, m.index).trim(), lesson: m[0].trim() } : { text: (detail || '').trim(), lesson: '' };
}

// ---------- Hojas de asignación (una por hoja) ----------
const isStudentPart = r => hasCounsel(r);

function downloadSlips(items) {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) return toast('Se necesita internet para crear el PDF.');
  if (!items.length) return toast('Elige al menos una asignación.');
  const s = state.settings;
  const doc = new J({ unit: 'pt', format: s.paper === 'a4' ? 'a4' : 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const name = id => (profById(id) || {}).name || '';

  // Medidas tomadas de la hoja de ejemplo (puntos, carta)
  const bold = size => { doc.setFont('helvetica', 'bold'); doc.setFontSize(size); };
  const regular = size => { doc.setFont('helvetica', 'normal'); doc.setFontSize(size); };
  items.forEach(({ p, row, aux }, idx) => {
    const sa = aux ? 'xa' : 'a', sb = aux ? 'xb' : 'b';
    if (idx) doc.addPage();
    doc.setTextColor(0);

    // Título
    bold(23);
    doc.text('ASIGNACIÓN PARA LA REUNIÓN', W / 2, 48, { align: 'center' });
    doc.text('VIDA Y MINISTERIO CRISTIANOS', W / 2, 74, { align: 'center' });

    // Datos: etiqueta en x 49, valor en x 209, renglones de 46 pt
    let y = 111;
    const field = (label, value) => {
      bold(21); doc.text(label, 49, y);
      regular(21);
      const lines = value ? doc.splitTextToSize(value, W - 52 - 209) : [];
      if (lines.length) doc.text(lines, 209, y, { lineHeightFactor: 1.15 });
      y += Math.max(0, lines.length - 1) * 24 + 46;
    };
    field('Nombre:', name(row[sa]));
    field(row.helper === 'Lector' ? 'Lector:' : 'Ayudante:', row.helper ? name(row[sb]) : '');
    field('Fecha:', fmtDate(meetingDate(p), s.slipDate || 'larga'));

    // "Intervención núm.:" va en dos renglones; el tipo de intervención pasa a la descripción
    const kind = (row.title || '').match(/^(.*\S)\s+\(([^)]+)\)$/);
    const title = (row.num ? row.num + '. ' : '') + (kind ? kind[1] : row.title);
    bold(21); doc.text('Intervención', 49, y); doc.text('núm.:', 49, y + 24);
    regular(21);
    const tLines = doc.splitTextToSize(title, W - 52 - 209);
    doc.text(tLines, 209, y, { lineHeightFactor: 1.15 });
    y += Math.max(24, (tLines.length - 1) * 24) + 41;

    // Descripción de la Guía de actividades
    // En Ajustes se elige qué poner: minutos, el texto (cita y tema) y la lección
    const { text: dText, lesson } = splitDetail(row.detail);
    const desc = [s.slipShowMin !== false && row.min ? `(${row.min} ${row.min === 1 ? 'min.' : 'mins.'})` : '', kind ? kind[2].toUpperCase() + '.' : '',
      s.slipShowText !== false ? dText : '', s.slipShowLesson !== false ? lesson : ''].filter(Boolean).join(' ');
    if (desc) {
      regular(19);
      const dLines = doc.splitTextToSize(desc, W - 52 - 82);
      doc.text(dLines, 82, y, { lineHeightFactor: 1.15 });
      y += (dLines.length - 1) * 22;
    }

    // Lugar (las posiciones del ejemplo, salvo que la descripción sea más larga)
    y = Math.max(389, y + 54);
    bold(21); doc.text('Se presentará en:', 52, y);
    y += 36;
    ['Auditorio principal', 'Sala auxiliar núm. 1', 'Sala auxiliar núm. 2'].forEach((place, i) => {
      doc.setDrawColor(0); doc.setLineWidth(1); doc.rect(53, y - 13, 14, 14);
      if (i === (aux ? 1 : 0)) { doc.setLineWidth(1.8); doc.lines([[3, 4], [7, -10]], 56, y - 5); }
      regular(19); doc.text(place, 94, y - 1);
      y += 23;
    });

    // Nota al estudiante (la etiqueta en negrita y el texto sigue en el mismo renglón)
    y = Math.max(552, y + 58);
    const right = W - 89;
    bold(19); doc.text('Nota al estudiante:', 52, y);
    let x = 52 + doc.getTextWidth('Nota al estudiante: ');
    regular(19);
    for (const word of (s.slipNote || '').split(/\s+/).filter(Boolean)) {
      const w = doc.getTextWidth(word);
      if (x + w > right && x > 52) { y += 21.5; x = 52; }
      doc.text(word, x, y);
      x += w + doc.getTextWidth(' ');
    }

    // Pie (opcional)
    if (s.slipFooter) { regular(15); doc.text(s.slipFooter, 52, y + 45); }
  });

  const first = items[0];
  const fname = items.length === 1
    ? `Asignación ${name(first.row[first.aux ? 'xa' : 'a']) || 'sin nombre'} - ${first.p.title}`
    : `Asignaciones ${[...new Set(items.map(x => x.p.title))].join(', ')}`;
  savePDF(doc, fname);
}

// Elegir qué hojas de asignación descargar
function openSlipsDialog(p) {
  // Una hoja por asignación; con sala auxiliar, también las de esa sala
  const items = p.rows.filter(r => r.kind === 'part').flatMap(row => [{ p, row, aux: false }, ...(auxOn(p) && hasAux(row) ? [{ p, row, aux: true }] : [])]);
  const rows = items.map(x => x.row);
  const who = x => x.row[x.aux ? 'xa' : 'a'], mate = x => x.row[x.aux ? 'xb' : 'b'];
  const checks = items.map(x => h('input', { type: 'checkbox', checked: isStudentPart(x.row) && !!who(x) }));
  const name = id => (profById(id) || {}).name;
  const list = h('div', { class: 'slips' }, items.map((x, i) => h('label', { class: 'slip' }, checks[i],
    h('span', null, h('span', null, displayTitle(x.row), x.aux ? h('em', { class: 'muted' }, ' · sala auxiliar') : null),
      h('small', null, who(x) ? [name(who(x)), x.row.helper && mate(x) ? ` & ${name(mate(x))}` : ''].join('') : 'Sin asignar')),
    h('button', { class: 'btn small', title: 'Descargar solo esta', onclick: e => { e.preventDefault(); downloadSlips([x]); } }, '⬇'))));
  const setAll = v => checks.forEach(c => { c.checked = v; });
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' },
      h('h3', null, 'Hojas de asignación'),
      h('p', { class: 'muted small-text', style: { margin: 0 } },
        `${p.title}. Se descarga un PDF con una asignación por hoja. Ya están marcadas las de estudiantes que tienen nombre.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => setAll(true) }, 'Marcar todas'),
        h('button', { class: 'btn small', onclick: () => { checks.forEach((c, i) => { c.checked = isStudentPart(rows[i]); }); } }, 'Solo estudiantes'),
        h('button', { class: 'btn small', onclick: () => setAll(false) }, 'Ninguna')),
      list),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cerrar'),
      h('button', { class: 'btn primary', onclick: () => {
        const chosen = items.filter((x, i) => checks[i].checked);
        if (chosen.length) { downloadSlips(chosen); dlg.close(); } else toast('Marca al menos una asignación.');
      } }, '⬇ Descargar PDF')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}
