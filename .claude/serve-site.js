// tiny static server for site/ (mimics Cloudflare Pages: dir/index.html, 404.html)
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2]), port = Number(process.argv[3] || 8787);
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
http.createServer((req, res) => {
  // local testing only: the page can save the texts it could not translate (I18N.missing()) to work/i18n/harvest.json
  if (req.method === 'POST' && req.url === '/__harvest') {
    let body = ''; req.on('data', c => { body += c; if (body.length > 5e6) req.destroy(); });
    req.on('end', () => {
      try {
        const add = JSON.parse(body); if (!Array.isArray(add)) throw new Error('not a list');
        const f = path.join(root, '..', 'work', 'i18n', 'harvest.json');
        let cur = []; try { cur = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { }
        const all = [...new Set([...cur, ...add.filter(s => typeof s === 'string')])];
        fs.writeFileSync(f, JSON.stringify(all, null, 1)); res.writeHead(200); res.end(String(all.length));
      } catch (e) { res.writeHead(400); res.end(String(e.message)); }
    });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(root, p);
  if (!f.startsWith(path.resolve(root))) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': types['.html'] }); return res.end(fs.readFileSync(path.join(root, '404.html'))); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
}).listen(port);
