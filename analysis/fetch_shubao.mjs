// 《玄鉴仙族》全本抓取 - 爱书包 shubaoge.org
// 带断点续传：进度存 raw/progress.json，重跑只补缺
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, 'raw');
fs.mkdirSync(RAW, { recursive: true });

const BOOK_URL = 'https://www.shubaoge.org/files/article/html/246/246083/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CONCURRENCY = 4;
const FILTERS = [
  /本站阅读（3秒记[^）]*）/g,
  /】，[^】]{0,30}和图书！/g,
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchText(url, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: BOOK_URL }, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (e) { lastErr = e; await sleep(2000 * (i + 1)); }
  }
  throw lastErr;
}

async function getChapters() {
  const html = await fetchText(BOOK_URL);
  const $ = cheerio.load(html);
  const seen = new Set();
  const chapters = [];
  $('a').each((i, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (/^第\S{1,8}章/.test(title) && /\/246083\/\d+\.html$/.test(href)) {
      const url = new URL(href, BOOK_URL).href;
      if (!seen.has(url)) { seen.add(url); chapters.push({ title, url }); }
    }
  });
  return chapters;
}

async function getChapter(ch) {
  const html = await fetchText(ch.url);
  const $ = cheerio.load(html);
  let text = $('#book_text').text() || $('#mains #book_text').text();
  text = text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, '');
  for (const f of FILTERS) text = text.replace(f, '');
  // 常见广告尾
  text = text.replace(/（未完待续）?$/,'').replace(/https?:\/\/\S+/g,'');
  return { title: ch.title, url: ch.url, text: text.trim() };
}

async function pool(items, n, fn, onProgress) {
  const results = new Array(items.length);
  let idx = 0, done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (idx < items.length) {
      const my = idx++;
      try { results[my] = { ok: true, ...(await fn(items[my], my)) }; }
      catch (e) { results[my] = { ok: false, error: String(e.message || e) }; }
      done++; if (done % 50 === 0 || done === items.length) onProgress(done, items.length);
    }
  }));
  return results;
}

async function main() {
  console.log('获取目录...');
  const chapters = await getChapters();
  console.log(`章节数: ${chapters.length}, 首: ${chapters[0]?.title}, 尾: ${chapters.at(-1)?.title}`);
  if (chapters.length < 100) { console.error('章节数异常'); process.exit(3); }

  const storeFile = path.join(RAW, 'store.ndjson');
  const store = new Map();
  if (fs.existsSync(storeFile)) {
    for (const line of fs.readFileSync(storeFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const o = JSON.parse(line); if (o.text) store.set(o.url, o); } catch {}
    }
    console.log(`断点续传: 已有 ${store.size} 章`);
  }
  const todo = chapters.filter(c => !store.has(c.url));
  console.log(`待抓取: ${todo.length} 章`);

  const t0 = Date.now();
  const ws = fs.createWriteStream(storeFile, { flags: 'a' });
  let fail = 0;
  await pool(todo, CONCURRENCY, async (ch) => {
    const r = await getChapter(ch);
    if (!r.text || r.text.length < 200) throw new Error(`内容过短(${r.text.length})`);
    ws.write(JSON.stringify({ title: r.title, url: r.url, text: r.text }) + '\n');
    store.set(r.url, r);
  }, (done, total) => console.log(`  ${done}/${total} (${((Date.now() - t0) / 1000).toFixed(0)}s)`));
  ws.end();

  // 组装最终 txt
  const parts = [];
  let missing = 0, totalChars = 0;
  for (const c of chapters) {
    const s = store.get(c.url);
    if (!s) { missing++; continue; }
    parts.push(`【${c.title}】\n${s.text}`);
    totalChars += s.text.length;
  }
  const outFile = path.join(RAW, '玄鉴仙族.txt');
  fs.writeFileSync(outFile, parts.join('\n\n'));
  console.log(`完成: ${outFile}  章节缺失=${missing}  总字数≈${(totalChars / 10000).toFixed(1)}万`);
  if (missing > 0) console.log('存在缺失章节，可重跑脚本自动补抓');
}

main().catch(e => { console.error('FATAL', e); process.exit(9); });
