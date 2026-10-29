// 本地预览服务器: node preview-server.js -> http://127.0.0.1:5175
const http = require('http'), fs = require('fs'), path = require('path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8' };
http.createServer((req, res) => {
  let p = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]));
  if (/[\\/]$/.test(p)) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'text/plain', 'Cache-Control': 'no-store' });
    res.end(d);
  });
}).listen(5175, () => console.log('preview: http://127.0.0.1:5175'));
