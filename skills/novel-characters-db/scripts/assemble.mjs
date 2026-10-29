// 组装干净的章节数据: raw/store.ndjson + 目录顺序 -> raw/chapters.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = p => path.join(__dirname, 'raw', p);

const html = fs.readFileSync(path.join(__dirname, 'book_shubao.html'), 'utf8');
const $ = cheerio.load(html);
const seen = new Set();
const toc = [];
$('a').each((i, el) => {
  const title = $(el).text().trim();
  const href = $(el).attr('href') || '';
  const m = title.match(/^第(\S{1,8})章/);
  if (m && /246083\/\d+\.html$/.test(href)) {
    const url = new URL(href, 'https://www.shubaoge.org/').href;
    if (!seen.has(url)) { seen.add(url); toc.push({ title, url }); }
  }
});
// 按章号排序（中文数字转数字）
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
toc.sort((a, b) => cnum(a.title.match(/^第(\S{1,8})章/)[1]) - cnum(b.title.match(/^第(\S{1,8})章/)[1]));

const store = new Map();
for (const line of fs.readFileSync(RAW('store.ndjson'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try { const o = JSON.parse(line); if (o.text) store.set(o.url, o); } catch {}
}

const AD = /一秒记住【[^】]*】[^"\n]*/g;
const chapters = [];
let missing = [];
for (let i = 0; i < toc.length; i++) {
  const s = store.get(toc[i].url);
  if (!s) { missing.push(toc[i].title); continue; }
  let text = s.text.replace(AD, '').replace(/【39小说网[^】]*】/g, '').replace(/\n{3,}/g, '\n\n').trim();
  chapters.push({ no: chapters.length + 1, title: toc[i].title, url: toc[i].url, text });
}
fs.writeFileSync(RAW('chapters.json'), JSON.stringify(chapters));
const total = chapters.reduce((s, c) => s + c.text.length, 0);
console.log(`章节数: ${chapters.length}  缺失: ${missing.length} ${missing.join(',')}  总字数: ${(total / 10000).toFixed(1)}万`);
console.log('首:', chapters[0].title, ' 尾:', chapters.at(-1).title);
