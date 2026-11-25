// Draws every logo as SVG, then renders PNGs at each platform's size with the installed Chrome or Edge.
// First run glyphs.ps1 (makes glyphs.json), then: node logos/source/build.js
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), { spawn } = require('child_process');
const OUT = path.resolve(__dirname, '..'), G = require('./glyphs.json');
const C = { blue: '#3E8EE0', strong: '#2C74C4', ink: '#16233A', red: '#E0475F', white: '#FFFFFF', muted: '#6B7890', sky: '#7DB8F2' };
let uid = 0;

// ---------- lettering (outlines, so no font is needed to open the files) ----------
function text(str, { size = 100, w = 900, track = 0, x = 0, y = 0, fill = C.ink, anchor = 'start' } = {}) {
  const k = size / 1000, gl = [...str].map(c => { const g = G[w][c.codePointAt(0)]; if (!g) throw new Error('no glyph ' + c); return g; });
  const width = gl.reduce((s, g) => s + g[0] * k, 0) + track * size * (gl.length - 1);
  let px = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x, s = '';
  for (const g of gl) { if (g[1]) s += `<path transform="translate(${px.toFixed(2)} ${y}) scale(${k})" d="${g[1]}"/>`; px += g[0] * k + track * size; }
  return { svg: `<g fill="${fill}">${s}</g>`, width };
}
const fitTrack = (str, size, w, target) => (target - text(str, { size, w }).width) / (size * ([...str].length - 1));
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
function grad(a, b) { const id = 'g' + (++uid); return [`<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`, `url(#${id})`]; }

// ---------- marks, each in a 512 box and readable inside a circle crop ----------
// cut = the colour that shows through openings
const TAG = 'M6 9a3 3 0 0 1 3-3h16.2a4 4 0 0 1 2.83 1.17l14.8 14.8a4 4 0 0 1 0 5.66L29.63 40.83a4 4 0 0 1-5.66 0L7.17 24.03A4 4 0 0 1 6 21.2Z';
const marks = {
  A: p => `<g transform="translate(256 256) scale(8.6) translate(-25.4 -24.6)"><path d="${TAG}" fill="${p.fg}"/><circle cx="15.6" cy="15.6" r="3.9" fill="${p.accent}"/></g>${text('¥', { size: 182, x: 283, y: 345, fill: p.cut, anchor: 'middle' }).svg}`,
  B: p => `<rect x="112" y="96" width="112" height="320" rx="30" fill="${p.fg}"/><rect x="131" y="136" width="74" height="222" rx="8" fill="${p.cut}"/><rect x="149" y="381" width="38" height="11" rx="5.5" fill="${p.cut}"/><path d="M250 262L376 136" stroke="${p.fg2}" stroke-width="56" fill="none"/><path d="M292 96H400a16 16 0 0 1 16 16V220Z" fill="${p.fg2}"/><path d="M299 249L412 416H330L249 296Z" fill="${p.accent}"/>`,
  C: p => `<circle cx="256" cy="256" r="196" fill="${p.accent}"/>${text('買', { size: 262, x: 256, y: 353, fill: p.cut, anchor: 'middle' }).svg}`,
  D: p => `${text('買取', { size: 150, x: 250, y: 246, fill: p.fg, anchor: 'middle' }).svg}${text('日本', { size: 150, x: 250, y: 396, fill: p.fg2, anchor: 'middle' }).svg}<circle cx="404" cy="91" r="18" fill="${p.accent}"/>`
};
const themes = {
  A: { bg: [C.blue, C.strong], p: { fg: C.white, accent: C.red, cut: C.strong } },
  B: { bg: [C.white, '#E4EFFB'], p: { fg: C.ink, fg2: C.blue, accent: C.ink, cut: C.white } },
  C: { bg: [C.white, C.white], p: { accent: C.red, cut: C.white } },
  D: { bg: ['#1D2E4C', C.ink], p: { fg: C.white, fg2: C.sky, accent: C.red } }
};
function icon(k, round) {
  const [def, url] = grad(...themes[k].bg);
  return svg(512, 512, `${def}<rect width="512" height="512" rx="${round ? 112 : 0}" fill="${url}"/>${marks[k](themes[k].p)}`);
}
const MONO = { A: { fg: '#000', accent: '#fff', cut: '#fff' }, B: { fg: '#000', fg2: '#000', accent: '#000', cut: '#fff' }, C: { accent: '#000', cut: '#fff' }, D: { fg: '#000', fg2: '#000', accent: '#000' } };
const mono = k => svg(512, 512, marks[k](MONO[k]));

// ---------- horizontal logos (200 high, transparent) ----------
function lockup(k, dark) {
  const ink = dark ? C.white : C.ink, sub = dark ? '#B9CDE6' : C.muted;
  if (k === 'D') {
    const a = text('買取', { size: 118, x: 26, y: 126, fill: dark ? C.ink : C.white }), plate = a.width + 52, x2 = plate + 18;
    const b = text('日本', { size: 118, x: x2, y: 126, fill: dark ? C.sky : C.strong }), end = x2 + b.width;
    return { w: end + 34, h: 200, body: `<rect y="12" width="${plate}" height="142" rx="18" fill="${dark ? C.white : C.ink}"/>${a.svg}${b.svg}<circle cx="${end + 16}" cy="28" r="14" fill="${C.red}"/>${text('KAITORINIHON', { size: 27, w: 700, track: fitTrack('KAITORINIHON', 27, 700, end - 4), x: 2, y: 192, fill: sub }).svg}` };
  }
  let m;
  if (k === 'C') m = `<g transform="translate(-28 -28) scale(.5)">${marks.C(themes.C.p)}</g>`;
  else if (k === 'A') m = `<g transform="translate(-36 -38) scale(.54)">${marks.A(dark ? { fg: C.white, accent: C.red, cut: C.strong } : { fg: C.blue, accent: C.red, cut: C.white })}</g>`;
  else m = `<g transform="translate(-56 -48) scale(.58)">${marks.B(dark ? { fg: C.white, fg2: C.sky, accent: C.white, cut: C.ink } : themes.B.p)}</g>`;
  const x = k === 'C' ? 232 : k === 'A' ? 226 : 214, a = text('買取日本', { size: 124, track: .02, x, y: 124, fill: ink });
  return { w: x + a.width + 6, h: 200, body: `${m}${a.svg}${text('KAITORINIHON', { size: 29, w: 700, track: fitTrack('KAITORINIHON', 29, 700, a.width - 10), x: x + 5, y: 184, fill: sub }).svg}` };
}
const lockSvg = (k, dark) => { const l = lockup(k, dark); return svg(Math.ceil(l.w), l.h, l.body); };

// ---------- covers: everything important stays inside the safe box in the middle ----------
function cover(k, W, H, safeW, safeH) {
  const dark = k === 'A' || k === 'D', [def, url] = grad(...(k === 'C' ? [C.white, '#FBF1F3'] : themes[k].bg));
  const l = lockup(k, dark), tg = 'スマホ・ゲーム高価買取・現金即払い', dw = Math.max(l.w, text(tg, { size: 44, w: 700 }).width), dh = 356, s = Math.min(safeW / dw, safeH / dh);
  const ghostP = { A: { fg: C.white, accent: C.strong, cut: C.strong }, B: { fg: C.ink, fg2: C.blue, accent: C.ink, cut: '#EEF5FC' }, C: { accent: C.red, cut: C.white }, D: { fg: C.white, fg2: C.white, accent: C.white } }[k];
  const narrow = W / H < 1.6, big = H * (narrow ? .9 : 1.3), gx = W - big * (narrow ? .42 : .7), gy = narrow ? H - big * .62 : (H - big) / 2, ink = dark ? C.white : C.ink, sub = dark ? '#DCE9F8' : C.muted;
  return svg(W, H, `${def}<rect width="${W}" height="${H}" fill="${url}"/><g opacity="${dark ? .08 : .06}" transform="translate(${gx} ${gy}) scale(${big / 512})">${marks[k](ghostP)}</g>` +
    `<g transform="translate(${W / 2} ${H / 2 - dh * s / 2}) scale(${s})"><g transform="translate(${-l.w / 2} 0)">${l.body}</g>${text(tg, { size: 44, w: 700, y: 284, fill: ink, anchor: 'middle' }).svg}${text('kaitorinihon.jp', { size: 34, w: 500, track: .03, y: 346, fill: sub, anchor: 'middle' }).svg}</g>`);
}

// ---------- what each platform takes ----------
const NAMES = { A: 'A-price-tag', B: 'B-k-phone', C: 'C-rising-sun', D: 'D-shop-sign' };
const AVATARS = [['instagram', 1080], ['tiktok', 1080], ['youtube', 800], ['x', 400], ['facebook', 720], ['line', 640], ['telegram', 640], ['google-business', 720]];
const COVERS = [['youtube', 'banner', 2560, 1440, 1400, 390], ['x', 'header', 1500, 500, 1000, 330], ['facebook', 'cover', 1640, 624, 1060, 430], ['line', 'cover', 1080, 878, 860, 460], ['google-business', 'cover', 1024, 576, 800, 400], ['website', 'share-preview', 1200, 630, 940, 430]];
const jobs = [];
const save = (rel, s) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const png = (file, s, w, h) => jobs.push({ file, svg: s, w: Math.round(w), h: Math.round(h) });
for (const k of 'ABCD') {
  const d = NAMES[k];
  save(`${d}/vector/icon.svg`, icon(k)); save(`${d}/vector/icon-rounded.svg`, icon(k, true));
  save(`${d}/vector/logo-on-light.svg`, lockSvg(k, false)); save(`${d}/vector/logo-on-dark.svg`, lockSvg(k, true)); save(`${d}/vector/one-colour-black.svg`, mono(k));
  for (const [p, s] of AVATARS) png(`${d}/${p}/profile-${s}x${s}.png`, icon(k), s, s);
  for (const [p, n, w, h, sw, sh] of COVERS) png(`${d}/${p}/${n}-${w}x${h}.png`, cover(k, w, h, sw, sh), w, h);
  for (const s of [16, 32, 48]) png(`${d}/website/favicon-${s}.png`, icon(k, true), s, s);
  for (const s of [192, 512]) png(`${d}/website/app-icon-${s}.png`, icon(k, true), s, s);
  png(`${d}/website/apple-touch-icon-180.png`, icon(k), 180, 180);
  for (const dark of [false, true]) { const l = lockup(k, dark); png(`${d}/website/logo-${dark ? 'on-dark' : 'on-light'}.png`, lockSvg(k, dark), Math.ceil(l.w) * 1.5, 300); }
  png(`${d}/print/email-signature-logo.png`, lockSvg(k, false), Math.ceil(lockup(k, false).w) / 2, 100);
  png(`${d}/print/receipt-stamp-black.png`, mono(k), 600, 600);
}

// ---------- overview sheet ----------
function nest(s, x, y, w, h, clip) {
  const vb = s.match(/viewBox="([^"]+)"/)[1], inner = s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const g = `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}">${inner}</svg>`;
  if (!clip) return g;
  const id = 'c' + (++uid);
  return `<clipPath id="${id}">${clip === 'circle' ? `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${clip}"/>`}</clipPath><g clip-path="url(#${id})">${g}</g>`;
}
{
  const W = 2400, R = 590, label = { A: 'Price tag', B: 'K phone', C: 'Rising sun', D: 'Shop sign' };
  let b = `<rect width="${W}" height="${R * 4 + 12}" fill="#E9EDF2"/>`;
  [...'ABCD'].forEach((k, i) => {
    const y = i * R;
    b += `<rect x="30" y="${y + 24}" width="${W - 60}" height="${R - 24}" rx="28" fill="#fff"/>` + text(`${k} ${label[k]}`, { size: 36, w: 700, x: 70, y: y + 86 }).svg;
    b += `<rect x="69" y="${y + 115}" width="332" height="332" rx="75" fill="#D9E0E8"/>` + nest(icon(k), 71, y + 117, 328, 328, 73);
    let x = 70; for (const s of [96, 64, 32, 16]) { b += `<circle cx="${x + s / 2}" cy="${y + 512}" r="${s / 2 + 2}" fill="#D9E0E8"/>` + nest(icon(k), x, y + 512 - s / 2, s, s, 'circle'); x += s + 34; }
    for (const [dark, yy] of [[false, 115], [true, 287]]) { const l = lockup(k, dark), w = l.w * 104 / l.h; b += `<rect x="450" y="${y + yy}" width="590" height="158" rx="18" fill="${dark ? C.ink : '#F3F6FA'}"/>` + nest(lockSvg(k, dark), 745 - w / 2, y + yy + 27, w, 104); }
    b += `<rect x="451" y="${y + 460}" width="588" height="98" rx="18" fill="#fff" stroke="#D9E0E8" stroke-width="2"/>` + nest(mono(k), 704, y + 468, 82, 82);
    b += nest(cover(k, 2560, 1440, 1400, 390), 1090, y + 115, 640, 360, 14) + text('YouTube', { size: 22, w: 500, x: 1410, y: y + 532, fill: C.muted, anchor: 'middle' }).svg;
    b += nest(cover(k, 1500, 500, 1000, 330), 1760, y + 115, 570, 190, 14) + nest(cover(k, 1080, 878, 860, 460), 1760, y + 317, 218, 177, 14) + nest(cover(k, 1200, 630, 940, 430), 1993, y + 317, 337, 177, 14);
    b += text('X / LINE / website', { size: 22, w: 500, x: 2045, y: y + 532, fill: C.muted, anchor: 'middle' }).svg;
  });
  png('overview.png', svg(W, R * 4 + 12, b), W, R * 4 + 12);
}

// ---------- render in a headless browser ----------
const page = `<!doctype html><meta charset=utf-8><body><script>(async()=>{for(let i=0;i<${jobs.length};i++){try{const j=await (await fetch('/job/'+i)).json();const im=new Image();im.src=URL.createObjectURL(new Blob([j.svg],{type:'image/svg+xml'}));await im.decode();const c=document.createElement('canvas');c.width=j.w;c.height=j.h;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(im,0,0,j.w,j.h);const b=await new Promise(r=>c.toBlob(r,'image/png'));await fetch('/out/'+i,{method:'POST',body:b});}catch(e){await fetch('/err/'+i,{method:'POST',body:String(e)});}}await fetch('/done',{method:'POST'});})()</script>`;
let ok = 0, bad = 0, chrome;
const srv = http.createServer((q, r) => {
  const [, kind, i] = q.url.split('/');
  if (kind === 'job') return r.end(JSON.stringify(jobs[+i]));
  if (q.method === 'POST') {
    const a = []; q.on('data', c => a.push(c));
    q.on('end', () => {
      const buf = Buffer.concat(a); r.end('ok');
      if (kind === 'out') { save(jobs[+i].file, buf); ok++; }
      if (kind === 'err') { bad++; console.log('FAILED', jobs[+i].file, buf.toString()); }
      if (kind === 'done') { console.log(`rendered ${ok} of ${jobs.length}, failed ${bad}`); chrome.kill(); setTimeout(() => process.exit(bad ? 1 : 0), 300); }
    });
    return;
  }
  r.setHeader('content-type', 'text/html'); r.end(q.url === '/' ? page : '');
}).listen(0, '127.0.0.1', () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(f => fs.existsSync(f));
  chrome = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'logo-')), '--remote-debugging-port=0', `http://127.0.0.1:${srv.address().port}/`], { stdio: 'ignore' });
  setTimeout(() => { console.log('timeout after', ok); chrome.kill(); process.exit(1); }, 100000);
});
