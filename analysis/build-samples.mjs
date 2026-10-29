// 构建抽样扫描窗口: 24 个窗口 × 每窗约8章, 均匀覆盖全书
// 输出 workdir/chunk-NN.txt (章节标注格式: 【第X章 标题】)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 24, PER = 8, TARGET = 38000; // 每窗目标字符数
const chapters = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw', 'chapters.json'), 'utf8'));
const workdir = path.join(__dirname, 'roster-work');
fs.mkdirSync(workdir, { recursive: true });

const step = Math.floor(chapters.length / W);
const wins = [];
for (let w = 0; w < W; w++) {
  const start = w * step;
  let end = Math.min(chapters.length, start + step);
  // 按字符量截取窗口内章节
  let size = 0, last = start;
  for (let i = start; i < end && size < TARGET; i++) { size += chapters[i].text.length; last = i + 1; }
  wins.push([start, last]);
}

for (let w = 0; w < W; w++) {
  const [s, e] = wins[w];
  const parts = [];
  for (let i = s; i < e; i++) parts.push(`【第${chapters[i].no}章 ${chapters[i].title.replace(/^第\S{1,8}章\s*/, '')}】\n${chapters[i].text}`);
  const txt = parts.join('\n\n');
  fs.writeFileSync(path.join(workdir, `chunk-${String(w).padStart(2, '0')}.txt`), txt);
  console.log(`chunk-${String(w).padStart(2, '0')}: 第${chapters[s].no}-${chapters[e - 1].no}章  ${(txt.length / 1000).toFixed(1)}k字`);
}
console.log('输出目录:', workdir);
