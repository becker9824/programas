# Servidor local de la app "Programas".
# Sirve los archivos de esta carpeta en http://localhost:8765 y consulta
# la Guía de actividades en wol.jw.org (el navegador no puede hacerlo solo).
# Se cierra solo después de 2 horas sin uso.

param([switch]$SinNavegador)

$port = 8765
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$url  = "http://localhost:$port/"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
try { $listener.Start() }
catch {
  # Ya hay uno abierto: solo abrimos la app.
  if (-not $SinNavegador) { Start-Process $url }
  exit
}
if (-not $SinNavegador) { Start-Process $url }

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.ico' = 'image/x-icon'
}

function Send($ctx, [int]$status, [string]$type, [byte[]]$bytes) {
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = $type
  $ctx.Response.Headers.Add('Cache-Control', 'no-store')
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
}
function SendText($ctx, [int]$status, [string]$text, [string]$type = 'text/plain; charset=utf-8') {
  Send $ctx $status $type ([Text.Encoding]::UTF8.GetBytes($text))
}
function Get-Utf8([string]$u) {
  $r = Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 30 -Headers @{ 'User-Agent' = 'Mozilla/5.0' }
  $ms = New-Object IO.MemoryStream
  $r.RawContentStream.CopyTo($ms)
  [Text.Encoding]::UTF8.GetString($ms.ToArray())
}

while ($listener.IsListening) {
  $async = $listener.BeginGetContext($null, $null)
  if (-not $async.AsyncWaitHandle.WaitOne(7200000)) { break }
  $ctx = $listener.EndGetContext($async)
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)

    if ($path -eq '/jw/ping') { SendText $ctx 200 'ok'; continue }

    if ($path -eq '/jw/semana') {
      # Guía de actividades de una semana: ?y=2026&w=43 (semana ISO)
      $y = 0; $w = 0
      if (-not [int]::TryParse($ctx.Request.QueryString['y'], [ref]$y) -or
          -not [int]::TryParse($ctx.Request.QueryString['w'], [ref]$w) -or
          $y -lt 2020 -or $y -gt 2100 -or $w -lt 1 -or $w -gt 53) {
        SendText $ctx 400 'Semana no valida'; continue
      }
      $week = Get-Utf8 "https://wol.jw.org/es/wol/meetings/r4/lp-s/$y/$w"
      $m = [regex]::Match($week, 'href="(/es/wol/d/r4/lp-s/\d+)"\s+class="[^"]*pub-mwb')
      if (-not $m.Success) { SendText $ctx 404 'Sin guia para esta semana'; continue }
      $doc = Get-Utf8 ("https://wol.jw.org" + $m.Groups[1].Value)
      SendText $ctx 200 $doc 'text/html; charset=utf-8'
      continue
    }

    if ($path -eq '/jw/titulo') {
      # Título de un documento de wol.jw.org (se usa para los nombres de las canciones)
      $p = $ctx.Request.QueryString['path']
      if (-not $p -or $p -notmatch '^/es/wol/(d|pc)/r4/lp-s/[0-9/]+$') { SendText $ctx 400 'Ruta no valida'; continue }
      $html = Get-Utf8 ("https://wol.jw.org" + $p)
      $t = [regex]::Match($html, '<title>([^<]*)</title>').Groups[1].Value
      $t = [Net.WebUtility]::HtmlDecode(($t -split '&mdash;')[0]).Trim()
      SendText $ctx 200 $t
      continue
    }

    # Archivos de la carpeta
    if ($path -eq '/') { $path = '/index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))
    if (-not $file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $file -PathType Leaf)) {
      SendText $ctx 404 'No encontrado'; continue
    }
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $type = $types[$ext]; if (-not $type) { $type = 'application/octet-stream' }
    Send $ctx 200 $type ([IO.File]::ReadAllBytes($file))
  }
  catch {
    try { SendText $ctx 502 ("Error: " + $_.Exception.Message) } catch {}
  }
  finally {
    try { $ctx.Response.Close() } catch {}
  }
}
$listener.Stop()
