// 通用多源搜书（复用 doupo find-source 逻辑）：node find-source-generic.mjs <书名> <输出json>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const [KW, OUTFILE] = process.argv.slice(2);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'book_source.txt'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getDoc(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 9000);
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: url }, signal: c.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error('http');
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 4000 && /URL过滤|拦截/.test(buf.toString('utf8'))) throw new Error('blocked');
      return cheerio.load(buf.toString('utf8'));
    } catch { await sleep(300); }
  }
  return null;
}
const found = [];
for (const s of SOURCES) {
  if (!s.search_url || !s.search_result) continue;
  const sr = typeof s.search_result === 'string' ? eval('(' + s.search_result + ')') : s.search_result;
  const su = s.search_url.replace('###keyword###', encodeURIComponent(KW));
  const $ = await getDoc(su);
  if (!$) { console.log('x', s.source_url); continue; }
  const items = [];
  $(sr.list || '').each((i, el) => {
    const nameEl = sr.url ? $(el).find(sr.url).first() : $(el).find(sr.name).first();
    const name = (sr.name ? $(el).find(sr.name).first().text() : nameEl.text()).replace(/\s+/g, '').trim();
    const href = nameEl.attr('href') || '';
    if (name && href) items.push({ name, href });
  });
  const hit = items.find(x => x.name === KW) || items.find(x => x.name.includes(KW));
  if (hit) {
    const bookUrl = new URL(hit.href, s.source_url).href;
    const $b = await getDoc(bookUrl);
    let ch = 0;
    try { ch = $b(s.book_menu).length || $b(s.book_menu.replace(/:gt\(\d+\)/, '')).length; } catch {}
    found.push({ source: s.source_url, name: hit.name, bookUrl, chapters: ch, menu: s.book_menu, content: s.chapter_content });
    console.log('HIT', s.source_url, '|', hit.name, '|', ch, '章');
    if (found.length >= 3) break;
  }
  await sleep(300);
}
fs.writeFileSync(OUTFILE, JSON.stringify(found, null, 1));
console.log('候选', found.length);
