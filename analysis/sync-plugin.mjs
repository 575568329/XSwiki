// 插件资产三副本同步：plugin/（编辑源）→ plugin-src/dist/（发版包）+ plugin-src/public/（dev）
// 同步项：preload.js / plugin.json / config.json（数据副本由 analysis/sync-data.mjs 负责）
// 用法: node analysis/sync-plugin.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'plugin');
const DESTS = [
  path.join(ROOT, 'plugin-src', 'dist'),
  path.join(ROOT, 'plugin-src', 'public'),
];
const FILES = ['preload.js', 'plugin.json', 'config.json', 'logo.png'];

let fail = 0;
for (const dest of DESTS) {
  for (const f of FILES) {
    const from = path.join(SRC, f);
    const to = path.join(dest, f);
    if (!fs.existsSync(from)) { console.error('✗ 缺少编辑源', from); fail++; continue; }
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(from, to);
    const ok = fs.readFileSync(from).equals(fs.readFileSync(to));
    console.log(`${ok ? '✓' : '✗'} ${path.relative(ROOT, to)}`);
    if (!ok) fail++;
  }
}
if (fail) { console.error(`${fail} 项同步失败`); process.exit(1); }
console.log('插件资产同步完成');
