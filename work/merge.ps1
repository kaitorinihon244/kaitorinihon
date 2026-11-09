$ErrorActionPreference = 'Stop'
$w = $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding($false)
$site = [IO.File]::ReadAllText((Join-Path $w 'live\data\site.json'), $utf8) | ConvertFrom-Json
$src  = [IO.File]::ReadAllText((Join-Path $w 'mobileone.json'), $utf8) | ConvertFrom-Json

# ---- tabs: keep the owner's existing tabs, add the new ones, set the order ----
function T($id,$label,$side,$sc){ [pscustomobject][ordered]@{ id=$id; label=$label; side=$side; shortcuts=@($sc) } }
$old = @{}; foreach($t in $site.tabs){ $old[$t.id] = $t }
$phone = if($old.phone){ $old.phone } else { T 'phone' 'スマホ強化' 'スマホ' @() }
$phone.shortcuts = @('iPhone','Galaxy','Pixel','Xperia','AQUOS','OPPO')
$kaden = if($old.kaden){ $old.kaden } else { T 'kaden' '家電製品強化' '家電' @() }
$kaden.shortcuts = @('パソコン','カメラ','オーディオ','生活家電','美容家電','テレビ')
$tabs = @(
  $phone,
  (T 'tablet' 'タブレット・時計' 'タブレット・時計' @('iPad','Apple Watch','Galaxy Tab','スマートウォッチ','WiFi')),
  (T 'game' 'ゲーム強化' 'ゲーム' @('Switch','PlayStation','Xbox','Meta Quest','ゲームソフト')),
  $kaden,
  (T 'tool' '電動工具' '電動工具' @('マキタ','HIKOKI','ポータブル電源','ソーラーパネル'))
)
if($old.toy){ $tabs += $old.toy }
if($old.sake){ $tabs += $old.sake }
$tabs += (T 'gift' 'ギフト券' 'ギフト券' @('ギフト'))
foreach($t in $site.tabs){ if(-not ($tabs | Where-Object { $_.id -eq $t.id })){ $tabs += $t } }
$site.tabs = $tabs

# ---- existing sample game products move to the new game tab ----
foreach($p in $site.products){ if($p.t -eq 'kaden' -and $p.a -and @('console','handheld','ps','xbox','vr','game') -contains $p.a[0]){ $p.t = 'game' } }

# ---- category circles ----
foreach($c in $site.categories){
  if($c.label -eq 'ゲーム'){ $c.tab='game'; $c.q='' }
  if($c.label -eq 'カメラ'){ $c.q='カメラ' }
  if($c.label -eq 'Apple'){ $c.tab='tablet'; $c.q='iPad' }
}
function C($label,$tab,$q,$a){ [pscustomobject][ordered]@{ label=$label; tab=$tab; q=$q; a=@($a); img=$null } }
$have = @($site.categories | ForEach-Object { $_.label })
$add = @()
if($have -notcontains 'パソコン'){ $add += (C 'パソコン' 'kaden' 'パソコン' @('laptop')) }
if($have -notcontains 'スマートウォッチ'){ $add += (C 'スマートウォッチ' 'tablet' 'スマートウォッチ' @('watch','#2F3542')) }
if($have -notcontains '電動工具'){ $add += (C '電動工具' 'tool' '' @('drill','#1FA3A3')) }
$site.categories = @($site.categories) + $add

# ---- imported products ----
$tabOf = @{ '140'='phone'; '141'='game'; '142'='kaden'; '355'='tool'; '298'='gift'; '436'='toy' }
$tabletCats = @('149','150','151','152','430')
$carrierMemo = @{ '146'='au・UQ版'; '147'='SoftBank・Y!mobile版'; '148'='docomo版'; '178'='楽天モバイル版'; '419'='格安SIM版'; '402'='赤ロム' }
$artOf = @{
  '144'=@('phone','#C7B39C','#8E7A64'); '149'=@('tablet'); '150'=@('tablet'); '151'=@('watch','#2F3542'); '152'=@('router'); '430'=@('android','#7FA7E8','#4E77C2');
  '256'=@('console','#E8414E','#2F9BE0','#2E3A4F'); '257'=@('ps'); '258'=@('xbox','#22262E'); '259'=@('vr'); '260'=@('game','#E8414E','#4FA3F7'); '261'=@('game','#1F3A8A','#4FA3F7'); '262'=@('handheld','#3FB5C9');
  '263'=@('laptop'); '264'=@('laptop'); '265'=@('camera'); '266'=@('earbuds','#1E222A'); '267'=@('appliance','#F3C7D3'); '268'=@('appliance','#DCE6F2'); '269'=@('appliance','#CFEAF5'); '271'=@('tv'); '334'=@('appliance','#3B4A60'); '272'=@('appliance','#DCE6F2');
  '356'=@('drill','#1FA3A3'); '357'=@('drill','#2E8B57'); '358'=@('drill','#1C5BB3'); '359'=@('appliance','#F2A541'); '362'=@('appliance','#2F4F8F'); '360'=@('drill','#E0812D');
  '433'=@('giftcard'); '438'=@('cardbox'); '437'=@('cardbox'); '439'=@('cardbox')
}
$strong = @('OPPO Reno16 5G','Apple Watch Ultra 4 49mm','iPhone Duo 1TB','iPhone Duo 512GB','iPhone 18 Pro 256GB','Google Pixel 11 256GB','iPhone 17e 256GB','OPPO A5 5G OPG06')
$existingSrc = @{}; foreach($p in $site.products){ if($p.PSObject.Properties['src']){ $existingSrc[[string]$p.src] = $p } }
$list = New-Object System.Collections.ArrayList
foreach($p in $site.products){ [void]$list.Add($p) }
$added = 0; $updated = 0; $skipped = 0
foreach($s in $src){
  if($s.nw -eq 0 -and $s.us -eq 0){ $skipped++; continue }
  $key = "mobileone:$($s.gid)"
  $new = if($s.nw -gt 0){ $s.nw } else { $null }
  $used = if($s.us -gt 0){ $s.us } else { $null }
  if($existingSrc.ContainsKey($key)){ $e = $existingSrc[$key]; $e.new = $new; $e.used = $used; $updated++; continue }
  $c2 = [string]$s.c2
  $t = if($tabletCats -contains $c2){ 'tablet' } else { $tabOf[[string]$s.c1] }
  $a = if($artOf.ContainsKey($c2)){ $artOf[$c2] } elseif($t -eq 'phone'){ @('android','#7FA7E8','#4E77C2') } else { @('appliance') }
  $jan = [string]$s.jan; if(-not $jan -or $jan -eq $s.n){ $jan = '—' }
  $memo = if($carrierMemo.ContainsKey($c2)){ $carrierMemo[$c2] } else { '' }
  $kyo = $false; foreach($k in $strong){ if($s.n -like "*$k*"){ $kyo = $true } }
  [void]$list.Add([pscustomobject][ordered]@{ id=100000+[int]$s.gid; t=$t; n=$s.n; jan=$jan; memo=$memo; a=@($a); img=$null; new=$new; used=$used; kyo=$kyo; featured=$false; delta=0; carriers=@(); cat=$s.cat; src=$key })
  $added++
}
$site.products = $list.ToArray()
$site.texts.updated = (Get-Date).ToString('yyyy/MM/dd')
$json = ConvertTo-Json -InputObject $site -Depth 12 -Compress
[IO.File]::WriteAllText((Join-Path $w 'site.json'), $json, $utf8)
"added=$added updated=$updated skipped=$skipped total=$($site.products.Count) bytes=$($json.Length)"
