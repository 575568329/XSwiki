// 凡人修仙传：fanren-wiki 仓库（Lizhenghe-Chen/fanren-wiki，静态站数据内嵌 index.html）→ plugin/data/fanrenxiuxianzhuan.json
// 数据形态：DATA.<篇章>=[{n,t,r,e,img,s,rel,camp,race,ev}]，6 篇 1053 条；跨篇同人按 baseName 合并；
// 关系：无类型化边，用互引（双方介绍文本互提）近似；印章 SVG 内联生成；拼音 pinyin-pro。
// 用法：node build-fanren.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, 'repo', 'public', 'index.html');
const OUT = path.join(__dirname, '..', '..', 'plugin', 'data', 'fanrenxiuxianzhuan.json');
const TODAY = '2026-10-23';

const html = fs.readFileSync(REPO, 'utf8');

// ---- 从 html 提取 JS 数组字面量并求值（本地可信数据） ----
// 注意词边界：'ARTS' 不能命中 'ARTS_CATS'
function extractArray(varName) {
  const re = new RegExp(`(?<![\\w$])${varName}\\s*=\\s*\\[`);
  const m = re.exec(html);
  if (!m) return null;
  let depth = 0, j = m.index + m[0].length - 1, inStr = null, esc = false;
  for (; j < html.length; j++) {
    const ch = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
    else if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { j++; break; } }
  }
  return new Function(`return ${html.slice(m.index + m[0].length - 1, j)}`)();
}

const CHAPTERS = extractArray('CHAPTERS') || [];
const ARC_NAME = Object.fromEntries(CHAPTERS.map(c => [c.id, c.full || c.name]));
const ARCS = Object.keys(CHAPTERS.length ? Object.fromEntries(CHAPTERS.map(c => [c.id, 1])) : {});
const DATA = {};
for (const arc of ARCS) {
  const arr = extractArray(`DATA.${arc}`);
  if (arr) DATA[arc] = arr;
}
const ARTS = extractArray('ARTS') || [];
const ARTS_CATS = extractArray('ARTS_CATS') || [];
const TL = extractArray('TL') || [];
console.log('篇章:', ARCS.map(a => `${a}(${(DATA[a] || []).length})`).join(' '), '| 功法库:', ARTS.length, '| 时间线:', TL.length);

// ---- 境界归一（凡人阶梯） ----
const REALMS = ['真仙', '大乘', '合体', '炼虚', '化神', '元婴', '结丹', '筑基', '练气'];
const REALM_KEY = { 真仙: 'rv-zhenxian', 大乘: 'rv-dacheng', 合体: 'rv-heti', 炼虚: 'rv-lianxu', 化神: 'rv-huashen', 元婴: 'rv-yuanying', 结丹: 'rv-jindan', 筑基: 'rv-foundation', 练气: 'rv-lianqi', 凡人: 'rv-mortal' };
// 生成 generations（由高到低展示时前端自行处理；存储顺序=阶梯顺序）
const GENERATIONS = ['凡人', '练气', '筑基', '结丹', '元婴', '化神', '炼虚', '合体', '大乘', '真仙'];
function realmOf(recs) {
  // 全篇取最高境界：ev 是境界全史（首篇有），r 是各篇当时修为；REALMS 本身高→低，取首个命中
  const hay = recs.map(r => `${r.ev || ''} ${r.r || ''}`).join(' ');
  for (const re of REALMS) {
    if (hay.includes(re)) return re;
  }
  if (/金仙|太乙|大罗|道祖|仙帝|仙尊/.test(hay)) return '真仙';
  if (/凡人|无灵根|武学|凡人身/.test(hay)) return '凡人';
  return '';
}

const baseName = n => String(n).replace(/（[^）]*）$/, '');
const SPOILER_RE = /(陨落|身死|战死|被杀|所杀|殒命|死亡|死了|坐化|兵解|败亡|重伤不治|同归于尽|自尽|身亡|刺杀|牺牲|毒杀|斩杀|覆灭|殁|命丧|毙命)/;
function cutBySentence(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const m = [...cut.matchAll(/[。！？]/g)];
  return m.length && m[m.length - 1].index > 30 ? cut.slice(0, m[m.length - 1].index + 1) : cut + '…';
}
function safeOneLiner(one) {
  if (!one || !SPOILER_RE.test(one)) return one || '';
  const parts = one.split(/，|。|；/).filter(Boolean);
  const safe = parts.filter(p => !SPOILER_RE.test(p));
  return safe.length ? safe.slice(0, 3).join('，') : '身份信息详见人物卡（含剧情）';
}
const tok = x => pinyin(x, { toneType: 'none', type: 'array' }).join('').replace(/[^a-z0-9]/g, '');

// ---- 跨篇合并 ----
const byBase = new Map();
for (const arc of ARCS) {
  for (const rec of DATA[arc] || []) {
    const base = baseName(rec.n);
    if (!base) continue;
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push({ arc, ...rec });
  }
}
console.log('唯一人物:', byBase.size);

// 功法（体系页图鉴）
const gongfa = ARTS.filter(a => a.cat === 'gongfa');
fs.writeFileSync(path.join(__dirname, 'gongfa.json'), JSON.stringify(gongfa), 'utf8');

// ---- 组装 ----
const chars = [];
for (const [base, recs] of byBase) {
  // 展示名：出现篇数最多 > 名字短者优先
  recs.sort((a, b) => a.n.length - b.n.length);
  const display = recs[0].n;
  const aliases = [...new Set([
    ...recs.filter(r => r.n !== display).map(r => r.n),
    ...recs.flatMap(r => [...(r.n.matchAll(/（([^）]+)）/g) || [])].map(m => m[1])),
    // t 形如 "本名 · 身份" 时取本名；纯身份标签（如"全书主角"）不算别名
    ...recs.filter(r => (r.t || '').includes('·')).map(r => r.t.split('·')[0].trim()).filter(x => x && x.length <= 6 && x !== display),
  ])].slice(0, 16);

  const last = recs[recs.length - 1];
  const richest = [...recs].sort((a, b) => (b.s || '').length - (a.s || '').length)[0];
  const arcsCount = recs.length;
  const mentions = recs.reduce((n, r) => n + (r.s || '').length + (r.t || '').length, 0);
  const realm = realmOf(recs);
  const relMain = recs.find(r => r.rel === '主角');
  const statusRaw = `${ARC_NAME[last.arc] || last.arc}：${last.e || last.r || ''}`;

  chars.push({
    id: '',
    name: display,
    tier: 0, // 互引统计后分层
    aliases,
    importance: arcsCount >= 3 ? 'major' : (mentions >= 800 ? 'major' : 'supporting'),
    identity: cutBySentence(last.t || '', 80),
    faction: (last.camp || '').split('·')[0].trim(),
    generation: realm,
    cultivation: cutBySentence(last.r || '', 80),
    status: cutBySentence(statusRaw, 110),
    oneLiner: cutBySentence(richest.s || '', 118),
    persona: null,
    relationships: [],
    timeline: [],
    stages: [],
    evidence: [],
    mentions,
    chapterCount: 0, firstChapter: 0, lastChapter: 0,
    oneLinerSafe: '',
    seal: '',
    _bio: richest.s || '',
    _arcs: recs.map(r => r.arc),
    _arcsCount: arcsCount,
    _relMain: !!relMain,
    _ev: last.ev || '',
  });
}
chars.sort((a, b) => b.mentions - a.mentions);

// ---- 互引统计：全员互提次数 → tier 分层 + tier1 关系 ----
const nameSet = new Set(chars.map(c => c.name));
const baseToName = new Map();
for (const [base, recs] of byBase) {
  const names = [...new Set(recs.map(r => r.n))];
  baseToName.set(base, nameSet.has(base) ? base : (names.find(n => nameSet.has(n)) || null));
}
const fullText = new Map(chars.map(c => [c.name, `${c._bio} ${c.identity} ${c.cultivation} ${c.status} ${c._ev}`]));
const crossScore = new Map(); // name -> Map(otherName -> 次数)
for (const c of chars) {
  const hay = fullText.get(c.name);
  const score = new Map();
  for (const [base, nm] of baseToName) {
    if (!nm || nm === c.name) continue;
    let n = 0, i = 0;
    while ((i = hay.indexOf(base, i)) >= 0) { n++; i += base.length; }
    if (n >= 2) score.set(nm, n);
  }
  crossScore.set(c.name, score);
}
// 被引数（别人提TA）作为重要度——与 wiki 核心圈口径一致
const cited = new Map();
for (const [nm, score] of crossScore) for (const [other, n] of score) cited.set(other, (cited.get(other) || 0) + n);
for (const c of chars) {
  const relMain = c._relMain;
  const citedN = cited.get(c.name) || 0;
  c.tier = (relMain || c._arcsCount >= 3 || citedN >= 15) ? 1 : (c._arcsCount === 2 || citedN >= 5 ? 2 : 3);
}
// tier1 关系：互引最强 top8
for (const c of chars) {
  if (c.tier !== 1) continue;
  const mine = crossScore.get(c.name);
  // 双向强度 = 我提TA + TA提我
  const both = [...mine].map(([other, n]) => [other, n + ((crossScore.get(other) || new Map()).get(c.name) || 0)]);
  c.relationships = both.sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([nm, n]) => ({ name: nm, relation: `渊源（互引${n}次）`, id: '' }));
}

// ---- 势力实体 ----
const campMembers = new Map();
for (const c of chars) {
  if (!c.faction) continue;
  if (!campMembers.has(c.faction)) campMembers.set(c.faction, new Set());
  campMembers.get(c.faction).add(c.name);
}
const camps = [...campMembers].sort((a, b) => b[1].size - a[1].size);
const hanliCamps = new Set((byBase.get('韩立') || []).map(r => r.camp));
const factionEntities = camps.slice(0, 14).map(([name, set]) => ({
  name,
  stance: hanliCamps.has(name) ? 'protagonist' : 'neutral',
  one: `${set.size} 位收录人物 · 出场于${[...new Set(chars.filter(c => c.faction === name).flatMap(c => c._arcs))].map(a => ARC_NAME[a] || a).slice(0, 3).join('、')}`,
}));

// ---- 收尾：pinyin / safe / seal / id（拼音同音加后缀去重） ----
const tierSealColor = { 1: ['#6b3fa0', '#e8dcf5'], 2: ['#2f5d8a', '#d6e4f0'], 3: ['#4a5a4a', '#dfe8df'] };
const usedIds = new Set();
for (const c of chars) {
  let base = tok(c.name) || tok(c.aliases[0] || '') || 'fr';
  let id = base;
  for (let k = 2; usedIds.has(id); k++) id = base + '-' + k;
  usedIds.add(id);
  c.id = id;
  c.pinyin = [c.name, ...c.aliases].map(tok).filter(Boolean).join(',');
  c.oneLinerSafe = safeOneLiner(c.oneLiner);
  const [bg, fg] = tierSealColor[c.tier];
  const big = c.name.slice(0, c.name.length >= 3 ? 1 : 1);
  const small = (c.faction || '').slice(0, 2) || (c.generation || '');
  c.seal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="14" fill="${bg}"/><rect x="5.5" y="5.5" width="89" height="89" rx="10" fill="none" stroke="${fg}" stroke-width="1.6" opacity="0.55"/><rect x="9" y="9" width="82" height="82" rx="8" fill="none" stroke="${fg}" stroke-width="0.8" opacity="0.3"/><text x="50" y="${small ? 60 : 66}" font-size="46" fill="#ffffff" text-anchor="middle" font-family="KaiTi,STKaiti,'Noto Serif SC',serif" font-weight="700">${big}</text>${small ? `<text x="50" y="82" font-size="13" fill="${fg}" text-anchor="middle" font-family="KaiTi,STKaiti,serif" opacity="0.9">${small}</text>` : ''}</svg>`;
  delete c._bio; delete c._arcs; delete c._ev; delete c._arcsCount; delete c._relMain;
}

// ---- 书目 JSON ----
const tiers = { 1: 0, 2: 0, 3: 0 };
for (const c of chars) tiers[c.tier]++;
const book = {
  id: 'fanrenxiuxianzhuan',
  title: '凡人修仙传',
  author: '忘语',
  updatedAt: TODAY,
  chapterCount: 2446, // 全本章数（原文抓取后由 build-text 校正）
  summary: '《凡人修仙传》是忘语创作的凡人流开山之作，2008年起连载于起点中文网，全书二十四百余章。讲述山村穷小子韩立凭一个神秘小瓶与过人谨慎，在弱肉强食的修仙界步步为营：七玄门入道、黄枫谷筑基、乱星海结丹、大晋夺宝、灵界飞升、仙界证道，最终历经三界沉浮由凡人问鼎大道。人物众多、势力庞杂，以小人物的生存智慧与修仙体系之严谨著称。',
  factions: camps.map(([n]) => n),
  generations: GENERATIONS,
  stats: { tiers },
  characters: chars,
  factionEntities,
  theme: 'fanren',
};
fs.writeFileSync(OUT, JSON.stringify(book));
console.log(`凡人修仙族: ${chars.length} 人（t1 ${tiers[1]} / t2 ${tiers[2]} / t3 ${tiers[3]}），势力 ${factionEntities.length} 卡（camp 总数 ${camps.length}），功法图鉴 ${gongfa.length} 条`);
console.log('样例:', chars.slice(0, 5).map(c => `${c.name}[t${c.tier},${c.generation || '未知'}]`).join(' '));
