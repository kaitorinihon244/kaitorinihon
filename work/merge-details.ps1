param([string]$Base, [string]$Out)
# Adds condition/option specs (colour, grade…) from details*.jsonl to the imported products in $Base.
$ErrorActionPreference = 'Stop'
$w = $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding($false)
$site = [IO.File]::ReadAllText($Base, $utf8) | ConvertFrom-Json
$det = @{}
foreach($f in (Get-ChildItem $w -Filter 'details*.jsonl')){
  foreach($l in [IO.File]::ReadAllLines($f.FullName, $utf8)){ if($l.Trim()){ $d = $l | ConvertFrom-Json; $det["mobileone:$($d.gid)"] = $d } }
}
$typeOf = @{ 1='new'; 3='opened'; 2='used' }
$withOpts = 0; $optCount = 0
foreach($p in $site.products){
  if(-not $p.PSObject.Properties['src']){ continue }
  $d = $det[[string]$p.src]; if(-not $d){ continue }
  $conds = @()
  foreach($c in $d.conds){
    $opts = @()
    foreach($o in $c.options){ $pr = if($o.price -and [int]$o.price -gt 0){ [int]$o.price } else { $null }; $opts += [pscustomobject][ordered]@{ label=[string]$o.label; price=$pr } }
    if($opts.Count -eq 0){ continue }
    $t = if($typeOf.ContainsKey([int]$c.type)){ $typeOf[[int]$c.type] } else { 'new' }
    $conds += [pscustomobject][ordered]@{ type=$t; label=[string]$c.label; options=@($opts) }
    $optCount += $opts.Count
  }
  if($conds.Count -gt 0){
    if($p.PSObject.Properties['opts']){ $p.opts = @($conds) } else { $p | Add-Member -NotePropertyName opts -NotePropertyValue @($conds) }
    $withOpts++
  }
}
$json = ConvertTo-Json -InputObject $site -Depth 14 -Compress
[IO.File]::WriteAllText($Out, $json, $utf8)
"details=$($det.Count) products_with_options=$withOpts options=$optCount bytes=$($json.Length)"
