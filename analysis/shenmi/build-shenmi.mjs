// 《我加载了神秘学面板》构建：纯兜底范式（百科词条薄，全靠原文提取+逐名核对）
// extra-chars.json（merge-extras 产出，带 rank 位阶）→ plugin/data/wojiazaileshenmixuemianban.json
// 后置：node analysis/gen-system.mjs wojiazaileshenmixuemianban → sync-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-10-28';

const MC = '李察';
const RANK_ORDER = ['凡人', '新入者', '从业者', '小精通', '大精通', '达人', '大师', '隐席'];

const cutBySentence = (s, max) => {
  s = (s || '').replace(/\r?\n+/g, ' ').trim();
  if (s.length <= max) return s;
  const parts = s.slice(0, max).split(/(?<=[。！？；])/).filter(Boolean);
  return (parts.length > 1 ? parts.slice(0, -1).join('') : s.slice(0, max)).trim() + '……';
};
const KIND_TXT = { 人名: '原著角色', 尊号: '以称谓行世的角色', 神祇: '神祇级存在' };
const TIER_COLOR = { 1: ['#6b3fa0', '#e8dcf5'], 2: ['#2f5d8a', '#d6e4f0'], 3: ['#5a5a5a', '#e2e2e2'] };
const sealSvg = (name, tier) => {
  const [bg, fg] = TIER_COLOR[tier] || TIER_COLOR[3];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="14" fill="${bg}"/>
<rect x="5.5" y="5.5" width="89" height="89" rx="10" fill="none" stroke="${fg}" stroke-width="1.6" opacity="0.55"/>
<rect x="9" y="9" width="82" height="82" rx="8" fill="none" stroke="${fg}" stroke-width="0.8" opacity="0.3"/>
<text x="50" y="60" font-size="46" fill="#ffffff" text-anchor="middle" font-family="KaiTi,STKaiti,'Noto Serif SC',serif" font-weight="700">${(name || '?')[0]}</text>
</svg>`;
};
const py = s => pinyin(s, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').replace(/[^a-z0-9]/g, '');

// ============ 人物 ============
const chars = [];
{
  const extraFile = path.join(__dirname, 'extra-chars.json');
  const { chars: extras } = JSON.parse(fs.readFileSync(extraFile, 'utf8'));
  for (const e of extras) {
    const isMC = e.name === MC;
    const tier = isMC ? 1 : (e.rank && ['大精通', '达人', '大师'].includes(e.rank) ? 2 : 3);
    chars.push({
      name: e.name, tier,
      aliases: e.aliases || [],
      importance: isMC ? 'protagonist' : (tier === 2 ? 'major' : 'supporting'),
      identity: (e.note ? e.note + '，' : '') + (e.rank ? e.rank + '（位阶）' : KIND_TXT[e.kind] || '原著角色'),
      faction: '', generation: e.rank || '',
      cultivation: e.rank ? e.rank + '（词条/原文载）' : '',
      status: '',
      oneLiner: isMC
        ? '加载神秘学面板的穿越者，以可用点数加点的方式在帷幕后世界步步登高'
        : `${KIND_TXT[e.kind] || '原著角色'}：原文提及 ${e.mentions} 次${e.rank ? '，位阶' + e.rank : ''}`,
      persona: null, relationships: [], timeline: [], evidence: [],
      mentions: e.mentions, chapterCount: e.chapterCount || 0, firstChapter: e.firstChapter, lastChapter: e.lastChapter,
      gender: e.gender || '', oneLinerSafe: '', seal: '',
    });
  }
}
chars.sort((a, b) => a.tier - b.tier || b.mentions - a.mentions);

// ============ 深提取档案合并（profiles/）============
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
// id / 拼音 / 印章 / 防剧透速答 / 关系 id 回填
const SPOILER_RE = /(陨落|身死|战死|被杀|所杀|殒命|死亡|死了|败亡|自尽|身亡|牺牲)/;
const idCount = {};
for (const c of chars) {
  const pid = py(c.name);
  idCount[pid] = (idCount[pid] || 0) + 1;
  c.id = idCount[pid] > 1 ? pid + idCount[pid] : pid;
  c.pinyin = pid;
  c.oneLinerSafe = (c.oneLiner || '').split(/，|。|；/).filter(s => !SPOILER_RE.test(s)).slice(0, 3).join('，') || c.oneLiner;
  c.seal = sealSvg(c.name, c.tier);
}
{
  const byName = Object.fromEntries(chars.map(c => [c.name, c]));
  for (const c of chars) for (const r of c.relationships) { const t = byName[r.name]; if (t) r.id = t.id; }
}

// ============ 势力/阶梯/统计 ============
const genList = [...new Set(chars.map(c => c.generation).filter(Boolean))]
  .sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b));
const tiers = { 1: 0, 2: 0, 3: 0 };
chars.forEach(c => tiers[c.tier]++);

const book = {
  id: 'wojiazaileshenmixuemianban',
  title: '我加载了神秘学面板',
  author: '雨中有秋云',
  updatedAt: TODAY,
  chapterCount: 558,
  summary: '雨中有秋云连载于起点的神秘学小说：帷幕后世界以太流转，李察加载神秘学面板，以灵视、仪式与封印之学从新入者起步，沿新入者→从业者→…→隐席七阶步步登高。',
  factions: [],
  generations: genList,
  stats: { tiers },
  factionEntities: [],
  systemPage: { realms: [], xianji: [] },
  characters: chars,
};

// ============ 神秘学概念图鉴（原文语料锚定）============
const CODEX = [
  ['面板', '李察的金手指：意识集中可见【可用点数】等条目，加点即得能力'],
  ['灵视', '通用神秘学能力，观察超凡层面的眼睛，哪条路上都用得着'],
  ['以太', '帷幕后世界的底层力量，体内以太微循环是超凡者的生理基础'],
  ['仪式', '神秘侧的标准作业流程，需按规程准备与执行'],
  ['封印', '对危险存在与物品的约束技术，封印加固是从业者必修'],
  ['占卜', '主流术式之一，常与灵视配合辅助'],
  ['帷幕', '分隔普通人与超凡世界的屏障，新入者是跨过帷幕的门槛'],
  ['污染', '接触超凡的代价与风险来源'],
];
fs.writeFileSync(path.join(__dirname, 'concepts.json'), JSON.stringify(CODEX.map(([n, s]) => ({ n, s })), null, 1), 'utf8');

const DST = path.join(__dirname, '..', '..', 'plugin', 'data', 'wojiazaileshenmixuemianban.json');
fs.writeFileSync(DST, JSON.stringify(book));
console.log(`✓ ${DST} (${(fs.statSync(DST).size / 1024).toFixed(0)}KB)`);
console.log(`人物 ${chars.length}：tier1 ${tiers[1]} / tier2 ${tiers[2]} / tier3 ${tiers[3]}`);
console.log('位阶组:', genList.join(' → ') || '（无）');
const noRank = chars.filter(c => !c.generation).map(c => c.name);
if (noRank.length) console.log('无位阶：', noRank.join(','));
