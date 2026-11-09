param([string]$P)
# High-school campaign poster as the top news post (shown whole, not cropped).
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$s = [IO.File]::ReadAllText($P, $utf8) | ConvertFrom-Json
$title = '高校生限定キャンペーン 実施中'
$news = @($s.news | Where-Object { $_.title -ne $title })
$text = "学生証をご提示いただいた高校生のお客様に、3つの特典をご用意しました。`n`n" +
        "① スマホ修理 20%OFF`n" +
        "② スマホを売るなら 買取価格 +5%UP`n" +
        "③ スマホを買うなら 5%OFF`n`n" +
        "※ご利用には学生証のご提示が必要です。`n`n" +
        "実施店舗：〒171-0021 東京都豊島区西池袋1-10-2`nTEL：03-5927-8278"
$post = [pscustomobject]@{ date = '2026/11/03'; type = 'campaign'; platform = ''; title = $title; text = $text; link = ''; linkLabel = ''; img = 'img/campaign-highschool.webp'; fit = 'contain' }
$s.news = @($post) + $news
[IO.File]::WriteAllText($P, (ConvertTo-Json -InputObject $s -Depth 14 -Compress), $utf8)
"news now: $(@($s.news).Count), first: $($s.news[0].title)"
