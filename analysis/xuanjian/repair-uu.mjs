// UU 修复源补抓：对 shubao 落盘缺失的章，按章号到 UU 目录对位重抓
// 用法: node repair-uu.mjs  → 只补 chapters/<i>.txt 缺失项，全部沿用主脚本校验与过滤
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.join(__dirname, 'text');
const BOOK = 'http://www.uuwx.la/ls/139_139290/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAX_BYTES = 3 * 1024 * 1024;
const FILTERS = [
  /云序.{0,6}小说网?.{0,30}/g, /请记住本书首发域名.{0,30}/g, /手机版阅读网址.{0,30}/g,
  /最新章节请.{0,20}/g, /www\.[a-z0-9-]+\.(la|info|com|org|net|cc|lol)/gi, /（本章完）/g,
  /一秒记住.{0,30}/g, /天才一秒记住.{0,30}/g, /求收藏.{0,10}/g, /求推荐票.{0,10}/g, /求月票.{0,10}/g,
  /本站阅读（3秒记[^）]*）/g, /】，[^】]{0,30}和图书！/g,
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchCapped(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(new Error('timeout')), 25000);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: BOOK }, signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const reader = res.body.getReader();
      const chunks = []; let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) throw new Error('page too big');
        chunks.push(value);
      }
      return Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
    } catch (e) { lastErr = e; await sleep(1200 * (i + 1)); }
    finally { clearTimeout(t); }
  }
  throw lastErr;
}
const cleanText = html => {
  const $ = cheerio.load(html);
  const node = $('#content').clone();
  node.find('script,style,ins,iframe').remove();
  node.find('br').replaceWith('\n');
  node.find('p, div').after('\n');
  let text = node.text();
  text = text.replace(/\u00a0/g, ' ').replace(/[ \t\r]+/g, '').replace(/\n{3,}/g, '\n\n');
  for (const f of FILTERS) text = text.replace(f, '');
  return text.trim();
};
const hanRatio = s => (s.match(/[\u4e00-\u9fa5]/g) || []).length / Math.max(1, s.length);
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

// 待补清单（主源 catalog 索引 + 章号）
const catalog = JSON.parse(fs.readFileSync(path.join(WORK, 'catalog.json'), 'utf8'));
const todo = catalog
  .filter(c => !fs.existsSync(path.join(WORK, 'chapters', c.i + '.txt')))
  .map(c => ({ i: c.i, num: cnum(/第([零一二三四五六七八九十百千万\d]+)章/.exec(c.title)[1]) }));
console.log('待补(主源缺):', todo.length, '个章号');

// UU 目录 → 章号 url 表
const html = await fetchCapped(BOOK);
const $ = cheerio.load(html);
const uuMap = new Map();
$('#list a').each((_, el) => {
  const t = $(el).text().replace(/\s+/g, '').trim();
  const href = $(el).attr('href');
  const m = /第([零一二三四五六七八九十百千万\d]+)章/.exec(t);
  if (m && href && !uuMap.has(cnum(m[1]))) uuMap.set(cnum(m[1]), new URL(href, BOOK).href);
});
console.log('UU 目录数字章:', uuMap.size, '覆盖待补:', todo.filter(t => uuMap.has(t.num)).length);

let ok = 0, fail = [];
for (const t of todo) {
  const url = uuMap.get(t.num);
  if (!url) { fail.push([t.i, t.num, 'UU无此章号']); continue; }
  try {
    const page = await fetchCapped(url);
    const text = cleanText(page);
    if (text.length < 500 || hanRatio(text) < 0.5) throw new Error('校验失败 len=' + text.length);
    fs.writeFileSync(path.join(WORK, 'chapters', t.i + '.txt'), text);
    ok++;
  } catch (e) { fail.push([t.i, t.num, e.message]); }
  await sleep(400);
}
console.log('修复结果: 成功', ok, '/ 失败', fail.length);
fs.writeFileSync(path.join(__dirname, 'repair-log.json'), JSON.stringify({ ok, fail }, null, 1));
