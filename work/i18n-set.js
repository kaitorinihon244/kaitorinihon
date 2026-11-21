// Replace numbered lines in a translation file: node work/i18n-set.js <tsv file> <json {"index":"translation"}>
'use strict';
const fs = require('fs');
const [file, json] = process.argv.slice(2);
const set = JSON.parse(fs.readFileSync(json, 'utf8'));
const lines = fs.readFileSync(file, 'utf8').split('\n');
for (const [i, t] of Object.entries(set)) {
  const at = lines.findIndex(l => l.startsWith(i + '|'));
  if (at < 0) throw new Error('no line ' + i + ' in ' + file);
  const chk = lines[at].split('|')[1];
  lines[at] = i + '|' + chk + '|' + t;
}
fs.writeFileSync(file, lines.join('\n'));
console.log(file + ': ' + Object.keys(set).length + ' lines set');
