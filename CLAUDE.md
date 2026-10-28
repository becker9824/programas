# Programas y Asignaciones

App para organizar las asignaciones de la reunión semanal Vida y Ministerio Cristianos. El usuario no es técnico: explicar en español sencillo, paso a paso.

## Cómo trabajar aquí
- Probar todo en el Firebase local antes de publicar (ver "Prueba local" abajo). En el Firebase real, Claude no crea cuentas: las crea el usuario.
- Para publicar una versión: subir `APP_VERSION` (index.html), `version` (package.json) y `CACHE` (sw.js); `npx electron . --prueba`; commit; si cambiaron las reglas, `npx.cmd firebase deploy --only firestore:rules --project programas-congregacion`; `git push` (actualiza la web); `npm run publicar -- "qué cambió"`.
- Windows PowerShell 5.1: no poner comillas dobles dentro de mensajes de commit ni de `npm run publicar` (rompen los argumentos). Revisar que el commit salió bien antes de dar por publicada una versión.
- Al probar en el navegador integrado, cerrar pestañas viejas de la app: muchas conexiones al Firebase local hacen que se cuelgue.
- Los datos que hay en Firebase todavía son de prueba; el usuario avisará cuándo borrarlos para empezar con los reales.

## Diseño (1.9.0)
- Azul sobrio (`--accent` #1d5fd0, `--accent-2` para fondos suaves). Íconos de línea en `ICONS` / `icon()`; logo en `logo()`.
- Menú: `navItems()` devuelve [vista, nombre, número de avisos]. En la PC va arriba; en el celular (≤760 px), `.tabbar` abajo con Inicio, Semanas, Informe y Anuncios, y el resto en "Más" (`openMoreSheet`).
- Vista `inicio` (`renderHome`): saludo, próxima asignación y tarjetas según las funciones.

## Archivos
- `index.html`: toda la app (HTML + CSS + JS en un solo archivo). Sin `firebase-config.js` guarda en `localStorage` (`programas-app-v2`); con él, en Firebase.
- `main.js` + `package.json`: programa de escritorio con Electron. El protocolo `app://programas` sirve la carpeta y responde `/jw/ping`, `/jw/semana?y=&w=` (semana ISO) y `/jw/titulo?path=` consultando wol.jw.org con `net.fetch`.
- `servidor.ps1` + `Programas.bat`: versión anterior para abrir en el navegador (http://localhost:8765). Hace lo mismo que `main.js` con PowerShell.
- `vendor/jspdf.umd.min.js`: jsPDF 2.5.1 local (copiado de `node_modules/jspdf/dist`).
- `manifest.webmanifest`, `sw.js`, `icon.svg`: la versión web se instala en el celular como app (GitHub Pages).

## Comandos
- `npm install`: instala Electron y electron-builder (no se guardan `node_modules` ni `dist`).
- `npx electron . --prueba`: abre el programa sin ventana, revisa jw.org, PDF y guardado, imprime `PRUEBA {...}` y cierra.
- `npm run instalador`: crea `dist\Programas-Setup-<versión>.exe` (solo local).
- `npm run publicar -- "qué cambió"`: crea el instalador y lo publica en GitHub Releases (`publicar.ps1`, usa `gh`). Subir `version` en `package.json` antes de cada entrega.

## Actualizaciones automáticas
- Código y versiones en https://github.com/becker9824/programas (público, para que la app descargue sin contraseña).
- `main.js` usa `electron-updater`: al abrir busca la versión nueva en Releases (`latest.yml`), la baja en segundo plano y pregunta si reiniciar; si no, la instala al cerrar. Solo corre en el programa instalado, no en `--prueba`.
- Los nombres de archivo deben coincidir con `latest.yml` (por eso `artifactName` sin espacios).

## App de Android (1.15.0, carpeta `movil/`)
- Capacitor 7: `movil/copiar.js` copia index.html, vendor, etc. a `movil/www` y le agrega `capacitor.js`; `movil/armar-apk.js` (`npm --prefix movil run apk`) sincroniza, compila con Gradle y firma → `movil/Programas.apk`. `publicar.ps1` lo arma y lo sube a cada versión; enlace fijo: https://github.com/becker9824/programas/releases/latest/download/Programas.apk
- En index.html, `NATIVE` (hay `capacitorExports`) y `NP` (CapacitorHttp, Filesystem, Share). En el celular: `jwFetch` lee wol.jw.org directo (misma lógica que intermediario/worker.js); PDF, CSV y respaldo se comparten con `nativeShareFile` (se parcha `HTMLAnchorElement.click` y `navigator.share`); sin service worker; `checkApkUpdate` revisa la última versión de GitHub y ofrece bajar el APK (no se actualiza sola).
- Versión del APK = `version` de package.json (código `mayor*10000+menor*100+parche`, en `movil/android/app/build.gradle`). Paquete `io.github.becker9824.programas`. Íconos copiados del proyecto TWA anterior; pantalla de arranque `drawable/splash.xml`.
- Herramientas en `E:\AndroidTools` (el usuario pidió descargar en el disco SSD SEC): `sdk`, `gradle-home`, `android-home` y `llaves/` (programas.keystore + clave.txt: **no perderlas**, sin ellas un APK nuevo no se instala encima del viejo). `E:\AndroidTools\programas-apk` y `bw` son del primer APK (TWA que abría la web en Chrome), ya no se usan; el repo becker9824.github.io (assetlinks.json) era para ese TWA.
- Probado por el usuario en su celular (1.14.2 de prueba). En la PC no hay emulador.

## Funciones hechas
- Semanas importadas solas de la Guía de actividades (wol.jw.org), con canciones (título por número: documento `1102016800 + n` para 1-151), horarios calculados y secciones de color.
- Perfiles (nombre, edad, sexo, notas, familia), avisos de repetidos / "hace mucho", lista ordenada por tiempo sin participar.
- Familias: sugieren y validan parejas estudiante/ayudante.
- PDF del programa (una semana por hoja, diseño basado en un PDF de ejemplo del usuario) y hojas de asignación (una por hoja, copiando las medidas de la hoja de asignación de ejemplo; nota y pie editables en Ajustes).

## Asignaciones mecánicas (1.12.0)
- Sección `mecanicas` (función programa). Por semana y por reunión: `p.mec = { entre: {...}, fin: {...} }` con las claves de `MEC` (presidente, lector, micPlat, micAud1, micAud2, acomInt, acomExt, audio). Presidente y lector de entre semana se leen/escriben en la fila del programa (`mecLinked`).
- `mecCandidates()`: varones con el privilegio (`presidente_fin`, `atalaya`, `microfonos`, `acomodador`, `audio`; presidente/lector en entre semana), sin otra asignación en esa reunión, sin mecánica en `settings.mecRestDays` (14) días. `settings.weekendDay`/`weekendTime` y `meetingDay`/`startTime`: horarios (tarjeta `meetingTimesCard` en Ajustes; entre semana solo lunes a viernes, fin de semana sábado o domingo). `mecanicasPDF()`: tabla horizontal, una fila por reunión.
- El programa VyM no recomienda a quien tiene mecánica entre semana (`mecIds`) y avisa en `statusFor`. `publicWeeks()` incluye `mec` para que los hermanos las vean.

## Asignaciones asistidas (1.4.0)
- `perfil.puede`: lista de privilegios (`PRIVS`: presidente, oracion, tesoros, lectura, estudiante, vida, conductor, lector). Si no existe, el perfil está "sin marcar" y sale para todo. `privFor(row, slot)` dice cuál pide cada asignación.
- Regla de descanso: `settings.restDays` (28) días antes o después de otra asignación (`contextFor().recent`); en las sugerencias salen aparte como “Descansando”.
- En pantallas angostas el panel de sugerencias se mueve debajo de la asignación con foco.
- `savePDF()`: en el celular abre Compartir (WhatsApp…); en la PC descarga.
- Filtros de sugerencias (1.10.0): `settings.filters` [{nombre, palabras, min, max, sexo}] (predeterminados en `DEFAULT_FILTERS`, se editan en Ajustes). `ruleFor(row)` busca las palabras (completas, sin acentos) en título y descripción de cualquier parte; `candidatesFor()` ordena: cumple filtro, tiene privilegio, no descansa, más días sin participar. Botón "Sugerencias" del editor: propuesta bajo cada vacía con Aplicar / Otra y Aplicar todas; nunca asigna sin que el usuario lo pida.
- Lista desplegable al tocar un espacio (1.11.0, `openPick`/`fillPick` en el editor): hasta 8 de `candidatesFor()`; al escribir busca por inicio de palabra entre todos y marca el motivo (descansando, sin privilegio, ya asignado…). Reemplaza al datalist y al panel lateral en línea del celular.
- Seamos mejores maestros (1.11.1): `preferWomen()` intercala 2 hermanas por cada hermano en las recomendaciones del estudiante (`womenFirst()`), dentro de cada grupo de filtro; no aplica al ayudante con pareja ni a partes de varones.

## Territorios (1.8.0)
- Mapa con Leaflet 1.9.4 (`vendor/leaflet`, se carga al abrir la sección) y OpenStreetMap; capa Satélite de Esri. QR con `vendor/qrcode.js` (qrcode-generator).
- `territorios/{id}`: numero, nombre, notas, coords (JSON de [[lat, lng]]), estado (disponible|asignado|terminado), asignadoA, desde, historial. Los ve cualquier miembro; los cambia la función `territorios`.
- QR: `WEB_URL#ver&n=…&t=…&p=<polilínea codificada>`. `renderSharedTerritory()` lo muestra sin Firebase ni sesión. Si se redibuja la zona, hay que reimprimir el QR.

## Cuentas de la congregación (1.7.0)
- Función `cuentas` (no da anuncios ni directorio). `cuentas/{id}`: fecha, tipo (entrada|salida|transferencia), categoria (`CATS`), descripcion, monto, fondo (caja|banco; en transferencias es el de origen), por, creado. `cuentasConfig/inicial`: fecha, caja, banco.
- Saldos = inicial + movimientos desde su fecha (`effect()`). Avisa lo de la obra mundial recibido y no enviado. Hecho sin ver las hojas S-26/S-30 de la congregación: ajustar categorías si usan otras.

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
- La versión web lee jw.org con el intermediario de Cloudflare (`intermediario/worker.js`, https://programas-jw.marperjamin007.workers.dev, `JW_PROXY` en index.html). Subirlo: `npx.cmd wrangler deploy --config intermediario/wrangler.toml` (sesión con `npx.cmd wrangler login`). Solo responde a los orígenes de la app.

## Pendiente / ideas
- Pulir detalles mínimos del diseño que el usuario vaya encontrando.
- Ajustar Cuentas si el usuario manda sus hojas S-26/S-30.
- Traer semanas de jw.org también desde la web (necesita un proxy, p. ej. Cloudflare Worker).
- Opción para elegir sala auxiliar en las hojas de asignación.
- Borrar los datos de prueba de Firebase cuando el usuario lo pida.
