param([string]$Site, [string]$Dir, [string]$Out, [string]$Report, [switch]$Apply)
# Match our products to 買取1丁目 (1-chome.com) and set our buying prices to theirs.
#   their 新品 entry : 未開封/新品 → new, 開封済未使用 → opened, per-colour varPrice → colour options
#   their 中古品 entry: best non-junk grade (A) → used
# Match by JAN first, then by normalised model name. Changes beyond ×0.4–×2.5 are reported, not applied.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Core

function Norm([string]$t){
  if(-not $t){ return '' }
  $t = $t.Normalize([Text.NormalizationForm]::FormKC).ToLowerInvariant()
  $t = [regex]::Replace($t, '[【\[（(][^】\]）)]*(新品|中古|国内版|simフリー|sim free|正規品)[^】\]）)]*[】\]）)]', '')
  $t = $t -replace 'simフリー|sim free|国内版|正規品|新品|未開封', ''
  return ($t -replace '[\s　・\-_/【】\[\]（）()「」"''◆★☆,.、。]', '')
}
function Round100($v){ return [int]([Math]::Round($v / 100.0) * 100) }
# key specs that must agree before two listings count as the same product
function Specs([string]$t){
  $u = $t.Normalize([Text.NormalizationForm]::FormKC).ToLowerInvariant()
  $caps = @([regex]::Matches($u, '(\d+(?:\.\d+)?)\s*(tb|gb|g)(?![a-z])') | ForEach-Object { $v=[double]$_.Groups[1].Value; if($_.Groups[2].Value -eq 'tb'){ $v*1024 } else { $v } })
  $words = @([regex]::Matches($u, '(?<![a-z])(pro|max|plus|mini|ultra|air|fold|flip|fe|lite|duo|xl|se|edge)(?![a-z])') | ForEach-Object { $_.Value } | Sort-Object -Unique)
  return [pscustomobject]@{
    cap   = $(if($caps){ ($caps | Measure-Object -Maximum).Maximum } else { $null })
    ncap  = @($caps | Where-Object { $_ -ge 32 } | Sort-Object -Unique).Count
    words = ($words -join ',')
    inch  = $(if($u -match '(\d{2})(?:\.\d)?\s*(インチ|inch|型)'){ $matches[1] } else { $null })
    chip  = $(if($u -match '(?<![a-z0-9])(m\d)(?:\s*(pro|max))?\s*(チップ|chip)?(?![0-9])' -and $u -match '(?:macbook|ipad|imac|mac)'){ $matches[1] } else { $null })
    mm    = $(if($u -match '(\d{2})\s*mm'){ $matches[1] } else { $null })
    gen   = $(if($u -match '第\s*(\d+)\s*世代'){ $matches[1] } else { $null })
    num   = $(if($u -match '(?:iphone|pixel|galaxy [sazn]|switch|ps|series|watch series)\s*(\d+[a-z]?)'){ $matches[1] } else { $null })
  }
}
function Same($a, $b){
  $x = Specs $a; $y = Specs $b
  if($x.ncap -gt 1){ return $false }                       # our listing groups several capacities
  foreach($k in 'cap','inch','chip','mm','gen','num'){ if($null -ne $x.$k -and $null -ne $y.$k -and [string]$x.$k -ne [string]$y.$k){ return $false } }
  $ca = @(Codes $a | Where-Object { $_ -match '/A$|^SM-|^SC[G-]|^[A-Z]\d{3}[A-Z]{2}$' }); $cb = @(Codes $b | Where-Object { $_ -match '/A$|^SM-|^SC[G-]|^[A-Z]\d{3}[A-Z]{2}$' })
  if($ca.Count -and $cb.Count -and -not ($ca | Where-Object { $cb -contains $_ })){ return $false }   # both show model numbers and none match
  return ($x.words -eq $y.words)
}
function Codes([string]$t){
  $u = $t.Normalize([Text.NormalizationForm]::FormKC).ToUpperInvariant()
  return @([regex]::Matches($u, '(?<![A-Z0-9])[A-Z]{1,5}-?\d[A-Z0-9]{2,8}(?:/A)?(?:-[A-Z0-9]{2,6})?(?![A-Z0-9])') | ForEach-Object { $_.Value } |
    Where-Object { $_ -match '[A-Z]' -and $_ -match '\d' -and $_.Length -ge 5 -and $_ -notmatch '^\d+(GB|TB|MM)$|^(GPS|USB|WIFI)' } | Sort-Object -Unique)
}
$newEx  = '開封済|開封品|開封未使用|開封新品|使用感|傷|ジャンク|来店|難あり|欠品|中古|箱なし|本体のみ'
$openRx = '開封済|開封品|開封未使用|開封新品'

# ---- their catalogue → one record per normalised title ----
$theirs = @{}; $byJan = @{}; $byCode = @{}
foreach($f in Get-ChildItem (Join-Path $Dir 'pg*.json')){
  $j = [IO.File]::ReadAllText($f.FullName, $utf8) | ConvertFrom-Json
  foreach($g in $j.data.content){
    $k = Norm $g.title; if(-not $k){ continue }
    if(-not $theirs[$k]){ $theirs[$k] = [pscustomobject]@{ title=$g.title; new=0; opened=0; used=0; colors=@{}; ids=@() } }
    $r = $theirs[$k]; $r.ids += $g.goodsId
    $d = @($g.goodsKbDetails | Where-Object { $_.kbDetailPrice -gt 0 })
    if($g.kbName -eq '中古品'){
      $best = ($d | Where-Object { $_.kbDetailName -notmatch 'ジャンク|^J' } | Measure-Object kbDetailPrice -Maximum).Maximum
      if($best -gt $r.used){ $r.used = [int]$best }
    } else {
      $nw = ($d | Where-Object { $_.kbDetailName -notmatch $newEx } | Measure-Object kbDetailPrice -Maximum).Maximum
      $op = ($d | Where-Object { $_.kbDetailName -match $openRx } | Measure-Object kbDetailPrice -Maximum).Maximum
      if($nw -gt $r.new){ $r.new = [int]$nw }
      if($op -gt $r.opened){ $r.opened = [int]$op }
      # colour adjustments on the 未開封/新品 detail
      $newDetail = $d | Where-Object { $_.kbDetailName -notmatch $newEx } | Sort-Object kbDetailPrice -Descending | Select-Object -First 1
      foreach($c in @($g.keitaiColorOptions)){
        if(-not $c){ continue }
        $rel = @($c.keitaiKbDetailColorRels) | Where-Object { $newDetail -and $_.keitaiKbDetailId -eq $newDetail.allGoodsKbDetailId } | Select-Object -First 1
        $cn = Norm $c.color; if($cn){ $r.colors[$cn] = [int]($(if($rel -and $rel.varPrice){ $rel.varPrice } else { 0 })) }
        if($c.jan){ $byJan[[string]$c.jan] = $r }
      }
    }
    if($g.jan){ $byJan[[string]$g.jan] = $r }
    foreach($m in [regex]::Matches([string]$g.title, '\b\d{13}\b')){ $byJan[$m.Value] = $r }
    foreach($c in (Codes $g.title)){ if(-not $byCode.ContainsKey($c)){ $byCode[$c] = $r } elseif($byCode[$c] -ne $r){ $byCode[$c] = 'AMBIG' } }
  }
}
"their records: $($theirs.Count), JANs: $($byJan.Count), model codes: $($byCode.Count)"

# ---- ours ----
$s = [IO.File]::ReadAllText($Site, $utf8) | ConvertFrom-Json
$rows = New-Object System.Collections.ArrayList; $skipped = New-Object System.Collections.ArrayList
$matched = 0; $changed = 0; $byJ = 0; $byN = 0
foreach($p in $s.products){
  $r = $null; $how = ''
  $jan = [string]$p.jan
  if($jan -match '^\d{13}$' -and $byJan[$jan] -and (Same $p.n $byJan[$jan].title)){ $r = $byJan[$jan]; $how = 'JAN' }
  if(-not $r){ $r = $theirs[(Norm $p.n)]; if($r){ $how = '名称' } }
  if(-not $r){ foreach($c in (Codes $p.n)){ $cand = $byCode[$c]; if($cand -and $cand -ne 'AMBIG' -and (Same $p.n $cand.title)){ $r = $cand; $how = '型番'; break } } }
  if(-not $r -or ($r.new -le 0 -and $r.used -le 0)){ continue }
  $matched++; if($how -eq 'JAN'){ $byJ++ } else { $byN++ }
  $oldNew = [int]$p.new; $oldUsed = $(if($p.used){ [int]$p.used } else { 0 })
  $tNew = $r.new; $tUsed = $r.used; $tOpen = $r.opened
  $ok = { param($o,$n) if($o -le 0 -or $n -le 0){ return $true }; $q = $n / $o; return ($q -ge 0.4 -and $q -le 2.5) }
  $bad = @()
  if($tNew -gt 0 -and -not (& $ok $oldNew $tNew)){ $bad += "新品 $oldNew→$tNew" }
  if($tUsed -gt 0 -and $oldUsed -gt 0 -and -not (& $ok $oldUsed $tUsed)){ $bad += "中古 $oldUsed→$tUsed" }
  if($bad){ [void]$skipped.Add("$($p.n)  ⇔  $($r.title)  [$how]  " + ($bad -join ', ')); continue }

  $newP = $(if($tNew -gt 0){ $tNew } else { $oldNew })
  $usedP = $(if($tUsed -gt 0){ $tUsed } elseif($oldUsed -gt 0 -and $tNew -gt 0 -and $oldNew -gt 0){ Round100($oldUsed * $newP / $oldNew) } else { $p.used })
  $openP = $tOpen
  if($Apply){
    $p.new = $newP; if($null -ne $usedP){ $p.used = $usedP }
    if($p.opts){
      foreach($c in $p.opts){
        $max = ($c.options | Measure-Object price -Maximum).Maximum
        $target = switch($c.type){ 'new' { $newP } 'opened' { $(if($openP -gt 0){ $openP } elseif($max -gt 0 -and $oldNew -gt 0){ Round100($max * $newP / $oldNew) } else { 0 }) } 'used' { $(if($usedP){ [int]$usedP } else { 0 }) } default { 0 } }
        if($target -le 0 -or -not $max){ continue }
        foreach($o in $c.options){
          if(-not $o.price){ continue }
          $cn = Norm $o.label
          if($c.type -eq 'new' -and $r.colors.ContainsKey($cn)){ $o.price = $target + $r.colors[$cn] }
          else { $o.price = Round100($o.price * $target / $max) }
        }
      }
    }
  }
  if($newP -ne $oldNew -or ($null -ne $usedP -and [int]$usedP -ne $oldUsed)){ $changed++ }
  $dn = $newP - $oldNew
  [void]$rows.Add([pscustomobject]@{ name=$p.n; how=$how; their=$r.title; oldNew=$oldNew; newNew=$newP; diff=$dn; oldUsed=$oldUsed; newUsed=$usedP; opened=$openP })
}
"matched: $matched (JAN $byJ, name $byN) of $(@($s.products).Count); changed: $changed; skipped as suspicious: $($skipped.Count)"
$up = @($rows | Where-Object { $_.diff -gt 0 }).Count; $down = @($rows | Where-Object { $_.diff -lt 0 }).Count
"new-price up: $up, down: $down, same: $(@($rows).Count - $up - $down)"
$lines = @('商品,照合,買取1丁目の商品名,新品(旧),新品(新),差額,中古(旧),中古(新),開封(1丁目)')
foreach($x in $rows){ $lines += ('"{0}",{1},"{2}",{3},{4},{5},{6},{7},{8}' -f $x.name,$x.how,$x.their,$x.oldNew,$x.newNew,$x.diff,$x.oldUsed,$x.newUsed,$x.opened) }
$lines += ''; $lines += '要確認（差が大きいため変更していません）'; $lines += $skipped
[IO.File]::WriteAllText($Report, ($lines -join "`r`n"), (New-Object Text.UTF8Encoding($true)))
if($Apply){ [IO.File]::WriteAllText($Out, (ConvertTo-Json -InputObject $s -Depth 14 -Compress), $utf8); "written: $Out" }
"--- biggest changes:"; $rows | Sort-Object { [Math]::Abs($_.diff) } -Descending | Select-Object -First 12 | ForEach-Object { "  $($_.name): $($_.oldNew) → $($_.newNew) [$($_.how)]" }
"--- suspicious (first 8):"; $skipped | Select-Object -First 8 | ForEach-Object { "  $_" }
