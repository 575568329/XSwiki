import * as cheerio from 'cheerio';
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const urls = JSON.parse(fs.readFileSync(new URL('./missing_urls.json', import.meta.url), 'utf8')).slice(0, 4);
const han = s => ((s.match(/[\u4e00-\u9fa5]/g) || []).length) / Math.max(1, s.length);
for (const { i, url } of urls) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.shubaoge.org/files/article/html/246/246083/' } });
    const html = await res.text();
    const $ = cheerio.load(html);
    const t = $('#book_text').text().trim();
    const bodyLen = $('body').text().replace(/\s+/g, '').length;
    const br = $('#book_text br').length;
    console.log('idx', i, 'http', res.status, 'pageChars', html.length, '#book_text len', t.length, 'han', (han(t) * 100).toFixed(0) + '%', 'br', br, 'bodyTextLen', bodyLen);
  } catch (e) { console.log('idx', i, 'ERR', e.message); }
  await new Promise(r => setTimeout(r, 800));
}
