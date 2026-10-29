// 着装档案/*.md → plugin/data/archives.json（角色卡"立绘档案"弹窗的着装档案页数据源）
// 文件名 = <人物名>-着装档案.md，经全部书目花名册 人物名→id 映射（多书通用；同名先到先得）
// 名册中不存在的（如位阶说明文档）自动跳过；重跑后需再跑 analysis/sync-data.mjs 同步三副本
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DST = path.join(ROOT, 'plugin', 'data', 'archives.json');

const byName = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'plugin', 'data')).filter(f => f.endsWith('.json') && !['index.json', 'images.json', 'prompts.json', 'archives.json', 'manifest.json'].includes(f))) {
  try {
    const book = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin', 'data', f), 'utf8'));
    if (!book.id || !Array.isArray(book.characters)) continue;
    for (const c of book.characters) {
      if (!byName.has(c.name)) byName.set(c.name, c.id);
      for (const a of c.aliases || []) if (!byName.has(a)) byName.set(a, c.id);
    }
  } catch {}
}

const out = {};
let skipped = [];
const scanDir = (dir, suffix) => {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(suffix)).sort()) {
    const name = f.replace(suffix, '');
    const id = byName.get(name);
    if (!id) { skipped.push(name); continue; }
    if (out[id]) continue;
    const txt = fs.readFileSync(path.join(dir, f), 'utf8').trim();
    if (txt) out[id] = txt;
  }
};
scanDir(__dirname, '-着装档案.md');
scanDir(path.join(ROOT, 'analysis', 'doupo', '档案'), '-外貌提取.md');
fs.writeFileSync(DST, JSON.stringify(out, null, 1), 'utf8');
console.log(`archives.json: ${Object.keys(out).length} 人 → ${DST}`);
if (skipped.length) console.log('跳过（名册无此人）: ' + skipped.join(', '));
