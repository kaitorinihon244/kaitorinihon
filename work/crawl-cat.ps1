param([string]$C1, [string]$C2, [string]$Out, [int]$PauseMs = 3000)
# Fetch one mobileone list category (all pages), slowly, into a JSON array like mobileone.json.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$rx = [regex]'(?s)<li>\s*<div class="list3">\s*<a href="/gdetail/(\d+)\.html".*?<div class="splist">\s*JAN:(.*?)</div>\s*<div class="splist1">(.*?)</div>\s*<div class="hot4">.*?新品</font>\s*¥([\d,]+).*?</div>\s*<div class="hot4">.*?中古</font>\s*¥([\d,]+)'
function Clean([string]$s){ $s = [Net.WebUtility]::HtmlDecode($s); return (($s -replace '\s+',' ').Trim()) }
$all = New-Object System.Collections.ArrayList; $seen = @{}; $page = 1
while($page -le 30){
  $url = "https://mobileone.co.jp/sell.html?cat1=$C1&cat2=$C2&page=$page"
  $r = $null
  for($t=0; $t -lt 3 -and -not $r; $t++){ try { $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 30 } catch { Start-Sleep -Seconds (10 * ($t+1)) } }
  if(-not $r){ Write-Output "FAIL $url"; break }
  $html = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  $ms = $rx.Matches($html); $new = 0
  foreach($m in $ms){ $gid = $m.Groups[1].Value; if($seen.ContainsKey($gid)){ continue }; $seen[$gid]=1; $new++
    [void]$all.Add([pscustomobject]@{ gid=[int]$gid; c1=$C1; c2=$C2; jan=(Clean $m.Groups[2].Value); n=(Clean $m.Groups[3].Value); nw=[int]($m.Groups[4].Value -replace ',',''); us=[int]($m.Groups[5].Value -replace ',','') }) }
  Write-Output "page $page : $new new"
  if($ms.Count -eq 0 -or $new -eq 0){ break }
  $page++; Start-Sleep -Milliseconds $PauseMs
}
[IO.File]::WriteAllText($Out, (ConvertTo-Json -InputObject @($all) -Depth 4 -Compress), (New-Object Text.UTF8Encoding($false)))
Write-Output "TOTAL $($all.Count)"
