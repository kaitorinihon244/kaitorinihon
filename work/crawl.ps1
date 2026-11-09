param([string]$Out)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$cats = @(
 '140/144/iPhone','140/145/SIMフリースマホ','140/146/AU・UQ','140/147/SoftBank・Y!mobile','140/148/Docomo','140/419/格安SIMキャリア','140/178/楽天モバイル',
 '140/149/iPad・アクセサリ','140/150/タブレット','140/151/スマートウォッチ','140/152/WiFi・ネット','140/402/赤ロム端末','140/430/通訳機・翻訳機',
 '141/256/Nintendoゲーム機','141/257/PlayStationゲーム機','141/258/Xboxゲーム機','141/259/VR','141/260/ゲームソフトSwitch','141/261/ゲームソフト(PS5)','141/262/ゲームその他',
 '142/263/パソコン','142/264/パソコン周辺機器','142/265/カメラ','142/266/オーディオ','142/267/美容家電','142/268/生活家電','142/269/季節家電','142/271/テレビ・レコーダー','142/334/カー用品','142/272/家電その他',
 '355/356/マキタ','355/357/HIKOKI','355/358/BOSCH','355/359/ポータブル電源','355/362/ソーラーパネル','355/360/電動工具その他',
 '298/433/ギフト各種','436/438/ONE PIECE','436/437/ポケモンカード','436/439/遊戯王'
)
$rx = [regex]'(?s)<li>\s*<div class="list3">\s*<a href="/gdetail/(\d+)\.html".*?<div class="splist">\s*JAN:(.*?)</div>\s*<div class="splist1">(.*?)</div>\s*<div class="hot4">.*?新品</font>\s*¥([\d,]+).*?</div>\s*<div class="hot4">.*?中古</font>\s*¥([\d,]+)'
$all = New-Object System.Collections.ArrayList
$seen = @{}
function Clean([string]$s){ $s = [Net.WebUtility]::HtmlDecode($s); return (($s -replace '\s+',' ').Trim()) }
foreach($c in $cats){
  $p = $c.Split('/'); $c1=$p[0]; $c2=$p[1]; $name=$p[2]
  $page = 1; $count = 0
  while($true){
    $url = "https://mobileone.co.jp/sell.html?cat1=$c1&cat2=$c2&page=$page"
    try { $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 30 } catch { Start-Sleep -Seconds 2; try { $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 30 } catch { Write-Output "FAIL $url"; break } }
    $html = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    $ms = $rx.Matches($html)
    if($ms.Count -eq 0){ break }
    $new = 0
    foreach($m in $ms){
      $gid = $m.Groups[1].Value
      if($seen.ContainsKey($gid)){ continue }
      $seen[$gid] = 1; $new++
      [void]$all.Add([pscustomobject]@{ gid=[int]$gid; c1=$c1; c2=$c2; cat=$name; jan=(Clean $m.Groups[2].Value); n=(Clean $m.Groups[3].Value); nw=[int]($m.Groups[4].Value -replace ',',''); us=[int]($m.Groups[5].Value -replace ',','') })
    }
    $count += $ms.Count
    if($new -eq 0 -and $page -gt 1){ break }
    if($html -notmatch "page=$($page+1)[^0-9]"){ break }
    $page++
    Start-Sleep -Milliseconds 400
  }
  Write-Output ("{0} {1}: {2} items, {3} pages" -f $c2, $name, $count, $page)
  Start-Sleep -Milliseconds 400
}
$json = ConvertTo-Json -InputObject @($all) -Depth 4 -Compress
[IO.File]::WriteAllText($Out, $json, (New-Object Text.UTF8Encoding($false)))
Write-Output "TOTAL $($all.Count) -> $Out"
