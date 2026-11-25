# Reads chars.txt and writes glyphs.json: Noto Sans JP outlines (open font licence) so the logos need no installed font.
Add-Type -AssemblyName PresentationCore, WindowsBase
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$chars = [IO.File]::ReadAllText([IO.Path]::Combine($dir, 'chars.txt'), [Text.Encoding]::UTF8).ToCharArray() | Select-Object -Unique
$inv = [Globalization.CultureInfo]::InvariantCulture
$out = New-Object Text.StringBuilder; [void]$out.Append('{'); $firstW = $true
foreach($w in 900, 700, 500){
  $tf = New-Object Windows.Media.Typeface (New-Object Windows.Media.FontFamily 'Noto Sans JP'), ([Windows.FontStyles]::Normal), ([Windows.FontWeight]::FromOpenTypeWeight($w)), ([Windows.FontStretches]::Normal)
  $g = $null; if(-not $tf.TryGetGlyphTypeface([ref]$g)){ throw "no font for weight $w" }
  [Console]::Error.WriteLine("weight $w -> " + $g.Weight + ' ' + $g.FontUri)
  if(-not $firstW){ [void]$out.Append(',') }; $firstW = $false
  [void]$out.Append('"' + $w + '":{'); $first = $true
  foreach($c in $chars){
    $i = [uint16]0; if(-not $g.CharacterToGlyphMap.TryGetValue([int]$c, [ref]$i)){ [Console]::Error.WriteLine("missing $c"); continue }
    $geo = [Windows.Media.PathGeometry]::CreateFromGeometry($g.GetGlyphOutline($i, 1000, 1000))
    $d = $geo.ToString($inv) -replace '^F[01]', ''
    if(-not $first){ [void]$out.Append(',') }; $first = $false
    [void]$out.Append('"' + [int]$c + '":[' + ([Math]::Round($g.AdvanceWidths[$i]*1000,1)).ToString($inv) + ',"' + $d + '"]')
  }
  [void]$out.Append('}')
}
[void]$out.Append('}')
[IO.File]::WriteAllText([IO.Path]::Combine($dir, 'glyphs.json'), $out.ToString(), (New-Object Text.UTF8Encoding $false))
