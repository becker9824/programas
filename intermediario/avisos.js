// Avisos al celular (Firebase Cloud Messaging) para la app Programas.
// La llave de la cuenta de servicio vive en el secreto FCM_CUENTA de Cloudflare (nunca en el código ni en el repositorio).
// Con ella este servicio lee lo necesario de Firestore y manda los avisos:
//   POST /avisos/enviar  { cong, tipo: 'prueba' | 'anuncio' | 'asignaciones', id?, lista? }
//     Lo pide la app con el token de la cuenta (Authorization: Bearer …). Se revisa quién es y qué función tiene:
//     anuncio → solo ancianos; asignaciones → Programa VyM o coordinador; prueba → a uno mismo.
//   Programado (cron): los días 1 y 5 de cada mes recuerda el informe del mes pasado a quien no lo ha mandado.
// Los celulares guardan su token en congregaciones/{cong}/avisos/{uid} = { perfil, tokens: [...] }.
const PROYECTO = 'programas-congregacion';
const WEB = 'https://programas-congregacion.web.app/';
const FS = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents`;
const ELDER = ['programa', 'secretario', 'ancianos'];

const enc = s => new TextEncoder().encode(s);
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

// ---------- acceso de administrador (OAuth con la cuenta de servicio) ----------
let admin = null;
async function adminToken(env) {
  if (admin && admin.exp > Date.now() + 60000) return admin.token;
  if (!env.FCM_CUENTA) throw fail('Falta el secreto FCM_CUENTA', 500);
  const sa = JSON.parse(env.FCM_CUENTA), now = Math.floor(Date.now() / 1000);
  const head = b64u(enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64u(enc(JSON.stringify({ iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore' })));
  const der = unb64(sa.private_key.replace(/-----[^-]+-----|\s/g, '').replace(/\+/g, '-').replace(/\//g, '_'));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc(`${head}.${body}`)));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${head}.${body}.${sig}` });
  if (!r.ok) throw fail('No se pudo entrar a Firebase: ' + r.status, 502);
  const j = await r.json();
  admin = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return admin.token;
}

// ---------- quién pide el aviso (token de la cuenta de Firebase) ----------
let jwks = null;
async function userOf(req) {
  const [h, p, s] = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/, '').split('.');
  if (!s) throw fail('Sin cuenta', 401);
  const head = JSON.parse(new TextDecoder().decode(unb64(h))), pay = JSON.parse(new TextDecoder().decode(unb64(p)));
  if (!jwks || jwks.exp < Date.now()) {
    const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    jwks = { keys: (await r.json()).keys, exp: Date.now() + 3600e3 };
  }
  const jwk = jwks.keys.find(k => k.kid === head.kid);
  if (!jwk) throw fail('Cuenta no válida', 401);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64(s), enc(`${h}.${p}`));
  if (!ok || pay.aud !== PROYECTO || pay.iss !== `https://securetoken.google.com/${PROYECTO}` || pay.exp * 1000 < Date.now() || !pay.sub)
    throw fail('Cuenta no válida', 401);
  return pay.sub;
}

// ---------- Firestore (REST) ----------
const val = v => !v ? null : 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue : 'integerValue' in v ? +v.integerValue
  : 'doubleValue' in v ? v.doubleValue : 'arrayValue' in v ? (v.arrayValue.values || []).map(val) : 'mapValue' in v ? fields(v.mapValue.fields)
  : 'timestampValue' in v ? v.timestampValue : null;
const fields = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, val(v)]));
async function fsGet(tok, path) {
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: 'Bearer ' + tok } });
  if (r.status === 404) return null;
  if (!r.ok) throw fail('Firestore ' + r.status, 502);
  return fields((await r.json()).fields);
}
async function fsList(tok, path) {
  const out = [];
  let page = '';
  do {
    const r = await fetch(`${FS}/${path}?pageSize=300${page ? '&pageToken=' + page : ''}`, { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) throw fail('Firestore ' + r.status, 502);
    const j = await r.json();
    for (const d of j.documents || []) out.push({ id: d.name.split('/').pop(), ...fields(d.fields) });
    page = j.nextPageToken || '';
  } while (page);
  return out;
}
const isElder = m => m && (m.admin || (m.permisos || []).some(p => ELDER.includes(p)));
const active = list => list.filter(m => m.estado === 'activo');

// ---------- mandar ----------
// El plan gratis de Cloudflare deja 50 conexiones por petición: se manda por tandas de LOTE celulares y la app
// vuelve a pedir con "desde" hasta que "siguiente" sea null. Cada cuenta guarda a lo más 3 celulares.
const LOTE = 30;
// avisos: [{ uid, title, body, vista }] → a cada celular de esa cuenta
// Dos clases de celular por cuenta: "tokens" (web y APK de antes: aviso normal) y "nativos" (app nativa de Android,
// E:\ProgramasAndroid: aviso solo de datos, que la app muestra con el botón “✔ Recibido”).
async function deliver(tok, cong, avisos, desde = 0) {
  const devices = new Map((await fsList(tok, `congregaciones/${cong}/avisos`)).map(d => [d.id,
    [...(d.tokens || []).slice(-3).map(t => ({ t, field: 'tokens' })), ...(d.nativos || []).slice(-3).map(t => ({ t, field: 'nativos' }))]]));
  const all = avisos.flatMap(a => (devices.get(a.uid) || []).map(dv => ({ ...a, ...dv })));
  const part = all.slice(desde, desde + LOTE), stale = new Map();
  let enviados = 0;
  await Promise.all(part.map(async a => {
    const link = WEB + '?ir=' + encodeURIComponent(a.vista || 'inicio') + (a.confirmar ? '&confirmar=' + encodeURIComponent(a.confirmar) : '');
    const data = { vista: a.vista || 'inicio', link, confirmar: a.confirmar || '' };
    const message = a.field === 'nativos'
      ? { token: a.t, data: { ...data, title: a.title.slice(0, 120), body: (a.body || '').slice(0, 300) }, android: { priority: 'high' } }
      : { token: a.t, data,
        notification: { title: a.title.slice(0, 120), body: (a.body || '').slice(0, 300) },
        android: { priority: 'high', notification: { color: '#2563eb', sound: 'default' } },
        webpush: { fcm_options: { link }, notification: { icon: WEB + 'icon.png', badge: WEB + 'icon.png' } } };
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROYECTO}/messages:send`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    if (r.ok) enviados++;
    else if (r.status === 404 || r.status === 400) stale.set(a.uid, [...(stale.get(a.uid) || []), a.t]);
  }));
  // Celulares que ya no existen (app borrada, avisos apagados): se quitan para no intentar otra vez (pocos por tanda)
  const keep = (uid, field, gone) => (devices.get(uid) || []).filter(d => d.field === field && !gone.includes(d.t)).map(d => ({ stringValue: d.t }));
  await Promise.all([...stale].slice(0, 5).map(([uid, gone]) => fetch(`${FS}/congregaciones/${cong}/avisos/${uid}?updateMask.fieldPaths=tokens&updateMask.fieldPaths=nativos`, {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { tokens: { arrayValue: { values: keep(uid, 'tokens', gone) } }, nativos: { arrayValue: { values: keep(uid, 'nativos', gone) } } } }) })));
  const sinCelular = desde ? 0 : new Set(avisos.filter(a => !(devices.get(a.uid) || []).length).map(a => a.uid)).size;
  return { enviados, sinCelular, siguiente: desde + LOTE < all.length ? desde + LOTE : null };
}

export async function sendRequest(req, env) {
  const uid = await userOf(req);
  const { cong, tipo, id, lista, desde } = await req.json();
  return sendFor(uid, cong, tipo, id, lista, Math.max(0, Math.floor(+desde || 0)), env);
}
async function sendFor(uid, cong, tipo, id, lista, desde, env) {
  if (typeof cong !== 'string' || !/^[\w-]{1,64}$/.test(cong)) throw fail('Congregación no válida');
  const tok = await adminToken(env);
  const members = active(await fsList(tok, `congregaciones/${cong}/miembros`));
  const me = members.find(m => m.id === uid);
  if (!me) throw fail('No eres miembro activo de esta congregación', 403);
  if (tipo === 'prueba') return deliver(tok, cong, [{ uid, title: '🔔 Avisos activados', body: 'Así te llegarán tus asignaciones y los anuncios de la congregación.', vista: 'inicio' }], desde);
  if (tipo === 'anuncio') {
    if (!isElder(me)) throw fail('Solo los ancianos mandan anuncios', 403);
    if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) throw fail('Anuncio no válido');
    const a = await fsGet(tok, `congregaciones/${cong}/anuncios/${id}`);
    if (!a) throw fail('No existe ese anuncio', 404);
    const to = members.filter(m => m.id !== uid && (a.publico || isElder(m))).sort((x, y) => x.id.localeCompare(y.id));
    return deliver(tok, cong, to.map(m => ({ uid: m.id, title: '📢 ' + a.titulo, body: (a.texto || 'Nuevo anuncio de los ancianos').replace(/\s+/g, ' '), vista: 'anuncios' })), desde);
  }
  if (tipo === 'asignaciones') {
    if (!me.admin && !(me.permisos || []).includes('programa')) throw fail('Solo Programa VyM avisa asignaciones', 403);
    if (!Array.isArray(lista) || lista.length > 80) throw fail('Lista no válida');
    const out = [];
    for (const x of lista) {
      if (!x || typeof x.perfil !== 'string' || typeof x.texto !== 'string') continue;
      for (const m of members.filter(m => m.perfil === x.perfil))
        out.push({ uid: m.id, title: '📋 ' + String(x.titulo || 'Tienes una asignación').slice(0, 100), body: x.texto.slice(0, 300), vista: 'inicio' });
    }
    return deliver(tok, cong, out, desde);
  }
  throw fail('Tipo de aviso no válido');
}

// ---------- recordatorio del informe (cron) ----------
// Corre cada 10 minutos de 16:00 a 18:59 (hora UTC) los días 1 y 5. En cada vuelta avisa a 10 hermanos más
// (a lo más 30 celulares) y anota a quién ya se le avisó en avisosEstado/informe-AAAA-MM (solo lo usa este servicio).
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export async function reportReminder(env, now = new Date()) {
  const tok = await adminToken(env), d = new Date(now);
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  const mes = d.toISOString().slice(0, 7), nombre = MESES[d.getUTCMonth()], ronda = now.getUTCDate() === 1 ? 'a' : 'b';
  for (const c of await fsList(tok, 'congregaciones')) {
    if ((c.modo || 'todos') !== 'todos') continue; // si solo los encargados capturan, no se le pide a cada quien
    const statePath = `congregaciones/${c.id}/avisosEstado/informe-${mes}-${ronda}`;
    const done = new Set(((await fsGet(tok, statePath)) || {}).avisados || []);
    const members = active(await fsList(tok, `congregaciones/${c.id}/miembros`)).filter(m => m.perfil && !done.has(m.id));
    if (!members.length) continue;
    // Informes de ese mes (una sola consulta)
    const q = await fetch(`${FS}/congregaciones/${c.id}:runQuery`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'informes' }], where: { fieldFilter: { field: { fieldPath: 'mes' }, op: 'EQUAL', value: { stringValue: mes } } },
        select: { fields: [{ fieldPath: 'perfil' }] } } }) });
    const sent = new Set((await q.json()).filter(x => x.document).map(x => val((x.document.fields || {}).perfil)));
    const batch = members.filter(m => !sent.has(m.perfil)).slice(0, 10);
    const skip = members.filter(m => sent.has(m.perfil)).map(m => m.id); // ya lo mandaron: no hay que revisarlos otra vez
    if (batch.length) await deliver(tok, c.id, batch.map(m => ({ uid: m.id, title: `📝 Tu informe de ${nombre}`, body: 'Todavía no lo has enviado. Toca aquí para mandarlo.', vista: 'report' })));
    const avisados = [...done, ...skip, ...batch.map(m => m.id)];
    await fetch(`${FS}/${statePath}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { avisados: { arrayValue: { values: avisados.map(u => ({ stringValue: u })) } } } }) });
    return; // una congregación por vuelta: así no se pasa del límite de conexiones
  }
}

// ---------- recordatorio de cada asignación, un día antes (cron) ----------
// Corre cada 10 minutos de 01:00 a 01:59 UTC (18:00 a 18:59 en La Paz, BCS). Lee el programa publicado
// (publico/programa, el mismo que ven los hermanos) y avisa a quien tiene asignación mañana; 10 por vuelta.
// Cada aviso lleva la clave de la asignación para confirmarla al tocarlo (“✔ Recibido”).
const ZONA = 'America/Mazatlan';
const localDay = (date, plus = 0) => new Date(date.getTime() + plus * 864e5).toLocaleDateString('en-CA', { timeZone: ZONA }); // AAAA-MM-DD
const longDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
// Lo mismo que myAssignments (app/publicadores.js), pero para todos y solo de ese día
export function assignmentsOn(weeks, day) {
  const out = [];
  for (const w of weeks) {
    if ((w.day || w.date) === day) for (const r of w.rows || []) for (const k of ['a', 'b', 'xa', 'xb']) {
      if (!r[k] || !r[k].id) continue;
      const mate = r[{ a: 'b', b: 'a', xa: 'xb', xb: 'xa' }[k]];
      out.push({ perfil: r[k].id, key: r.id && `${w.id}|${r.id}|${k}`, title: r.t, when: `${w.meeting} · ${r.time}`,
        role: (r.labels || {})[k] || '', with: mate ? mate.n : '' });
    }
    if (w.fin && w.fin.oradorId && w.fin.day === day) out.push({ perfil: w.fin.oradorId, key: `${w.id}|fin|orador`,
      title: `Discurso público${w.fin.tema ? ': ' + w.fin.tema : ''}`, when: 'Reunión del fin de semana', role: '', with: '' });
    for (const m of w.mec || []) if (m.day === day) for (const it of m.items || []) if (it.id)
      out.push({ perfil: it.id, key: m.mtg && it.k && `${w.id}|mec|${m.mtg}|${it.k}`, title: it.l, when: m.label, role: 'Asignación mecánica', with: '' });
  }
  return out;
}
export async function assignmentReminder(env, now = new Date()) {
  const tok = await adminToken(env), day = localDay(now, 1);
  for (const c of await fsList(tok, 'congregaciones')) {
    const statePath = `congregaciones/${c.id}/avisosEstado/asignaciones-${day}`;
    const done = new Set(((await fsGet(tok, statePath)) || {}).avisados || []);
    const pub = await fsGet(tok, `congregaciones/${c.id}/publico/programa`);
    let weeks = [];
    try { weeks = JSON.parse((pub && pub.semanas) || '[]'); } catch (e) {}
    const list = assignmentsOn(weeks, day).filter(a => !done.has(`${a.perfil}|${a.key}`));
    if (!list.length) continue;
    const members = active(await fsList(tok, `congregaciones/${c.id}/miembros`)).filter(m => m.perfil);
    const batch = list.slice(0, 10);
    const avisos = batch.flatMap(a => members.filter(m => m.perfil === a.perfil).map(m => ({ uid: m.id, vista: 'inicio', confirmar: a.key || '',
      title: `⏰ Mañana: ${a.title}`.slice(0, 120),
      body: [`${longDay(day)} · ${a.when}`, a.role, a.with ? 'Con ' + a.with : ''].filter(Boolean).join('\n') })));
    if (avisos.length) await deliver(tok, c.id, avisos);
    await fetch(`${FS}/${statePath}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { avisados: { arrayValue: { values: [...done, ...batch.map(a => `${a.perfil}|${a.key}`)].map(u => ({ stringValue: u })) } } } }) });
    return; // una congregación por vuelta (límite de conexiones del plan gratis)
  }
}

// Revisión sin datos: ¿la llave de Cloudflare sirve para entrar a Firebase?
export async function health(env) { await adminToken(env); return 'ok'; }
