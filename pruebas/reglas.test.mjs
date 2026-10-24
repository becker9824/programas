// Pruebas de las reglas de seguridad (npm run prueba-reglas: arranca Firebase local y las corre).
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';

let env;
const C = 'cong1', CODE = 'ABC234';
const db = uid => env.authenticatedContext(uid).firestore();
const memberData = (extra = {}) => ({ nombre: 'X', email: 'x@x.com', estado: 'pendiente', admin: false, perfil: null, codigo: CODE, creado: 1, ...extra });
const informe = (uid, extra = {}) => ({ uid, nombre: 'X', mes: '2026-10', participo: true, horas: null, cursos: 0, notas: '', enviado: 1, ...extra });

before(async () => {
  // Proyecto distinto al de la app local (demo-programas) para no borrar sus datos
  env = await initializeTestEnvironment({ projectId: 'demo-reglas', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(() => env.cleanup());

test('el creador arma su congregación y entra como admin', async () => {
  await env.clearFirestore();
  const a = db('admin');
  await assertSucceeds(setDoc(doc(a, 'congregaciones', C), { nombre: 'Centro', codigo: CODE, creador: 'admin' }));
  await assertSucceeds(setDoc(doc(a, 'codigos', CODE), { cong: C }));
  await assertSucceeds(setDoc(doc(a, 'congregaciones', C, 'miembros', 'admin'), memberData({ estado: 'activo', admin: true })));
  await assertSucceeds(setDoc(doc(a, 'congregaciones', C, 'privado', 'estado'), { datos: '{}' }));
  await assertSucceeds(setDoc(doc(a, 'usuarios', 'admin'), { cong: C }));
  await assertSucceeds(getDoc(doc(a, 'usuarios', 'admin')));
  await assertFails(getDoc(doc(db('otro'), 'usuarios', 'admin')));
  await assertFails(setDoc(doc(a, 'usuarios', 'admin'), { cong: C, admin: true }));
});

test('alguien con el código queda pendiente y no puede hacerse admin ni ver datos', async () => {
  const p = db('pub');
  await assertFails(setDoc(doc(p, 'congregaciones', C, 'miembros', 'pub'), memberData({ admin: true, estado: 'activo' })));
  await assertFails(setDoc(doc(p, 'congregaciones', C, 'miembros', 'pub'), memberData({ codigo: 'MALO99' })));
  await assertSucceeds(setDoc(doc(p, 'congregaciones', C, 'miembros', 'pub'), memberData()));
  await assertSucceeds(getDoc(doc(p, 'congregaciones', C, 'miembros', 'pub')));
  await assertFails(updateDoc(doc(p, 'congregaciones', C, 'miembros', 'pub'), { estado: 'activo' }));
  await assertFails(getDoc(doc(p, 'congregaciones', C, 'publico', 'programa')));
  await assertFails(getDoc(doc(p, 'congregaciones', C, 'privado', 'estado')));
});

test('el admin aprueba; el publicador ve el programa pero no los datos privados ni a los demás', async () => {
  const a = db('admin'), p = db('pub');
  await assertSucceeds(setDoc(doc(a, 'congregaciones', C, 'publico', 'programa'), { semanas: '[]' }));
  await assertSucceeds(updateDoc(doc(a, 'congregaciones', C, 'miembros', 'pub'), { estado: 'activo', perfil: 'p1' }));
  await assertSucceeds(getDoc(doc(p, 'congregaciones', C, 'publico', 'programa')));
  await assertSucceeds(getDoc(doc(p, 'congregaciones', C)));
  await assertFails(getDoc(doc(p, 'congregaciones', C, 'privado', 'estado')));
  await assertFails(getDoc(doc(p, 'congregaciones', C, 'miembros', 'admin')));
  await assertFails(getDocs(collection(p, 'congregaciones', C, 'miembros')));
  await assertFails(setDoc(doc(p, 'congregaciones', C, 'publico', 'programa'), { semanas: '[]' }));
  await assertFails(updateDoc(doc(p, 'congregaciones', C, 'miembros', 'pub'), { admin: true }));
});

test('informes: cada quien el suyo, los admins todos', async () => {
  const a = db('admin'), p = db('pub'), o = db('otro');
  const ref = doc(p, 'congregaciones', C, 'informes', 'pub_2026-10');
  await assertSucceeds(getDoc(ref)); // todavía no existe: se puede revisar
  await assertFails(getDoc(doc(p, 'congregaciones', C, 'informes', 'admin_2026-10')));
  await assertSucceeds(setDoc(ref, informe('pub', { horas: 12.5, cursos: 2, notas: 'Bien' })));
  await assertSucceeds(getDoc(ref));
  await assertFails(setDoc(doc(p, 'congregaciones', C, 'informes', 'admin_2026-10'), informe('admin')));
  await assertFails(setDoc(ref, informe('pub', { cursos: -1 })));
  await assertFails(setDoc(ref, informe('pub', { extra: 1 })));
  await assertSucceeds(getDocs(query(collection(p, 'congregaciones', C, 'informes'), where('uid', '==', 'pub'))));
  await assertFails(getDocs(collection(p, 'congregaciones', C, 'informes')));
  await assertSucceeds(getDocs(collection(a, 'congregaciones', C, 'informes')));
  await assertFails(getDoc(doc(o, 'congregaciones', C, 'informes', 'pub_2026-10')));
});

test('el admin puede hacer admin a otro; alguien de fuera no ve nada', async () => {
  const a = db('admin'), o = db('otro');
  await assertSucceeds(updateDoc(doc(a, 'congregaciones', C, 'miembros', 'pub'), { admin: true }));
  await assertFails(getDoc(doc(o, 'congregaciones', C)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'codigos', CODE)));
  await assertSucceeds(getDoc(doc(o, 'codigos', CODE)));
  await assertFails(getDocs(collection(o, 'codigos')));
  await assertFails(setDoc(doc(o, 'codigos', CODE), { cong: 'otra' }));
});
