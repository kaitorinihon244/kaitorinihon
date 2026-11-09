param([string]$Base, [string]$Old, [string]$Fresh, [string]$Out)
# Add a laptop tab and every MacBook from mobileone, at today's prices.
# Keeps colour/grade options collected earlier, scaled to the new price.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$site = [IO.File]::ReadAllText($Base, $utf8) | ConvertFrom-Json
$oldSite = [IO.File]::ReadAllText($Old, $utf8) | ConvertFrom-Json
$freshList = [IO.File]::ReadAllText($Fresh, $utf8) | ConvertFrom-Json | ForEach-Object { $_ }

$byGid = @{}
foreach($p in $oldSite.products){ if("$($p.src)" -match '^mobileone:(\d+)$'){ $byGid[$Matches[1]] = $p } }
$have = @{}
foreach($p in $site.products){ if("$($p.src)" -match '^mobileone:(\d+)$'){ $have[$Matches[1]] = 1 } }

function Scale($opts, [string]$type, $from, $to){
  if(-not $from -or -not $to -or $from -eq $to){ return }
  foreach($c in $opts){ if($c.type -eq $type){ foreach($o in $c.options){ if($o.price){ $o.price = [int]([math]::Round($o.price * $to / $from / 100) * 100) } } } }
}

$added = New-Object System.Collections.ArrayList
$nextId = 900000
foreach($f in $freshList){
  if($f.n -notmatch '(?i)macbook'){ continue }
  $g = [string]$f.gid
  if($have.ContainsKey($g)){ continue }
  $nw = if($f.nw -gt 0){ [int]$f.nw } else { $null }
  $us = if($f.us -gt 0){ [int]$f.us } else { $null }
  if($byGid.ContainsKey($g)){
    $p = $byGid[$g]
    if($p.opts){ Scale $p.opts 'new' $p.new $nw; Scale $p.opts 'opened' $p.new $nw; Scale $p.opts 'used' $p.used $us }
    $p.new = $nw; $p.used = $us
  } else {
    $nextId++
    $p = [pscustomobject]@{ id=$nextId; n=$f.n; jan=$f.jan; memo=''; a=@('laptop'); img=$null; new=$nw; used=$us; kyo=$false; featured=$false; delta=0; carriers=@(); src="mobileone:$g" }
  }
  $p.t = 'pc'
  $p | Add-Member -NotePropertyName cat -NotePropertyValue 'MacBook' -Force
  [void]$added.Add($p)
}

# newest first, like mobileone's list order
$site.products = @($site.products) + @($added)

if(-not ($site.tabs | Where-Object { $_.id -eq 'pc' })){
  $tab = [pscustomobject]@{ id='pc'; label='MacBook・ノートPC'; side='パソコン'; shortcuts=@('MacBook Air','MacBook Pro','M5','M4','M3') }
  $tabs = New-Object System.Collections.ArrayList
  foreach($t in $site.tabs){ [void]$tabs.Add($t); if($t.id -eq 'tablet'){ [void]$tabs.Add($tab) } }
  if(-not ($tabs | Where-Object { $_.id -eq 'pc' })){ [void]$tabs.Add($tab) }
  $site.tabs = @($tabs)
}
if(-not ($site.categories | Where-Object { $_.tab -eq 'pc' })){
  $site.categories = @($site.categories) + @([pscustomobject]@{ label='MacBook'; tab='pc'; q='MacBook'; a=@('laptop'); img=$null })
}

[IO.File]::WriteAllText($Out, (ConvertTo-Json -InputObject $site -Depth 14 -Compress), $utf8)
"ADDED $($added.Count) (with options: $(@($added | Where-Object { $_.opts }).Count))"
"PRODUCTS NOW $($site.products.Count)"
"TABS: " + (($site.tabs | ForEach-Object { $_.label }) -join ', ')
