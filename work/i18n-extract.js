// Collects every customer-facing Japanese string from uridoki.html and work/site.json into work/i18n/source.json.
// Keys use {0},{1}… where the page inserts a value (numbers, prices, product names), matching what i18n at runtime looks up.
// The site editor, the built-in default content (site.json replaces it) and CSS are skipped.
// Usage: node work/i18n-extract.js <project root>
'use strict';
const fs = require('fs'), path = require('path');
const root = process.argv[2];
const J = /[぀-ヿ㐀-鿿！-｠]/;
const html = fs.readFileSync(path.join(root, 'uridoki.html'), 'utf8');
const lines = html.split('\n');
const lineOf = i => html.slice(0, i).split('\n').length;
const find = re => { const i = lines.findIndex(l => re.test(l)); return i < 0 ? -1 : i + 1; };
const skip = [];
// HTML: site editor panel
skip.push([find(/<!-- =+ SITE EDITOR =+ -->/), find(/<!-- =+ MOBILE TAB BAR/) - 1]);
// script: default site content (data/site.json overrides it) and the site editor
const defStart = find(/^\s*Default site content/), defEnd = find(/^\s*Loader\s*$/);
skip.push([defStart - 1, defEnd - 2]);
skip.push([find(/^\s*Site editor\s*$/) - 1, lines.length]);
// CSS
skip.push([1, find(/<\/style>/)]);
const skipped = ln => skip.some(([a, b]) => ln >= a && ln <= b);

const out = new Map();   // key -> {from}
const add = (s, from) => {
  s = s.replace(/\s+/g, ' ').trim();
  if (!s || !J.test(s)) return;
  if (!out.has(s)) out.set(s, from);
};
// split a piece of markup into text segments (between tags), keeping {n} placeholders
const segs = s => s.split(/<[^>]*>/).forEach(t => add(t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'), 'html'));

// 1) static HTML outside <script>
const noScript = html.replace(/<script[\s\S]*?<\/script>/g, m => m.replace(/[^\n]/g, ' '));
for (const m of noScript.matchAll(/>([^<>]+)</g)) if (!skipped(lineOf(m.index))) add(m[1], 'html');
for (const m of noScript.matchAll(/\s(?:aria-label|placeholder|title|alt)="([^"]*)"/g)) if (!skipped(lineOf(m.index))) add(m[1], 'attr');

// 2) string literals in scripts
const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
for (const sm of html.matchAll(scriptRe)) {
  const base = sm.index + sm[0].indexOf('>') + 1;
  const code = sm[1].replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\'"`])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
  const litRe = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.|\$\{(?:[^{}]|\{[^{}]*\})*\})*)`/g;
  for (const m of code.matchAll(litRe)) {
    if (skipped(lineOf(base + m.index))) continue;
    let s = m[1] ?? m[2] ?? m[3];
    if (!s || !J.test(s)) continue;
    if (m[3] != null) {
      // template literal: each ${…} becomes {n}; nested templates inside ${} are collected on their own
      for (const inner of s.matchAll(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
        for (const q of inner[1].matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`([^`]*)`/g)) { const t = q[1] ?? q[2] ?? q[3]; if (t && J.test(t)) segs(t.replace(/\$\{[^}]*\}/g, '{0}')); }
      }
      let n = 0; s = s.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, () => '{' + (n++) + '}');
      // renumber per segment so each text node's key starts at {0}
      s.split(/<[^>]*>/).forEach(t => { let k = 0; add(t.replace(/\{\d+\}/g, () => '{' + (k++) + '}'), 'js'); });
    } else {
      segs(s.replace(/\\n/g, '\n'));
      if (/\\n|\n/.test(s)) s.replace(/\\n/g, '\n').split('\n').forEach(t => add(t, 'js'));
    }
  }
}

// 3) site.json (everything except product records and the model list)
const d = JSON.parse(fs.readFileSync(path.join(root, 'work', 'site.json'), 'utf8'));
const SKIP_KEYS = /^\.(products|models)\b|\.(relayUrl|instagramUrl|tiktokUrl|xUrl|youtubeUrl|lineUrl|contactEmail|addr|tel|img|link|date)$/;
(function walk(o, p) {
  if (SKIP_KEYS.test(p)) return;
  if (Array.isArray(o)) o.forEach((v, i) => walk(v, p + '[' + i + ']'));
  else if (o && typeof o === 'object') for (const k in o) walk(o[k], p + '.' + k);
  else if (typeof o === 'string' && J.test(o)) {
    if (o.includes('\n')) o.split('\n').forEach(t => segs(t)); else segs(o);
  }
})(d, '');
// product categories and option labels (names stay as they are)
const P = d.products || [];
P.forEach(p => {
  add(p.cat || '', 'product');
  (p.opts || []).forEach(c => { add(c.label || '', 'product'); (c.options || []).forEach(o => add(o.label || '', 'product')); });
});

const list = [...out.keys()].sort((a, b) => a.localeCompare(b, 'ja'));
fs.mkdirSync(path.join(root, 'work', 'i18n'), { recursive: true });
fs.writeFileSync(path.join(root, 'work', 'i18n', 'source.json'), JSON.stringify(list, null, 1));
const by = {}; for (const [k, v] of out) by[v] = (by[v] || 0) + 1;
console.log('strings: ' + list.length + ' ' + JSON.stringify(by) + ' chars: ' + list.join('').length);
