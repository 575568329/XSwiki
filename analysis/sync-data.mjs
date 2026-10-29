// 数据同步：plugin/data（唯一编辑源）→ plugin-src/public/data（dev）+ server/data（热更新服务包）
// 用法：node sync-data.mjs   （在 gen-system.mjs / merge-v2.mjs 等改完 plugin/data 后跑一次）
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'plugin', 'data');
const PUB = path.join(__dirname, '..', 'plugin-src', 'public', 'data');

fs.mkdirSync(PUB, { recursive: true });
// index.json 跟随目录重生成（新书目自动进索引）
const idx = fs.readdirSync(SRC).filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'images.json' && f !== 'prompts.json' && f !== 'archives.json' && f !== 'manifest.json').map(f => 'data/' + f);
fs.writeFileSync(path.join(SRC, 'index.json'), JSON.stringify(idx), 'utf8');
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.json'))) {
  fs.copyFileSync(path.join(SRC, f), path.join(PUB, f));
  console.log('→ public/data/' + f);
}
// 立绘镜像：images/ 整目录对齐（含删除），public/data 不入 git，克隆后跑本脚本即可构建
const IMG_SRC = path.join(SRC, 'images');
const IMG_PUB = path.join(PUB, 'images');
if (fs.existsSync(IMG_SRC)) {
  fs.mkdirSync(IMG_PUB, { recursive: true });
  const srcFiles = new Set(fs.readdirSync(IMG_SRC));
  for (const f of fs.readdirSync(IMG_PUB)) if (!srcFiles.has(f)) fs.unlinkSync(path.join(IMG_PUB, f));
  for (const f of srcFiles) fs.copyFileSync(path.join(IMG_SRC, f), path.join(IMG_PUB, f));
  console.log(`→ public/data/images/（${srcFiles.size} 张已对齐）`);
}
// 服务端包 + manifest（sha256）复用既有脚本
const r = spawnSync(process.execPath, [path.join(__dirname, 'gen-manifest.mjs')], { stdio: 'inherit' });
process.exitCode = r.status;
