/**
 * 買取日本 — 会員ログイン (same Apps Script project as Code.gs / Bot.gs)
 *
 * Password-free sign-in: the customer enters their email, receives a 6-digit code by email,
 * and enters it on the site. No passwords are stored. Members live in the 会員 tab.
 *
 * The site POSTs {kind: ...}:
 *   auth_start  {email}                       → emails a code (valid 10 min, 5 tries)
 *   auth_verify {email, code}                 → {token, member}   (token valid 30 days)
 *   me          {token}                       → {member, orders, requests}
 *   profile     {token, name, kana, tel, zip, addr}
 *   logout      {token}
 */

const SESSION_DAYS = 30;

function membersTab_() { return tab_('会員', ['会員ID', '登録日', 'メール', 'お名前', 'フリガナ', '電話', '郵便番号', '住所', '最終ログイン', 'トークン', 'トークン期限']); }
function sha_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function normEmail_(e) { return String(e || '').trim().toLowerCase().slice(0, 120); }
function validEmail_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function findMember_(pred) {
  const sh = membersTab_(); const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (pred(v[i])) return { sh: sh, row: i + 1, v: v[i] };
  return null;
}
function memberOut_(v) { return { id: v[0], email: v[2], name: v[3], kana: v[4], tel: v[5], zip: v[6], addr: v[7] }; }
function byToken_(token) {
  if (!token || String(token).length < 20) return null;
  const h = sha_(String(token));
  const m = findMember_(function (r) { return r[9] === h; });
  if (!m) return null;
  const exp = m.v[10] instanceof Date ? m.v[10].getTime() : Date.parse(m.v[10]);
  return exp && exp > Date.now() ? m : null;
}

function handleMember_(b) {
  const c = CacheService.getScriptCache();
  const s = function (v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n || 120); };

  if (b.kind === 'auth_start') {
    const email = normEmail_(b.email);
    if (!validEmail_(email)) return { ok: false, error: 'email' };
    if (c.get('cool:' + email)) return { ok: false, error: 'wait' };
    if (!limit_('auth:all', 40, 3600) || !limit_('auth:' + idKey_(email), 6, 21600)) return { ok: false, error: 'wait' };
    const code = String(Math.floor(100000 + Math.random() * 900000));
    c.put('otp:' + email, JSON.stringify({ h: sha_(code + email), t: 0 }), 600);
    c.put('cool:' + email, '1', 60);
    const shop = prop_('SHOP_NAME', '買取日本');
    GmailApp.sendEmail(email, '【' + shop + '】ログイン確認コード ' + code,
      shop + ' のログイン確認コードです。\n\n' + code + '\n\nこのコードは10分間有効です。お心当たりがない場合は、このメールを破棄してください。',
      { name: shop });
    return { ok: true };
  }

  if (b.kind === 'auth_verify') {
    const email = normEmail_(b.email); const code = String(b.code || '').replace(/\D/g, '');
    const raw = c.get('otp:' + email);
    if (!raw) return { ok: false, error: 'expired' };
    const o = JSON.parse(raw);
    if (o.t >= 5) { c.remove('otp:' + email); return { ok: false, error: 'expired' }; }
    if (sha_(code + email) !== o.h) { o.t++; c.put('otp:' + email, JSON.stringify(o), 600); return { ok: false, error: 'code' }; }
    c.remove('otp:' + email);
    const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
    const exp = new Date(Date.now() + SESSION_DAYS * 864e5);
    let m = findMember_(function (r) { return String(r[2]).toLowerCase() === email; });
    if (!m) {
      const n = Number(prop_('MEMBER_SEQ', '0')) + 1; props_().setProperty('MEMBER_SEQ', String(n));
      membersTab_().appendRow(safeRow_(['M' + ('0000' + n).slice(-5), now_(), email, '', '', '', '', '', now_(), sha_(token), exp]));
      m = findMember_(function (r) { return String(r[2]).toLowerCase() === email; });
      try { tgSend_('👤 新規会員登録\n' + m.v[0] + ' ' + email); } catch (e) {}
    } else {
      m.sh.getRange(m.row, 9, 1, 3).setValues([[now_(), sha_(token), exp]]);
      m.v[8] = now_();
    }
    return { ok: true, token: token, member: memberOut_(m.v) };
  }

  const m = byToken_(b.token);
  if (!m) return { ok: false, error: 'auth' };

  if (b.kind === 'me') {
    const email = String(m.v[2]).toLowerCase();
    const orders = ordersTab_().getDataRange().getValues().slice(1)
      .filter(function (r) { return String(r[5]).toLowerCase() === email; })
      .slice(-20).reverse()
      .map(function (r) { return { id: r[0], date: String(r[1]), way: r[2], items: String(r[9]), total: Number(r[11]) || 0, status: r[13] }; })
      .concat(salesTab_().getDataRange().getValues().slice(1)
        .filter(function (r) { return String(r[6]).toLowerCase() === email; })
        .slice(-20).reverse()
        .map(function (r) { return { id: r[0], date: String(r[1]), way: '購入・' + r[2], items: String(r[10]), total: Number(r[12]) || 0, status: r[15] }; }))
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    const requests = sheet_().getDataRange().getValues().slice(1)
      .filter(function (r) { return String(r[9]).toLowerCase().indexOf(email) >= 0; })
      .slice(-20).reverse()
      .map(function (r) { return { id: r[0], date: String(r[1]), name: r[2], status: r[12] }; });
    return { ok: true, member: memberOut_(m.v), orders: orders, requests: requests };
  }

  if (b.kind === 'profile') {
    const vals = [s(b.name, 80), s(b.kana, 80), s(b.tel, 40), s(b.zip, 10), s(b.addr, 200)];
    m.sh.getRange(m.row, 4, 1, 5).setValues([safeRow_(vals)]);
    m.v[3] = vals[0]; m.v[4] = vals[1]; m.v[5] = vals[2]; m.v[6] = vals[3]; m.v[7] = vals[4];
    return { ok: true, member: memberOut_(m.v) };
  }

  if (b.kind === 'logout') {
    m.sh.getRange(m.row, 10, 1, 2).setValues([['', '']]);
    return { ok: true };
  }
  return { ok: false, error: 'kind' };
}
