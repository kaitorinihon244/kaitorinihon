/**
 * 買取日本 — automatic buying prices from 1-chome.com (same Apps Script project as Code.gs / Bot.gs)
 *
 * autoPrices() runs every 6 hours (setupAutoPrices installs the timer). It downloads 1-chome's
 * price list, matches it to our products with the same rules as work/ichome-match.ps1 (JAN, then
 * normalised name, then model number with matching specs), and writes the result to the 買取価格 tab.
 * The site reads that tab from ?prices=1 and applies it over its own data, so no upload is needed.
 * A price that would move beyond ×0.4–×2.5 is skipped and reported. Turn it off with the Script
 * property AUTO_PRICES = off.
 */

const PRICE_HEAD = ['RJPコード', '機種名', '買取（新品）', '買取（中古）', '開封未使用', 'カラー差額', '1丁目の商品名', '照合', '更新日時'];
const IC_LISTS = [['goods', 'R0000002'], ['keitai', 'R0000001'], ['goods', 'R0000004']];
const IC_NEW_EX = /開封済|開封品|開封未使用|開封新品|使用感|傷|ジャンク|来店|難あり|欠品|中古|箱なし|本体のみ/;
const IC_OPEN = /開封済|開封品|開封未使用|開封新品/;

function priceTab_() { return tab_('買取価格', PRICE_HEAD); }

function icNorm_(t) {
  if (!t) return '';
  t = String(t).normalize('NFKC').toLowerCase();
  t = t.replace(/[【\[（(][^】\]）)]*(新品|中古|国内版|simフリー|sim free|正規品)[^】\]）)]*[】\]）)]/g, '');
  t = t.replace(/simフリー|sim free|国内版|正規品|新品|未開封/g, '');
  return t.replace(/[\s　・\-_/【】\[\]（）()「」"'◆★☆,.、。]/g, '');
}
// .NET Math.Round rounds halves to even; kept so results match the PowerShell matcher
function icRound100_(v) {
  const x = v / 100, f = Math.floor(x), d = x - f;
  return (d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1)) * 100;
}
function icCodes_(t) {
  const u = String(t || '').normalize('NFKC').toUpperCase();
  const out = (u.match(/(?<![A-Z0-9])[A-Z]{1,5}-?\d[A-Z0-9]{2,8}(?:\/A)?(?:-[A-Z0-9]{2,6})?(?![A-Z0-9])/g) || [])
    .filter(function (c) { return /[A-Z]/.test(c) && /\d/.test(c) && c.length >= 5 && !/^\d+(GB|TB|MM)$|^(GPS|USB|WIFI)/.test(c); });
  return out.filter(function (c, i) { return out.indexOf(c) === i; }).sort();
}
// key specs that must agree before two listings count as the same product
function icSpecs_(t) {
  const u = String(t || '').normalize('NFKC').toLowerCase();
  const caps = []; u.replace(/(\d+(?:\.\d+)?)\s*(tb|gb|g)(?![a-z])/g, function (m, v, unit) { caps.push(unit === 'tb' ? Number(v) * 1024 : Number(v)); return m; });
  const words = (u.match(/(?<![a-z])(pro|max|plus|mini|ultra|air|fold|flip|fe|lite|duo|xl|se|edge)(?![a-z])/g) || []);
  const big = caps.filter(function (c) { return c >= 32; });
  const one = function (rx) { const m = u.match(rx); return m ? m[1] : null; };
  return {
    cap: caps.length ? Math.max.apply(null, caps) : null,
    ncap: big.filter(function (c, i) { return big.indexOf(c) === i; }).length,
    words: words.filter(function (w, i) { return words.indexOf(w) === i; }).sort().join(','),
    inch: one(/(\d{2})(?:\.\d)?\s*(インチ|inch|型)/), mm: one(/(\d{2})\s*mm/), gen: one(/第\s*(\d+)\s*世代/),
    num: one(/(?:iphone|pixel|galaxy [sazn]|switch|ps|series|watch series)\s*(\d+[a-z]?)/)
  };
}
function icSame_(a, b) {
  const x = icSpecs_(a), y = icSpecs_(b);
  if (x.ncap > 1) return false;   // our listing groups several capacities
  const keys = ['cap', 'inch', 'mm', 'gen', 'num'];
  for (let i = 0; i < keys.length; i++) { const k = keys[i]; if (x[k] != null && y[k] != null && String(x[k]) !== String(y[k])) return false; }
  const model = function (c) { return /\/A$|^SM-|^SC[G-]|^[A-Z]\d{3}[A-Z]{2}$/.test(c); };
  const ca = icCodes_(a).filter(model), cb = icCodes_(b).filter(model);
  if (ca.length && cb.length && !ca.some(function (c) { return cb.indexOf(c) >= 0; })) return false;
  return x.words === y.words;
}

// their catalogue → one record per normalised title, plus JAN and model-number indexes
function icCatalogue_(items) {
  const theirs = {}, byJan = {}, byCode = {};
  const maxOf = function (list) { return list.reduce(function (m, d) { return Math.max(m, d.kbDetailPrice); }, 0); };
  items.forEach(function (g) {
    const k = icNorm_(g.title); if (!k) return;
    const r = theirs[k] = theirs[k] || { title: g.title, new: 0, opened: 0, used: 0, colors: {} };
    const d = (g.goodsKbDetails || []).filter(function (x) { return x.kbDetailPrice > 0; });
    if (g.kbName === '中古品') {
      const best = maxOf(d.filter(function (x) { return !/ジャンク|^J/i.test(x.kbDetailName); }));
      if (best > r.used) r.used = best;
    } else {
      const fresh = d.filter(function (x) { return !IC_NEW_EX.test(x.kbDetailName); });
      const nw = maxOf(fresh), op = maxOf(d.filter(function (x) { return IC_OPEN.test(x.kbDetailName); }));
      if (nw > r.new) r.new = nw;
      if (op > r.opened) r.opened = op;
      // colour adjustments on the 未開封/新品 detail
      const top = fresh.slice().sort(function (a, b) { return b.kbDetailPrice - a.kbDetailPrice; })[0];
      (g.keitaiColorOptions || []).forEach(function (c) {
        if (!c) return;
        const rel = top ? (c.keitaiKbDetailColorRels || []).filter(function (x) { return x.keitaiKbDetailId === top.allGoodsKbDetailId; })[0] : null;
        const cn = icNorm_(c.color); if (cn) r.colors[cn] = rel && rel.varPrice ? rel.varPrice : 0;
        if (c.jan) byJan[String(c.jan)] = r;
      });
    }
    if (g.jan) byJan[String(g.jan)] = r;
    (String(g.title).match(/\b\d{13}\b/g) || []).forEach(function (j) { byJan[j] = r; });
    icCodes_(g.title).forEach(function (c) { if (!byCode[c]) byCode[c] = r; else if (byCode[c] !== r) byCode[c] = 'AMBIG'; });
  });
  return { theirs: theirs, byJan: byJan, byCode: byCode };
}

function icDownload_() {
  const items = []; let requests = 0;
  IC_LISTS.forEach(function (l) {
    let page = 1, pages = 1;
    while (page <= pages) {
      const url = 'https://www.1-chome.com/api/' + l[0] + '/listPage?cateCode=' + l[1] + '&page=' + page + '&size=200&keyword=&isImpo=false&isCampaign=false&kbNames=&cateName=&accCode=';
      let res = null;
      for (let t = 0; t < 3 && !res; t++) {
        try { const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Referer: 'https://www.1-chome.com/' } }); if (r.getResponseCode() === 200) res = JSON.parse(r.getContentText()); } catch (err) { }
        if (!res) Utilities.sleep(5000 * (t + 1));
      }
      if (!res || !res.data) throw new Error('1丁目の価格を取得できませんでした: ' + l[1] + ' p' + page);
      pages = Number(res.data.totalPages) || 0; requests++;
      (res.data.content || []).forEach(function (g) { items.push(g); });
      page++; Utilities.sleep(1500);
    }
  });
  return { items: items, requests: requests };
}

/** Runs every 6 hours. Safe to run by hand; does nothing while AUTO_PRICES is off. */
function autoPrices() {
  if (prop_('AUTO_PRICES', 'on') === 'off') { console.log('AUTO_PRICES is off'); return; }
  let got;
  try { got = icDownload_(); } catch (err) {
    console.error(err); props_().setProperty('AUTO_PRICES_ERROR', now_() + ' ' + err.message);
    return;   // keep the last good prices; nothing is written from a partial download
  }
  const cat = icCatalogue_(got.items);
  const master = masterTab_(); const mv = master.getDataRange().getValues();
  const prev = {}; priceTab_().getDataRange().getValues().slice(1).forEach(function (r) { prev[r[0]] = [Number(r[2]) || 0, Number(r[3]) || 0]; });
  const ok = function (o, n) { if (o <= 0 || n <= 0) return true; const q = n / o; return q >= 0.4 && q <= 2.5; };
  const rows = [], skipped = [], changes = [], stamp = now_();
  for (let i = 1; i < mv.length; i++) {
    const rjp = mv[i][0], name = String(mv[i][1]), jan = String(mv[i][3] || ''), oldNew = Number(mv[i][4]) || 0, oldUsed = Number(mv[i][5]) || 0;
    let r = null, how = '';
    if (/^\d{13}$/.test(jan) && cat.byJan[jan] && icSame_(name, cat.byJan[jan].title)) { r = cat.byJan[jan]; how = 'JAN'; }
    if (!r && cat.theirs[icNorm_(name)]) { r = cat.theirs[icNorm_(name)]; how = '名称'; }
    if (!r) { const codes = icCodes_(name); for (let c = 0; c < codes.length; c++) { const cand = cat.byCode[codes[c]]; if (cand && cand !== 'AMBIG' && icSame_(name, cand.title)) { r = cand; how = '型番'; break; } } }
    if (!r || (r.new <= 0 && r.used <= 0)) continue;
    const bad = [];
    if (r.new > 0 && !ok(oldNew, r.new)) bad.push('新品 ' + oldNew + '→' + r.new);
    if (r.used > 0 && oldUsed > 0 && !ok(oldUsed, r.used)) bad.push('中古 ' + oldUsed + '→' + r.used);
    if (bad.length) { skipped.push(rjp + ' ' + name.slice(0, 30) + ' ' + bad.join(', ')); continue; }
    const newP = r.new > 0 ? r.new : oldNew;
    const usedP = r.used > 0 ? r.used : (oldUsed > 0 && r.new > 0 && oldNew > 0 ? icRound100_(oldUsed * newP / oldNew) : (oldUsed || ''));
    rows.push([rjp, name, newP, usedP, r.opened || '', JSON.stringify(r.colors), r.title, how, stamp]);
    const before = prev[rjp] || [oldNew, oldUsed];
    if (newP !== before[0] || (usedP !== '' && usedP !== before[1])) changes.push({ rjp: rjp, name: name, from: before[0], to: newP });
    master.getRange(i + 1, 5, 1, 2).setValues([[newP, usedP]]);   // the bots' listed price follows
  }
  const sh = priceTab_(); sh.clearContents();
  sh.getRange(1, 1, 1, PRICE_HEAD.length).setValues([PRICE_HEAD]).setFontWeight('bold');
  if (rows.length) sh.getRange(2, 1, rows.length, PRICE_HEAD.length).setValues(rows.map(safeRow_));
  sh.setFrozenRows(1);
  CacheService.getScriptCache().remove('prices');
  props_().setProperty('AUTO_PRICES_LAST', stamp + ' ' + rows.length + '件'); props_().deleteProperty('AUTO_PRICES_ERROR');
  console.log('downloaded ' + got.items.length + ' items in ' + got.requests + ' requests; matched ' + rows.length + '; changed ' + changes.length + '; skipped ' + skipped.length);
  if (changes.length || skipped.length) {
    const up = changes.filter(function (c) { return c.to > c.from; }).length;
    const top = changes.slice().sort(function (a, b) { return Math.abs(b.to - b.from) - Math.abs(a.to - a.from); }).slice(0, 8)
      .map(function (c) { return c.rjp + ' ' + c.name.slice(0, 26) + ' ' + yen_(c.from) + '→' + yen_(c.to); });
    tgSend_(['💹 買取価格を自動更新しました（1丁目）', '変更 ' + changes.length + '件（↑' + up + ' ↓' + (changes.length - up) + '）'].concat(top)
      .concat(skipped.length ? ['', '⚠️ 差が大きいため変更しなかった商品 ' + skipped.length + '件'].concat(skipped.slice(0, 5)) : []).join('\n'));
  }
}

// read by the site: rjp → [new, used, opened, colour deltas]
function pricesJson_() {
  const c = CacheService.getScriptCache(); const hit = c.get('prices');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  const items = {}; let updated = '';
  priceTab_().getDataRange().getValues().slice(1).forEach(function (r) {
    if (!r[0] || !(Number(r[2]) > 0)) return;
    let colors = {}; try { colors = JSON.parse(r[5] || '{}'); } catch (err) { }
    items[r[0]] = [Number(r[2]), r[3] === '' ? null : Number(r[3]), Number(r[4]) || 0, colors];
    updated = r[8] instanceof Date ? Utilities.formatDate(r[8], 'Asia/Tokyo', 'yyyy/MM/dd HH:mm') : String(r[8]);
  });
  const out = JSON.stringify({ ok: true, updated: updated, items: items });
  if (out.length < 90000) c.put('prices', out, 600);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor: installs the 6-hour timer (safe to run again). */
function setupAutoPrices() {
  priceTab_();
  if (ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }).indexOf('autoPrices') < 0)
    ScriptApp.newTrigger('autoPrices').timeBased().everyHours(6).create();
  console.log('autoPrices runs every 6 hours. AUTO_PRICES = ' + prop_('AUTO_PRICES', 'on'));
}
