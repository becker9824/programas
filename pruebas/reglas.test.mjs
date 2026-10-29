// Pruebas de las reglas de seguridad (npm run prueba-reglas: arranca Firebase local y las corre).
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';

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
  await assertFails(getDocs(collection(s, 'congregaciones', C, 'semanas')));
  await assertSucceeds(deleteDoc(cdoc(s, 'informes', 'p3_2026-10')));
});

test('si la congregación elige "solo encargados", el publicador ya no envía informes', async () => {
  await assertSucceeds(updateDoc(cdoc(db('admin')), { modo: 'encargados' }));
  await assertFails(setDoc(cdoc(db('pub'), 'informes', 'p1_2026-11'), informe('p1', 'pub', { mes: '2026-11' })));
  await assertSucceeds(setDoc(cdoc(db('secre'), 'informes', 'p1_2026-11'), informe('p1', 'secre', { mes: '2026-11' })));
  await assertFails(updateDoc(cdoc(db('admin')), { modo: 'cualquiera' }));
  await assertSucceeds(updateDoc(cdoc(db('admin')), { modo: 'todos' }));
});

test('anuncios: los publica cualquier anciano (cualquier función) y los leen todos', async () => {
  const anuncio = autor => ({ titulo: 'Asamblea', texto: 'Recuerden…', fijado: false, vence: null, autor, autorNombre: 'X', fecha: 1 });
  await assertSucceeds(setDoc(cdoc(db('prog'), 'anuncios', 'a1'), anuncio('prog')));
  await assertSucceeds(setDoc(cdoc(db('secre'), 'anuncios', 'a2'), anuncio('secre')));
  await assertFails(setDoc(cdoc(db('pub'), 'anuncios', 'a3'), anuncio('pub')));
  await assertFails(setDoc(cdoc(db('prog'), 'anuncios', 'a4'), { ...anuncio('prog'), titulo: '' }));
  await assertFails(setDoc(cdoc(db('prog'), 'anuncios', 'a4'), { ...anuncio('prog'), vence: 'mañana' }));
  await assertSucceeds(getDoc(cdoc(db('pub'), 'anuncios', 'a1')));
  await assertSucceeds(getDocs(collection(db('pub'), 'congregaciones', C, 'anuncios')));
  await assertFails(getDoc(cdoc(db('otro'), 'anuncios', 'a1')));
  await assertFails(deleteDoc(cdoc(db('pub'), 'anuncios', 'a1')));
  await assertSucceeds(deleteDoc(cdoc(db('secre'), 'anuncios', 'a1')));
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
  const terr = { numero: '20', nombre: 'Norte', tarjeta: '20-A', notas: '', coords: '[]', estado: 'asignado', asignadoA: 'Pub', capitan: 'pub', desde: '2026-10-01',
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
