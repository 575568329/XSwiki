// 修复章节：1) 手打占位章 2) 内容重复的假章(866-895段) —— 从 uuwx 重抓，得奇兜底
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = p => path.join(__dirname, 'raw', p);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chapters = JSON.parse(fs.readFileSync(RAW('chapters.json'), 'utf8'));
const cnumOf = t => parseInt(t.match(/第(\d+)章/)[1]);

// ---- 1) 定位坏章：占位 或 与前面章节内容重复 ----
const sig = t => { const s = t.replace(/\s+/g, ''); return s.length < 1200 ? null : crypto.createHash('md5').update(s.slice(1000, 2000)).digest('hex'); };
const seen = new Map(); // sig -> first chapter no
const bad = new Set();
for (const c of chapters) {
  if (/正在手打中|请稍等片刻/.test(c.text)) bad.add(c.no);
  const h = sig(c.text);
  if (h) {
    if (seen.has(h)) bad.add(c.no); // 后出现的视为假
    else seen.set(h, c.no);
  }
}
console.log('待修复章节数:', bad.size);

// ---- 2) uuwx 目录 ----
const uuToc = JSON.parse(fs.readFileSync(path.join(__dirname, 'uu_toc.json'), 'utf8'));
const uuByNum = new Map();
for (const e of uuToc) uuByNum.set(cnumOf(e.title), e);

// ---- 3) deqi 目录（全量）----
const deqiHtml = fs.readFileSync(path.join(__dirname, 'book_deqi.html'), 'utf8');
const deqiToc = [...deqiHtml.matchAll(/<a [^>]*href="(https:\/\/www\.deqixs\.org\/12\/(\d+)\.html)"[^>]*>(第[0-9]+章[^<]{0,30})</g)]
  .map(m => ({ title: m[3].trim(), url: m[1] })).filter(e => !/^\d+$/.test(e.title) || true);
const deqiByNum = new Map();
for (const e of deqiToc) deqiByNum.set(cnumOf(e.title), e);

// ---- 抓取器 ----
async function fetchText(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (e) { lastErr = e; await sleep(1500 * (i + 1)); }
  }
  throw lastErr;
}

const AD = /一秒记住【[^】]*】[^"\n]*/g;
async function uuChapter(num) {
  const e = uuByNum.get(num);
  if (!e) return null;
  const html = await fetchText(e.url);
  const $ = cheerio.load(html);
  let text = $('.box_box').text().replace(/\u00a0/g, ' ').replace(/[ \t]+/g, '').replace(AD, '');
  return text.trim();
}

async function deqiChapter(num) {
  const e = deqiByNum.get(num);
  if (!e) return null;
  let url = e.url, text = '';
  for (let p = 0; p < 8; p++) {
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    text += $('.container > .con').text().replace(/\s+/g, '');
    let next = null;
    $('.container .prenext a').each((i, el) => { if ($(el).text().includes('下一页')) next = $(el).attr('href'); });
    if (!next) break;
    url = new URL(next, url).href;
  }
  return text.replace(/笔趣阁.{0,3}/g, '').trim();
}

(async () => {
  const fixed = [], failed = [];
  for (const no of [...bad].sort((a, b) => a - b)) {
    const c = chapters[no - 1];
    const num = cnumOf(c.title);
    let text = null, src = '';
    try { text = await uuChapter(num); src = 'uuwx'; } catch { }
    if (!text || text.length < 500 || /正在手打中/.test(text)) {
      try { text = await deqiChapter(num); src = 'deqi'; } catch { }
    }
    if (text && text.length >= 300 && !/正在手打中/.test(text)) {
      fixed.push({ no, title: c.title, src, len: text.length });
      c.text = text;
    } else {
      failed.push({ no, title: c.title });
    }
    await sleep(300);
  }
  console.log('修复成功:', fixed.length, '失败:', failed.length);
  failed.forEach(f => console.log('  FAIL', f.title));
  fixed.slice(0, 60).forEach(f => console.log('  OK', f.title, f.src, f.len));
  // 复检重复
  const seen2 = new Map(); let dup2 = 0;
  for (const c of chapters) { const h = sig(c.text); if (h) { if (seen2.has(h)) { dup2++; console.log('  仍重复:', c.title, '≈', chapters[seen2.get(h) - 1].title); } else seen2.set(h, c.no); } }
  console.log('复检剩余内容重复:', dup2);
  fs.writeFileSync(RAW('chapters.json'), JSON.stringify(chapters));
  const total = chapters.reduce((s, c) => s + c.text.length, 0);
  console.log('总字数:', (total / 10000).toFixed(1) + '万');
})();
