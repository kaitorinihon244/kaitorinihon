/**
 * 買取日本 — 注文・在庫 Telegram ボット (same Apps Script project as Code.gs)
 *
 * Orders:  the site's 買取申込 form POSTs {kind:'order', …}; saved to the 注文 tab, emailed, sent to Telegram.
 * Stock:   the 在庫 tab, managed from Telegram:
 *            /in 商品名 | 状態 | 買取価格 | 販売価格 | メモ     add an item  (only 商品名 is required)
 *            /sold 在庫ID [販売価格]                           mark it sold
 *            /stock [検索語]                                   list what is in stock
 *            /del 在庫ID                                       remove a mistaken entry
 *          The site reads in-stock items (name, condition, selling price only) from ?stock=1.
 * Sales:   the site's 購入カート POSTs {kind:'sale', …}; saved to the 販売注文 tab (S- numbers), bank transfer within 3 days.
 *          The customer's confirmation email uses the BANK_INFO script property.
 * Orders:  /orders  /order ID  /status ID 状態   (works for KT- orders, S- sales and RQ- requests)
 * Payment: /paid ID [入金額] confirms a bank transfer and emails the customer; /ship ID 配送業者 追跡番号 emails the tracking number.
 * Daily:   /summary, and an automatic summary every evening at 20:00.
 *
 * One-time setup (run in the editor): installTriggers   — checks Telegram every minute + daily summary.
 * Only registered chats can use commands. Register a chat by sending:  /register <ADMIN_KEY>
 * (ADMIN_KEY is a Script property, created on first use; it is not part of any receipt link).
 */

const ORDER_STATUSES = ['受付', '確認済', '来店待ち', '到着待ち', '査定中', '査定済', '支払済', '完了', 'キャンセル'];
const CLOSED = ['完了', 'キャンセル', '販売済', '削除', '受取済', '発送済'];

/* ---------- sheets ---------- */
function book_() { return sheet_().getParent(); }
function tab_(name, header) {
  const ss = book_();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}
const ORDER_BANK_HEAD = ['金融機関名', '支店名', '口座種別', '口座番号', '口座名義'];
function ordersTab_() {
  const sh = tab_('注文', ['注文番号', '受付日時', '買取方法', 'お名前', 'フリガナ', 'メール', '電話', '来店・発送予定', '住所', '商品', '点数', '買取予定合計', '備考', '状態', '更新日時'].concat(ORDER_BANK_HEAD));
  if (sh.getLastColumn() < 20) sh.getRange(1, 16, 1, 5).setValues([ORDER_BANK_HEAD]);
  return sh;
}
function stockTab_() { return tab_('在庫', ['在庫ID', '入荷日', '商品名', '状態', '買取価格', '販売価格', 'メモ', 'ステータス', '販売日', '販売実績', '保管場所', 'RJPコード']); }
function now_() { return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'); }
function today_() { return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd'); }
function yen_(n) { n = Number(n) || 0; return '¥' + n.toLocaleString('ja-JP'); }
/* order number made by the site (so a resend is recognised); only the expected shape is accepted */
function clientId_(cid, prefix) { cid = String(cid || ''); return new RegExp('^' + prefix + '-\\d{6}-\\d{4}$').test(cid) ? cid : ''; }
function num_(s) { const n = Number(String(s || '').replace(/[^\d]/g, '')); return isFinite(n) ? n : 0; }

/* ---------- orders from the site ---------- */
function handleOrder_(b) {
  const s = function (v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n || 200); };
  const o = {
    way: b.way === 'mail' ? '郵送買取' : '店頭買取',
    name: s(b.name, 80), kana: s(b.kana, 80), email: s(b.email, 120), tel: s(b.tel, 40),
    when: s(b.when, 80), addr: s(b.addr, 200), note: s(b.note, 800)
  };
  if (!o.name || !(o.email || o.tel)) return { ok: false, error: 'missing' };
  o.bank = o.way === '郵送買取' ? bankIn_(b.bank) : null;
  if (o.way === '郵送買取' && !o.bank) return { ok: false, error: 'bank' };
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 50).map(function (it) {
    return { name: s(it.name, 160), label: s(it.label, 80), qty: Math.max(1, Math.min(99, num_(it.qty) || 1)), unit: num_(it.unit), rjp: /^RJP-\d{6}$/.test(it.rjp) ? it.rjp : '' };
  }).filter(function (it) { return it.name; });
  if (!items.length && b.freeText) items.push({ name: s(b.freeText, 400), label: '', qty: 1, unit: 0 });
  const total = items.reduce(function (a, it) { return a + it.unit * it.qty; }, 0);
  const count = items.reduce(function (a, it) { return a + it.qty; }, 0);
  const id = clientId_(b.cid, 'KT') || 'KT-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
  if (findById_(id)) return { ok: true, id: id };   // the site resent an order it already sent
  if (!limit_('o:' + idKey_(o.email || o.tel), 5, 3600)) return { ok: false, error: 'busy' };
  const itemText = items.map(function (it) { return (it.rjp ? '[' + it.rjp + '] ' : '') + it.name + (it.label ? '（' + it.label + '）' : '') + ' ×' + it.qty + (it.unit ? ' ' + yen_(it.unit) : ''); }).join('\n');
  ordersTab_().appendRow(safeRow_([id, now_(), o.way, o.name, o.kana, o.email, o.tel, o.when, o.addr, itemText, count, total, o.note, '受付', now_()].concat(o.bank ? [o.bank.name, o.bank.branch, o.bank.type, "'" + o.bank.no, o.bank.holder] : [])));

  const lines = ['注文番号: ' + id, '買取方法: ' + o.way, 'お名前: ' + o.name + (o.kana ? '（' + o.kana + '）' : ''), 'メール: ' + o.email, '電話: ' + o.tel,
    o.way === '店頭買取' ? 'ご来店予定: ' + o.when : '発送予定: ' + o.when, o.addr ? 'ご住所: ' + o.addr : '', '', '【商品】', itemText,
    '合計（上限）: ' + yen_(total) + '　' + count + '点', o.bank ? '振込先: ' + bankMask_(o.bank) + '（全桁はシートの注文タブ）' : '', o.note ? '備考: ' + o.note : ''].filter(function (x) { return x !== ''; });
  try {
    const to = prop_('NOTIFY_EMAIL'); const shop = prop_('SHOP_NAME', '買取日本');
    if (to) GmailApp.sendEmail(to, '【' + shop + '】買取申込 ' + id + ' / ' + o.name + ' / ' + yen_(total), lines.join('\n'), { name: shop + ' 受付' });
  } catch (err) { console.error('order mail', err); }
  const mailNote = o.way === '郵送買取' ? '\n\nお客様への受付メール: ' + (orderMail_(o, id, itemText, total, count) ? '送信済み' : '⚠️ 未送信（お客様へ連絡してください）') : '';
  try { tgSend_('🛒 新しい買取申込\n' + lines.join('\n') + mailNote + '\n\n状態を変える: /status ' + id + ' 確認済'); } catch (err) { console.error('order tg', err); }
  return { ok: true, id: id };
}

// mail-in orders are paid by transfer, so the customer's account is required. The full number stays in the sheet;
// emails, Telegram and /order only ever show the last 4 digits.
function bankIn_(x) {
  x = x || {};
  const t = function (v, n) { return String(v == null ? '' : v).normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n); };
  const b = { name: t(x.name, 60), branch: t(x.branch, 60), type: t(x.type, 4), no: t(x.no, 30).replace(/[\s-]/g, ''), holder: t(x.holder, 60) };
  return b.name && b.branch && ['普通', '当座', '貯蓄'].indexOf(b.type) >= 0 && /^\d{4,14}$/.test(b.no) && b.holder ? b : null;
}
function bankMask_(b) { return b.name + ' ' + b.branch + ' ' + b.type + ' ****' + b.no.slice(-4) + ' ' + b.holder; }
// The blank 買取申込書 (PDF) attached to the mail-in confirmation: a file called 買取日本_買取申込書.pdf in your own Drive.
// To change the form, upload the new PDF with that name and move the old one to the bin; nothing else needs touching.
const FORM_NAME = '買取日本_買取申込書.pdf';
function applicationForm_() {
  try {
    const c = props_(); let id = c.getProperty('APPLICATION_PDF_ID'), f = null;
    if (id) { try { f = DriveApp.getFileById(id); if (f.isTrashed()) f = null; } catch (e) { f = null; } }
    if (!f) {
      const it = DriveApp.searchFiles("title = '" + FORM_NAME + "' and 'me' in owners and trashed = false");
      if (it.hasNext()) { f = it.next(); c.setProperty('APPLICATION_PDF_ID', f.getId()); }
    }
    if (!f) { console.error('application form not found in Drive'); try { tgSend_('⚠️ 買取申込書PDFがDriveに見つからないため、添付なしで受付メールを送りました（ファイル名: ' + FORM_NAME + '）'); } catch (e) {} return null; }
    return f.getBlob().setName(FORM_NAME);
  } catch (err) { console.error('application form', err); return null; }
}
// mail-in orders: the customer gets the order details and where to send the items
const MAIL_TO = ['Royal Japan', '〒171-0021 東京都豊島区西池袋1-10-2 日高ビル503'];
function orderMail_(o, id, itemText, total, count) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) return false;
  if (!limit_('cm:' + idKey_(o.email), 3, 21600) || !limit_('cm:all', 60, 3600)) return false;
  try {
    const shop = prop_('SHOP_NAME', '買取日本'); const opt = { name: shop };
    if (prop_('NOTIFY_EMAIL')) opt.replyTo = prop_('NOTIFY_EMAIL');
    // the blank 買取申込書 goes with every mail-in confirmation; without the file the mail still goes out, without this paragraph
    const form = applicationForm_(); if (form) opt.attachments = [form];
    const formText = form ? '【買取申込書（PDF）を添付しています】\n印刷して、お振込先の口座情報と、端末の情報（仕様・IMEI・状態など）を、わかる範囲でご記入ください。\n記入した申込書は、商品と一緒に同封してお送りください。\n' : '';
    const body = [noLinks_(o.name) + ' 様', '', 'このたびは' + shop + 'をご利用いただき、ありがとうございます。', '以下の内容で郵送買取のお申し込みを受け付けました。', '',
      '申込番号: ' + id, '発送予定日: ' + noLinks_(o.when), '', '【商品】', noLinks_(itemText), '合計（上限）: ' + yen_(total) + '　' + count + '点', '※表示金額は上限です。検品後に正式な金額をご連絡します。', '',
      '【お振込先（ご入力内容）】', noLinks_(bankMask_(o.bank)), '※誤りがある場合は、このメールにご返信ください。', '',
      formText,
      '【商品の送り先】', MAIL_TO[0], MAIL_TO[1], '',
      '【今後の流れ】', '1. 内容を確認し、予約承認メールをお送りします', '2. 承認メールの受信日当日に、商品・記入済みの買取申込書・本人確認書類（初回のみ住民票の写しなど）を同封し、上記の送り先へ着払いで発送してください', '3. 到着後に検品します', '4. 問題がなければ翌営業日にお振込みします', '',
      'まだ発送せず、予約承認メールをお待ちください。', 'ご不明な点は、このメールにご返信ください。', '', shop].join('\n');
    GmailApp.sendEmail(o.email, '【' + shop + '】郵送買取のお申し込みを受け付けました（' + id + '）', body, opt);
    return true;
  } catch (err) { console.error('order customer mail', err); return false; }
}

/* ---------- in-stock list for the site (no buy prices, no memos) ---------- */
function stockJson_() {
  const v = stockTab_().getDataRange().getValues();
  const items = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i][7] !== '在庫') continue;
    items.push({ id: v[i][0], name: v[i][2], cond: v[i][3], price: Number(v[i][5]) || 0 });
  }
  return json_({ ok: true, updated: now_(), items: items });
}

/* ---------- Telegram plumbing ---------- */
function chats_() { return prop_('TELEGRAM_CHAT_ID').split(',').map(function (x) { return x.trim(); }).filter(String); }
function tgSend_(text, chatId) {
  if (!prop_('TELEGRAM_TOKEN')) return;
  const targets = chatId ? [String(chatId)] : chats_();
  targets.forEach(function (c) {
    for (let i = 0; i < text.length; i += 3900) {
      const r = tg_('sendMessage', { chat_id: c, text: text.slice(i, i + 3900), disable_web_page_preview: 'true' });
      if (r.getResponseCode() !== 200) console.error('Order bot reply failed: ' + r.getContentText().slice(0, 200));
    }
  });
}

/** Runs every minute (installTriggers): reads new Telegram messages and answers commands. */
function pollTelegram() {
  if (!prop_('TELEGRAM_TOKEN')) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const offset = Number(prop_('TG_OFFSET', '0')) || 0;
    const res = JSON.parse(tg_('getUpdates', { offset: String(offset), timeout: '0', allowed_updates: '["message"]' }).getContentText());
    if (!res.ok) { console.log('Telegram error: ' + res.description); return; }
    let next = offset;
    (res.result || []).forEach(function (u) {
      next = Math.max(next, u.update_id + 1);
      const m = u.message; if (!m || !m.text) return;
      const chat = String(m.chat.id);
      console.log('Order bot got: ' + commandLog_(m.text) + ' / registered chat: ' + (chats_().indexOf(chat) >= 0));
      try { handleCommand_(m.text.trim(), chat); } catch (err) { console.error(err); tgSend_('エラー: ' + err.message, chat); }
    });
    if (next !== offset) props_().setProperty('TG_OFFSET', String(next));
  } finally { lock.releaseLock(); }
}

// for the execution log: the command and its first word only, never a registration key
function commandLog_(text) {
  const t = String(text || '').trim();
  if (t.charAt(0) !== '/') return '(not a command, starts with ' + t.slice(0, 1) + ')';
  return /^\/register/.test(t) ? '/register' : t.split(/\s+/).slice(0, 2).join(' ').slice(0, 40);
}

function handleCommand_(text, chat) {
  // phones capitalise the first word and the slash is easy to miss: "Paid S-..." works the same as "/paid S-..."
  text = text.normalize('NFKC').replace(/^\/?(paid|ship|status|orders?|help)(?=\s|@|$)/i, function (x, w) { return '/' + w.toLowerCase(); });
  const cmd = (text.match(/^\/(\w+)/) || [])[1];
  const arg = text.replace(/^\/\w+(@\w+)?\s*/, '');
  if (cmd === 'register') {
    if (!limit_('reg:' + chat, 5, 3600)) return;   // too many wrong keys from this chat
    if (arg && arg === adminKey_()) {
      const list = chats_(); if (list.indexOf(chat) < 0) list.push(chat);
      props_().setProperty('TELEGRAM_CHAT_ID', list.join(','));
      return tgSend_('✅ このチャットを登録しました。/help でコマンド一覧を表示します。', chat);
    }
    return tgSend_('登録キーが違います。', chat);
  }
  if (chats_().indexOf(chat) < 0) return tgSend_('このチャットは未登録です。管理者は /register 登録キー を送ってください。', chat);
  switch (cmd) {
    case 'start': case 'help': return tgSend_(helpText_(), chat);
    case 'orders': return tgSend_(ordersText_(), chat);
    case 'order': return tgSend_(orderDetail_(arg), chat);
    case 'status': return tgSend_(setStatus_(arg), chat);
    case 'paid': return tgSend_(salePaidCommand_(arg), chat);
    case 'ship': return tgSend_(saleShip_(arg), chat);
    case 'in': return tgSend_(stockIn_(arg), chat);
    case 'sold': return tgSend_(stockSold_(arg), chat);
    case 'stock': return tgSend_(stockList_(arg), chat);
    case 'del': return tgSend_(stockDel_(arg), chat);
    case 'summary': return tgSend_(summaryText_(), chat);
    default: return tgSend_('コマンドが分かりません。/help で一覧を表示します。', chat);
  }
}

function helpText_() {
  return ['📋 コマンド一覧',
    '【注文・相談】',
    '/orders — 未完了の注文と相談',
    '/order 番号 — 詳細（例: /order KT-261102-1234）',
    '/status 番号 状態 — 状態を変更',
    '　買取: ' + ORDER_STATUSES.join(' / '),
    '　販売（S-）: ' + SALE_STATUSES.join(' / '),
    '【オンライン販売の入金・発送】',
    '/paid 番号 [入金額] — 入金確認にして、お客様にメール',
    '/ship 番号 配送業者 追跡番号 — 発送済にして、追跡番号をメール',
    '　例: /ship S-261105-1234 ヤマト 123456789012',
    '【在庫】',
    '/in 商品名 | 状態 | 買取価格 | 販売価格 | メモ',
    '　例: /in iPhone 15 Pro 256GB | 中古A | 115000 | 138000 | 黒 バッテリー92%',
    '/sold 在庫ID [販売価格] — 販売済みにする',
    '/stock [検索語] — 在庫一覧（例: /stock iPhone 15）',
    '/del 在庫ID — 間違えて登録した在庫を削除',
    '【その他】',
    '/summary — 今日のまとめ'].join('\n');
}

/* ---------- orders & requests ---------- */
function findById_(id) {
  id = String(id || '').trim().toUpperCase();
  if (!id) return null;
  const tabs = [{ sh: ordersTab_(), statusCol: 14, kind: 'order' }, { sh: salesTab_(), statusCol: 16, kind: 'sale' }, { sh: sheet_(), statusCol: 13, kind: 'request' }];
  for (let t = 0; t < tabs.length; t++) {
    const v = tabs[t].sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) if (String(v[i][0]).toUpperCase() === id) return { sh: tabs[t].sh, row: i + 1, values: v[i], header: v[0], statusCol: tabs[t].statusCol, kind: tabs[t].kind };
  }
  return null;
}

function ordersText_() {
  const out = [];
  const ov = ordersTab_().getDataRange().getValues();
  for (let i = ov.length - 1; i >= 1 && out.length < 15; i--) if (CLOSED.indexOf(ov[i][13]) < 0) out.push('🛒 ' + ov[i][0] + ' ' + ov[i][3] + ' ' + yen_(ov[i][11]) + ' [' + ov[i][13] + ']');
  const sv = salesTab_().getDataRange().getValues();
  for (let i = sv.length - 1; i >= 1 && out.length < 30; i--) if (CLOSED.indexOf(sv[i][15]) < 0) out.push('🛍 ' + sv[i][0] + ' ' + sv[i][4] + ' ' + yen_(sv[i][12]) + ' [' + sv[i][15] + ']');
  const rv = sheet_().getDataRange().getValues();
  for (let i = rv.length - 1; i >= 1 && out.length < 40; i--) if (CLOSED.indexOf(rv[i][12]) < 0 && rv[i][12] !== '') out.push('📦 ' + rv[i][0] + ' ' + rv[i][2] + ' [' + rv[i][12] + ']');
  return out.length ? '未完了の注文・相談\n' + out.join('\n') + '\n\n詳細: /order 番号' : '未完了の注文・相談はありません。';
}

function orderDetail_(id) {
  const f = findById_(id); if (!f) return '見つかりません: ' + id;
  return f.header.map(function (h, i) { const v = f.values[i]; return v === '' || v == null ? '' : h + ': ' + (h.indexOf('合計') >= 0 ? yen_(v) : h === '口座番号' ? '****' + String(v).slice(-4) : v); }).filter(String).join('\n');
}

function setStatus_(arg) {
  const m = arg.match(/^(\S+)\s+(.+)$/); if (!m) return '使い方: /status 番号 状態\n状態: ' + ORDER_STATUSES.join(' / ');
  const status = m[2].trim();
  const f = findById_(m[1]); if (!f) return '見つかりません: ' + m[1];
  const allowed = f.kind === 'sale' ? SALE_STATUSES : ORDER_STATUSES;
  if (allowed.indexOf(status) < 0) return '状態は次から選んでください: ' + allowed.join(' / ');
  if (f.kind === 'sale' && status === '入金確認') return salePaid_(f, 0);
  if (f.kind === 'sale' && status === '発送済') return '追跡番号をお客様にお知らせするため、次のコマンドを使ってください。\n' + SHIP_USAGE;
  f.sh.getRange(f.row, f.statusCol).setValue(status);
  if (f.kind === 'order') f.sh.getRange(f.row, 15).setValue(now_());
  if (f.kind === 'sale') f.sh.getRange(f.row, 17).setValue(now_());
  if (f.kind === 'sale' && ['入金確認', '発送済', '受取済'].indexOf(status) >= 0) ledgerFromSale_(f.values);
  if (f.kind === 'sale' && status === 'キャンセル') ledgerVoid_(f.values[0]);
  return '✅ ' + f.values[0] + ' を「' + status + '」にしました。';
}

/* ---------- stock ---------- */
function stockIn_(arg) {
  const p = arg.split('|').map(function (x) { return x.trim(); });
  if (!p[0]) return '使い方: /in 商品名 | 状態 | 買取価格 | 販売価格 | メモ\n例: /in iPhone 15 Pro 256GB | 中古A | 115000 | 138000';
  const sh = stockTab_();
  const n = Number(prop_('STOCK_SEQ', '0')) + 1; props_().setProperty('STOCK_SEQ', String(n));
  const id = 'ST' + ('000' + n).slice(-4);
  const hit = masterFind_(p[0]);
  if (!hit && /^rjp/i.test(p[0])) return 'そのRJPコードは商品マスタにありません: ' + p[0];
  if (hit) p[0] = hit.name;
  sh.appendRow(safeRow_([id, today_(), p[0], p[1] || '', num_(p[2]) || '', num_(p[3]) || '', p[4] || '', '在庫', '', '', '', hit ? hit.rjp : '']));
  return '✅ 在庫に追加しました\n' + id + ' ' + p[0] + (p[1] ? '（' + p[1] + '）' : '') + (p[2] ? '\n買取 ' + yen_(p[2]) : '') + (p[3] ? '　販売 ' + yen_(p[3]) : '') + '\n販売したら: /sold ' + id;
}

function stockRow_(id) {
  id = String(id || '').trim().toUpperCase();
  const sh = stockTab_(); const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]).toUpperCase() === id) return { sh: sh, row: i + 1, v: v[i] };
  return null;
}

function stockSold_(arg) {
  const m = arg.split(/\s+/); const r = stockRow_(m[0]);
  if (!r) return '使い方: /sold 在庫ID [販売価格]（在庫IDは /stock で確認）';
  if (r.v[7] !== '在庫') return r.v[0] + ' は「' + r.v[7] + '」です。';
  const orderId = m.slice(1).filter(function (x) { return /^S-\d/i.test(x); })[0] || '';
  const price = num_(m.slice(1).filter(function (x) { return /^[¥\d,]+$/.test(x); })[0]) || Number(r.v[5]) || 0;
  r.sh.getRange(r.row, 8, 1, 3).setValues([['販売済', today_(), price || '']]);
  ledgerSold_(r.v[0], r.v[2], r.v[3], price, Number(r.v[4]) || 0, orderId, r.v[11]);
  const profit = price && r.v[4] ? '（粗利 ' + yen_(price - Number(r.v[4])) + '）' : '';
  return '💰 販売済みにしました\n' + r.v[0] + ' ' + r.v[2] + (price ? '\n' + yen_(price) + profit : '');
}

function stockDel_(arg) {
  const r = stockRow_(arg); if (!r) return '使い方: /del 在庫ID';
  r.sh.getRange(r.row, 8).setValue('削除');
  return '🗑 ' + r.v[0] + ' ' + r.v[2] + ' を削除しました。';
}

function stockList_(q) {
  const v = stockTab_().getDataRange().getValues();
  const key = String(q || '').toLowerCase().replace(/\s+/g, '');
  const rows = [];
  let cost = 0, value = 0;
  for (let i = 1; i < v.length; i++) {
    if (v[i][7] !== '在庫') continue;
    if (key && String(v[i][2]).toLowerCase().replace(/\s+/g, '').indexOf(key) < 0) continue;
    rows.push(v[i]); cost += Number(v[i][4]) || 0; value += Number(v[i][5]) || 0;
  }
  if (!rows.length) return key ? '「' + q + '」の在庫はありません。' : '在庫はありません。/in で追加できます。';
  const list = rows.slice(0, 40).map(function (r) { return r[0] + ' ' + r[2] + (r[3] ? '（' + r[3] + '）' : '') + (r[5] ? ' ' + yen_(r[5]) : ''); });
  return '📦 在庫 ' + rows.length + '点' + (key ? '（' + q + '）' : '') + '\n' + list.join('\n') + (rows.length > 40 ? '\n…ほか' + (rows.length - 40) + '点' : '') +
    '\n\n仕入合計 ' + yen_(cost) + '　販売予定合計 ' + yen_(value);
}

/* ---------- summary ---------- */
function summaryText_() {
  const d = today_();
  const ov = ordersTab_().getDataRange().getValues().slice(1);
  const rv = sheet_().getDataRange().getValues().slice(1);
  const sv = stockTab_().getDataRange().getValues().slice(1);
  const todayOrders = ov.filter(function (r) { return fmtD_(r[1]) === d; });
  const todayReq = rv.filter(function (r) { return fmtD_(r[1]) === d; });
  const bought = sv.filter(function (r) { return fmtD_(r[1]) === d; });
  const sold = sv.filter(function (r) { return fmtD_(r[8]) === d && r[7] === '販売済'; });
  const inStock = sv.filter(function (r) { return r[7] === '在庫'; });
  const sum = function (rows, c) { return rows.reduce(function (a, r) { return a + (Number(r[c]) || 0); }, 0); };
  const openOrders = ov.filter(function (r) { return CLOSED.indexOf(r[13]) < 0; }).length;
  const sa = salesTab_().getDataRange().getValues().slice(1);
  const todaySales = sa.filter(function (r) { return fmtD_(r[1]) === d; });
  const unpaid = sa.filter(function (r) { return r[15] === '入金待ち'; });
  const late = overdueSales_();
  return ['📊 ' + d + ' のまとめ',
    '買取申込: ' + todayOrders.length + '件（' + yen_(sum(todayOrders, 11)) + '）',
    '未掲載の相談: ' + todayReq.length + '件',
    '入荷: ' + bought.length + '点（仕入 ' + yen_(sum(bought, 4)) + '）',
    '販売: ' + sold.length + '点（売上 ' + yen_(sum(sold, 9)) + '）',
    '在庫: ' + inStock.length + '点（販売予定 ' + yen_(sum(inStock, 5)) + '）',
    'オンライン販売注文: ' + todaySales.length + '件（' + yen_(sum(todaySales, 12)) + '）',
    '入金待ち: ' + unpaid.length + '件（' + yen_(sum(unpaid, 12)) + '）',
    '来店待ち: ' + sa.filter(function (r) { return r[15] === '来店待ち'; }).length + '件',
    '未完了の買取申込: ' + openOrders + '件'].concat(late.length ? ['', '⚠️ 期限切れの注文（キャンセルするか連絡してください）'].concat(late.map(function (r) { return r[0] + ' ' + r[4] + ' ' + yen_(r[12]) + ' 期限' + fmtD_(r[14]); })) : []).join('\n');
}
function fmtD_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd') : String(v || '').slice(0, 10); }

/** Sent automatically every evening by installTriggers. */
function dailySummary() { tgSend_(summaryText_()); }

/** Run once from the editor: checks Telegram every minute and sends the daily summary at 20:00. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['pollTelegram', 'dailySummary'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pollTelegram').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('dailySummary').timeBased().atHour(20).everyDays(1).inTimezone('Asia/Tokyo').create();
  ordersTab_(); stockTab_(); salesTab_();
  console.log('Triggers installed: pollTelegram (every minute), dailySummary (20:00). Sheets ready: 注文, 在庫.');
}

/* ---------- sales (customer buys from the 購入カート, pays by bank transfer within 3 days) ---------- */
const SALE_STATUSES = ['来店待ち', '入金待ち', '入金確認', '発送済', '受取済', 'キャンセル'];
const STORE_PAY = '現金・クレジットカード・バーコード決済など';
const PAY_DAYS = 3;
function salesTab_() {
  const sh = tab_('販売注文', ['注文番号', '受付日時', '受取方法', '受取店舗', 'お名前', 'フリガナ', 'メール', '電話', '郵便番号', '住所', '商品', '点数', '合計', '備考', '支払期限', '状態', '更新日時', '配送業者', '追跡番号', '入金確認メール', '発送メール']);
  if (sh.getLastColumn() < 21) sh.getRange(1, 18, 1, 4).setValues([['配送業者', '追跡番号', '入金確認メール', '発送メール']]);
  return sh;
}

function handleSale_(b) {
  const s = function (v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n || 200); };
  const o = {
    way: b.way === 'delivery' ? '配送' : '店頭受取', store: s(b.store, 80),
    name: s(b.name, 80), kana: s(b.kana, 80), email: s(b.email, 120), tel: s(b.tel, 40),
    zip: s(b.zip, 10), addr: s(b.addr, 200), note: s(b.note, 800)
  };
  if (!o.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email) || !o.tel) return { ok: false, error: 'missing' };
  if (o.way === '配送' && !o.addr) return { ok: false, error: 'missing' };
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 50).map(function (it) {
    return { name: s(it.name, 160), label: s(it.label, 80), qty: Math.max(1, Math.min(99, num_(it.qty) || 1)), unit: num_(it.unit), rjp: /^RJP-\d{6}$/.test(it.rjp) ? it.rjp : '' };
  }).filter(function (it) { return it.name; });
  if (!items.length) return { ok: false, error: 'empty' };
  const total = items.reduce(function (a, it) { return a + it.unit * it.qty; }, 0);
  const count = items.reduce(function (a, it) { return a + it.qty; }, 0);
  const id = clientId_(b.cid, 'S') || 'S-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
  // backorder: out-of-stock items take 1-2 weeks, so a pickup order's deadline moves out by 14 days
  const back = !!b.backorder;
  const due = Utilities.formatDate(new Date(Date.now() + (PAY_DAYS + (back && o.way === '店頭受取' ? 14 : 0)) * 864e5), 'Asia/Tokyo', 'yyyy/MM/dd');
  if (findById_(id)) return { ok: true, id: id, due: due, total: total };   // resent by the site
  if (!limit_('s:' + idKey_(o.email), 5, 3600)) return { ok: false, error: 'busy' };
  const itemText = items.map(function (it) { return (it.rjp ? '[' + it.rjp + '] ' : '') + it.name + (it.label ? '（' + it.label + '）' : '') + ' ×' + it.qty + ' ' + yen_(it.unit); }).join('\n');
  // store pickup is paid at the store, so only delivery orders use the bank transfer
  const pickup = o.way === '店頭受取';
  salesTab_().appendRow(safeRow_([id, now_(), o.way, o.way === '店頭受取' ? o.store : '', o.name, o.kana, o.email, o.tel, o.zip, o.addr, itemText, count, total, o.note, due, pickup ? '来店待ち' : '入金待ち', now_()]));

  const recv = o.way === '店頭受取' ? '店頭受取（' + o.store + '）' : '配送（〒' + o.zip + ' ' + o.addr + '）';
  const lines = ['注文番号: ' + id, '受け取り: ' + recv, 'お名前: ' + o.name + (o.kana ? '（' + o.kana + '）' : ''), 'メール: ' + o.email, '電話: ' + o.tel,
    '', '【商品】', itemText, '合計: ' + yen_(total) + (pickup ? '（税込）　' : '（税込・送料別）　') + count + '点', back ? 'お取り寄せ: 在庫切れの商品を含むため、ご用意まで1〜2週間' : '', pickup ? 'お支払い: ご来店時に店舗で（' + STORE_PAY + '）' : '', (pickup ? (back ? 'お受け取り期限: ' : 'お取り置き期限: ') : 'お振込み期限: ') + due, o.note ? '備考: ' + o.note : ''].filter(function (x) { return x !== ''; });
  const shop = prop_('SHOP_NAME', '買取日本');
  try {
    const to = prop_('NOTIFY_EMAIL');
    if (to) GmailApp.sendEmail(to, '【' + shop + '】販売注文 ' + id + ' / ' + o.name + ' / ' + yen_(total), lines.join('\n') + PRICE_NOTE, { name: shop + ' 受付', replyTo: o.email });
  } catch (err) { console.error('sale mail', err); }
  try {
    const bank = prop_('BANK_INFO');
    const next = pickup
      ? ['【今後の流れ】', '1. ご注文の受付（このメール）', back ? '2. 入荷しましたらご連絡します（1〜2週間）。ご連絡後に ' + noLinks_(o.store) + ' へご来店ください' : '2. ' + due + ' までに ' + noLinks_(o.store) + ' へご来店ください', '3. 店舗でお支払い・お受け取り（' + STORE_PAY + '）', '', 'ご来店時に注文番号をお伝えください。ご請求額: ' + yen_(total), '期限までにご来店がない場合、ご注文はキャンセルとなります。']
      : ['【お振込み先】', bank || '振込先は担当者より改めてご連絡します。', '',
        'お振込み期限: ' + due + '（ご注文から' + PAY_DAYS + '日以内）', 'ご請求額: ' + yen_(total) + '（送料は別途ご案内します）',
        '振込人名の前に注文番号（' + id.replace(/-/g, '') + '）を入れてください。', '',
        '【今後の流れ】', '1. ご注文の受付（このメール）', '2. ご入金の確認 → 確認メールをお送りします', back ? '3. お取り寄せ（ご入金確認後1〜2週間）→ 発送時に追跡番号をメールでお知らせします' : '3. 発送 → 追跡番号をメールでお知らせします', '', '期限までにご入金が確認できない場合、ご注文はキャンセルとなります。'];
    const body = [noLinks_(o.name) + ' 様', '', 'このたびは' + shop + 'をご利用いただき、ありがとうございます。', '以下の内容でご注文を承りました。', '',
      lines.map(noLinks_).join('\n'), ''].concat(next, ['', shop]).join('\n');
    const opt = { name: shop }; if (prop_('NOTIFY_EMAIL')) opt.replyTo = prop_('NOTIFY_EMAIL');
    if (limit_('cm:' + idKey_(o.email), 3, 21600) && limit_('cm:all', 60, 3600)) GmailApp.sendEmail(o.email, '【' + shop + '】ご注文ありがとうございます（' + id + '）', body, opt);
  } catch (err) { console.error('sale customer mail', err); }
  try { tgSend_('🛍 新しい販売注文（' + (pickup ? '来店待ち' : '入金待ち') + '）\n' + lines.join('\n') + PRICE_NOTE + (back ? '\n\n⚠️ 取り寄せ商品あり。入荷したらお客様へ連絡してください。' : '') + '\n\n' + (pickup ? '店頭でお支払い後、お渡ししたら: /status ' + id + ' 受取済' : '入金を確認したら: /paid ' + id)); } catch (err) { console.error('sale tg', err); }
  return { ok: true, id: id, due: due, total: total };
}

function overdueSales_() {
  const d = today_();
  return salesTab_().getDataRange().getValues().slice(1).filter(function (r) { return (r[15] === '入金待ち' || r[15] === '来店待ち') && fmtD_(r[14]) < d; });
}

/* ---------- customer emails after the order: 2 payment confirmed, 3 shipped with the tracking number ---------- */
const CARRIERS = [
  { name: 'ヤマト運輸', match: /^(ヤマト|ヤマト運輸|クロネコ|yamato)$/i, url: 'https://jizen.kuronekoyamato.co.jp/jizen/servlet/crjz.b.NQ0010?id=' },
  { name: '佐川急便', match: /^(佐川|佐川急便|sagawa)$/i, url: 'https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=' },
  { name: '日本郵便', match: /^(日本郵便|郵便|ゆうパック|ゆうパケット|japanpost)$/i, url: 'https://trackings.post.japanpost.jp/services/srv/search/direct?searchKind=S002&locale=ja&reqCodeNo1=' }
];
const SHIP_USAGE = '/ship 注文番号 配送業者 追跡番号\n例: /ship S-261105-1234 ヤマト 123456789012\n配送業者: ヤマト / 佐川 / 日本郵便';
// also accepts the number as it appears on a bank statement (S2611051234)
function saleFind_(id) {
  const f = findById_(String(id || '').trim().replace(/^S(\d{6})(\d{4})$/i, 'S-$1-$2'));
  return f && f.kind === 'sale' ? f : null;
}
function saleMail_(v, subject, lines) {
  const shop = prop_('SHOP_NAME', '買取日本'); const opt = { name: shop };
  if (prop_('NOTIFY_EMAIL')) opt.replyTo = prop_('NOTIFY_EMAIL');
  const body = [noLinks_(v[4]) + ' 様', ''].concat(lines, ['', '注文番号: ' + v[0], '', '【商品】', noLinks_(v[10]), '合計: ' + yen_(v[12]) + '（税込）　' + v[11] + '点', '', 'ご不明な点は、このメールにご返信ください。', '', shop]).join('\n');
  GmailApp.sendEmail(v[6], '【' + shop + '】' + subject + '（' + v[0] + '）', body, opt);
}
function saleSetStatus_(f, status) {
  f.sh.getRange(f.row, 16, 1, 2).setValues([[status, now_()]]);
  ledgerFromSale_(f.values);
}
function salePaidCommand_(arg) {
  const p = String(arg || '').trim().split(/\s+/);
  if (!p[0]) return '使い方: /paid 注文番号 [入金額]\n例: /paid S-261105-1234 225000';
  const f = saleFind_(p[0]);
  if (!f) return '販売注文が見つかりません: ' + p[0] + '\n注文番号を確認してください。未完了の注文は /orders で確認できます。';
  return salePaid_(f, num_(p[1]));
}
// A different amount stops here, so a short or wrong transfer is never confirmed to the customer by accident.
function salePaid_(f, amount) {
  const v = f.values;
  if (['キャンセル', '発送済', '受取済'].indexOf(v[15]) >= 0) return v[0] + ' は「' + v[15] + '」です。';
  if (v[15] === '来店待ち') return v[0] + ' は店頭払いの注文です。お渡ししたら: /status ' + v[0] + ' 受取済';
  if (v[19]) return v[0] + ' の入金確認メールは送信済みです。';
  if (amount && amount !== Number(v[12])) return '⚠️ 入金額 ' + yen_(amount) + ' がご請求額 ' + yen_(v[12]) + ' と違います。処理していません。\n確認してから /paid ' + v[0] + ' を送ってください。';
  saleSetStatus_(f, '入金確認');
  const next = v[2] === '配送'
    ? ['商品の発送準備を進めております。発送しましたら、追跡番号をメールでお知らせします。']
    : ['ご指定の店舗でお受け取りいただけます。', '受取店舗: ' + v[3], 'ご来店の際は、注文番号がわかるこのメールをご提示ください。'];
  try {
    saleMail_(v, 'ご入金を確認しました', ['ご入金を確認いたしました。ありがとうございます。', ''].concat(next));
  } catch (err) { console.error('paid mail', err); return '⚠️ ' + v[0] + ' は入金確認にしましたが、メールを送れませんでした: ' + err.message + '\n再送: /paid ' + v[0]; }
  f.sh.getRange(f.row, 20).setValue(now_());
  return '✅ ' + v[0] + ' 入金確認（' + yen_(v[12]) + '）\nお客様に確認メールを送りました。' + (v[2] === '配送' ? '\n発送したら: /ship ' + v[0] + ' 配送業者 追跡番号' : '\n受け渡したら: /status ' + v[0] + ' 受取済');
}
function saleShip_(arg) {
  const p = String(arg || '').trim().split(/\s+/);
  if (p.length < 3) return '使い方: ' + SHIP_USAGE;
  const f = saleFind_(p[0]); if (!f) return '販売注文が見つかりません: ' + p[0];
  const v = f.values;
  if (v[2] !== '配送') return v[0] + ' は店頭受取の注文です。受け渡したら: /status ' + v[0] + ' 受取済';
  if (['入金確認', '発送済'].indexOf(v[15]) < 0) return v[0] + ' は「' + v[15] + '」です。先に入金を確認してください: /paid ' + v[0];
  const c = CARRIERS.filter(function (x) { return x.match.test(p[1]); })[0];
  if (!c) return '配送業者が分かりません: ' + p[1] + '\n' + SHIP_USAGE;
  const no = p.slice(2).join('').normalize('NFKC').replace(/[-‐ー−]/g, '');
  if (!/^[A-Za-z0-9]{8,20}$/.test(no)) return '追跡番号の形式を確認してください: ' + p.slice(2).join(' ');
  const before = String(v[18] || '');
  if (before === no && v[20]) return v[0] + ' の追跡番号 ' + no + ' は送信済みです。';
  f.sh.getRange(f.row, 18, 1, 2).setNumberFormat('@').setValues([[c.name, no]]);
  saleSetStatus_(f, '発送済');
  const fix = before && before !== no ? ['先にお知らせした追跡番号に誤りがありました。正しい番号は次のとおりです。'] : ['ご注文の商品を発送いたしました。'];
  try {
    saleMail_(v, '商品を発送しました', fix.concat(['', '配送業者: ' + c.name, '追跡番号: ' + no, '配送状況の確認: ' + c.url + no, '', 'お届け先: ' + noLinks_(v[9]), '追跡情報が反映されるまで、少しお時間がかかる場合があります。']));
  } catch (err) { console.error('ship mail', err); return '⚠️ ' + v[0] + ' は発送済にしましたが、メールを送れませんでした: ' + err.message + '\n再送: /ship ' + v[0] + ' ' + p[1] + ' ' + no; }
  f.sh.getRange(f.row, 21).setValue(now_());
  return '📦 ' + v[0] + ' 発送済\n' + c.name + ' ' + no + '\nお客様に追跡番号をメールしました。';
}

/* ---------- protection ---------- */
const PRICE_NOTE = '\n\n※金額はお客様の画面から送信された値です。商品の価格と合っているか確認してから、入金確認・発送をしてください。';
// Spreadsheet cells: text that starts with = + - @ would run as a formula, so it is stored as plain text.
// A leading ' makes Sheets keep the text as typed: no formulas, and numbers that start with 0
// (phone 080…, account 0012…, postcode 060-…) keep their 0 instead of becoming 80…
function cellSafe_(v) { return typeof v === 'string' && (/^[=+\-@\t\r]/.test(v) || /^0[\d\s()-]*$/.test(v)) ? "'" + v : v; }
function safeRow_(row) { return row.map(cellSafe_); }
// Counter in the script cache: true while the key is under max hits in the window (max 6 hours).
function limit_(key, max, seconds) {
  const c = CacheService.getScriptCache(); const k = 'lim:' + key; const n = Number(c.get(k) || 0);
  if (n >= max) return false;
  c.put(k, String(n + 1), Math.min(seconds, 21600)); return true;
}
function idKey_(s) { return sha_(String(s || '').toLowerCase().replace(/\s+/g, '')).slice(0, 16); }
// Text typed into the public forms never carries links into emails we send to customers.
function noLinks_(s) {
  return String(s || '').replace(/(https?:\/\/|www\.)\S+/gi, '')
    .replace(/\b[\w-]+\.(com|net|org|jp|xyz|ru|cn|io|co|info|top|link|me|app|site|shop|biz|club|online)\b\S*/gi, '')
    .replace(/[ \t]{2,}/g, ' ').trim();
}
// Admin key for /register: separate from receipt links, created once and kept in Script properties.
function adminKey_() {
  let k = prop_('ADMIN_KEY');
  if (!k) { k = 'adm-' + Utilities.getUuid().replace(/-/g, ''); props_().setProperty('ADMIN_KEY', k); }
  return k;
}
// Receipt links carry a signature for that one receipt, so a forwarded link opens nothing else.
function receiptSig_(id) { return sha_(String(id) + '|' + prop_('RECEIPT_KEY')).slice(0, 32); }

/* ---------- product master (商品マスタ): RJP code ↔ model, synced from the site's data ---------- */
const MASTER_HEAD = ['RJPコード', '機種名', 'カテゴリー', 'JANコード', '買取（新品）', '買取（中古）'];
function masterTab_() { return tab_('商品マスタ', MASTER_HEAD); }
function masterNorm_(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
// finds a product by RJP code (RJP-000123, rjp123) or by exact model name
function masterFind_(text) {
  const v = masterTab_().getDataRange().getValues().slice(1);
  const c = String(text || '').trim().match(/^rjp-?(\d{1,6})$/i);
  const code = c ? 'RJP-' + ('00000' + c[1]).slice(-6) : '';
  const key = masterNorm_(text);
  for (let i = 0; i < v.length; i++) if (code ? v[i][0] === code : masterNorm_(v[i][1]) === key) return { rjp: v[i][0], name: v[i][1], isNew: Number(v[i][4]) || 0, used: Number(v[i][5]) || 0 };
  return null;
}
// the site's data is pushed here by work/sync-master.ps1; needs the admin key
function handleMaster_(b) {
  if (!limit_('master', 20, 3600)) return { ok: false, error: 'busy' };
  if (!b.key || b.key !== adminKey_()) return { ok: false, error: 'auth' };
  const rows = (Array.isArray(b.rows) ? b.rows : []).filter(function (r) { return Array.isArray(r) && /^RJP-\d+$/.test(r[0]); })
    .map(function (r) { return safeRow_([String(r[0]), String(r[1] || '').slice(0, 200), String(r[2] || '').slice(0, 40), String(r[3] || '').slice(0, 40), Number(r[4]) || '', Number(r[5]) || '']); });
  if (!rows.length) return { ok: false, error: 'empty' };
  const sh = masterTab_(); sh.clearContents();
  sh.getRange(1, 1, 1, MASTER_HEAD.length).setValues([MASTER_HEAD]).setFontWeight('bold');
  sh.getRange(2, 4, rows.length, 1).setNumberFormat('@');
  sh.getRange(2, 1, rows.length, MASTER_HEAD.length).setValues(rows);
  sh.getRange(2, 5, rows.length, 2).setNumberFormat('¥#,##0');
  sh.setFrozenRows(1); sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 360);
  return { ok: true, rows: rows.length };
}

/* ---------- sales log (売上記録): one row per product model, with its RJP code and price ---------- */
// Filled automatically: stock marked sold, and online orders once paid. Rows can also be typed in by hand.
const LEDGER_HEAD = ['日付', '月', '区分', 'ID', 'RJPコード', '機種名', '状態・カラー', '数量', '単価', '売上', '仕入原価', '粗利', 'メモ'];
function ledgerTab_() { return tab_('売上記録', LEDGER_HEAD); }
function monthKey_(d) { return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy') + '年' + Utilities.formatDate(d, 'Asia/Tokyo', 'MM') + '月分'; }
function ledgerRows_(id) {
  const out = []; if (!id) return out;
  const v = ledgerTab_().getRange('D:D').getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]).toUpperCase() === String(id).toUpperCase()) out.push(i + 1);
  return out;
}
// row = date, month, kind, id, rjp, model, cond, qty, unit, cost, memo
function ledgerWrite_(sh, r, x) {
  sh.getRange(r, 1, 1, 9).setValues([safeRow_(x.slice(0, 9))]);
  sh.getRange(r, 10).setFormula('=H' + r + '*I' + r);
  if (x[9] !== '' && x[9] != null) sh.getRange(r, 11).setValue(x[9]);
  sh.getRange(r, 12).setFormula('=IF(K' + r + '="","",J' + r + '-K' + r + ')');
  if (x[10]) sh.getRange(r, 13).setValue(cellSafe_(x[10]));
}
function ledgerAdd_(kind, id, rjp, model, cond, qty, unit, cost, memo) {
  const sh = ledgerTab_(); const hit = rjp ? null : masterFind_(model);
  ledgerWrite_(sh, sh.getLastRow() + 1, [today_(), monthKey_(new Date()), kind, id, rjp || (hit ? hit.rjp : ''), model, cond, qty, unit, cost === '' ? '' : cost, memo || '']);
}
// an online order counts as a sale once it is paid: its item lines become one row per model
function ledgerFromSale_(v) {
  if (ledgerRows_(v[0]).length) return;
  String(v[10]).split('\n').filter(String).forEach(function (line) {
    const m = line.match(/^(?:\[(RJP-\d+)\] )?(.+?)(?:（([^（）]*)）)? ×(\d+) ¥?([\d,]+)$/);
    if (m) ledgerAdd_('オンライン・' + v[2], v[0], m[1] || '', m[2], m[3] || '', Number(m[4]), num_(m[5]), '', '');
    else ledgerAdd_('オンライン・' + v[2], v[0], '', line, '', Number(v[11]) || 1, Number(v[12]) || 0, '', '');
  });
}
function ledgerVoid_(id) { const sh = ledgerTab_(); ledgerRows_(id).reverse().forEach(function (r) { sh.deleteRow(r); }); }
// /sold: a walk-in sale gets its own row; with an S- number, the item's cost goes on that order's matching model
function ledgerSold_(stockId, model, cond, price, cost, orderId, rjp) {
  if (orderId && !ledgerRows_(orderId).length) { const f = findById_(orderId); if (f && f.kind === 'sale') ledgerFromSale_(f.values); }
  const rows = ledgerRows_(orderId);
  if (rows.length) {
    const sh = ledgerTab_();
    const hit = rows.filter(function (r) { return rjp && sh.getRange(r, 5).getValue() === rjp; })[0] ||
      rows.filter(function (r) { return masterNorm_(sh.getRange(r, 6).getValue()) === masterNorm_(model); })[0] ||
      rows.filter(function (r) { return sh.getRange(r, 11).getValue() === ''; })[0] || rows[0];
    sh.getRange(hit, 11).setValue((Number(sh.getRange(hit, 11).getValue()) || 0) + cost);
    const memo = String(sh.getRange(hit, 13).getValue() || '');
    sh.getRange(hit, 13).setValue((memo ? memo + ' ' : '') + stockId);
    return;
  }
  ledgerAdd_('店頭', stockId, rjp || '', model, cond || '', 1, price, cost || '', '');
}

/* ---------- monthly totals (月次集計) ---------- */
function monthlyTab_() {
  const ss = book_(); let sh = ss.getSheetByName('月次集計');
  if (sh) return sh;
  ledgerTab_(); stockTab_();
  sh = ss.insertSheet('月次集計');
  sh.getRange('A1').setValue('月次集計').setFontSize(14).setFontWeight('bold');
  sh.getRange('A2').setValue('年（変更できます）'); sh.getRange('B2').setFormula('=YEAR(TODAY())');
  const head = ['月', '売上', '販売点数', '仕入原価', '粗利', '粗利率', '入荷額', '入荷点数', '経費（手入力）', '営業利益', 'メモ（手入力）'];
  sh.getRange(4, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#16233A').setFontColor('#FFFFFF');
  for (let m = 1; m <= 12; m++) {
    const r = m + 4;
    const key = '$B$2&"年"&TEXT(' + m + ',"00")&"月分"';
    const ym = '$B$2&"/"&TEXT(' + m + ',"00")';
    const stockOk = '(TEXT(在庫!$B$2:$B$3000,"yyyy/mm")=' + ym + ')*(在庫!$H$2:$H$3000<>"削除")';
    sh.getRange(r, 1).setValue(m + '月');
    sh.getRange(r, 2, 1, 7).setFormulas([[
      '=SUMIFS(売上記録!$J:$J,売上記録!$B:$B,' + key + ')',
      '=SUMIFS(売上記録!$H:$H,売上記録!$B:$B,' + key + ')',
      '=SUMIFS(売上記録!$K:$K,売上記録!$B:$B,' + key + ')',
      '=SUMIFS(売上記録!$L:$L,売上記録!$B:$B,' + key + ')',
      '=IF(B' + r + '=0,"",E' + r + '/B' + r + ')',
      '=SUMPRODUCT(' + stockOk + ',在庫!$E$2:$E$3000)',
      '=SUMPRODUCT(' + stockOk + ')'
    ]]);
    sh.getRange(r, 10).setFormula('=E' + r + '-N(I' + r + ')');
  }
  sh.getRange(17, 1).setValue('合計');
  ['B', 'C', 'D', 'E', 'G', 'H', 'I', 'J'].forEach(function (c) { sh.getRange(c + '17').setFormula('=SUM(' + c + '5:' + c + '16)'); });
  sh.getRange('F17').setFormula('=IF(B17=0,"",E17/B17)');
  sh.getRange('A17:K17').setFontWeight('bold').setBackground('#EAF2FB');
  ['B5:B17', 'D5:E17', 'G5:G17', 'I5:J17'].forEach(function (a) { sh.getRange(a).setNumberFormat('¥#,##0'); });
  sh.getRange('F5:F17').setNumberFormat('0.0%');
  sh.getRange('I5:I16').setBackground('#FFF9DB'); sh.getRange('K5:K16').setBackground('#FFF9DB');
  sh.getRange('A19').setValue('売上・粗利は「売上記録」から自動で集計されます。黄色の欄だけ手入力してください。粗利は仕入原価が入っている行だけで計算します。');
  sh.setFrozenRows(4); sh.setColumnWidth(1, 120); sh.setColumnWidths(2, 10, 96); sh.setColumnWidth(11, 220);
  return sh;
}

/* ---------- per-model totals (機種別集計) ---------- */
function modelTab_() {
  const ss = book_(); let sh = ss.getSheetByName('機種別集計');
  if (sh) return sh;
  ledgerTab_();
  sh = ss.insertSheet('機種別集計');
  sh.getRange('A1').setValue('機種別集計').setFontSize(14).setFontWeight('bold');
  sh.getRange('A2').setValue('年（変更できます）'); sh.getRange('B2').setFormula('=YEAR(TODAY())');
  sh.getRange('A3').setValue('月（空欄で1年分）');
  sh.getRange('B3').setBackground('#FFF9DB');
  sh.getRange('C2').setFormula('=B2&"年"&IF(B3="","",TEXT(B3,"00")&"月分")').setFontColor('#FFFFFF');
  const head = ['RJPコード', '機種名', '販売数', '売上', '平均単価', '最高単価', '最低単価', '仕入原価', '粗利', '粗利率'];
  sh.getRange(5, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#16233A').setFontColor('#FFFFFF');
  sh.getRange('A6').setValue('合計');
  sh.getRange('C6:D6').setFormulas([['=SUM(C7:C306)', '=SUM(D7:D306)']]);
  sh.getRange('H6:J6').setFormulas([['=SUM(H7:H306)', '=SUM(I7:I306)', '=IF(D6=0,"",I6/D6)']]);
  sh.getRange('A6:J6').setFontWeight('bold').setBackground('#EAF2FB');
  sh.getRange('B7').setFormula('=IFERROR(SORT(UNIQUE(FILTER(売上記録!$F$2:$F,ISNUMBER(SEARCH($C$2,売上記録!$B$2:$B))))),"")');
  const codes = [], rows = [];
  for (let r = 7; r <= 306; r++) {
    const c = '売上記録!$F:$F,$B' + r + ',売上記録!$B:$B,$C$2&"*"';
    const on = function (f) { return '=IF($B' + r + '="","",' + f + ')'; };
    codes.push([on('IFERROR(INDEX(売上記録!$E:$E,MATCH($B' + r + ',売上記録!$F:$F,0)),"")')]);
    rows.push([on('SUMIFS(売上記録!$H:$H,' + c + ')'), on('SUMIFS(売上記録!$J:$J,' + c + ')'), on('IF(C' + r + '=0,"",D' + r + '/C' + r + ')'),
      on('MAXIFS(売上記録!$I:$I,' + c + ')'), on('MINIFS(売上記録!$I:$I,' + c + ')'), on('SUMIFS(売上記録!$K:$K,' + c + ')'), on('SUMIFS(売上記録!$L:$L,' + c + ')'), on('IF(D' + r + '=0,"",I' + r + '/D' + r + ')')]);
  }
  sh.getRange(7, 1, codes.length, 1).setFormulas(codes);
  sh.getRange(7, 3, rows.length, 8).setFormulas(rows);
  sh.getRange('D6:I306').setNumberFormat('¥#,##0'); sh.getRange('J6:J306').setNumberFormat('0.0%');
  sh.setFrozenRows(6); sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 300); sh.setColumnWidths(3, 8, 96);
  return sh;
}
// earlier log layout (no RJP column) → current layout; existing rows and typed-in 経費/メモ are kept
function ledgerUpgrade_() {
  const ss = book_(); const old = ss.getSheetByName('売上記録');
  if (old && old.getRange(1, 5).getValue() === '機種名') {
    const rows = old.getDataRange().getValues().slice(1);
    old.clear();
    old.getRange(1, 1, 1, LEDGER_HEAD.length).setValues([LEDGER_HEAD]);
    rows.forEach(function (r, i) { const hit = masterFind_(r[4]); ledgerWrite_(old, i + 2, [r[0], r[1], r[2], r[3], hit ? hit.rjp : '', r[4], r[5], r[6], r[7], r[9], r[11]]); });
    const mon = ss.getSheetByName('月次集計'); const kept = mon ? mon.getRange('I5:K16').getValues() : [];
    if (mon) ss.deleteSheet(mon);
    const fresh = monthlyTab_();
    kept.forEach(function (k, i) { if (k[0] !== '') fresh.getRange(i + 5, 9).setValue(k[0]); if (k[2] !== '') fresh.getRange(i + 5, 11).setValue(k[2]); });
    const mod = ss.getSheetByName('機種別集計'); if (mod) ss.deleteSheet(mod);
    console.log('Sales log upgraded: ' + rows.length + ' row(s) kept.');
  }
  const sh = ledgerTab_();
  sh.getRange('I:L').setNumberFormat('¥#,##0'); sh.setFrozenRows(1); sh.setColumnWidth(5, 110); sh.setColumnWidth(6, 280); sh.setColumnWidth(7, 150);
  sh.getRange(1, 1, 1, LEDGER_HEAD.length).setFontWeight('bold');
}
function monthText_(arg) {
  const m = String(arg || '').match(/(\d{4})\D+(\d{1,2})/);
  const d = new Date(); const prev = /^(last|先月)$/i.test(String(arg || '').trim());
  if (prev) d.setDate(1), d.setMonth(d.getMonth() - 1);
  const key = m ? m[1] + '年' + ('0' + m[2]).slice(-2) + '月分' : monthKey_(d);
  const rows = ledgerTab_().getDataRange().getValues().slice(1).filter(function (r) { return r[1] === key; });
  const sum = function (c) { return rows.reduce(function (a, r) { return a + (Number(r[c]) || 0); }, 0); };
  const sales = sum(9), gross = sum(11), noCost = rows.filter(function (r) { return r[10] === ''; }).length;
  const by = {}; rows.forEach(function (r) { const k = (r[4] ? r[4] + ' ' : '') + r[5]; by[k] = by[k] || { q: 0, s: 0 }; by[k].q += Number(r[7]) || 0; by[k].s += Number(r[9]) || 0; });
  const top = Object.keys(by).sort(function (a, b) { return by[b].s - by[a].s; }).slice(0, 5).map(function (k) { return '・' + k + ' ×' + by[k].q + ' ' + yen_(by[k].s); });
  return ['📈 ' + key, '売上: ' + yen_(sales) + '（' + sum(7) + '点）', '仕入原価: ' + yen_(sum(10)), '粗利: ' + yen_(gross) + (sales ? '（' + Math.round(gross / sales * 100) + '%）' : '')]
    .concat(noCost ? ['※原価が未入力の行: ' + noCost + '件'] : []).concat(top.length ? ['', '【売上上位の機種】'].concat(top) : []).join('\n');
}
// /model iPhone 15 or /model RJP-000005: what each matching model has sold for, across all months
function modelText_(q) {
  const key = masterNorm_(q);
  if (!key) return '使い方: /model 機種名 または RJPコード（例: /model iPhone 15、/model RJP-000005）';
  const by = {};
  ledgerTab_().getDataRange().getValues().slice(1).forEach(function (r) {
    if (masterNorm_(r[5] + ' ' + r[4]).indexOf(key) < 0) return;
    const k = (r[4] ? r[4] + ' ' : '') + r[5];
    const b = by[k] = by[k] || { q: 0, s: 0, g: 0, hi: 0, lo: 0 }; const u = Number(r[8]) || 0;
    b.q += Number(r[7]) || 0; b.s += Number(r[9]) || 0; b.g += Number(r[11]) || 0; b.hi = Math.max(b.hi, u); b.lo = b.lo ? Math.min(b.lo, u) : u;
  });
  const keys = Object.keys(by).sort(); if (!keys.length) return '「' + q + '」の販売記録はありません。';
  return keys.slice(0, 20).map(function (k) { const b = by[k]; return k + '\n　' + b.q + '点　売上 ' + yen_(b.s) + '　単価 ' + yen_(b.lo) + '〜' + yen_(b.hi) + '　粗利 ' + yen_(b.g); }).join('\n');
}

/* ---------- Excel file ---------- */
// Only the sales log, per-model and monthly totals, and stock go in the file: customer tabs are left out on purpose.
function excelBlob_() {
  masterTab_(); monthlyTab_(); modelTab_();
  const src = book_(); const temp = SpreadsheetApp.create('売上帳（一時）');
  try {
    const first = temp.getSheets()[0];
    ['商品マスタ', '在庫', '売上記録', '機種別集計', '月次集計'].forEach(function (n) { src.getSheetByName(n).copyTo(temp).setName(n); });
    temp.deleteSheet(first);
    temp.setActiveSheet(temp.getSheetByName('月次集計')); temp.moveActiveSheet(1);
    temp.setActiveSheet(temp.getSheetByName('機種別集計')); temp.moveActiveSheet(2);
    SpreadsheetApp.flush();
    const res = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + temp.getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('export ' + res.getResponseCode());
    return res.getBlob().setName('Kaitorinihon_sales_' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd') + '.xlsx');
  } finally { DriveApp.getFileById(temp.getId()).setTrashed(true); }
}
/** Runs on the 1st of each month: last month's numbers + the Excel file, by email and to the stock bot. */
function monthlyReport() {
  const text = monthText_('last'); const blob = excelBlob_(); const shop = prop_('SHOP_NAME', '買取日本');
  const to = prop_('NOTIFY_EMAIL');
  if (to) GmailApp.sendEmail(to, '【' + shop + '】月次レポート', text + '\n\nExcelファイルを添付しました。', { attachments: [blob], name: shop });
  stockChats_().forEach(function (c) { stockSend_(text, c); stockTg_('sendDocument', { chat_id: c, document: blob }); });
}

/* ---------- stock bot: a second Telegram bot that sees stock and sales numbers only, never customers ---------- */
function stockTg_(method, payload) { return UrlFetchApp.fetch('https://api.telegram.org/bot' + prop_('STOCK_BOT_TOKEN') + '/' + method, { method: 'post', payload: payload, muteHttpExceptions: true }); }
function stockChats_() { return prop_('STOCK_CHAT_ID').split(',').map(function (x) { return x.trim(); }).filter(String); }
function stockSend_(text, chat) {
  for (let i = 0; i < text.length; i += 3900) {
    const r = stockTg_('sendMessage', { chat_id: chat, text: text.slice(i, i + 3900) });
    if (r.getResponseCode() !== 200) console.error('Stock bot reply failed: ' + r.getContentText().slice(0, 200));
  }
}
function stockKey_() {
  let k = prop_('STOCK_KEY');
  if (!k) { k = 'stk-' + Utilities.getUuid().replace(/-/g, '').slice(0, 20); props_().setProperty('STOCK_KEY', k); }
  return k;
}
/** Runs every minute: reads the stock bot's messages. Does nothing until STOCK_BOT_TOKEN is saved. */
function pollStockBot() {
  if (!prop_('STOCK_BOT_TOKEN')) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const offset = Number(prop_('STOCK_TG_OFFSET', '0')) || 0;
    const res = JSON.parse(stockTg_('getUpdates', { offset: String(offset), timeout: '0', allowed_updates: '["message"]' }).getContentText());
    if (!res.ok) { console.log('Stock bot error: ' + res.description); return; }
    let next = offset;
    (res.result || []).forEach(function (u) {
      next = Math.max(next, u.update_id + 1);
      const m = u.message; if (!m || !m.text) return;
      const chat = String(m.chat.id);
      console.log('Stock bot got: ' + commandLog_(m.text) + ' / registered chat: ' + (stockChats_().indexOf(chat) >= 0));
      try { stockCommand_(m.text.trim(), chat); } catch (err) { console.error(err); stockSend_('エラー: ' + err.message, chat); }
    });
    if (next !== offset) props_().setProperty('STOCK_TG_OFFSET', String(next));
  } finally { lock.releaseLock(); }
}
// phones capitalise words and the slash is easy to miss; a message starting with an RJP code means stock in
function stockNorm_(text) {
  return String(text).normalize('NFKC').trim()
    .replace(/^\/?(in|stock|price|sold|del|month|model|excel|help)(?=\s|@|$)/i, function (x, w) { return '/' + w.toLowerCase(); })
    .replace(/^(?!\/)(?=(?:.*\s)?rjp-?\d{1,6}(?:\s|$))/i, '/in ');
}
function stockCommand_(text, chat) {
  text = stockNorm_(text);
  const cmd = (text.match(/^\/(\w+)/) || [])[1];
  const arg = text.replace(/^\/\w+(@\w+)?\s*/, '');
  // the key may arrive alone or with full-width or hidden characters from copy-paste
  const sent = (cmd === 'register' ? arg : text).normalize('NFKC').replace(/[^\w-]/g, '');
  if (sent === stockKey_()) {
    const list = stockChats_(); if (list.indexOf(chat) < 0) list.push(chat);
    props_().setProperty('STOCK_CHAT_ID', list.join(','));
    return stockSend_('✅ 在庫ボットに登録しました。/help でコマンド一覧を表示します。', chat);
  }
  if (cmd === 'register') {
    if (!limit_('sreg:' + chat, 5, 3600)) return;   // too many wrong keys from this chat
    if (sent.indexOf('adm-') === 0) return stockSend_('それは注文ボット用のキーです。在庫ボットのキーは stk- で始まります。', chat);
    return stockSend_('登録キーが違います（受け取った文字数: ' + sent.length + '、正しいキーは24文字で stk- で始まります）。', chat);
  }
  if (stockChats_().indexOf(chat) < 0) return stockSend_('このチャットは未登録です。/register 登録キー を送ってください。', chat);
  switch (cmd) {
    case 'start': case 'help': return stockSend_(stockHelp_(), chat);
    case 'in': return stockSend_(stockBotIn_(arg), chat);
    case 'stock': return stockSend_(stockBotList_(arg), chat);
    case 'price': return stockSend_(stockPrice_(arg), chat);
    case 'sold': return stockSend_(stockSold_(arg), chat);
    case 'del': return stockSend_(stockDel_(arg), chat);
    case 'month': return stockSend_(monthText_(arg), chat);
    case 'model': return stockSend_(modelText_(arg), chat);
    case 'excel': stockSend_('Excelを作成しています…', chat); return stockTg_('sendDocument', { chat_id: chat, document: excelBlob_() });
    default: return stockSend_('コマンドが分かりません。/help で一覧を表示します。', chat);
  }
}
function stockHelp_() {
  return ['📦 在庫ボット',
    '/in RJPコード カラー 状態 — 1行で入荷（/in は省略可）',
    '　例: RJP-000005 ブラック 新品',
    '　価格も続けて書けます: RJP-000005 ブラック 新品 190000 225000',
    '　（数字は 買取価格→販売価格の順。買取価格を省くと掲載価格を使います）',
    '　コードがない商品: /in 商品名 | 状態 | 買取価格 | 販売価格 | メモ',
    '/stock [検索語] — 在庫一覧（全店共通）',
    '/price ST0001 140000 — 販売価格を変更（同じ商品・同じ状態の在庫すべて）',
    '/sold ST0001 [販売価格] — 店頭で販売（売上記録に自動で追加）',
    '/sold ST0001 S-261104-1234 — オンライン注文の商品として出庫（原価を記録）',
    '/del ST0001 — 間違えて登録した在庫を削除',
    '/month [2026/11] — 月の売上と粗利、売上上位の機種',
    '/model iPhone 15 または RJP-000005 — 機種ごとの販売数・単価・粗利',
    '/excel — 売上帳のExcelファイルを送信'].join('\n');
}
// one line, any order: RJP-000005 ブラック 新品 190000 225000
// numbers are the buy then selling price, the first other word is the colour, the rest is a memo
function stockLine_(arg) {
  const w = String(arg).normalize('NFKC').trim().split(/\s+/);
  const at = w.findIndex(function (t) { return /^rjp-?\d{1,6}$/i.test(t); });
  if (arg.indexOf('|') >= 0 || at < 0) return null;
  const r = { code: w[at], cond: '', color: '', nums: [], memo: [] };
  w.filter(function (t, i) { return i !== at; }).forEach(function (t) {
    const n = t.replace(/[¥,円]/g, '');
    if (/^\d+$/.test(n) && r.nums.length < 2) r.nums.push(n);
    else if (!r.cond && /^(新品|未開封|未使用|開封未使用|ジャンク|中古[a-dsA-DS]?)$/.test(t)) r.cond = t;
    else if (/(店|倉庫)$/.test(t)) r.memo.push(t);
    else if (!r.color) r.color = t;
    else r.memo.push(t);
  });
  return r;
}
function stockBotIn_(arg) {
  const one = stockLine_(arg);
  const p = one ? [one.code, [one.cond, one.color].filter(String).join('・'), one.nums[0] || '', one.nums[1] || '', one.memo.join(' ')] : arg.split('|').map(function (x) { return x.trim(); });
  if (!p[0]) return '使い方: /in RJPコード カラー 状態（例: /in RJP-000005 ブラック 新品）\n価格も続けて書けます: /in RJP-000005 ブラック 新品 190000 225000';
  const hit = masterFind_(p[0]);
  if (!hit && /^rjp/i.test(p[0])) return 'そのRJPコードは商品マスタにありません: ' + p[0];
  if (hit) p[0] = hit.name;
  const rjp = hit ? hit.rjp : '';
  // no buy price typed: use the site's listed buy price for that condition, and say so in the reply
  let listed = false;
  if (one && hit && !p[2]) { const q = /^中古/.test(one.cond) ? hit.used : /^(新品|未開封)$/.test(one.cond) ? hit.isNew : ''; if (q) { p[2] = q; listed = true; } }
  const n = Number(prop_('STOCK_SEQ', '0')) + 1; props_().setProperty('STOCK_SEQ', String(n));
  const id = 'ST' + ('000' + n).slice(-4);
  stockTab_().appendRow(safeRow_([id, today_(), p[0], p[1] || '', num_(p[2]) || '', num_(p[3]) || '', p[4] || '', '在庫', '', '', '', rjp]));
  return '✅ 入荷: ' + id + (rjp ? ' [' + rjp + ']' : '') + ' ' + p[0] + (p[1] ? '（' + p[1] + '）' : '') + (p[2] ? '\n買取 ' + yen_(num_(p[2])) + (listed ? '（掲載価格）' : '') : '') + (p[3] ? '　販売 ' + yen_(num_(p[3])) : '');
}
// stock is shared across all stores, so there is one list with no locations
function stockBotList_(q) {
  const key = String(q || '').toLowerCase().replace(/\s+/g, ''); const lines = []; let cost = 0, value = 0;
  stockTab_().getDataRange().getValues().slice(1).forEach(function (r) {
    if (r[7] !== '在庫') return;
    if (key && String(r[2] + r[11]).toLowerCase().replace(/\s+/g, '').indexOf(key) < 0) return;
    lines.push(r[0] + (r[11] ? ' [' + r[11] + ']' : '') + ' ' + r[2] + (r[3] ? '（' + r[3] + '）' : '') + (r[5] ? ' ' + yen_(r[5]) : ''));
    cost += Number(r[4]) || 0; value += Number(r[5]) || 0;
  });
  if (!lines.length) return key ? '「' + q + '」の在庫はありません。' : '在庫はありません。/in で追加できます。';
  return '📦 在庫 ' + lines.length + '点\n' + lines.join('\n') + '\n\n仕入合計 ' + yen_(cost) + '　販売予定合計 ' + yen_(value);
}
function stockPrice_(arg) {
  const m = arg.split(/\s+/); const r = stockRow_(m[0]); const p = num_(m[1]);
  if (!r || !p) return '使い方: /price 在庫ID 販売価格';
  // one price per product and condition: every unit still in stock with the same code (or name) and 状態 changes together
  const same = function (x) { return String(x[11] || x[2]) === String(r.v[11] || r.v[2]) && String(x[3]) === String(r.v[3]); };
  const ids = [];
  r.sh.getDataRange().getValues().forEach(function (x, i) { if (i && x[7] === '在庫' && same(x)) { r.sh.getRange(i + 1, 6).setValue(p); ids.push(x[0]); } });
  if (ids.indexOf(r.v[0]) < 0) r.sh.getRange(r.row, 6).setValue(p);
  return '✅ ' + r.v[2] + (r.v[3] ? '（' + r.v[3] + '）' : '') + ' 販売価格 ' + yen_(p) + (ids.length > 1 ? '\n' + ids.length + '点すべて変更: ' + ids.join(', ') : '\n' + r.v[0]);
}
/** Safe to run again: creates the new tabs, the stock key and the two scheduled jobs. */
function setupStockBot() {
  ledgerUpgrade_(); monthlyTab_(); modelTab_();
  masterTab_();
  const sh = stockTab_(); sh.hideColumns(11);   // 保管場所 is no longer used; the column stays so RJPコード keeps its place
  if (!sh.getRange(1, 12).getValue()) sh.getRange(1, 12).setValue('RJPコード');
  console.log('STOCK_KEY (for the stock bot /register): ' + stockKey_());
  const have = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  if (have.indexOf('pollStockBot') < 0) ScriptApp.newTrigger('pollStockBot').timeBased().everyMinutes(1).create();
  if (have.indexOf('monthlyReport') < 0) ScriptApp.newTrigger('monthlyReport').timeBased().onMonthDay(1).atHour(9).inTimezone('Asia/Tokyo').create();
  if (prop_('STOCK_BOT_TOKEN')) { const r = JSON.parse(stockTg_('getMe', {}).getContentText()); console.log('Stock bot: ' + (r.ok ? 'OK @' + r.result.username : r.description)); } else console.log('Stock bot: token not saved yet.');
}
/** Test: one temporary sale through the log and totals, then removed; emails a sample Excel file. */
function stockBotSelfTest() {
  setupStockBot();
  const id = 'TEST-' + Date.now(); const sh = monthlyTab_(); const m = Number(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'M')); const r = m + 4;
  const before = Number(sh.getRange(r, 2).getValue()) || 0;
  ledgerAdd_('店頭', id, '', 'テスト商品', '', 1, 100000, 80000, ''); SpreadsheetApp.flush();
  console.log('sales +' + ((Number(sh.getRange(r, 2).getValue()) || 0) - before) + ' (expect 100000); gross ' + sh.getRange(r, 5).getValue() + '; rate ' + sh.getRange(r, 6).getValue());
  ledgerVoid_(id); SpreadsheetApp.flush();
  console.log('after removing: sales +' + ((Number(sh.getRange(r, 2).getValue()) || 0) - before) + ' (expect 0)');
  console.log(monthText_(''));
  const blob = excelBlob_(); console.log('excel bytes: ' + blob.getBytes().length + ' name: ' + blob.getName());
  const to = prop_('NOTIFY_EMAIL'); if (to) { GmailApp.sendEmail(to, '【' + prop_('SHOP_NAME', '買取日本') + '】売上帳Excel（サンプル）', 'これが毎月1日に届くExcelファイルのサンプルです。', { attachments: [blob] }); console.log('sample emailed'); }
}
