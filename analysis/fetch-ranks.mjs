// 抓起点排行榜（人气/畅销/阅读指数/月票），提取书名作者
// 起点榜单页为 SSR+内嵌数据，直接解析 HTML
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const URLS = {
  人气榜: 'https://www.qidian.com/rank/',
  畅销榜: 'https://www.qidian.com/rank/hotsales/',
  阅读指数: 'https://www.qidian.com/rank/readindex/',
  月票榜: 'https://www.qidian.com/rank/yuepiao/',
};

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: ctrl.signal, redirect: 'follow' });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, html: buf.toString('utf8') };
  } finally { clearTimeout(t); }
}

const out = {};
for (const [name, url] of Object.entries(URLS)) {
  try {
    const { status, html } = await get(url);
    console.log(`[${name}] ${status} len=${html.length}`);
    // 起点内嵌数据：window.g_data = {...} 或书项 <h2 class="book-img-title"><a ...>书名</a>
    const titles = [...html.matchAll(/book-img-title[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g)].map(m => m[1].trim());
    const authors = [...html.matchAll(/book-img-author[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g)].map(m => m[1].trim());
    out[name] = { status, len: html.length, titles, authors, hasGdata: html.includes('g_data'), sample: html.slice(0, 0) };
    if (!titles.length) {
      // 兜底：找 JSON 数据形态
      const jd = html.match(/"bName":"([^"]{1,20})"/g);
      out[name].jsonNames = jd ? jd.slice(0, 25) : [];
    }
  } catch (e) { out[name] = { error: String(e).slice(0, 100) }; }
}
fs.writeFileSync('D:/cursorObject/小说Wiki/analysis/_rank_probe.json', JSON.stringify(out, null, 1), 'utf8');
for (const [k, v] of Object.entries(out)) {
  console.log('==', k, v.error || `titles=${v.titles.length} authors=${v.authors.length} g_data=${v.hasGdata}`);
  if (v.titles.length) console.log(v.titles.slice(0, 12).join(' | '));
  if (v.jsonNames && v.jsonNames.length) console.log(v.jsonNames.slice(0, 8).join(' '));
}
