param([string]$In, [string]$Out)
# Text fixes in the live data + official SNS accounts.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$s = [IO.File]::ReadAllText($In, $utf8) | ConvertFrom-Json
$t = $s.texts
function SetT($k, $v){ if($t.PSObject.Properties[$k]){ $t.$k = $v } else { $t | Add-Member -NotePropertyName $k -NotePropertyValue $v } }
SetT 'statsEyebrow' '数字で見る買取日本'
SetT 'copyright' '© 2026 買取日本 Kaitorinihon. All rights reserved.'
SetT 'instagramUrl' 'https://www.instagram.com/kaitorinihon_/'
SetT 'tiktokUrl' 'https://www.tiktok.com/@kaitorinihon247'
if(-not $t.PSObject.Properties['xUrl']){ SetT 'xUrl' '' }
if(-not $t.PSObject.Properties['youtubeUrl']){ SetT 'youtubeUrl' '' }
$json = ConvertTo-Json -InputObject $s -Depth 14 -Compress
$left = [regex]::Matches($json, '売り時|uridoki|URIDOKI').Count
[IO.File]::WriteAllText($Out, $json, $utf8)
"written; leftover old-brand mentions: $left; products: $(@($s.products).Count)"
