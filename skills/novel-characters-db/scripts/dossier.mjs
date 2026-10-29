// 为指定人物生成档案素材: 抽取含名字的句子上下文 (首次出场/高密度章/最后出场)
// 用法: node dossier.mjs <name1,name2,...> [每章抽样上限]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapters = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw', 'chapters.json'), 'utf8'));
const names = (process.argv[2] || '').split(',').map(s => s.trim()).filter(Boolean);
const CAP = parseInt(process.argv[3] || '6'); // 高密度章每章抽句上限
const OUT = path.join(__dirname, 'dossiers');
fs.mkdirSync(OUT, { recursive: true });

// 章节文本按句切
const sentences = t => t.split(/(?<=[。！？…”』」])/);

for (const name of names) {
  // 统计每章出现次数
  const per = [];
  for (const c of chapters) {
    let i = 0, n = 0;
    while ((i = c.text.indexOf(name, i)) !== -1) { n++; i += name.length; }
    if (n) per.push({ no: c.no, title: c.title, n, text: c.text });
  }
  if (!per.length) { console.log(`${name}: 全文未出现!`); continue; }
  per.sort((a, b) => a - b);
  const total = per.reduce((s, p) => s + p.n, 0);

  // 首次3章 全文抽句; 高密度前12章 每章抽CAP句; 最后2章
  const first3 = per.slice(0, 3);
  const top12 = [...per].sort((a, b) => b.n - a.n).slice(0, 12);
  const last2 = per.slice(-2);
  const picked = new Map(); // no -> {cap}
  for (const p of first3) picked.set(p.no, { cap: 999, tag: '首次出场' });
  for (const p of top12) if (!picked.has(p.no)) picked.set(p.no, { cap: CAP, tag: '高密度' });
  for (const p of last2) if (!picked.has(p.no)) picked.set(p.no, { cap: CAP, tag: '近期' });

  const parts = [`# ${name}  总提及:${total}  出场章数:${per.length}  首现:第${per[0].no}章  末现:第${per.at(-1).no}章\n`];
  for (const [no, cfg] of [...picked.entries()].sort((a, b) => a[0] - b[0])) {
    const p = per.find(x => x.no === no);
    const hits = [];
    for (const s of sentences(p.text)) {
      if (s.includes(name)) {
        hits.push(s.trim().slice(0, 300));
        if (hits.length >= cfg.cap) break;
      }
    }
    parts.push(`## [${cfg.tag}] 第${no}章 ${p.title} (本章提及${p.n}次)\n` + hits.map(h => '- ' + h).join('\n'));
  }
  const file = path.join(OUT, `${name}.md`);
  fs.writeFileSync(file, parts.join('\n\n'));
  console.log(`${name}: 提及${total}次/${per.length}章 -> ${file}`);
}
