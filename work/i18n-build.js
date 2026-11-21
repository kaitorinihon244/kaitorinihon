// Turns a numbered translation file (work/i18n/tr/<code>.tsv: "index|first 2 chars of the Japanese|translation")
// into work/i18n/<code>.json, checking every line against work/i18n/keys.json:
//  - the index must point at a key that starts with the given 2 characters (catches misnumbered lines)
//  - {0},{1}… must be the same set as in the Japanese; ⟨①⟩…⟨/①⟩ and ⏎ marks must match
//  - a translation must not still contain Japanese (kana), except where the line is marked to stay Japanese with "="
// Keys already in the existing <code>.json are kept unless the .tsv gives them again.
// Usage: node work/i18n-build.js <project root> <code> [<code>…]
'use strict';
const fs = require('fs'), path = require('path');
const root = process.argv[2], codes = process.argv.slice(3);
const dir = path.join(root, 'work', 'i18n');
const keys = JSON.parse(fs.readFileSync(path.join(dir, 'keys.json'), 'utf8'));
const KANA = /[぀-ヿ]/;
const ph = s => (s.match(/\{\d+\}/g) || []).sort().join(',');
const marks = s => (s.match(/⟨\/?[①-⑩]⟩|⏎/g) || []).sort().join('');
let bad = 0;
for (const code of codes) {
  const src = path.join(dir, 'tr', code + '.tsv');
  const out = path.join(dir, code + '.json');
  let t = {}; try { t = JSON.parse(fs.readFileSync(out, 'utf8')).t || {}; } catch (e) { }
  const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  const seen = new Set(); const errs = [];
  for (const line of lines) {
    const m = line.match(/^(\d+)\|([^|]*)\|(.*)$/); if (!m) { errs.push('bad line: ' + line.slice(0, 60)); continue; }
    const i = +m[1], chk = m[2], tr = m[3].trim(), k = keys[i];
    if (k == null) { errs.push(i + ': no such key'); continue; }
    if (!k.startsWith(chk)) { errs.push(i + ': key starts "' + k.slice(0, 8) + '" not "' + chk + '"'); continue; }
    if (seen.has(i)) errs.push(i + ': given twice'); seen.add(i);
    if (tr === '=') { delete t[k]; continue; }            // stays Japanese
    if (ph(tr) !== ph(k)) errs.push(i + ': placeholders ' + ph(k) + ' vs ' + ph(tr) + '  | ' + k.slice(0, 30));
    if (marks(tr) !== marks(k)) errs.push(i + ': marks differ | ' + k.slice(0, 30));
    // allowed Japanese: postal addresses, the katakana names banks use (ヤマダタロウ, ロイヤル ジャパン), the ー in network marks
    const rest = tr.replace(/〒[\s\S]*?(?:日高ビル\{\d+\}|\{\d+\}(?=⟨|\s*TEL|$))/g, '').replace(/ヤマダ\s?タロウ|ロイヤル ジャパン|〇一八|ゼロイチハチ/g, '').replace(/[ー・]/g, '');
    if (KANA.test(rest)) errs.push(i + ': still has Japanese | ' + tr.slice(0, 40));
    t[k] = tr;
  }
  const missingIdx = keys.map((k, i) => i).filter(i => !seen.has(i) && t[keys[i]] == null);
  fs.writeFileSync(out, JSON.stringify({ lang: code, t }));
  console.log(code + ': ' + Object.keys(t).length + ' translated, ' + missingIdx.length + ' left in Japanese' + (missingIdx.length ? ' (' + missingIdx.slice(0, 40).join(',') + (missingIdx.length > 40 ? '…' : '') + ')' : '') + ', ' + errs.length + ' problems');
  errs.slice(0, 60).forEach(e => console.log('  ' + e)); bad += errs.length;
}
process.exitCode = bad ? 1 : 0;
