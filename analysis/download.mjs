// 通用小说下载器：按何以笙箫默书源规则抓取全本
// 用法: node download.mjs <source_name> [bookUrl]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { iconv } from 'iconv-lite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = JSON.parse(fs.readFileSync(path.join(__dirname, 'book_source.txt'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const KEYWORD = process.argv[3] ? '' : (process.env.KEYWORD || '玄鉴仙族');

const decodeFilters = (arr) => (arr || []).map(b64 => {
  try { return Buffer.from(b64, 'base64').toString('utf8'); } catch { return null; }
}).filter(Boolean);

function b64ToFilters(s) { return decodeFilters(s.content_filter); }

async function fetchBuf(url, timeout = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': new URL(url).origin + '/' }, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return Buffer.from(await res.arrayBuffer());
  } finally { clearTimeout(t); }
}

async function fetchText(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const buf = await fetchBuf(url);
      let html = buf.toString('utf8');
      // meta charset 检测（gbk 站点转码）
      const m = html.slice(0, 2000).match(/charset=["']?([\w-]+)/i);
      if (m && /gbk|gb2312/i.test(m[1])) html = iconv.decode(buf, 'gbk');
      return html;
    } catch (e) { lastErr = e; await sleep(1500 * (i + 1)); }
  }
  throw lastErr;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const abs = (base, href) => new URL(href, base).href;

function searchBook(src, keyword) {
  let url = src.search_url.replace('{{302}}', '');
  const isGet = !/###keyword###/.test(url) ? false : true;
  if (url.includes('e/search/index.php')) {
    // 帝国CMS GET 搜索
    url = url.replace('###keyword###', encodeURIComponent(keyword));
    return { url };
  }
  url = url.replace('###keyword###', encodeURIComponent(keyword));
  return { url };
}

async function doSearch(src, keyword) {
  const { url } = searchBook(src, keyword);
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const R = src.search_result;
  const items = [];
  $(R.list).each((i, el) => {
    const name = $(el).find(R.name).text().trim();
    const href = $(el).find(R.url).attr(R.url_attr || 'href');
    if (name && href) items.push({ name, url: abs(src.source_url, href) });
  });
  return items;
}

async function getMenu(src, bookUrl) {
  const html = await fetchText(bookUrl);
  const $ = cheerio.load(html);
  const name = src.book_name && src.book_name !== 'none' ? $(src.book_name).first().text().trim() : '';
  const chapters = [];
  $(src.book_menu).each((i, el) => {
    const t = $(el).text().trim();
    const href = $(el).attr(src.book_menu_attr || 'href');
    if (t && href) chapters.push({ title: t, url: abs(bookUrl, href) });
  });
  return { name, chapters };
}

async function getChapter(src, ch) {
  const html = await fetchText(ch.url);
  const $ = cheerio.load(html);
  const title = ch.title || $(src.chapter_title).first().text().trim();
  const content = $(src.chapter_content).first().text();
  let text = content.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, '');
  for (const f of b64ToFilters(src)) {
    try { text = text.replace(new RegExp(f, 'g'), ''); } catch {}
  }
  return { ...ch, title, text: text.trim() };
}

async function pool(items, n, fn, onProgress) {
  const results = new Array(items.length);
  let idx = 0, done = 0;
  const workers = Array.from({ length: n }, async () => {
    while (idx < items.length) {
      const my = idx++;
      results[my] = await fn(items[my], my);
      done++; onProgress && onProgress(done, items.length);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const [sourceName, bookUrlArg] = process.argv.slice(2);
  const src = SOURCES.find(s => s.source_name === sourceName);
  if (!src) { console.error('找不到书源:', sourceName); process.exit(1); }
  console.log(`书源: ${src.source_name} -> ${src.source_url}`);

  let bookUrl = bookUrlArg;
  if (!bookUrl) {
    console.log('搜索:', KEYWORD);
    const items = await doSearch(src, KEYWORD);
    console.log('结果:', items.map(x => `${x.name} ${x.url}`).join('\n  '));
    if (!items.length) process.exit(2);
    bookUrl = items[0].url;
  }
  console.log('书页:', bookUrl);
  const { name, chapters } = await getMenu(src, bookUrl);
  console.log(`书名: ${name}  章节数: ${chapters.length}`);
  if (chapters.length < 100) { console.error('章节数异常，中止'); process.exit(3); }

  const t0 = Date.now();
  const results = await pool(chapters, 6, async (ch, i) => {
    try { return await getChapter(src, ch); }
    catch (e) { return { ...ch, text: '', error: String(e.message || e) }; }
  }, (done, total) => {
    if (done % 100 === 0 || done === total) console.log(`  进度 ${done}/${total} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  });

  const errs = results.filter(r => r.error || !r.text);
  console.log(`完成，失败章节: ${errs.length}`);
  if (errs.length) fs.writeFileSync(path.join(__dirname, 'raw', 'errors.json'), JSON.stringify(errs, null, 1));

  const outFile = path.join(__dirname, 'raw', `${KEYWORD}.txt`);
  const parts = [];
  for (const r of results) parts.push(`【${r.title}】\n${r.text}\n`);
  fs.writeFileSync(outFile, parts.join('\n'));
  fs.writeFileSync(path.join(__dirname, 'raw', 'chapters.json'), JSON.stringify(results.map(r => ({ title: r.title, url: r.url, chars: (r.text || '').length })), null, 0));
  const totalChars = results.reduce((s, r) => s + (r.text || '').length, 0);
  console.log(`已保存: ${outFile}  总字数≈${(totalChars / 10000).toFixed(1)}万`);
}

main().catch(e => { console.error('FATAL', e); process.exit(9); });
