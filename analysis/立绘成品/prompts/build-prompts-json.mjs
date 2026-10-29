// prompts/*.prompt.txt → plugin/data/prompts.json（角色卡片"提示词"弹窗数据源）
// 只搬运各角色最终过审版提示词文本；脚本侧文件搬运，不回显内容
// 重跑后需再跑 analysis/sync-data.mjs 同步三副本
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DST = path.join(__dirname, '..', '..', '..', 'plugin', 'data', 'prompts.json');

const out = {};
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.prompt.txt')).sort()) {
  const id = f.replace(/\.prompt\.txt$/, '');
  const txt = fs.readFileSync(path.join(__dirname, f), 'utf8').trim();
  if (txt) out[id] = txt;
}
fs.writeFileSync(DST, JSON.stringify(out, null, 1), 'utf8');
console.log(`prompts.json: ${Object.keys(out).length} 人 → ${DST}`);
