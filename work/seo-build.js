// SEO extras for the Cloudflare build (run by build-site.ps1 after site/index.html is written).
//  - adds title, canonical, social-preview tags, icons and structured data (stores, FAQ) to site/index.html
//  - writes one static price page per category under /kaitori/, plus robots.txt, sitemap.xml and 404.html
// The static pages are plain HTML (no scripts) so search engines read them without running JavaScript.
// Usage: node seo-build.js <project root>
'use strict';
const fs = require('fs'), path = require('path');
const root = process.argv[2];
const out = path.join(root, 'site');
const SITE = 'https://kaitorinihon.jp';
const d = JSON.parse(fs.readFileSync(path.join(root, 'work', 'site.json'), 'utf8'));
const T = d.texts || {};
const brand = T.brand || '買取日本';
// Category pages use the relay's current buying prices and that update's date. Without the feed they keep
// site.json's prices and the date that file last changed, so a rebuild never makes old prices look new.
let feedUpdated = '';
let priced = fs.statSync(path.join(root, 'work', 'site.json')).mtimeMs;
try {
  const feed = JSON.parse(require('child_process').execFileSync(process.execPath, ['-e', "fetch(process.argv[1],{signal:AbortSignal.timeout(40000)}).then(r=>r.text()).then(t=>process.stdout.write(t)).catch(()=>process.exit(1))", T.relayUrl + '?prices=1'], { maxBuffer: 1e7 }).toString());
  if (!feed.ok || Object.keys(feed.items).length < 50) throw new Error('feed not usable');
  (d.products || []).forEach(p => { const x = feed.items[p.rjp]; if (x) { p.new = x[0]; if (x[1] != null) p.used = x[1]; } });
  priced = Date.parse(feed.updated.replace(/\//g, '-').replace(' ', 'T') + ':00+09:00'); feedUpdated = feed.updated;
  console.log('seo: prices of ' + feed.updated + ' for ' + Object.keys(feed.items).length + ' products');
} catch (e) { console.log('seo: price feed not available, using site.json prices'); }
const now = new Date(priced + 9 * 3600e3);   // Japan time
const ymd = now.toISOString().slice(0, 10);
const jpDate = `${now.getUTCFullYear()}年${now.getUTCMonth() + 1}月${now.getUTCDate()}日`;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = n => '¥' + Number(n).toLocaleString('ja-JP');
const json = o => JSON.stringify(o).replace(/</g, '\\u003c');

const TITLE = T.seoTitle || '買取日本（Kaitori Nihon）｜iPhone・スマホ・ゲーム機の高価買取｜池袋・新宿・新大久保・鶴見';
const DESC = T.seoDescription || '買取日本（Kaitori Nihon / Royal Japan）はiPhone・Galaxy・Pixel・iPad・ゲーム機・MacBookを東京相場で高価買取。池袋・新宿・鶴見の店舗やオフィスへのお持ち込みは現金即払い、郵送買取は全国対応。買取価格は毎日更新。';
const OG_IMG = SITE + '/share.png', STORE_IMG = SITE + '/hero-products-hd.jpg';
const LOGO = `<path fill="#3E8EE0" d="M6 9a3 3 0 0 1 3-3h16.2a4 4 0 0 1 2.83 1.17l14.8 14.8a4 4 0 0 1 0 5.66L29.63 40.83a4 4 0 0 1-5.66 0L7.17 24.03A4 4 0 0 1 6 21.2Z"/><circle fill="#E0475F" cx="15.6" cy="15.6" r="3.9"/><path fill="#fff" transform="translate(22.095 34.949) scale(0.021163)" d="M216,0L216,-166 41,-166 41,-250 216,-250 216,-311 41,-311 41,-396 177,-396 12,-726 195,-726 249,-580C258.333312988281,-555.333312988281 267.5,-530.333312988281 276.5,-505 285.5,-479.666656494141 295,-454.666656494141 305,-430L309,-430C318.333312988281,-455.333312988281 327.666656494141,-480.499969482422 337,-505.5 346.333312988281,-530.5 355.666656494141,-555.333312988281 365,-580L418,-726 597,-726 431,-396 568,-396 568,-311 393,-311 393,-250 568,-250 568,-166 393,-166 393,0z"/>`;

// ---------- category pages ----------
const SLUG = {
  'iPhone': 'iphone', '赤ロム端末': 'akarom', 'SIMフリースマホ': 'simfree', 'AU・UQ': 'au', 'SoftBank・Y!mobile': 'softbank',
  'Docomo': 'docomo', '格安SIMキャリア': 'mvno', '楽天モバイル': 'rakuten', 'iPad・アクセサリ': 'ipad', 'スマートウォッチ': 'smartwatch',
  '通訳機・翻訳機': 'translator', 'Nintendoゲーム機': 'nintendo', 'PlayStationゲーム機': 'playstation', 'Xboxゲーム機': 'xbox', 'VR': 'vr',
  'ゲームソフトSwitch': 'switch-soft', 'ゲームソフト(PS5)': 'ps5-soft', 'ゲームその他': 'game-other', 'MacBook': 'macbook'
};
const cats = [];
const byCat = {};
(d.products || []).forEach(p => { if (!p.cat) return; if (!byCat[p.cat]) { byCat[p.cat] = []; cats.push(p.cat); } byCat[p.cat].push(p); });
const slugOf = c => SLUG[c] || 'c' + (cats.indexOf(c) + 1);

const stores = (d.stores || []).filter(s => s && s.name);
const css = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;color:#1E2A3B;background:#F6F9FD;line-height:1.7}
a{color:#2C74C4}header,main,footer{max-width:960px;margin:0 auto;padding:16px}header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.logo{font-weight:900;font-size:20px;color:#16233A;text-decoration:none;display:flex;align-items:center;gap:8px}.cta{background:#2C74C4;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700}
nav.bc{font-size:13px;color:#6B7890;margin:8px 0}h1{font-size:26px;margin:8px 0 6px;color:#16233A}h2{font-size:19px;margin:28px 0 10px;color:#16233A}
p{margin:6px 0}.note{font-size:13px;color:#6B7890}table{width:100%;border-collapse:collapse;background:#fff;margin:12px 0;font-size:14px}
th,td{border-bottom:1px solid #E1E8F2;padding:9px 8px;text-align:left;vertical-align:middle}th{background:#EAF2FB;font-size:13px}td.p{text-align:right;font-weight:700;color:#E0475F;white-space:nowrap}
td.p.u{color:#1E2A3B}td img{width:40px;height:40px;object-fit:contain;vertical-align:middle;margin-right:8px}ul.cats{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
ul.cats a{display:block;background:#fff;border:1px solid #E1E8F2;border-radius:999px;padding:6px 14px;text-decoration:none}.stores{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.stores div{background:#fff;border:1px solid #E1E8F2;border-radius:10px;padding:12px;font-size:14px}footer{font-size:13px;color:#6B7890;border-top:1px solid #E1E8F2;margin-top:32px}`;

const storeBlock = () => `<h2>店舗・オフィスへのお持ち込み（現金即払い）</h2><div class="stores">${stores.map(s =>
  `<div><b>${esc(s.name)}</b><br>${esc(s.addr)}${s.tel ? `<br>TEL <a href="tel:${esc(s.tel.replace(/[^0-9+]/g, ''))}">${esc(s.tel)}</a>` : ''}</div>`).join('')}</div>`;

const catNav = (cur) => `<ul class="cats">${cats.map(c => c === cur ? `<li><b>${esc(c)}</b></li>` : `<li><a href="/kaitori/${slugOf(c)}/">${esc(c)}</a></li>`).join('')}</ul>`;

function page({ title, desc, canonical, h1, crumbs, body, ld }) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canonical}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(brand)}"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${OG_IMG}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#16233A"><style>${css}</style>${(ld || []).map(o => `<script type="application/ld+json">${json(o)}</script>`).join('')}</head><body>
<header><a class="logo" href="/"><svg viewBox="5 5 40 38" width="34" height="32" aria-hidden="true">${LOGO}</svg>${esc(brand)} <small style="font-weight:500;font-size:12px;color:#6B7890">KAITORI</small></a><a class="cta" href="/">無料で査定する</a></header>
<main><nav class="bc">${crumbs.map(c => c.url ? `<a href="${c.url}">${esc(c.name)}</a>` : esc(c.name)).join(' › ')}</nav><h1>${esc(h1)}</h1>${body}</main>
<footer><p><b>${esc(T.legalName || '株式会社ROYAL JAPAN')}</b>　古物商許可 ${esc(String(T.license || '').replace(/^古物商許可\s*/, ''))}</p><div class="stores">${stores.map(x => `<div><b>${esc(x.name)}</b><br>${esc(x.addr)}<br>TEL ${esc(x.tel || '')}</div>`).join('')}</div><p><a href="/company/">会社概要</a> ・ <a href="/shops/">店舗一覧</a> ・ <a href="/kaitori/flow/">買取の流れ</a> ・ <a href="/faq/">よくある質問</a> ・ <a href="/terms/">利用規約</a> ・ <a href="/privacy/">プライバシーポリシー</a> ・ <a href="/kaitori/">買取価格一覧</a> ・ <a href="/shop/">在庫一覧</a></p><p>${esc(T.copyright || '© 2026 買取日本 Kaitorinihon. All rights reserved.')}</p></footer></body></html>`;
}
const crumbLd = list => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + (c.url || c.self) })) });

const written = [];
function write(rel, html) { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); written.push(rel); }

// category, model, shop and content pages are made on request by work/_worker.js (catalogue: data/catalog.json)

write('404.html', page({
  title: `ページが見つかりません｜${brand}`, desc: DESC, canonical: SITE + '/', h1: 'ページが見つかりません',
  crumbs: [{ name: 'トップ', url: '/' }],
  body: `<p>お探しのページは移動または削除された可能性があります。</p><p><a href="/kaitori/">買取価格一覧</a> ・ <a href="/shop/">在庫一覧</a> ・ <a href="/">トップページ</a></p>`
}).replace('<meta name="viewport"', '<meta name="robots" content="noindex"><meta name="viewport"'));

// ---------- robots (the sitemap is made by the worker) ----------
write('robots.txt', `User-agent: *
Allow: /
Disallow: /cart
Disallow: /login
Disallow: /api/
Disallow: /*?
Allow: /*?lang=

Sitemap: ${SITE}/sitemap.xml
Sitemap: ${SITE}/sitemap-shop.xml
`);
// the catalogue the worker reads
{ const cb = require('./catalog-build.js'); const cat = cb.build(root, { updated: feedUpdated }); fs.mkdirSync(path.join(out, 'data'), { recursive: true }); fs.writeFileSync(path.join(out, 'data', 'catalog.json'), JSON.stringify(cat)); console.log('seo: catalogue ' + cat.models.length + ' models'); }

// ---------- home page head ----------
const idx = path.join(out, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
const org = {
  '@context': 'https://schema.org', '@type': 'Organization', '@id': SITE + '/#org', name: brand, legalName: T.legalName || undefined, alternateName: ['Kaitori Nihon', 'KAITORI', 'Kaitorinihon', 'kaitorinihon.jp', '買取日本', 'Royal Japan'],
  url: SITE + '/', logo: SITE + '/app-icon-512.png',
  sameAs: [T.instagramUrl, T.tiktokUrl, T.xUrl, T.youtubeUrl, T.lineUrl, T.facebookUrl].filter(Boolean)
};
const site = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE + '/#site', name: brand, alternateName: ['Kaitori Nihon', 'Kaitorinihon', 'kaitorinihon.jp'], url: SITE + '/', inLanguage: 'ja', publisher: { '@id': SITE + '/#org' } };
const addr = a => {
  const m = String(a).match(/〒?\s*(\d{3}-\d{4})\s*(東京都|北海道|(?:京都|大阪)府|.{2,3}県)(.+?[市区町村])(.*)$/);
  return m ? { '@type': 'PostalAddress', postalCode: m[1], addressRegion: m[2], addressLocality: m[3], streetAddress: m[4].trim(), addressCountry: 'JP' }
           : { '@type': 'PostalAddress', streetAddress: a, addressCountry: 'JP' };
};
const shops = stores.map((s, i) => ({
  '@context': 'https://schema.org', '@type': 'Store', '@id': SITE + '/#store' + (i + 1), name: s.name, url: SITE + '/', image: STORE_IMG,
  telephone: s.tel || undefined, address: addr(s.addr), openingHoursSpecification: { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], opens: '10:00', closes: '17:00' }, parentOrganization: { '@id': SITE + '/#org' }, hasMap: s.map || undefined, sameAs: s.map ? [s.map] : undefined,
  description: '中古スマホ・ゲーム機・タブレットの買取店。お持ち込みは現金即払い。'
}));
const faq = (d.faq || []).length ? {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: d.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
} : null;
// the same page in other languages (?lang=…, translated in the browser from data/i18n)
const LANGS = [['ja', ''], ['en', 'en'], ['zh-Hant', 'zh-Hant'], ['ko', 'ko'], ['bn', 'bn'], ['si', 'si'], ['ne', 'ne']];
const hreflang = LANGS.map(([h, q]) => `<link rel="alternate" hreflang="${h}" href="${SITE}/${q ? '?lang=' + q : ''}">`).join('') + `<link rel="alternate" hreflang="x-default" href="${SITE}/">`;
const head = `<title>${esc(TITLE)}</title><meta name="description" content="${esc(DESC)}"><link rel="canonical" href="${SITE}/"><meta name="msvalidate.01" content="D41010EF5C317680DB3C359F8CB92613">${T.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(T.googleSiteVerification)}">` : "<!-- Search Console: put the verification code in work/site.json texts.googleSiteVerification -->"}
<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(brand)}"><meta property="og:title" content="${esc(TITLE)}"><meta property="og:description" content="${esc(DESC)}">
<meta property="og:url" content="${SITE}/"><meta property="og:image" content="${OG_IMG}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:locale" content="ja_JP"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
${hreflang}
${[org, site, ...shops, faq].filter(Boolean).map(o => `<script type="application/ld+json">${json(o)}</script>`).join('\n')}`;
// the page body carries its own short <title> and description; the build's versions replace them
html = html.replace(/<title>[^<]*<\/title>/, '').replace(/<meta name="description"[^>]*>/, '');
html = html.replace('</head>', head + '</head>');
// ---- server HTML: today's prices, footer facts, the clock and the update time (the worker refreshes them on every request) ----
{
  const cb = require('./catalog-build.js');
  const top = {};
  (d.products || []).filter(p => p.cat === 'iPhone').forEach(p => { const m = cb.strip(p.n); const t = top[m] = top[m] || { m, nn: 0, uu: 0 }; t.nn = Math.max(t.nn, p.new || 0); t.uu = Math.max(t.uu, p.used || 0); });
  const rows = Object.values(top).filter(x => x.nn || x.uu).sort((a, b) => Math.max(b.nn, b.uu) - Math.max(a.nn, a.uu)).slice(0, 10);
  const slugs = {}; cb.build(root).models.filter(m => m.c === 'iphone').forEach(m => { slugs[m.n] = m.s; });
  const stamp = jpDate + ' ' + String(now.getUTCHours()).padStart(2, '0') + ':' + String(now.getUTCMinutes()).padStart(2, '0');
  const topHtml = `<div class="seo-top"><h2>本日のiPhone買取価格ランキング（${stamp}更新）</h2>
<p class="seo-note">${esc('買取日本')}の買取価格の上位10機種です。新品・未使用と中古の上限価格を2時間ごとに自動更新しています（日本時間）。</p>
<div class="seo-tw"><table><thead><tr><th>機種</th><th>新品・未使用 上限</th><th>中古 上限</th></tr></thead><tbody>${rows.map(x => `<tr><td><a href="/kaitori/iphone/${slugs[x.m] || ''}/">${esc(x.m)}</a></td><td class="p">${x.nn ? yen(x.nn) : '—'}</td><td class="p u">${x.uu ? yen(x.uu) : '—'}</td></tr>`).join('')}</tbody></table></div>
<p class="seo-note">※上限価格。状態・付属品により変動します。すべての機種は<a href="/kaitori/">買取価格一覧</a>、<a href="/kaitori/iphone/">iPhone買取価格一覧</a>をご覧ください。</p></div>`;
  const lic = String(T.license || '').replace(/^古物商許可\s*/, '');
  const footHtml = `<p class="fs-co"><b>${esc(T.legalName || '株式会社ROYAL JAPAN')}</b>　古物商許可 ${esc(lic)}</p><div class="fs-shops">${stores.map(s => `<div><b>${esc(s.name)}</b>${esc(s.addr)}<br>TEL <a href="tel:${esc(String(s.tel || '').replace(/[^0-9+]/g, ''))}">${esc(s.tel || '')}</a></div>`).join('')}</div>
<nav aria-label="フッターリンク"><a href="/company/">会社概要</a><a href="/shops/">店舗一覧</a><a href="/kaitori/flow/">買取の流れ</a><a href="/faq/">よくある質問</a><a href="/terms/">利用規約</a><a href="/privacy/">プライバシーポリシー</a><a href="/cookie/">Cookieポリシー</a><a href="/kaitori/notes/">買取時のご注意</a><a href="/contact/">お問い合わせ</a><a href="/kaitori/">買取価格一覧</a><a href="/shop/">在庫一覧</a></nav>`;
  const hhmm = String(now.getUTCHours()).padStart(2, '0') + ':' + String(now.getUTCMinutes()).padStart(2, '0');
  html = html.replace(/<!--seo:top-->[\s\S]*?<!--\/seo:top-->/, () => '<!--seo:top-->' + topHtml + '<!--/seo:top-->')
    .replace(/<!--seo:foot-->[\s\S]*?<!--\/seo:foot-->/, () => '<!--seo:foot-->' + footHtml + '<!--/seo:foot-->')
    .replace('<span data-clock="d"></span>', () => '<span data-clock="d">' + jpDate + '</span>')
    .replace('<span class="t num" data-clock="t"></span>', () => '<span class="t num" data-clock="t">' + hhmm + '</span>')
    .replace('<span class="num" data-clock="t"></span>', () => '<span class="num" data-clock="t">' + hhmm + '</span>')
    .replace(/(data-t="texts\.updated">)(?=<\/span>)/g, (m, a) => a + ymd.replace(/-/g, '/') + ' ' + hhmm);
}
fs.writeFileSync(idx, html);
console.log('seo: ' + written.length + ' files, ' + shops.length + ' stores');
