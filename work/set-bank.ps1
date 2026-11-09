param([string]$P)
# Bank transfer details shown on the order completion screen (texts.bankInfo).
# ゆうちょ: 記号10120 → 店名 〇一八（店番018）; 番号 = 口座番号 6390886 + check digit 1.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$s = [IO.File]::ReadAllText($P, $utf8) | ConvertFrom-Json
$bank = "ゆうちょ銀行（金融機関コード 9900）`n" +
        "店名：〇一八（ゼロイチハチ）店　店番：018`n" +
        "預金種目：普通預金`n" +
        "口座番号：6390886`n" +
        "口座名義：ロイヤル ジャパン`n" +
        "※ゆうちょ銀行口座からのお振込み：記号 10120　番号 63908861"
if($s.texts.PSObject.Properties['bankInfo']){ $s.texts.bankInfo = $bank } else { $s.texts | Add-Member -NotePropertyName bankInfo -NotePropertyValue $bank }
[IO.File]::WriteAllText($P, (ConvertTo-Json -InputObject $s -Depth 14 -Compress), $utf8)
"bankInfo set"
