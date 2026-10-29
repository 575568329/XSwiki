import * as cheerio from 'cheerio';
import fs from 'node:fs';

const WORK = new URL('../text/', import.meta.url);
const BOOK = 'http://www.uuwx.la/ls/139_139290/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const catalog = JSON.parse(fs.readFileSync(new URL('../text/catalog.json', import.meta.url), 'utf8'));
const missing = catalog.filter(c => !fs.existsSync(new URL('../text/chapters/' + c.i + '.txt', import.meta.url)));
const first = missing[0];
// UU toc find same-number url
const cnum = s => {
  const map = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (/^\d+$/.test(s)) return parseInt(s);
  let n = 0, seg = 0;
  for (const c of s) {
    if (c === '十') { n += (seg || 1) * 10; seg = 0; }
    else if (c === '百') { n += (seg || 1) * 100; seg = 0; }
    else if (c === '千') { n += (seg || 1) * 1000; seg = 0; }
    else if (map[c] !== undefined) seg = map[c];
  }
  return n + seg;
};
const html = await fetch(BOOK, { headers: { 'User-Agent': UA } }).then(r => r.text());
const $ = cheerio.load(html);
let url = null;
$('#list a').each((_, el) => {
  const t = $(el).text().replace(/\s+/g, '').trim();
  const m = /第([零一二三四五六七八九十百千万\d]+)章/.exec(t);
  if (m && !url && cnum(m[1]) === 622) url = new URL($(el).attr('href'), BOOK).href;
});
if (!url) { console.log('no url'); process.exit(0); }
const page = await fetch(url, { headers: { 'User-Agent': UA, Referer: BOOK } }).then(r => r.text());
const $2 = cheerio.load(page);
const han = s => ((s.match(/[\u4e00-\u9fa5]/g) || []).length);
for (const sel of ['#content', '#booktxt', '#txt', '.showtxt', '#chaptercontent', 'body']) {
  const t = $2(sel).first().text().replace(/\s+/g, '');
  console.log('UU sel', sel, 'len', t.length, 'han', han(t));
}
console.log('tag census: div', $2('div').length, 'dd', $2('dd').length, 'br', $2('br').length, 'script', $2('script').length);
