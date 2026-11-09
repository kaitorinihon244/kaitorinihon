param([int]$Port = 8767, [string]$Dir = 'site')
# Plain static server for the uploadable site/ folder (tests it the way a web host serves it).
$root = Join-Path (Split-Path -Parent $PSScriptRoot) $Dir
$l = New-Object Net.HttpListener; $l.Prefixes.Add("http://localhost:$Port/"); $l.Start()
# send the same headers Cloudflare Pages would, from site/_headers (the "/*" block)
$hdrs = @(); $hf = Join-Path $root '_headers'
if(Test-Path $hf){ $in = $false; foreach($line in Get-Content $hf -Encoding UTF8){ if($line -match '^\S'){ $in = ($line.Trim() -eq '/*') } elseif($in -and $line -match '^\s+([^:]+):\s*(.+)$'){ $hdrs += ,@($matches[1], $matches[2]) } } }
$types = @{ '.html'='text/html; charset=utf-8'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.png'='image/png'; '.webp'='image/webp'; '.svg'='image/svg+xml'; '.json'='application/json'; '.css'='text/css'; '.js'='text/javascript' }
while($l.IsListening){
  $c = $l.GetContext(); $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
  if($p -eq ''){ $p = 'index.html' }
  $f = Join-Path $root $p
  try {
    if((Test-Path $f -PathType Leaf) -and ([IO.Path]::GetFullPath($f).StartsWith([IO.Path]::GetFullPath($root)))){
      $b = [IO.File]::ReadAllBytes($f); $ext = [IO.Path]::GetExtension($f).ToLower()
      $c.Response.ContentType = $(if($types[$ext]){ $types[$ext] } else { 'application/octet-stream' })
      foreach($h in $hdrs){ if($h[0] -ne 'Strict-Transport-Security'){ $c.Response.Headers[$h[0]] = ($h[1] -replace 'upgrade-insecure-requests', '') } }
      $c.Response.OutputStream.Write($b, 0, $b.Length)
    } else { $c.Response.StatusCode = 404 }
  } catch { $c.Response.StatusCode = 500 }
  $c.Response.Close()
}
