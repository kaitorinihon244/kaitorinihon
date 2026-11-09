param([string]$Site, [string]$Key)
# Pushes RJP code ↔ model (and buy prices) from the site's data to the relay's 商品マスタ tab.
# Run after products or prices change. The key is the relay's ADMIN_KEY.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$s = [IO.File]::ReadAllText($Site, $utf8) | ConvertFrom-Json
$relay = $s.texts.relayUrl
$rows = foreach($p in $s.products){ ,@([string]$p.rjp, [string]$p.n, [string]$p.t, [string]$p.jan, $p.new, $p.used) }
$body = ConvertTo-Json -InputObject ([ordered]@{ kind = 'master'; key = $Key; rows = @($rows) }) -Depth 5 -Compress
$r = Invoke-WebRequest -Uri $relay -Method Post -Body ($utf8.GetBytes($body)) -ContentType 'text/plain;charset=utf-8' -UseBasicParsing
"sent $(@($rows).Count) products ($([Math]::Round($body.Length/1KB)) KB): " + [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
