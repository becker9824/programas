// Programas · Territorios: mapa, tarjetas, QR y salida con GPS.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- territorios (todos ven el mapa; la función "Territorios" los cambia) ----------
// Mapa con Leaflet y OpenStreetMap (vendor/leaflet). Cada territorio: territorios/{id} con
// numero, nombre (la colonia), tarjeta (número de tarjeta), notas, y su forma: coords (zona, JSON de
// [[lat, lng], …]) o calles (JSON de calles [[lat, lng], …], cuando el territorio son solo unas calles).
// Estado: estado ('asignado' o 'disponible'), asignadoA, capitan (uid de la cuenta del capitán, o ''),
// desde, historial [{ quien, desde, hasta, completo }] y veces (cuántas veces se completó).
// Marcas: trabajadas (JSON de calles ya predicadas en esta vuelta), avance (JSON { p, n, f }: hasta
// dónde se llegó) y noPredicar (JSON [{ p, n, k }]: casas marcadas; k 'no' = no predicar, 'nota' = nota).
// Vueltas: un territorio está "completado" si lleva más veces que el que menos lleva; cuando todos
// llevan las mismas, todos vuelven solos a disponible (empieza otra vuelta).
// Cada salida registrada va en trabajos/{id} (territorio, fecha, completo, calles, avance, notas, por).
// Versión web (Firebase Hosting desde la 1.32.0; antes https://becker9824.github.io/programas/, que ahora redirige aquí)
const WEB_URL = 'https://programas-congregacion.web.app/';
const TERR = {
  disponible: { label: 'Disponible', color: '#1b9e4b' },
  asignado: { label: 'Asignado', color: '#e08a00' },
  terminado: { label: 'Completado', color: '#2f6fd6' },
};
const byNumero = (a, b) => (a.numero || '').localeCompare(b.numero || '', 'es', { numeric: true });
let terr = null; // mapa abierto: { L, map, group, marks, tmp, selected, mode, refresh }
const parseJ = (s, d) => { try { const v = JSON.parse(s || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const vecesDe = t => t.veces ?? (t.estado === 'terminado' ? 1 : 0); // los de antes de la 1.17 no tienen "veces"
const vueltaBase = () => nube.territorios.length ? Math.min(...nube.territorios.map(vecesDe)) : 0;
const estadoDe = (t, base = vueltaBase()) => t.estado === 'asignado' ? 'asignado' : vecesDe(t) > base ? 'terminado' : 'disponible';
const streetsOf = t => parseJ(t.calles, []).filter(l => l.length > 1);  // forma del territorio con calles
const callesOf = t => parseJ(t.trabajadas, []);                         // calles ya trabajadas
const avanceOf = t => parseJ(t.avance, null);
const housesOf = t => parseJ(t.noPredicar, []).map(x => ({ k: 'no', ...x }));
const hasShape = t => coordsOf(t).length >= 3 || streetsOf(t).length > 0;
const isMyTerritory = t => !!(t.capitan && nube.user && t.capitan === nube.user.uid);
const dayCount = n => `${n} día${n === 1 ? '' : 's'}`;
const terrTitle = t => `Tarjeta ${t.numero}${t.territorio ? ' · Territorio ' + t.territorio : ''}${t.nombre ? ' · ' + t.nombre : ''}`;
const HOUSE = { no: { icon: '⛔', label: 'No predicar' }, nota: { icon: '📌', label: 'Nota' } };
// Lo que cuenta en la nube de un territorio, sin el id (para crearlo completo)
const terrData = t => ({ numero: t.numero, territorio: t.territorio || '', nombre: t.nombre || '', notas: t.notas || '', coords: t.coords || '[]', calles: t.calles || '',
  estado: t.estado === 'asignado' ? 'asignado' : 'disponible', asignadoA: t.asignadoA || '', capitan: t.capitan || '', desde: t.desde || null,
  historial: t.historial || [], veces: vecesDe(t), trabajadas: t.trabajadas || '', avance: t.avance || '', noPredicar: t.noPredicar || '' });
// Contorno de un territorio: el polígono convexo que rodea todas sus tarjetas, un poco más grande
function territoryHull(cards) {
  const pts = cards.flatMap(t => [...coordsOf(t), ...streetsOf(t).flat()]).map(([a, b]) => [b, a]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  if (pts.length < 3) return null;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => { const out = []; for (const p of list) { while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop(); out.push(p); } out.pop(); return out; };
  const hull = [...half(pts), ...half([...pts].reverse())];
  if (hull.length < 3) return null;
  const cx = hull.reduce((a, p) => a + p[0], 0) / hull.length, cy = hull.reduce((a, p) => a + p[1], 0) / hull.length;
  return hull.map(([x, y]) => [cy + (y - cy) * 1.06 + Math.sign(y - cy) * 0.00012, cx + (x - cx) * 1.06 + Math.sign(x - cx) * 0.00012]);
}
// Capa del mapa con la forma de la tarjeta: zona (polígono) o calles (líneas gruesas)
function terrShape(L, t, style) {
  const c = coordsOf(t);
  if (c.length >= 3) return L.polygon(c, style);
  return L.featureGroup(streetsOf(t).map(l => L.polyline(l, { ...style, color: style.fillColor || style.color, weight: (style.weight || 2) + 5, opacity: style.fillOpacity < 0.1 ? 0.3 : 0.9 })));
}

function loadScript(src, css) {
  return (loadScript[src] = loadScript[src] || new Promise((res, rej) => {
    if (css) document.head.append(h('link', { rel: 'stylesheet', href: css }));
    document.head.append(h('script', { src, onload: () => res(), onerror: () => { loadScript[src] = null; rej(new Error('No se pudo cargar ' + src)); } }));
  }));
}
const loadLeaflet = () => loadScript('vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css').then(() => window.L);
const loadQR = () => loadScript('vendor/qrcode.js').then(() => window.qrcode);

// Polilínea codificada (el formato de Google): las coordenadas caben en el enlace del QR
function encodePoly(points) {
  let out = '', pl = 0, pg = 0;
  const enc = v => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
  for (const [lat, lng] of points) { const a = Math.round(lat * 1e5), b = Math.round(lng * 1e5); out += enc(a - pl) + enc(b - pg); pl = a; pg = b; }
  return out;
}
function decodePoly(str) {
  const pts = []; let i = 0, lat = 0, lng = 0;
  const dec = () => { let r = 0, sh = 0, b; do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); return r & 1 ? ~(r >> 1) : r >> 1; };
  while (i < str.length) { lat += dec(); lng += dec(); pts.push([lat / 1e5, lng / 1e5]); }
  return pts;
}
const coordsOf = t => { try { return JSON.parse(t.coords || '[]'); } catch (e) { return []; } };
// Enlace del QR: zona (p) o calles (l, separadas por ~) y casas de no predicar (x)
const shareUrl = t => { const no = housesOf(t).filter(x => x.k === 'no').map(x => x.p);
  return `${WEB_URL}#ver&n=${encodeURIComponent(t.numero)}&t=${encodeURIComponent(t.nombre || '')}&p=${encodeURIComponent(encodePoly(coordsOf(t)))}`
    + (streetsOf(t).length ? `&l=${encodeURIComponent(streetsOf(t).map(encodePoly).join('~'))}` : '') + (no.length ? `&x=${encodeURIComponent(encodePoly(no))}` : ''); };

// Estilos del mapa (gratis y sin claves). Se recuerda el último que eligió cada quien.
// Las imágenes del mapa se buscan primero en la memoria del equipo (TILE_CACHE): así funciona el
// mapa de un territorio guardado "para usar sin internet".
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const MAP_STYLES = {
  'Claro': { url: ESRI + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}', attr: '© Esri · OpenStreetMap' },
  'Calles': { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' },
  'Gris': { url: ESRI + 'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', max: 16, attr: '© Esri',
    labels: [ESRI + 'Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'] },
  'Oscuro': { url: ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', max: 16, attr: '© Esri',
    labels: [ESRI + 'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'] },
  // Satélite con los nombres de calles y lugares encima
  'Satélite': { url: ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Imágenes © Esri',
    labels: [ESRI + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'] },
};
const TILE_CACHE = 'mapas-v1';
const tileUrl = (url, sub, c) => L.Util.template(url, { s: sub ? sub[Math.abs(c.x + c.y) % sub.length] : '', x: c.x, y: c.y, z: c.z });
async function cachedTile(src) {
  try { if (!window.caches) return null; const r = await (await caches.open(TILE_CACHE)).match(src); return r ? r.blob() : null; } catch (e) { return null; }
}
function tileLayer(L, url, sub, opts) {
  const Layer = L.TileLayer.extend({
    createTile(coords, done) {
      const img = document.createElement('img'), src = tileUrl(url, sub, coords);
      img.alt = ''; img.setAttribute('role', 'presentation');
      img.onload = () => done(null, img); img.onerror = e => done(e, img);
      cachedTile(src).then(blob => {
        if (!blob) return img.src = src;
        const u = URL.createObjectURL(blob);
        img.addEventListener('load', () => URL.revokeObjectURL(u), { once: true });
        img.src = u;
      });
      return img;
    },
  });
  return new Layer(url, { maxZoom: 19, ...opts });
}
// Las capas de un estilo: la base y, en satélite, los nombres de calles encima
const styleLayers = (L, name) => {
  const s = MAP_STYLES[name];
  const o = s.max ? { maxNativeZoom: s.max } : {};
  return [tileLayer(L, s.url, s.sub, { attribution: s.attr, ...o }), ...(s.labels || []).map(u => tileLayer(L, u, null, o))];
};
function baseMap(L, el) {
  const map = L.map(el);
  let saved = 'Claro';
  try { saved = localStorage.getItem('mapa-estilo') || saved; } catch (e) {}
  if (!MAP_STYLES[saved]) saved = 'Claro';
  const groups = Object.fromEntries(Object.keys(MAP_STYLES).map(name => [name, L.layerGroup(styleLayers(L, name))]));
  groups[saved].addTo(map);
  map._estilo = saved;
  L.control.layers(groups).addTo(map);
  map.on('baselayerchange', e => { map._estilo = e.name; try { localStorage.setItem('mapa-estilo', e.name); } catch (x) {} });
  return map;
}
// Guarda en el equipo las imágenes del mapa de una zona (zoom 15 a 18) con el estilo que se está
// viendo, para que se vea aunque no haya señal en la calle. Una zona de territorio son unas decenas.
async function saveMapOffline(L, map, bounds) {
  if (!window.caches) return toast('Este equipo no permite guardar mapas.');
  const s = MAP_STYLES[map._estilo] || MAP_STYLES.Claro;
  const urls = [];
  const b = bounds.pad(0.25);
  for (let z = 15; z <= Math.min(18, s.max || 18); z++) {
    const a = map.project(b.getNorthWest(), z).divideBy(256).floor(), c = map.project(b.getSouthEast(), z).divideBy(256).floor();
    for (let x = a.x; x <= c.x; x++) for (let y = a.y; y <= c.y; y++) {
      const co = { x, y, z };
      urls.push(tileUrl(s.url, s.sub, co));
      (s.labels || []).forEach(u => urls.push(tileUrl(u, null, co)));
    }
  }
  if (urls.length > 600) return toast('La zona es muy grande para guardarla.');
  const cache = await caches.open(TILE_CACHE);
  let ok = 0;
  toast(`Guardando el mapa (${urls.length} partes)…`);
  for (let i = 0; i < urls.length; i += 6) {
    await Promise.all(urls.slice(i, i + 6).map(async u => {
      try { if (await cache.match(u)) return ok++; const r = await fetch(u); if (r.ok) { await cache.put(u, r); ok++; } } catch (e) {}
    }));
  }
  toast(ok === urls.length ? 'Listo: este mapa ya se ve sin internet.' : `Se guardó ${ok} de ${urls.length}. Inténtalo de nuevo con mejor señal.`);
}
// "Dónde estoy": un punto azul en la ubicación del celular
function locateButton(L, map) {
  let dot = null;
  return h('button', { class: 'btn small', onclick: () => {
    if (!navigator.geolocation) return toast('Este equipo no puede dar su ubicación');
    navigator.geolocation.getCurrentPosition(pos => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (dot) dot.remove();
      dot = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 2, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map);
      map.setView(ll, Math.max(map.getZoom(), 17));
    }, () => toast('No se pudo obtener tu ubicación. Revisa que la app tenga permiso.'), { enableHighAccuracy: true, timeout: 15000 });
  } }, '📍 Dónde estoy');
}

function openQRDialog(t) {
  const url = shareUrl(t), box = h('div', { style: { display: 'grid', placeItems: 'center' } }, 'Cargando…');
  loadQR().then(qrcode => { const q = qrcode(0, 'M'); q.addData(url); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); box.firstChild.style.width = '240px'; box.firstChild.style.background = '#fff'; })
    .catch(() => { box.textContent = 'No se pudo crear el QR.'; });
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, terrTitle(t)), box,
      h('p', { class: 'muted small-text' }, 'Al escanearlo se abre la zona en el mapa, sin iniciar sesión. Si cambias el dibujo de la zona, vuelve a imprimir el QR.')),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: () => navigator.clipboard.writeText(url).then(() => toast('Enlace copiado')) }, 'Copiar enlace'),
      navigator.share ? h('button', { class: 'btn', onclick: () => navigator.share({ title: `Tarjeta ${t.numero}`, url }).catch(() => {}) }, 'Compartir') : null,
      h('button', { class: 'btn primary', onclick: close }, 'Cerrar')));
  document.body.append(dlg); dlg.showModal();
}

// Imagen del mapa de un territorio para la tarjeta impresa: imágenes del mapa claro con la zona o
// sus calles y las casas de no predicar encima. Devuelve un JPEG (data URL) o null si no se pudo.
async function territoryMapImage(t, W, H) {
  const pts = [...coordsOf(t), ...streetsOf(t).flat(), ...housesOf(t).map(x => x.p)];
  if (!pts.length) return null;
  const merc = ([lat, lng], z) => {
    const s = 256 * 2 ** z, sin = Math.sin(lat * Math.PI / 180);
    return [(lng + 180) / 360 * s, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s];
  };
  // El acercamiento más grande en el que cabe todo, con orilla
  let z = 18, box;
  for (; z >= 10; z--) {
    const xy = pts.map(p => merc(p, z)), xs = xy.map(p => p[0]), ys = xy.map(p => p[1]);
    box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    if (box[2] - box[0] <= W * 0.8 && box[3] - box[1] <= H * 0.8) break;
  }
  const ox = (box[0] + box[2]) / 2 - W / 2, oy = (box[1] + box[3]) / 2 - H / 2;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, W, H);
  const style = MAP_STYLES.Claro, jobs = [];
  for (let tx = Math.floor(ox / 256); tx <= Math.floor((ox + W) / 256); tx++) for (let ty = Math.floor(oy / 256); ty <= Math.floor((oy + H) / 256); ty++) {
    const src = tileUrl(style.url, style.sub, { x: tx, y: ty, z });
    jobs.push((async () => {
      const blob = await cachedTile(src);
      const img = new Image(); img.crossOrigin = 'anonymous';
      await new Promise(ok => { img.onload = img.onerror = ok; img.src = blob ? URL.createObjectURL(blob) : src; setTimeout(ok, 8000); });
      if (img.naturalWidth) g.drawImage(img, tx * 256 - ox, ty * 256 - oy, 256, 256);
    })());
  }
  await Promise.all(jobs);
  const at = p => { const [x, y] = merc(p, z); return [x - ox, y - oy]; };
  const c = coordsOf(t);
  g.lineJoin = g.lineCap = 'round';
  if (c.length >= 3) {
    g.beginPath(); c.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](...at(p))); g.closePath();
    g.fillStyle = 'rgba(224,138,0,.22)'; g.fill(); g.strokeStyle = '#c56f00'; g.lineWidth = 5; g.stroke();
  }
  g.strokeStyle = 'rgba(224,138,0,.9)'; g.lineWidth = 12;
  for (const l of streetsOf(t)) { g.beginPath(); l.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](...at(p))); g.stroke(); }
  for (const x of housesOf(t).filter(x => x.k === 'no')) {
    const [px, py] = at(x.p);
    g.fillStyle = '#d32f2f'; g.beginPath(); g.arc(px, py, 13, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillRect(px - 8, py - 2.5, 16, 5);
  }
  g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(W - 230, H - 26, 230, 26);
  g.fillStyle = '#555'; g.font = '16px sans-serif'; g.fillText('© Esri · OpenStreetMap', W - 200, H - 8);
  try { return cv.toDataURL('image/jpeg', 0.85); } catch (e) { return null; }
}

// Tarjetas para imprimir: 2 por hoja, con el mapa del territorio, número, colonia, tarjeta, QR,
// casas de no predicar y notas.
async function territoryCardsPDF(list) {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) return toast('No se pudo crear el PDF.');
  let qrcode;
  try { await loadLeaflet(); qrcode = await loadQR(); } catch (e) { return toast('No se pudo crear el QR.'); }
  toast(list.length > 1 ? `Preparando ${list.length} tarjetas con su mapa…` : 'Preparando la tarjeta…');
  const doc = new J({ unit: 'mm', format: state.settings.paper === 'a4' ? 'a4' : 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 10;
  const cw = W - M * 2, ch = (H - M * 3) / 2, qs = 38, mapW = cw - qs - 18, mapH = ch - 34;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (i && i % 2 === 0) doc.addPage();
    const x = M, y = M + (i % 2) * (ch + M);
    doc.setDrawColor(150); doc.setLineWidth(0.3); doc.roundedRect(x, y, cw, ch, 3, 3);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(0); doc.text(`Tarjeta ${t.numero}`, x + 6, y + 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(60);
    doc.text([t.territorio ? `Territorio ${t.territorio}` : '', t.nombre].filter(Boolean).join('   ·   '), x + 6, y + 18);
    // Mapa
    const img = await territoryMapImage(t, Math.round(mapW * 8), Math.round(mapH * 8));
    if (img) doc.addImage(img, 'JPEG', x + 6, y + 23, mapW, mapH);
    else { doc.setDrawColor(200); doc.rect(x + 6, y + 23, mapW, mapH); doc.setFontSize(9); doc.text('Mapa no disponible (sin internet)', x + 10, y + 30); }
    doc.setDrawColor(120); doc.rect(x + 6, y + 23, mapW, mapH);
    // QR y datos a la derecha
    const qx = x + cw - qs - 6, qy = y + 23;
    const q = qrcode(0, 'M'); q.addData(shareUrl(t)); q.make();
    const n = q.getModuleCount(), cell = qs / n;
    doc.setFillColor(0);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) doc.rect(qx + c * cell, qy + r * cell, cell + 0.02, cell + 0.02, 'F');
    doc.setFontSize(8); doc.setTextColor(90); doc.text(doc.splitTextToSize('Escanéalo para ver la zona en el celular', qs), qx + qs / 2, qy + qs + 4, { align: 'center' });
    let ty = qy + qs + 13;
    const no = housesOf(t).filter(h => h.k === 'no');
    if (no.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(180, 30, 30); doc.text('No predicar:', qx, ty); ty += 4;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
      for (const h of no.slice(0, 6)) { const lines = doc.splitTextToSize('• ' + (h.n || 'Casa marcada en el mapa'), qs + 4).slice(0, 2); doc.text(lines, qx, ty); ty += lines.length * 3.6; }
    }
    if (t.notas) { doc.setFontSize(9); doc.setTextColor(60); doc.text(doc.splitTextToSize(t.notas, cw - 12).slice(0, 2), x + 6, y + ch - 6); }
  }
  savePDF(doc, list.length === 1 ? `Tarjeta ${list[0].numero}` : `Tarjetas de territorio`);
}

// Datos de un territorio. shape: { coords } o { calles } recién dibujados (territorio nuevo o redibujado)
function openTerritoryDataDialog(t, shape) {
  const num = h('input', { type: 'text', maxlength: 20, value: t ? t.numero : '', placeholder: 'Ej.: 12', style: { width: '110px' } });
  const zone = h('input', { type: 'text', maxlength: 20, value: t ? t.territorio || '' : '', placeholder: 'Ej.: 3', style: { width: '110px' } });
  const name = h('input', { type: 'text', maxlength: 100, value: t ? t.nombre : '', placeholder: 'Ej.: Colonia Centro' });
  const notes = h('textarea', { rows: 3, maxlength: 1000, placeholder: 'Opcional: calles que abarca, indicaciones…' }, t ? t.notas : '');
  const err = h('div', { class: 'err' });
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, t ? `Tarjeta ${t.numero}` : 'Nueva tarjeta'),
      h('div', { class: 'row', style: { gap: '16px', alignItems: 'flex-end' } },
        h('label', { class: 'field' }, 'Número de tarjeta', num),
        h('label', { class: 'field' }, 'Territorio', zone)),
      h('span', { class: 'small-text' }, 'El número de tarjeta no se repite. Un territorio puede tener varias tarjetas: en el mapa se marca su contorno.'),
      h('label', { class: 'field' }, 'Colonia', name),
      h('label', { class: 'field' }, 'Notas', notes), err),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async e => {
        const numero = squash(num.value);
        if (!numero) return err.textContent = 'Escribe el número de la tarjeta.';
        if (nube.territorios.some(x => x.numero === numero && (!t || x.id !== t.id))) return err.textContent = 'Ya hay una tarjeta con ese número.';
        const data = { numero, territorio: squash(zone.value), nombre: squash(name.value), notas: notes.value.trim() };
        e.target.disabled = true;
        try {
          if (t) await F.updateDoc(congRef('territorios', t.id), data);
          else {
            // Entra a la vuelta actual como pendiente (con las mismas veces que el que menos lleva)
            const r = await F.addDoc(F.collection(F.db, 'congregaciones', nube.cong, 'territorios'),
              terrData({ ...data, coords: JSON.stringify(shape.coords || []), calles: shape.calles ? JSON.stringify(shape.calles) : '', desde: todayISO(), veces: vueltaBase() }));
            if (terr) terr.selected = r.id;
          }
          toast('Territorio guardado'); close();
        } catch (ex) { err.textContent = errMsg(ex); e.target.disabled = false; }
      } }, 'Guardar')));
  document.body.append(dlg); dlg.showModal(); (t ? name : num).focus();
}

// Capitanes para asignar: hermanos marcados como capitán (con su cuenta, si tiene) y cuentas con la
// función Capitán. Quien tiene los datos los usa directo; los demás, las listas publicadas.
function captainOptions() {
  const accounts = isAdmin() ? nube.miembros.filter(m => m.estado === 'activo' && (m.permisos || []).includes('capitan')).map(m => ({ uid: m.id, perfil: m.perfil || '', nombre: m.nombre })) : nube.capitanes;
  const people = isElder() ? state.profiles.filter(p => p.capitan).map(p => ({ perfil: p.id, nombre: p.name })) : nube.capitanesHermanos;
  const out = people.map(p => { const a = accounts.find(x => x.perfil && x.perfil === p.perfil); return { uid: a ? a.uid : '', nombre: p.nombre }; });
  for (const a of accounts) if (!out.some(o => o.uid === a.uid)) out.push({ uid: a.uid, nombre: (a.perfil && profById(a.perfil) || {}).name || a.nombre });
  return out.sort(byNombre);
}
// Color de cada tarjeta en el mapa: siempre el mismo para la misma tarjeta. El ángulo áureo hace que
// números seguidos queden con colores muy distintos.
function terrColor(t) {
  const n = parseInt(t.numero, 10);
  const k = Number.isFinite(n) ? n : [...String(t.numero || t.id)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return `hsl(${Math.round(k * 137.508) % 360}, 72%, 46%)`;
}
const terrByCard = () => { try { return localStorage.getItem('terr-colores') !== 'estado'; } catch (e) { return true; } };
// Asignar a un capitán o a cualquier nombre o grupo. Si ya está asignada, cambia de capitán: el que
// sale queda en el historial y se conserva lo trabajado (por ejemplo, otro la retoma por la tarde).
function openAssignDialog(t) {
  const change = t.estado === 'asignado';
  const caps = captainOptions();
  const capSel = h('select', { onchange: () => { who.style.display = capSel.value ? 'none' : ''; } },
    caps.map((c, i) => h('option', { value: 'c' + i }, c.nombre + (c.uid ? '' : ' (sin cuenta en la app)'))), h('option', { value: '' }, 'Otro (escribir el nombre o el grupo)'));
  const who = h('input', { type: 'text', maxlength: 100, list: 'profiles-list', placeholder: 'Ej.: Grupo 3 o el nombre del hermano' });
  const since = h('input', { type: 'date', value: todayISO() });
  who.style.display = caps.length ? 'none' : '';
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, change ? `Cambiar capitán de la tarjeta ${t.numero}` : `Asignar la tarjeta ${t.numero}`),
      change ? h('p', { class: 'muted small-text', style: { margin: 0 } }, `Ahora la tiene ${t.asignadoA}. Se conserva lo trabajado y hasta dónde se llegó.`) : null,
      h('label', { class: 'field' }, change ? '¿Quién sigue?' : '¿A quién?', capSel, who),
      caps.length ? h('span', { class: 'small-text' }, 'Si el capitán tiene cuenta, la verá en su app, en “Mis tarjetas”, y podrá registrar lo que se trabaje.')
        : h('span', { class: 'small-text' }, 'Todavía no hay capitanes. Se marcan en Hermanos: abre al hermano y marca “Capitán de territorios”.'),
      h('label', { class: 'field' }, 'Desde', since)),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async () => {
        const cap = capSel.value ? caps[+capSel.value.slice(1)] : null;
        const name = cap ? cap.nombre : squash(who.value);
        if (!name) return who.focus();
        const patch = { estado: 'asignado', asignadoA: name, capitan: cap ? cap.uid : '', desde: since.value || todayISO() };
        if (change) patch.historial = [...(t.historial || []), { quien: t.asignadoA, desde: t.desde || '', hasta: todayISO(), completo: false }].slice(-50);
        await updateTerritory(t, patch, change ? `Tarjeta ${t.numero}: pasó de ${t.asignadoA} a ${name}` : `Tarjeta ${t.numero} asignada a ${name}`);
        close();
      } }, change ? 'Cambiar' : 'Asignar')));
  refreshDatalist();
  document.body.append(dlg); dlg.showModal();
}

async function updateTerritory(t, patch, msg) {
  try { await F.updateDoc(congRef('territorios', t.id), patch); if (msg) { toast(msg); logChange(msg); } return true; }
  catch (e) { toast(errMsg(e)); return false; }
}
// Quitar la asignación sin completarlo: queda en el historial; se guarda hasta dónde se llegó
function unassignTerritory(t) {
  if (!confirm(`¿Quitarle la tarjeta ${t.numero} a ${t.asignadoA}? Se guarda lo trabajado y hasta dónde se llegó.`)) return;
  const historial = [...(t.historial || []), { quien: t.asignadoA, desde: t.desde || '', hasta: todayISO(), completo: false }].slice(-50);
  updateTerritory(t, { estado: 'disponible', asignadoA: '', capitan: '', desde: todayISO(), historial }, `Tarjeta ${t.numero}: ya no está asignada`);
}

// Diálogo pequeño con una nota (casa marcada o hasta dónde se llegó)
function openNoteDialog(title, fields, onSave) {
  const notes = h('textarea', { rows: 3, maxlength: 200, placeholder: fields.placeholder });
  const err = h('div', { class: 'err' });
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, title), fields.extra || null, h('label', { class: 'field' }, 'Nota', notes), err),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async e => {
        e.target.disabled = true;
        if (await onSave(notes.value.trim())) close(); else e.target.disabled = false;
      } }, 'Guardar')));
  document.body.append(dlg); dlg.showModal(); notes.focus();
}

// Registrar una salida: fecha, si se completó o quedó una parte, y una nota. Guarda también las
// calles trabajadas y hasta dónde se llegó (lo marcado en el mapa). Al completarlo, cuenta una vez
// más en la vuelta, se libera y se borran sus marcas de avance (las casas marcadas se quedan).
function openWorkDialog(t, resumen) {
  const fecha = h('input', { type: 'date', value: todayISO(), max: todayISO() });
  const full = h('input', { type: 'radio', name: 'completo' }), part = h('input', { type: 'radio', name: 'completo' });
  const notes = h('textarea', { rows: 3, maxlength: 1000, placeholder: 'Ej.: Faltó la calle 5; no había nadie en la manzana 3.' });
  const err = h('div', { class: 'err' });
  const lines = callesOf(t), av = avanceOf(t);
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h('dialog', { class: 'dlg' },
    h('div', { class: 'dlg-body' }, h('h3', null, `Registrar salida · ${terrTitle(t)}`),
      resumen ? h('p', { class: 'small-text', style: { margin: 0 } }, '📍 ', resumen) : null,
      h('p', { class: 'small-text muted', style: { margin: 0 } },
        `En el mapa hay ${lines.length} calle${lines.length === 1 ? '' : 's'} trabajada${lines.length === 1 ? '' : 's'}${av ? ' y un punto de “hasta aquí”' : ''}. Si falta marcar algo, cancela y usa los botones de arriba del mapa.`),
      h('label', { class: 'field' }, 'Fecha', fecha),
      h('div', { class: 'field' }, h('span', null, '¿Se completó la tarjeta?'),
        h('div', { class: 'radios' }, h('label', null, full, 'Sí, todo'), h('label', null, part, 'No, quedó una parte'))),
      h('label', { class: 'field' }, 'Notas', notes), err),
    h('div', { class: 'dlg-foot' },
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async e => {
        if (!full.checked && !part.checked) return err.textContent = 'Elige si se completó o quedó una parte.';
        const completo = full.checked, f = fecha.value || todayISO(), nota = notes.value.trim();
        e.target.disabled = true;
        try {
          await F.addDoc(F.collection(F.db, 'congregaciones', nube.cong, 'trabajos'), {
            territorio: t.id, numero: t.numero, fecha: f, completo, calles: JSON.stringify(lines), avance: t.avance || '', notas: nota,
            por: nube.user.uid, porNombre: (nube.me && nube.me.nombre) || '', capitan: t.asignadoA || '', creado: F.serverTimestamp() });
          if (completo) await F.updateDoc(congRef('territorios', t.id), {
            estado: 'disponible', asignadoA: '', capitan: '', desde: f, veces: Math.max(vecesDe(t), vueltaBase() + 1), trabajadas: '', avance: '',
            historial: [...(t.historial || []), { quien: t.asignadoA || (nube.me && nube.me.nombre) || '', desde: t.desde || f, hasta: f, completo: true }].slice(-50) });
          // Quedó una parte: la nota también explica hasta dónde llegaron
          else if (nota && avanceOf(t) && !avanceOf(t).n) await F.updateDoc(congRef('territorios', t.id), { avance: JSON.stringify({ ...avanceOf(t), n: nota.slice(0, 200) }) });
          toast(completo ? `Tarjeta ${t.numero} completada` : 'Salida registrada');
          logChange(`Registró una salida en la tarjeta ${t.numero}: ${completo ? 'completada' : 'quedó una parte'}${nota ? ' (' + nota + ')' : ''}`);
          close();
        } catch (ex) { err.textContent = errMsg(ex); e.target.disabled = false; }
      } }, 'Guardar')));
  document.body.append(dlg); dlg.showModal();
}

// Veces que se completó y salidas registradas de cada territorio en un año (de trabajos/)
function workStats(year) {
  const out = new Map();
  for (const w of nube.trabajos) {
    if (!w.fecha || !w.fecha.startsWith(String(year))) continue;
    const s = out.get(w.territorio) || out.set(w.territorio, { completos: 0, salidas: 0, ultimo: '' }).get(w.territorio);
    s.salidas++;
    if (w.completo) { s.completos++; if (w.fecha > s.ultimo) s.ultimo = w.fecha; }
  }
  return out;
}

// Pegar a las calles: rutas a pie del servidor gratuito de OpenStreetMap (FOSSGIS). Si falla o da
// mucha vuelta, se usa la línea recta.
const ROUTER = 'https://routing.openstreetmap.de/routed-foot';
const rnd = ([lng, lat]) => [+lat.toFixed(6), +lng.toFixed(6)];
async function snapPoint(p) {
  const j = await (await fetch(`${ROUTER}/nearest/v1/driving/${p[1]},${p[0]}?number=1`)).json();
  const w = j.waypoints && j.waypoints[0];
  if (!w || w.distance > 60) return p; // lejos de cualquier calle: se queda donde se tocó
  return rnd(w.location);
}
async function snapRoute(a, b) {
  const j = await (await fetch(`${ROUTER}/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`)).json();
  const r = j.routes && j.routes[0];
  if (!r || !r.geometry.coordinates.length) throw new Error('sin ruta');
  if (r.distance > 3 * L.latLng(a).distanceTo(b) + 40) throw new Error('da mucha vuelta');
  return [a, ...r.geometry.coordinates.map(rnd)];
}

// ---------- salida con GPS ----------
// "Empezar salida": el GPS graba por dónde caminan, pero solo lo que queda dentro del territorio
// (no el camino para llegar). Al terminar, lo recorrido se pega a las calles y queda como calles
// trabajadas; el último punto queda como "hasta aquí" y se abre Registrar salida.
// gpsTrip = { tid, numero, segs: [[[lat, lng], …]], meters, inicio, out } se guarda en el equipo
// (localStorage) para poder continuar la salida si se cierra la app.
let snapOn = true;
try { snapOn = localStorage.getItem('terr-pegar') !== 'no'; } catch (e) {}
let gpsTrip = null, gpsWatch = null, gpsLock = null, gpsPos = null;
const TRIP_KEY = 'salida-gps';
const tripSave = () => { try { gpsTrip ? localStorage.setItem(TRIP_KEY, JSON.stringify(gpsTrip)) : localStorage.removeItem(TRIP_KEY); } catch (e) {} };
const tripStored = () => { try { return JSON.parse(localStorage.getItem(TRIP_KEY)); } catch (e) { return null; } };
const tripMeters = t => t ? Math.round(t.meters) : 0;
const fmtMeters = m => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;

// Distancia en metros de un punto a un tramo (proyección de Mercator corregida por la latitud)
function metersToSegment(p, a, b) {
  const P = L.CRS.EPSG3857.project(L.latLng(p)), A = L.CRS.EPSG3857.project(L.latLng(a)), B = L.CRS.EPSG3857.project(L.latLng(b));
  return Math.sqrt(L.LineUtil._sqClosestPointOnSegment(P, A, B, true)) * Math.cos(p[0] * Math.PI / 180);
}
// ¿El punto está dentro del territorio (o a unos metros de su orilla o de sus calles)?
function insideTerritory(t, p) {
  const c = coordsOf(t);
  if (c.length >= 3) {
    let inside = false;
    for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
      const [yi, xi] = c[i], [yj, xj] = c[j];
      if ((yi > p[0]) !== (yj > p[0]) && p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside || c.some((a, i) => metersToSegment(p, a, c[(i + 1) % c.length]) < 30);
  }
  const streets = streetsOf(t);
  if (!streets.length) return true;
  return streets.some(l => l.some((a, i) => i && metersToSegment(p, l[i - 1], a) < 35));
}
// Pegar un recorrido del GPS a las calles (servicio "match" de OpenStreetMap, de 80 en 80 puntos)
async function matchTrack(seg) {
  if (seg.length < 2) return seg;
  const out = [];
  for (let i = 0; i < seg.length - 1; i += 79) {
    const part = seg.slice(i, i + 80);
    try {
      const j = await (await fetch(`${ROUTER}/match/v1/driving/${part.map(p => `${p[1]},${p[0]}`).join(';')}?overview=full&geometries=geojson&radiuses=${part.map(() => 30).join(';')}`)).json();
      if (j.code !== 'Ok' || !j.matchings || !j.matchings.length) throw new Error('sin calle');
      for (const m of j.matchings) out.push(...m.geometry.coordinates.map(rnd));
    } catch (e) { out.push(...part); }
  }
  return out;
}

function tripStart(t, resume) {
  if (!navigator.geolocation) return toast('Este equipo no puede dar su ubicación');
  gpsTrip = resume || { tid: t.id, numero: t.numero, segs: [], meters: 0, inicio: Date.now(), out: true };
  gpsTrip.out = true; // al continuar, empieza un tramo nuevo
  tripSave();
  if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { gpsLock = l; }).catch(() => {}); // que no se apague la pantalla
  gpsWatch = navigator.geolocation.watchPosition(onGps, () => {
    toast('No se pudo usar el GPS. Revisa que la app tenga permiso de ubicación y que el GPS esté prendido.');
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
  tripUi();
}
function onGps(pos) {
  if (!gpsTrip) return;
  const p = [+pos.coords.latitude.toFixed(6), +pos.coords.longitude.toFixed(6)];
  gpsPos = { p, acc: pos.coords.accuracy };
  const t = nube.territorios.find(x => x.id === gpsTrip.tid);
  if (pos.coords.accuracy > 40) return tripUi(); // señal muy imprecisa
  if (t && hasShape(t) && !insideTerritory(t, p)) { gpsTrip.out = true; return tripUi(); }
  let seg = gpsTrip.segs[gpsTrip.segs.length - 1];
  if (!seg || gpsTrip.out) { seg = []; gpsTrip.segs.push(seg); gpsTrip.out = false; }
  const last = seg[seg.length - 1], d = last ? L.latLng(last).distanceTo(p) : 0;
  if (last && d < 6) return tripUi();
  seg.push(p); gpsTrip.meters += d;
  tripSave(); tripUi();
}
function tripStop() {
  if (gpsWatch != null) navigator.geolocation.clearWatch(gpsWatch);
  gpsWatch = null; gpsPos = null;
  if (gpsLock) { gpsLock.release().catch(() => {}); gpsLock = null; }
}
const tripUi = () => { if (view.name === 'territorios' && terr && terr.refresh) terr.refresh(); };
function tripDiscard() {
  if (!confirm('¿Descartar esta salida? Lo grabado con el GPS se pierde.')) return;
  tripStop(); gpsTrip = null; tripSave(); tripUi();
}
// Terminar: guarda lo recorrido como calles trabajadas y el último punto como "hasta aquí"
async function tripFinish() {
  const trip = gpsTrip || tripStored();
  tripStop();
  const t = trip && nube.territorios.find(x => x.id === trip.tid);
  if (!t) { gpsTrip = null; tripSave(); tripUi(); return toast('Ese territorio ya no existe.'); }
  toast('Guardando el recorrido…');
  let segs = trip.segs.filter(s => s.length > 1);
  if (snapOn) segs = await Promise.all(segs.map(matchTrack));
  const lastSeg = trip.segs.filter(s => s.length).pop(), last = lastSeg && lastSeg[lastSeg.length - 1];
  const patch = {};
  if (segs.length) patch.trabajadas = JSON.stringify([...callesOf(t), ...segs]);
  if (last) patch.avance = JSON.stringify({ p: last, n: '', f: todayISO() });
  if (Object.keys(patch).length && !await updateTerritory(t, patch)) return tripStart(t, trip); // no se pudo guardar: sigue la salida
  gpsTrip = null; tripSave(); tripUi();
  openWorkDialog(nube.territorios.find(x => x.id === t.id) || t,
    segs.length ? `Recorrido con GPS: ${fmtMeters(tripMeters(trip))} dentro de la tarjeta, ya marcado en morado; el último punto quedó como “hasta aquí”.`
      : 'El GPS no grabó recorrido dentro de la tarjeta.');
}
// Marcar con la ubicación de este momento (durante la salida)
function tripMarkHere(kind) {
  if (!gpsPos) return toast('Esperando la señal del GPS…');
  const t = nube.territorios.find(x => x.id === gpsTrip.tid), p = gpsPos.p;
  if (kind === 'casa') {
    const no = h('input', { type: 'radio', name: 'casa', checked: true }), nota = h('input', { type: 'radio', name: 'casa' });
    return openNoteDialog('Marcar esta casa', { placeholder: 'Ej.: Pidió que no lo visiten',
      extra: h('div', { class: 'radios' }, h('label', null, no, '⛔ No predicar aquí'), h('label', null, nota, '📌 Solo una nota')) },
      n => { const cur = nube.territorios.find(x => x.id === t.id) || t;
        return updateTerritory(cur, { noPredicar: JSON.stringify([...housesOf(cur), { p, n: squash(n).slice(0, 200), k: no.checked ? 'no' : 'nota' }]) }, 'Casa marcada donde estás'); });
  }
}

// Sección Territorios. Arriba del mapa, al elegir un territorio, salen los botones para trabajarlo:
// trazar calle trabajada, marcar casa, hasta aquí y registrar salida. Cada uno se guarda al momento.
// Modos del mapa (terr.mode.kind): 'zona' y 'calles' (forma del territorio), 'trabajada' (calles
// predicadas), 'casa' y 'avance' (un toque).
function renderTerritories() {
  const editor = canTerritories();
  const canWork = t => editor || (can('capitan') && isMyTerritory(t));
  if (terr && terr.map) terr.map.remove();
  terr = { selected: terr && terr.selected, filter: (terr && terr.filter) || 'todos', q: (terr && terr.q) || '', year: (terr && terr.year) || new Date().getFullYear(), mode: null };
  if (gpsTrip) terr.selected = gpsTrip.tid; // salida con GPS en curso: su territorio
  const mapEl = h('div', { style: { height: '58vh', minHeight: '320px', borderRadius: '12px', zIndex: 0 } });
  const actions = h('div'), modeBar = h('div'), panel = h('div'), list = h('div'), mine = h('div'), summary = h('div');
  const counts = h('div', { class: 'totals' });
  const tools = h('div', { class: 'row' });
  const search = h('input', { type: 'search', value: terr.q, placeholder: '🔎 Tarjeta, territorio, colonia o una dirección…', style: { flex: 1, minWidth: '200px' },
    oninput: () => { terr.q = search.value; addrBox.replaceChildren(); refresh(); focusMatches(); },
    onkeydown: e => { if (e.key === 'Enter' && !nube.territorios.some(matches)) findAddress(); } });
  const addrBox = h('div');
  const matches = t => { const q = norm(terr.q); return !q || [t.numero, t.nombre, t.territorio].some(x => norm(x || '').includes(q)); };
  const current = () => nube.territorios.find(x => x.id === terr.selected) || null;
  const fresh = t => t && (nube.territorios.find(x => x.id === t.id) || t); // por si cambió mientras se marcaba

  loadLeaflet().then(L => {
    const map = baseMap(L, mapEl);
    Object.assign(terr, { L, map, group: L.featureGroup().addTo(map), marks: L.layerGroup().addTo(map), tmp: L.layerGroup().addTo(map) });
    map.on('click', e => onTap(e.latlng));
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('terr-vista-' + nube.cong)); } catch (e) {}
    map.on('moveend', () => { try { localStorage.setItem('terr-vista-' + nube.cong, JSON.stringify([map.getCenter(), map.getZoom()])); } catch (e) {} });
    drawLayers();
    if (saved) map.setView(saved[0], saved[1]);
    else if (terr.group.getLayers().length) map.fitBounds(terr.group.getBounds(), { padding: [20, 20] });
    else { map.setView([23.6, -102.5], 5); map.locate({ setView: true, maxZoom: 16 }); }
    tools.prepend(locateButton(L, map));
    setTimeout(() => map.invalidateSize(), 50); // por si la página aún acomodaba su tamaño
  }).catch(() => { mapEl.textContent = 'No se pudo cargar el mapa. Revisa tu conexión a internet.'; });

  const pin = (L, ll, emoji, tip) => L.marker(ll, { icon: L.divIcon({ className: 'terr-pin', html: emoji, iconSize: [26, 26], iconAnchor: [13, 24] }) })
    .bindTooltip(tip || '', { direction: 'top', offset: [0, -20] });

  function drawLayers() {
    const L = terr.L, base = vueltaBase(), searching = !!terr.q.trim();
    terr.group.clearLayers(); terr.marks.clearLayers();
    // Contorno de cada territorio (todas sus tarjetas), debajo de las tarjetas
    const zones = new Map();
    for (const t of nube.territorios) if (t.territorio && hasShape(t)) (zones.get(t.territorio) || zones.set(t.territorio, []).get(t.territorio)).push(t);
    for (const [z, cards] of zones) {
      const hull = territoryHull(cards);
      if (!hull) continue;
      const hit = searching && norm(z).includes(norm(terr.q));
      L.polygon(hull, { color: '#5b3cc4', weight: hit ? 4 : 2.5, dashArray: '8 6', fill: true, fillColor: '#5b3cc4', fillOpacity: hit ? 0.12 : 0.04, interactive: false })
        .bindTooltip(`Territorio ${z}`, { permanent: true, direction: 'top', className: 'terr-zone', offset: [0, 0] }).addTo(terr.group);
    }
    for (const t of nube.territorios) {
      if (!hasShape(t)) continue;
      const sel = t.id === terr.selected, hit = searching && matches(t), color = TERR[estadoDe(t, base)].color, dim = searching && !hit;
      // Relleno: un color por tarjeta para distinguirlas; el borde sigue diciendo su estado
      const fill = terrByCard() ? terrColor(t) : color;
      const shape = terrShape(L, t, { color: sel || hit ? '#000' : color, weight: sel ? 4 : hit ? 3 : dim ? 1 : 2, fillColor: fill,
        fillOpacity: sel ? 0.65 : dim ? 0.08 : hit ? 0.65 : 0.5, bubblingMouseEvents: false });
      // El número va una sola vez (en un territorio de calles, sobre la primera)
      (shape instanceof L.Polygon ? shape : shape.getLayers()[0]).bindTooltip(String(t.numero), { permanent: true, direction: 'center', className: 'terr-label' + (dim ? ' dim' : '') });
      shape.on('click', ev => { if (terr.mode) return onTap(ev.latlng); select(t.id, false); })
        .addTo(terr.group);
    }
    // Del territorio elegido: calles trabajadas, hasta dónde se llegó y casas marcadas
    const t = current();
    if (!t) return;
    for (const line of callesOf(t)) if (line.length > 1) L.polyline(line, { color: '#7b2cbf', weight: 6, opacity: 0.85, interactive: false }).addTo(terr.marks);
    const av = avanceOf(t);
    if (av && av.p) pin(L, av.p, '🚩', `Hasta aquí${av.f ? ' (' + fmtShort(av.f) + ')' : ''}${av.n ? ': ' + av.n : ''}`).addTo(terr.marks);
    for (const x of housesOf(t)) pin(L, x.p, HOUSE[x.k].icon, `${HOUSE[x.k].label}${x.n ? ': ' + x.n : ''}`).addTo(terr.marks);
    if (gpsTrip && gpsTrip.tid === t.id) {
      for (const seg of gpsTrip.segs) if (seg.length > 1) L.polyline(seg, { color: '#d32f2f', weight: 6, opacity: 0.85, dashArray: '8 6', interactive: false }).addTo(terr.marks);
      if (gpsPos) L.circleMarker(gpsPos.p, { radius: 8, color: '#fff', weight: 2, fillColor: '#1a73e8', fillOpacity: 1, interactive: false }).addTo(terr.marks);
    }
  }

  function select(id, zoom = true) {
    if (terr.mode) return;
    terr.selected = id;
    const t = current();
    if (zoom && t && terr.map && hasShape(t)) terr.map.fitBounds(terrShape(terr.L, t, {}).getBounds(), { padding: [40, 40], maxZoom: 18 });
    refresh();
    actions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  // Buscar una dirección (OpenStreetMap): primero cerca de lo que se ve en el mapa
  async function findAddress() {
    const q = squash(search.value);
    if (!q || !terr.map) return toast('Escribe la dirección en el buscador.');
    addrBox.replaceChildren(h('div', { class: 'small-text muted', style: { marginBottom: '8px' } }, 'Buscando la dirección…'));
    try {
      const b = terr.map.getBounds();
      const list = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=es&q=${encodeURIComponent(q)}&viewbox=${b.getWest()},${b.getNorth()},${b.getEast()},${b.getSouth()}`)).json();
      const go = x => {
        addrBox.replaceChildren();
        const p = [+x.lat, +x.lon];
        terr.map.setView(p, 18);
        if (terr.addr) terr.addr.remove();
        terr.addr = pin(terr.L, p, '📍', x.display_name).addTo(terr.map).openTooltip();
      };
      addrBox.replaceChildren(h('div', { class: 'card', style: { padding: '6px 10px', marginBottom: '10px' } },
        list.length ? list.map(x => h('div', { class: 'urow', style: { cursor: 'pointer' }, onclick: () => go(x) }, h('span', { class: 'small-text' }, '📍 ', x.display_name)))
          : h('div', { class: 'small-text muted' }, 'No se encontró esa dirección. Prueba con la calle, el número y la colonia.'),
        h('button', { class: 'btn small', style: { margin: '6px 0' }, onclick: () => addrBox.replaceChildren() }, 'Cerrar')));
    } catch (e) { addrBox.replaceChildren(h('div', { class: 'small-text muted', style: { marginBottom: '8px' } }, 'No se pudo buscar. Revisa tu internet.')); }
  }
  // Al buscar: si solo hay uno, se elige; si hay varios, el mapa los encuadra
  function focusMatches() {
    if (!terr.map || !terr.q.trim()) return;
    const found = nube.territorios.filter(t => matches(t) && hasShape(t));
    if (found.length === 1) return select(found[0].id);
    if (found.length) terr.map.fitBounds(terr.L.featureGroup(found.map(t => terrShape(terr.L, t, {}))).getBounds(), { padding: [30, 30], maxZoom: 17 });
  }

  // ----- modos del mapa -----
  // En los de calles, cada línea guarda sus puntos (lines) y cuántos agregó cada toque (steps), para
  // poder deshacer el último toque aunque la ruta pegada a la calle haya puesto muchos puntos.
  const MODES = {
    zona: { help: 'Toca las esquinas de la zona en orden.', ready: m => m.points.length >= 3 },
    calles: { help: 'Toca el inicio y luego el final de cada calle de la tarjeta; la línea sigue la calle sola. Para otra calle, toca “＋ Otra calle”.', lines: true, ready: m => m.lines.some(l => l.length > 1) },
    trabajada: { help: 'Toca donde empezaron y luego donde terminaron la calle; la línea sigue la calle sola. Sin “Pegar a las calles”, tocas punto por punto.', lines: true, ready: m => m.lines.some(l => l.length > 1) },
    casa: { help: 'Toca en el mapa la casa que quieres marcar.' },
    avance: { help: 'Toca en el mapa el lugar exacto donde se quedaron.' },
  };
  function startMode(kind, t) {
    if (!terr.map) return toast('Espera a que cargue el mapa.');
    terr.mode = { kind, t, points: [], lines: [[]], steps: [[]], busy: false };
    terr.map.getContainer().style.cursor = 'crosshair';
    redrawTmp(); refresh();
    modeBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function stopMode() {
    terr.mode = null;
    if (terr.tmp) terr.tmp.clearLayers();
    if (terr.map) terr.map.getContainer().style.cursor = '';
    refresh();
  }
  const addPts = (m, pts) => { m.lines[m.lines.length - 1].push(...pts); m.steps[m.steps.length - 1].push(pts.length); };
  async function onTap(ll) {
    const m = terr.mode;
    if (!m || m.busy) return;
    const p = [+ll.lat.toFixed(6), +ll.lng.toFixed(6)];
    if (m.kind === 'zona') m.points.push(p);
    else if (MODES[m.kind].lines) {
      const line = m.lines[m.lines.length - 1];
      if (snapOn) {
        // Se pega a la calle: el primer toque a la calle más cercana; los demás siguen la ruta a pie
        m.busy = true; barUpdate();
        try { addPts(m, line.length ? (await snapRoute(line[line.length - 1], p)).slice(1) : [await snapPoint(p)]); }
        catch (e) { addPts(m, [p]); }
        m.busy = false;
        if (terr.mode !== m) return;
      } else addPts(m, [p]);
    } else {
      const t = fresh(m.t); stopMode();
      if (m.kind === 'casa') {
        const no = h('input', { type: 'radio', name: 'casa', checked: true }), nota = h('input', { type: 'radio', name: 'casa' });
        return openNoteDialog('Marcar casa', { placeholder: 'Ej.: Pidió que no lo visiten / Hablar con el señor Juan',
          extra: h('div', { class: 'radios' }, h('label', null, no, '⛔ No predicar aquí'), h('label', null, nota, '📌 Solo una nota')) },
          n => updateTerritory(fresh(t), { noPredicar: JSON.stringify([...housesOf(fresh(t)), { p, n: squash(n).slice(0, 200), k: no.checked ? 'no' : 'nota' }]) }, 'Casa marcada'));
      }
      return openNoteDialog('Hasta aquí llegaron', { placeholder: 'Ej.: Se quedaron en la esquina de Hidalgo y Juárez' },
        n => updateTerritory(t, { avance: JSON.stringify({ p, n: n.slice(0, 200), f: todayISO() }) }, 'Guardado: hasta aquí llegaron'));
    }
    redrawTmp(); barUpdate();
  }
  function undo() {
    const m = terr.mode;
    if (m.kind === 'zona') m.points.pop();
    else {
      if (!m.steps[m.steps.length - 1].length && m.lines.length > 1) { m.lines.pop(); m.steps.pop(); }
      const n = m.steps[m.steps.length - 1].pop() || 0;
      m.lines[m.lines.length - 1].splice(-n || Infinity, n);
    }
    redrawTmp(); barUpdate();
  }
  function newLine() { const m = terr.mode; m.lines.push([]); m.steps.push([]); barUpdate(); }

  function redrawTmp() {
    const m = terr.mode, L = terr.L;
    terr.tmp.clearLayers();
    if (!m) return;
    const color = m.kind === 'trabajada' ? '#7b2cbf' : '#000';
    if (m.kind === 'zona' && m.points.length > 1) L.polygon(m.points, { color, dashArray: '6 4', weight: 2, fillOpacity: 0.15, interactive: false }).addTo(terr.tmp);
    if (m.kind === 'zona') m.points.forEach(pt => L.circleMarker(pt, { radius: 5, color, fillColor: '#fff', fillOpacity: 1, weight: 2, interactive: false }).addTo(terr.tmp));
    else m.lines.forEach((line, i) => {
      if (line.length > 1) L.polyline(line, { color, weight: 6, opacity: 0.9, dashArray: '10 6', interactive: false }).addTo(terr.tmp);
      // Solo los puntos tocados (el inicio de cada paso), no todos los de la ruta
      const ends = [];
      let k = 0;
      for (const n of m.steps[i]) { k += n; ends.push(k - 1); }
      for (const j of ends.length > 40 ? [0, ends[ends.length - 1]] : ends) if (line[j]) L.circleMarker(line[j], { radius: 5, color, fillColor: '#fff', fillOpacity: 1, weight: 2, interactive: false }).addTo(terr.tmp);
    });
  }
  async function finishMode() {
    const m = terr.mode, t = fresh(m.t), lines = m.lines.filter(l => l.length > 1);
    stopMode();
    if (m.kind === 'zona') return t ? updateTerritory(t, { coords: JSON.stringify(m.points), calles: '' }, 'Zona guardada') : openTerritoryDataDialog(null, { coords: m.points });
    if (m.kind === 'calles') return t ? updateTerritory(t, { calles: JSON.stringify(lines), coords: '[]' }, 'Calles de la tarjeta guardadas') : openTerritoryDataDialog(null, { calles: lines });
    if (m.kind === 'trabajada') updateTerritory(t, { trabajadas: JSON.stringify([...callesOf(t), ...lines]) }, `${lines.length === 1 ? 'Calle trabajada guardada' : lines.length + ' calles trabajadas guardadas'}`);
  }
  function barUpdate() {
    const m = terr.mode;
    if (!m) return modeBar.replaceChildren();
    const info = MODES[m.kind], cur = m.lines[m.lines.length - 1];
    const what = { zona: m.t ? `Redibujar la zona de la tarjeta ${m.t.numero}` : 'Nueva tarjeta: dibujar la zona', calles: m.t ? `Redibujar las calles de la tarjeta ${m.t.numero}` : 'Nueva tarjeta: trazar sus calles',
      trabajada: `Trazar calle trabajada · tarjeta ${m.t && m.t.numero}`, casa: `Marcar casa · tarjeta ${m.t && m.t.numero}`, avance: `Hasta aquí · tarjeta ${m.t && m.t.numero}` }[m.kind];
    const needsSave = m.kind === 'zona' || info.lines;
    modeBar.replaceChildren(h('div', { class: 'card mode-bar' },
      h('strong', null, what),
      h('div', { class: 'small-text', style: { margin: '4px 0 8px' } }, m.busy ? 'Buscando la calle…' : info.help),
      info.lines ? h('div', { class: 'row', style: { marginBottom: '8px' } },
        h('label', { class: 'row small-text', style: { gap: '6px' } }, h('input', { type: 'checkbox', checked: snapOn, onchange: e => {
          snapOn = e.target.checked; try { localStorage.setItem('terr-pegar', snapOn ? 'si' : 'no'); } catch (x) {}
        } }), '🧲 Pegar a las calles')) : null,
      h('div', { class: 'row' },
        needsSave ? h('button', { class: 'btn small', disabled: m.busy, onclick: undo }, '↶ Deshacer') : null,
        info.lines ? h('button', { class: 'btn small', disabled: cur.length < 2, onclick: newLine }, '＋ Otra calle') : null,
        h('button', { class: 'btn small', onclick: stopMode }, 'Cancelar'),
        needsSave ? h('button', { class: 'btn small primary', disabled: m.busy || !info.ready(m), onclick: finishMode }, '✓ Guardar') : null)));
  }

  // Elegir cómo dibujar un territorio: zona (cuadro) o sus calles
  function askShape(t) {
    const close = () => { dlg.close(); dlg.remove(); };
    const opt = (kind, title, text) => h('button', { class: 'btn', style: { textAlign: 'left', display: 'block', width: '100%', padding: '12px' }, onclick: () => { close(); startMode(kind, t); } },
      h('strong', null, title), h('div', { class: 'small-text muted' }, text));
    const dlg = h('dialog', { class: 'dlg' },
      h('div', { class: 'dlg-body' }, h('h3', null, t ? `Redibujar la tarjeta ${t.numero}` : 'Nueva tarjeta'), h('p', { class: 'small-text', style: { margin: 0 } }, '¿Cómo es la zona de la tarjeta?'),
        opt('zona', '▱ Una zona', 'Tocas las esquinas y se forma el área (por ejemplo, unas manzanas).'),
        opt('calles', '〰 Unas calles', 'Trazas solo las calles que forman la tarjeta.')),
      h('div', { class: 'dlg-foot' }, h('button', { class: 'btn', onclick: close }, 'Cancelar')));
    document.body.append(dlg); dlg.showModal();
  }

  // ----- arriba del mapa: lo que se puede hacer con el territorio elegido -----
  function actionsUpdate() {
    const t = current(), base = vueltaBase();
    if (terr.mode) return actions.replaceChildren();
    // Salida con GPS en curso: lo único que se ve arriba es eso
    if (gpsTrip) return actions.replaceChildren(h('div', { class: 'card mode-bar trip' },
      h('div', { class: 'row spread' }, h('strong', null, `● Grabando salida · tarjeta ${gpsTrip.numero}`),
        h('span', { class: 'small-text' }, `desde las ${new Date(gpsTrip.inicio).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })}`)),
      h('div', { style: { fontSize: '26px', fontWeight: 700, margin: '6px 0' } }, fmtMeters(tripMeters(gpsTrip))),
      h('div', { class: 'small-text', style: { marginBottom: '8px' } },
        !gpsPos ? '📡 Esperando la señal del GPS…' : gpsPos.acc > 40 ? '📡 Señal del GPS imprecisa, espera un momento…'
          : gpsTrip.out ? '📍 Estás fuera de la tarjeta: no se graba. Al entrar, sigue grabando solo.' : '📍 Grabando por dónde caminan (en rojo). Dejen la app abierta.'),
      h('div', { class: 'terr-actions' },
        h('button', { class: 'btn', onclick: () => tripMarkHere('casa') }, h('span', { style: { fontSize: '20px' } }, '🏠'), 'Marcar casa aquí'),
        h('button', { class: 'btn primary', onclick: tripFinish }, h('span', { style: { fontSize: '20px' } }, '■'), 'Terminar salida')),
      h('button', { class: 'btn small', style: { marginTop: '8px' }, onclick: tripDiscard }, 'Descartar')));
    // Una salida que quedó a medias (se cerró la app)
    const stored = tripStored();
    if (stored && !gpsTrip) return actions.replaceChildren(h('div', { class: 'card mode-bar' },
      h('strong', null, `Hay una salida con GPS sin terminar · tarjeta ${stored.numero}`),
      h('div', { class: 'small-text', style: { margin: '4px 0 8px' } }, `Llevaba ${fmtMeters(tripMeters(stored))} grabados.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn small primary', onclick: () => { terr.selected = stored.tid; tripStart(null, stored); } }, '▶ Continuar'),
        h('button', { class: 'btn small', onclick: () => { gpsTrip = stored; tripFinish(); } }, '■ Terminar y registrar'),
        h('button', { class: 'btn small', onclick: () => { gpsTrip = stored; tripDiscard(); if (gpsTrip) gpsTrip = null; } }, 'Descartar'))));
    if (!t) return actions.replaceChildren(h('div', { class: 'card', style: { padding: '12px 14px', marginBottom: '10px' } },
      h('div', { class: 'small-text' }, '👆 Toca una tarjeta en el mapa o en la lista para ver sus datos',
        nube.territorios.some(canWork) ? ' y trabajar en él (marcar calles, casas y registrar salidas).' : '.'),
      editor ? h('button', { class: 'btn small primary', style: { marginTop: '8px' }, onclick: () => askShape(null) }, '+ Nueva tarjeta') : null));
    const st = estadoDe(t, base);
    const big = (icon, text, fn, primary) => h('button', { class: 'btn' + (primary ? ' primary' : ''), onclick: fn }, h('span', { style: { fontSize: '20px' } }, icon), text);
    actions.replaceChildren(h('div', { class: 'card', style: { padding: '12px 14px', marginBottom: '10px' } },
      h('div', { class: 'row spread' },
        h('div', null, h('span', { class: 'terr-dot', style: { background: terrColor(t) } }), h('strong', { style: { fontSize: '17px' } }, terrTitle(t)),
          ' ', h('span', { class: 'badge', style: { background: TERR[st].color, color: '#fff' } }, TERR[st].label),
          st === 'asignado' ? h('span', { class: 'small-text' }, ` a ${t.asignadoA}`) : null),
        h('button', { class: 'btn small', onclick: () => { terr.selected = null; refresh(); } }, '✕')),
      canWork(t) ? h('button', { class: 'btn primary trip-start', onclick: () => tripStart(t) }, '▶ Empezar salida con GPS',
        h('span', { class: 'small-text' }, 'Graba por dónde caminan dentro de la tarjeta y al final lo registra')) : null,
      canWork(t) ? h('div', { class: 'terr-actions' },
        big('〰', 'Trazar calle trabajada', () => startMode('trabajada', t)),
        big('🏠', 'Marcar casa', () => startMode('casa', t)),
        big('🚩', 'Hasta aquí llegaron', () => startMode('avance', t)),
        big('✅', 'Registrar salida', () => openWorkDialog(t)))
        : h('div', { class: 'small-text muted', style: { marginTop: '6px' } }, 'Para registrar aquí, el siervo de territorios tiene que asignártela.'),
      editor ? h('div', { class: 'row', style: { marginTop: '8px' } },
        st === 'asignado' ? h('button', { class: 'btn small primary', onclick: () => openAssignDialog(t) }, 'Cambiar capitán') : null,
        st !== 'asignado' ? h('button', { class: 'btn small primary', onclick: () => openAssignDialog(t) }, 'Asignar') : h('button', { class: 'btn small', onclick: () => unassignTerritory(t) }, 'Quitar asignación'),
        h('button', { class: 'btn small', onclick: () => panel.scrollIntoView({ behavior: 'smooth' }) }, 'Más opciones ↓')) : null));
  }

  // ----- resumen, detalle del territorio elegido y lista -----
  function refresh() {
    if (terr.map) drawLayers();
    barUpdate(); actionsUpdate();
    const all = [...nube.territorios].sort(byNumero), today = todayISO(), base = vueltaBase(), year = new Date().getFullYear();
    const stats = workStats(terr.year), thisYear = workStats(year);
    const n = k => all.filter(t => estadoDe(t, base) === k).length;
    counts.replaceChildren(...Object.entries(TERR).map(([k, v]) => h('span', null,
      h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: v.color, marginRight: '5px' } }),
      h('strong', null, n(k)), ' ', v.label.toLowerCase() + (n(k) === 1 ? '' : 's'))),
      h('button', { class: 'linkbtn', title: 'El borde siempre indica el estado', onclick: () => {
        try { localStorage.setItem('terr-colores', terrByCard() ? 'estado' : 'tarjeta'); } catch (e) {}
        refresh();
      } }, terrByCard() ? 'Colorear por estado' : 'Colorear por tarjeta'));
    const pending = all.filter(t => estadoDe(t, base) === 'disponible');
    const sum = k => [...thisYear.values()].reduce((a, s) => a + s[k], 0);
    summary.replaceChildren(all.length ? h('div', { class: 'small-text', style: { margin: '-4px 0 10px' } },
      h('strong', null, `Vuelta ${base + 1}: `), `${n('terminado')} de ${all.length} completados.`,
      pending.length ? ` Siguen en orden: ${pending.slice(0, 5).map(t => t.numero).join(', ')}.` : '',
      ` En ${year}: ${sum('completos')} completados y ${sum('salidas')} salidas registradas.`) : '');
    // Capitán: sus territorios
    const myOnes = all.filter(isMyTerritory);
    mine.replaceChildren(myOnes.length ? h('div', { class: 'card', style: { padding: '12px 14px', marginBottom: '12px' } },
      h('strong', null, 'Mis tarjetas'),
      myOnes.map(t => h('div', { class: 'row spread', style: { marginTop: '8px' } },
        h('span', null, h('strong', null, terrTitle(t)), h('span', { class: 'muted small-text' }, ` · desde el ${fmtShort(t.desde)} (${dayCount(daysBetween(t.desde, today))})`)),
        h('button', { class: 'btn small primary', onclick: () => select(t.id) }, 'Trabajar aquí')))) : '');

    const t = current();
    const st = t ? estadoDe(t, base) : null, av = t && avanceOf(t), hs = t ? housesOf(t) : [], ys = t && thisYear.get(t.id);
    const works = t ? nube.trabajos.filter(w => w.territorio === t.id).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 15) : [];
    panel.replaceChildren(t ? h('div', { class: 'card', style: { padding: '14px', marginTop: '12px' } },
      h('strong', { style: { fontSize: '17px' } }, terrTitle(t)),
      h('div', { class: 'small-text', style: { marginTop: '6px', display: 'grid', gap: '4px' } },
        h('div', null, `Territorio: ${t.territorio || '—'}`),
        h('div', null, `Estado: ${TERR[st].label}${st === 'asignado' ? ` a ${t.asignadoA}` : ''}${t.desde ? ` · desde el ${fmtShort(t.desde)} (${dayCount(daysBetween(t.desde, today))})` : ''}`),
        h('div', null, `En ${year}: completado ${ys ? ys.completos : 0} ${ys && ys.completos === 1 ? 'vez' : 'veces'} · ${ys ? ys.salidas : 0} salida${ys && ys.salidas === 1 ? '' : 's'} registrada${ys && ys.salidas === 1 ? '' : 's'}.`),
        av ? h('div', null, '🚩 Hasta aquí llegaron', av.f ? ` (${fmtShort(av.f)})` : '', av.n ? `: ${av.n}` : '') : null,
        callesOf(t).length ? h('div', null, `〰 ${callesOf(t).length} calle${callesOf(t).length === 1 ? '' : 's'} trabajada${callesOf(t).length === 1 ? '' : 's'} en esta vuelta (en morado en el mapa).`) : null,
        t.notas ? h('div', null, richText(t.notas)) : null),
      h('div', { class: 'hist', style: { marginTop: '10px' } },
        h('strong', null, `Casas marcadas (${hs.length})`),
        hs.length ? hs.map((x, i) => h('div', null, h('span', null, `${HOUSE[x.k].icon} ${HOUSE[x.k].label}`, x.n ? h('span', { class: 'muted' }, ` · ${x.n}`) : null),
          canWork(t) ? h('button', { class: 'btn small', onclick: () => {
            if (confirm('¿Quitar esta casa marcada?')) updateTerritory(t, { noPredicar: JSON.stringify(hs.filter((_, j) => j !== i)) }, 'Marca quitada');
          } }, 'Quitar') : null)) : h('div', { class: 'muted' }, 'Ninguna. Usa “🏠 Marcar casa”.')),
      h('div', { class: 'hist', style: { marginTop: '10px' } },
        h('strong', null, 'Salidas registradas'),
        works.length ? works.map(w => h('div', null,
          h('span', null, w.completo ? '✅ Completado' : '◐ Quedó una parte', w.capitan || w.porNombre ? ` · ${w.capitan || w.porNombre}` : '', w.notas ? h('span', { class: 'muted' }, ` · ${w.notas}`) : null),
          h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'muted' }, fmtShort(w.fecha)),
            editor ? h('button', { class: 'btn small', title: 'Borrar este registro', onclick: async () => {
              if (!confirm(`¿Borrar la salida del ${fmtShort(w.fecha)}?${w.completo ? ' El territorio sigue contando como completado; si no lo fue, usa “Regresar a disponible”.' : ''}`)) return;
              try { await F.deleteDoc(congRef('trabajos', w.id)); toast('Registro borrado'); } catch (e) { toast(errMsg(e)); }
            } }, '✕') : null))) : h('div', { class: 'muted' }, 'Todavía no hay. Usa “✅ Registrar salida”.')),
      (t.historial || []).length ? h('div', { class: 'hist', style: { marginTop: '10px' } },
        h('strong', null, 'Asignaciones anteriores'),
        [...t.historial].reverse().map(x => h('div', null, h('span', null, x.quien || '—', x.completo ? ' ✅' : x.completo === false ? ' (sin completar)' : ''),
          h('span', { class: 'muted' }, `${x.desde ? fmtShort(x.desde) : '?'} – ${x.hasta ? fmtShort(x.hasta) : '?'}`)))) : null,
      h('div', { class: 'row', style: { marginTop: '12px' } },
        editor && st === 'terminado' ? h('button', { class: 'btn small', onclick: () => {
          if (confirm(`¿Regresar la tarjeta ${t.numero} a disponible en esta vuelta? Sus registros no se borran.`)) updateTerritory(t, { veces: vueltaBase() }, 'Ahora está disponible');
        } }, 'Regresar a disponible') : null,
        h('button', { class: 'btn small', onclick: () => openQRDialog(t) }, '▦ QR'),
        h('button', { class: 'btn small', onclick: () => territoryCardsPDF([t]) }, '🖨 Tarjeta con mapa'),
        h('button', { class: 'btn small', onclick: () => terr.map && saveMapOffline(terr.L, terr.map, terrShape(terr.L, t, {}).getBounds()) }, '📴 Guardar mapa sin internet'),
        editor ? h('button', { class: 'btn small', onclick: () => openTerritoryDataDialog(t) }, 'Editar datos') : null,
        editor ? h('button', { class: 'btn small', onclick: () => askShape(t) }, 'Redibujar') : null,
        canWork(t) && (callesOf(t).length || av) ? h('button', { class: 'btn small', onclick: () => {
          if (confirm('¿Borrar del mapa las calles trabajadas y el “hasta aquí”? Las salidas registradas no se borran.')) updateTerritory(t, { trabajadas: '', avance: '' }, 'Marcas borradas');
        } }, 'Borrar calles y avance') : null,
        editor ? h('button', { class: 'btn small danger', onclick: async () => {
          if (!confirm(`¿Borrar la tarjeta ${t.numero}? Se pierde también su historial.`)) return;
          try { await F.deleteDoc(congRef('territorios', t.id)); terr.selected = null; toast('Tarjeta borrada'); } catch (e) { toast(errMsg(e)); }
        } }, 'Borrar tarjeta') : null)) : '');

    const shown = all.filter(t => (terr.filter === 'todos' || estadoDe(t, base) === terr.filter) && matches(t));
    const years = [...new Set([year, ...nube.trabajos.map(w => +String(w.fecha).slice(0, 4)).filter(Boolean)])].sort((a, b) => b - a);
    list.replaceChildren(
      h('div', { class: 'row spread', style: { alignItems: 'flex-end' } },
        h('div', { class: 'chips', style: { maxWidth: '520px', flex: 1 } }, [['todos', 'Todos'], ...Object.entries(TERR).map(([k, v]) => [k, v.label + 's'])].map(([k, label]) =>
          h('button', { class: terr.filter === k ? 'on' : '', onclick: () => { terr.filter = k; refresh(); } }, label))),
        years.length > 1 ? h('label', { class: 'field' }, 'Año', h('select', { onchange: e => { terr.year = +e.target.value; refresh(); } },
          years.map(y => h('option', { value: y, selected: y === terr.year ? true : null }, y)))) : null),
      h('div', { class: 'tablewrap' }, h('table', { class: 'stats' },
        h('thead', null, h('tr', null, ['Tarjeta', 'Territorio', 'Colonia', 'Estado', 'Asignado a', 'Desde', `Completado ${terr.year}`, `Salidas ${terr.year}`].map(x => h('th', null, x)))),
        h('tbody', null, shown.length ? shown.map(t => {
          const s = stats.get(t.id), e = estadoDe(t, base);
          return h('tr', { onclick: () => select(t.id), style: t.id === terr.selected ? { background: 'var(--surface-2)' } : null },
            h('td', null, h('strong', null, t.numero)), h('td', null, t.territorio || '—'), h('td', null, t.nombre || '—'),
            h('td', null, h('span', { class: 'badge', style: { background: TERR[e].color, color: '#fff' } }, TERR[e].label)),
            h('td', null, e === 'asignado' ? t.asignadoA : '—'),
            h('td', { class: 'small-text' }, t.desde ? `${fmtShort(t.desde)} (${daysBetween(t.desde, today)} d)` : '—'),
            h('td', null, s ? `${s.completos}${s.ultimo ? ' · ' + fmtShort(s.ultimo) : ''}` : 0),
            h('td', null, s ? s.salidas : 0));
        })
          : h('tr', null, h('td', { colspan: 8, class: 'empty' }, all.length ? 'Ninguno con este filtro.' : editor ? 'Todavía no hay tarjetas. Toca “+ Nueva tarjeta”.' : 'Todavía no hay tarjetas.'))))));
  }
  terr.refresh = refresh;
  refresh();

  return h('div', null,
    h('div', { class: 'row spread', style: { marginBottom: '10px' } },
      h('div', null, h('h1', null, 'Territorios'),
        h('p', { class: 'sub', style: { margin: 0 } }, editor ? 'Elige una tarjeta para asignarla, marcar lo trabajado y registrar salidas. Las tarjetas de un mismo territorio se rodean con su contorno.'
          : can('capitan') ? 'Tus tarjetas salen en “Mis tarjetas”. Elige una para marcar lo trabajado y registrar la salida.' : 'Toca una tarjeta para ver sus datos y su QR.')),
      tools),
    mine,
    counts,
    summary,
    h('div', { class: 'row', style: { marginBottom: '10px' } }, search, h('button', { class: 'btn small', onclick: findAddress }, '📍 Buscar dirección')),
    addrBox,
    actions,
    modeBar,
    mapEl,
    panel,
    h('div', { class: 'row spread', style: { margin: '18px 0 8px' } },
      h('h2', { class: 'group', style: { margin: 0 } }, 'Lista'),
      h('div', { class: 'row' },
        editor ? h('button', { class: 'btn small primary', onclick: () => askShape(null) }, '+ Nueva tarjeta') : null,
        h('button', { class: 'btn small', onclick: () => {
          const base = vueltaBase(), all = [...nube.territorios].sort(byNumero).filter(t => (terr.filter === 'todos' || estadoDe(t, base) === terr.filter) && matches(t));
          if (all.length) territoryCardsPDF(all); else toast('No hay territorios para imprimir');
        } }, '🖨 Tarjetas con mapa (PDF)'))),
    list);
}

// Lo que abre el QR de una tarjeta: solo esa zona en el mapa, sin iniciar sesión
function renderSharedTerritory() {
  const q = new URLSearchParams(location.hash.slice(1));
  const pts = decodePoly(q.get('p') || ''), numero = q.get('n') || '', nombre = q.get('t') || '';
  document.title = `Tarjeta ${numero}`;
  setBrand(`Tarjeta ${numero}${nombre ? ' · ' + nombre : ''}`);
  const mapEl = h('div', { style: { height: 'calc(100vh - 170px)', minHeight: '320px', borderRadius: '12px' } });
  const tools = h('div', { class: 'row', style: { marginBottom: '10px' } });
  document.getElementById('app').replaceChildren(tools, mapEl);
  loadLeaflet().then(L => {
    const map = baseMap(L, mapEl);
    const lines = (q.get('l') || '').split('~').filter(Boolean).map(decodePoly).filter(l => l.length > 1);
    if (pts.length >= 3 || lines.length) {
      const poly = (pts.length >= 3 ? L.polygon(pts, { color: '#e08a00', weight: 3, fillOpacity: 0.25 }) : L.featureGroup(lines.map(l => L.polyline(l, { color: '#e08a00', weight: 8, opacity: 0.9 })))).addTo(map);
      for (const p of decodePoly(q.get('x') || '')) L.marker(p, { icon: L.divIcon({ className: 'terr-pin', html: '⛔', iconSize: [26, 26], iconAnchor: [13, 24] }) }).bindTooltip('No predicar').addTo(map);
      map.fitBounds(poly.getBounds(), { padding: [30, 30], maxZoom: 18 });
      const c = poly.getBounds().getCenter();
      tools.append(locateButton(L, map),
        h('a', { class: 'btn small', href: `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`, target: '_blank', rel: 'noopener', style: { textDecoration: 'none' } }, '🧭 Cómo llegar'));
    } else mapEl.textContent = 'Este enlace no tiene una zona válida.';
  }).catch(() => { mapEl.textContent = 'No se pudo cargar el mapa. Revisa tu conexión a internet.'; });
}
