# Publica una version nueva en GitHub Releases (npm run publicar -- "que cambio").
# Antes: subir "version" en package.json. Los programas instalados la descargan solos.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$notas = if ($args.Count) { $args -join ' ' } else { "Version $version" }

Remove-Item dist\latest.yml, "dist\Programas-Setup-$version.*" -ErrorAction SilentlyContinue
npm.cmd run instalador
if ($LASTEXITCODE) { throw 'No se pudo crear el instalador' }

$archivos = "dist\Programas-Setup-$version.exe", "dist\Programas-Setup-$version.exe.blockmap", 'dist\latest.yml'
gh release create "v$version" @archivos --title "Programas $version" --notes $notas
if ($LASTEXITCODE) { throw 'No se pudo publicar en GitHub' }
Write-Host "Listo: version $version publicada."
