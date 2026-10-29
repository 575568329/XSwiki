// 斗破苍穹 原文源探测：yunxs.la（诡秘/凡人主源）目录探测，正文不进上下文
// 注意：版权拍板后原文不入库，本探测只为将来"章号锚定"（阶段/时间线）备用
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
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
      const html = buf.toString('utf8'); // yunxs.la 已知 utf8（诡秘/凡人同源实测）
      if (buf.length < 4000 && /URL过滤|拦截/.test(html)) throw new Error('BLOCKED');
      return cheerio.load(html);
    } catch (e) { await sleep(400); }
  }
  return null;
}

const out = [];
const SLUGS = ['doupocangqiong', 'doupoCangqiong', 'doupocangqiong2023'];
for (const slug of SLUGS) {
  const url = `https://yunxs.la/${slug}/`;
  const $ = await getDoc(url);
  if (!$) { out.push({ slug, ok: false }); console.log('× 不可达:', url); await sleep(500); continue; }
  const title = $('title').text().trim();
  const links = [];
  $('a').each((i, el) => {
    const href = $(el).attr('href') || '';
    if (/\/\d+(_\d+)?\.html$/.test(href)) links.push(href);
  });
  const uniq = [...new Set(links)];
  const first = uniq[0], last = uniq[uniq.length - 1];
  out.push({ slug, ok: true, title, chapters: uniq.length, first, last });
  fs.writeFileSync(path.join(__dirname, 'text-catalog.json'), JSON.stringify(out, null, 1));
  console.log(`✓ ${url} | title: ${title} | 章节链接: ${uniq.length} | 首: ${first} | 末: ${last}`);
  await sleep(500);
}
fs.writeFileSync(path.join(__dirname, 'text-catalog.json'), JSON.stringify(out, null, 1));
console.log('汇总：', out.filter(o => o.ok).map(o => `${o.slug}=${o.chapters}章`).join(' | ') || '全部不可达');
