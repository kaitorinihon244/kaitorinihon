param([string]$In, [string]$Out, [string]$GameImg)
# Gives every product a permanent public code (RJP-000001…). The JAN stays in p.jan, hidden, for price matching.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$s = [IO.File]::ReadAllText($In, $utf8) | ConvertFrom-Json
$max = 0
foreach($p in $s.products){ if($p.rjp -match '^RJP-(\d+)$'){ $max = [Math]::Max($max, [int]$matches[1]) } }
$new = 0
foreach($p in $s.products){
  if($p.rjp -match '^RJP-\d+$'){ continue }
  $max++; $new++; $code = 'RJP-' + $max.ToString('000000')
  if($p.PSObject.Properties['rjp']){ $p.rjp = $code } else { $p | Add-Member -NotePropertyName rjp -NotePropertyValue $code }
}
if($GameImg){ foreach($c in $s.categories){ if($c.img -eq '1e6e434c7a2b696c73c585368ce9c84b'){ $c.img = $GameImg } } }
$all = @($s.products | ForEach-Object { $_.rjp })
"products: $($all.Count); new codes: $new; unique: $(@($all | Sort-Object -Unique).Count); first: $($all[0]); last: $($all[-1])"
[IO.File]::WriteAllText($Out, (ConvertTo-Json -InputObject $s -Depth 14 -Compress), $utf8)
