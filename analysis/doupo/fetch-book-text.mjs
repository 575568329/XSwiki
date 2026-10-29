// 通用全书抓取（内存安全版，fetch-guimi-text 范式）：node fetch-book-text.mjs <source.json路径> <工作目录>
// 产出 <工作目录>/catalog.json + <工作目录>/chapters/<n>.txt；正文只落盘
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const [SRCFILE, WORKDIR] = process.argv.slice(2);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = JSON.parse(fs.readFileSync(path.join(__dirname, '..', SRCFILE), 'utf8'))[0];
if (!src) { console.error('无可用源'); process.exit(1); }
const WORK = path.join(__dirname, '..', WORKDIR);
fs.mkdirSync(path.join(WORK, 'chapters'), { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CONCURRENCY = 3;
const MAX_BYTES = 3 * 1024 * 1024;
const FILTERS = [
  /云序.{0,6}小说网?.{0,30}/g, /请记住本书首发域名.{0,30}/g, /手机版阅读网址.{0,30}/g,
  /最新章节请.{0,20}/g, /www\.[a-z0-9-]+\.(la|info|com|org|net|cc|lol)/gi, /（本章完）/g,
  /一秒记住.{0,30}/g, /天才一秒记住.{0,30}/g, /求收藏.{0,10}/g, /求推荐票.{0,10}/g, /求月票.{0,10}/g,
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchCapped(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(new Error('timeout')), 25000);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: src.bookUrl }, signal: ctrl.signal });
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
function cleanText(html) {
  const $ = cheerio.load(html);
  const node = $(src.content).clone();
  node.find('script,style,ins,iframe').remove();
  node.find('br').replaceWith('\n');
  node.find('p, div').after('\n');
  let text = node.text();
  text = text.replace(/\u00a0/g, ' ').replace(/[ \t\r]+/g, '').replace(/\n{3,}/g, '\n\n');
  for (const f of FILTERS) text = text.replace(f, '');
  return text.trim();
}
const hanRatio = s => (s.match(/[\u4e00-\u9fa5]/g) || []).length / Math.max(1, s.length);

// 目录
const catFile = path.join(WORK, 'catalog.json');
let catalog;
if (fs.existsSync(catFile)) {
  catalog = JSON.parse(fs.readFileSync(catFile, 'utf8'));
  console.log('目录已缓存:', catalog.length);
} else {
  const html = await fetchCapped(src.bookUrl);
  const $ = cheerio.load(html);
  catalog = [];
  $(src.menu).each((i, el) => {
    const t = $(el).text().replace(/\s+/g, '').trim();
    const href = $(el).attr('href');
    if (!t || !href) return;
    const m = /第([零一二三四五六七八九十百千万\d]+)章/.exec(t);
    if (!m) return;
    catalog.push({ i: catalog.length + 1, title: t, url: new URL(href, src.bookUrl).href });
  });
  const seen = new Set();
  catalog = catalog.filter(c => {
    // 按 URL 去重（目录页"最新章节"区与全列表区重复出现同一章）：同章号不同标题是真章节（加更/双章），不能按章号去重
    if (seen.has(c.url)) return false;
    seen.add(c.url); return true;
  });
  fs.writeFileSync(catFile, JSON.stringify(catalog));
  console.log('目录:', catalog.length, '章 ->', catalog[0]?.title, '...', catalog[catalog.length - 1]?.title);
}

// 抓取（断点续传：chapters/<i>.txt 存在即跳过）
const todo = catalog.filter(c => !fs.existsSync(path.join(WORK, 'chapters', c.i + '.txt')));
console.log('待抓:', todo.length);
let done = 0, ok = 0;
async function worker(queue) {
  while (queue.length) {
    const c = queue.shift();
    try {
      const html = await fetchCapped(c.url);
      const text = cleanText(html);
      if (text.length < 500 || hanRatio(text) < 0.5) throw new Error('校验失败 len=' + text.length);
      fs.writeFileSync(path.join(WORK, 'chapters', c.i + '.txt'), text);
      ok++;
    } catch (e) { /* 记缺章 */ fs.appendFileSync(path.join(WORK, 'missing.txt'), c.i + '\t' + c.title + '\n'); }
    done++;
    if (done % 100 === 0) console.log(`进度 ${done}/${todo.length} ok=${ok} heap=${(process.memoryUsage().heapUsed / 1048576).toFixed(0)}MB`);
  }
}
const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
const missing = fs.existsSync(path.join(WORK, 'missing.txt')) ? fs.readFileSync(path.join(WORK, 'missing.txt'), 'utf8').trim().split('\n').length : 0;
console.log(`完成: ${ok} 成功 / ${missing} 缺章`);
