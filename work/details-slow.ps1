param([string]$In, [string]$Out, [int]$PauseMs = 3000)
# Slow, polite collector: one request at a time, $PauseMs after each request,
# and a 15-minute pause whenever the server answers 429 (Too Many Requests).
# Resumable: skips products already saved in any details*.jsonl next to $Out.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$utf8 = New-Object Text.UTF8Encoding($false)
$dir = Split-Path $Out
$log = Join-Path $dir 'details-log.txt'
function Log([string]$m){ [IO.File]::AppendAllText($log, ((Get-Date).ToString('HH:mm:ss') + ' ' + $m + "`n"), $utf8) }
$src = [IO.File]::ReadAllText($In, $utf8) | ConvertFrom-Json
$done = @{}
foreach($f in (Get-ChildItem $dir -Filter 'details*.jsonl')){ foreach($l in [IO.File]::ReadAllLines($f.FullName, $utf8)){ if($l -match '"gid":(\d+)'){ $done[$Matches[1]] = 1 } } }
$todo = @($src | Where-Object { -not ($_.nw -eq 0 -and $_.us -eq 0) -and -not $done.ContainsKey([string]$_.gid) })
Log "start: $($todo.Count) products to collect, $($done.Count) already done"

function Get([string]$url){
  $fails = 0; $limited = 0
  while($true){
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 30
      Start-Sleep -Milliseconds $PauseMs
      return [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    } catch {
      $code = $null; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
      if($code -eq 429){
        $limited++
        if($limited -gt 16){ Log "still rate-limited after 4 hours, giving up on $url"; return $null }
        Log "429 Too Many Requests - pausing 15 minutes"
        Start-Sleep -Seconds 900
        continue
      }
      $fails++
      if($fails -ge 3){ Log "failed ($code) $url"; Start-Sleep -Milliseconds $PauseMs; return $null }
      Start-Sleep -Seconds (5 * $fails)
    }
  }
}
function Clean([string]$s){ $s = [Net.WebUtility]::HtmlDecode(($s -replace '<[^>]+>',' ')); return (($s -replace '[\s　]+',' ').Trim()) }
$condRx = [regex]'(?s)<div class="proDeta8">(.*?)</div>'
$condItem = [regex]'(?s)<span[^>]*\$\(''#parr2''\)\.val\((\d+)\)[^>]*>(.*?)</span>'
$groupRx = [regex]'(?s)<div class="proDeta9a[^"]*">(.*?)</div>'
$optRx = [regex]'(?s)<span onclick="get_price\((\d+)\)">(.*?)</span>'
$n = 0
foreach($s in $todo){
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
      $j = Get "https://mobileone.co.jp/get_attr.html?attr_id=$($o.Groups[1].Value)&times=$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())"
      $price = $null
      if($j){ try { $d = $j | ConvertFrom-Json; if($d.code -eq 0){ $price = [int]$d.data.price } } catch {} }
      $opts += [pscustomobject]@{ id=[int]$o.Groups[1].Value; label=(Clean $o.Groups[2].Value); price=$price }
    }
    $label = if($g -lt $conds.Count){ $conds[$g].label } else { "条件$($g+1)" }
    $type = if($g -lt $conds.Count){ $conds[$g].type } else { 0 }
    $res += [pscustomobject]@{ type=$type; label=$label; options=@($opts) }
  }
  $line = ConvertTo-Json -InputObject ([pscustomobject]@{ gid=$s.gid; desc=''; conds=@($res) }) -Depth 6 -Compress
  [IO.File]::AppendAllText($Out, $line + "`n", $utf8)
  $n++
  if($n % 25 -eq 0){ Log "progress: $n of $($todo.Count)" }
}
Log "DONE: collected $n"
Write-Output "DONE $n of $($todo.Count)"
