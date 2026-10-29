// 斗破苍穹 定点取景（通道C：原文只落盘提取，不入库）
// Phase1 目录 → Phase2 按标题锚定名场面章节 → Phase3 人物外貌/场景段落共现提取 → 档案 brief
// 内存安全规矩同 fetch-guimi-text：剥脚本再取文本/汉字占比校验/限长/并发3/heap日志
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.join(__dirname, 'text');
fs.mkdirSync(WORK, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TOC_URL = 'http://www.yunxs.la/doupocangqiong/';
const MENU_SEL = '.list_box ul li a';
const CONTENT_SEL = '.box_box';
const CONCURRENCY = 3;
const MAX_BYTES = 3 * 1024 * 1024;
const FILTERS = [
  /云序.{0,6}小说网?.{0,30}/g, /请记住本书首发域名.{0,30}/g, /手机版阅读网址.{0,30}/g,
  /最新章节请.{0,20}/g, /www\.[a-z0-9-]+\.(la|info|com|org|net|cc|lol)/gi, /（本章完）/g,
  /一秒记住.{0,30}/g, /天才一秒记住.{0,30}/g, /求收藏.{0,10}/g, /求推荐票.{0,10}/g, /求月票.{0,10}/g,
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchCapped(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(new Error('timeout')), 25000);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: TOC_URL }, signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const reader = res.body.getReader();
      const chunks = []; let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) throw new Error('page too big');
        chunks.push(value);
      }
      return Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
    } catch (e) { lastErr = e; await sleep(1200 * (i + 1)); }
    finally { clearTimeout(t); }
  }
  throw lastErr;
}
function cleanText(html) {
  const $ = cheerio.load(html);
  const node = $(CONTENT_SEL).clone();
  node.find('script,style,ins,iframe').remove();
  // 关键：源站用 <br>/无 <p> 分段，直接 .text() 会零换行整章一段——先把块级边界转成换行
  node.find('br').replaceWith('\n');
  node.find('p, div').after('\n');
  let text = node.text();
  text = text.replace(/\u00a0/g, ' ').replace(/[ \t\r]+/g, '').replace(/\n{3,}/g, '\n\n');
  for (const f of FILTERS) text = text.replace(f, '');
  return text.trim();
}
const hanRatio = s => (s.match(/[\u4e00-\u9fa5]/g) || []).length / Math.max(1, s.length);

// ---------- Phase 1: 目录 ----------
const catFile = path.join(WORK, 'catalog.json');
let catalog;
if (fs.existsSync(catFile)) {
  catalog = JSON.parse(fs.readFileSync(catFile, 'utf8'));
  console.log('目录已缓存:', catalog.length, '章');
} else {
  const html = await fetchCapped(TOC_URL);
  const $ = cheerio.load(html);
  catalog = [];
  $(MENU_SEL).each((i, el) => {
    const t = $(el).text().replace(/\s+/g, '').trim();
    const href = $(el).attr('href');
    if (!t || !href) return;
    const m = /第([零一二三四五六七八九十百千万\d]+)章(.*)/.exec(t);
    if (!m) return; // JUNK 黑名单：非章节行直接丢
    catalog.push({ i: catalog.length + 1, title: t, url: new URL(href, TOC_URL).href });
  });
  // 中文数字章号去重（同章号保留首个）
  const seen = new Set();
  catalog = catalog.filter(c => {
    const k = (c.title.match(/第[^章]+章/) || [c.title])[0];
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  fs.writeFileSync(catFile, JSON.stringify(catalog));
  console.log('目录抓取:', catalog.length, '章 ->', catalog[0]?.title, '...', catalog[catalog.length - 1]?.title);
}

// ---------- Phase 2: 标题锚定目标章节 ----------
const CHAR_SCENES = {
  萧炎: ['三年之约', '佛怒火莲', '陨落心炎', '异火', '一拳', '云岚宗'],
  药尘: ['药老', '药尘', '骨灵冷火', '灵魂', '重塑'],
  萧薰儿: ['薰儿', '古族', '成人礼', '天墓'],
  彩鳞: ['美杜莎', '彩鳞', '蛇人', '七彩'],
  云韵: ['云韵', '宗主'],
  小医仙: ['小医仙', '厄难', '毒'],
  紫妍: ['紫妍', '古龙', '兽域', '龙皇', '天目山', '噬金', '老龙皇'],
  魂天帝: ['魂天帝', '魂族', '净莲', '帝品', '古族大战', '双帝'],
};
const NAME_ALTS = {
  小医仙: ['小医仙', '厄难毒体'],
  彩鳞: ['彩鳞', '美杜莎'],
  药尘: ['药尘', '药老'],
  萧薰儿: ['萧薰儿', '薰儿'],
  紫妍: ['紫妍', '紫研'],
};
const target = new Map(); // url -> {reasons:Set}
for (const [ch, kws] of Object.entries(CHAR_SCENES)) {
  let n = 0;
  for (const c of catalog) {
    if (kws.some(k => c.title.includes(k))) {
      if (!target.has(c.url)) target.set(c.url, { c, reasons: new Set() });
      target.get(c.url).reasons.add(ch);
      if (++n >= 12) break; // 每角色最多锚 12 章
    }
  }
}
const targets = [...target.values()];
const total = targets.length;
console.log('锚定章节:', total, '(预算~150)');
if (total > 150) { targets.length = 150; }

// ---------- Phase 3: 抓取 + 段落共现提取 ----------
const APPEAR_RE = /(身穿|穿着|一袭|身着|袍|衣衫|长裙|短裙|长发|白发|黑发|青丝|眸[子光中]|双眸|眼睛|眼眸|容颜|容貌|面容|脸庞|肌肤|面纱|少女|老者|青年|男子|女子|少年)/;
const textDir = path.join(WORK, 'chapters');
fs.mkdirSync(textDir, { recursive: true });
const parasByChar = Object.fromEntries(Object.keys(CHAR_SCENES).map(k => [k, []]));
let done = 0, ok = 0;
async function worker(queue) {
  while (queue.length) {
    const { c, reasons } = queue.shift();
    const file = path.join(textDir, c.i + '.txt');
    let text;
    if (fs.existsSync(file)) text = fs.readFileSync(file, 'utf8');
    else {
      try {
        const html = await fetchCapped(c.url);
        text = cleanText(html);
        if (text.length < 500 || hanRatio(text) < 0.5) throw new Error('内容校验失败 len=' + text.length);
        fs.writeFileSync(file, text);
      } catch (e) { done++; continue; }
    }
    ok++;
    // 按角色抽外貌共现段
    const paras = text.split(/\n+/).map(p => p.trim()).filter(p => p.length >= 30 && p.length <= 300);
    for (const [ch] of Object.entries(CHAR_SCENES)) {
      const nameAlts = NAME_ALTS[ch] || [ch];
      for (const p of paras) {
        if (!nameAlts.some(nm => p.includes(nm))) continue;
        if (!APPEAR_RE.test(p)) continue;
        const score = (p.match(new RegExp(APPEAR_RE.source, 'g')) || []).length;
        parasByChar[ch].push({ n: c.i, t: c.title, score, p });
      }
    }
    done++;
    if (done % 10 === 0) console.log(`进度 ${done}/${total} ok=${ok} heap=${(process.memoryUsage().heapUsed / 1048576).toFixed(0)}MB`);
  }
}
const queue = [...targets];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
console.log(`抓取完成: ${ok}/${total} 章落盘`);

// ---------- Phase 4: 每角色取 top 段落写档案 brief ----------
const briefDir = path.join(__dirname, '档案');
fs.mkdirSync(briefDir, { recursive: true });
for (const [ch, list] of Object.entries(parasByChar)) {
  list.sort((a, b) => b.score - a.score);
  // 去重近似段（前 12 字相同视为重复）
  const seen = new Set();
  const top = [];
  for (const x of list) {
    const k = x.p.slice(0, 12);
    if (seen.has(k)) continue;
    seen.add(k);
    top.push(x);
    if (top.length >= 8) break;
  }
  const lines = top.map(x => `- 【${x.t}】${x.p}`);
  fs.writeFileSync(path.join(briefDir, ch + '-外貌提取.md'), `# ${ch} 外貌/场景段落提取（原文通道C，未入库）\n\n${lines.join('\n')}\n`);
  console.log(`${ch}: ${top.length} 段（池 ${list.length}）`);
}
