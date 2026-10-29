// 章节真伪校验（文档§通道C第4条）：章号gap/dup / 占位章 / 假章(中段md5去重) / 统计
// 只输出统计数字，不输出任何正文
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.join(__dirname, 'text');
const catalog = JSON.parse(fs.readFileSync(path.join(WORK, 'catalog.json'), 'utf8'));
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

const cat = catalog.map(c => ({ i: c.i, num: cnum(/第([零一二三四五六七八九十百千万\d]+)章/.exec(c.title)[1]), title: c.title }));
const onDisk = new Set(cat.filter(c => fs.existsSync(path.join(WORK, 'chapters', c.i + '.txt'))).map(c => c.i));
const failed = cat.filter(c => !onDisk.has(c.i));

// 1) 章号扫描（以目录口径 1..max，叠加落盘缺失）
const nums = cat.map(c => c.num);
const max = Math.max(...nums), min = Math.min(...nums);
const seen = new Map();
const dups = [];
for (const c of cat) { if (seen.has(c.num)) dups.push(c.num); else seen.set(c.num, c.i); }
const missingNums = new Set(failed.map(c => c.num));
const gaps = [];
for (let n = min; n <= max; n++) if (!seen.has(n) || missingNums.has(n)) gaps.push(n);
const gapRanges = [];
{
  let s = null, p = null;
  for (const n of gaps) {
    if (s === null) { s = p = n; }
    else if (n === p + 1) { p = n; }
    else { gapRanges.push([s, p]); s = p = n; }
  }
  if (s !== null) gapRanges.push([s, p]);
}

// 2) 落盘文件体检：长度 / 汉字数 / 中段md5
let totalBytes = 0, totalHan = 0, totalChars = 0;
const placeholders = [];
const md5map = new Map();
let fileCount = 0;
for (const c of cat) {
  const f = path.join(WORK, 'chapters', c.i + '.txt');
  if (!fs.existsSync(f)) continue;
  fileCount++;
  const text = fs.readFileSync(f, 'utf8');
  totalBytes += Buffer.byteLength(text, 'utf8');
  totalChars += text.length;
  const han = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  totalHan += han;
  if (han < 200) placeholders.push(c.num);
  const flat = text.replace(/\s+/g, '');
  const mid = flat.length >= 1000 ? flat.slice(Math.floor((flat.length - 1000) / 2), Math.floor((flat.length - 1000) / 2) + 1000) : flat;
  const h = crypto.createHash('md5').update(mid).digest('hex');
  if (!md5map.has(h)) md5map.set(h, []);
  md5map.get(h).push(c.num);
}
const dupGroups = [...md5map.values()].filter(g => g.length > 1);

console.log('== 目录/落盘 ==');
console.log('目录章数:', cat.length, '落盘:', fileCount, '失败:', failed.length);
console.log('失败章号(目录序):', JSON.stringify(failed.map(c => c.num)));
console.log('== 章号 ==');
console.log('章号范围:', min, '..', max);
console.log('目录内重号(加更):', dups.length, '个 ->', JSON.stringify([...new Set(dups)]));
console.log('目录未收录(上游盗版源无,起点独有):', JSON.stringify(gapRanges.filter(r => r[1] - r[0] >= 5)));
console.log('落盘后gap区间:', JSON.stringify(gapRanges));
console.log('== 占位章(汉字<200) ==');
console.log('数量:', placeholders.length, '章号:', JSON.stringify(placeholders.slice(0, 20)), placeholders.length > 20 ? '...(截断前20)' : '');
console.log('== 假章(中段1000字符md5重复) ==');
console.log('重复组数:', dupGroups.length, '涉及章数:', dupGroups.reduce((a, g) => a + g.length, 0));
console.log('前20组(章号):', JSON.stringify(dupGroups.slice(0, 20)));
console.log('== 统计 ==');
console.log('总字节:', totalBytes, '总字符:', totalChars, '总汉字:', totalHan, 'utf8折算字数(字节/3):', Math.round(totalBytes / 3));
console.log('平均每章汉字:', Math.round(totalHan / Math.max(1, fileCount)));
