// Pruebas de las reglas de seguridad (npm run prueba-reglas: arranca Firebase local y las corre).
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, getDocs, query, where } from 'firebase/firestore';

let env;
const C = 'cong1', CODE = 'ABC234';
const db = uid => env.authenticatedContext(uid).firestore();
const memberData = (extra = {}) => ({ nombre: 'X', email: 'x@x.com', estado: 'pendiente', admin: false, permisos: [], perfil: null, codigo: CODE, creado: 1, ...extra });
const informe = (perfil, por, extra = {}) => ({ perfil, nombre: 'X', mes: '2026-10', participo: true, horas: null, cursos: 0, notas: '', enviado: 1, por, ...extra });
const cdoc = (d, ...p) => doc(d, 'congregaciones', C, ...p);

before(async () => {
  // Proyecto distinto al de la app local (demo-programas) para no borrar sus datos
  env = await initializeTestEnvironment({ projectId: 'demo-reglas', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(() => env.cleanup());

// Cuentas: admin (coordinador), prog (programa), secre (secretario), pub (sin funciones), otro (de fuera)
test('el creador arma su congregación y entra como coordinador', async () => {
  await env.clearFirestore();
  const a = db('admin');
  await assertSucceeds(setDoc(cdoc(a), { nombre: 'Centro', codigo: CODE, creador: 'admin', modo: 'todos' }));
  await assertSucceeds(setDoc(doc(a, 'codigos', CODE), { cong: C }));
  await assertSucceeds(setDoc(cdoc(a, 'miembros', 'admin'), memberData({ estado: 'activo', admin: true })));
  await assertSucceeds(setDoc(cdoc(a, 'perfiles', 'p1'), { name: 'Pub' }));
  await assertSucceeds(setDoc(cdoc(a, 'semanas', 's1'), { title: 'Semana' }));
  await assertSucceeds(setDoc(cdoc(a, 'config', 'ajustes'), { meetingDay: 2 }));
  await assertSucceeds(setDoc(cdoc(a, 'publico', 'programa'), { semanas: '[]' }));
  await assertSucceeds(setDoc(doc(a, 'usuarios', 'admin'), { cong: C }));
  await assertSucceeds(getDoc(doc(a, 'usuarios', 'admin')));
  await assertFails(getDoc(doc(db('otro'), 'usuarios', 'admin')));
  await assertFails(setDoc(doc(a, 'usuarios', 'admin'), { cong: C, admin: true }));
});

test('quien se registra queda pendiente, sin funciones y sin ver nada', async () => {
  for (const u of ['prog', 'secre', 'pub']) {
    const d = db(u);
    await assertFails(setDoc(cdoc(d, 'miembros', u), memberData({ admin: true, estado: 'activo' })));
    await assertFails(setDoc(cdoc(d, 'miembros', u), memberData({ permisos: ['programa'] })));
    await assertFails(setDoc(cdoc(d, 'miembros', u), memberData({ codigo: 'MALO99' })));
    await assertSucceeds(setDoc(cdoc(d, 'miembros', u), memberData()));
  }
  const p = db('pub');
  await assertSucceeds(getDoc(cdoc(p, 'miembros', 'pub')));
  await assertFails(updateDoc(cdoc(p, 'miembros', 'pub'), { estado: 'activo' }));
  await assertFails(getDoc(cdoc(p, 'publico', 'programa')));
  await assertFails(getDoc(cdoc(p, 'perfiles', 'p1')));
});

test('el coordinador aprueba y da funciones; nadie más puede', async () => {
  const a = db('admin');
  await assertSucceeds(updateDoc(cdoc(a, 'miembros', 'prog'), { estado: 'activo', permisos: ['programa'] }));
  await assertSucceeds(updateDoc(cdoc(a, 'miembros', 'secre'), { estado: 'activo', permisos: ['secretario'], perfil: 'p2' }));
  await assertSucceeds(updateDoc(cdoc(a, 'miembros', 'pub'), { estado: 'activo', perfil: 'p1' }));
  await assertFails(updateDoc(cdoc(a, 'miembros', 'pub'), { permisos: ['inventado'] }));
  await assertFails(updateDoc(cdoc(db('prog'), 'miembros', 'prog'), { permisos: ['programa', 'secretario'] }));
  await assertFails(updateDoc(cdoc(db('prog'), 'miembros', 'pub'), { estado: 'pendiente' }));
  await assertFails(getDocs(collection(db('prog'), 'congregaciones', C, 'miembros')));
  await assertFails(getDoc(cdoc(db('secre'), 'miembros', 'admin')));
});

test('programa: edita semanas y perfiles, pero no informes ni usuarios', async () => {
  const g = db('prog');
  await assertSucceeds(setDoc(cdoc(g, 'semanas', 's2'), { title: 'Otra' }));
  await assertSucceeds(setDoc(cdoc(g, 'perfiles', 'p3'), { name: 'Nuevo' }));
  await assertSucceeds(setDoc(cdoc(g, 'familias', 'f1'), { name: 'Familia' }));
  await assertSucceeds(setDoc(cdoc(g, 'config', 'ajustes'), { meetingDay: 3 }));
  await assertSucceeds(setDoc(cdoc(g, 'publico', 'programa'), { semanas: '[]' }));
  await assertFails(getDocs(collection(g, 'congregaciones', C, 'informes')));
  await assertFails(getDoc(cdoc(g, 'privado', 'estado')));
  await assertFails(updateDoc(cdoc(g), { modo: 'encargados' }));
});

test('publicador: ve el programa, no los datos; envía solo su informe', async () => {
  const p = db('pub');
  await assertSucceeds(getDoc(cdoc(p, 'publico', 'programa')));
  await assertSucceeds(getDoc(cdoc(p)));
  for (const col of ['perfiles', 'semanas', 'familias', 'config']) await assertFails(getDocs(collection(p, 'congregaciones', C, col)));
  await assertFails(setDoc(cdoc(p, 'publico', 'programa'), { semanas: '[]' }));
  const mine = cdoc(p, 'informes', 'p1_2026-10');
  await assertSucceeds(getDoc(mine)); // todavía no existe: se puede revisar
  await assertSucceeds(setDoc(mine, informe('p1', 'pub', { horas: 12.5, cursos: 2, notas: 'Bien' })));
  await assertFails(setDoc(mine, informe('p1', 'otro')));
  await assertFails(setDoc(mine, informe('p1', 'pub', { cursos: -1 })));
  await assertFails(setDoc(mine, informe('p1', 'pub', { extra: 1 })));
  await assertSucceeds(setDoc(mine, informe('p1', 'pub', { grupo: 'aux', horas: 30 })));
  await assertFails(setDoc(mine, informe('p1', 'pub', { grupo: 'especial' })));
  await assertFails(setDoc(cdoc(p, 'informes', 'p2_2026-10'), informe('p2', 'pub')));
  await assertFails(getDoc(cdoc(p, 'informes', 'p2_2026-10')));
  await assertSucceeds(getDocs(query(collection(p, 'congregaciones', C, 'informes'), where('perfil', '==', 'p1'))));
  await assertFails(getDocs(collection(p, 'congregaciones', C, 'informes')));
});

test('secretario: ve y captura los informes de todos, lee perfiles pero no los cambia', async () => {
  const s = db('secre');
  await assertSucceeds(getDocs(collection(s, 'congregaciones', C, 'informes')));
  await assertSucceeds(setDoc(cdoc(s, 'informes', 'p3_2026-10'), informe('p3', 'secre')));
  await assertSucceeds(setDoc(cdoc(s, 'informes', 'p1_2026-10'), informe('p1', 'secre', { horas: 10 })));
  await assertSucceeds(getDocs(collection(s, 'congregaciones', C, 'perfiles')));
  await assertFails(setDoc(cdoc(s, 'perfiles', 'p1'), { name: 'Cambiado' }));
  // Ve las semanas y los ajustes (reunión del fin de semana), pero no los cambia
  await assertSucceeds(getDocs(collection(s, 'congregaciones', C, 'semanas')));
  await assertSucceeds(getDoc(cdoc(s, 'config', 'ajustes')));
  await assertFails(setDoc(cdoc(s, 'semanas', 's1'), { title: 'Cambiada' }));
  await assertFails(setDoc(cdoc(s, 'config', 'ajustes'), { meetingDay: 3 }));
  await assertSucceeds(deleteDoc(cdoc(s, 'informes', 'p3_2026-10')));
});

test('si la congregación elige "solo encargados", el publicador ya no envía informes', async () => {
  await assertSucceeds(updateDoc(cdoc(db('admin')), { modo: 'encargados' }));
  await assertFails(setDoc(cdoc(db('pub'), 'informes', 'p1_2026-11'), informe('p1', 'pub', { mes: '2026-11' })));
  await assertFails(deleteDoc(cdoc(db('pub'), 'informes', 'p1_2026-10')));          // tampoco lo borra
  await assertSucceeds(setDoc(cdoc(db('secre'), 'informes', 'p1_2026-11'), informe('p1', 'secre', { mes: '2026-11' })));
  await assertFails(updateDoc(cdoc(db('admin')), { modo: 'cualquiera' }));
  await assertSucceeds(updateDoc(cdoc(db('admin')), { modo: 'todos' }));
  // Restablecer: cada quien borra el suyo, no el de otro
  await assertFails(deleteDoc(cdoc(db('pub'), 'informes', 'p2_2026-10')));
  await assertSucceeds(deleteDoc(cdoc(db('pub'), 'informes', 'p1_2026-10')));
});

test('anuncios: los publica cualquier anciano; los publicadores solo ven los compartidos', async () => {
  const anuncio = (autor, extra) => ({ titulo: 'Asamblea', texto: 'Recuerden…', fijado: false, vence: null, autor, autorNombre: 'X', fecha: 1, ...extra });
  await assertSucceeds(setDoc(cdoc(db('prog'), 'anuncios', 'a1'), anuncio('prog', { publico: true, tipo: 'asamblea', cuando: '2026-12-05' })));
  await assertSucceeds(setDoc(cdoc(db('secre'), 'anuncios', 'a2'), anuncio('secre', { publico: false })));
  await assertFails(setDoc(cdoc(db('pub'), 'anuncios', 'a3'), anuncio('pub')));
  await assertFails(setDoc(cdoc(db('prog'), 'anuncios', 'a4'), { ...anuncio('prog'), titulo: '' }));
  await assertFails(setDoc(cdoc(db('prog'), 'anuncios', 'a4'), { ...anuncio('prog'), vence: 'mañana' }));
  await assertFails(setDoc(cdoc(db('prog'), 'anuncios', 'a4'), anuncio('prog', { tipo: 'chisme' })));
  await assertFails(setDoc(cdoc(db('prog'), 'anuncios', 'a4'), anuncio('prog', { cuando: 'pronto' })));
  await assertSucceeds(getDoc(cdoc(db('pub'), 'anuncios', 'a1')));
  await assertFails(getDoc(cdoc(db('pub'), 'anuncios', 'a2')));                  // solo para ancianos
  await assertSucceeds(getDoc(cdoc(db('prog'), 'anuncios', 'a2')));
  await assertFails(getDocs(collection(db('pub'), 'congregaciones', C, 'anuncios')));
  await assertSucceeds(getDocs(query(collection(db('pub'), 'congregaciones', C, 'anuncios'), where('publico', '==', true))));
  await assertFails(getDoc(cdoc(db('otro'), 'anuncios', 'a1')));
  await assertFails(deleteDoc(cdoc(db('pub'), 'anuncios', 'a1')));
  await assertSucceeds(deleteDoc(cdoc(db('secre'), 'anuncios', 'a1')));
});

test('predicación pública: los ancianos arman turnos y cada quien se apunta solo a sí mismo', async () => {
  const turno = { fecha: '2026-12-05', hora: '10:00', horaFin: '12:00', lugar: 'Plaza', cupo: 2, inscritos: {}, notas: '' };
  await assertSucceeds(setDoc(cdoc(db('prog'), 'publica', 't1'), turno));
  await assertFails(setDoc(cdoc(db('pub'), 'publica', 't2'), turno));
  await assertFails(setDoc(cdoc(db('prog'), 'publica', 't3'), { ...turno, cupo: 50 }));
  await assertSucceeds(getDoc(cdoc(db('pub'), 'publica', 't1')));
  await assertSucceeds(updateDoc(cdoc(db('pub'), 'publica', 't1'), { 'inscritos.p1': 'Pub' }));       // se apunta
  await assertFails(updateDoc(cdoc(db('pub'), 'publica', 't1'), { 'inscritos.p9': 'Otro' }));       // no apunta a otro
  await assertFails(updateDoc(cdoc(db('pub'), 'publica', 't1'), { lugar: 'Otro lugar' }));           // no cambia el turno
  await assertSucceeds(updateDoc(cdoc(db('prog'), 'publica', 't1'), { 'inscritos.p7': 'Siete' }));   // un anciano sí
  await assertFails(updateDoc(cdoc(db('secre'), 'publica', 't1'), { 'inscritos.p8': 'Ocho' }));     // ya no cabe (cupo 2)
  await assertSucceeds(updateDoc(cdoc(db('pub'), 'publica', 't1'), { 'inscritos.p1': deleteField() })); // se quita
  await assertFails(deleteDoc(cdoc(db('pub'), 'publica', 't1')));
});

test('pastoreo: solo los ancianos lo ven y lo anotan', async () => {
  const visita = uid => ({ perfil: 'p1', fecha: '2026-11-01', quien: 'Hnos. X y Y', notas: '', por: uid });
  await assertSucceeds(setDoc(cdoc(db('secre'), 'pastoreo', 'v1'), visita('secre')));
  await assertFails(setDoc(cdoc(db('secre'), 'pastoreo', 'v2'), visita('prog')));   // "por" es quien lo anota
  await assertFails(setDoc(cdoc(db('pub'), 'pastoreo', 'v3'), visita('pub')));
  await assertFails(getDoc(cdoc(db('pub'), 'pastoreo', 'v1')));
  await assertSucceeds(getDoc(cdoc(db('prog'), 'pastoreo', 'v1')));
});

test('directorio: lo ven los ancianos (cualquier función), no los publicadores', async () => {
  const contacto = { tel: '555 123 4567', dir: 'Calle 1', emergencia: 'Mamá', emergenciaTel: '555 000 0000' };
  await assertSucceeds(setDoc(cdoc(db('prog'), 'contactos', 'p1'), contacto));
  await assertSucceeds(getDoc(cdoc(db('secre'), 'contactos', 'p1')));
  await assertSucceeds(getDoc(cdoc(db('admin'), 'contactos', 'p1')));
  await assertFails(getDoc(cdoc(db('pub'), 'contactos', 'p1')));
  await assertFails(getDocs(collection(db('pub'), 'congregaciones', C, 'contactos')));
  await assertFails(setDoc(cdoc(db('pub'), 'contactos', 'p2'), contacto));
  await assertFails(setDoc(cdoc(db('prog'), 'contactos', 'p2'), { ...contacto, notas: 'x' }));
  // Con la función "Anciano" sola también puede; sin funciones, ya no
  await assertSucceeds(updateDoc(cdoc(db('admin'), 'miembros', 'pub'), { permisos: ['ancianos'] }));
  await assertSucceeds(getDoc(cdoc(db('pub'), 'contactos', 'p1')));
  await assertSucceeds(getDocs(collection(db('pub'), 'congregaciones', C, 'perfiles')));
  await assertFails(setDoc(cdoc(db('pub'), 'perfiles', 'p1'), { name: 'Cambiado' }));
  await assertSucceeds(updateDoc(cdoc(db('admin'), 'miembros', 'pub'), { permisos: [] }));
  await assertFails(getDoc(cdoc(db('pub'), 'contactos', 'p1')));
});

test('cuentas: solo la función "Cuentas" y el coordinador', async () => {
  await assertSucceeds(updateDoc(cdoc(db('admin'), 'miembros', 'pub'), { permisos: ['cuentas'] }));
  const mov = por => ({ fecha: '2026-10-05', tipo: 'entrada', categoria: 'donacion_cong', descripcion: 'Caja de contribuciones', monto: 1250.5, fondo: 'caja', por, creado: 1 });
  await assertSucceeds(setDoc(cdoc(db('pub'), 'cuentas', 'm1'), mov('pub')));
  await assertSucceeds(setDoc(cdoc(db('pub'), 'cuentasConfig', 'inicial'), { fecha: '2026-10-01', caja: 100, banco: 5000 }));
  await assertSucceeds(getDocs(collection(db('admin'), 'congregaciones', C, 'cuentas')));
  await assertFails(getDocs(collection(db('secre'), 'congregaciones', C, 'cuentas')));
  await assertFails(getDoc(cdoc(db('prog'), 'cuentasConfig', 'inicial')));
  await assertFails(setDoc(cdoc(db('secre'), 'cuentas', 'm2'), mov('secre')));
  await assertFails(setDoc(cdoc(db('pub'), 'cuentas', 'm2'), { ...mov('pub'), monto: -5 }));
  await assertFails(setDoc(cdoc(db('pub'), 'cuentas', 'm2'), { ...mov('pub'), fondo: 'bolsillo' }));
  await assertFails(setDoc(cdoc(db('pub'), 'cuentas', 'm2'), { ...mov('pub'), por: 'otro' }));
  await assertFails(getDoc(cdoc(db('pub'), 'contactos', 'p1'))); // "Cuentas" no da el directorio
  await assertSucceeds(updateDoc(cdoc(db('admin'), 'miembros', 'pub'), { permisos: [] }));
  await assertFails(getDoc(cdoc(db('pub'), 'cuentas', 'm1')));
});

test('territorios: los ve cualquier miembro, los cambia la función "Territorios"', async () => {
  await assertSucceeds(updateDoc(cdoc(db('admin'), 'miembros', 'pub'), { permisos: ['territorios'] }));
  const terr = { numero: '12', nombre: 'Centro', notas: '', coords: '[[19.43,-99.13],[19.44,-99.13],[19.44,-99.12]]', estado: 'disponible', asignadoA: '', desde: null, historial: [] };
  await assertSucceeds(setDoc(cdoc(db('pub'), 'territorios', 't1'), terr));
  await assertSucceeds(updateDoc(cdoc(db('pub'), 'territorios', 't1'), { estado: 'asignado', asignadoA: 'Grupo 2', desde: '2026-10-24' }));
  await assertSucceeds(getDoc(cdoc(db('secre'), 'territorios', 't1')));
  await assertFails(updateDoc(cdoc(db('secre'), 'territorios', 't1'), { estado: 'terminado' }));
  await assertFails(setDoc(cdoc(db('pub'), 'territorios', 't2'), { ...terr, estado: 'perdido' }));
  await assertFails(setDoc(cdoc(db('pub'), 'territorios', 't2'), { ...terr, numero: '' }));
  await assertFails(getDoc(cdoc(db('pub'), 'cuentas', 'm1'))); // "Territorios" no da las cuentas
  await assertFails(getDoc(cdoc(db('otro'), 'territorios', 't1')));
  await assertSucceeds(updateDoc(cdoc(db('admin'), 'miembros', 'pub'), { permisos: [] }));
  await assertSucceeds(getDoc(cdoc(db('pub'), 'territorios', 't1')));
  await assertFails(deleteDoc(cdoc(db('pub'), 'territorios', 't1')));
});

test('capitán: registra solo en el territorio que se le asignó; el siervo ve y corrige', async () => {
  const a = db('admin');
  await assertSucceeds(updateDoc(cdoc(a, 'miembros', 'pub'), { permisos: ['capitan'] }));
  await assertSucceeds(setDoc(cdoc(a, 'capitanes', 'lista'), { lista: [{ uid: 'pub', nombre: 'Pub' }] }));
  await assertFails(setDoc(cdoc(db('pub'), 'capitanes', 'lista'), { lista: [] }));
  await assertSucceeds(setDoc(cdoc(db('prog'), 'capitanes', 'hermanos'), { lista: [{ perfil: 'p1', nombre: 'Pub' }] }));
  await assertFails(setDoc(cdoc(db('prog'), 'capitanes', 'lista'), { lista: [] }));
  await assertFails(setDoc(cdoc(db('pub'), 'capitanes', 'hermanos'), { lista: [] }));
  const terr = { numero: '20', territorio: '3', nombre: 'Norte', tarjeta: '20-A', notas: '', coords: '[]', estado: 'asignado', asignadoA: 'Pub', capitan: 'pub', desde: '2026-10-01',
    historial: [], veces: 0, trabajadas: '', avance: '', noPredicar: '' };
  await assertSucceeds(setDoc(cdoc(a, 'territorios', 't20'), terr));
  await assertSucceeds(setDoc(cdoc(a, 'territorios', 't21'), { ...terr, numero: '21', capitan: 'otro' }));
  const p = db('pub');
  const work = (t, extra = {}) => ({ territorio: t, numero: '20', fecha: '2026-10-20', completo: false, calles: '[]', avance: '', notas: 'Hasta la esquina', por: 'pub', porNombre: 'Pub', capitan: 'Pub', ...extra });
  await assertSucceeds(setDoc(cdoc(p, 'trabajos', 'w1'), work('t20')));
  await assertFails(setDoc(cdoc(p, 'trabajos', 'w2'), work('t21')));
  await assertFails(setDoc(cdoc(p, 'trabajos', 'w3'), work('t20', { por: 'otro' })));
  await assertSucceeds(updateDoc(cdoc(p, 'territorios', 't20'), { trabajadas: '[[[19.4,-99.1],[19.41,-99.1]]]', avance: '{"n":"esquina"}', noPredicar: '[{"p":[19.4,-99.1],"n":""}]' }));
  await assertFails(updateDoc(cdoc(p, 'territorios', 't20'), { numero: '99' }));
  await assertFails(updateDoc(cdoc(p, 'territorios', 't20'), { calles: '[[[19.4,-99.1],[19.41,-99.1]]]' })); // la forma solo la cambia el siervo
  await assertSucceeds(updateDoc(cdoc(a, 'territorios', 't21'), { calles: '[[[19.4,-99.1],[19.41,-99.1]]]', coords: '[]' }));
  await assertFails(updateDoc(cdoc(p, 'territorios', 't20'), { capitan: 'otro' }));
  await assertFails(updateDoc(cdoc(p, 'territorios', 't21'), { avance: '{}' }));
  await assertSucceeds(updateDoc(cdoc(p, 'territorios', 't20'), { estado: 'disponible', asignadoA: '', capitan: '', veces: 1, trabajadas: '', avance: '' }));
  await assertFails(updateDoc(cdoc(p, 'territorios', 't20'), { trabajadas: '[]' })); // ya no es suyo
  await assertSucceeds(getDocs(collection(p, 'congregaciones', C, 'trabajos')));
  await assertFails(deleteDoc(cdoc(p, 'trabajos', 'w1')));
  await assertFails(getDocs(collection(db('secre'), 'congregaciones', C, 'trabajos')));
  await assertSucceeds(updateDoc(cdoc(a, 'miembros', 'secre'), { permisos: ['secretario', 'territorios'] }));
  await assertSucceeds(updateDoc(cdoc(db('secre'), 'trabajos', 'w1'), { notas: 'Corregido' }));
  await assertSucceeds(deleteDoc(cdoc(db('secre'), 'trabajos', 'w1')));
  await assertSucceeds(updateDoc(cdoc(a, 'miembros', 'secre'), { permisos: ['secretario'] }));
  await assertSucceeds(updateDoc(cdoc(a, 'miembros', 'pub'), { permisos: [] }));
});

test('grupos: los arma el secretario, los ven los ancianos; la función Capitán existe', async () => {
  const g = { nombre: 'Grupo 1', superintendente: 'p2', auxiliar: null, miembros: ['p1', 'p2'] };
  await assertSucceeds(setDoc(cdoc(db('secre'), 'grupos', 'g1'), g));
  await assertSucceeds(getDoc(cdoc(db('prog'), 'grupos', 'g1')));
  await assertFails(setDoc(cdoc(db('prog'), 'grupos', 'g2'), g));
  await assertFails(setDoc(cdoc(db('secre'), 'grupos', 'g2'), { ...g, nombre: '' }));
  await assertFails(setDoc(cdoc(db('secre'), 'grupos', 'g2'), { ...g, extra: 1 }));
  await assertFails(getDoc(cdoc(db('pub'), 'grupos', 'g1')));
  await assertSucceeds(updateDoc(cdoc(db('admin'), 'miembros', 'pub'), { permisos: ['capitan'] }));
  await assertSucceeds(updateDoc(cdoc(db('admin'), 'miembros', 'pub'), { permisos: [] }));
  await assertSucceeds(deleteDoc(cdoc(db('secre'), 'grupos', 'g1')));
});

test('asistencia: la anotan y la ven los ancianos, no los publicadores', async () => {
  const a = { entre: { '2026-10-07': 85, '2026-10-14': 90 }, fin: { '2026-10-11': 110 } };
  await assertSucceeds(setDoc(cdoc(db('secre'), 'asistencia', '2026-10'), a));
  await assertSucceeds(getDoc(cdoc(db('prog'), 'asistencia', '2026-10')));
  await assertFails(setDoc(cdoc(db('secre'), 'asistencia', 'octubre'), a));
  await assertFails(setDoc(cdoc(db('secre'), 'asistencia', '2026-11'), { ...a, extra: 1 }));
  await assertFails(getDoc(cdoc(db('pub'), 'asistencia', '2026-10')));
  await assertFails(setDoc(cdoc(db('pub'), 'asistencia', '2026-10'), a));
});

test('calendario, salidas, limpieza e historial', async () => {
  const ev = { tipo: 'visita', titulo: '', desde: '2026-11-10', hasta: '2026-11-15', notas: '' };
  await assertSucceeds(setDoc(cdoc(db('secre'), 'eventos', 'e1'), ev));
  await assertSucceeds(getDoc(cdoc(db('pub'), 'eventos', 'e1')));
  await assertFails(setDoc(cdoc(db('pub'), 'eventos', 'e2'), ev));
  await assertFails(setDoc(cdoc(db('secre'), 'eventos', 'e2'), { ...ev, tipo: 'fiesta' }));
  const sal = { dia: 5, hora: '09:30', lugar: 'Salón del Reino', dirige: 'Pub', grupo: '', notas: '' };
  await assertSucceeds(setDoc(cdoc(db('prog'), 'salidas', 's1'), sal));
  await assertSucceeds(getDoc(cdoc(db('pub'), 'salidas', 's1')));
  await assertFails(setDoc(cdoc(db('pub'), 'salidas', 's2'), sal));
  await assertFails(setDoc(cdoc(db('prog'), 'salidas', 's2'), { ...sal, dia: 9 }));
  await assertSucceeds(setDoc(cdoc(db('secre'), 'arreglos', 'limpieza'), { semanas: { '2026-11-02': 'Grupo 1' } }));
  await assertSucceeds(getDoc(cdoc(db('pub'), 'arreglos', 'limpieza')));
  await assertFails(setDoc(cdoc(db('pub'), 'arreglos', 'limpieza'), { semanas: {} }));
  await assertFails(setDoc(cdoc(db('secre'), 'arreglos', 'otro'), { semanas: {} }));
  await assertSucceeds(setDoc(cdoc(db('pub'), 'historial', 'h1'), { fecha: 1, por: 'pub', porNombre: 'Pub', cambios: ['Algo'] }));
  await assertFails(setDoc(cdoc(db('pub'), 'historial', 'h2'), { fecha: 1, por: 'otro', porNombre: 'X', cambios: [] }));
  await assertFails(getDoc(cdoc(db('pub'), 'historial', 'h1')));
  await assertSucceeds(getDoc(cdoc(db('secre'), 'historial', 'h1')));
  await assertFails(updateDoc(cdoc(db('secre'), 'historial', 'h1'), { cambios: [] }));
  await assertFails(deleteDoc(cdoc(db('secre'), 'historial', 'h1')));
  await assertSucceeds(deleteDoc(cdoc(db('admin'), 'historial', 'h1')));
});

test('ausencias: cada quien la suya; programa y secretario las de todos', async () => {
  const aus = (por, extra = {}) => ({ desde: '2026-11-01', hasta: '2026-11-20', nota: 'De viaje', por, ...extra });
  await assertSucceeds(setDoc(cdoc(db('pub'), 'ausencias', 'p1'), aus('pub')));          // pub es el perfil p1
  await assertSucceeds(getDoc(cdoc(db('pub'), 'ausencias', 'p1')));
  await assertFails(setDoc(cdoc(db('pub'), 'ausencias', 'p2'), aus('pub')));             // la de otro, no
  await assertFails(getDoc(cdoc(db('pub'), 'ausencias', 'p2')));
  await assertFails(getDocs(collection(db('pub'), 'congregaciones', C, 'ausencias')));
  await assertFails(setDoc(cdoc(db('pub'), 'ausencias', 'p1'), aus('pub', { hasta: '2026-10-01' })));
  await assertFails(setDoc(cdoc(db('pub'), 'ausencias', 'p1'), aus('otro')));
  await assertFails(setDoc(cdoc(db('pub'), 'ausencias', 'p1'), aus('pub', { extra: 1 })));
  await assertSucceeds(setDoc(cdoc(db('prog'), 'ausencias', 'p3'), aus('prog')));
  await assertSucceeds(setDoc(cdoc(db('secre'), 'ausencias', 'p4'), aus('secre')));
  await assertSucceeds(getDocs(collection(db('prog'), 'congregaciones', C, 'ausencias')));
  await assertFails(getDoc(cdoc(db('otro'), 'ausencias', 'p1')));
  await assertSucceeds(deleteDoc(cdoc(db('pub'), 'ausencias', 'p1')));
  await assertSucceeds(deleteDoc(cdoc(db('secre'), 'ausencias', 'p3')));
});

test('precursores: el secretario marca regular o auxiliar y sus meses, nada más', async () => {
  await assertSucceeds(updateDoc(cdoc(db('secre'), 'perfiles', 'p1'), { tipo: 'aux', auxMeses: ['2026-11', '2026-12'] }));
  await assertSucceeds(updateDoc(cdoc(db('secre'), 'perfiles', 'p1'), { tipo: 'reg', auxMeses: [] }));
  await assertFails(updateDoc(cdoc(db('secre'), 'perfiles', 'p1'), { name: 'Otro' }));
  await assertFails(updateDoc(cdoc(db('secre'), 'perfiles', 'p1'), { tipo: 'inventado' }));
  await assertFails(updateDoc(cdoc(db('pub'), 'perfiles', 'p1'), { tipo: 'aux' }));
  await assertSucceeds(setDoc(cdoc(db('secre'), 'publico', 'precursores'), { reg: ['p1'], aux: {} }));
  await assertFails(setDoc(cdoc(db('secre'), 'publico', 'programa'), { semanas: '[]' }));
  await assertSucceeds(getDoc(cdoc(db('pub'), 'publico', 'precursores')));
  await assertFails(setDoc(cdoc(db('pub'), 'publico', 'precursores'), { reg: [], aux: {} }));
});

test('confirmaciones: cada quien las suyas; Programa VyM las ve', async () => {
  const lista = { 's1|r1|a': '2026-11-02' };
  await assertSucceeds(setDoc(cdoc(db('pub'), 'confirmaciones', 'p1'), { lista }));
  await assertFails(setDoc(cdoc(db('pub'), 'confirmaciones', 'p2'), { lista }));
  await assertFails(setDoc(cdoc(db('pub'), 'confirmaciones', 'p1'), { lista, extra: 1 }));
  await assertFails(getDocs(collection(db('pub'), 'congregaciones', C, 'confirmaciones')));
  await assertSucceeds(getDocs(collection(db('prog'), 'congregaciones', C, 'confirmaciones')));
  await assertFails(setDoc(cdoc(db('prog'), 'confirmaciones', 'p1'), { lista }));
  await assertFails(getDoc(cdoc(db('secre'), 'confirmaciones', 'p1')));
});

test('sesiones: cada quien las suyas; el coordinador puede pedir cerrarlas', async () => {
  const ses = (uid, extra = {}) => ({ uid, nombre: 'X', equipo: 'Chrome en Windows (web)', visto: 1, ...extra });
  await assertSucceeds(setDoc(cdoc(db('pub'), 'sesiones', 'pub_abc1'), ses('pub')));
  await assertSucceeds(setDoc(cdoc(db('pub'), 'sesiones', 'pub_xyz2'), ses('pub')));
  await assertFails(setDoc(cdoc(db('pub'), 'sesiones', 'prog_abc1'), ses('pub')));          // id de otro
  await assertFails(setDoc(cdoc(db('pub'), 'sesiones', 'pub_abc3'), ses('prog')));          // a nombre de otro
  await assertFails(setDoc(cdoc(db('pub'), 'sesiones', 'pub_abc4'), ses('pub', { admin: true })));
  await assertSucceeds(getDoc(cdoc(db('pub'), 'sesiones', 'pub_nueva')));                    // la suya aunque no exista
  await assertSucceeds(getDocs(query(collection(db('pub'), 'congregaciones', C, 'sesiones'), where('uid', '==', 'pub'))));
  await assertFails(getDocs(collection(db('pub'), 'congregaciones', C, 'sesiones')));
  await assertSucceeds(updateDoc(cdoc(db('pub'), 'sesiones', 'pub_xyz2'), { cerrar: true }));  // desde otro equipo suyo
  await assertFails(updateDoc(cdoc(db('prog'), 'sesiones', 'pub_abc1'), { cerrar: true }));
  await assertFails(updateDoc(cdoc(db('admin'), 'sesiones', 'pub_abc1'), { nombre: 'Otro' }));
  await assertSucceeds(updateDoc(cdoc(db('admin'), 'sesiones', 'pub_abc1'), { cerrar: true }));
  await assertSucceeds(getDocs(collection(db('admin'), 'congregaciones', C, 'sesiones')));
  await assertSucceeds(deleteDoc(cdoc(db('pub'), 'sesiones', 'pub_abc1')));
});

test('respaldos y vista propia: solo el coordinador y cada quien su vista', async () => {
  await assertSucceeds(setDoc(cdoc(db('admin'), 'respaldos', '2026-11-02'), { fecha: '2026-11-02', partes: 1 }));
  await assertSucceeds(setDoc(cdoc(db('admin'), 'respaldos', '2026-11-02', 'partes', '0'), { d: 'abc' }));
  await assertFails(getDoc(cdoc(db('prog'), 'respaldos', '2026-11-02')));
  await assertFails(getDoc(cdoc(db('secre'), 'respaldos', '2026-11-02', 'partes', '0')));
  await assertSucceeds(setDoc(doc(db('admin'), 'usuarios', 'admin'), { vista: { nav: ['list', 'inicio'] } }, { merge: true }));
  await assertFails(setDoc(doc(db('admin'), 'usuarios', 'admin'), { vista: 'mal' }, { merge: true }));
  await assertFails(setDoc(doc(db('pub'), 'usuarios', 'admin'), { vista: {} }, { merge: true }));
});

test('el coordinador puede hacer coordinador a otro; alguien de fuera no ve nada', async () => {
  const a = db('admin'), o = db('otro');
  await assertSucceeds(updateDoc(cdoc(a, 'miembros', 'pub'), { admin: true }));
  await assertFails(getDoc(cdoc(o)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'codigos', CODE)));
  await assertSucceeds(getDoc(doc(o, 'codigos', CODE)));
  await assertFails(getDocs(collection(o, 'codigos')));
  await assertFails(setDoc(doc(o, 'codigos', CODE), { cong: 'otra' }));
  await assertFails(getDoc(cdoc(o, 'perfiles', 'p1')));
});
