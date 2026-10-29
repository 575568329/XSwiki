// 章节完整性校验：章号连续 / 长度异常 / 内容重复 / 与第二源比对
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapters = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw', 'chapters.json'), 'utf8'));

const cnum = s => {
  const map = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (/^\d+$/.test(s)) return parseInt(s);
  let n = 0, seg = 0;
  for (const c of s) {
    if (c === '十') { n += (seg || 1) * 10; seg = 0; }
    else if (c === '百') { n += (seg || 1) * 100; seg = 0; }
    else if (c === '千') { n += (seg || 1) * 1000; seg = 0; }
    else if (map[c] !== undefined) seg = map[c];
  }
  return n + seg;
};

// 1) 章号
const nums = chapters.map(c => { const m = c.title.match(/^第(\S{1,8})章/); return m ? cnum(m[1]) : null; });
let gaps = [], dups = [];
const seenN = new Map();
nums.forEach((n, i) => {
  if (n == null) { gaps.push(`第${i + 1}条无法解析: ${chapters[i].title}`); return; }
  if (seenN.has(n)) dups.push(`第${n}章重复: 条目${seenN.get(n) + 1} 和 ${i + 1}`);
  seenN.set(n, i);
  const prev = nums[i - 1];
  if (i > 0 && prev != null && n > prev + 1) gaps.push(`条目${i}(第${prev}章)→条目${i + 1}(第${n}章) 跳章`);
});
console.log('== 章号 ==');
console.log('  跳章:', gaps.length ? gaps.join('; ') : '无');
console.log('  重复章号:', dups.length ? dups.join('; ') : '无');

// 2) 长度分布
const lens = chapters.map(c => c.text.length).sort((a, b) => a - b);
console.log('== 长度 ==');
console.log(`  min:${lens[0]} p5:${lens[Math.floor(lens.length * .05)]} 中位:${lens[Math.floor(lens.length / 2)]} max:${lens.at(-1)}`);
const shorts = chapters.filter(c => c.text.length < 800);
console.log(`  <800字的章: ${shorts.length}`, shorts.slice(0, 8).map(c => `${c.title}(${c.text.length})`).join(', '));

// 3) 内容重复（正文签名：去空白后取中间1k字符的hash）
const sig = t => {
  const s = t.replace(/\s+/g, '');
  return crypto.createHash('md5').update(s.slice(1000, 2500)).digest('hex');
};
const bySig = new Map();
for (const c of chapters) {
  if (c.text.length < 2500) continue;
  const h = sig(c.text);
  if (!bySig.has(h)) bySig.set(h, []);
  bySig.get(h).push(c.title);
}
const dupContent = [...bySig.values()].filter(v => v.length > 1);
console.log('== 内容重复 ==');
console.log(dupContent.length ? dupContent.map(v => v.join(' ≈ ')).join('\n  ') : '  无');

// 4) 模板化检测：某些盗版站用同一段假文填充
const headSig = new Map();
for (const c of chapters) {
  const h = crypto.createHash('md5').update(c.text.slice(0, 200)).digest('hex');
  if (!headSig.has(h)) headSig.set(h, []);
  headSig.get(h).push(c.title);
}
const tmpl = [...headSig.entries()].filter(([h, v]) => v.length > 3);
console.log('== 开头模板化 ==');
console.log(tmpl.length ? tmpl.map(([h, v]) => `${v.length}章同开头: ${v.slice(0, 5).join(',')}...`).join('\n  ') : '  无');

// 5) 相邻章续接抽查（末句→首句）
console.log('== 衔接抽查（每200章一对）==');
for (let i = 0; i < chapters.length - 1; i += 200) {
  const a = chapters[i], b = chapters[i + 1];
  const endA = a.text.slice(-60).replace(/\s+/g, ' ');
  const headB = b.text.slice(0, 60).replace(/\s+/g, ' ');
  console.log(`  [${a.title}] …${endA}`);
  console.log(`  [${b.title}] ${headB}…`);
  console.log('  ---');
}
