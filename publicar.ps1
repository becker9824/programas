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

$archivos = "dist\Programas-Setup-$version.exe", "dist\Programas-Setup-$version.exe.blockmap", 'dist\latest.yml'
# La subida del instalador (~110 MB) a veces se corta: se reintenta hasta 3 veces.
# Si la versión ya quedó creada a medias, se vuelven a subir sus archivos.
$listo = $false
for ($i = 1; $i -le 3 -and -not $listo; $i++) {
  gh release view "v$version" *> $null
  if ($LASTEXITCODE) { gh release create "v$version" @archivos --title "Programas $version" --notes $notas }
  else { gh release upload "v$version" @archivos --clobber }
  $listo = -not $LASTEXITCODE
  if (-not $listo -and $i -lt 3) { Write-Host "Falló la subida, reintentando ($i)..."; Start-Sleep 10 }
}
if (-not $listo) { throw 'No se pudo publicar en GitHub' }
Write-Host "Listo: version $version publicada."
