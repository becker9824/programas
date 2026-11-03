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
- `index.html`: el esqueleto (HTML, `KEY` y `APP_VERSION`, que publicar.ps1 y movil/copiar.js buscan ahí) y carga, en orden, `app/estilos.css` y los scripts de `app/` (desde la 1.28.0; antes todo estaba en index.html). Son scripts normales, no módulos: comparten variables y funciones. Ojo: el código que corre al cargar un archivo no puede usar funciones de un archivo que va después (solo al llamarlas más tarde). Revisar sintaxis con `node --check app/<archivo>.js`.
- `app/`: base (datos, utilidades, reglas de sugerencias), jw, pdf, perfil, nube (Firebase), acceso, publicadores, informes, anuncios-cuentas, territorios, congregacion (grupos, WhatsApp, fin de semana, asistencia, S-21, calendario, arreglos), extras (guía, historial, confirmar, recordatorios, sesiones, respaldos, vista propia, ausencias), mecanicas (y Inicio), vistas (menú, editor, hermanos, ajustes y arranque). Al agregar un archivo: `index.html`, `FILES` de sw.js (los demás lo toman de la carpeta).
- Sin `firebase-config.js` guarda en `localStorage` (`programas-app-v2`); con él, en Firebase.
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
- Actualizar desde la app (1.31.0): plugin propio `ActualizarPlugin.java` (registrado en `MainActivity`): `puedeInstalar`, `pedirPermiso` (pantalla "Permitir de esta fuente", una vez) y `descargarEInstalar({url})`, que baja el APK a la caché con el evento `progreso` y abre el instalador de Android (FileProvider, `file_paths.xml` ya tiene `cache-path`). Permiso `REQUEST_INSTALL_PACKAGES` en el manifiesto. `checkApkUpdate` lo usa ("⬇ Actualizar ahora" con barra); si falla, abre el navegador como antes. Quien tenga 1.30.0 o anterior se actualiza a la 1.31.0 por última vez con el navegador.

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
- `territorios/{id}` (desde la 1.21.0 cada documento es una TARJETA): numero = número de tarjeta (no se repite), territorio = número del territorio (varias tarjetas por territorio; en el mapa se dibuja el contorno de cada territorio con `territoryHull`), nombre (colonia), tarjeta (campo viejo, ya no se usa), notas, coords (zona, JSON de [[lat, lng]]) o calles (1.18.0: territorio de calles, JSON de líneas; `terrShape`), estado (asignado|disponible; `terminado` solo en datos viejos), asignadoA, capitan (uid), desde, historial [{quien, desde, hasta, completo}], veces, trabajadas (JSON de calles), avance (JSON {p, n, f}), noPredicar (JSON [{p, n, k}]: casas marcadas, k `no` ⛔ o `nota` 📌). Los ve cualquier miembro; los cambia la función `territorios`; el capitán asignado (`capitan == uid`) solo registra en el suyo (reglas `myTerritory`).
- Vueltas (1.17.0): `estadoDe(t)`: asignado, o "completado" si `vecesDe(t)` es mayor que `vueltaBase()` (el mínimo de todos), o disponible. Al completarse todos, el mínimo sube y todos vuelven solos a disponible. Un territorio nuevo entra con `veces = vueltaBase()`.
- Registros (1.17.0): `trabajos/{id}` (territorio, numero, fecha, completo, calles, avance, notas, por, porNombre, capitan). Los leen la función `territorios` y los capitanes; el siervo los corrige o borra. Estadísticas por año: `workStats(año)`. Pantalla (1.18.0, más simple): al elegir un territorio sale arriba del mapa una barra con 4 botones grandes (`actionsUpdate`): Trazar calle trabajada, Marcar casa, Hasta aquí llegaron y Registrar salida; cada uno se guarda al momento. Modos del mapa en `terr.mode.kind`: zona, calles, trabajada, casa, avance (`MODES`). El QR lleva también calles (`l`) y casas de no predicar (`x`).
- Mapa "pro" (1.19.0), todo gratis y sin claves: estilos `MAP_STYLES` (Claro = Esri World_Street_Map, Calles = OSM, Gris y Oscuro = Esri Canvas hasta zoom 16, Satélite = Esri + nombres de calles); CARTO no sirve (pide clave). Las imágenes se buscan primero en Cache Storage `mapas-v1` (`tileLayer`, `cachedTile`); "📴 Guardar mapa sin internet" (`saveMapOffline`) guarda la zona del territorio (zoom 15–18). Trazo pegado a las calles con rutas a pie de routing.openstreetmap.de (`snapPoint`, `snapRoute`; casilla "🧲 Pegar a las calles", se recuerda). Salida con GPS (1.20.0): "▶ Empezar salida con GPS" (`tripStart`) graba con `watchPosition` (punto cada 6 m, ignora precisión > 40 m, Wake Lock) solo lo que está dentro del territorio (`insideTerritory`, 30–35 m de margen); `gpsTrip` se guarda en localStorage `salida-gps` para continuarla si se cierra la app. Durante la salida: "Marcar casa aquí". "■ Terminar salida" (`tripFinish`) pega lo recorrido a las calles (`matchTrack`, servicio match de OSRM), lo agrega a `trabajadas`, pone el último punto como `avance` y abre Registrar salida (si quedó una parte, su nota pasa al avance). El modo "Trazar calle trabajada" quedó solo a mano. Buscar dirección con Nominatim (`findAddress`). Tarjeta PDF 2 por hoja con imagen del mapa (`territoryMapImage`, canvas con las imágenes de Esri).
- `capitanes/lista`: el coordinador publica las cuentas con la función `capitan` (`publishCaptains`) para que el siervo de territorios pueda asignarles sin ver las cuentas.
- QR: `WEB_URL#ver&n=…&t=…&p=<polilínea codificada>`. `renderSharedTerritory()` lo muestra sin Firebase ni sesión. Si se redibuja la zona, hay que reimprimir el QR.

## Cuentas de la congregación (1.7.0)
- Función `cuentas` (no da anuncios ni directorio). `cuentas/{id}`: fecha, tipo (entrada|salida|transferencia), categoria (`CATS`), descripcion, monto, fondo (caja|banco; en transferencias es el de origen), por, creado. `cuentasConfig/inicial`: fecha, caja, banco.
- Saldos = inicial + movimientos desde su fecha (`effect()`). Avisa lo de la obra mundial recibido y no enviado. Hecho sin ver las hojas S-26/S-30 de la congregación: ajustar categorías si usan otras.

## Anuncios y directorio (1.6.0)
- Función `ancianos` ("Anciano"). `isElder()` = ancianos, programa o secretario (todas son de ancianos): publican anuncios y ven el directorio, que desde la 1.18.0 está dentro de la ficha de cada hermano (Hermanos lo ven todos los ancianos; sin `programa` solo cambian el directorio y, el secretario, el grupo). Los demás solo leen anuncios.
- `anuncios/{id}`: titulo, texto, fijado, vence (AAAA-MM-DD o null), autor, autorNombre, fecha. Los vencidos solo los ven los ancianos. Lo leído se guarda en localStorage (`anuncios-vistos-{uid}`).
- `contactos/{perfilId}`: tel, dir, emergencia, emergenciaTel. Aparte de `perfiles` para que solo los ancianos los vean.

## Informes para el secretario (1.5.0)
- `perfil.tipo`: `pub` (o vacío) publicador, `reg` precursor regular, `no` no es publicador (no sale en la lista de informes).
- Cada informe guarda `grupo` (`pub`|`aux`|`reg`) del mes; se propone el del mes anterior. Las horas solo se piden a precursores.
- Resumen: por grupo (informaron con participó = sí, horas, cursos), publicadores activos (participaron en los últimos 6 meses), sin informe, copiar resumen y CSV.

## Congregación en la nube (desde la versión 1.2.0)
- Proyecto Firebase `programas-congregacion`. Reglas: `npx.cmd firebase deploy --only firestore:rules` (después de cambiar `firestore.rules`).
- Web (desde la 1.32.0): https://programas-congregacion.web.app (Firebase Hosting). `publicar.ps1` la sube al final (`firebase deploy --only hosting`; `predeploy` corre `copiar-web.js`, que copia a `web/` solo una lista cerrada de archivos: nunca subir la carpeta entera, hay PDF con nombres reales). La anterior, https://becker9824.github.io/programas/ (GitHub Pages, se actualiza con el push), redirige a la nueva desde index.html (también los QR y enlaces viejos). Si cambia la app, subir `CACHE` en `sw.js`.
- Con `window.FIREBASE_CONFIG` (`firebase-config.js`) la app usa Firebase: cuentas con correo, roles y datos compartidos. Si es `null`, funciona como antes (solo esta PC, `localStorage`).
- Registro: código de la congregación + nombre + correo + contraseña → queda `pendiente` hasta que un admin lo aprueba y lo une a su hermano (arriba en la sección Hermanos). El primer admin usa “Nueva congregación”.
- Firestore: `codigos/{código}`, `usuarios/{uid}`, `congregaciones/{id}` (`nombre`, `codigo`, `creador`, `modo`: `todos`|`encargados`) con `miembros/{uid}`, `perfiles/{id}`, `familias/{id}`, `semanas/{id}`, `config/ajustes` (settings, canciones…), `publico/programa` (semanas con nombres, lo genera `publishProgram()` al guardar) e `informes/{perfil}_{AAAA-MM}`. `privado/estado` es la copia de la 1.2; se pasa sola al formato nuevo (`firstLoad`) y queda con `migrado: true`.
- En la app, `state` sigue teniendo la misma forma; `uploadState()` sube solo los documentos que cambiaron y `receiveDocs()` mete los cambios de otros.
- Funciones (`miembros.permisos`, lista `PERMS`): `programa` (semanas, perfiles, familias, ajustes de la reunión) y `secretario` (informes de todos). `capitan` (territorios que se le asignan; fase 2). `admin: true` = coordinador: todo + cuentas y funciones + ajustes de la congregación. Al agregar una función nueva: `PERMS`, `validPerms()` en las reglas y pruebas.
- Hermanos (1.16.0): Perfiles y Usuarios se unieron en la vista `people` ("Hermanos"). El perfil tiene además `nombramiento` (`anciano`|`sm`|''), `situacion` y `bautizado`. El coordinador ve arriba `accountsPanel()` (código, cuentas por aprobar, cuentas sin hermano) y, en el diálogo de cada hermano, su cuenta (`memberFunctions`, separar o quitar). Siguen existiendo hermanos sin cuenta.
- Filtro de nombrados (`nomFilter`, `nomChips`): Todos/Nombrados/Ancianos/Siervos en las listas para elegir del programa y de Mecánicas, aparte de los filtros por edad. Además, en Ajustes "Preferir nombrados" (`settings.nomPrefs`, privilegio → nom|anciano|sm; `nomPrefsCard`, `prefersMe`): esos salen primero en las sugerencias. De fábrica: micrófonos, acomodador y audio → nombrados.
- Grupos (1.16.0): `grupos/{id}` = { nombre, superintendente, auxiliar, miembros: [perfiles] }; los ven los ancianos (`isElder`) y los arma `secretario`. Cada hermano está en un solo grupo (`grupoOf`, `setGroupMember`). Sección `renderGroups`, con estadísticas.
- Sin funciones: Semanas (solo lectura + “Tu próxima asignación”), Informe (si `modo` es `todos` y tiene perfil) y Ajustes de solo lectura.
- La seguridad está en `firestore.rules`, no en la interfaz. Pruebas: `npm run prueba-reglas` (proyecto `demo-reglas`).
- Prueba local sin tocar el Firebase real: `npm run nube-local` y abrir `http://localhost:8765/?emu` (con `servidor.ps1`) o `npx electron . --emu`. Cuentas en `pruebas/cuentas-prueba.txt`.
- La versión web lee jw.org con el intermediario de Cloudflare (`intermediario/worker.js`, https://programas-jw.marperjamin007.workers.dev, `JW_PROXY` en index.html). Subirlo: `npx.cmd wrangler deploy --config intermediario/wrangler.toml` (sesión con `npx.cmd wrangler login`). Solo responde a los orígenes de la app.

## Programa: diseños y sala auxiliar (1.21.0)
- Ajustes → Programa y PDF: `pdfDesign` (`PDF_DESIGNS`: s140 de fábrica, clasico, compacto, elegante; `pdfFlow` dibuja los de varias semanas por hoja, `pdfClassic` el de antes), `pdfDate` (`weekHeading`), `pdfShowMin`, `auxRoom`. Hojas: `slipDate` (`fmtDate`: larga como en Semanas, media, corta), `slipShowMin`, `slipShowText`, `slipShowLesson` (`splitDetail` separa la lección "(th lección 11)").
- Sala auxiliar (`auxOn()`): partes de estudiantes (`hasAux`) con espacios `xa`/`xb`; en la introducción, `xa` = consejero de la sala auxiliar. `baseSlot`/`mateSlot` hacen que privilegios, parejas y sugerencias traten `xa` como `a`. Las hojas de la sala auxiliar marcan "Sala auxiliar núm. 1".
- Botón "⬇ Mes completo" (`monthDownload`) en Semanas y Mecánicas.
- 1.22.0: la sala auxiliar se activa en cada semana (botón "Sala auxiliar" en el editor; `p.aux`, `auxOn(p)`; `settings.auxRoom` solo queda para semanas viejas). El programa en pantalla (editor y lo que ven todos) usa el diseño elegido (`themeClass()`, CSS `.theme-s140/.theme-compacto/.theme-elegante`, `secClass` por sección). Ajustes con botones que se prenden (`toggles`). Ficha del hermano por secciones (`.dlg-sec`); "Capitán de territorios" es la única forma de dar la función `capitan` (ya no sale entre las funciones de la cuenta).
- Capitanes: casilla "Capitán de territorios" en el hermano (`perfil.capitan`; si tiene cuenta, también le da la función). `capitanes/hermanos` (lo escribe Programa VyM en `uploadState`) y `capitanes/lista` (cuentas; el coordinador); `captainOptions()` los une.
- Para revisar PDFs sin abrirlos a mano: generarlos en el navegador y mandarlos con `fetch` POST a un receptor local (`recibir.js` en el scratchpad, puerto 8799); luego leerlos con Read.

## WhatsApp, fin de semana, asistencia y S-21 (1.23.0)
- WhatsApp: "💬 Avisar por WhatsApp" en el editor de la semana, en Mecánicas y en Fin de semana (`openWhatsAppDialog`, `weekAssignments`). Mensaje de `settings.waTemplate` (de fábrica `WA_TEMPLATE`; NO ponerlo en `defaults()`, que corre antes de definirse) con {nombre} {asignacion} {reunion} {fecha} {hora} {companero} {sala} {congregacion}; los renglones con llaves que quedan vacíos se quitan (`waMessage`). Se corrige antes de mandar. Teléfono del directorio; `waPhone` le pone la lada `settings.waCountry` (52). Se abre `wa.me`.
- Fin de semana (vista `finsemana`, función programa): `p.fin` = { bosquejo, tema, orador, oradorId, cong, hosp, notas, salen: [...] }; presidente y lector son las mecánicas de 'fin'. Temas de bosquejos recordados en `state.talks` (va en config). PDF `weekendPDF`. Lo ven todos en el programa publicado (`fin` en `publicWeeks`); la semana sigue visible hasta su última reunión (`lastDay` en `renderPubList`).
- 1.32.0: Fin de semana lo ven todos los ancianos (`isElder`); sin Programa VyM es solo lectura (`ro` en `renderWeekend`: campos desactivados, sin WhatsApp ni agregar/quitar; sí PDF). Para eso los ancianos leen `semanas` y `config` (reglas: read `isElder`, write `programa`; `COLLS` semanas con secretario y ancianos; listener de config para ancianos sin programa).
- Asistencia S-88 (vista `asistencia`, ancianos): `asistencia/{AAAA-MM}` = { entre: {fecha: n}, fin: {fecha: n} }; año de servicio sep–ago (`serviceMonths`); PDF `attendancePDF`.
- S-21: en Informes (secretario) "Tarjetas del publicador" (`publisherCardsPDF`, 2 por hoja) con los informes del año. Ficha del hermano: `nacimiento` (calcula la edad), `bautismoFecha`, `esperanza` ('' otras ovejas | 'ungido').
- Si el programa instalado está abierto, `npx electron . --prueba` se cierra sin decir nada (una sola copia): usar `--user-data-dir="$TEMP/programas-prueba"`.

## Calendario, arreglos, guía, historial y sin internet (1.24.0)
- Calendario (vista `calendario`, todos la ven; ancianos editan): `eventos/{id}` = { tipo (`EVENT_TYPES`: visita, asamblea, conmemoracion, campana, otro), titulo, desde, hasta, notas }. Salen como etiquetas en Semanas, en el editor (con "Ajustar el programa para la visita" → `adjustForVisit` cambia el estudio bíblico por el discurso del superintendente) y en el programa publicado.
- Arreglos (vista `arreglos`): `salidas/{id}` = { dia 0–6 (lunes…domingo), hora, lugar, dirige, grupo, notas }; `arreglos/limpieza` = { semanas: { lunes: 'Grupo 2' } } (nombre del grupo, porque los publicadores no leen `grupos`); "Repartir entre los grupos" rota. PDF `arrangementsPDF`.
- Guía (`openGuide`, pasos según funciones en `guideSteps`): sale sola la primera vez (localStorage `guia-{uid}`); botón en Ajustes → cuenta.
- Historial (vista `historial`, ancianos): `historial/{id}` = { fecha, por, porNombre, cambios[] }; `logChange(texto)` junta 1.5 s; `uploadState` describe los cambios de semanas/hermanos/familias/ajustes (`describeChanges`: quién quedó y quién estaba); también territorios, cuentas, grupos, asistencia, eventos, salidas y limpieza.
- Sin internet: Firebase va en `vendor/firebase` (copiado de node_modules/firebase con la importación cambiada a `./firebase-app.js`; al subir de versión de firebase, volver a copiarlo así) y Firestore usa `persistentLocalCache`. Barra `.offline-bar`. El service worker ya no borra la caché `mapas-…`.

## Ausencias y descarga en imagen (1.25.0)
- Ausencia: `ausencias/{perfil}` = { desde, hasta (último día), nota, por }. Cada quien la suya (tarjeta en Inicio y botón en Ajustes → cuenta); Programa VyM y secretario, en la ficha del hermano. La leen los ancianos (y cada quien la suya). `awayOn(pid, fecha)` saca a la persona de `candidatesFor` (Sugerencias y lista desplegable) y de `mecCandidates` ("Ausente"); en el editor van al final en "Ausentes" y sale aviso `awayWarning` si alguien asignado estará ausente. Etiqueta en Hermanos.
- Imagen: `savePDF` pregunta PDF / PNG / JPG (`askFormat`) o usa lo elegido en Ajustes → cuenta (localStorage `formato-descarga`). Las imágenes se hacen dibujando el mismo PDF con pdf.js (`vendor/pdfjs`, legacy 4.10.38, renombrado de .mjs a .js para que se sirva como JavaScript, con `standard_fonts`): una imagen por hoja. En el celular se comparten juntas; en la PC, una descarga por hoja. La autoprueba de PC revisa `imagen`.
- `h()` aplana listas anidadas (`flat(Infinity)`): antes salía "[object HTMLSpanElement]" junto a los eventos en el programa publicado.

## Hoja de informes y guardar sin trabarse (1.26.0)
- Informes → "Hoja de informes del mes": `reportSheet(mes, informes)` arma secciones publicadores / precursores regulares / auxiliares con número continuo y número y color del grupo de servicio (`serviceGroupInfo`, colores `GROUP_COLORS` como la hoja de Excel del secretario). PDF `reportsPDF` en diseños `REPORT_DESIGNS` (hoja = copia del Excel, por grupos de servicio, sencillo en blanco y negro; se recuerda en el equipo, localStorage `diseno-informes`).
- Excel de verdad (.xlsx) con ExcelJS (`vendor/exceljs.min.js` 4.4.0, se carga al usarlo): `reportsExcel` (una pestaña por mes, colores, bordes y totales con fórmulas) y `reportsYearExcel` (año de servicio sep–ago, hasta el mes elegido). Sustituye el CSV de informes.
- `saveBlob(blob, nombre)`: en APK/celular se comparte; en la PC se descarga con el enlace vivo 60 s (antes 1 s y sin estar en la página: en algunos navegadores el archivo no se guardaba). Lo usan Excel, CSV de cuentas y respaldo.
- Guardar no se traba: en `loadFirebase`, `setDoc`/`updateDoc`/`deleteDoc`/`addDoc` esperan al servidor máximo 8 s (0.3 s sin internet); después siguen (queda guardado en el equipo y se sube solo) y si el servidor lo rechaza más tarde sale un aviso. `addDoc` se hace con `doc()` + `setDoc` para tener el id al instante.
- Informe propio sin conexión: si no se puede leer el anterior, se muestra el formulario igual.

## Entrar con enlace al correo (1.27.0)
- Pestaña Entrar: por defecto "Enviarme el enlace para entrar" (`sendLoginLink`, `sendSignInLinkToEmail`, correo guardado en localStorage `correo-enlace`); "Entrar con mi contraseña" y "¿Olvidaste tu contraseña?" siguen de respaldo. El enlace entra a la misma cuenta (mismo uid) que la contraseña. Crear cuenta / Nueva congregación siguen con contraseña.
- **Plan gratis (Spark): solo 5 correos de enlace al día para todo el proyecto** (`auth/quota-exceeded` → aviso de usar la contraseña). Con Blaze: 25,000/día. En Firebase Console hay que activar Authentication → Email/Password → "Vínculo de correo electrónico (acceso sin contraseña)", y `becker9824.github.io` debe estar en Dominios autorizados.
- Web: `startCloud` atiende el enlace (`isSignInWithEmailLink`) antes de `watchAuth()` (antes el `onAuthStateChanged` estaba dentro de `startCloud`). Sin correo guardado (otro equipo) → `renderLinkEmail`.
- App de PC y APK (`LINK_APP`): el enlace vuelve a `WEB_URL?para-app=1`; esa página (`renderLinkForApp`) ofrece "Abrir en Programas" (`programas://entrar?l=<enlace>`) o copiar. main.js registra el protocolo `programas` (solo instalado) y pasa el enlace con `receiveLink` (argv al abrir y `second-instance`); el APK tiene el intent-filter `programas://entrar` y usa el plugin App (`appUrlOpen`, `getLaunchUrl`). En `renderLinkSent` también se puede pegar el enlace.
- Emulador: los enlaces se leen en `http://127.0.0.1:9099/emulator/v1/projects/demo-programas/oobCodes`.

## Confirmar, recordatorios, sesiones, respaldos y vista propia (1.28.0)
- Confirmar: `confirmaciones/{perfil}` = { lista: { clave: fecha } }; clave `semana|fila|espacio`, `semana|mec|reunión|clave` o `semana|fin|orador` (`myAssignments` da `key`; por eso `publicWeeks` lleva `id` de fila y `mtg`/`k` en mecánicas). "✔ Recibido" en "Tu próxima asignación" (`confirmButton`); el editor muestra "✔ confirmó" y cuántos confirmaron; Mecánicas, ✔ en la casilla (`confirmedOn`).
- Recordatorios (`scheduleReminders`, localStorage `recordatorios`): APK con @capacitor/local-notifications (3 días antes 10:00 y un día antes 18:00, aunque esté cerrada); PC/web avisan al abrir (y cada hora) si hay asignación en 2 días, una vez al día (`recordatorio-{uid}`).
- "🕓 Cambios" en el editor: lo del historial de esa semana (`openWeekHistory`).
- Sesiones: `sesiones/{uid}_{equipo}` (equipo = localStorage `equipo-id`) = { uid, nombre, equipo, visto, cerrar }. Al entrar se anota (`trackSession`); si `cerrar` se pone en true (la persona desde otro equipo o el coordinador), ese equipo borra la suya y cierra sesión. "Cerrar sesión" borra la suya (`forgetSession`). No revoca la contraseña.
- Respaldo automático (coordinador): `respaldos/{AAAA-MM-DD}` + `partes/{n}` (JSON comprimido gzip en base64, partes de 700 000). Al abrir, si el último tiene 7 días o más (`autoBackup`); quedan 8. Descarga compatible con "Cargar respaldo" (se ignora `congregacion`, que trae las demás colecciones).
- Vista propia (solo coordinador): `usuarios/{uid}.vista` = { nav, navOcultas, inicio, inicioOcultas, sinAsignacion } (`openViewDialog`, `customNav`, `customTiles`; las tarjetas de Inicio llevan `data-k`). `navItems(true)` da todas sin ese orden (para saber si una vista está permitida). Ajustes no se puede ocultar.

## Precursor auxiliar (1.29.0)
- `perfil.tipo` ahora puede ser `aux`; `perfil.auxMeses` ([] = todos los meses / continuo; con meses = solo en esos, fuera de ellos es publicador). En la ficha: "¿En qué meses?" con botones de 2 meses atrás a 9 adelante. `auxIn(pr, mes)`, `groupFor(pr, mes)` (reg/aux/pub), `pioneerTag(pr)` (etiqueta en Hermanos y Grupos; en Grupos cuenta "Precursores auxiliares este mes").
- Informes: el grupo propuesto sale de la ficha (secretario: `groupFor`; quien no ha informado sale "Sin informe · Precursor auxiliar"). La hoja del mes pone a quien no ha informado en la sección de su ficha. El S-21 sigue marcando "Precursor auxiliar" por el `grupo` de cada informe.
- Los publicadores no leen perfiles: `publico/precursores` = { reg: [perfiles], aux: { perfil: [meses] } } (`publishPioneers`, al guardar una ficha y al abrir la app Programa VyM o el secretario) para proponer el grupo en su propio informe.
- El secretario (sin Programa VyM) puede cambiar en la ficha solo "Informe mensual" y los meses (reglas: `tipo`, `auxMeses` en perfiles; `publico/precursores`).
- El mes elegido en Informes se queda hasta cerrar sesión (`nube.mesInforme` el propio, `nube.mesInformes` el del secretario; se borran en `watchAuth`).
- "↺ Restablecer (borrar informe)" en `reportForm` cuando ya hay informe: lo borra (cada quien el suyo si `modo` es `todos`; el secretario cualquiera).
- Estudiante varón = también lectura de la Biblia: en la ficha (`syncReading`: al marcar "Seamos mejores maestros", el botón Estudiante o cambiar a varón; a una hermana se le quita) y una sola vez por congregación en `firstLoad` (`settings.lecturaAuto`).
- Sin zoom (que se sienta app): viewport con `maximum-scale=1, user-scalable=no`, `html { touch-action: pan-x pan-y }` y `gesturestart` bloqueado en iPhone (fuera de `.leaflet-container`). El mapa hace su propio zoom.

## Informes en vivo y buscador (1.30.0)
- Informes de la congregación (`congregationReports`): escucha con `onSnapshot` los informes de los 6 meses (antes un `getDocs` por cada dibujo: un informe nuevo no aparecía hasta que algo más redibujaba, y salía "Cargando…" cada vez). `reportsCache` muestra lo último al instante. Si hay un diálogo abierto o se escribe en el buscador, no se redibuja todo (`nube.redraw`).
- `viewSubs` / `stopViewSubs()`: lo que escucha solo una pantalla; se corta en `render()` y en `stopListening()`.
- Buscador "Buscar publicador" (sin acentos, `norm`; `reportsSearch` se recuerda). Busca también por nombramiento y por lo que fue en el mes. Columnas: Nombre, Nombramiento (`nomLabel`), Este mes fue (informe o ficha), Estado del informe (✓ Enviado / Sin informe), ¿Participó?, Horas, Cursos, Notas.
- La ficha manda (como el nombramiento): `monthKind(perfil, mes, informe)` = `groupFor` de la ficha; solo sin ficha (perfil borrado) se usa el `grupo` del informe. Lo usan la tabla, el resumen por tipo y la hoja del mes; el S-21 marca auxiliar si la ficha o el informe lo dicen. En `reportForm(…, grupoDefault, fixed)` con `fixed` no se elige: muestra "Según su ficha en Hermanos" (secretario) o "Según tu ficha…" (publicador, con `publico/precursores`).
- Historial (`histCache`) y la tarjeta "Tu informe" de Inicio (`nube.miInforme`) también muestran lo último al instante. `histCache` y `reportsCache` se borran en `watchAuth`.

## Pendiente / ideas
- Pulir detalles mínimos del diseño que el usuario vaya encontrando.
- Ajustar Cuentas si el usuario manda sus hojas S-26/S-30.
- Borrar los datos de prueba de Firebase cuando el usuario lo pida.
