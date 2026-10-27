// Intermediario en Cloudflare Workers: la versión web no puede leer wol.jw.org directamente
// (jw.org no lo permite desde páginas de otros sitios), así que este servicio lo lee y se lo pasa.
// Hace lo mismo que main.js (programa de PC) y servidor.ps1:
//   /jw/ping                      → "ok"
//   /jw/semana?y=2026&w=43        → HTML de la Guía de actividades de esa semana ISO
//   /jw/titulo?path=/es/wol/d/…   → título de un documento (nombres de las canciones)
// Solo responde a la app (ORIGENES) y guarda las respuestas unas horas para no cargar a jw.org.
const ORIGENES = ['https://becker9824.github.io', 'app://programas', 'http://localhost:8765'];
const HORAS = 6;

const decodeHtml = s => s
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e]));

async function wol(path) {
  const r = await fetch('https://wol.jw.org' + path, { headers: { 'User-Agent': 'Mozilla/5.0 (Programas congregacion)' }, cf: { cacheTtl: HORAS * 3600 } });
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  return r.text();
}

async function answer(url) {
  const q = url.searchParams;
  if (url.pathname === '/jw/ping') return ['ok', 200, 'text/plain'];
  if (url.pathname === '/jw/semana') {
    const y = Number(q.get('y')), w = Number(q.get('w'));
    if (!Number.isInteger(y) || !Number.isInteger(w) || y < 2020 || y > 2100 || w < 1 || w > 53) return ['Semana no valida', 400, 'text/plain'];
    const week = await wol(`/es/wol/meetings/r4/lp-s/${y}/${w}`);
    const m = week.match(/href="(\/es\/wol\/d\/r4\/lp-s\/\d+)"\s+class="[^"]*pub-mwb/);
    if (!m) return ['Sin guia para esta semana', 404, 'text/plain'];
    return [await wol(m[1]), 200, 'text/html; charset=utf-8'];
  }
  if (url.pathname === '/jw/titulo') {
    const p = q.get('path') || '';
    if (!/^\/es\/wol\/(d|pc)\/r4\/lp-s\/[0-9/]+$/.test(p)) return ['Ruta no valida', 400, 'text/plain'];
    const t = ((await wol(p)).match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    return [decodeHtml(t.split('&mdash;')[0]).trim(), 200, 'text/plain; charset=utf-8'];
  }
  return ['No encontrado', 404, 'text/plain'];
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), origin = req.headers.get('Origin') || '';
    const cors = ORIGENES.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' } });
    if (req.method !== 'GET') return new Response('Solo GET', { status: 405, headers: cors });
    if (!cors['Access-Control-Allow-Origin'] && origin) return new Response('Origen no permitido', { status: 403 });
    // Respuestas guardadas unas horas (la misma semana la piden varios hermanos)
    const cache = caches.default, key = new Request(url.toString());
    const hit = await cache.match(key);
    if (hit) { const r = new Response(hit.body, hit); Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v)); return r; }
    let body, status, type;
    try { [body, status, type] = await answer(url); }
    catch (e) { [body, status, type] = ['Error: ' + e.message, e.status === 404 ? 404 : 502, 'text/plain']; }
    const res = new Response(body, { status, headers: { 'Content-Type': type, 'Cache-Control': `public, max-age=${HORAS * 3600}` } });
    if (status === 200 && url.pathname !== '/jw/ping') ctx.waitUntil(cache.put(key, res.clone()));
    Object.entries(cors).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  },
};
