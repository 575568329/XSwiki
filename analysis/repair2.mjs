// 第二轮修复: 从 uuwx #content 修剩余坏章
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = p => path.join(__dirname, 'raw', p);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BAD = [874, 878, 895, 1149, 1289, 1448, 1497, 1499, 1504, 1517, 1521, 1523, 1526, 1528, 1532, 1535, 1539, 1542];

const chapters = JSON.parse(fs.readFileSync(RAW('chapters.json'), 'utf8'));
const cnumOf = t => parseInt(t.match(/第(\d+)章/)[1]);
const toc = JSON.parse(fs.readFileSync(path.join(__dirname, 'uu_toc.json'), 'utf8'));
const uuByNum = new Map();
for (const e of toc) uuByNum.set(cnumOf(e.title), e);

async function fetchPage(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) { lastErr = e; await sleep(1500 * (i + 1)); }
  }
  throw lastErr;
}

const sig = t => { const s = t.replace(/\s+/g, ''); return s.length < 1200 ? null : crypto.createHash('md5').update(s.slice(1000, 2000)).digest('hex'); };

(async () => {
  // 先记录现有签名（判断"修复后是否还与其他章重复"）
  const sigCount = new Map();
  for (const c of chapters) { const h = sig(c.text); if (h) sigCount.set(h, (sigCount.get(h) || 0) + 1); }

  for (const num of BAD) {
    const c = chapters.find(x => cnumOf(x.title) === num);
    if (!c) { console.log('未找到章', num); continue; }
    const e = uuByNum.get(num);
    if (!e) { console.log('uuwx无此章', num); continue; }
    try {
      const html = await fetchPage(e.url);
      const $ = cheerio.load(html);
      let text = $('#content').text().replace(/\u00a0/g, ' ').replace(/[ \t]+/g, '')
        .replace(/最新网址：[^”"]*/g, '').replace(/UU小说网|www\.uuwx\.la/g, '').trim();
      const okLen = text.length >= 800 && !/正在手打中/.test(text);
      const h = sig(text);
      const stillDup = h && (sigCount.get(h) || 0) > 0;
      if (okLen && !stillDup) {
        const old = sig(c.text); if (old && sigCount.get(old)) sigCount.set(old, sigCount.get(old) - 1);
        if (h) sigCount.set(h, (sigCount.get(h) || 0) + 1);
        c.text = text;
        console.log('OK', c.title, text.length);
      } else {
        console.log('SKIP', c.title, 'len=', text.length, 'dup=', !!stillDup, 'placeholder=', /正在手打中/.test(text));
      }
    } catch (err) { console.log('FAIL', c.title, err.message); }
    await sleep(400);
  }
  fs.writeFileSync(RAW('chapters.json'), JSON.stringify(chapters));

  // 终检
  const seen = new Map(); let dup = 0;
  for (const c of chapters) {
    const h = sig(c.text); if (!h) continue;
    if (seen.has(h)) { dup++; console.log('仍重复:', c.title, '≈', chapters[seen.get(h) - 1].title); }
    else seen.set(h, c.no);
  }
  const ph = chapters.filter(c => /正在手打中/.test(c.text));
  console.log('== 终检 == 重复:', dup, ' 占位:', ph.length, ph.map(c => c.title).join(','));
  const total = chapters.reduce((s, c) => s + c.text.length, 0);
  console.log('总字数:', (total / 10000).toFixed(1) + '万');
})();
