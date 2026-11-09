param([int]$Port = 8765)
# Local preview: serves uridoki.html wrapped like the published artifact,
# images from this folder, and data/site.json from work/site.json.
$root = Split-Path -Parent $PSScriptRoot
$l = New-Object Net.HttpListener; $l.Prefixes.Add("http://localhost:$Port/"); $l.Start()
$types = @{ '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.png'='image/png'; '.webp'='image/webp'; '.svg'='image/svg+xml'; '.json'='application/json'; '.css'='text/css'; '.js'='text/javascript' }
while($l.IsListening){
  $c = $l.GetContext(); $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
  try {
    if($p -eq '' -or $p -eq 'index.html'){
      $body = [IO.File]::ReadAllText((Join-Path $root 'uridoki.html'), [Text.Encoding]::UTF8)
      $html = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + $body + '</body></html>'
      $b = [Text.Encoding]::UTF8.GetBytes($html); $c.Response.ContentType = 'text/html; charset=utf-8'
    } elseif($p -eq 'data/site.json'){
      $b = [IO.File]::ReadAllBytes((Join-Path $root 'work\site.json')); $c.Response.ContentType = 'application/json'
    } else {
      $f = Join-Path $root $p
      if((Test-Path $f -PathType Leaf) -and $p -notmatch '\.json$'){ $b = [IO.File]::ReadAllBytes($f); $ext = [IO.Path]::GetExtension($f).ToLower(); $c.Response.ContentType = $(if($types[$ext]){ $types[$ext] } else { 'application/octet-stream' }) }
      else { $c.Response.StatusCode = 404; $b = [Text.Encoding]::UTF8.GetBytes('not found') }
    }
    $c.Response.OutputStream.Write($b, 0, $b.Length)
  } catch { $c.Response.StatusCode = 500 } finally { $c.Response.Close() }
}
