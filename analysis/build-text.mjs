// 【已停用 2026-10-23】原文阅读功能按用户拍板移除（本地个人版，避免分发风险）。本脚本与 fetch-text/guimi 管线保留备用：
// 若恢复阅读功能：重跑本脚本重建 text 块 → sync-data → 恢复前端 TextReader 组件与会话记录中的接线。
// 原文入库：两本书的章节文本 → plugin/data/text/<bookId>/t{N}.json 分块 + 书目 JSON 里挂 textIndex（目录）
// 分块 150 章/块，块文件独立按需加载（阅读器不整本拉）。正文不进主上下文、不进 git。
// 用法：node build-text.mjs [bookId...]   （缺省处理有原文数据的所有书）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'plugin', 'data');
const CHUNK = 150;

// 盗版源推广尾巴（对全部书目统一清洗；"公众号"等普通词不在此列——玄鉴作者感言里有合法出现）
const PROMO_RE = [/扫描下面二维码[^\n]*/g, /yunyuedu[^\n]*/gi, /云阅读网[^\n]*/g, /请记住本书首发域名[^\n]*/g, /关注后[^\n]{0,50}更新[^\n]*/g, /最新章节[^\n]{0,30}观看[^\n]*/g];

// 章内自动分段：源文本无换行时按句末标点切 ~180 字段（阅读体验），已有换行的保留原样
function parafy(text) {
  if (!text) return '';
  for (const re of PROMO_RE) text = text.replace(re, '');
  text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+(\n)/g, '$1').trim();
  if (text.includes('\n')) return text.replace(/\n{2,}/g, '\n').trim();
  const parts = [];
  let buf = '';
  for (const ch of text) {
    buf += ch;
    if ('。！？”'.includes(ch) && buf.length >= 160) { parts.push(buf); buf = ''; }
  }
  if (buf) parts.push(buf);
  return parts.join('\n');
}

const loaders = {
  xuanjianxianzu() {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw', 'chapters.json'), 'utf8'));
    return j.map(c => ({ t: c.title, x: parafy(c.text) }));
  },
  fanrenxiuxianzhuan() {
    const dir = path.join(__dirname, 'fanren', 'text');
    const chapters = JSON.parse(fs.readFileSync(path.join(dir, 'chapters.json'), 'utf8'));
    const byUrl = new Map();
    for (const line of fs.readFileSync(path.join(dir, 'store.ndjson'), 'utf8').split(String.fromCharCode(10))) {
      if (!line.trim()) continue;
      try { const o = JSON.parse(line); if (o.text) byUrl.set(o.url, o); } catch {}
    }
    // 推广清洗已统一在 parafy（PROMO_RE）
    const out = [];
    for (const c of chapters) {
      const o = byUrl.get(c.url);
      if (!o) continue;
      out.push({ t: o.title, x: parafy(o.text) });
    }
    return out;
  },
  guimizhizhu() {
    const dir = path.join(__dirname, 'guimi', 'text');
    const chapters = JSON.parse(fs.readFileSync(path.join(dir, 'chapters.json'), 'utf8'));
    const byUrl = new Map();
    for (const line of fs.readFileSync(path.join(dir, 'store.ndjson'), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const o = JSON.parse(line); if (o.text) byUrl.set(o.url, o); } catch {}
    }
    const out = [];
    for (const c of chapters) {
      const o = byUrl.get(c.url);
      if (o) out.push({ t: o.title, x: parafy(o.text) });
    }
    return out;
  },
};

for (const bookId of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(loaders)) {
  if (!loaders[bookId]) { console.error('无原文装载器:', bookId); process.exitCode = 1; continue; }
  const list = loaders[bookId]();
  if (list.length < 500) { console.error(`${bookId} 章节数异常: ${list.length}`); process.exitCode = 1; continue; }
  const outDir = path.join(DATA, 'text', bookId);
  fs.mkdirSync(outDir, { recursive: true });
  // 清旧块（防止残留多块）
  for (const f of fs.readdirSync(outDir)) if (/^t\d+\.json$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  let totalChars = 0;
  const chunkCount = Math.ceil(list.length / CHUNK);
  for (let ci = 0; ci < chunkCount; ci++) {
    const slice = list.slice(ci * CHUNK, (ci + 1) * CHUNK).map((c, i) => ({ n: ci * CHUNK + i + 1, t: c.t, x: c.x }));
    for (const c of slice) totalChars += c.x.length;
    fs.writeFileSync(path.join(outDir, `t${ci}.json`), JSON.stringify(slice), 'utf8');
  }
  const titles = list.map(c => c.t);
  // 挂 textIndex 到书目 JSON
  const bookFile = path.join(DATA, `${bookId}.json`);
  const book = JSON.parse(fs.readFileSync(bookFile, 'utf8'));
  book.textIndex = { chunks: chunkCount, count: list.length, perChunk: CHUNK, titles };
  book.reading = true; // 前端：书目卡片显示"可阅读原文"
  fs.writeFileSync(bookFile, JSON.stringify(book));
  const sizeMB = (fs.readdirSync(outDir).reduce((n, f) => n + fs.statSync(path.join(outDir, f)).size, 0) / 1048576).toFixed(1);
  console.log(`[${bookId}] ${list.length} 章 → ${chunkCount} 块（${sizeMB}MB），字数≈${(totalChars / 10000).toFixed(0)}万，textIndex 已挂到书目 JSON`);
}
