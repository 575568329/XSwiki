// 黎明之剑 MVP 构建：百科词条 + 原文提及数（analysis/liming/text/chapters/*.txt，通道C 落盘不进上下文）
// 人物=百科词条命中 + 种子别名在原文的提及频次；后置 gen-system limingzhijian → sync-data
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-10-24';

// 种子：百科命中 + 主角团常用短名（别名只拆"·"后段，不造新名）
const SEEDS = [
  { name: '高文·塞西尔', alts: ['高文·塞西尔', '高文'], faction: '塞西尔', gender: '男' },
  { name: '赫蒂·塞西尔', alts: ['赫蒂·塞西尔', '赫蒂'], faction: '塞西尔', gender: '女' },
  { name: '瑞贝卡·塞西尔', alts: ['瑞贝卡·塞西尔', '瑞贝卡'], faction: '塞西尔', gender: '女' },
  { name: '琥珀', alts: ['琥珀'], faction: '塞西尔', gender: '女' },
  { name: '皮特曼', alts: ['皮特曼'], faction: '塞西尔', gender: '男' },
  { name: '菲利普', alts: ['菲利普'], faction: '塞西尔', gender: '男' },
];

const FACTION_CARDS = [
  ['塞西尔', 'protagonist', '塞西尔领·魔能技术发源地', '高文·塞西尔重建的家族与领地，魔网技术的摇篮'],
  ['刚铎帝国', 'neutral', '覆灭的古代魔法帝国', '以深蓝之井为核心的古代魔法文明，1740 年毁于魔潮'],
  ['永眠者', 'foe', '侵入精神世界的神秘存在', '能侵入他人精神世界，有主教级等级划分'],
];
const CODEX = [
  ['深蓝之井', '刚铎帝国的星球动力系统，提供无限魔力，其爆炸引发的魔潮导致帝国覆灭'],
  ['魔网', '瑞贝卡主导研发的魔能网络技术，推动塞西尔工业革命'],
  ['符文扳机', '瑞贝卡发明的魔能技术核心部件'],
  ['瑞贝卡水晶', '瑞贝卡发明的魔能晶体，以发明者命名'],
  ['魔能列车', '赫蒂主持推动完成的魔能技术项目'],
  ['魔潮', '深蓝之井爆炸引发的灾难，致全大陆文明倒退'],
];

// ============ 原文提及统计 ============
const CH_DIR = path.join(__dirname, 'text', 'chapters');
const counts = {}, chaptersSeen = {};
for (const s of SEEDS) { counts[s.name] = 0; chaptersSeen[s.name] = new Set(); }
let filesN = 0;
if (fs.existsSync(CH_DIR)) {
  for (const f of fs.readdirSync(CH_DIR)) {
    if (!f.endsWith('.txt')) continue;
    filesN++;
    const t = fs.readFileSync(path.join(CH_DIR, f), 'utf8');
    for (const s of SEEDS) {
      let n = 0;
      for (const a of s.alts) n += (t.match(new RegExp(a, 'g')) || []).length;
      if (n) { counts[s.name] += n; chaptersSeen[s.name].add(f); }
    }
  }
}
console.log(`原文提及统计基于 ${filesN} 章落盘`);

// ============ 百科词条 ============
const baike = {};
for (const f of fs.readdirSync(path.join(__dirname, 'raw-baike'))) {
  if (!f.endsWith('.json')) continue;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw-baike', f), 'utf8'));
    if (!j.key) continue;
    const text = (j.desc || '') + (j.abstract || '');
    if (!/黎明之剑|远瞳|塞西尔/.test(text)) continue;
    if (!baike[j.key] || text.length > ((baike[j.key].desc || '') + (baike[j.key].abstract || '')).length) baike[j.key] = j;
  } catch {}
}

const cutBySentence = (s, max) => {
  s = (s || '').replace(/\r?\n+/g, ' ').trim();
  if (s.length <= max) return s;
  const parts = s.slice(0, max).split(/(?<=[。！？；])/).filter(Boolean);
  return (parts.length > 1 ? parts.slice(0, -1).join('') : s.slice(0, max)).trim() + '……';
};
const TIER_COLOR = { 1: ['#6b3fa0', '#e8dcf5'], 2: ['#2f5d8a', '#d6e4f0'], 3: ['#5a5a5a', '#e2e2e2'] };
const FAC_COLOR = { 塞西尔: ['#3a5a7a', '#d9e4f0'], 刚铎: ['#8a7434', '#f3eedd'], 永眠者: ['#2b2b3a', '#b9b9cc'] };
const sealSvg = (name, faction) => {
  const [bg, fg] = FAC_COLOR[faction] || TIER_COLOR[3];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="14" fill="${bg}"/>
<rect x="5.5" y="5.5" width="89" height="89" rx="10" fill="none" stroke="${fg}" stroke-width="1.6" opacity="0.55"/>
<rect x="9" y="9" width="82" height="82" rx="8" fill="none" stroke="${fg}" stroke-width="0.8" opacity="0.3"/>
<text x="50" y="60" font-size="46" fill="#ffffff" text-anchor="middle" font-family="KaiTi,STKaiti,'Noto Serif SC',serif" font-weight="700">${(name || '?')[0]}</text>
</svg>`;
};
const py = s => pinyin(s, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').replace(/[^a-z0-9]/g, '');

// ============ 组装 ============
const chars = [];
for (const s of SEEDS) {
  const bk = baike[s.name.split('·')[0]] || baike[s.name];
  const text = bk ? ((bk.desc || '') + ' ' + (bk.abstract || '')).replace(/\r?\n+/g, ' ').trim() : '';
  const mentions = counts[s.name];
  const inText = chaptersSeen[s.name].size;
  const tier = s.name === '高文·塞西尔' ? 1 : (mentions >= 1500 ? 1 : mentions >= 250 ? 2 : 3);
  const shortName = s.name.split('·')[0];
  let liner = '';
  if (text) {
    const sents = text.split(/(?<=[。！？])/).filter(x => !/漫画版|衍生作品|配音/.test(x));
    const core = sents.filter(x => !/所著|登场作品/.test(x));
    liner = (core[0] || sents[0] || '').replace(new RegExp('^' + shortName + '\\s*[（(，,、：:]?\\s*'), '').trim();
    liner = liner.replace(/，是[^，。；]{0,20}《黎明之剑》[^，。；]*?角色/, '').replace(/小说《黎明之剑》及其衍生作品中的/g, '');
  }
  chars.push({
    id: py(s.name), name: s.name, tier,
    aliases: [shortName].filter(a => a !== s.name),
    importance: tier === 1 ? 'protagonist' : (tier === 2 ? 'major' : 'supporting'),
    identity: cutBySentence(liner || s.name + '（黎明之剑角色）', 90),
    faction: s.faction,
    generation: s.name === '高文·塞西尔' && /传奇/.test(text) ? '传奇' : '',
    cultivation: text.match(/传奇[^，。；]{0,4}/)?.[0] || '',
    status: '',
    oneLiner: cutBySentence((liner || '') + (mentions ? `。原文提及 ${mentions} 次（${inText} 章）` : ''), 110),
    persona: null,
    relationships: [],
    timeline: [], evidence: [],
    mentions,
    chapterCount: inText, firstChapter: 0, lastChapter: 0,
    gender: s.gender,
    oneLinerSafe: '', seal: '',
  });
}
chars.sort((a, b) => a.tier - b.tier || b.mentions - a.mentions);

// ============ 兜底提取合并（原文人名发现+子代理逐名核对）+ 库内原文统计 ============
{
  const statsFile = path.join(__dirname, 'known-stats.json');
  if (fs.existsSync(statsFile)) {
    const { known, aliasMap } = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
    const byName = Object.fromEntries(chars.map(c => [c.name, c]));
    for (const k of known) {
      const c = byName[k.name];
      if (!c) continue;
      c.mentions = k.mentions;
      c.firstChapter = k.firstChapter;
      c.lastChapter = k.lastChapter;
      for (const a of aliasMap[k.name] || []) if (!c.aliases.includes(a)) c.aliases.push(a);
    }
  }
  const extraFile = path.join(__dirname, 'extra-chars.json');
  if (fs.existsSync(extraFile)) {
    const { chars: extras } = JSON.parse(fs.readFileSync(extraFile, 'utf8'));
    const have = new Set(chars.map(c => c.name));
    const KIND_TXT = { 人名: '原著角色', 尊号: '以尊号行世的强者', 神祇: '神祇级存在' };
    for (const e of extras) {
      if (have.has(e.name)) continue;
      have.add(e.name);
      chars.push({
        name: e.name, tier: e.mentions >= 1500 ? 2 : 3,
        aliases: e.aliases || [],
        importance: e.mentions >= 1500 ? 'major' : 'supporting',
        identity: KIND_TXT[e.kind] + '（原文兜底提取）',
        faction: '', generation: '', cultivation: '', status: '',
        oneLiner: `${KIND_TXT[e.kind] || '原著角色'}：原文提及 ${e.mentions} 次`,
        persona: null, relationships: [], timeline: [], evidence: [],
        mentions: e.mentions, chapterCount: e.chapterCount || 0, firstChapter: e.firstChapter, lastChapter: e.lastChapter,
        gender: e.gender || '', oneLinerSafe: '', seal: '',
      });
    }
    chars.sort((a, b) => a.tier - b.tier || b.mentions - a.mentions);
  }
}
for (const c of chars) { c.oneLinerSafe = c.oneLiner; c.seal = sealSvg(c.name, c.faction); }
// id/拼音规范化（兜底提取人物统一补齐，与库内去重）
{
  const idCount = {};
  for (const c of chars) {
    if (c.id) continue;
    const pid = py(c.name);
    idCount[pid] = (idCount[pid] || 0) + 1;
    c.id = idCount[pid] > 1 ? pid + idCount[pid] : pid;
    c.pinyin = pid;
  }
}
// 关系 id 回填
{
  const byName = Object.fromEntries(chars.map(c => [c.name, c]));
  for (const c of chars) for (const r of c.relationships) { const t2 = byName[r.name]; if (t2) r.id = t2.id; }
}


// ============ 深提取档案合并（profiles/：persona/evidence/timeline/relationships/stages）============
{
  const profDir = path.join(__dirname, 'profiles');
  if (fs.existsSync(profDir)) {
    const byNameP = Object.fromEntries(chars.map(c => [c.name, c]));
    for (const f of fs.readdirSync(profDir)) {
      if (!f.endsWith('.json')) continue;
      let p;
      try { p = JSON.parse(fs.readFileSync(path.join(profDir, f), 'utf8')); } catch { continue; }
      const c = byNameP[p.name];
      if (!c) continue;
      if (p.persona && (p.persona.appearance || p.persona.arc)) c.persona = p.persona;
      if (Array.isArray(p.evidence) && p.evidence.length) c.evidence = p.evidence.slice(0, 4);
      if (Array.isArray(p.timeline) && p.timeline.length) c.timeline = p.timeline
        .map(t => ({ chapter: +t.chapter || 0, event: String(t.event || '').slice(0, 40) })).slice(0, 8);
      if (Array.isArray(p.relationships) && p.relationships.length) {
        const haveR = new Set(c.relationships.map(r => r.name));
        for (const r of p.relationships) {
          if (haveR.has(r.name) || !byNameP[r.name]) continue;
          haveR.add(r.name);
          c.relationships.push({ name: r.name, relation: r.relation || '', id: '' });
        }
        c.relationships = c.relationships.slice(0, 12);
      }
      if (Array.isArray(p.stages) && p.stages.length) {
        c.stages = p.stages.map((s, i) => ({
          id: 'stg' + i, title: s.title, chapterStart: +s.chapterStart || 1,
          chapterEnd: s.chapterEnd ? +s.chapterEnd : (+s.chapterStart || 1),
          situation: s.situation || '', cultivationAt: s.cultivationAt || '',
        }));
      }
    }
  }
}

const facCount = {};
for (const c of chars) if (c.faction) facCount[c.faction] = (facCount[c.faction] || 0) + 1;
const factionEntities = FACTION_CARDS.map(([name, stance, stanceTxt, one]) => ({
  id: py(name), name, stance, stanceTxt, one, core: name === '塞西尔' ? chars.slice(0, 4).map(c => c.name) : [],
  members: name === '塞西尔' ? facCount['塞西尔'] || 0 : 0, stages: [],
}));
const bkBook = baike['黎明之剑'];
const book = {
  id: 'limingzhijian',
  title: '黎明之剑',
  author: '远瞳',
  updatedAt: TODAY,
  chapterCount: 1593, // 原文落盘章数（兜底提取口径）
  summary: (bkBook ? cutBySentence((bkBook.abstract || bkBook.desc || '').replace(/连载于起点中文网的科幻分类，有漫画等衍生作品，但衍生番剧风评不佳。/, ''), 300) : '') || '远瞳所著西幻题材小说：传奇骑士高文·塞西尔的灵魂穿越七百年后的塞西尔领，以魔能技术重启文明。',
  factions: [...new Set(chars.map(c => c.faction).filter(Boolean).concat(FACTION_CARDS.map(f => f[0])))],
  generations: [],
  stats: { tiers: { 1: chars.filter(c => c.tier === 1).length, 2: chars.filter(c => c.tier === 2).length, 3: chars.filter(c => c.tier === 3).length } },
  factionEntities,
  systemPage: { realms: [], xianji: [] },
  characters: chars,
};
fs.writeFileSync(path.join(__dirname, 'mnjs.json'), JSON.stringify(CODEX.map(([n, s]) => ({ n, s })), null, 1), 'utf8');

const DST = path.join(__dirname, '..', '..', 'plugin', 'data', 'limingzhijian.json');
fs.writeFileSync(DST, JSON.stringify(book));
console.log(`✓ ${DST} (${(fs.statSync(DST).size / 1024).toFixed(0)}KB)`);
console.log(`人物 ${chars.length}：` + chars.map(c => `${c.name}${c.mentions}次/${c.chapterCount}章(T${c.tier})`).join(', '));
console.log(`势力卡 ${factionEntities.length} / 魔能图鉴 ${CODEX.length}`);
