param([string]$In, [string]$Out)
# Category tile photos + news posts for the newest products (prices read from the data).
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$s = [IO.File]::ReadAllText($In, $utf8) | ConvertFrom-Json

foreach($c in $s.categories){
  switch($c.label){
    'Android'      { $c.img = 'img/logo-android.jpg'; $c.q = '' }
    'Apple'        { $c.label = 'iPad'; $c.q = 'iPad'; $c.img = 'img/ipadpro11.jpg' }
    'iPad'         { $c.img = 'img/ipadpro11.jpg' }
    'スマートウォッチ' { $c.label = 'Apple Watch'; $c.q = 'Apple Watch'; $c.img = 'img/applewatch.jpg' }
    'Apple Watch'  { $c.img = 'img/applewatch.jpg' }
    'MacBook'      { $c.img = 'img/macbookpro.jpg' }
  }
}

function MaxNew($rx){
  $best = 0
  foreach($p in $s.products){
    if($p.n -notmatch $rx){ continue }
    $vals = @($p.new)
    if($p.opts){ foreach($c in $p.opts){ foreach($o in $c.options){ $vals += $o.price } } }
    foreach($v in $vals){ if($v -and [int]$v -gt $best){ $best = [int]$v } }
  }
  return $best
}
function Yen($n){ return '¥' + ('{0:N0}' -f $n) }

$posts = @(
  @{ rx='(?i)iphone 18 pro'; date='2026/11/02'; img='img/iphone18pro.jpg'; title='iPhone 18 Pro / Pro Max 高価買取中';
     text='最新のiPhone 18 Pro・18 Pro Maxを全容量・全カラー買取中です。未開封・開封済み・中古いずれも査定します。' },
  @{ rx='(?i)iphone duo'; date='2026/11/02'; img='img/iphoneduo.jpg'; title='折りたたみ「iPhone Duo」買取スタート';
     text='話題の折りたたみiPhone、iPhone Duo（256GB〜2TB）の買取を開始しました。' },
  @{ rx='(?i)galaxy s26'; date='2026/11/01'; img='img/s26ultra.jpg'; title='Galaxy S26 Ultra / S26+ / S26 強化買取';
     text='SIMフリー版・au・docomo・SoftBank版のGalaxy S26シリーズを強化買取中です。' },
  @{ rx='(?i)z fold8'; date='2026/11/01'; img='img/fold8.jpg'; title='Galaxy Z Fold8 / Fold8 Ultra 買取中';
     text='最新の折りたたみGalaxy Z Fold8・Fold8 Ultraを高価買取しています。' },
  @{ rx='(?i)pixel 11'; date='2026/10/31'; img='img/pixel.jpg'; title='Google Pixel 11 シリーズ 買取開始';
     text='Pixel 11 / 11 Pro / 11 Pro XL / 11 Pro Fold の買取を開始しました。' },
  @{ rx='(?i)macbook (air|pro).*m5'; date='2026/10/31'; img='img/macbookpro.jpg'; title='MacBook Air / Pro（M5）高価買取';
     text='M5チップ搭載のMacBook Air・MacBook Proを買取中です。新しい「MacBook・ノートPC」タブからご確認いただけます。' },
  @{ rx='(?i)ipad pro.*m5'; date='2026/10/30'; img='img/ipadpro11.jpg'; title='iPad Pro（M5）買取中';
     text='最新のiPad Pro（M5）11インチ・13インチを全容量で買取しています。' }
)
$news = New-Object System.Collections.ArrayList
foreach($p in $posts){
  if($s.news | Where-Object { $_.title -eq $p.title }){ continue }   # don't add twice
  $mx = MaxNew $p.rx
  $text = $p.text + $(if($mx -gt 0){ '新品の買取価格は最高' + (Yen $mx) + '。' } else { '' }) + '価格は毎朝更新しています。'
  [void]$news.Add([pscustomobject]@{ date=$p.date; type='news'; platform=''; title=$p.title; text=$text; link=''; linkLabel=''; img=$p.img })
  "added: $($p.title)  (max new $(Yen $mx))"
}
$s.news = @($news) + @($s.news)
[IO.File]::WriteAllText($Out, (ConvertTo-Json -InputObject $s -Depth 14 -Compress), $utf8)
"tiles: " + (($s.categories | ForEach-Object { "$($_.label)=$($_.img)" }) -join ', ')
"news now: $(@($s.news).Count)"
