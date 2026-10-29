// 扫描书源找《诡秘之主》：多源搜书 → 书页目录数比对 → 输出候选（不抓正文）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'book_source.txt'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const KW = '诡秘之主';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getDoc(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: url }, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      let html = buf.length > 5000 ? iconv.decode(buf, 'utf8') : iconv.decode(buf, 'gbk');
      // 内容级验证：拦截页
      if (buf.length < 4000 && /URL过滤|拦截/.test(html)) throw new Error('BLOCKED');
      return cheerio.load(html);
    } catch (e) { await sleep(400); }
  }
  return null;
}

const results = [];
for (const s of SOURCES) {
  if (!s.search_url || !s.search_result) continue;
  const su = s.search_url.replace('###keyword###', encodeURIComponent(KW));
  const $ = await getDoc(su);
  if (!$) { console.log('x 不可达/无结果:', s.source_url); continue; }
  const items = [];
  $(s.search_result.list).each((i, el) => {
    const nameEl = s.search_result.url ? $(el).find(s.search_result.url).first() : $(el).find(s.search_result.name).first();
    const name = (nameEl.text() || '').trim();
    const href = nameEl.attr('href') || '';
    if (name) items.push({ name, href });
  });
  const hit = items.find(it => it.name.includes(KW)) || (s.search_result.name ? null : null);
  // 有些源列表层本身就是 a
  if (!hit) {
    const alt = [];
    $(s.search_result.name || 'a').each((i, el) => {
      const name = $(el).text().trim();
      if (name === KW) alt.push({ name, href: $(el).attr('href') || '' });
    });
    if (alt.length) items.push(...alt);
  }
  const found = items.find(it => it.name.replace(/\s/g, '') === KW);
  if (!found) { console.log('- 有搜索无精确命中:', s.source_url, items.slice(0, 3).map(i => i.name).join('|')); continue; }
  const bookUrl = new URL(found.href, su).href;
  const $b = await getDoc(bookUrl);
  if (!$b) { console.log('! 书页不可达:', bookUrl); continue; }
  const menuSel = s.book_menu || 'a';
  let n = $b(menuSel).length;
  if (!n) n = $b('dl dd a').length;
  const first = ($b(menuSel).first().text() || $b('dl dd a').first().text() || '').trim();
  const last = ($b(menuSel).last().text() || $b('dl dd a').last().text() || '').trim();
  console.log(`✓ ${s.source_url} 章节=${n} 首=[${first}] 尾=[${last}] ${bookUrl}`);
  results.push({ source: s.source_url, bookUrl, n, menuSel: s.book_menu, content: s.chapter_content, filter: s.content_filter, charsetNote: s.book_charset || '' });
  if (results.length >= 4) break;
  await sleep(300);
}
fs.writeFileSync(path.join(__dirname, 'guimi-source-candidates.json'), JSON.stringify(results, null, 2), 'utf8');
console.log('候选已存 guimi-source-candidates.json:', results.length);
