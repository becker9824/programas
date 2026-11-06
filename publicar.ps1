# Publica una version nueva en GitHub Releases (npm run publicar -- "que cambio").
# Antes: subir "version" en package.json. Los programas instalados la descargan solos.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$notas = if ($args.Count) { $args -join ' ' } else { "Version $version" }
if ((Get-Content index.html -Raw) -notmatch "APP_VERSION = '$([regex]::Escape($version))'") { throw "APP_VERSION en index.html no es $version" }

Remove-Item dist\latest.yml, "dist\Programas-Setup-$version.*" -ErrorAction SilentlyContinue
npm.cmd run instalador
if ($LASTEXITCODE) { throw 'No se pudo crear el instalador' }

# App de Android: desde la 1.42.0 es la nativa (E:\ProgramasAndroid), con el mismo identificador y la misma llave.
# Programas.apk: lo baja la app vieja (movil/) para actualizarse encima y el enlace de descarga de la web.
# Programas-nativa.apk y nativa.json: los revisa la nativa. Para que la nativa se ofrezca como actualización,
# subir versionCode y versionName en E:\ProgramasAndroid\app\build.gradle.kts.
$nativa = 'E:\ProgramasAndroid'
Remove-Item "$nativa\Programas-nativa.apk", dist\Programas.apk, dist\Programas-nativa.apk, dist\nativa.json -ErrorAction SilentlyContinue
cmd /c "cd /d $nativa && node armar.js 2>&1"
if ($LASTEXITCODE -or -not (Test-Path "$nativa\Programas-nativa.apk")) { throw 'No se pudo crear el APK' }
Copy-Item "$nativa\Programas-nativa.apk" dist\Programas.apk
Copy-Item "$nativa\Programas-nativa.apk" dist\Programas-nativa.apk
$versionNativa = [regex]::Match((Get-Content "$nativa\app\build.gradle.kts" -Raw), 'versionName = "([0-9.]+)"').Groups[1].Value
if (-not $versionNativa) { throw 'No encontré la versión de la nativa' }
[IO.File]::WriteAllText("$PSScriptRoot\dist\nativa.json", "{ `"version`": `"$versionNativa`" }")

$archivos = "dist\Programas-Setup-$version.exe", "dist\Programas-Setup-$version.exe.blockmap", 'dist\latest.yml', 'dist\Programas.apk', 'dist\Programas-nativa.apk', 'dist\nativa.json'
# La subida del instalador (~110 MB) a veces se corta: se reintenta hasta 3 veces.
# Si la versión ya quedó creada a medias, se vuelven a subir sus archivos.
$listo = $false
$ErrorActionPreference = 'Continue' # que un aviso de gh no corte los reintentos
for ($i = 1; $i -le 3 -and -not $listo; $i++) {
  # Por cmd: en PowerShell 5.1, el aviso "release not found" de gh detendría el script
  cmd /c "gh release view v$version >nul 2>nul"
  if ($LASTEXITCODE) { gh release create "v$version" @archivos --title "Programas $version" --notes $notas }
  else { gh release upload "v$version" @archivos --clobber }
  $listo = -not $LASTEXITCODE
  if (-not $listo -and $i -lt 3) { Write-Host "Falló la subida, reintentando ($i)..."; Start-Sleep 10 }
}
if (-not $listo) { throw 'No se pudo publicar en GitHub' }

# Versión web: https://programas-congregacion.web.app (Firebase Hosting; copia solo lo de la app, ver copiar-web.js)
npx.cmd firebase deploy --only hosting --project programas-congregacion
if ($LASTEXITCODE) { throw 'No se pudo publicar la versión web' }
Write-Host "Listo: version $version publicada."
