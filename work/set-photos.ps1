param([string]$In, [string]$Out, [string]$Report)
# Attach the owner's model photos to matching iPhones that have no photo yet.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$site = [IO.File]::ReadAllText($In, $utf8) | ConvertFrom-Json
$rules = @(
  @{ rx = 'iphone17pro';               img = 'img/iphone17pro.jpg'; name = 'iPhone 17 Pro / Pro Max' },
  @{ rx = 'iphone17(?!pro|e|air)';     img = 'img/iphone17.jpg';    name = 'iPhone 17' },
  @{ rx = 'iphone16pro';               img = 'img/iphone16pro.jpg'; name = 'iPhone 16 Pro / Pro Max' },
  @{ rx = 'iphone16(?!pro|e)';         img = 'img/iphone16.jpg';    name = 'iPhone 16 / 16 Plus' }
)
$lines = @(); $count = @{}; $kept = @()
foreach($p in $site.products){
  $key = ($p.n -replace '[\s　]','').ToLower()
  foreach($r in $rules){
    if($key -match $r.rx){
      if($p.img){ $kept += $p.n; break }
      $p.img = $r.img
      $count[$r.name] = 1 + [int]$count[$r.name]
      $lines += "$($r.name) <- $($p.n)"
      break
    }
  }
}
$json = ConvertTo-Json -InputObject $site -Depth 14 -Compress
[IO.File]::WriteAllText($Out, $json, $utf8)
$summary = ($count.GetEnumerator() | ForEach-Object { "$($_.Key): $($_.Value)" }) -join "`n"
[IO.File]::WriteAllText($Report, "$summary`nKEPT OWN PHOTO: $($kept -join ' / ')`n---`n" + ($lines -join "`n"), $utf8)
"done"
