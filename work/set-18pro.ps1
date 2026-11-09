param([string]$In, [string]$Out, [string]$Report)
# Put the owner's iPhone 18 Pro photo on every iPhone 18 Pro / Pro Max product.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$site = [IO.File]::ReadAllText($In, $utf8) | ConvertFrom-Json
$lines = @()
foreach($p in $site.products){
  $key = ($p.n -replace '[\s　]','').ToLower()
  if($key -match 'iphone18pro'){
    $prev = if($p.img){ " (replaced $($p.img))" } else { '' }
    $p.img = 'img/iphone18pro.jpg'
    $lines += "$($p.n)$prev"
  }
}
[IO.File]::WriteAllText($Out, (ConvertTo-Json -InputObject $site -Depth 14 -Compress), $utf8)
[IO.File]::WriteAllText($Report, "COUNT $($lines.Count)`n" + ($lines -join "`n"), $utf8)
"done"
