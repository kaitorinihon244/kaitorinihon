param([string]$In, [string]$Out, [string]$Report, [string]$Rx, [string]$Img)
# Put one photo ($Img, a published path like img/x.jpg) on every product whose
# name (spaces removed, lower-case) matches the regex $Rx.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$site = [IO.File]::ReadAllText($In, $utf8) | ConvertFrom-Json
$lines = @()
foreach($p in $site.products){
  $key = ($p.n -replace '[\s　]','').ToLower()
  if($key -match $Rx){
    $prev = if($p.img -and $p.img -ne $Img){ " (replaced $($p.img))" } else { '' }
    $p.img = $Img
    $lines += "$($p.n)$prev"
  }
}
[IO.File]::WriteAllText($Out, (ConvertTo-Json -InputObject $site -Depth 14 -Compress), $utf8)
[IO.File]::WriteAllText($Report, "COUNT $($lines.Count)`n" + ($lines -join "`n"), $utf8)
"COUNT $($lines.Count)"
