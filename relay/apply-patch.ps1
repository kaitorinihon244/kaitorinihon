param([string]$Dir, [string]$Patch = 'security-patch.json')
# Applies security-patch.json to the local relay files (the same list is applied in the Apps Script editor).
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$pairs = [IO.File]::ReadAllText((Join-Path $Dir $Patch), $utf8) | ConvertFrom-Json
$files = @{}
foreach($p in $pairs){
  if(-not $files[$p.f]){ $files[$p.f] = [IO.File]::ReadAllText((Join-Path $Dir $p.f), $utf8).Replace("`r`n", "`n") }
  $t = $files[$p.f]; $n = ([regex]::Matches($t, [regex]::Escape($p.old))).Count
  if($n -eq 0){ if($p.opt){ "skip (optional): $($p.f) $($p.old.Substring(0,30))"; continue } else { throw "not found in $($p.f): $($p.old)" } }
  if($n -gt 1 -and -not $p.all){ throw "found $n times in $($p.f): $($p.old)" }
  $files[$p.f] = $t.Replace($p.old, $p.new); "ok: $($p.f) x$n"
}
foreach($k in $files.Keys){ [IO.File]::WriteAllText((Join-Path $Dir $k), $files[$k], $utf8) }
"saved: " + ($files.Keys -join ', ')
