// 生成服务端数据包: plugin/data 书目JSON -> server/data/ + manifest.json(sha256)
// 加新书/更新数据后跑一次，然后把 server/ 目录拷到服务器
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'plugin', 'data');
const DST = path.join(__dirname, '..', 'server', 'data');
fs.mkdirSync(DST, { recursive: true });

const books = [];
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.json'))) {
  if (f === 'index.json' || f === 'images.json' || f === 'prompts.json' || f === 'archives.json') continue; // 本地构建辅助文件不上服务器（下方 id/characters 校验也会兜底跳过）
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8')); } catch { continue; }
  if (!j.id || !Array.isArray(j.characters)) continue;      // 只上书目数据
  fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
  const buf = fs.readFileSync(path.join(DST, f));
  books.push({
    id: j.id, file: f, title: j.title || j.id,
    version: (j.updatedAt || '1').replace(/\D/g, '').slice(0, 8) || 1,
    size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'),
  });
  console.log(`+ ${f} (${(buf.length / 1024).toFixed(0)}KB) ${books.at(-1).sha256.slice(0, 12)}…`);
}
const manifest = { version: Date.now(), books };
fs.writeFileSync(path.join(DST, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`\nmanifest.json: ${books.length} 本书, version=${manifest.version}`);
console.log(`输出: ${DST}（部署时整个 server/ 目录拷到服务器，node serve.mjs）`);
