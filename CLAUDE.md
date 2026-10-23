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

## Pendiente / ideas
- Versión para celular Android (APK).
- Opción para elegir sala auxiliar en las hojas de asignación.
