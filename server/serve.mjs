// 零依赖静态数据服务: node serve.mjs [port=8300]
// 特性: ETag(304) / CORS / sha256 校验头 / manifest 不缓存、数据文件长缓存
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'data');
const PORT = parseInt(process.argv[2] || process.env.PORT || '8300');
const MIME = { '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
    return res.end('{"error":"not found"}');
  }
  const buf = fs.readFileSync(file);
  const etag = '"' + crypto.createHash('md5').update(`${p}:${buf.length}:${fs.statSync(file).mtimeMs}`).digest('hex') + '"';
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { 'ETag': etag, 'Access-Control-Allow-Origin': '*' });
    return res.end();
  }
  const isManifest = p === 'manifest.json';
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
    'ETag': etag,
    'Cache-Control': isManifest ? 'no-cache' : 'public, max-age=86400',
    'X-Content-Sha256': crypto.createHash('sha256').update(buf).digest('hex'),
  });
  res.end(buf);
}).listen(PORT, () => console.log(`data-server: http://127.0.0.1:${PORT} (root: ${ROOT})`));
