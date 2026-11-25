param([string]$Root)
# Builds site/ + kaitori-site.zip for a normal web host (Cloudflare Pages), with security headers in _headers.
# Inline scripts are allowed only by their SHA-256 fingerprint, so injected scripts cannot run.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$out = Join-Path $Root 'site'
if(Test-Path $out){ Remove-Item $out -Recurse -Force -Confirm:$false }
New-Item -ItemType Directory -Force (Join-Path $out 'data') | Out-Null
$body = [IO.File]::ReadAllText((Join-Path $Root 'uridoki.html'), $utf8)
$html = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="strict-origin-when-cross-origin"></head><body>' + $body + '</body></html>'
[IO.File]::WriteAllText((Join-Path $out 'index.html'), $html, $utf8)
Copy-Item (Join-Path $Root 'work\site.json') (Join-Path $out 'data\site.json')
# translations (data/i18n/<code>.json); source.json is the extracted Japanese list and is not served
New-Item -ItemType Directory -Force (Join-Path $out 'data\i18n') | Out-Null
Get-ChildItem (Join-Path $Root 'work\i18n') -Filter *.json -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin @('source.json','keys.json','harvest.json') } | ForEach-Object { Copy-Item $_.FullName (Join-Path $out ('data\i18n\' + $_.Name)) }
Copy-Item (Join-Path $Root 'img') (Join-Path $out 'img') -Recurse
Copy-Item (Join-Path $Root 'hero-products-hd.jpg') $out

# SEO: head tags + structured data in index.html, static price pages, robots.txt, sitemap.xml, 404.html, favicon.svg
& node (Join-Path $Root 'work\seo-build.js') $Root
if($LASTEXITCODE){ throw 'seo-build.js failed' }
$html = [IO.File]::ReadAllText((Join-Path $out 'index.html'), $utf8)
# icons and share image made from the logo (see logos/README.txt)
Copy-Item (Join-Path $Root 'brand\*') $out

$sha = [Security.Cryptography.SHA256]::Create()
$hashes = foreach($m in [regex]::Matches($html, '<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>')){
  "'sha256-" + [Convert]::ToBase64String($sha.ComputeHash($utf8.GetBytes($m.Groups[1].Value))) + "'"
}
$scriptSrc = "script-src 'self' https://unpkg.com " + (@($hashes) -join ' ')
$csp = @(
  "default-src 'self'",
  $scriptSrc,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://script.google.com https://script.googleusercontent.com",
  "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'", "object-src 'none'", "upgrade-insecure-requests"
) -join '; '
$headers = @"
/*
  Content-Security-Policy: $csp
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin

/data/*
  Cache-Control: no-cache

https://kaitorinihon.pages.dev/*
  X-Robots-Tag: noindex

https://:preview.kaitorinihon.pages.dev/*
  X-Robots-Tag: noindex

https://www.kaitorinihon.jp/*
  X-Robots-Tag: noindex
"@
[IO.File]::WriteAllText((Join-Path $out '_headers'), $headers.Replace("`r`n", "`n"), $utf8)
$zip = Join-Path $Root 'kaitori-site.zip'; if(Test-Path $zip){ Remove-Item $zip -Confirm:$false }
# not Compress-Archive: on Windows PowerShell it writes backslash paths, which web hosts read as odd file names
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($zip, 'Create')
try {
  $base = (Get-Item $out).FullName.TrimEnd('\') + '\'
  foreach($f in Get-ChildItem $out -Recurse -File){
    $name = $f.FullName.Substring($base.Length).Replace('\', '/')
    $entry = $archive.CreateEntry($name, 'Optimal')
    $to = $entry.Open()
    # OneDrive may hold a just-written file for a moment, so read it with sharing allowed
    $from = [IO.File]::Open($f.FullName, 'Open', 'Read', 'ReadWrite,Delete')
    try { $from.CopyTo($to) } finally { $from.Dispose(); $to.Dispose() }
  }
} finally { $archive.Dispose() }
"inline scripts pinned: $(@($hashes).Count); zip: " + [Math]::Round((Get-Item $zip).Length/1MB,2) + " MB"
