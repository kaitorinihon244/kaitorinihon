param([string]$P)
# Rebrand leftovers (売り時 / uridoki → 買取日本 / Kaitori), demo text, real SNS links.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$s = [IO.File]::ReadAllText($P, $utf8)
function Rep($a, $b){ $n = ([regex]::Matches($script:s, [regex]::Escape($a))).Count; if($n -lt 1){ throw "not found: $a" }; $script:s = $script:s.Replace($a, $b); "  $n x $($a.Substring(0,[Math]::Min(40,$a.Length)))" }

# favourites key: keep what visitors saved under the old name
Rep "favs=new Set(JSON.parse(localStorage.getItem('uridoki-favs')||'[]'));" "favs=new Set(JSON.parse(localStorage.getItem('kaitori-favs')||localStorage.getItem('uridoki-favs')||'[]'));"
Rep "localStorage.setItem('uridoki-favs'," "localStorage.setItem('kaitori-favs',"
Rep "['uridoki-favs','kaitori-mode']" "['kaitori-favs','uridoki-favs','kaitori-mode']"

# copyright and demo notes
$script:s = [regex]::Replace($script:s, '© 2026 URIDOKI\.[^"<]*', '© 2026 買取日本 Kaitorinihon. All rights reserved.')
Rep "住所・電話番号はデモ用のサンプルです。" "ご来店前にお電話でのお問い合わせも承っております。"
Rep "      <p>（デモのため実際には送信されません）</p>`n" ""
Rep "`$('#lineBtn').onclick=()=>toast('デモのためLINE連携はありません');" "`$('#lineBtn').onclick=()=>{ const u=safeUrl((site.texts||{}).lineUrl||''); if(u) window.open(u,'_blank','noopener'); else openRQ(); };"

# brand names (after the storage keys above, so they are not touched twice)
Rep "<title>URIDOKI 売り時</title>" "<title>KAITORI 買取日本</title>"
$script:s = $script:s.Replace('uridoki-favs', '@@FAVKEY@@')
$script:s = $script:s.Replace('売り時', '買取日本').Replace('URIDOKI', 'KAITORI').Replace('>uridoki<', '>Kaitorinihon<').Replace('romaji:"uridoki"', 'romaji:"Kaitorinihon"')
$script:s = $script:s.Replace('@@FAVKEY@@', 'uridoki-favs')

# SNS: real accounts, rendered from texts.* so they can be edited
Rep @'
        <div class="sns">
          <a href="#main" onclick="return false" data-hv="snslink"><i style="background:var(--line-green)">LINE</i>LINE 友だち追加</a>
          <a href="#main" onclick="return false" data-hv="snslink"><i style="background:#111">X</i>フォロー募集中</a>
        </div>
'@.Replace("`r`n","`n") '        <div class="sns" id="snsSide"></div>
'
Rep '<div class="fcol"><h4>公式SNS</h4><ul><li><a class="alink" href="#main" onclick="return false"><span>LINE</span></a></li><li><a class="alink" href="#main" onclick="return false"><span>X（旧Twitter）</span></a></li><li><a class="alink" href="#main" onclick="return false"><span>Instagram</span></a></li><li><a class="alink" href="#main" onclick="return false"><span>YouTube</span></a></li></ul></div>' '<div class="fcol"><h4>公式SNS</h4><ul id="snsFoot"></ul></div>'
Rep 'contactEmail:"",lineUrl:"",relayUrl:"",bankInfo:"",' 'contactEmail:"",lineUrl:"",relayUrl:"",bankInfo:"",instagramUrl:"https://www.instagram.com/kaitorinihon_/",tiktokUrl:"https://www.tiktok.com/@kaitorinihon247",xUrl:"",youtubeUrl:"",'

[IO.File]::WriteAllText($P, $s, $utf8)
"done"
