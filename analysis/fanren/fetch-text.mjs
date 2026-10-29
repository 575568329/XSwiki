// 《凡人修仙传》全本抓取 - 云序 yunxs.la（内存安全版，同 guimi 规矩）
// 目录夹带广告链接（"忘语新书…"），只收 /^第.{1,9}章/ 标题
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'text');
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CONCURRENCY = 3;
const MAX_BYTES = 3 * 1024 * 1024;
const TOC_URL = 'http://www.yunxs.la/fanrenxiuxianchuan/';
const MENU_SEL = '.list_box ul li a';
const CONTENT_SEL = '.box_box';
const CHAPTER_TITLE_RE = /第[零〇一二三四五六七八九十百千两0-9]{1,12}章/; // 标题含章号即可（本站有"三百六十四章 偷技"缺第字/卷名+章名等脏形态）
const JUNK_RE = /月票|通告|请假|更过|修整|说明|感谢|抱歉|恢复更新|上架|感言|推荐|新书/;
const CN_NUM = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function chNum(title) {
  // 取标题里最后一个 第X章 的数字（中文数字/阿拉伯），用于去重保序
  const m = [...title.matchAll(/第([零〇一二三四五六七八九十百千两0-9]{1,12})章/g)].pop();
  if (!m) return NaN;
  const s = m[1];
  if (/^\d+$/.test(s)) return +s;
  // 中文数字（≤四位：X千X百X十X）
  let n = 0, cur = 0;
  for (const ch of s) {
    if (CN_NUM[ch] !== undefined) cur = CN_NUM[ch];
    else if (ch === '十') { n += (cur || 1) * 10; cur = 0; }
    else if (ch === '百') { n += (cur || 1) * 100; cur = 0; }
    else if (ch === '千') { n += (cur || 1) * 1000; cur = 0; }
  }
  return n + cur;
}
const FILTERS = [
  /云序.{0,6}小说网?.{0,30}/g, /请记住本书首发域名.{0,30}/g, /手机版阅读网址.{0,30}/g,
  /最新章节请.{0,20}/g, /www\.[a-z0-9-]+\.(la|info|com|org|net|cc|lol)/gi, /（本章完）/g, /\(本章完\)/g,
  /扫描下面二维码[^\n]*/g, /公众号[^\n]*/g, /yunyuedu[^\n]*/gi, /云阅读网[^\n]*/g, /关注后[^\n]{0,50}更新[^\n]*/g,
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchCapped(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(new Error('timeout')), 25000);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: TOC_URL }, signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const reader = res.body.getReader();
      const chunks = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) { ctrl.abort(new Error('页过大')); throw new Error('page too big'); }
        chunks.push(value);
      }
      return Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
    } catch (e) { lastErr = e; await sleep(1500 * (i + 1)); }
    finally { clearTimeout(t); }
  }
  throw lastErr;
}

function cleanText(html) {
  const $ = cheerio.load(html);
  const node = $(CONTENT_SEL).clone();
  node.find('script,style,ins,iframe').remove();
  let text = node.text();
  text = text.replace(/\u00a0/g, ' ').replace(/[ \t\r]+/g, '').replace(/\n{3,}/g, '\n\n');
  for (const f of FILTERS) text = text.replace(f, '');
  return text.trim();
}

const HAN = /[\u4e00-\u9fff]/;
function valid(text) {
  if (!text || text.length < 200) return '过短';
  if (!HAN.test(text.slice(0, 100))) return '开头无汉字(疑似脚本)';
  if (/getCookie|document\.|function\s*\(|window\./.test(text.slice(0, 300))) return '含JS残留';
  const han = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  if (han / text.length < 0.3) return '汉字占比过低';
  return null;
}

async function main() {
  console.log('目录...', TOC_URL, 'heap=', (process.memoryUsage().heapUsed / 1048576).toFixed(0) + 'M');
  const html = await fetchCapped(TOC_URL);
  const $ = cheerio.load(html);
  const seen = new Set();
  const chapters = [];
  $(MENU_SEL).each((i, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (!title || !href || !CHAPTER_TITLE_RE.test(title) || JUNK_RE.test(title)) return;
    const num = chNum(title);
    if (!Number.isFinite(num)) return;
    const url = new URL(href, TOC_URL).href;
    if (seen.has(url)) return;
    seen.add(url);
    chapters.push({ num, title, url });
  });
  // 章号去重（同号保先出现），按章号排序
  const byNum = new Map();
  for (const c of chapters) if (!byNum.has(c.num)) byNum.set(c.num, c);
  chapters.length = 0;
  chapters.push(...[...byNum.values()].sort((a, b) => a.num - b.num));
  console.log(`章节数: ${chapters.length}, 首: ${chapters[0]?.title}, 尾: ${chapters.at(-1)?.title}`);
  if (chapters.length < 2000) { console.error('章节数异常（凡人正文应 2400+）'); process.exit(3); }
  fs.writeFileSync(path.join(OUT_DIR, 'chapters.json'), JSON.stringify(chapters), 'utf8');

  const storeFile = path.join(OUT_DIR, 'store.ndjson');
  const have = new Set();
  if (fs.existsSync(storeFile)) {
    for (const line of fs.readFileSync(storeFile, 'utf8').split('\n')) {
      const i = line.indexOf('"url":"');
      if (i < 0) continue;
      have.add(line.slice(i + 7, line.indexOf('"', i + 7)));
    }
    console.log('断点续传: 已有', have.size, '章');
  }

  // 自检
  {
    const c0 = chapters[0];
    if (!have.has(c0.url)) {
      const text = cleanText(await fetchCapped(c0.url));
      const bad = valid(text);
      if (bad) { console.error('自检失败:', bad, '| head=', text.slice(0, 40)); process.exit(4); }
      fs.appendFileSync(storeFile, JSON.stringify({ title: c0.title, url: c0.url, text }) + '\n');
      have.add(c0.url);
      console.log(`自检通过: ${text.length}字 开头: ${text.slice(0, 20)}`);
    }
  }

  const todo = chapters.filter(c => !have.has(c.url));
  console.log('待抓取:', todo.length, '章');
  const t0 = Date.now();
  let idx = 0, done = 0, fails = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (idx < todo.length) {
      const ch = todo[idx++];
      try {
        const text = cleanText(await fetchCapped(ch.url));
        const bad = valid(text);
        if (bad) throw new Error(bad);
        fs.appendFileSync(storeFile, JSON.stringify({ title: ch.title, url: ch.url, text }) + '\n');
        have.add(ch.url);
      } catch (e) {
        fails++;
        if (fails <= 10) console.log('  FAIL:', ch.title, String(e.message || e).slice(0, 50));
      }
      done++;
      if (done % 200 === 0 || done === todo.length) {
        console.log(`  ${done}/${todo.length} (${((Date.now() - t0) / 1000).toFixed(0)}s heap=${(process.memoryUsage().heapUsed / 1048576).toFixed(0)}M fail=${fails})`);
      }
    }
  }));
  console.log(`完成: ${have.size}/${chapters.length} 章, 失败=${fails}（重跑自动补缺）`);
}
main().catch(e => { console.error('FATAL', e); process.exit(9); });
