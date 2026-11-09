param([string]$In, [string]$Out, [int]$Part = 0, [int]$Of = 1)
# For every product: read its detail page (conditions + option names/ids), then look up each option's price.
# Polite: one request at a time with a pause. Resumable: results are appended to $Out (one JSON line per product).
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$utf8 = New-Object Text.UTF8Encoding($false)
$src = [IO.File]::ReadAllText($In, $utf8) | ConvertFrom-Json
$done = @{}
foreach($f in (Get-ChildItem (Split-Path $Out) -Filter "details*.jsonl")){ foreach($l in [IO.File]::ReadAllLines($f.FullName, $utf8)){ if($l -match '"gid":(\d+)'){ $done[$Matches[1]] = 1 } } }
function Get([string]$url){
  for($i=0; $i -lt 3; $i++){
    try { $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 30; return [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) }
    catch { Start-Sleep -Seconds (2 + 3*$i) }
  }
  return $null
}
function Clean([string]$s){ $s = [Net.WebUtility]::HtmlDecode(($s -replace '<[^>]+>',' ')); return (($s -replace '[\s　]+',' ').Trim()) }
$condRx = [regex]'(?s)<div class="proDeta8">(.*?)</div>'
$condItem = [regex]'(?s)<span[^>]*\$\(''#parr2''\)\.val\((\d+)\)[^>]*>(.*?)</span>'
$groupRx = [regex]'(?s)<div class="proDeta9a[^"]*">(.*?)</div>'
$optRx = [regex]'(?s)<span onclick="get_price\((\d+)\)">(.*?)</span>'
$descRx = [regex]'(?s)<div class="proDeta6">(.*?)</div>'
$n = 0
$idx = -1
foreach($s in $src){
  $idx++; if(($idx % $Of) -ne $Part){ continue }
  if($s.nw -eq 0 -and $s.us -eq 0){ continue }
  if($done.ContainsKey([string]$s.gid)){ continue }
  $html = Get "https://mobileone.co.jp/gdetail/$($s.gid).html"
  if(-not $html){ continue }
  $conds = @()
  $cm = $condRx.Match($html)
  if($cm.Success){ foreach($c in $condItem.Matches($cm.Groups[1].Value)){ $conds += [pscustomobject]@{ type=[int]$c.Groups[1].Value; label=(Clean $c.Groups[2].Value) } } }
  $groups = $groupRx.Matches($html)
  $res = @()
  for($g=0; $g -lt $groups.Count; $g++){
    $opts = @()
    foreach($o in $optRx.Matches($groups[$g].Groups[1].Value)){
      Start-Sleep -Milliseconds 90
      $j = Get "https://mobileone.co.jp/get_attr.html?attr_id=$($o.Groups[1].Value)&times=$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())"
      $price = $null
      if($j){ try { $d = $j | ConvertFrom-Json; if($d.code -eq 0){ $price = [int]$d.data.price } } catch {} }
      $opts += [pscustomobject]@{ id=[int]$o.Groups[1].Value; label=(Clean $o.Groups[2].Value); price=$price }
    }
    $label = if($g -lt $conds.Count){ $conds[$g].label } else { "条件$($g+1)" }
    $type = if($g -lt $conds.Count){ $conds[$g].type } else { 0 }
    $res += [pscustomobject]@{ type=$type; label=$label; options=@($opts) }
  }
  $desc = ''
  $dm = $descRx.Match($html); if($dm.Success){ $desc = Clean $dm.Groups[1].Value }
  $line = ConvertTo-Json -InputObject ([pscustomobject]@{ gid=$s.gid; desc=$desc; conds=@($res) }) -Depth 6 -Compress
  [IO.File]::AppendAllText($Out, $line + "`n", $utf8)
  $n++
  if($n % 50 -eq 0){ Write-Output "progress $n" }
  Start-Sleep -Milliseconds 150
}
Write-Output "DONE $n new"
