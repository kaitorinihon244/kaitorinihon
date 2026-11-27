/**
 * 買取日本 — 未掲載商品の相談 受付リレー (Google Apps Script)
 *
 * The site's request form POSTs here. For each request this script:
 *   1. saves the photos to a Drive folder and logs a row in a Google Sheet,
 *   2. emails NOTIFY_EMAIL (your Gmail) with the photos attached,
 *   3. posts the request and photos to your Telegram chat,
 *   4. makes a printable 58/80mm receipt (link in the email and Telegram).
 *
 * Settings live in Project Settings → Script properties (never in this code):
 *   NOTIFY_EMAIL       your Gmail address
 *   TELEGRAM_TOKEN     the bot token from @BotFather
 *   TELEGRAM_CHAT_ID   your chat id (run findTelegramChatId once to get it)
 *   RECEIPT_KEY        any long random text; protects the receipt links
 *   SHOP_NAME          optional, defaults to 買取日本
 */

/**
 * ▼ STEP: type your Gmail and Telegram token between the quotes below, press Ctrl+S, then click Run.
 *   It saves the settings and removes anything wrong. Afterwards you can blank the two values again.
 */
function saveSettings() {
  const settings = {
    NOTIFY_EMAIL:   'PUT_YOUR_GMAIL_HERE',
    TELEGRAM_TOKEN: 'PUT_YOUR_BOT_TOKEN_HERE',
    STOCK_BOT_TOKEN: 'PUT_STOCK_BOT_TOKEN_HERE',
    RECEIPT_KEY:    'kt-oKfxgRnT04CUqMAcIwpxqL0h',
    SHOP_NAME:      '買取日本'
  };
  const old = props_().getProperties();
  if (settings.NOTIFY_EMAIL.indexOf('PUT_') === 0) settings.NOTIFY_EMAIL = old.NOTIFY_EMAIL || '';
  if (settings.TELEGRAM_TOKEN.indexOf('PUT_') === 0) settings.TELEGRAM_TOKEN = old.TELEGRAM_TOKEN || '';
  if (settings.STOCK_BOT_TOKEN.indexOf('PUT_') === 0) settings.STOCK_BOT_TOKEN = old.STOCK_BOT_TOKEN || '';
  ['FOLDER_ID', 'SHEET_ID', 'TELEGRAM_CHAT_ID'].forEach(function (k) { if (old[k]) settings[k] = old[k]; });
  Object.keys(settings).forEach(function (k) { settings[k] = String(settings[k]).trim(); });
  props_().setProperties(settings);   // keep every other setting (counters, BANK_INFO, …)
  console.log('Saved: ' + Object.keys(settings).filter(function (k) { return settings[k]; }).join(', '));
  if (!settings.NOTIFY_EMAIL) console.log('NOTIFY_EMAIL is still empty.');
  if (!settings.TELEGRAM_TOKEN) console.log('TELEGRAM_TOKEN is still empty.');
  setupCheck();
  setupStockBot();
}

/** Setup helper (first in the file so the Run menu picks it): checks the token and lists Telegram chats. */
function setupCheck() { checkTokenFormat(); findTelegramChatId(); }

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;   // per photo, after the site shrinks it
const MAX_PER_HOUR = 300;                   // simple flood guard for the public form (orders, requests, sign-ins)

function props_() { return PropertiesService.getScriptProperties(); }
function prop_(k, d) { const v = props_().getProperty(k); return v == null || v === '' ? (d || '') : v; }

/* ---------- receive a request from the site ---------- */
function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '{}';
    if (raw.length > 12000000) return json_({ ok: false, error: 'too_large' });   // photos are shrunk on the site first
    const body = JSON.parse(raw);
    // sign-in and the like carry no photos; a mail-in order carries its 2 ID photos (shrunk on the site, about 1–3 MB together)
    if (body.kind && body.kind !== 'master' && raw.length > (body.kind === 'order' ? 6000000 : 60000)) return json_({ ok: false, error: 'too_large' });
    if (body.hp) return json_({ ok: true });                       // bot filled the hidden field
    if (!rateOk_()) return json_({ ok: false, error: 'busy' });
    if (body.kind === 'order') return json_(handleOrder_(body));   // site 買取申込 → Bot.gs
    if (body.kind === 'sale') return json_(handleSale_(body));     // site 購入カート → Bot.gs
    if (body.kind === 'repair') return json_(handleRepair_(body)); // site 修理予約 → Bot.gs
    if (body.kind === 'master') return json_(handleMaster_(body));   // product master sync → Bot.gs
    if (/^(auth_start|auth_verify|me|profile|logout)$/.test(body.kind || '')) return json_(handleMember_(body));   // 会員 → Member.gs
    const r = clean_(body);
    if (!r.name || !r.contact) return json_({ ok: false, error: 'missing' });
    if (!limit_('r:' + idKey_(r.contact), 5, 3600)) return json_({ ok: false, error: 'busy' });

    const id = newId_();
    const folder = photoFolder_().createFolder(id);
    const blobs = [];
    (body.photos || []).slice(0, MAX_PHOTOS).forEach(function (p, i) {
      const m = String(p.data || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
      if (!m) return;
      const bytes = Utilities.base64Decode(m[2]);
      if (bytes.length > MAX_PHOTO_BYTES) return;
      const blob = Utilities.newBlob(bytes, m[1], id + '-' + (i + 1) + '.' + m[1].split('/')[1]);
      folder.createFile(blob);
      blobs.push(blob);
    });

    const receiptUrl = ScriptApp.getService().getUrl() + '?receipt=' + encodeURIComponent(id) + '&key=' + receiptSig_(id);
    logRow_(id, r, blobs.length, folder.getUrl());
    try { sendMail_(id, r, blobs, folder.getUrl(), receiptUrl); } catch (err) { console.error('mail', err); }
    try { sendTelegram_(id, r, blobs, receiptUrl); } catch (err) { console.error('telegram', err); }
    return json_({ ok: true, id: id });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  }
}

/* ---------- printable receipt: ?receipt=<id>&key=<RECEIPT_KEY> ---------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.stock === '1') return stockJson_();                          // site 販売 mode → Bot.gs
  if (p.prices === '1') return pricesJson_();                        // automatic buying prices → Prices.gs
  if (!p.receipt) return HtmlService.createHtmlOutput('<p>受付リレーは動作しています。</p>');
  if (!prop_('RECEIPT_KEY') || p.key !== receiptSig_(p.receipt)) return HtmlService.createHtmlOutput('<p>リンクが正しくありません。</p>');
  const row = findRow_(p.receipt);
  if (!row) return HtmlService.createHtmlOutput('<p>受付番号が見つかりません。</p>');
  return HtmlService.createHtmlOutput(receiptHtml_(row)).setTitle('受付票 ' + row.id);
}

/* ---------- helpers ---------- */
function clean_(b) {
  const s = function (v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n || 300); };
  return {
    name: s(b.name, 200), maker: s(b.maker, 100), cond: s(b.cond, 60), qty: s(b.qty, 6) || '1',
    acc: s(b.acc, 400), q: s(b.q, 1500), who: s(b.who, 100), contact: s(b.contact, 200)
  };
}

function newId_() {
  const t = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyMMdd-HHmm');
  return 'RQ-' + t + '-' + Math.floor(Math.random() * 900 + 100);
}

function rateOk_() {
  const c = CacheService.getScriptCache();
  const k = 'n' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyMMddHH');
  const n = Number(c.get(k) || 0);
  if (n >= MAX_PER_HOUR) return false;
  c.put(k, String(n + 1), 3700);
  return true;
}

function photoFolder_() {
  const id = prop_('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('買取日本 未掲載商品の相談（写真）');
  props_().setProperty('FOLDER_ID', f.getId());
  return f;
}

function sheet_() {
  const id = prop_('SHEET_ID');
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) {} }
  if (!ss) {
    ss = SpreadsheetApp.create('買取日本 未掲載商品の相談');
    props_().setProperty('SHEET_ID', ss.getId());
    ss.getSheets()[0].appendRow(['受付番号', '受付日時', '商品名・型番', 'メーカー', '状態', '数量', '付属品・購入時期', 'ご質問', 'お名前', 'ご連絡先', '写真枚数', '写真フォルダ', '対応状況']);
  }
  return ss.getSheets()[0];
}

function logRow_(id, r, n, folderUrl) {
  const when = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  sheet_().appendRow(safeRow_([id, when, r.name, r.maker, r.cond, r.qty, r.acc, r.q, r.who, r.contact, n, folderUrl, '未対応']));
}

function findRow_(id) {
  const v = sheet_().getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === id) return { id: v[i][0], when: v[i][1], name: v[i][2], maker: v[i][3], cond: v[i][4], qty: v[i][5], acc: v[i][6], q: v[i][7], who: v[i][8], contact: v[i][9], photos: v[i][10] };
  }
  return null;
}

function lines_(id, r) {
  return [
    '受付番号: ' + id,
    '商品名・型番: ' + r.name,
    r.maker ? 'メーカー: ' + r.maker : '',
    '状態: ' + r.cond, '数量: ' + r.qty,
    r.acc ? '付属品・購入時期: ' + r.acc : '',
    r.q ? 'ご質問: ' + r.q : '',
    r.who ? 'お名前: ' + r.who : '',
    'ご連絡先: ' + r.contact
  ].filter(String);
}

function esc_(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function sendMail_(id, r, blobs, folderUrl, receiptUrl) {
  const to = prop_('NOTIFY_EMAIL'); if (!to) return;
  const shop = prop_('SHOP_NAME', '買取日本');
  const text = lines_(id, r).join('\n') + '\n\n写真フォルダ: ' + folderUrl + '\n受付票（印刷）: ' + receiptUrl;
  const html = '<h2 style="margin:0 0 8px">' + esc_(shop) + ' 未掲載商品の相談</h2><p>' + lines_(id, r).map(esc_).join('<br>') +
    '</p><p><a href="' + esc_(receiptUrl) + '">受付票を開いて印刷</a> ・ <a href="' + esc_(folderUrl) + '">写真フォルダ</a></p>';
  GmailApp.sendEmail(to, '【' + shop + '】未掲載商品の相談 ' + id + ' / ' + r.name, text, { htmlBody: html, attachments: blobs, name: shop + ' 受付' });
}

function tg_(method, payload) {
  const token = prop_('TELEGRAM_TOKEN');
  return UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, { method: 'post', payload: payload, muteHttpExceptions: true });
}

function sendTelegram_(id, r, blobs, receiptUrl) {
  if (!prop_('TELEGRAM_TOKEN') || !chats_().length) return;
  const msg = '📦 未掲載商品の相談\n' + lines_(id, r).join('\n') + (blobs.length ? '\n写真: ' + blobs.length + '枚' : '') + '\n\n🧾 受付票: ' + receiptUrl + '\n状態を変える: /status ' + id + ' 査定済';
  tgSend_(msg);
  chats_().forEach(function (chat) {
    blobs.forEach(function (b, i) { tg_('sendPhoto', { chat_id: chat, photo: b, caption: id + ' 写真 ' + (i + 1) + '/' + blobs.length }); });
  });
}

function receiptHtml_(row) {
  const shop = prop_('SHOP_NAME', '買取日本');
  const L = function (k, v) { return v === '' || v == null ? '' : '<div class="k">' + esc_(k) + '</div><div class="v">' + esc_(v) + '</div>'; };
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>@page{size:80mm auto;margin:3mm}body{font-family:"Noto Sans JP",sans-serif;width:74mm;margin:0 auto;font-size:12px;color:#000}' +
    'h1{font-size:16px;text-align:center;margin:4px 0}.c{text-align:center}.hr{border-top:1px dashed #000;margin:6px 0}' +
    '.k{font-size:10px;margin-top:4px}.v{font-size:13px;font-weight:700;word-break:break-all}.no{font-size:18px;font-weight:900;text-align:center;letter-spacing:1px}' +
    'button{display:block;width:100%;padding:10px;margin:10px 0;font-size:14px}@media print{button{display:none}}</style></head><body>' +
    '<button onclick="print()">印刷する</button><h1>' + esc_(shop) + '</h1><div class="c">未掲載商品の相談 受付票</div><div class="hr"></div>' +
    '<div class="no">' + esc_(row.id) + '</div><div class="c">' + esc_(row.when) + '</div><div class="hr"></div>' +
    L('商品名・型番', row.name) + L('メーカー', row.maker) + L('状態', row.cond) + L('数量', row.qty) + L('付属品・購入時期', row.acc) +
    L('ご質問', row.q) + '<div class="hr"></div>' + L('お名前', row.who) + L('ご連絡先', row.contact) + L('写真', row.photos ? row.photos + '枚' : '') +
    '<div class="hr"></div><div class="c">担当: ________</div></body></html>';
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- run once from the editor ---------- */

/** After messaging your bot once in Telegram, run this; the chat id appears in the log. */
function findTelegramChatId() {
  const res = JSON.parse(tg_('getUpdates', {}).getContentText());
  if (!res.ok) { console.log('Telegram error: ' + res.description + '  (check TELEGRAM_TOKEN in Script properties)'); return; }
  const seen = {};
  (res.result || []).forEach(function (u) {
    const c = (u.message || u.channel_post || {}).chat;
    if (c && !seen[c.id]) { seen[c.id] = 1; console.log('chat id: ' + c.id + '  (' + (c.title || c.username || c.first_name || '') + ')'); }
  });
  const ids = Object.keys(seen);
  if (!ids.length) { console.log('No messages yet — send any message to your bot in Telegram, then run this again.'); return; }
  if (!prop_('TELEGRAM_CHAT_ID')) { props_().setProperty('TELEGRAM_CHAT_ID', ids[ids.length - 1]); console.log('Saved TELEGRAM_CHAT_ID = ' + ids[ids.length - 1] + '. Telegram is now connected.'); }
}

/** Sends a test request through every channel so you can check Gmail, Telegram and the receipt. */
function sendTest() {
  const r = clean_({ name: 'テスト商品 Galaxy S21 Ultra 256GB', maker: 'Samsung', cond: '中古（傷が少ない）', qty: 1, acc: '箱あり', q: 'これはテスト送信です', who: 'テスト', contact: 'test@example.com' });
  const id = newId_();
  const receiptUrl = ScriptApp.getService().getUrl() + '?receipt=' + encodeURIComponent(id) + '&key=' + receiptSig_(id);
  logRow_(id, r, 0, '');
  sendMail_(id, r, [], '', receiptUrl);
  sendTelegram_(id, r, [], receiptUrl);
  console.log('Sent test ' + id + '. Receipt: ' + receiptUrl);
}

/** Describes the saved TELEGRAM_TOKEN's format without printing it. */
function checkTokenFormat() {
  console.log('property names saved: ' + props_().getKeys().map(function (k) { return '[' + k + ']'; }).join(', '));
  const raw = props_().getProperty('TELEGRAM_TOKEN');
  if (raw == null) { console.log('TELEGRAM_TOKEN is not set (check the property name spelling).'); return; }
  const t = String(raw);
  console.log('length: ' + t.length + ' (a bot token is usually 44-46)');
  console.log('spaces or line breaks at ends: ' + (t !== t.trim()));
  console.log('quotes: ' + /["“”']/.test(t));
  console.log('starts with "bot": ' + /^bot/i.test(t.trim()));
  console.log('looks like digits:letters format: ' + /^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(t.trim()));
}
