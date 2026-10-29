// 斗破苍穹：多源搜书 → 找可达源与书目页（不抓正文）。复用 fanren/guimi 范式。
// 输出 analysis/doupo/source-candidates.json；正文只在后续 fetch-text 落盘，不进上下文
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'book_source.txt'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const KW = '斗破苍穹';
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
      const html = buf.toString('utf8');
      if (buf.length < 4000 && /URL过滤|拦截/.test(html)) throw new Error('BLOCKED');
      return cheerio.load(html);
    } catch (e) { await sleep(300); }
  }
  return null;
}

const results = [];
let done = 0;
for (const s of SOURCES) {
  if (!s.search_url || !s.search_result) continue;
  done++;
  const sr = typeof s.search_result === 'string' ? eval('(' + s.search_result + ')') : s.search_result;
  const su = s.search_url.replace('###keyword###', encodeURIComponent(KW));
  const $ = await getDoc(su);
  if (!$) { console.log('x', s.source_url); continue; }
  const items = [];
  $(sr.list || '').each((i, el) => {
    const nameEl = sr.url ? $(el).find(sr.url).first() : $(el).find(sr.name).first();
    const name = (sr.name ? $(el).find(sr.name).first().text() : nameEl.text()).replace(/\s+/g, '').trim();
    const href = nameEl.attr('href') || '';
    if (name && href) items.push({ name, href, author: sr.author ? $(el).find(sr.author).first().text().replace(/\s+/g, '') : '' });
  });
  const hit = items.find(x => x.name.includes(KW));
  if (hit) {
    const bookUrl = new URL(hit.href, s.source_url).href;
    // 验证书页可达 + 数章节数
    const $b = await getDoc(bookUrl);
    let chapters = 0, menuSel = s.book_menu;
    if ($b && menuSel) {
      try { chapters = $b(menuSel).length || $b(menuSel.replace(/:gt\(\d+\)/, '')).length; } catch {}
    }
    results.push({ source: s.source_url, name: hit.name, bookUrl, chapters, menu: menuSel, content: s.chapter_content });
    console.log(`✓ ${s.source_url} -> ${hit.name} (${chapters} 章, menu=${menuSel})`);
  } else {
    console.log('~', s.source_url, `可达但无结果(${items.length})`);
  }
  if (results.length >= 4) break; // 找到 4 个可用源就收手
  await sleep(350);
}
fs.writeFileSync(path.join(__dirname, 'source-candidates.json'), JSON.stringify(results, null, 1));
console.log(`\n候选 ${results.length} 个（扫描 ${done} 源）`);
