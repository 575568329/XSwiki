// 大奉打更人 MVP 构建：百科词条（raw-baike/）→ plugin/data/dafengdagengren.json
// 范式=斗破（百科 MVP）；品级阶梯（九品→超品，诸体系通用品级轴）；法器图鉴
// 后置：node analysis/gen-system.mjs dafengdagengren → sync-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-10-24';

// 品级轴（大奉诸体系通用：武夫/术士/佛门/道门/巫师/蛊师/妖族 均按品）
const PIN_ORDER = ['超品', '一品', '二品', '三品', '四品', '五品', '六品', '七品', '八品', '九品'];
const PIN_OF = text => {
  const m = /半步武神|超品|([一二三四五六七八九])品/.exec(text || '');
  if (!m) return '';
  if (m[0] === '半步武神') return '一品'; // 神殊：超品门槛之下按一品档
  return m[0];
};

const FACTIONS = new Set(['打更人', '司天监', '天宗', '云鹿书院', '佛门', '万妖国', '巫神教']);
const T1 = {
  许七安: { tier: 1, faction: '打更人', gender: '男', pin: '一品', status: '在世', identity: '男主角，字宁宴，原现代警察穿越为大奉长乐县捕快，后入打更人衙门', liner: '穿越的现代警察，以打更人身份查案修行，武夫、佛门、蛊师三修，身怀气运与地书碎片', rel: [['魏渊', '亦师亦友'], ['许新年', '堂弟'], ['许平志', '二叔'], ['李妙真', '天地会同道'], ['褚采薇', '司天监友人'], ['浮香', '爱侣'], ['监正', '布局者'], ['神殊', '因果纠葛']] },
  魏渊: { tier: 1, faction: '打更人', gender: '男', pin: '一品', status: '陨落（后以另一形式归来）', identity: '打更人衙门统领，大宦官，人称“魏青衣”，权倾朝野', liner: '打更人衙门统领“魏青衣”，天青色云纹衣衫的宦官巨擘，许七安的引路人与靠山', rel: [['许七安', '亦师亦友'], ['元景帝', '君臣'], ['杨砚', '义子']] },
  李妙真: { tier: 1, faction: '天宗', gender: '女', pin: '四品', status: '在世', identity: '道门天宗圣女，天地会二号，江湖人称“飞燕女侠”', liner: '飞燕女侠，天宗圣女，鳞甲红披风银枪飞剑，天地会二号成员', rel: [['许七安', '天地会同道'], ['李灵素', '师兄']] },
  元景帝: { tier: 1, faction: '大奉皇室', gender: '男', pin: '二品', status: '败亡（身份揭破后陨落）', identity: '大奉皇帝，实为先帝贞德帝的分身，修道多年怠政', liner: '怠政修道的皇帝，真实身份为先帝贞德帝分身，道门二品', rel: [['魏渊', '君臣'], ['监正', '君臣']] },
  监正: { tier: 1, faction: '司天监', gender: '男', pin: '一品', status: '在世（天道意志具象）', identity: '司天监二代监正，一品术士，实为天道意志具象化', liner: '司天监监正，一品术士，承载天道意志，术士体系奠基人', rel: [['许七安', '选定与布局'], ['褚采薇', '弟子'], ['杨千幻', '弟子']] },
  神殊: { tier: 1, faction: '万妖国', gender: '男', pin: '一品', status: '在世（神志时清时浊）', identity: '佛陀与修罗王残魂融合而成的灵魂，万妖女皇配偶', liner: '佛陀与修罗王残魂融合之人，半步武神，九尾天狐与阿苏罗之父', rel: [['阿苏罗', '父子'], ['白姬', '父女'], ['度厄', '佛门旧缘']] },
  巫神: { tier: 1, faction: '巫神教', gender: '男', pin: '超品', status: '自我了断（保体系传承）', identity: '巫师体系开创者，远古超品强者，巫神教信仰本体', liner: '巫师体系开创者，远古超品，自断以保巫师传承不灭', rel: [] },
};
const T2_FACTION = { 许新年: '云鹿书院', 楚元缜: '云鹿书院', 褚采薇: '司天监', 杨千幻: '司天监', 钟璃: '司天监', 杨砚: '打更人', 许平志: '打更人', 李灵素: '天宗', 度厄: '佛门', 阿苏罗: '佛门', 白姬: '万妖国', 浮香: '万妖国' };

const FAC_CARDS = [
  ['打更人', 'protagonist', '大奉的夜巡衙门', '缉查办案的隐秘衙门，许七安的起点', ['许七安', '魏渊', '杨砚', '许平志']],
  ['司天监', 'ally', '术士的摇篮', '监正座下弟子出众，术士体系所在', ['监正', '褚采薇', '杨千幻', '钟璃']],
  ['天宗', 'ally', '道门圣地', '圣女圣子出身的道门大宗', ['李妙真', '李灵素']],
  ['云鹿书院', 'ally', '儒家学府', '许新年与状元郎的师门', ['许新年', '楚元缜']],
  ['大奉皇室', 'neutral', '大奉王朝', '元景帝在位，朝堂暗流', ['元景帝']],
  ['佛门', 'neutral', '西域与大乘', '度厄国师与金刚罗汉', ['度厄', '阿苏罗', '神殊']],
  ['万妖国', 'neutral', '妖族国度', '九尾天狐的分魂与公主', ['白姬', '浮香']],
  ['巫神教', 'foe', '东北三国国教', '巫师体系信仰，曾屠魏渊满门', ['巫神']],
];
// 法器/神通图鉴（词条文本内可锚定）
const CODEx = [
  ['地书碎片', '天地会诸人各持一片，可隔空传讯；许七安持三号碎片，李妙真持二号碎片'],
  ['照神镜', '元景帝持有的法器，可照神魂'],
  ['招魂幡', '元景帝持有的法器，与魂魄相关'],
  ['金锣', '打更人金锣阶的法器，杨砚持有，锣声可退敌'],
  ['八卦风水盘', '褚采薇的风水师道具'],
  ['杀贼果位', '度厄罗汉持有的佛门果位'],
  ['银枪·飞剑', '李妙真的兵器：银枪与飞剑，配鳞甲红披风'],
];

// ============ 工具 ============
const cutBySentence = (s, max) => {
  s = (s || '').replace(/\r?\n+/g, ' ').trim();
  if (s.length <= max) return s;
  const parts = s.slice(0, max).split(/(?<=[。！？；])/).filter(Boolean);
  return (parts.length > 1 ? parts.slice(0, -1).join('') : s.slice(0, max)).trim() + '……';
};
const SPOILER_RE = /(陨落|身死|战死|被杀|所杀|殒命|死亡|死了|败亡|自尽|身亡|牺牲|自我了断)/;
const safeLiner = ol => {
  if (!ol || !SPOILER_RE.test(ol)) return ol || '';
  const parts = ol.split(/，|。|；/).filter(Boolean);
  const s = parts.filter(p => !SPOILER_RE.test(p));
  return s.length ? s.slice(0, 3).join('，') : '身份信息详见人物卡';
};
const FAC_COLOR = {
  打更人: ['#2b2f3a', '#c9a25f'], 司天监: ['#3a4a5c', '#b8c9dd'], 天宗: ['#4a5c8a', '#d9e4f0'],
  云鹿书院: ['#5c4a2e', '#e8dcc0'], 佛门: ['#8a6a2e', '#f0e4c0'], 万妖国: ['#5c2e5c', '#e0c9e0'],
  大奉皇室: ['#6b3226', '#e8d0b8'], 巫神教: ['#26262e', '#9aa0b5'],
};
const TIER_COLOR = { 1: ['#6b3fa0', '#e8dcf5'], 2: ['#2f5d8a', '#d6e4f0'], 3: ['#5a5a5a', '#e2e2e2'] };
const sealSvg = c => {
  const [bg, fg] = FAC_COLOR[c.faction] || TIER_COLOR[c.tier] || TIER_COLOR[3];
  const big = (c.name || '?')[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="14" fill="${bg}"/>
<rect x="5.5" y="5.5" width="89" height="89" rx="10" fill="none" stroke="${fg}" stroke-width="1.6" opacity="0.55"/>
<rect x="9" y="9" width="82" height="82" rx="8" fill="none" stroke="${fg}" stroke-width="0.8" opacity="0.3"/>
<text x="50" y="60" font-size="46" fill="#ffffff" text-anchor="middle" font-family="KaiTi,STKaiti,'Noto Serif SC',serif" font-weight="700">${big}</text>
</svg>`;
};
const py = s => pinyin(s, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').replace(/[^a-z0-9]/g, '');
// 速答句名字前缀剥离：只匹配名字+分隔符
const stripNamePrefix = (s, name) => s.replace(new RegExp('^' + name + '\\s*[（(，,、：:]?\\s*'), '').trim();
// 模板腔剥离：元数据句过滤 + 句内书名片段剥离（先剥名字前缀再处理，别名已单独提取）
const stripTemplate = (s, name) => {
  let all = stripNamePrefix(String(s || ''), name);
  const sents = all.split(/(?<=[。！？])/).filter(Boolean);
  const metaRe = /^(别名|性别|年龄|拥有[^，。；]{0,20}别名)/;
  const good = sents.filter(x => !metaRe.test(x.trim()) && !/电视剧|动漫|动画|饰演|真人剧|广播剧|有声|登场作品/.test(x));
  const clean = x => x
    .replace(/是?[^，。；]{0,14}《大奉打更人》(及其衍生作品)?中?的?(虚拟)?/g, '')
    .replace(/^(的)?(虚拟)?(核心)?(角色|人物|男主角|女主角)/, '')
    .replace(/，?的?(虚拟)?角色/g, '')
    .replace(/^是/, '').replace(/^，/, '').trim();
  let pick = clean(good[0] || sents[0] || '');
  if (pick.length < 10 && good.length > 1) pick = clean(good[1]);
  return pick || all.slice(0, 60);
};
// 别名提取："别名七号、天宗圣子、海王" / "别名许辞旧、许二郎"
const extractAliases = text => {
  const m = /别名[是]?([^，。；]{2,40})/.exec(text || '');
  if (!m) return [];
  return m[1].split(/[、,，]/).map(x => x.trim()).filter(x => x.length >= 2 && x.length <= 12).slice(0, 6);
};
// 性别：显式"性别男/女" > 强信号 > 代词多数 > 空
const genderOf = (text, t1) => {
  if (t1 && t1.gender) return t1.gender;
  const ex = /性别([男女])/.exec(text || '');
  if (ex) return ex[1];
  if (/女性角色|女主角/.test(text)) return '女';
  if (/男性角色|男主角/.test(text)) return '男';
  const she = (text.match(/她/g) || []).length, he = (text.match(/他/g) || []).length;
  if (she >= he + 3) return '女';
  if (he >= she + 3) return '男';
  return '';
};

// ============ 加载过滤 ============
const raws = {};
for (const f of fs.readdirSync(path.join(__dirname, 'raw-baike'))) {
  if (!f.endsWith('.json')) continue;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw-baike', f), 'utf8'));
    if (!j.key) continue;
    const text = (j.desc || '') + (j.abstract || '');
    if (!/大奉|许七安|打更人/.test(text)) continue; // 挡同名异物（临安公主/怀庆府/九尾狐等）
    const target = j.key;
    if (!raws[target] || text.length > ((raws[target].desc || '') + (raws[target].abstract || '')).length) raws[target] = j;
  } catch {}
}

// ============ 组装 ============
const warn = [];
const chars = [];
const facText = {};
for (const [name, j] of Object.entries(raws)) {
  const text = ((j.desc || '') + ' ' + (j.abstract || '')).replace(/\r?\n+/g, ' ').trim();
  if (name === '大奉打更人') continue; // 词条为电视剧条目，书级摘要手写
  if (FACTIONS.has(name) || name === '打更人') { facText[name === '打更人' ? '打更人' : name] = cutBySentence(text.replace(/^更夫.{0,200}?打更人[，。]?/, ''), 70); continue; }
  const t1 = T1[name] || null;
  if (!t1 && !/^[\u4e00-\u9fa5·]{2,6}$/.test(name)) { warn.push('丢弃:' + name); continue; }
  let oneLiner = t1 ? t1.liner : '';
  if (!oneLiner) {
    oneLiner = stripTemplate(j.abstract || j.desc || '', name).split(/(?<=[。！？])/)[0] || '';
  }
  oneLiner = cutBySentence(oneLiner, 110);
  const pin = t1 ? t1.pin : PIN_OF(text);
  const gender = genderOf(text, t1);
  const faction = (t1 && t1.faction) || T2_FACTION[name] || [...FACTIONS].find(f => text.includes(f)) || '';
  const tier = t1 ? t1.tier : (text.length >= 250 ? 2 : 3);
  chars.push({
    name, tier,
    aliases: extractAliases(j.abstract || j.desc || ''),
    importance: tier === 1 ? 'protagonist' : (tier === 2 ? 'major' : 'supporting'),
    identity: (t1 && t1.identity) || cutBySentence(stripTemplate(j.abstract || j.desc || '', name), 90),
    faction, generation: pin,
    cultivation: pin ? pin + (text.match(new RegExp(pin + '[^，。；]{0,4}')) || [['']])[0].slice(pin.length) : '',
    status: (t1 && t1.status) || '',
    oneLiner,
    persona: null,
    relationships: ((t1 && t1.rel) || []).map(([rn, relation]) => ({ name: rn, relation, id: '' })),
    timeline: [], evidence: [],
    mentions: text.length,
    chapterCount: 0, firstChapter: 0, lastChapter: 0,
    gender,
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
const idCount = {};
for (const c of chars) {
  const pid = py(c.name);
  idCount[pid] = (idCount[pid] || 0) + 1;
  c.id = idCount[pid] > 1 ? pid + idCount[pid] : pid;
  c.pinyin = pid;
  c.oneLinerSafe = safeLiner(c.oneLiner);
  c.seal = sealSvg(c);
}
const byName = Object.fromEntries(chars.map(c => [c.name, c]));
for (const c of chars) for (const r of c.relationships) { const t = byName[r.name]; if (t) r.id = t.id; }


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

// profiles 关系 id 回填（档案合并后补一轮）
{
  const byNameP2 = Object.fromEntries(chars.map(c => [c.name, c]));
  for (const c of chars) for (const r of c.relationships) { if (r.id) continue; const t2 = byNameP2[r.name]; if (t2) r.id = t2.id; }
}

// ============ 势力/阶梯 ============
const facCount = {};
for (const c of chars) if (c.faction) facCount[c.faction] = (facCount[c.faction] || 0) + 1;
const factionEntities = FAC_CARDS.map(([name, stance, stanceTxt, one, core]) => ({
  id: py(name), name, stance, stanceTxt,
  one: facText[name] || one, core,
  members: facCount[name] || core.filter(n => byName[n]).length,
  stages: [],
})).filter(f => f.members > 0 || f.core.length);
const factions = [...new Set(chars.map(c => c.faction).filter(Boolean).concat(FAC_CARDS.map(f => f[0])))];
// 品级排序（低→高，与 ladder 一致；纵表按书目 generations 顺序渲染）
const genList = PIN_ORDER.slice().reverse().filter(p => chars.some(c => c.generation === p));
const tiers = { 1: 0, 2: 0, 3: 0 };
chars.forEach(c => tiers[c.tier]++);

const book = {
  id: 'dafengdagengren',
  title: '大奉打更人',
  author: '卖报小郎君',
  updatedAt: TODAY,
  chapterCount: 814, // 原文落盘章数（兜底提取口径）
  summary: '卖报小郎君所著古装玄幻探案小说：现代警察许七安穿越大奉王朝，因税银案入狱后以打更人身份查案修行，武夫、佛门、蛊师三修，在朝堂、江湖与超品存在的博弈中步步登高。',
  factions, generations: genList,
  stats: { tiers },
  factionEntities,
  systemPage: { realms: [], xianji: [] },
  characters: chars,
};

// 法器图鉴
fs.writeFileSync(path.join(__dirname, 'fqi.json'), JSON.stringify(CODEx.map(([n, s]) => ({ n, s })), null, 1), 'utf8');

const DST = path.join(__dirname, '..', '..', 'plugin', 'data', 'dafengdagengren.json');
fs.writeFileSync(DST, JSON.stringify(book));
console.log(`✓ ${DST} (${(fs.statSync(DST).size / 1024).toFixed(0)}KB)`);
console.log(`人物 ${chars.length}：tier1 ${tiers[1]} / tier2 ${tiers[2]} / tier3 ${tiers[3]}`);
console.log(`势力卡 ${factionEntities.length} / 法器图鉴 ${CODEx.length}`);
console.log('品级组（超品→九品）:', PIN_ORDER.filter(p => genList.includes(p)).join(' → ') || '（无）');
const noPin = chars.filter(c => !c.generation).map(c => c.name);
if (noPin.length) console.log('无品级词：', noPin.join(','));
console.log('notes:'); warn.forEach(w => console.log(' ', w));
