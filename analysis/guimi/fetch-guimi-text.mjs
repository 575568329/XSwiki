// 《诡秘之主》全本抓取 - 云序 yunxs.la（内存安全版）
// 教训（2026-10-23）：.box_box 内嵌 <script>，.text() 会把 JS 拼进正文 → 既污染数据又撑爆内存。
// 规矩：①正文节点必须先剥 script/style/ins 再取文本 ②汉字占比校验 ③断点索引只存 URL 不存正文
//      ④响应流式限长 3MB ⑤并发 3 ⑥进度日志带 heapUsed
// 断点续传：guimi/text/store.ndjson（追加式）+ chapters.json（目录序，供 build-text 用）
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
const TOC_URL = 'http://www.yunxs.la/guimizhizhu/';
const MENU_SEL = '.list_box ul li a';
const CONTENT_SEL = '.box_box';
const FILTERS = [
  /云序.{0,6}小说网?.{0,30}/g, /请记住本书首发域名.{0,30}/g, /手机版阅读网址.{0,30}/g,
  /最新章节请.{0,20}/g, /www\.[a-z0-9-]+\.(la|info|com|org|net|cc|lol)/gi, /（本章完）/g,
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
      if (!(res.body)) throw new Error('no body');
      const reader = res.body.getReader();
      const chunks = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) { ctrl.abort(new Error('页过大>' + MAX_BYTES)); throw new Error('page too big'); }
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
  node.find('script,style,ins,iframe').remove(); // 关键：先剥内嵌脚本再取文本
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

async function getChapters() {
  const html = await fetchCapped(TOC_URL);
  const $ = cheerio.load(html);
  const seen = new Set();
  const chapters = [];
  $(MENU_SEL).each((i, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (!title || !href) return;
    const url = new URL(href, TOC_URL).href;
    if (!seen.has(url)) { seen.add(url); chapters.push({ title, url }); }
  });
  return chapters;
}

async function main() {
  console.log('目录...', TOC_URL, 'heap=', (process.memoryUsage().heapUsed / 1048576).toFixed(0) + 'M');
  const chapters = await getChapters();
  console.log(`章节数: ${chapters.length}, 首: ${chapters[0]?.title}, 尾: ${chapters.at(-1)?.title}`);
  if (chapters.length < 1000) { console.error('章节数异常'); process.exit(3); }
  fs.writeFileSync(path.join(OUT_DIR, 'chapters.json'), JSON.stringify(chapters), 'utf8');

  // 断点索引：只存 URL（不把正文读进内存）
  const storeFile = path.join(OUT_DIR, 'store.ndjson');
  const have = new Set();
  if (fs.existsSync(storeFile)) {
    const lines = fs.readFileSync(storeFile, 'utf8').split('\n');
    for (const line of lines) {
      const i = line.indexOf('"url":"');
      if (i < 0) continue;
      const u = line.slice(i + 7, line.indexOf('"', i + 7));
      if (u) have.add(u);
    }
    console.log('断点续传: 已有', have.size, '章');
  }

  // 自检：第一章过完整校验
  {
    const c0 = chapters[0];
    const text = have.has(c0.url) ? null : cleanText(await fetchCapped(c0.url));
    if (text !== null) {
      const bad = valid(text);
      if (bad) { console.error('自检失败:', bad, '| head=', text.slice(0, 40)); process.exit(4); }
      fs.appendFileSync(storeFile, JSON.stringify({ title: c0.title, url: c0.url, text }) + '\n');
      have.add(c0.url);
      console.log(`自检通过: ${text.length}字 开头: ${text.slice(0, 20)}`);
    } else console.log('自检章节已在断点中，跳过');
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
      if (done % 100 === 0 || done === todo.length) {
        const mb = (process.memoryUsage().heapUsed / 1048576).toFixed(0);
        console.log(`  ${done}/${todo.length} (${((Date.now() - t0) / 1000).toFixed(0)}s heap=${mb}M fail=${fails})`);
      }
    }
  }));
  console.log(`完成: ${have.size}/${chapters.length} 章, 失败=${fails}（重跑自动补缺） heap=${(process.memoryUsage().heapUsed / 1048576).toFixed(0)}M`);
}
main().catch(e => { console.error('FATAL', e); process.exit(9); });
