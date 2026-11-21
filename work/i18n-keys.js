// Builds work/i18n/keys.json: the list of Japanese texts to translate, in the form the page looks them up
// (numbers and prices become {0},{1}…). Inputs: work/i18n/source.json (from i18n-extract.js) and
// work/i18n/harvest.json (texts seen while clicking through the page with ?lang=xx; I18N.missing()).
// Usage: node work/i18n-keys.js <project root>
'use strict';
const fs = require('fs'), path = require('path');
const root = process.argv[2], dir = path.join(root, 'work', 'i18n');
const J = /[぀-ヿ㐀-鿿！-｠]/;
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return []; } };
const d = JSON.parse(fs.readFileSync(path.join(root, 'work', 'site.json'), 'utf8'));
const names = new Set((d.products || []).map(p => p.n.replace(/\s+/g, ' ').trim()));
// same number handling as the page: digits (with ¥ and separators) become {n}, existing {n} are kept, then renumbered
function norm(s) {
  s = s.replace(/\s+/g, ' ').trim();
  let i = 0;
  return s.split(/(\{\d+\})/).map(part => /^\{\d+\}$/.test(part) ? part : part.replace(/[¥￥]?\d[\d,，.]*/g, '{N}'))
    .join('').replace(/\{(?:\d+|N)\}/g, () => '{' + (i++) + '}');
}
const keep = s => {
  if (!s || !J.test(s)) return false;
  if (names.has(s) || names.has(s.replace(/の詳細$/, ''))) return false;   // product names stay as they are
  if (/^〒/.test(s)) return false;                                          // postal addresses stay in Japanese
  if (/[`;=]|^[:'"}{)\]]|['"]\s*\}|\$\{/.test(s)) return false;             // pieces of code
  if (s.length === 1 && !/^[＋－・]$/.test(s)) return false;                // single letters of split headings
  return true;
};
const all = new Set();
[...read('source.json'), ...read('harvest.json')].forEach(s => { if (keep(s)) all.add(norm(s)); });
// append-only: keys already numbered keep their place (translation files refer to them by number); new ones go at the end
const old = read('keys.json');
const list = [...old, ...[...all].filter(k => !old.includes(k)).sort((a, b) => a.length - b.length || a.localeCompare(b, 'ja'))];
fs.writeFileSync(path.join(dir, 'keys.json'), JSON.stringify(list, null, 1));
console.log('keys: ' + list.length + ' (' + (list.length - old.length) + ' new)' + ', characters: ' + list.join('').length);
