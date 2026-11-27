// Cloudflare Pages worker (advanced mode). Only /shop, /shop/<product no.> and /sitemap-shop.xml run through it
// (see _routes.json); every other path is served as a plain file.
// The pages are built on request from the stock system (Supabase view web_products_for_sale), so a sold phone
// disappears (410 + noindex) and a price change shows within 5 minutes - no rebuild or upload needed.
const SITE = 'https://kaitorinihon.jp';
const SB = 'https://vqfreyiveytlolsaaypy.supabase.co/rest/v1/web_products_for_sale';
const KEY = 'sb_publishable_yqJcfi5QUeOzV7f8eucjFA_A9cVHAvH';   // public (publishable) key, read-only view
const MIN = 1000, MAX = 500000;                                   // same range as the site
const BRAND = '買取日本';
const COND = { 'New': ['新品', 'https://schema.org/NewCondition'], 'Unused': ['未使用', 'https://schema.org/NewCondition'], 'Used S': ['中古 S', 'https://schema.org/UsedCondition'],
  'Used A': ['中古 A', 'https://schema.org/UsedCondition'], 'Used B': ['中古 B', 'https://schema.org/UsedCondition'], 'Used C': ['中古 C', 'https://schema.org/UsedCondition'] };
const SHOP = { 'Akiba Mobile Store': 'Royal Japan 池袋店', 'Rj Mobile Ikebukuro': 'Royal Japan 池袋店', 'Istore Jp': 'Royal Japan 池袋店',
  'Royal Japan Shinjuku 1': 'Royal Japan 新宿1号店', 'Royal Japan Shinjuku 2': 'Royal Japan 新大久保店' };
const COLOR = { Black: 'ブラック', White: 'ホワイト', Blue: 'ブルー', Purple: 'パープル', Green: 'グリーン', Red: 'レッド', Pink: 'ピンク', Yellow: 'イエロー', Gold: 'ゴールド', Silver: 'シルバー', Gray: 'グレー', Grey: 'グレー', Orange: 'オレンジ' };

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = n => '¥' + Number(n).toLocaleString('en-US');
const jsonld = o => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>';

async function stock(extra) {
  const r = await fetch(SB + '?select=*' + (extra || '') + '&limit=5000', { headers: { apikey: KEY }, cf: { cacheTtl: 300, cacheEverything: true } });
  if (!r.ok) throw new Error('stock ' + r.status);
  return (await r.json()).filter(p => Number(p.selling_price) >= MIN && Number(p.selling_price) <= MAX);
}
const nameOf = p => [p.model, p.storage, COLOR[p.color] || p.color].filter(Boolean).join(' ');
const condOf = p => COND[p.condition] || [p.condition || '中古', 'https://schema.org/UsedCondition'];

const CSS = `*{box-sizing:border-box}body{margin:0;font:16px/1.7 system-ui,"Hiragino Sans","Noto Sans JP",sans-serif;color:#16233A;background:#F6F9FD}
main{max-width:860px;margin:0 auto;padding:20px 16px 48px}a{color:#2C74C4}nav.bc{font-size:13px;color:#6B7890;margin-bottom:12px}h1{font-size:26px;line-height:1.35;margin:.2em 0}
.price{font-size:32px;font-weight:800;color:#E0475F;margin:.2em 0}.tag{display:inline-block;background:#E6F7EE;color:#0B7A43;border-radius:999px;padding:2px 12px;font-size:13px;font-weight:700}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #E1E8F2;border-radius:10px;margin:14px 0}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #E1E8F2;font-size:15px}th{width:36%;color:#6B7890;font-weight:600}
.btn{display:inline-block;background:#3E8EE0;color:#fff;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 26px;margin:6px 8px 6px 0}.btn.alt{background:#fff;color:#2C74C4;border:1px solid #3E8EE0}
ul.l{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}ul.l li{background:#fff;border:1px solid #E1E8F2;border-radius:10px;padding:12px}ul.l a{text-decoration:none;font-weight:600}
footer{font-size:13px;color:#6B7890;border-top:1px solid #E1E8F2;margin-top:32px;padding-top:12px}`;

function page({ title, desc, canon, body, ld, status = 200, noindex = false, ttl = 300 }) {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(canon)}">`}
<meta property="og:type" content="website"><meta property="og:site_name" content="${BRAND}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canon)}"><meta property="og:image" content="${SITE}/share.png"><meta property="og:locale" content="ja_JP"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>${CSS}</style>${(ld || []).map(jsonld).join('')}</head><body><main>${body}
<footer><p><a href="/">トップページ</a> ・ <a href="/shop/">在庫一覧</a> ・ <a href="/kaitori/">買取価格一覧</a></p><p>© 2026 ${BRAND} Kaitorinihon. All rights reserved.</p></footer></main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': status === 200 ? `public, max-age=0, s-maxage=${ttl}` : 'public, max-age=0, s-maxage=60',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', ...(noindex ? { 'x-robots-tag': 'noindex' } : {}) } });
}

function productPage(p) {
  const name = nameOf(p), [cj, cs] = condOf(p), shop = SHOP[p.shop] || p.shop || '', price = Number(p.selling_price);
  const url = `${SITE}/shop/${encodeURIComponent(p.product_code)}`;
  const title = `${name}（${cj}）${yen(price)}｜在庫あり・${BRAND}`;
  const desc = `${p.brand || ''} ${name}、状態：${cj}${p.battery_health ? '、バッテリー' + p.battery_health + '%' : ''}。${yen(price)}（税込）。${shop ? shop + 'にて在庫あり。' : ''}お持ち込み・郵送でのご購入に対応。`.replace(/\s+/g, ' ');
  const rows = [['商品番号', p.product_code], ['ブランド', p.brand], ['機種', p.model], ['容量', p.storage], ['カラー', COLOR[p.color] || p.color], ['状態', cj],
    ['バッテリー最大容量', p.battery_health ? p.battery_health + '%' : ''], ['在庫店舗', shop]].filter(r => r[1]);
  const ld = [{ '@context': 'https://schema.org', '@type': 'Product', name, sku: p.product_code, mpn: p.product_code, description: desc, image: [SITE + '/share.png'],
      ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}), ...(p.color ? { color: p.color } : {}), category: p.category || undefined,
      offers: { '@type': 'Offer', url, priceCurrency: 'JPY', price: String(price), itemCondition: cs, availability: 'https://schema.org/InStock', seller: { '@type': 'Organization', name: BRAND, url: SITE + '/' } } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: BRAND, item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: '在庫一覧', item: SITE + '/shop/' }, { '@type': 'ListItem', position: 3, name, item: url }] }];
  const body = `<nav class="bc"><a href="/">${BRAND}</a> › <a href="/shop/">在庫一覧</a> › ${esc(name)}</nav><span class="tag">在庫あり</span><h1>${esc(name)}（${esc(cj)}）</h1>
<p class="price">${yen(price)}<small style="font-size:14px;font-weight:600;color:#6B7890">（税込）</small></p><table>${rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}</table>
<p><a class="btn" href="/?buy=${encodeURIComponent(p.product_code)}">このスマホを購入する</a><a class="btn alt" href="/shop/">在庫一覧へ</a></p>
<p style="font-size:14px;color:#6B7890">在庫・価格は随時更新されます。お持ち込みは各店舗、郵送でのお届けにも対応しています。</p>`;
  return page({ title, desc, canon: url, body, ld });
}

function listPage(items) {
  const sorted = items.slice().sort((a, b) => String(a.brand).localeCompare(String(b.brand)) || String(a.model).localeCompare(String(b.model)) || a.selling_price - b.selling_price);
  const url = SITE + '/shop/';
  const title = `中古スマホ・iPhone 在庫一覧（${items.length}台）｜${BRAND}`;
  const desc = `${BRAND}の販売在庫一覧。iPhone・Galaxy・Pixelなど${items.length}台の在庫を価格・状態・バッテリー容量つきで掲載。在庫は随時更新。`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'ItemList', name: '在庫一覧', url, numberOfItems: sorted.length,
    itemListElement: sorted.slice(0, 200).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/shop/${encodeURIComponent(p.product_code)}`, name: nameOf(p) })) }];
  const body = `<nav class="bc"><a href="/">${BRAND}</a> › 在庫一覧</nav><h1>中古スマホ・iPhone 在庫一覧</h1><p>現在の在庫は${items.length}台です。商品名を選ぶと、状態・バッテリー容量・価格・在庫店舗をご覧いただけます。</p>
<ul class="l">${sorted.map(p => `<li><a href="/shop/${encodeURIComponent(p.product_code)}">${esc(nameOf(p))}</a><br><span style="color:#6B7890;font-size:13px">${esc(condOf(p)[0])}${p.battery_health ? '・バッテリー' + esc(p.battery_health) + '%' : ''}</span><br><b style="color:#E0475F">${yen(p.selling_price)}</b></li>`).join('')}</ul>`;
  return page({ title, desc, canon: url, body, ld });
}

const gone = (code, status) => page({ title: `この商品は現在ご覧いただけません｜${BRAND}`, desc: 'この商品は売り切れ、または掲載を終了しました。', canon: SITE + '/shop/', status, noindex: true,
  body: `<h1>この商品は現在ご覧いただけません</h1><p>売り切れ、または掲載を終了しました。</p><p><a class="btn" href="/shop/">在庫一覧を見る</a><a class="btn alt" href="/">トップページ</a></p>` });

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return env.ASSETS.fetch(req);
    const path = u.pathname;
    try {
      if (path === '/sitemap-shop.xml') {
        const items = await stock();
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${SITE}/shop/</loc><changefreq>hourly</changefreq></url>\n` +
          items.map(p => `<url><loc>${SITE}/shop/${encodeURIComponent(p.product_code)}</loc>${p.created_at ? `<lastmod>${esc(String(p.created_at).slice(0, 10))}</lastmod>` : ''}</url>`).join('\n') + '\n</urlset>\n';
        return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=900' } });
      }
      if (path === '/shop' || path === '/shop/') return listPage(await stock());
      const m = path.match(/^\/shop\/([A-Za-z0-9_-]{3,40})\/?$/);
      if (m) {
        const rows = await stock('&product_code=eq.' + encodeURIComponent(m[1]));
        return rows.length ? productPage(rows[0]) : gone(m[1], 410);
      }
    } catch (e) {
      return page({ title: `ただいま混み合っています｜${BRAND}`, desc: '時間をおいてもう一度お試しください。', canon: SITE + '/shop/', status: 503, noindex: true,
        body: '<h1>ただいま混み合っています</h1><p>時間をおいてもう一度お試しください。</p><p><a class="btn" href="/">トップページ</a></p>' });
    }
    return env.ASSETS.fetch(req);
  }
};
