// 构建插件数据: cards + roster归并 + mined复核 + 字辈 + 势力 + 拼音 -> plugin/data/xuanjianxianzu.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';
import { KEEP, DROP, ABSORB, MERGE_SAME, normGeneration, normFaction } from './review-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = p => path.join(__dirname, 'raw', p);
const CARDS = path.join(__dirname, 'cards');
const OUT_DIR = path.join(__dirname, '..', 'plugin', 'data');
fs.mkdirSync(OUT_DIR, { recursive: true });

const stats = JSON.parse(fs.readFileSync(RAW('name-stats.json'), 'utf8'));
const statByName = new Map(stats.map(s => [s.name, s]));
const cand = JSON.parse(fs.readFileSync(path.join(__dirname, 'candidates.json'), 'utf8'));

// 缺统计的名字直接全文扫描补算（字辈稀释导致n-gram漏检的补偿）
const chaptersCache = JSON.parse(fs.readFileSync(RAW('chapters.json'), 'utf8'));
function computeStats(name) {
  let total = 0, first = null, last = null, cnt = 0;
  for (const c of chaptersCache) {
    let i = 0, n = 0;
    while ((i = c.text.indexOf(name, i)) !== -1) { n++; i += name.length; }
    if (n) { total += n; cnt++; if (first == null) first = c.no; last = c.no; }
  }
  return total ? { total, chapterCount: cnt, first, last } : null;
}
function statsFor(name) {
  if (!statByName.has(name)) {
    const s = computeStats(name);
    if (s) { s.kind = 'roster'; statByName.set(name, s); }
  }
  return statByName.get(name);
}

// 李家字辈（世代顺序，人工核定的已知辈分 + 高频中字自动补）
const ZIBEI_ORDER = ['木', '长', '项', '通', '玄', '渊', '曦', '周', '绛', '遂', '阙'];
// 字辈标签
const genLabel = name => {
  const m = name.match(/^李([\u4e00-\u9fa5])[\u4e00-\u9fa5]$/);
  if (!m) return '';
  const i = ZIBEI_ORDER.indexOf(m[1]);
  return i >= 0 ? `李家${ZIBEI_ORDER.indexOf(m[1]) + 1}世（${m[1]}字辈）` : '';
};

// ---------- 1) tier1: 画像卡 ----------
const cards = [];
for (const f of fs.readdirSync(CARDS).filter(f => f.endsWith('.json'))) {
  try { cards.push(JSON.parse(fs.readFileSync(path.join(CARDS, f), 'utf8'))); } catch (e) { console.log('坏卡', f, e.message); }
}
console.log('画像卡:', cards.length);

// ---------- oneLiner 清洗 + 防剧透安全句 ----------
// 清洗: 剥笔记体前缀(仅提及/（提及）/N番外/（仅…）)，按句读断句替代硬截断
const NOTE_PREFIX = /^(仅提及[:：]?|（提及）|（仅提及）|\d+番外[:：]?|535番外[:：]?|（[^）]{0,4}）)/;
function cleanOneLiner(note) {
  let s = (note || '').trim();
  let prev;
  do { prev = s; s = s.replace(NOTE_PREFIX, '').trim(); } while (s !== prev); // 连续剥
  if (!s) return '';
  // 断句: 优先句号/分号，其次 60 字内最后一个逗号
  const m = s.match(/^[^。；]{6,60}[。；]/);
  if (m) return m[0].replace(/[。；]$/, '');
  if (s.length <= 64) return s;
  const c = s.lastIndexOf('，', 60);
  return (c > 20 ? s.slice(0, c) : s.slice(0, 60)) + '…';
}

// 剧透词: 列表安全句要剔掉含这些词的分句
const SPOILER_RE = /(陨落|身死|战死|被杀|所杀|殒命|死亡|死了|坐化|兵解|败亡|重伤不治|同归于尽|自尽|身亡)/;
function safeOneLiner(oneLiner) {
  if (!oneLiner || !SPOILER_RE.test(oneLiner)) return oneLiner || '';
  // 去掉含剧透词的逗号分句；若整句都是剧透 → 返回占位
  const parts = oneLiner.split(/，|。|；/).filter(Boolean);
  const safe = parts.filter(p => !SPOILER_RE.test(p));
  return safe.length ? safe.slice(0, 3).join('，') : '身份信息详见人物卡（含剧情）';
}

// ---------- 2) 组装 ----------
const out = new Map();
const dropSet = new Set([...DROP, '释修']);
const absorbInto = new Map(); // 被吸收名 -> 保留名
for (const a of ABSORB) for (const x of a.absorb) absorbInto.set(x, a.keep); // __PREFIX2__ 值也映射，构建期按 drop 处理
const sameMerge = new Map(); // 同人归并
for (const m of MERGE_SAME) for (const x of m.absorb) sameMerge.set(x, m.keep);

function ensure(name, tier) {
  let e = out.get(name);
  if (!e) {
    const s = statsFor(name);
    e = {
      id: '', name, tier, aliases: [], importance: tier === 1 ? 'major' : tier === 2 ? 'supporting' : 'minor',
      identity: '', faction: '', generation: '', cultivation: '', status: '',
      oneLiner: '', persona: null, relationships: [], timeline: [], evidence: [],
      mentions: s ? s.total : 0, chapterCount: s ? s.chapterCount : 0,
      firstChapter: s ? s.first : null, lastChapter: s ? s.last : null,
    };
    out.set(name, e);
  }
  return e;
}

// 卡片优先
for (const c of cards) {
  const e = ensure(c.name, 1);
  Object.assign(e, {
    tier: 1, aliases: c.aliases || [], importance: c.importance || 'major',
    gender: c.gender, identity: c.identity, faction: c.faction,
    generation: c.generation || genLabel(c.name),
    cultivation: c.cultivation, status: c.status, oneLiner: c.oneLiner,
    persona: c.persona, relationships: (c.relationships || []).map(r => ({ name: r.name, relation: r.relation, id: '' })),
    timeline: c.timeline || [], evidence: c.evidence || [],
  });
}

// roster 确认的其余角色 -> tier2
const cardNames = new Set(cards.map(c => c.name));
for (const conf of cand.confirmed) {
  if (dropSet.has(conf.name)) continue;
  if (absorbInto.has(conf.name)) {
    const keep = absorbInto.get(conf.name);
    if (keep !== '__PREFIX2__') {
      // 简称并入正主: 加别名
      const t = out.get(keep);
      if (t && !t.aliases.includes(conf.name)) t.aliases.push(conf.name);
    }
    continue;
  }
  if (sameMerge.has(conf.name)) {
    // 同人归并: 化身/异写并入正主，别名+notes 带过去
    const keep = sameMerge.get(conf.name);
    let t = out.get(keep) || ensure(keep, 2);
    if (!t.aliases.includes(conf.name)) t.aliases.push(conf.name);
    if (conf.notes) {
      t.rosterNotes = [...(t.rosterNotes || []), ...conf.notes.map(x => ({ chunk: x.chunk, note: x.note }))];
      if (!t.oneLiner) { const n = conf.notes.sort((a, b) => b.chunk - a.chunk)[0].note; t.oneLiner = cleanOneLiner(n); }
    }
    continue;
  }
  if (out.has(conf.name)) {
    // 补别名/统计
    const e = out.get(conf.name);
    for (const a of conf.aliases) if (!e.aliases.includes(a)) e.aliases.push(a);
    continue;
  }
  const e = ensure(conf.name, 2);
  e.aliases = conf.aliases || [];
  if (conf.stats) { e.mentions = conf.stats.total; e.chapterCount = conf.stats.chapterCount; e.firstChapter = conf.stats.first; e.lastChapter = conf.stats.last; }
  // 分级: 高戏份=tier2, 低戏份=tier3
  if (!((e.mentions >= 100) || (e.chapterCount >= 15) || (conf.llmChunks && conf.llmChunks.length >= 2))) e.tier = 3;
  if (e.tier === 2 && e.mentions >= 800) e.importance = 'major';
  // 从 roster notes 提炼 oneLiner: 最新 note 清洗后取首句
  if (conf.notes && conf.notes.length) {
    const n = conf.notes.sort((a, b) => b.chunk - a.chunk)[0].note;
    e.oneLiner = cleanOneLiner(n);
    e.rosterNotes = conf.notes.map(x => ({ chunk: x.chunk, note: x.note }));
  }
}

// mined 复核保留 -> tier3
const keepSet = new Set(KEEP);
for (const m of cand.minedOnly) {
  if (dropSet.has(m.name) || absorbInto.has(m.name)) continue;
  if (out.has(m.name)) continue;
  if (!keepSet.has(m.name)) continue;
  const e = ensure(m.name, 3);
  e.mentions = m.total; e.chapterCount = m.chapterCount; e.firstChapter = m.first; e.lastChapter = m.last;
}

// ---------- 3) id / 拼音 / 世代补全 / 势力补全 ----------
const FACTIONS = ['李家', '萧家', '郁家', '陈家', '安家', '杨家', '费家', '崔家', '袁家', '孔家', '郭家', '周家', '青池宗', '金羽宗', '修越宗', '太阴一府', '明阳', '北寰宗', '越国', '宋国'];
for (const e of out.values()) {
  const py = pinyin(e.name, { toneType: 'none', type: 'array' }).join('');
  e.id = py;
  // 拼音索引: 正名 + 所有别名
  e.pinyin = py;
  for (const a of e.aliases || []) e.pinyin += ',' + pinyin(a, { toneType: 'none', type: 'array' }).join('');
  // 世代/势力归一
  if (e.generation) {
    const z = normGeneration(e.generation);
    const i = ZIBEI_ORDER.indexOf(z);
    e.generation = i >= 0 ? `李家${i + 1}世（${z}字辈）` : z;
  } else e.generation = genLabel(e.name);
  e.faction = normFaction(e.faction);
  // 列表防剧透: oneLinerSafe = 剔除死亡/结局分句后的安全速答（列表行用），详情页仍显示完整 oneLiner
  e.oneLinerSafe = safeOneLiner(e.oneLiner);
  // tier3 无势力: 从名字上下文猜(首现章节标题/oneLiner)
  if (!e.faction && e.rosterNotes) {
    const txt = e.rosterNotes.map(n => n.note).join('');
    e.faction = FACTIONS.find(f => txt.includes(f)) || '';
  }
}

// id 去重
const seen = new Set();
for (const e of out.values()) { let base = e.id, i = 2; while (seen.has(e.id)) e.id = base + i++; seen.add(e.id); }

// ---------- 4) 关系 id 回填 + 反向关系 ----------
for (const e of out.values()) {
  for (const r of e.relationships) {
    const t = out.get(r.name);
    if (t) r.id = t.id;
  }
}

// ---------- 5) 汇总 ----------
const characters = [...out.values()].sort((a, b) => b.mentions - a.mentions);
const factionCount = new Map();
for (const e of characters) if (e.faction) factionCount.set(e.faction, (factionCount.get(e.faction) || 0) + 1);
const genCount = new Map();
for (const e of characters) if (e.generation) genCount.set(e.generation, (genCount.get(e.generation) || 0) + 1);

const data = {
  id: 'xuanjianxianzu',
  title: '玄鉴仙族',
  author: '季越人',
  updatedAt: '2026-10-21',
  chapterCount: 1604,
  summary: '陆江仙熬夜猝死，残魂附身一面青灰色铜镜（玄鉴），落入修仙世界，被黎泾村凡人家族李家拾得。他以器灵之身暗中指点李家修行、趋吉避凶，历经越国三宗倾轧、朝代更迭与诸界仙门争锋，见证并推动李家从凡人村族成长为修仙世家。全书以家族群像为主线，人物众多、世代更迭。',
  factions: [...factionCount.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).map(([f]) => f),
  generations: [...genCount.entries()].sort((a, b) => (parseInt(a[0].match(/(\d+)世/)?.[1] || 99) - parseInt(b[0].match(/(\d+)世/)?.[1] || 99))).map(([g]) => g),
  stats: {
    tiers: { 1: characters.filter(c => c.tier === 1).length, 2: characters.filter(c => c.tier === 2).length, 3: characters.filter(c => c.tier === 3).length },
  },
  characters,
};
// 瘦身: tier3不带rosterNotes
for (const c of data.characters) if (c.tier === 3) delete c.rosterNotes;
fs.writeFileSync(path.join(OUT_DIR, 'xuanjianxianzu.json'), JSON.stringify(data));
console.log(`总人物: ${characters.length}  (t1:${data.stats.tiers[1]} t2:${data.stats.tiers[2]} t3:${data.stats.tiers[3]})`);
console.log('势力:', data.factions.join('、'));
console.log('世代:', data.generations.join('、'));
console.log('输出:', path.join(OUT_DIR, 'xuanjianxianzu.json'), (fs.statSync(path.join(OUT_DIR, 'xuanjianxianzu.json')).size / 1024).toFixed(0) + 'KB');
