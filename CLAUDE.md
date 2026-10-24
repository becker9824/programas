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

## Congregación en la nube (desde la versión 1.2.0)
- Proyecto Firebase `programas-congregacion`. Reglas: `npx.cmd firebase deploy --only firestore:rules` (después de cambiar `firestore.rules`).
- Web para celulares: https://becker9824.github.io/programas/ (GitHub Pages desde `main`; se actualiza sola al hacer push). Si cambia `index.html`, subir `CACHE` en `sw.js`.
- Con `window.FIREBASE_CONFIG` (`firebase-config.js`) la app usa Firebase: cuentas con correo, roles y datos compartidos. Si es `null`, funciona como antes (solo esta PC, `localStorage`).
- Registro: código de la congregación + nombre + correo + contraseña → queda `pendiente` hasta que un admin lo aprueba y lo une a su perfil (sección Usuarios). El primer admin usa “Nueva congregación”.
- Firestore: `codigos/{código}`, `usuarios/{uid}`, `congregaciones/{id}` con `miembros/{uid}`, `privado/estado` (todo el `state` como JSON, solo admins), `publico/programa` (semanas con nombres, lo genera `publishProgram()` al guardar) e `informes/{uid}_{AAAA-MM}`.
- Publicador: Semanas (solo lectura + “Tu próxima asignación”), Informe, Ajustes de solo lectura. Admin: todo + Usuarios + Informes de la congregación.
- La seguridad está en `firestore.rules`, no en la interfaz. Pruebas: `npm run prueba-reglas` (proyecto `demo-reglas`).
- Prueba local sin tocar el Firebase real: `npm run nube-local` y abrir `http://localhost:8765/?emu` (con `servidor.ps1`) o `npx electron . --emu`. Cuentas en `pruebas/cuentas-prueba.txt`.
- La versión web (https) no puede leer jw.org (CORS): las semanas se importan desde el programa de PC.

## Pendiente / ideas
- Traer semanas de jw.org también desde la web (necesita un proxy, p. ej. Cloudflare Worker).
- Opción para elegir sala auxiliar en las hojas de asignación.
