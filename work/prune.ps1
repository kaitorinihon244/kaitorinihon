$ErrorActionPreference = 'Stop'
$w = $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding($false)
$site = [IO.File]::ReadAllText((Join-Path $w 'live2\data\site.json'), $utf8) | ConvertFrom-Json
# Sample products are the built-in starters: ids 1-47, no import source, no owner photo.
$keep = New-Object System.Collections.ArrayList; $removed = @(); $kept = @()
foreach($p in $site.products){
  $isImport = [bool]$p.PSObject.Properties['src']
  $hasPhoto = [bool]$p.img
  $isStarter = ([int]$p.id -ge 1 -and [int]$p.id -le 47)
  if($isStarter -and -not $isImport -and -not $hasPhoto){ $removed += "$($p.id) $($p.n)" }
  else { [void]$keep.Add($p); if(-not $isImport){ $kept += "$($p.id) $($p.n)" } }
}
$site.products = $keep.ToArray()
$json = ConvertTo-Json -InputObject $site -Depth 12 -Compress
[IO.File]::WriteAllText((Join-Path $w 'site.json'), $json, $utf8)
$report = "REMOVED $($removed.Count)`n" + ($removed -join "`n") + "`nKEPT (yours) $($kept.Count)`n" + ($kept -join "`n") + "`nTOTAL $($site.products.Count)"
[IO.File]::WriteAllText((Join-Path $w 'prune-report.txt'), $report, $utf8)
"done"
