// 立绘内容审核：白名单 ↔ 成品图 ↔ 提示词/清单 ↔ 盲审判定 ↔ 三副本 ↔ dist 全链一致性 + 敏感词扫描
// 用法：node audit.mjs（在 sync-data / build / test 全绿之后作为交付前最后一道关）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const READ = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));

const problems = [];
const warns = [];
const ok = [];
const bad = t => problems.push(t);

// 1) 白名单
const whitelist = JSON.parse(READ('plugin/data/images.json'));
ok.push(`白名单 ${whitelist.length} 人`);

// 2) 花名册 id 校验（每个白名单 id 必须存在于某本书）
const idBook = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'plugin/data')).filter(f => f.endsWith('.json') && !['index.json', 'images.json', 'prompts.json', 'archives.json', 'manifest.json'].includes(f))) {
  try {
    const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin/data', f), 'utf8'));
    if (b.id && Array.isArray(b.characters)) for (const c of b.characters) idBook.set(c.id, b.id);
  } catch {}
}
for (const id of whitelist) if (!idBook.has(id)) bad(`白名单 id 不在任何书目：${id}`);
ok.push('书目 id 校验完成');

// 3) 三副本 PNG
for (const id of whitelist) {
  for (const dir of ['plugin/data/images', 'server/data/images', 'plugin-src/public/data/images']) {
    if (!exists(`${dir}/${id}.png`)) bad(`缺 PNG 副本：${dir}/${id}.png`);
  }
}
ok.push('三副本 PNG 校验完成');

// 4) prompt/checklist 存在 + 敏感词扫描（句子级否定豁免：禁令列举句合规）
const SENSITIVE = [/血(迹|腥|污|泊)/, /尸(体|斑|骸)/, /獠牙/, /腐(肉|烂)/, /斩首/, /断肢/, /内脏/];
const NEG = /(不|无|禁|没有|非|勿|避免|不许|不得)/;
for (const id of whitelist) {
  const pf = `analysis/立绘成品/prompts/${id}.prompt.txt`;
  const cf = `analysis/立绘成品/prompts/${id}.checklist.md`;
  if (!exists(pf)) { warns.push(`缺提示词（历史批次以台账为准）：${id}`); continue; }
  if (!exists(cf)) { bad(`缺清单：${id}`); continue; }
  const txt = READ(pf);
  for (const sentence of txt.split(/[。；\n]/)) {
    if (NEG.test(sentence)) continue; // 负面行/禁令句中的列举合规
    for (const re of SENSITIVE) {
      if (re.test(sentence)) { warns.push(`${id}.prompt 正面语境含敏感词「${sentence.match(re)[0]}」——人工确认：${sentence.trim().slice(0, 40)}`); break; }
    }
  }
  // 原文引用泄漏粗检：提示词不应包含成段引号原文（检测中文引号包裹的超长句）
  if (/「[^」]{80,}」/.test(txt)) warns.push(`${id}.prompt 含超长引号句——人工确认是否原文泄漏`);
}
ok.push(`提示词/清单存在性 + 敏感词扫描完成（${whitelist.length} 人）`);

// 5) 盲审判定覆盖 + 反向核查：B3（SOP 化）之后的白名单 id 必须有 accept 系 verdict；
//    反向：有 accept 系 verdict 且不在挂起名单的 id 必须已入白名单（防漏加）
const SOP_ERA = new Set(['liqinghong', 'lijiangqian', 'litongya', 'lizhouwei', 'lixuanxuan', 'liyuanjiao', 'liximing', 'lixizhi', 'lixijun', 'lujiangxian', 'liquewan', 'lixuanfeng', 'chibuzi', 'liuchangdie']);
const SUSPENDED = new Set(['kelaienmoleidi', 'jiadeliya', 'dengenshimisi', 'yadang', 'helabogen', 'badehaier', 'beihailongwang', 'weiyuan', 'xiaoxuner', 'liximing', 'guhuojin', 'zhengqiyujixiezhishen']);
const reviewsDir = path.join(ROOT, 'analysis/立绘成品/reviews');
const reviews = fs.existsSync(reviewsDir) ? fs.readdirSync(reviewsDir) : [];
const byId = {};
for (const f of reviews) {
  const m = f.match(/^([\w]+)\.(r\d+)\.md$/);
  if (!m) continue;
  (byId[m[1]] = byId[m[1]] || []).push({ r: parseInt(m[2]), f });
}
// 人工验收记录（analysis/立绘成品/人工验收.json）：用户看图拍板的收货，与盲审过审同级
const MANUAL_OK = (() => {
  const f = 'analysis/立绘成品/人工验收.json';
  if (!fs.existsSync(path.join(ROOT, f))) return new Set();
  return new Set(Object.keys(JSON.parse(READ(f)).accepted || {}));
})();
for (const id of whitelist) {
  if (SOP_ERA.has(id)) continue; // B1/B2 历史批次：判定记录在成果台账
  const files = (byId[id] || []).sort((a, b) => a.r - b.r);
  if (!files.length) {
    if (MANUAL_OK.has(id)) continue; // 1301 隔离等无盲审记录的人工收货
    bad(`无盲审记录：${id}`); continue;
  }
  const last = READ(`analysis/立绘成品/reviews/${files.at(-1).f}`);
  const verdict = (last.match(/总判定[^\n]*\n?[^\n]*\n?[^\n]*/) || [''])[0];
  if (!/accept|PASS|收货/i.test(verdict)) {
    if (MANUAL_OK.has(id)) continue; // 用户人工验收覆盖最终轮否决
    bad(`${id} 最终盲审非过审（${files.at(-1).f}：${verdict.replace(/\n/g, ' ').slice(0, 50)}）`);
  }
}
for (const [id, files] of Object.entries(byId)) {
  if (whitelist.includes(id) || SUSPENDED.has(id) || SOP_ERA.has(id)) continue;
  const filesSorted = files.sort((a, b) => a.r - b.r);
  const last = READ(`analysis/立绘成品/reviews/${filesSorted.at(-1).f}`);
  const verdict = (last.match(/总判定[^\n]*\n?[^\n]*\n?[^\n]*/) || [''])[0];
  if (/accept|PASS|收货/i.test(verdict)) bad(`${id} 已过审但未入白名单（反向核查）`);
}
ok.push('盲审判定覆盖 + 白名单反向核查完成（B1/B2 历史批次以台账为准）');

// 6) prompts.json / archives.json / dist 一致性
const prompts = JSON.parse(READ('plugin/data/prompts.json'));
const archives = JSON.parse(READ('plugin/data/archives.json'));
for (const id of whitelist) {
  if (!prompts[id]) warns.push(`prompts.json 缺 ${id}（卡片提示词弹窗将为空）`);
  if (!archives[id]) warns.push(`archives.json 缺 ${id}（着装档案页将为空）`);
}
if (JSON.stringify(READ('plugin/data/images.json')) !== JSON.stringify(READ('plugin-src/dist/data/images.json'))) bad('dist images.json 与源不一致');
if (JSON.stringify(READ('plugin/data/prompts.json')) !== JSON.stringify(READ('plugin-src/dist/data/prompts.json'))) bad('dist prompts.json 与源不一致');
if (JSON.stringify(READ('plugin/data/archives.json')) !== JSON.stringify(READ('plugin-src/dist/data/archives.json'))) bad('dist archives.json 与源不一致');
ok.push('dist 一致性校验完成');

// 7) 孤儿提示词（有 prompt 未入白名单=在途或挂起，仅提示）
const orphans = Object.keys(prompts).filter(id => !whitelist.includes(id));
if (orphans.length) warns.push(`未入白名单的提示词（在途/挂起）${orphans.length} 个：${orphans.join(',')}`);

// 汇总
console.log('=== 内容审核报告 ===');
console.log(`白名单: ${whitelist.length} 人`);
for (const o of ok) console.log('✓ ' + o);
if (warns.length) { console.log(`\n⚠ 人工复核项 ${warns.length}：`); for (const w of warns) console.log('  ⚠ ' + w); }
if (problems.length) { console.log(`\n✗ 阻断问题 ${problems.length}：`); for (const p of problems) console.log('  ✗ ' + p); process.exitCode = 1; }
else console.log('\n✅ 无阻断问题' + (warns.length ? `（含 ${warns.length} 项人工复核）` : ''));
