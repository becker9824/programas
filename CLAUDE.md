# Programas y Asignaciones

App para organizar las asignaciones de la reunión semanal Vida y Ministerio Cristianos. El usuario no es técnico: explicar en español sencillo, paso a paso.

## Archivos
- `index.html`: toda la app (HTML + CSS + JS en un solo archivo). Datos en `localStorage`, clave `programas-app-v2`.
- `main.js` + `package.json`: programa de escritorio con Electron. El protocolo `app://programas` sirve la carpeta y responde `/jw/ping`, `/jw/semana?y=&w=` (semana ISO) y `/jw/titulo?path=` consultando wol.jw.org con `net.fetch`.
- `servidor.ps1` + `Programas.bat`: versión anterior para abrir en el navegador (http://localhost:8765). Hace lo mismo que `main.js` con PowerShell.
- `vendor/jspdf.umd.min.js`: jsPDF 2.5.1 local (copiado de `node_modules/jspdf/dist`).
- `manifest.webmanifest`, `sw.js`, `icon.svg`: inicio de una versión instalable para celular, sin conectar todavía.

## Comandos
- `npm install`: instala Electron y electron-builder (no se guardan `node_modules` ni `dist`).
- `npx electron . --prueba`: abre el programa sin ventana, revisa jw.org, PDF y guardado, imprime `PRUEBA {...}` y cierra.
- `npm run instalador`: crea `dist\Programas-Setup-<versión>.exe` (solo local).
- `npm run publicar -- "qué cambió"`: crea el instalador y lo publica en GitHub Releases (`publicar.ps1`, usa `gh`). Subir `version` en `package.json` antes de cada entrega.

## Actualizaciones automáticas
- Código y versiones en https://github.com/becker9824/programas (público, para que la app descargue sin contraseña).
- `main.js` usa `electron-updater`: al abrir busca la versión nueva en Releases (`latest.yml`), la baja en segundo plano y pregunta si reiniciar; si no, la instala al cerrar. Solo corre en el programa instalado, no en `--prueba`.
- Los nombres de archivo deben coincidir con `latest.yml` (por eso `artifactName` sin espacios).

## Funciones hechas
- Semanas importadas solas de la Guía de actividades (wol.jw.org), con canciones (título por número: documento `1102016800 + n` para 1-151), horarios calculados y secciones de color.
- Perfiles (nombre, edad, sexo, notas, familia), avisos de repetidos / "hace mucho", lista ordenada por tiempo sin participar.
- Familias: sugieren y validan parejas estudiante/ayudante.
- PDF del programa (una semana por hoja, diseño basado en un PDF de ejemplo del usuario) y hojas de asignación (una por hoja, copiando las medidas de la hoja de asignación de ejemplo; nota y pie editables en Ajustes).

## Asignaciones asistidas (1.4.0)
- `perfil.puede`: lista de privilegios (`PRIVS`: presidente, oracion, tesoros, lectura, estudiante, vida, conductor, lector). Si no existe, el perfil está "sin marcar" y sale para todo. `privFor(row, slot)` dice cuál pide cada asignación.
- Regla de descanso: `settings.restDays` (28) días antes o después de otra asignación (`contextFor().recent`); en las sugerencias salen aparte como “Descansando”.
- En pantallas angostas el panel de sugerencias se mueve debajo de la asignación con foco.
- `savePDF()`: en el celular abre Compartir (WhatsApp…); en la PC descarga.

## Anuncios y directorio (1.6.0)
- Función `ancianos` ("Anciano"). `isElder()` = ancianos, programa o secretario (todas son de ancianos): publican anuncios y ven el directorio. Los demás solo leen anuncios.
- `anuncios/{id}`: titulo, texto, fijado, vence (AAAA-MM-DD o null), autor, autorNombre, fecha. Los vencidos solo los ven los ancianos. Lo leído se guarda en localStorage (`anuncios-vistos-{uid}`).
- `contactos/{perfilId}`: tel, dir, emergencia, emergenciaTel. Aparte de `perfiles` para que solo los ancianos los vean.

## Informes para el secretario (1.5.0)
- `perfil.tipo`: `pub` (o vacío) publicador, `reg` precursor regular, `no` no es publicador (no sale en la lista de informes).
- Cada informe guarda `grupo` (`pub`|`aux`|`reg`) del mes; se propone el del mes anterior. Las horas solo se piden a precursores.
- Resumen: por grupo (informaron con participó = sí, horas, cursos), publicadores activos (participaron en los últimos 6 meses), sin informe, copiar resumen y CSV.

## Congregación en la nube (desde la versión 1.2.0)
- Proyecto Firebase `programas-congregacion`. Reglas: `npx.cmd firebase deploy --only firestore:rules` (después de cambiar `firestore.rules`).
- Web para celulares: https://becker9824.github.io/programas/ (GitHub Pages desde `main`; se actualiza sola al hacer push). Si cambia `index.html`, subir `CACHE` en `sw.js`.
- Con `window.FIREBASE_CONFIG` (`firebase-config.js`) la app usa Firebase: cuentas con correo, roles y datos compartidos. Si es `null`, funciona como antes (solo esta PC, `localStorage`).
- Registro: código de la congregación + nombre + correo + contraseña → queda `pendiente` hasta que un admin lo aprueba y lo une a su perfil (sección Usuarios). El primer admin usa “Nueva congregación”.
- Firestore: `codigos/{código}`, `usuarios/{uid}`, `congregaciones/{id}` (`nombre`, `codigo`, `creador`, `modo`: `todos`|`encargados`) con `miembros/{uid}`, `perfiles/{id}`, `familias/{id}`, `semanas/{id}`, `config/ajustes` (settings, canciones…), `publico/programa` (semanas con nombres, lo genera `publishProgram()` al guardar) e `informes/{perfil}_{AAAA-MM}`. `privado/estado` es la copia de la 1.2; se pasa sola al formato nuevo (`firstLoad`) y queda con `migrado: true`.
- En la app, `state` sigue teniendo la misma forma; `uploadState()` sube solo los documentos que cambiaron y `receiveDocs()` mete los cambios de otros.
- Funciones (`miembros.permisos`, lista `PERMS`): `programa` (semanas, perfiles, familias, ajustes de la reunión) y `secretario` (informes de todos). `admin: true` = coordinador: todo + Usuarios + ajustes de la congregación. Al agregar una función nueva: `PERMS`, `validPerms()` en las reglas y pruebas.
- Sin funciones: Semanas (solo lectura + “Tu próxima asignación”), Informe (si `modo` es `todos` y tiene perfil) y Ajustes de solo lectura.
- La seguridad está en `firestore.rules`, no en la interfaz. Pruebas: `npm run prueba-reglas` (proyecto `demo-reglas`).
- Prueba local sin tocar el Firebase real: `npm run nube-local` y abrir `http://localhost:8765/?emu` (con `servidor.ps1`) o `npx electron . --emu`. Cuentas en `pruebas/cuentas-prueba.txt`.
- La versión web (https) no puede leer jw.org (CORS): las semanas se importan desde el programa de PC.

## Pendiente / ideas
- Traer semanas de jw.org también desde la web (necesita un proxy, p. ej. Cloudflare Worker).
- Opción para elegir sala auxiliar en las hojas de asignación.
