param([string]$Html, [string]$Data)
# Remove sample/demo/test wording; stats use facts from the site instead of invented numbers.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)

# ---- live data ----
$s = [IO.File]::ReadAllText($Data, $utf8) | ConvertFrom-Json
$s.texts.ratingText = ''
$s.texts.license = ''
$s.texts.statsNote = ''
$count = [Math]::Floor(@($s.products).Count / 100) * 100
$s.stats = @(
  [pscustomobject]@{ v = $count; s = '+点'; l = '買取価格を掲載中の商品' },
  [pscustomobject]@{ v = @($s.stores).Count; s = '店舗'; l = '東京・神奈川の店頭買取' },
  [pscustomobject]@{ v = 47; s = '都道府県'; l = '郵送買取の対応エリア' },
  [pscustomobject]@{ v = 9; s = '時間'; l = "営業時間（$($s.texts.openFrom)〜$($s.texts.openTo)）" }
)
$json = ConvertTo-Json -InputObject $s -Depth 14 -Compress
[IO.File]::WriteAllText($Data, $json, $utf8)
"data: stats -> " + (($s.stats | ForEach-Object { "$($_.v)$($_.s) $($_.l)" }) -join ' / ')

# ---- page defaults (used only if the data file fails to load) ----
$h = [IO.File]::ReadAllText($Html, $utf8)
function Rep($a, $b){ $n = ([regex]::Matches($script:h, [regex]::Escape($a))).Count; if($n -ne 1){ throw "count $n for: $a" }; $script:h = $script:h.Replace($a, $b) }
Rep 'ratingText:"お客様満足度（サンプル）"' 'ratingText:""'
Rep 'license:"古物商許可 第000000000000号（サンプル）"' 'license:""'
Rep 'statsNote:"※数値はデモ用のサンプルです。"' 'statsNote:""'
$stores = ($s.stores | ForEach-Object { '{name:"' + $_.name + '",addr:"' + $_.addr + '",tel:"' + $_.tel + '"}' }) -join ','
$h = [regex]::Replace($h, 'stores:\[\{name:"渋谷店".*?\}\],', ('stores:[' + $stores + '],'))
$statsJs = ($s.stats | ForEach-Object { '{v:' + $_.v + ',s:"' + $_.s + '",l:"' + $_.l + '"}' }) -join ','
$h = [regex]::Replace($h, ' stats:\[\{v:1200000.*?\}\],', (' stats:[' + $statsJs + '],'))
[IO.File]::WriteAllText($Html, $h, $utf8)
$left = [regex]::Matches($h, 'サンプル|デモ用|〇〇銀行|0000000').Count
"page: leftover sample/demo words = $left"
