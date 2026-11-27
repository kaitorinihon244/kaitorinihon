// Cloudflare Pages worker (advanced mode) for kaitorinihon.jp.
// It answers only the paths listed in _routes.json; every other path is a plain file.
//  /                              home page: the built page with today's prices, the update time and the clock filled in
//  /kaitori/, /kaitori/<category>/, /kaitori/<category>/<model>/     buyback price pages, made from the live price feed
//  /kaitori/flow/, /kaitori/notes/, /company/, /faq/, /contact/, /terms/, /privacy/, /cookie/   content pages
//  /shops/, /shops/<shop>/        shop pages
//  /shop/, /shop/<product no.>, /shop/<model>/                       phones for sale, read only from web_products_for_sale
//  /sitemap.xml, /sitemap-shop.xml
// Pages are made on request and kept for a few minutes at the edge, so a new model, a price change or a sold
// phone shows without a rebuild or an upload.
const SITE = 'https://kaitorinihon.jp';
const SB = 'https://vqfreyiveytlolsaaypy.supabase.co/rest/v1/';
const KEY = 'sb_publishable_yqJcfi5QUeOzV7f8eucjFA_A9cVHAvH';   // public (publishable) key, read-only views
const BRAND = '買取日本（Kaitori Nihon）', SHORT = '買取日本';
const MIN = 1000, MAX = 500000;                                  // stock price range shown on the site
const TTL = 600;                                                  // seconds a page stays in the edge cache

/* ---------- small helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = n => '¥' + Number(n).toLocaleString('en-US');
const json = o => JSON.stringify(o).replace(/</g, '\\u003c');
const key = s => String(s || '').toLowerCase().replace(/[\s　()（）\[\]【】・\-_/]/g, '');
const jst = d => new Date((d instanceof Date ? d : new Date(d)).getTime() + 9 * 3600e3);
const ja = d => { const x = jst(d); return `${x.getUTCFullYear()}年${x.getUTCMonth() + 1}月${x.getUTCDate()}日`; };
const jaTime = d => { const x = jst(d); return `${String(x.getUTCHours()).padStart(2, '0')}:${String(x.getUTCMinutes()).padStart(2, '0')}`; };
const iso = d => jst(d).toISOString().slice(0, 10);
const parseJp = s => { const m = /^(\d{4})[\/-](\d{2})[\/-](\d{2})[ T](\d{2}):(\d{2})/.exec(s || ''); return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`) : null; };
const telHref = t => 'tel:' + String(t || '').replace(/[^0-9+]/g, '');

/* ---------- data ---------- */
let CAT = null, CATAT = 0;
async function catalog(env) {
  if (CAT && Date.now() - CATAT < 300e3) return CAT;
  const r = await env.ASSETS.fetch(new Request(SITE + '/data/catalog.json'));
  if (!r.ok) throw new Error('catalog ' + r.status);
  CAT = await r.json(); CATAT = Date.now();
  return CAT;
}
// Buying prices: the stock system's web_buyback_prices when it has rows, otherwise the relay's feed (1-chome, every 2 hours),
// otherwise the catalogue's own prices. Returns { map: { RJP code: [new, used] }, at: Date, source }.
let PX = null, PXAT = 0;
async function prices(cat) {
  if (PX && Date.now() - PXAT < 300e3) return PX;
  PX = await prices_(cat); PXAT = Date.now(); return PX;
}
async function prices_(cat) {
  try {
    const r = await fetch(SB + 'web_buyback_prices?select=brand,model,category,storage,grade,price,updated_at&limit=5000', { headers: { apikey: KEY }, cf: { cacheTtl: 300, cacheEverything: true } });
    const rows = r.ok ? await r.json() : [];
    if (Array.isArray(rows) && rows.length > 20) {
      const by = {}; let newest = 0;
      rows.forEach(x => { const k = key((x.model || '') + ' ' + (x.storage || '')); (by[k] = by[k] || {})[x.grade] = Number(x.price) || 0; const t = Date.parse(x.updated_at); if (t > newest) newest = t; });
      const map = {};
      cat.models.forEach(m => m.r.forEach(p => { const g = by[key(p[1])]; if (!g) return; const u = g.used_a > 0 ? g.used_a : g.used_b > 0 ? g.used_b : g.used_c > 0 ? g.used_c : 0; map[p[0]] = [g.unused > 0 ? g.unused : p[3], u || p[4]]; }));
      if (Object.keys(map).length > 20) return { map, at: new Date(newest || Date.now()), source: 'supabase' };
    }
  } catch (e) { /* fall through */ }
  try {
    if (cat.relay) {
      const r = await fetch(cat.relay + '?prices=1', { redirect: 'follow', cf: { cacheTtl: 600, cacheEverything: true } });
      const o = await r.json();
      if (o && o.ok && o.items && Object.keys(o.items).length > 50) {
        const map = {}; for (const k in o.items) map[k] = [o.items[k][0], o.items[k][1]];
        return { map, at: parseJp(o.updated) || new Date(), source: 'relay' };
      }
    }
  } catch (e) { /* fall through */ }
  return { map: {}, at: new Date(cat.built), source: 'catalog' };
}
// a row with the current prices: [rjp, name, storage, new, used, grades, opened, id]
function priced(p, px) {
  const f = px.map[p[0]]; let nn = p[3], uu = p[4], g = p[5], op = p[6];
  if (f) {
    const nr = p[3] && f[0] ? f[0] / p[3] : 1, ur = p[4] && f[1] ? f[1] / p[4] : 1;
    g = {}; for (const k in p[5]) g[k] = Math.round(p[5][k] * ur / 100) * 100;
    op = op ? Math.round(op * nr / 100) * 100 : 0; nn = f[0] || nn; uu = f[1] || uu;
  }
  return { rjp: p[0], name: p[1], storage: p[2], new: nn, used: uu, g, opened: op, id: p[7] };
}
const modelRows = (m, px) => m.r.map(p => priced(p, px));
const modelMax = rows => Math.max(0, ...rows.map(r => Math.max(r.new || 0, r.used || 0, r.opened || 0)));
let STK = null, STKAT = 0;
async function stock(env) {
  if (STK && Date.now() - STKAT < 180e3) return STK;
  STK = await stock_(env); STKAT = Date.now(); return STK;
}
async function stock_(env) {
  const r = await fetch(SB + 'web_products_for_sale?select=*&limit=5000', { headers: { apikey: KEY }, cf: { cacheTtl: 300, cacheEverything: true } });
  if (!r.ok) throw new Error('stock ' + r.status);
  return (await r.json()).filter(p => Number(p.selling_price) >= MIN && Number(p.selling_price) <= MAX);
}
const COND = { 'New': ['新品', 'https://schema.org/NewCondition'], 'Unused': ['未使用', 'https://schema.org/NewCondition'], 'Used S': ['中古S', 'https://schema.org/UsedCondition'], 'Used A': ['中古A', 'https://schema.org/UsedCondition'], 'Used B': ['中古B', 'https://schema.org/UsedCondition'], 'Used C': ['中古C', 'https://schema.org/UsedCondition'] };
const SHOP = { 'Akiba Mobile Store': 'Royal Japan 池袋店', 'Rj Mobile Ikebukuro': 'Royal Japan 池袋店', 'Istore Jp': 'Royal Japan 池袋店', 'Royal Japan Shinjuku 1': 'Royal Japan 新宿1号店', 'Royal Japan Shinjuku 2': 'Royal Japan 新大久保店' };
const COLOR = { Black: 'ブラック', White: 'ホワイト', Blue: 'ブルー', Purple: 'パープル', Green: 'グリーン', Red: 'レッド', Pink: 'ピンク', Yellow: 'イエロー', Gold: 'ゴールド', Silver: 'シルバー', Gray: 'グレー', Grey: 'グレー', Orange: 'オレンジ', 'Space Gray': 'スペースグレー', Midnight: 'ミッドナイト', Starlight: 'スターライト' };
const condOf = p => COND[p.condition] || [p.condition || '中古', 'https://schema.org/UsedCondition'];
// "{model} {storage} {colour} {condition} バッテリー{n}%": every phone gets its own title
const sameModel = (modelName, stockModel) => {
  const a = String(modelName).toLowerCase().replace(/\s+/g, ' ').trim(), b = String(stockModel || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!a || !b) return false;
  if (a === b) return true;
  return a.startsWith(b + ' ') && !/^(pro|max|plus|ultra|mini|air|se|lite|fe|duo|e)\b/.test(a.slice(b.length + 1));
};
const itemName = p => [p.model, p.storage, COLOR[p.color] || p.color, condOf(p)[0]].filter(Boolean).join(' ') + (p.battery_health ? ` バッテリー${p.battery_health}%` : '');
const slugify = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* ---------- shared page frame ---------- */
const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',system-ui,sans-serif;color:#1E2A3B;background:#F6F9FD;line-height:1.75}
a{color:#2C74C4}header,main,footer{max-width:980px;margin:0 auto;padding:16px}header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.logo{font-weight:900;font-size:20px;color:#16233A;text-decoration:none;display:flex;align-items:center;gap:8px}.cta{display:inline-block;background:#2C74C4;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:700}
nav.gn{display:flex;gap:14px;flex-wrap:wrap;font-size:14px}nav.gn a{text-decoration:none;font-weight:600}
nav.bc{font-size:13px;color:#6B7890;margin:8px 0}h1{font-size:26px;line-height:1.4;margin:8px 0 8px;color:#16233A}h2{font-size:19px;margin:30px 0 10px;color:#16233A}h3{font-size:16px;margin:16px 0 6px}
p{margin:8px 0}.note{font-size:13px;color:#6B7890}.lead{font-size:15px}.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;background:#fff;margin:12px 0;font-size:14px}
th,td{border-bottom:1px solid #E1E8F2;padding:9px 8px;text-align:left;vertical-align:middle}th{background:#EAF2FB;font-size:13px;white-space:nowrap}td.p{text-align:right;font-weight:700;color:#E0475F;white-space:nowrap}td.p.u{color:#1E2A3B}
td img{width:40px;height:40px;object-fit:contain;vertical-align:middle;margin-right:8px}ul.cats{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}ul.cats a{display:block;background:#fff;border:1px solid #E1E8F2;border-radius:999px;padding:6px 14px;text-decoration:none}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;list-style:none}.grid li{background:#fff;border:1px solid #E1E8F2;border-radius:12px;padding:12px}.grid a{text-decoration:none;font-weight:700}
.tag{display:inline-block;background:#E6F7EE;color:#0B7A43;border-radius:999px;padding:1px 10px;font-size:12px;font-weight:700}.price{font-size:30px;font-weight:800;color:#E0475F}
dl.f dt{font-weight:700;margin-top:12px}dl.f dd{margin:2px 0 0 0}.map{width:100%;height:320px;border:0;border-radius:12px;background:#E1E8F2}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.box{background:#fff;border:1px solid #E1E8F2;border-radius:12px;padding:12px 14px;font-size:14px}.box b{display:block;font-size:15px}
footer{font-size:13px;color:#4B5870;border-top:1px solid #E1E8F2;margin-top:36px}footer .cols{margin:10px 0}footer .lk{display:flex;gap:6px 16px;flex-wrap:wrap;margin:12px 0}footer .lk a{text-decoration:none}
.prose h2{font-size:18px}.prose p,.prose li{font-size:15px}.prose ul{padding-left:1.3em}.steps{padding-left:1.4em}.steps li{margin:6px 0}`;
const LOGO = '<path fill="#3E8EE0" d="M6 9a3 3 0 0 1 3-3h16.2a4 4 0 0 1 2.83 1.17l14.8 14.8a4 4 0 0 1 0 5.66L29.63 40.83a4 4 0 0 1-5.66 0L7.17 24.03A4 4 0 0 1 6 21.2Z"/><circle fill="#E0475F" cx="15.6" cy="15.6" r="3.9"/>';
const FOOT_LINKS = [['会社概要', '/company/'], ['店舗一覧', '/shops/'], ['買取の流れ', '/kaitori/flow/'], ['よくある質問', '/faq/'], ['利用規約', '/terms/'], ['プライバシーポリシー', '/privacy/'], ['Cookieポリシー', '/cookie/'], ['買取時のご注意', '/kaitori/notes/'], ['お問い合わせ', '/contact/'], ['買取価格一覧', '/kaitori/'], ['iPhone買取相場', '/kaitori/soba/'], ['郵送買取', '/kaitori/mail/'], ['故障・ジャンク買取', '/kaitori/junk/'], ['売る前にやること', '/kaitori/guide/uru-mae/'], ['在庫一覧', '/shop/']];
const orgLd = cat => ({ '@context': 'https://schema.org', '@type': 'Organization', '@id': SITE + '/#org', name: SHORT, legalName: cat.texts.legal, alternateName: ['Kaitori Nihon', 'KAITORI', 'Kaitorinihon', 'kaitorinihon.jp', 'Royal Japan'], url: SITE + '/', logo: SITE + '/app-icon-512.png',
  sameAs: [cat.texts.x || 'https://x.com/KaitoriNihon', cat.texts.instagram, cat.texts.line, cat.texts.tiktok, cat.texts.youtube, cat.texts.facebook].filter(Boolean) });
const crumbLd = list => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.url })) });
const footerHtml = cat => `<footer><p><b>${esc(cat.texts.legal)}</b>　古物商許可 ${esc(cat.texts.license)}</p>
<div class="cols">${cat.stores.map(s => `<div class="box"><b><a href="/shops/${s.slug}/">${esc(s.name)}</a></b>${esc(s.addr)}<br>TEL <a href="${telHref(s.tel)}">${esc(s.tel)}</a></div>`).join('')}</div>
<p class="lk">${FOOT_LINKS.map(([n, u]) => `<a href="${u}">${n}</a>`).join('')}</p><p>${esc(cat.texts.copyright || '© 2026 買取日本 Kaitorinihon. All rights reserved.')}</p></footer>`;

function frame(cat, o) {   // o: title, desc, canon, h1, bc [{name,url}], body, ld [], noindex, status, ttl
  const bc = o.bc || [{ name: 'トップ', url: '/' }];
  const ld = [orgLd(cat), ...(o.bc && o.bc.length > 1 ? [crumbLd(o.bc)] : []), ...(o.ld || [])];
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">${o.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(SITE + o.canon)}">`}
<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(BRAND)}"><meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.desc)}"><meta property="og:url" content="${esc(SITE + o.canon)}"><meta property="og:image" content="${SITE}/share.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:locale" content="ja_JP"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#16233A"><style>${CSS}</style>${ld.map(x => `<script type="application/ld+json">${json(x)}</script>`).join('')}</head><body>
<header><a class="logo" href="/"><svg viewBox="5 5 40 38" width="34" height="32" aria-hidden="true">${LOGO}</svg>${esc(SHORT)}<small style="font-weight:500;font-size:12px;color:#6B7890">KAITORI</small></a>
<nav class="gn" aria-label="メイン"><a href="/kaitori/">買取価格</a><a href="/shop/">在庫</a><a href="/shops/">店舗</a><a href="/kaitori/flow/">買取の流れ</a><a href="/faq/">よくある質問</a></nav><a class="cta" href="${o.apply || '/?apply=1'}">無料で査定する</a></header>
<main><nav class="bc" aria-label="パンくず">${bc.map((c, i) => i < bc.length - 1 ? `<a href="${c.url}">${esc(c.name)}</a>` : esc(c.name)).join(' › ')}</nav><h1>${esc(o.h1)}</h1>${o.body}</main>${footerHtml(cat)}</body></html>`;
  return new Response(html, { status: o.status || 200, headers: {
    'content-type': 'text/html; charset=utf-8', 'cache-control': (o.status || 200) === 200 ? `public, max-age=0, s-maxage=${o.ttl || TTL}` : 'public, max-age=0, s-maxage=60',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https:; frame-src https://www.google.com https://maps.google.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'strict-transport-security': 'max-age=31536000; includeSubDomains', ...(o.noindex ? { 'x-robots-tag': 'noindex' } : {}) } });
}
const notFound = cat => frame(cat, { title: `ページが見つかりません｜${BRAND}`, desc: 'お探しのページは移動または削除された可能性があります。', canon: '/', h1: 'ページが見つかりません', noindex: true, status: 404,
  body: '<p>お探しのページは移動または削除された可能性があります。</p><p><a href="/kaitori/">買取価格一覧</a> ・ <a href="/shop/">在庫一覧</a> ・ <a href="/">トップページ</a></p>' });

/* ---------- home page ---------- */
async function topBlock(cat, px) {
  const ip = cat.models.filter(m => m.c === 'iphone').map(m => { const rows = modelRows(m, px); return { m, max: modelMax(rows), rows }; }).filter(x => x.max > 0).sort((a, b) => b.max - a.max).slice(0, 10);
  const rowsHtml = ip.map(x => `<tr><td><a href="/kaitori/iphone/${x.m.s}/">${esc(x.m.n)}</a></td><td class="p">${yen(Math.max(0, ...x.rows.map(r => r.new || 0)) || x.max)}</td><td class="p u">${Math.max(0, ...x.rows.map(r => r.used || 0)) ? yen(Math.max(...x.rows.map(r => r.used || 0))) : '—'}</td></tr>`).join('');
  return `<div class="seo-top"><h2>本日のiPhone買取価格ランキング（${ja(px.at)} ${jaTime(px.at)}更新）</h2>
<p class="seo-note">${esc(SHORT)}の買取価格の上位10機種です。新品・未使用と中古の上限価格を2時間ごとに自動更新しています（日本時間）。</p>
<div class="seo-tw"><table><thead><tr><th>機種</th><th>新品・未使用 上限</th><th>中古 上限</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
<p class="seo-note">※上限価格。状態・付属品により変動します。すべての機種は<a href="/kaitori/">買取価格一覧</a>、<a href="/kaitori/iphone/">iPhone買取価格一覧</a>をご覧ください。</p></div>`;
}
async function home(env) {
  const r = await env.ASSETS.fetch(new Request(SITE + '/'));
  if (!r.ok) return r;
  let html = await r.text();
  const cat = await catalog(env), px = await prices(cat), now = new Date();
  const top = await topBlock(cat, px);
  html = html.replace(/<!--seo:top-->[\s\S]*?<!--\/seo:top-->/, () => `<!--seo:top-->${top}<!--/seo:top-->`)
    .replace(/(<span data-clock="d">)[^<]*/, (m, a) => a + ja(now))
    .replace(/(<span class="t num" data-clock="t">)[^<]*/, (m, a) => a + jaTime(now))
    .replace(/(<span class="num" data-clock="t">)[^<]*/, (m, a) => a + jaTime(now))
    .replace(/(data-t="texts\.updated">)[^<]*/g, (m, a) => a + `${iso(px.at).replace(/-/g, '/')} ${jaTime(px.at)}`);
  const h = new Headers(r.headers); h.delete('content-length'); h.set('cache-control', `public, max-age=0, s-maxage=300`);
  return new Response(html, { status: 200, headers: h });
}

/* ---------- buyback price pages ---------- */
const seriesOrder = (a, b) => { const n = s => parseFloat((/(\d+(?:\.\d+)?)/.exec(s) || [])[1]) || 0; return n(b) - n(a) || (a < b ? -1 : 1); };
async function kaitoriIndex(env) {
  const cat = await catalog(env), px = await prices(cat);
  const rows = cat.cats.map(c => { const ms = cat.models.filter(m => m.c === c.slug); const max = Math.max(0, ...ms.map(m => modelMax(modelRows(m, px)))); return `<tr><td><a href="/kaitori/${c.slug}/">${esc(c.label)}</a></td><td>${ms.length}機種</td><td class="p">${max ? yen(max) : '—'}</td></tr>`; }).join('');
  return frame(cat, { title: `買取価格一覧（スマホ・iPad・ゲーム機・MacBook）【${ja(px.at)}更新】｜${BRAND}`, desc: `iPhone・Android・iPad・Apple Watch・ゲーム機・MacBookの買取価格を機種別に毎日更新。池袋・新宿・新大久保・鶴見の店舗は現金即払い、郵送は全国対応。`,
    canon: '/kaitori/', h1: '買取価格一覧', bc: [{ name: 'トップ', url: '/' }, { name: '買取価格一覧', url: '/kaitori/' }],
    body: `<p class="lead">カテゴリーを選ぶと、機種ごとの買取価格をご覧いただけます。価格は${ja(px.at)} ${jaTime(px.at)}時点（日本時間）です。</p><div class="tw"><table><thead><tr><th>カテゴリー</th><th>掲載数</th><th>最高買取額</th></tr></thead><tbody>${rows}</tbody></table></div>${moreLinks('')}${shopCols(cat)}` });
}
const shopCols = cat => `<h2>店頭買取は現金即払い（4店舗）</h2><div class="cols">${cat.stores.map(s => `<div class="box"><b><a href="/shops/${s.slug}/">${esc(s.name)}</a></b>${esc(s.addr)}<br>TEL <a href="${telHref(s.tel)}">${esc(s.tel)}</a></div>`).join('')}</div>`;
async function categoryPage(env, slug) {
  const cat = await catalog(env), c = cat.cats.find(x => x.slug === slug); if (!c) return null;
  const px = await prices(cat);
  const ms = cat.models.filter(m => m.c === slug).map(m => ({ m, rows: modelRows(m, px) }));
  const groups = {}; ms.forEach(x => (groups[x.m.se] = groups[x.m.se] || []).push(x));
  const heads = Object.keys(groups).sort(seriesOrder);
  const body = heads.map(h => `<h2>${esc(h)}の買取価格</h2><div class="tw"><table><thead><tr><th>機種</th><th>新品・未使用 上限</th><th>中古 上限</th></tr></thead><tbody>${groups[h].sort((a, b) => modelMax(b.rows) - modelMax(a.rows)).map(x => {
    const nn = Math.max(0, ...x.rows.map(r => r.new || 0)), uu = Math.max(0, ...x.rows.map(r => r.used || 0));
    return `<tr><td>${x.m.i ? `<img src="/${esc(x.m.i)}" alt="" width="40" height="40" loading="lazy">` : ''}<a href="/kaitori/${slug}/${x.m.s}/">${esc(x.m.n)}</a></td><td class="p">${nn ? yen(nn) : 'お問い合わせ'}</td><td class="p u">${uu ? yen(uu) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`).join('');
  const top = ms.slice().sort((a, b) => modelMax(b.rows) - modelMax(a.rows)).slice(0, 3).map(x => x.m.n).join('、');
  return frame(cat, { title: `${c.label}の買取価格一覧【${ja(px.at)}更新】｜池袋・新宿・鶴見・郵送OK｜${BRAND}`, desc: `${c.label}の買取価格を${ms.length}機種掲載。${top ? top + 'など、' : ''}毎日更新。店頭なら即日現金、郵送買取は全国対応。`,
    canon: `/kaitori/${slug}/`, h1: `${c.label} 買取価格一覧`, bc: [{ name: 'トップ', url: '/' }, { name: '買取価格一覧', url: '/kaitori/' }, { name: c.label, url: `/kaitori/${slug}/` }],
    body: `<p class="lead">${esc(c.label)}の買取価格です（${ms.length}機種）。機種名を選ぶと、容量別・状態別の価格をご覧いただけます。${ja(px.at)} ${jaTime(px.at)}時点（日本時間）の上限価格です。</p><p class="note">※上限価格。状態・付属品により変動します。</p>${body}
<p><a class="cta" href="/?apply=1">査定を申し込む</a></p>${moreLinks('')}<h2>ほかのカテゴリー</h2><ul class="cats">${cat.cats.map(x => x.slug === slug ? `<li><b>${esc(x.label)}</b></li>` : `<li><a href="/kaitori/${x.slug}/">${esc(x.label)}</a></li>`).join('')}</ul>${shopCols(cat)}` });
}
function modelFaq(m, c, rows, px) {
  const nn = Math.max(0, ...rows.map(r => r.new || 0)), uu = Math.max(0, ...rows.map(r => r.used || 0));
  const price = [nn ? `新品・未使用は最大${yen(nn)}` : '', uu ? `中古は最大${yen(uu)}` : ''].filter(Boolean).join('、');
  return [
    { q: `${m.n}の買取価格はいくらですか？`, a: `${ja(px.at)}時点の上限価格は、${price || 'お問い合わせください'}です。容量・状態・付属品によって変わります。価格は毎日更新しています。` },
    { q: `${m.n}の買取に必要なものは？`, a: 'お売りいただく商品と、顔写真付きの本人確認書類をお持ちください。郵送買取はeKYC（スマホでの本人確認）が必要です。' },
    { q: `店頭ですぐに現金をもらえますか？`, a: `はい。店舗・オフィスにお持ち込みいただければ、査定金額にご納得いただいた後、その場で現金をお支払いします。予約は不要です。` },
    { q: `${m.n}は郵送でも買取してもらえますか？`, a: `はい。郵送買取は全国対応です。予約承認日の当日に発送された商品が価格保証の対象となります。代金は査定承認の翌日から3営業日以内（土日祝を除く）にお振込みします。` },
    { q: `査定金額はいつまで有効ですか？`, a: '店頭は査定当日限りです。郵送は予約承認日の当日に発送された商品が価格保証の対象です。' },
    { q: `画面割れや故障した${m.n}も買取できますか？`, a: '画面割れ・バッテリー劣化・電源が入らないなどの故障品も査定します。状態に応じて個別にお見積りします。' },
    { q: `${m.n}を売る前にやることは？`, a: 'データのバックアップ、「探す」機能（アクティベーションロック）のオフ、アカウントのサインアウト、初期化、SIMカードの取り外しを行ってください。' }
  ];
}
async function modelPage(env, cslug, mslug) {
  const cat = await catalog(env), c = cat.cats.find(x => x.slug === cslug); if (!c) return null;
  const m = cat.models.find(x => x.c === cslug && x.s === mslug); if (!m) return null;
  const px = await prices(cat), rows = modelRows(m, px), max = modelMax(rows);
  const hasOpen = rows.some(r => r.opened), gk = ['S', 'A', 'B', 'C'].filter(k => rows.some(r => r.g[k]));
  const th = `<th>容量・型番</th><th>新品・未使用</th>${hasOpen ? '<th>開封未使用</th>' : ''}<th>中古</th>${gk.map(k => `<th>中古${k}</th>`).join('')}`;
  const tr = rows.map(r => `<tr><td>${esc(r.storage || r.name.replace(m.n, '').trim() || r.name)}</td><td class="p">${r.new ? yen(r.new) : 'お問い合わせ'}</td>${hasOpen ? `<td class="p u">${r.opened ? yen(r.opened) : '—'}</td>` : ''}<td class="p u">${r.used ? yen(r.used) : '—'}</td>${gk.map(k => `<td class="p u">${r.g[k] ? yen(r.g[k]) : '—'}</td>`).join('')}</tr>`).join('');
  const faq = modelFaq(m, c, rows, px);
  let stockBlock = '';
  try {
    const items = (await stock(env)).filter(p => sameModel(m.n, p.model));
    if (items.length) stockBlock = `<h2>${esc(m.n)}の中古在庫</h2><p>${esc(m.n)}の中古スマホは現在${items.length}台の在庫があります。</p><ul class="grid">${items.slice(0, 12).map(p => `<li><a href="/shop/${esc(p.product_code)}">${esc(itemName(p))}</a><br><span class="tag">在庫あり</span> <b style="color:#E0475F">${yen(p.selling_price)}</b></li>`).join('')}</ul><p><a href="/shop/${slugify(m.n)}/">${esc(m.n)}の在庫をすべて見る</a></p>`;
  } catch (e) { /* stock unavailable: block stays hidden */ }
  const title = `${m.n} 買取価格・相場【${ja(px.at)}更新】上限${yen(max)}｜池袋・新宿・鶴見・郵送OK｜${SHORT}`;
  return frame(cat, { title, desc: `${m.n}の買取価格・相場を容量別・状態別に毎日更新（${ja(px.at)}時点の上限${yen(max)}）。未使用・中古・画面割れなどの故障品も査定。店頭なら即日現金、郵送買取は全国対応。`, canon: `/kaitori/${cslug}/${mslug}/`, h1: `${m.n} 買取価格`,
    bc: [{ name: 'トップ', url: '/' }, { name: '買取価格一覧', url: '/kaitori/' }, { name: c.label, url: `/kaitori/${cslug}/` }, { name: m.n, url: `/kaitori/${cslug}/${mslug}/` }], apply: `/?sell=${rows[0].rjp}`,
    ld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }],
    body: `<p class="lead">${esc(m.n)}の買取価格です。${ja(px.at)} ${jaTime(px.at)}時点（日本時間）。価格は毎日更新しています。</p>
${m.i ? `<p><img src="/${esc(m.i)}" alt="${esc(m.n)}" width="${m.iw}" height="${m.ih}" style="max-width:200px;max-height:200px;width:auto;height:auto;object-fit:contain"></p>` : ''}
<div class="tw"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div><p class="note">※上限価格。状態・付属品により変動します。</p>
<p><a class="cta" href="/?sell=${esc(rows[0].rjp)}">査定を申し込む</a></p>${stockBlock}
<h2>${esc(m.n)}の買取についてよくある質問</h2>${faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}
${moreLinks('')}<h2>${esc(m.n)}を売れる店舗</h2>${shopCols(cat)}<p><a href="/kaitori/${cslug}/">${esc(c.label)}の買取価格一覧に戻る</a></p>` });
}

/* ---------- content pages ---------- */
const para = t => String(t || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
function policyHtml(text, cat) {   // lines starting with ■ become headings
  const t = String(text || '').replace(/\{brand\}/g, SHORT).replace(/\{license\}/g, '古物商許可 ' + cat.texts.license);
  return para(t).map(l => l.startsWith('■') ? `<h2>${esc(l.replace(/^■\s*/, ''))}</h2>` : l.startsWith('・') ? `<p>・${esc(l.slice(1))}</p>` : `<p>${esc(l)}</p>`).join('');
}
const methodsHtml = METHODS => METHODS.map(m => `<h2>${esc(m[0])}</h2><p>${esc(m[1])}</p><ol class="steps">${m[2].map(s => `<li><b>${esc(s[0])}</b>　${esc(s[1])}</li>`).join('')}</ol>${m[3] ? `<p class="note">${esc(m[3])}</p>` : ''}`).join('');
const METHODS = [
  ['店頭買取', '予約不要。その場で現金払い。', [['ご来店', '商品と本人確認書類をお持ちください。'], ['査定', '専門スタッフが当日の相場で金額を出します。'], ['本人確認', '買取申込書のご記入と身分証の確認。'], ['現金でお支払い', 'ご納得いただければ、その場でお渡し。']], ''],
  ['郵送買取', '着払いで送るだけ。全国対応。', [['会員登録・eKYC', 'スマホで身分証撮影と顔認証。'], ['買取予約', '商品と数量を選んで申込み。'], ['承認日当日に発送', '着払いで依頼書と一緒に発送。'], ['検品・査定', '相違がある場合のみご連絡。'], ['お振込み', '承認翌日から3営業日以内。']], '送り先：Royal Japan 〒171-0021 東京都豊島区西池袋1-10-2 日高ビル503。承認日以外の発送は価格保証の対象外です。'],
  ['法人買取', '在庫・社用端末をまとめてお見積り。', [['お問い合わせ', '品目と数量をメールで。'], ['お見積り', '最短当日にご提示。'], ['引取り・発送', '都内は引取り可能。'], ['検品・ご精算', '検品後にお振込み。']], '登記事項証明書とご担当者様の身分証が必要です。'],
  ['eKYC本人確認', '書類撮影＋顔認証で最短即日。', [['書類を選ぶ', '運転免許証・マイナンバーカードなど。'], ['撮影', '表裏と厚みを撮影。'], ['顔認証', '画面の指示に沿って自撮り。'], ['完了', '最短即日で承認メール。']], '顔写真付きの本人確認書類が必要です。']
];
const faqLd = list => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: list.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
const TOP = { name: 'トップ', url: '/' };
const PAGES = {
  '/company/': cat => ({ title: `会社概要｜${cat.texts.legal}｜${BRAND}`, desc: `${BRAND}を運営する${cat.texts.legal}の会社概要。古物商許可 ${cat.texts.license}。池袋・新宿・新大久保・鶴見の4店舗で買取・販売を行っています。`, h1: '会社概要', bc: [TOP, { name: '会社概要', url: '/company/' }],
    body: `<dl class="f"><dt>会社名</dt><dd>${esc(cat.texts.legal)}</dd><dt>サービス名</dt><dd>${esc(BRAND)}</dd><dt>古物商許可</dt><dd>${esc(cat.texts.license)}</dd><dt>事業内容</dt><dd>スマートフォン・タブレット・ゲーム機・パソコンなどの買取および中古品の販売（古物営業）</dd><dt>本店・郵送買取の送り先</dt><dd>${esc(cat.stores[0].addr)}</dd><dt>営業時間</dt><dd>${esc(cat.texts.openFrom)}〜${esc(cat.texts.openTo)}（年中無休）</dd><dt>ウェブサイト</dt><dd><a href="${SITE}/">${SITE}/</a></dd></dl>${shopCols(cat)}` }),
  '/kaitori/flow/': cat => ({ title: `買取の流れ｜店頭・郵送・法人・eKYC｜${BRAND}`, desc: '店頭買取・郵送買取・法人買取の流れと、eKYC本人確認の手順をご案内します。店頭は予約不要でその場で現金払い、郵送は全国対応です。', h1: '買取の流れ', bc: [TOP, { name: '買取の流れ', url: '/kaitori/flow/' }],
    body: `<p class="lead">売り方は4つあります。ご都合に合わせてお選びください。</p>${methodsHtml(METHODS)}<p><a class="cta" href="/?apply=1">無料で査定する</a></p>` }),
  '/faq/': cat => ({ title: `よくある質問｜買取・本人確認・お支払い｜${BRAND}`, desc: '買取に必要なもの、使える本人確認書類、店頭買取の予約、郵送買取の送料やお支払い時期など、よくあるご質問にお答えします。', h1: 'よくある質問', bc: [TOP, { name: 'よくある質問', url: '/faq/' }], ld: [faqLd(cat.faq)],
    body: cat.faq.map(f => `<h2>${esc(f.q)}</h2><p>${esc(f.a)}</p>`).join('') + '<p><a class="cta" href="/?apply=1">無料で査定する</a></p>' }),
  '/contact/': cat => ({ title: `お問い合わせ｜店舗の電話番号・買取のご相談｜${BRAND}`, desc: '買取のご相談・お見積りは各店舗へお電話ください。掲載にない商品のご相談は、写真を送って個別にお見積りします。', h1: 'お問い合わせ', bc: [TOP, { name: 'お問い合わせ', url: '/contact/' }],
    body: `<p class="lead">ご来店前のお問い合わせは、各店舗へお電話ください。営業時間は${esc(cat.texts.openFrom)}〜${esc(cat.texts.openTo)}です。</p>${shopCols(cat)}<h2>掲載にない商品のご相談</h2><p>商品名と状態をお知らせいただければ、個別にお見積りします。サイトのフォームから写真を送ってご相談いただけます。</p><p><a class="cta" href="/?apply=1">サイトから相談する</a></p>${cat.texts.contactEmail ? `<p>メール：${esc(cat.texts.contactEmail)}</p>` : ''}` }),
  '/privacy/': cat => ({ title: `プライバシーポリシー｜${BRAND}`, desc: `${cat.texts.legal}（${SHORT}）の個人情報の取り扱いについて。取得する情報、利用目的、第三者提供、安全管理、開示請求などを定めています。`, h1: 'プライバシーポリシー', bc: [TOP, { name: 'プライバシーポリシー', url: '/privacy/' }],
    body: `<div class="prose">${cat.texts.privacyDate ? `<p class="note">${esc(cat.texts.privacyDate)}</p>` : ''}${policyHtml(cat.texts.privacy, cat)}</div>` }),
  '/cookie/': cat => ({ title: `Cookieポリシー｜${BRAND}`, desc: `${SHORT}のサイトで使用するCookie等の種類と使い方、設定の変更方法をご案内します。`, h1: 'Cookieポリシー', bc: [TOP, { name: 'Cookieポリシー', url: '/cookie/' }],
    body: `<div class="prose">${policyHtml(cat.texts.cookie, cat)}</div>` }),
  '/terms/': cat => ({ title: `利用規約（買取利用規約）｜${BRAND}`, desc: `${SHORT}の買取サービスをご利用いただく際の規約です。本人確認、査定金額、お支払い、郵送買取、未成年のお客様について定めています。`, h1: '利用規約（買取利用規約）', bc: [TOP, { name: '利用規約', url: '/terms/' }],
    body: `<div class="prose"><p>この規約は、${esc(cat.texts.legal)}（以下「当店」）が運営する${esc(SHORT)}の買取サービスのご利用条件を定めるものです。お申込みの前にご確認ください。</p>
<h2>第1条（本人確認）</h2><p>買取には、顔写真付きの本人確認書類（運転免許証、マイナンバーカードの表面、パスポート、在留カードなど、現住所が確認できるもの）が必要です。郵送買取は、eKYC（スマホでの書類撮影と顔認証）で本人確認を行います。古物営業法に基づき、取引の記録を保存します。</p>
<h2>第2条（査定金額）</h2><p>サイトに表示する買取価格は上限価格です。商品の状態・付属品・色・容量などにより、実際の金額は変わります。店頭での査定金額は査定当日限りです。</p>
<h2>第3条（店頭買取）</h2><p>店頭買取は予約不要です。査定金額にご納得いただいた後、その場で現金をお支払いします。大量の場合は事前にご連絡いただくと査定がスムーズです。</p>
<h2>第4条（郵送買取）</h2><p>郵送買取は、予約承認日の当日に発送された商品が価格保証の対象です。商品と買取依頼書を同封し、着払いでお送りください。検品後に金額をご連絡し、査定承認の翌日から3営業日以内（土日祝を除く）にお振込みします。</p>
<h2>第5条（未成年のお客様）</h2><p>18歳未満のお客様は、保護者の同意書をご提出いただいた場合に限りお取引いただけます。高校生の方は、18歳以上でも保護者の同意が必要です。</p>
<h2>第6条（買取できない場合）</h2><p>盗品の疑いがある場合、本人確認ができない場合、法令に反する場合は、買取をお断りします。</p>
<h2>第7条（個人情報）</h2><p>個人情報は、<a href="/privacy/">プライバシーポリシー</a>に従って取り扱います。</p>
<h2>第8条（規約の変更）</h2><p>当店は、必要に応じて本規約を変更することがあります。変更後の内容は、当サイトに掲載した時点から効力を生じます。</p></div>` }),
  '/kaitori/notes/': cat => ({ title: `買取時のご注意事項｜${BRAND}`, desc: '買取のお申込み前にご確認いただきたい注意事項です。本人確認、価格の有効期間、郵送買取の発送日、返品についてまとめています。', h1: '買取時のご注意事項', bc: [TOP, { name: '買取時のご注意事項', url: '/kaitori/notes/' }],
    body: `<div class="prose"><ul><li>サイトの買取価格は上限価格です。状態・付属品により変動します。</li><li>顔写真付きの本人確認書類が必要です（郵送買取はeKYC）。</li><li>店頭の査定金額は査定当日限りです。</li><li>郵送買取は、予約承認日の当日に発送された商品が価格保証の対象です。承認日以外の発送は対象外です。</li><li>代金は査定承認の翌日から3営業日以内（土日祝を除く）にお振込みします。</li><li>18歳未満のお客様は保護者の同意書が必要です。高校生の方は、18歳以上でも保護者の同意が必要です。</li><li>購入した商品は返品を承っていますが、商品によっては返品手数料がかかります。詳しくは店舗へお問い合わせください。</li></ul>
<p>詳しくは<a href="/terms/">利用規約</a>・<a href="/faq/">よくある質問</a>をご覧ください。</p></div>` })
};

/* ---------- keyword landing pages and guides (built from the live prices; no invented numbers) ---------- */
const GUIDE_LINKS = [['iPhoneを売る前にやること', '/kaitori/guide/uru-mae/'], ['スマホ買取はどこがいい？選び方', '/kaitori/guide/dokoga-ii/'], ['下取りと買取の違い', '/kaitori/guide/shitadori/'], ['Androidを売る前にやること', '/kaitori/guide/android-uru-mae/']];
const SELL_LINKS = [['iPhone買取相場・価格ランキング', '/kaitori/soba/'], ['未使用・新品iPhoneの買取', '/kaitori/unused/'], ['故障・画面割れ・ジャンクの買取', '/kaitori/junk/'], ['郵送買取（全国対応）', '/kaitori/mail/'], ['赤ロムの買取', '/kaitori/akarom/']];
const linkList = (list, here) => `<ul class="cats">${list.filter(([, u]) => u !== here).map(([n, u]) => `<li><a href="${u}">${esc(n)}</a></li>`).join('')}</ul>`;
const moreLinks = here => `<h2>売り方・状態から探す</h2>${linkList(SELL_LINKS, here)}<h2>売る前に読むガイド</h2>${linkList(GUIDE_LINKS, here)}`;
const faqBlock = list => list.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('');
const ranked = (cat, px, cats, pick) => cat.models.filter(m => cats.includes(m.c)).map(m => { const rows = modelRows(m, px); return { m, rows, v: pick(rows) }; }).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
const rankTable = (list, cols) => `<div class="tw"><table><thead><tr><th>順位</th><th>機種</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${list.map((x, i) => `<tr><td>${i + 1}</td><td><a href="/kaitori/${x.m.c}/${x.m.s}/">${esc(x.m.n)}</a></td>${cols.map(c => { const v = c[1](x.rows); return `<td class="p${c[2] ? ' u' : ''}">${v ? yen(v) : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
const maxNew = rows => Math.max(0, ...rows.map(r => r.new || 0)), maxUsed = rows => Math.max(0, ...rows.map(r => r.used || 0));
const SELL_PAGES = {
  '/kaitori/soba/': async (cat, px) => {
    const ip = ranked(cat, px, ['iphone'], maxNew).slice(0, 30), and = ranked(cat, px, ['simfree', 'docomo', 'au', 'softbank', 'rakuten', 'mvno'], rows => Math.max(maxNew(rows), maxUsed(rows))).filter(x => !/iphone/i.test(x.m.n)).slice(0, 15);
    const faq = [
      { q: 'iPhoneの買取相場はどうやって決まりますか？', a: '新品・中古の市場価格、在庫状況、モデルの新しさ、容量によって毎日変わります。当店では東京の相場をもとに価格を自動更新しています。' },
      { q: '一番高く売れるiPhoneは？', a: `${ja(px.at)}時点では${ip[0] ? ip[0].m.n + '（新品・未使用 上限' + yen(maxNew(ip[0].rows)) + '）' : '最新モデル'}が最も高い買取価格です。` },
      { q: '相場が下がる前に売るべきタイミングは？', a: '一般的に新モデルの発表・発売前後に旧モデルの相場は下がりやすくなります。使わなくなったら早めに売るのがおすすめです。' }];
    return { title: `iPhone買取相場・買取価格ランキング【${ja(px.at)}更新】｜${BRAND}`, desc: `iPhoneの買取相場を毎日更新。${ip[0] ? ip[0].m.n + 'は最大' + yen(maxNew(ip[0].rows)) + '。' : ''}機種別の新品・中古の上限価格ランキング上位30。池袋・新宿・鶴見の店頭は現金即払い、郵送は全国対応。`,
      h1: 'iPhone買取相場・買取価格ランキング', bc: [TOP, { name: '買取価格一覧', url: '/kaitori/' }, { name: 'iPhone買取相場', url: '/kaitori/soba/' }], ld: [faqLd(faq)],
      body: `<p class="lead">${ja(px.at)} ${jaTime(px.at)}時点（日本時間）のiPhone買取相場です。新品・未使用と中古の上限価格を高い順に並べています。価格は2時間ごとに自動更新されます。</p>
<h2>iPhone買取価格ランキング 上位30機種</h2>${rankTable(ip, [['新品・未使用 上限', maxNew], ['中古 上限', maxUsed, 1]])}<p class="note">※上限価格。状態・付属品・容量により変動します。容量別の価格は機種名からご覧ください。</p>
${and.length ? `<h2>Android・SIMフリースマホの買取相場</h2>${rankTable(and, [['新品・未使用 上限', maxNew], ['中古 上限', maxUsed, 1]])}` : ''}
<h2>iPhone買取相場についてよくある質問</h2>${faqBlock(faq)}<p><a class="cta" href="/?apply=1">無料で査定する</a></p>${moreLinks('/kaitori/soba/')}${shopCols(cat)}` };
  },
  '/kaitori/unused/': async (cat, px) => {
    const ip = ranked(cat, px, ['iphone'], maxNew).slice(0, 40);
    const faq = [
      { q: '未開封・未使用のiPhoneはいくらで売れますか？', a: `機種と容量によります。${ja(px.at)}時点では${ip[0] ? ip[0].m.n + 'の新品・未使用が最大' + yen(maxNew(ip[0].rows)) : '最新モデルが最も高額'}です。下の一覧で機種ごとの上限価格をご確認ください。` },
      { q: '開封済みでも未使用として売れますか？', a: '開封済みで使用していない商品は「開封未使用」として査定します。機種によっては開封未使用の価格を掲載しています。' },
      { q: '未使用品を売るときに必要なものは？', a: '商品（箱・付属品を含む）と、顔写真付きの本人確認書類をお持ちください。郵送の場合はeKYCで本人確認を行います。' }];
    return { title: `未使用・新品iPhone買取｜未開封の高価買取価格【${ja(px.at)}更新】｜${BRAND}`, desc: `未使用・未開封・新品のiPhoneを高価買取。${ip[0] ? ip[0].m.n + 'は最大' + yen(maxNew(ip[0].rows)) + '。' : ''}機種別の新品・未使用の上限価格を毎日更新。店頭は現金即払い、郵送は全国対応。`,
      h1: '未使用・新品iPhoneの買取', bc: [TOP, { name: '買取価格一覧', url: '/kaitori/' }, { name: '未使用・新品iPhone買取', url: '/kaitori/unused/' }], ld: [faqLd(faq)],
      body: `<p class="lead">未開封・未使用のiPhoneは、中古よりも高く買い取ります。${ja(px.at)} ${jaTime(px.at)}時点（日本時間）の新品・未使用の上限価格です。</p>
<h2>未使用・新品iPhoneの買取価格 上位40機種</h2>${rankTable(ip, [['新品・未使用 上限', maxNew]])}<p class="note">※上限価格。箱・付属品の有無や容量により変動します。</p>
<h2>未使用iPhoneの買取についてよくある質問</h2>${faqBlock(faq)}<p><a class="cta" href="/?apply=1">無料で査定する</a></p>${moreLinks('/kaitori/unused/')}${shopCols(cat)}` };
  },
  '/kaitori/junk/': async (cat, px) => {
    const ip = ranked(cat, px, ['iphone'], maxUsed).slice(0, 20);
    const faq = [
      { q: '画面が割れたiPhoneでも買取できますか？', a: 'はい。画面割れ・背面割れのiPhoneも査定します。状態により減額となりますが、お値段をおつけできる場合が多くあります。まずはお気軽にご相談ください。' },
      { q: '電源が入らない・水没したスマホも売れますか？', a: '故障・ジャンク品としてお見積りします。部品として価値がある場合もあるため、処分する前にご相談ください。' },
      { q: 'ジャンク品の査定に必要なものは？', a: '商品と、顔写真付きの本人確認書類が必要です。アクティベーションロック（iPhoneを探す）は必ず解除してください。解除できない場合は買取できません。' },
      { q: 'ネットワーク利用制限が「×」（赤ロム）のスマホは？', a: `赤ロムのスマホも買取しています。<a href="/kaitori/akarom/">赤ロムの買取価格</a>をご覧ください。` }];
    return { title: `故障・画面割れ・ジャンクiPhone買取｜壊れたスマホも査定｜${BRAND}`, desc: '画面割れ・背面割れ・電源が入らない・水没など、故障したiPhoneやジャンクのスマホも買取査定します。池袋・新宿・新大久保・鶴見の店頭は現金即払い、郵送は全国対応。',
      h1: '故障・画面割れ・ジャンクのiPhone買取', bc: [TOP, { name: '買取価格一覧', url: '/kaitori/' }, { name: '故障・ジャンク買取', url: '/kaitori/junk/' }], ld: [faqLd(faq.map(f => ({ q: f.q, a: f.a.replace(/<[^>]+>/g, '') })))],
      body: `<p class="lead">画面割れ・背面割れ、電源が入らない、バッテリーが膨張した、水没したなど、壊れたiPhone・スマホも査定します。故障の内容により個別にお見積りします。</p>
<h2>査定できる故障の例</h2><ul class="cats"><li>画面割れ・液晶不良</li><li>背面ガラス割れ</li><li>電源が入らない</li><li>水没・充電できない</li><li>カメラ・Face ID不良</li><li>バッテリー劣化・膨張</li></ul>
<h2>故障・ジャンク品を売るときの注意</h2><ol class="steps"><li><b>アクティベーションロックを解除</b>　「iPhoneを探す」がオンのままだと買取できません。</li><li><b>データは消去できる範囲で消去</b>　画面が見えない場合は店頭でご相談ください。</li><li><b>本人確認書類を用意</b>　顔写真付きの書類が必要です。</li></ol>
<h2>参考：iPhoneの中古買取 上限価格</h2><p>故障品はこの価格から状態に応じて減額となります。正常に動く中古品の上限価格の目安としてご覧ください。</p>${rankTable(ip, [['中古 上限（正常品）', maxUsed, 1]])}
<h2>故障・ジャンク買取についてよくある質問</h2>${faq.map(f => `<h3>${esc(f.q)}</h3><p>${f.a.includes('<a ') ? f.a : esc(f.a)}</p>`).join('')}<p><a class="cta" href="/?apply=1">無料で査定する（故障・ジャンクを選択）</a></p>${moreLinks('/kaitori/junk/')}${shopCols(cat)}` };
  },
  '/kaitori/mail/': async cat => {
    const steps = METHODS[1][2];
    const faq = cat.faq.filter(f => /郵送|送料|振り込|送れば/.test(f.q));
    return { title: `郵送買取（宅配買取）｜iPhone・スマホを全国から買取｜${BRAND}`, desc: 'iPhone・スマホ・ゲーム機の郵送買取（宅配買取）。全国どこからでも着払いで送るだけ。予約承認日に発送すれば価格保証、査定承認から3営業日以内にお振込み。梱包方法もご案内します。',
      h1: '郵送買取（全国対応）', bc: [TOP, { name: '買取の流れ', url: '/kaitori/flow/' }, { name: '郵送買取', url: '/kaitori/mail/' }], ld: faq.length ? [faqLd(faq)] : [],
      body: `<p class="lead">お近くに店舗がなくても、郵送で全国から買取できます。着払いで送るだけで、査定承認の翌日から3営業日以内（土日祝を除く）にお振込みします。</p>
<h2>郵送買取の流れ</h2><ol class="steps">${steps.map(x => `<li><b>${esc(x[0])}</b>　${esc(x[1])}</li>`).join('')}</ol><p class="note">${esc(METHODS[1][3])}</p>
<h2>iPhone・スマホの梱包方法</h2><ol class="steps"><li><b>初期化とロック解除</b>　「iPhoneを探す」をオフにして初期化します（<a href="/kaitori/guide/uru-mae/">手順はこちら</a>）。</li><li><b>SIMカードを抜く</b>　SIMカード・SDカードは取り外してください。</li><li><b>緩衝材で包む</b>　本体をプチプチなどで包み、箱の中で動かないようにします。</li><li><b>買取依頼書を同封</b>　依頼書を入れて封をし、着払いで発送します。</li></ol>
${faq.length ? `<h2>郵送買取についてよくある質問</h2>${faqBlock(faq)}` : ''}<p><a class="cta" href="/?apply=1">郵送買取を申し込む</a></p>${moreLinks('/kaitori/mail/')}` };
  },
  '/kaitori/guide/': async cat => ({ title: `スマホを売る前に読むガイド｜${BRAND}`, desc: 'iPhone・Androidを売る前にやること、買取店の選び方、下取りと買取の違いなど、スマホを高く安全に売るためのガイドです。', h1: 'スマホ買取ガイド',
    bc: [TOP, { name: 'ガイド', url: '/kaitori/guide/' }], body: `<p class="lead">スマホを高く、安全に売るための基本をまとめました。</p>${linkList(GUIDE_LINKS, '')}<h2>売り方・状態から探す</h2>${linkList(SELL_LINKS, '')}` }),
  '/kaitori/guide/uru-mae/': async cat => {
    const steps = [['バックアップを取る', '設定 → 自分の名前 → iCloud → iCloudバックアップ、またはパソコンでバックアップします。'], ['LINEなどアプリの引き継ぎ', 'LINEはトーク履歴のバックアップと引き継ぎ設定を先に行います。'], ['Apple Watchのペアリング解除', 'Apple Watchを使っている場合は、先にペアリングを解除します。'], ['「iPhoneを探す」をオフにする', '設定 → 自分の名前 → 探す → iPhoneを探す をオフ。Apple IDのパスワードが必要です。これがオンのままだと買取できません（アクティベーションロック）。'], ['Apple IDからサインアウト', '設定 → 自分の名前 → 一番下の「サインアウト」。'], ['iPhoneを初期化する', '設定 → 一般 → 転送またはiPhoneをリセット → すべてのコンテンツと設定を消去。'], ['SIMカード・eSIMの扱い', 'SIMカードは抜いておきます。eSIMは初期化時に削除するか、事前に通信会社で手続きします。'], ['ネットワーク利用制限を確認', 'キャリアの分割払いが残っていると「△」になる場合があります。赤ロム（×）でも買取できます。']];
    const faq = [{ q: '初期化しないで売っても大丈夫ですか？', a: '店頭では、スタッフと一緒に初期化することもできます。ただし「iPhoneを探す」の解除にはApple IDのパスワードが必要なので、必ず確認してからお越しください。' }, { q: '分割払いが残っていても売れますか？', a: 'はい、売れます。ネットワーク利用制限が「△」の場合は買取価格が変わることがあります。' }, { q: '箱や付属品がなくても売れますか？', a: '本体のみでも買取できます。箱・付属品がそろっていると査定がプラスになる場合があります。' }];
    return { title: `iPhoneを売る前にやること8つ｜初期化・iPhoneを探すの解除・SIM｜${BRAND}`, desc: 'iPhoneを売る前・下取りに出す前にやることを8ステップで解説。バックアップ、LINEの引き継ぎ、「iPhoneを探す」のオフ、Apple IDのサインアウト、初期化のやり方、SIMカードの扱いまで。',
      h1: 'iPhoneを売る前にやること8つ（初期化のやり方）', bc: [TOP, { name: 'ガイド', url: '/kaitori/guide/' }, { name: 'iPhoneを売る前にやること', url: '/kaitori/guide/uru-mae/' }], ld: [faqLd(faq), { '@context': 'https://schema.org', '@type': 'HowTo', name: 'iPhoneを売る前にやること', step: steps.map((x, i) => ({ '@type': 'HowToStep', position: i + 1, name: x[0], text: x[1] })) }],
      body: `<p class="lead">iPhoneを買取に出す前・下取りに出す前に、この順番で準備すれば安心です。特に「iPhoneを探す」のオフは必須です。</p><ol class="steps">${steps.map(x => `<li><b>${esc(x[0])}</b><br>${esc(x[1])}</li>`).join('')}</ol>
<h2>よくある質問</h2>${faqBlock(faq)}<p><a class="cta" href="/kaitori/iphone/">iPhoneの買取価格を見る</a></p>${moreLinks('/kaitori/guide/uru-mae/')}` };
  },
  '/kaitori/guide/android-uru-mae/': async cat => {
    const steps = [['データのバックアップ', 'Googleアカウントへのバックアップ、写真はGoogleフォトなどに保存します。'], ['LINEなどアプリの引き継ぎ', 'トーク履歴のバックアップと引き継ぎを先に行います。'], ['Googleアカウントを削除', '設定 → パスワードとアカウント → Googleアカウントを削除。残したまま初期化すると「Googleアカウントの確認（FRP）」でロックがかかります。'], ['Galaxyはサムスンアカウントも削除', 'Galaxyはサムスンアカウントも削除しておきます。'], ['初期化（工場出荷状態に戻す）', '設定 → システム → リセット → すべてのデータを消去（機種により名称が異なります）。'], ['SIMカード・SDカードを抜く', 'SIMカードとmicroSDカードを取り外します。']];
    return { title: `Android・Galaxy・Pixel・Xperiaを売る前にやること｜初期化とGoogleアカウント削除｜${BRAND}`, desc: 'Androidスマホ（Galaxy・Pixel・Xperia・AQUOSなど）を売る前にやることを解説。バックアップ、Googleアカウントの削除、初期化、SIMカードの取り外しまで。',
      h1: 'Androidスマホを売る前にやること', bc: [TOP, { name: 'ガイド', url: '/kaitori/guide/' }, { name: 'Androidを売る前にやること', url: '/kaitori/guide/android-uru-mae/' }],
      ld: [{ '@context': 'https://schema.org', '@type': 'HowTo', name: 'Androidスマホを売る前にやること', step: steps.map((x, i) => ({ '@type': 'HowToStep', position: i + 1, name: x[0], text: x[1] })) }],
      body: `<p class="lead">Galaxy・Pixel・Xperia・AQUOSなどのAndroidスマホは、Googleアカウントを削除してから初期化するのがポイントです。</p><ol class="steps">${steps.map(x => `<li><b>${esc(x[0])}</b><br>${esc(x[1])}</li>`).join('')}</ol>
<p><a class="cta" href="/kaitori/simfree/">Android・SIMフリーの買取価格を見る</a></p>${moreLinks('/kaitori/guide/android-uru-mae/')}` };
  },
  '/kaitori/guide/dokoga-ii/': async cat => ({ title: `スマホ・iPhone買取はどこがいい？高く売る店の選び方5つ｜${BRAND}`, desc: 'iPhone・スマホを売るならどこがいい？買取店・郵送買取・キャリア下取り・フリマアプリの違いと、高く売るための買取店の選び方を5つのポイントで解説します。', h1: 'スマホ・iPhone買取はどこがいい？選び方',
    bc: [TOP, { name: 'ガイド', url: '/kaitori/guide/' }, { name: 'スマホ買取はどこがいい？', url: '/kaitori/guide/dokoga-ii/' }],
    body: `<p class="lead">スマホを売る方法は大きく4つあります。手間・スピード・金額のバランスで選びましょう。</p>
<div class="tw"><table><thead><tr><th>売り方</th><th>現金化まで</th><th>手間</th><th>特徴</th></tr></thead><tbody><tr><td>買取店（店頭）</td><td>即日</td><td>少ない</td><td>その場で現金。査定額を見てから決められる</td></tr><tr><td>郵送買取</td><td>数日</td><td>少ない</td><td>全国から送るだけ。店に行けない人向け</td></tr><tr><td>キャリアの下取り</td><td>機種変更時</td><td>少ない</td><td>ポイントや割引で還元されることが多い</td></tr><tr><td>フリマアプリ</td><td>売れるまで</td><td>多い</td><td>出品・発送・やり取りが必要</td></tr></tbody></table></div>
<h2>買取店を選ぶ5つのポイント</h2><ol class="steps"><li><b>買取価格を公開している</b>　機種別・容量別の価格がサイトに載っている店は比較しやすく安心です。</li><li><b>価格を毎日更新している</b>　相場は日々変わります。更新日が新しいかを確認しましょう。</li><li><b>古物商許可番号を表示している</b>　中古品の買取には古物商許可が必要です。</li><li><b>すぐに現金化できる</b>　店頭で即日現金払いか、振込までの日数を確認しましょう。</li><li><b>故障品・赤ロムにも対応</b>　壊れたスマホも査定してくれる店なら、まとめて売れます。</li></ol>
<p>${esc(SHORT)}は、機種別の買取価格を毎日公開し（<a href="/kaitori/">買取価格一覧</a>）、池袋・新宿・新大久保・鶴見の店頭で現金即払い、郵送は全国対応しています。古物商許可 ${esc(cat.texts.license)}。</p>
<p><a class="cta" href="/?apply=1">無料で査定する</a></p>${moreLinks('/kaitori/guide/dokoga-ii/')}${shopCols(cat)}` }),
  '/kaitori/guide/shitadori/': async cat => ({ title: `iPhoneの下取りと買取の違い｜どっちが得？｜${BRAND}`, desc: 'iPhoneはキャリア・Appleの下取りと買取店の買取、どっちが得？還元方法・金額・手間の違いと、損しない選び方をわかりやすく解説します。', h1: 'iPhoneの下取りと買取、どっちが得？',
    bc: [TOP, { name: 'ガイド', url: '/kaitori/guide/' }, { name: '下取りと買取の違い', url: '/kaitori/guide/shitadori/' }],
    body: `<p class="lead">「下取り」は機種変更と同時に古い端末を引き取ってもらう方法、「買取」は端末だけを売って現金を受け取る方法です。</p>
<div class="tw"><table><thead><tr><th></th><th>下取り（キャリア・Apple）</th><th>買取（買取店）</th></tr></thead><tbody><tr><th>受け取り方</th><td>ポイント・割引が中心</td><td>現金（店頭は即日）</td></tr><tr><th>タイミング</th><td>機種変更のときだけ</td><td>いつでも</td></tr><tr><th>故障品</th><td>対象外や減額が多い</td><td>状態により査定</td></tr><tr><th>手間</th><td>機種変更と同時で楽</td><td>店頭・郵送で手続き</td></tr></tbody></table></div>
<h2>損しない選び方</h2><p>下取りの金額と、買取店の買取価格を比べてから決めるのがおすすめです。当店の価格は<a href="/kaitori/iphone/">iPhone買取価格一覧</a>で毎日公開しています。売る前の準備は<a href="/kaitori/guide/uru-mae/">iPhoneを売る前にやること</a>をご覧ください。</p>
<p><a class="cta" href="/?apply=1">無料で査定する</a></p>${moreLinks('/kaitori/guide/shitadori/')}` })
};
async function sellPage(env, path) {
  const cat = await catalog(env), px = await prices(cat), o = await SELL_PAGES[path](cat, px);
  return frame(cat, { ...o, canon: path, ttl: 1800 });
}

/* ---------- shops ---------- */
const hoursSpec = cat => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: cat.texts.openFrom, closes: cat.texts.openTo });
async function shopsIndex(env) {
  const cat = await catalog(env);
  return frame(cat, { title: `店舗一覧｜池袋・新宿・新大久保・鶴見のスマホ買取｜${BRAND}`, desc: `${BRAND}の4店舗（池袋店・新宿1号店・新大久保店・鶴見店）の住所・電話番号・営業時間・最寄り駅からの行き方。店頭買取は現金即払い、予約不要です。`, canon: '/shops/', h1: '店舗一覧',
    bc: [TOP, { name: '店舗一覧', url: '/shops/' }], body: `<p class="lead">店頭買取は予約不要・現金即払いです。営業時間は${esc(cat.texts.openFrom)}〜${esc(cat.texts.openTo)}（年中無休）です。</p><div class="cols">${cat.stores.map(s => `<div class="box"><b><a href="/shops/${s.slug}/">${esc(s.name)}</a></b>${esc(s.addr)}<br>TEL <a href="${telHref(s.tel)}">${esc(s.tel)}</a>${s.station ? `<br>${esc(s.station.name)}から徒歩約${s.station.walk}分` : ''}</div>`).join('')}</div>` });
}
const AREA = {   // extra local words people search for (from Google suggestions), per shop
  ikebukuro: { words: '池袋駅西口・西池袋エリア', near: '池袋', also: ['池袋 iPhone買取', '池袋西口 スマホ買取', '池袋 中古スマホ'] },
  'shinjuku-1': { words: '新宿区百人町（新大久保駅・大久保駅エリア）', near: '新宿・大久保', also: ['新宿 iPhone買取', '大久保 iPhone買取', '新宿 スマホ買取'] },
  'shin-okubo': { words: '新宿区百人町（新大久保駅・大久保駅エリア）', near: '新大久保・大久保', also: ['新大久保 iPhone買取', '大久保 スマホ買取', '新宿 中古スマホ'] },
  tsurumi: { words: '横浜市鶴見区・鶴見駅エリア', near: '鶴見・横浜', also: ['鶴見 スマホ買取', '横浜 iPhone買取', '鶴見 中古スマホ'] }
};
async function shopPage(env, slug) {
  const cat = await catalog(env), s = cat.stores.find(x => x.slug === slug); if (!s) return null;
  const px = await prices(cat);
  const top = cat.models.map(m => ({ m, rows: modelRows(m, px) })).filter(x => ['iphone', 'simfree', 'ipad', 'nintendo', 'playstation'].includes(x.m.c) && x.m.n.length <= 36).map(x => ({ ...x, max: modelMax(x.rows) })).filter(x => x.max > 0).sort((a, b) => b.max - a.max).slice(0, 10);
  const addr = s.addr.replace(/^〒\S+\s*/, '');
  const ld = { '@context': 'https://schema.org', '@type': 'Store', '@id': `${SITE}/shops/${s.slug}/#store`, name: s.name, url: `${SITE}/shops/${s.slug}/`, image: [`${SITE}/hero-products-hd.jpg`], telephone: s.tel,
    address: { '@type': 'PostalAddress', postalCode: s.postal, addressRegion: s.region, addressLocality: s.locality, streetAddress: s.street, addressCountry: 'JP' },
    ...(s.geo ? { geo: { '@type': 'GeoCoordinates', latitude: s.geo[0], longitude: s.geo[1] } } : {}), openingHoursSpecification: hoursSpec(cat), priceRange: '¥¥',
    parentOrganization: { '@id': SITE + '/#org' }, ...(s.map ? { sameAs: [s.map], hasMap: s.map } : {}) };
  const embed = `https://www.google.com/maps?q=${encodeURIComponent(addr)}&output=embed&hl=ja`;
  return frame(cat, { title: `${s.area}のiPhone・スマホ買取｜${s.name}｜${BRAND}`, desc: `${s.area}でiPhone・スマホ・ゲーム機を高価買取。${s.name}は${s.station ? s.station.name + 'から徒歩約' + s.station.walk + '分、' : ''}${cat.texts.openFrom}〜${cat.texts.openTo}年中無休、店頭は現金即払い。`,
    canon: `/shops/${s.slug}/`, h1: `${s.area}のiPhone・スマホ買取｜${SHORT} ${s.name}`, bc: [TOP, { name: '店舗一覧', url: '/shops/' }, { name: s.name, url: `/shops/${s.slug}/` }], ld: [ld],
    body: `<p class="lead">${esc(s.name)}は、${esc(s.area)}エリアでスマホ・ゲーム機・タブレットの買取を行っています。店頭買取は予約不要・現金即払いです。</p>
<h2>店舗情報</h2><dl class="f"><dt>店名</dt><dd>${esc(s.name)}</dd><dt>住所</dt><dd>${esc(s.addr)}</dd><dt>電話番号</dt><dd><a href="${telHref(s.tel)}">${esc(s.tel)}</a></dd><dt>営業時間</dt><dd>${esc(cat.texts.openFrom)}〜${esc(cat.texts.openTo)}（年中無休）</dd>${s.rating ? `<dt>Googleマップの評価</dt><dd>★${esc(s.rating)}（${esc(s.reviews)}件、Googleマップ）</dd>` : ''}</dl>
<h2>${esc(s.area)}店への行き方</h2><p>${s.station ? `${esc(s.station.name)}から徒歩約${s.station.walk}分です（直線距離からの目安）。` : ''}お越しの際はGoogleマップでご確認ください。${s.map ? `<a href="${esc(s.map)}" rel="noopener">Googleマップで開く</a>` : ''}</p>
<iframe class="map" title="${esc(s.name)}の地図" src="${esc(embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
<h2>${esc(s.area)}店の本日の高価買取 上位10機種</h2><p class="note">${ja(px.at)} ${jaTime(px.at)}時点（日本時間）の上限価格です。</p><div class="tw"><table><thead><tr><th>機種</th><th>新品・未使用 上限</th></tr></thead><tbody>${top.map(x => `<tr><td><a href="/kaitori/${x.m.c}/${x.m.s}/">${esc(x.m.n)}</a></td><td class="p">${yen(x.max)}</td></tr>`).join('')}</tbody></table></div>
${(() => { const a = AREA[s.slug]; if (!a) return ''; const f = [
  { q: `${a.near}でiPhoneを売るならどこがいい？`, a: `${s.name}は${a.words}にあり、iPhone・Android・iPad・ゲーム機を買取しています。機種別の買取価格を毎日公開し、店頭では予約不要・その場で現金をお支払いします。` },
  { q: `${a.near}で壊れたiPhone・画面割れのスマホも売れますか？`, a: '画面割れ・電源が入らないなどの故障品も査定します。状態に応じて個別にお見積りします。' },
  { q: `${s.name}の営業時間は？`, a: `${cat.texts.openFrom}〜${cat.texts.openTo}、年中無休です。` }];
  return `<h2>${esc(a.near)}でiPhone・スマホを売るなら</h2><p>${esc(s.name)}は${esc(a.words)}の買取店です。iPhoneの最新機種から古い機種、未使用品、画面割れなどの故障品まで査定します。</p><h2>よくある質問</h2>${f.map(x => `<h3>${esc(x.q)}</h3><p>${esc(x.a)}</p>`).join('')}<script type="application/ld+json">${json(faqLd(f))}</script>`; })()}
<h2>買取価格を見る</h2><ul class="cats">${cat.cats.map(x => `<li><a href="/kaitori/${x.slug}/">${esc(x.label)}</a></li>`).join('')}</ul>${moreLinks('')}<p><a class="cta" href="/?apply=1">無料で査定する</a></p>` });
}

/* ---------- phones for sale ---------- */
const describeStock = items => {
  const brands = [...new Set(items.map(p => p.brand).filter(Boolean))].slice(0, 4);
  return `${SHORT}の販売在庫一覧。${brands.length ? brands.join('・') + 'など' : ''}${items.length}台の中古スマホを、状態・バッテリー容量・価格つきで掲載。在庫は随時更新しています。`;
};
async function shopList(env) {
  const cat = await catalog(env), items = await stock(env);
  const sorted = items.slice().sort((a, b) => String(a.brand).localeCompare(String(b.brand)) || String(a.model).localeCompare(String(b.model)) || a.selling_price - b.selling_price);
  const models = {}; items.forEach(p => { const s = slugify(p.model); if (s) models[s] = models[s] || { n: p.model, c: 0 }, models[s].c++; });
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: '在庫一覧', url: SITE + '/shop/', numberOfItems: sorted.length, itemListElement: sorted.slice(0, 200).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/shop/${p.product_code}`, name: itemName(p) })) };
  return frame(cat, { title: `中古スマホ・iPhone 在庫一覧（${items.length}台）｜${BRAND}`, desc: describeStock(items), canon: '/shop/', h1: '中古スマホ・iPhone 在庫一覧', bc: [TOP, { name: '在庫一覧', url: '/shop/' }], ld: [ld], ttl: 300,
    body: `<p class="lead">現在の在庫は${items.length}台です。商品名を選ぶと、状態・バッテリー容量・価格・在庫店舗をご覧いただけます。</p><h2>機種から探す</h2><ul class="cats">${Object.entries(models).sort((a, b) => a[1].n.localeCompare(b[1].n)).map(([s, x]) => `<li><a href="/shop/${s}/">${esc(x.n)}（${x.c}）</a></li>`).join('')}</ul>
<h2>在庫一覧</h2><ul class="grid">${sorted.map(p => `<li><a href="/shop/${esc(p.product_code)}">${esc(itemName(p))}</a><br><span class="tag">在庫あり</span> <b style="color:#E0475F">${yen(p.selling_price)}</b></li>`).join('')}</ul>` });
}
async function shopItem(env, code) {
  const cat = await catalog(env), rows = (await stock(env)).filter(p => p.product_code === code), p = rows[0];
  if (!p) return frame(cat, { title: `この商品は現在ご覧いただけません｜${BRAND}`, desc: 'この商品は売り切れ、または掲載を終了しました。', canon: '/shop/', h1: 'この商品は現在ご覧いただけません', noindex: true, status: 410, bc: [TOP, { name: '在庫一覧', url: '/shop/' }], body: '<p>売り切れ、または掲載を終了しました。</p><p><a href="/shop/">在庫一覧を見る</a> ・ <a href="/kaitori/">買取価格一覧</a></p>' });
  const name = itemName(p), [cj, cs] = condOf(p), shopName = SHOP[p.shop] || p.shop || '', price = Number(p.selling_price), url = `${SITE}/shop/${p.product_code}`;
  const desc = `${p.brand || ''} ${name}。状態：${cj}${p.battery_health ? '、バッテリー' + p.battery_health + '%' : ''}。${yen(price)}（税込）。${shopName ? shopName + 'にて在庫あり。' : ''}`.replace(/\s+/g, ' ');
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name, sku: p.product_code, mpn: p.product_code, description: desc, image: [SITE + '/share.png'], ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}), ...(p.color ? { color: p.color } : {}), category: p.category || undefined,
    offers: { '@type': 'Offer', url, priceCurrency: 'JPY', price: String(price), itemCondition: cs, availability: 'https://schema.org/InStock', seller: { '@type': 'Organization', name: SHORT, url: SITE + '/' } } };
  const tr = [['商品番号', p.product_code], ['ブランド', p.brand], ['機種', p.model], ['容量', p.storage], ['カラー', COLOR[p.color] || p.color], ['状態', cj], ['バッテリー最大容量', p.battery_health ? p.battery_health + '%' : ''], ['在庫店舗', shopName]].filter(r => r[1]);
  return frame(cat, { title: `${name} ${yen(price)}｜在庫あり｜${SHORT}`, desc, canon: `/shop/${p.product_code}`, h1: name, bc: [TOP, { name: '在庫一覧', url: '/shop/' }, { name, url: `/shop/${p.product_code}` }], ld: [ld], apply: `/?buy=${encodeURIComponent(p.product_code)}`, ttl: 300,
    body: `<p><span class="tag">在庫あり</span></p><p class="price">${yen(price)}<small style="font-size:14px;font-weight:600;color:#6B7890">（税込）</small></p><div class="tw"><table><tbody>${tr.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table></div>
<p><a class="cta" href="/?buy=${encodeURIComponent(p.product_code)}">このスマホを購入する</a></p><p><a href="/shop/${slugify(p.model)}/">${esc(p.model)}の在庫一覧</a> ・ <a href="/shop/">在庫一覧</a></p><p class="note">在庫・価格は随時更新されます。お持ち込みは各店舗、郵送でのお届けにも対応しています。</p>` });
}
async function shopModel(env, slug) {
  const cat = await catalog(env), items = (await stock(env)).filter(p => slugify(p.model) === slug);
  if (!items.length) return null;
  const model = items[0].model, sorted = items.slice().sort((a, b) => a.selling_price - b.selling_price);
  const prices_ = sorted.map(p => p.selling_price);
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: `${model}の在庫`, url: `${SITE}/shop/${slug}/`, numberOfItems: sorted.length, itemListElement: sorted.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/shop/${p.product_code}`, name: itemName(p) })) };
  return frame(cat, { title: `${model} 中古の在庫（${items.length}台）${yen(Math.min(...prices_))}から｜${BRAND}`, desc: `${model}の中古在庫${items.length}台。容量・カラー・状態・バッテリー容量つきで、${yen(Math.min(...prices_))}から。在庫あり、即日お渡し可能な商品もあります。`.replace('即日お渡し可能な商品もあります。', ''), canon: `/shop/${slug}/`, h1: `${model} 中古の在庫`,
    bc: [TOP, { name: '在庫一覧', url: '/shop/' }, { name: model, url: `/shop/${slug}/` }], ld: [ld], ttl: 300,
    body: `<p class="lead">${esc(model)}の在庫は${items.length}台です。</p><ul class="grid">${sorted.map(p => `<li><a href="/shop/${esc(p.product_code)}">${esc(itemName(p))}</a><br><span class="tag">在庫あり</span> <b style="color:#E0475F">${yen(p.selling_price)}</b></li>`).join('')}</ul>
${(() => { const c = cat.models.find(m => key(m.n) === key(model)); return c ? `<p><a href="/kaitori/${c.c}/${c.s}/">${esc(model)}の買取価格を見る</a></p>` : ''; })()}<p><a href="/shop/">在庫一覧に戻る</a></p>` });
}

/* ---------- sitemap ---------- */
async function sitemap(env, onlyShop) {
  const cat = await catalog(env), px = await prices(cat);
  let items = []; try { items = await stock(env); } catch (e) { /* stock unavailable */ }
  const last = iso(px.at), urls = [];
  const add = (u, lm, pr) => urls.push(`  <url><loc>${SITE}${u}</loc><lastmod>${lm}</lastmod>${pr ? `<priority>${pr}</priority>` : ''}</url>`);
  if (!onlyShop) {
    add('/', last, '1.0'); add('/kaitori/', last, '0.9');
    cat.cats.forEach(c => add(`/kaitori/${c.slug}/`, last, '0.8'));
    cat.models.forEach(m => add(`/kaitori/${m.c}/${m.s}/`, last, '0.7'));
    ['/kaitori/flow/', '/kaitori/notes/', '/company/', '/faq/', '/contact/', '/terms/', '/privacy/', '/cookie/', '/shops/'].forEach(u => add(u, last, '0.5'));
    Object.keys(SELL_PAGES).forEach(u => add(u, last, '0.8'));
    cat.stores.forEach(s => add(`/shops/${s.slug}/`, last, '0.7'));
  }
  add('/shop/', iso(new Date()), '0.8');
  const ms = {}; items.forEach(p => { const s = slugify(p.model); if (s) ms[s] = Math.max(ms[s] || 0, Date.parse(p.created_at) || 0); });
  Object.keys(ms).forEach(s => add(`/shop/${s}/`, iso(new Date(ms[s] || Date.now())), '0.6'));
  items.forEach(p => add(`/shop/${p.product_code}`, iso(new Date(Date.parse(p.created_at) || Date.now())), '0.6'));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=900' } });
}

/* ---------- router ---------- */
async function route(path, env) {
  let m;
  if (path === '/' || path === '/index.html') return home(env);
  if (path === '/sitemap.xml') return sitemap(env, false);
  if (path === '/sitemap-shop.xml') return sitemap(env, true);
  if (path === '/kaitori/') return kaitoriIndex(env);
  if (path === '/shops/') return shopsIndex(env);
  if (path === '/shop' || path === '/shop/') return shopList(env);
  if (PAGES[path]) { const cat = await catalog(env); return frame(cat, { ...PAGES[path](cat), canon: path, ttl: 3600 }); }
  if (SELL_PAGES[path]) return sellPage(env, path);
  if ((m = /^\/kaitori\/([a-z0-9-]+)\/$/.exec(path))) return categoryPage(env, m[1]);
  if ((m = /^\/kaitori\/([a-z0-9-]+)\/([a-z0-9-]+)\/$/.exec(path))) return modelPage(env, m[1], m[2]);
  if ((m = /^\/shops\/([a-z0-9-]+)\/$/.exec(path))) return shopPage(env, m[1]);
  if ((m = /^\/shop\/(P[0-9A-Za-z_-]{3,40})\/?$/.exec(path))) return shopItem(env, m[1]);
  if ((m = /^\/shop\/([a-z0-9-]+)\/$/.exec(path))) return shopModel(env, m[1]);
  return undefined;   // not ours: plain file
}
export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return env.ASSETS.fetch(req);
    let path = u.pathname;
    // paths that need a closing slash get one (301); the product page /shop/<no.> keeps its address without one
    if (/^\/(kaitori|shops|company|faq|contact|terms|privacy|cookie)(\/[a-z0-9-]+)*$/.test(path) && !path.endsWith('/') && !/\.[a-z0-9]+$/.test(path)) return Response.redirect(SITE + path + '/' + u.search, 301);
    const cache = caches.default, ck = new Request(SITE + path);
    const hit = await cache.match(ck); if (hit) return hit;
    try {
      const r = await route(path, env);
      if (r === undefined) return env.ASSETS.fetch(req);
      if (r === null) { const cat = await catalog(env); return notFound(cat); }
      if (r.status === 200) ctx.waitUntil(cache.put(ck, r.clone()));
      return r;
    } catch (e) {
      console.error(String(e && e.stack || e));
      try { const a = await env.ASSETS.fetch(req); if (a.status !== 404) return a; } catch (e2) { /* ignore */ }
      return new Response('<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>ただいま混み合っています</title><p>時間をおいてもう一度お試しください。</p><p><a href="/">トップページ</a></p>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
  }
};
