// 斗破苍穹 MVP 构建脚本：百科词条（raw-baike/）→ plugin/data/doupocangqiong.json
// 范式=诡秘（无 wiki 仓库）：词条卡 + 编辑配置；正文级内容只在函数内瞬时处理，不落日志
// 后置：node analysis/gen-system.mjs doupocangqiong 写 systemPage v2 → sync-data.mjs 三副本
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-10-23';

// ============ 词条分类 ============
const YIHUO = new Set(['青莲地心火', '陨落心炎', '骨灵冷火', '三千焱炎火', '九幽金祖火', '金帝焚天炎', '红莲业火', '海心焰', '净莲妖火', '虚无吞炎']);
const FACTIONS = new Set(['迦南学院', '魂殿', '炎盟', '云岚宗', '魂族', '古族', '萧族', '药族', '炎族', '石族', '丹塔', '星陨阁', '花宗', '冰河谷', '魔炎谷', '天蛇府', '米特尔家族', '黑角域', '远古八族']);
// 同人归并：词条 key → 库内主名
const MERGE = { 药老: '药尘' };
// 别名补充（词条查不到的字面）
const EXTRA_ALIAS = { 药尘: ['药老'], 彩鳞: ['美杜莎'], 萧薰儿: ['薰儿'] };

// ============ tier1 编辑配置（事实以词条文本为准，此处只填把握项）============
const T1 = {
  萧炎: { tier: 1, faction: '炎盟', gender: '男', cultivation: '斗帝', status: '在世（成就斗帝）', identity: '萧家少主，药尘之徒，萧族后裔，最终成就斗帝', liner: '乌坦城萧家少主，药尘之徒，携异火一路逆袭终成斗帝', rel: [['药尘', '师父'], ['萧薰儿', '青梅竹马·伴侣'], ['彩鳞', '伴侣'], ['小医仙', '红颜知己'], ['紫妍', '伙伴'], ['海波东', '盟友'], ['云韵', '云岚宗旧识'], ['纳兰嫣然', '三年之约'], ['韩枫', '弑师之敌'], ['魂天帝', '宿敌']] },
  药尘: { tier: 1, faction: '', gender: '男', cultivation: '斗圣', status: '在世（重塑肉身）', identity: '萧炎的师父，传奇炼药师“药老”', liner: '寄身骨戒的传奇炼药师“药老”，萧炎的授业恩师', rel: [['萧炎', '弟子·如父'], ['韩枫', '叛徒弟子']] },
  萧薰儿: { tier: 1, faction: '古族', gender: '女', cultivation: '斗圣', status: '在世', identity: '古族大小姐，萧炎的青梅竹马', liner: '古族千金，萧炎的青梅竹马，守望萧族复兴的少年之约', rel: [['萧炎', '青梅竹马·伴侣'], ['古元', '父亲']] },
  彩鳞: { tier: 1, faction: '炎盟', gender: '女', cultivation: '斗圣', status: '在世', identity: '蛇人族女王“美杜莎”，萧炎的伴侣', liner: '蛇人族女王“美杜莎”，与萧炎由敌转伴，炎盟的定海之柱', rel: [['萧炎', '伴侣']] },
  云韵: { tier: 1, faction: '花宗', gender: '女', cultivation: '斗尊', status: '在世', identity: '前云岚宗宗主，后入花宗', liner: '云岚宗末代宗主，宗门解散后入花宗，与萧炎情愫暗生', rel: [['萧炎', '云岚宗旧识'], ['云山', '师门长辈']] },
  小医仙: { tier: 1, faction: '', gender: '女', cultivation: '斗圣', status: '在世', identity: '身怀厄难毒体的少女，萧炎的红颜知己', liner: '身怀厄难毒体的白衣少女，以毒入道，萧炎一路护持的红颜', rel: [['萧炎', '红颜知己']] },
  紫妍: { tier: 1, faction: '炎盟', gender: '女', cultivation: '斗圣', status: '在世', identity: '太虚古龙族龙皇，萧炎的伙伴', liner: '贪吃的兽界小丫头，太虚古龙血脉觉醒后成古龙族龙皇', rel: [['萧炎', '伙伴']] },
  魂天帝: { tier: 1, faction: '魂族', gender: '男', cultivation: '斗帝', status: '败亡（被萧炎击败）', identity: '魂族族长，魂殿幕后主宰', liner: '魂族族长、魂殿背后的执棋人，为成斗帝布局万年', rel: [['萧炎', '宿敌']] },
  海波东: { tier: 2, faction: '米特尔家族', gender: '男', cultivation: '斗尊', status: '在世', identity: '“冰皇”海波东，后追随萧炎', liner: '“冰皇”海波东，米特尔家族供奉，后为炎盟臂膀', rel: [['萧炎', '盟友']] },
  纳兰嫣然: { tier: 2, faction: '云岚宗', gender: '女', cultivation: '斗王', status: '在世', identity: '云岚宗少宗主，与萧炎有三年之约', liner: '云岚宗少宗主，一纸退婚书引出“三年之约”', rel: [['萧炎', '三年之约'], ['云山', '师长']] },
};
// tier2 势力补指（词条文本里没写明的归属）
const T2_FACTION = { 邙天尺: '迦南学院', 林修崖: '迦南学院', 柳擎: '迦南学院', 苏千: '迦南学院', 青鳞: '天蛇府', 萧战: '萧族', 萧厉: '萧族', 萧玄: '萧族', 古元: '古族', 雅妃: '米特尔家族', 云棱: '云岚宗', 韩枫: '魂殿' };
// tier 手工上调（词条文本短但戏份重的）
const T2_TIER = { 韩枫: 2 };
// 境界手工覆盖（正则误抬格时用，须有词条文本依据：萧战="高阶丹药将其修为提升至斗皇"）
const REALM_OVERRIDE = { 萧战: '斗皇' };
// 异火榜排名补遗（词条未载的通行榜单事实）
const RANK_OVERRIDE = { 青莲地心火: '十九' };

// ============ 势力卡 ============
const FAC_CARDS = [
  ['萧族', 'protagonist', '萧炎一门', '远古八族之一，萧炎的家系', ['萧炎', '萧战', '萧玄', '萧厉']],
  ['炎盟', 'protagonist', '萧炎缔造的联盟', '以萧炎为盟主的势力联合', ['萧炎', '紫妍', '海波东']],
  ['古族', 'ally', '远古八族·薰儿母族', '血脉尊贵的远古大族', ['萧薰儿', '古元']],
  ['迦南学院', 'ally', '黑角域的学府', '内院强者为骨，萧炎的发迹之地', ['苏千', '邙天尺', '林修崖', '柳擎']],
  ['米特尔家族', 'ally', '加玛帝国三大家族', '冰皇坐镇的商贸世家', ['海波东', '雅妃']],
  ['丹塔', 'ally', '中州炼药师组织', '炼药师的圣地', []],
  ['星陨阁', 'ally', '中州势力', '后与萧炎结盟', []],
  ['花宗', 'neutral', '中州宗门', '云韵后来的归宿', ['云韵']],
  ['天蛇府', 'neutral', '蛇人半兽势力', '青鳞的归属', ['青鳞']],
  ['云岚宗', 'foe', '加玛帝国宗门（已解散）', '三年之约的另一方', ['纳兰嫣然', '云山', '云棱']],
  ['魂殿', 'foe', '魂族爪牙·搜集灵魂', '捕魂为力的神秘强权', ['韩枫', '魂天帝']],
  ['魂族', 'foe', '远古八族之首', '萧族覆灭的元凶，萧炎终极之敌', ['魂天帝']],
  ['魔炎谷', 'neutral', '黑角域势力', '与迦南学院比邻而处', []],
  ['冰河谷', 'neutral', '中州势力', '以冰入道', []],
  ['药族', 'neutral', '远古八族·炼药世家', '药尘的出身族系', []],
  ['炎族', 'neutral', '远古八族·异火传承', '执掌异火传承之族', []],
  ['石族', 'neutral', '远古八族', '远古遗族', []],
  ['黑角域', 'neutral', '地域·无法之地', '强者为尊的混乱地带', []],
];
// 异火持有者（只填把握项）
const YIHUO_MEMBER = { 青莲地心火: '萧炎（曾持）', 陨落心炎: '萧炎（曾收）', 骨灵冷火: '药尘（曾持）', 三千焱炎火: '萧炎（曾收）', 净莲妖火: '萧炎（曾收）', 虚无吞炎: '魂族（契合）', 金帝焚天炎: '古族（传承）', 九幽金祖火: '炎族（传承）', 海心焰: '韩枫（曾持）' };

// ============ 工具 ============
const REALM_ORDER = ['斗帝', '斗圣', '斗尊', '斗宗', '斗皇', '斗王', '斗灵', '大斗师', '斗师', '斗者', '斗之气'];
// 境界提取：先摘掉"半步X/冲击X/斗帝之下/斗圣遗迹"这类不构成真实境界的短语再扫描
// （萧玄"半步斗帝"归斗圣档；慕青鸾"冲击斗宗/斗圣遗迹"不得抬格）
function realmOfText(text) {
  const t = text
    .replace(/半步斗帝|斗帝之下/g, '〖斗圣〗')
    .replace(/冲[击刺][^，。\s]{0,4}斗[帝圣尊宗皇王灵]|以斗[帝圣尊宗皇王灵]巅峰境界冲击斗[帝圣尊宗皇王灵]|半只脚踏入斗[帝圣尊宗皇王灵]|斗圣遗迹/g, '');
  return REALM_ORDER.find(r => t.includes(r)) || '';
}
// 名字前缀剥离：只在名字后紧跟分隔符/括号时剥（"萧玄生前已达…"不动，旧写法 [^）)]* 会吞整句）
const stripNamePrefix = (s, name) => s.replace(new RegExp('^' + name + '\\s*[（(，,、：:]\\s*'), '').trim();
const cutBySentence = (s, max) => {
  s = (s || '').replace(/\r?\n+/g, ' ').trim();
  if (s.length <= max) return s;
  const parts = s.slice(0, max).split(/(?<=[。！？；])/).filter(Boolean);
  return (parts.length > 1 ? parts.slice(0, -1).join('') : s.slice(0, max)).trim() + '……';
};
const SPOILER_RE = /(陨落|身死|战死|被杀|所杀|殒命|死亡|死了|败亡|自尽|身亡|牺牲)/;
const safeLiner = ol => {
  if (!ol || !SPOILER_RE.test(ol)) return ol || '';
  const parts = ol.split(/，|。|；/).filter(Boolean);
  const s = parts.filter(p => !SPOILER_RE.test(p));
  return s.length ? s.slice(0, 3).join('，') : '身份信息详见人物卡';
};
const FAC_COLOR = {
  萧族: ['#5a3d2b', '#e8dcc9'], 炎盟: ['#8a3d2b', '#f5ded0'], 古族: ['#3d5a80', '#d9e4f0'],
  魂族: ['#2b2b3a', '#b9b9cc'], 魂殿: ['#33334d', '#c3c3dd'], 云岚宗: ['#4a6b8a', '#dbe7f2'],
  迦南学院: ['#3f6b50', '#d9ecdf'], 花宗: ['#8a5a7a', '#f0dbe9'], 古族备: ['#3d5a80', '#d9e4f0'],
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
const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const cn2num = s => {
  if (/^\d+$/.test(s)) return +s;
  if (CN_NUM[s]) return CN_NUM[s];
  const m = /^([一二两三四五六七八九])?十([一二三四五六七八九])?$/.exec(s);
  if (!m) return 999;
  return (CN_NUM[m[1]] || 1) * 10 + (CN_NUM[m[2]] || 0);
};
const factionInText = t => [...FACTIONS].find(f => t.includes(f) && f !== '远古八族') || '';

// ============ 加载 + 过滤（描述含"斗破苍穹"才收，挡同名无关词条）============
const raws = {};
for (const f of fs.readdirSync(path.join(__dirname, 'raw-baike'))) {
  if (!f.endsWith('.json')) continue;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw-baike', f), 'utf8'));
    if (!j.key) continue;
    const text = (j.desc || '') + (j.abstract || '');
    if (!text.includes('斗破苍穹') && !text.includes('斗气大陆')) continue;
    const target = MERGE[j.key] || j.key;
    // 同主名多词条：取更长者
    if (!raws[target] || text.length > ((raws[target].desc || '') + (raws[target].abstract || '')).length) raws[target] = j;
  } catch {}
}

// ============ 组装人物 ============
const warn = [];
const dropped = [];
const chars = [];
const facText = {}; // 势力词条文本（势力卡 one 用）
const yihuoEntries = [];
for (const [name, j] of Object.entries(raws)) {
  const text = ((j.desc || '') + ' ' + (j.abstract || '')).replace(/\r?\n+/g, ' ').trim();
  if (YIHUO.has(name)) {
    const rankM = text.match(/(?:异火榜[^。，]{0,3}|排名[^。，]{0,2}|位列[^。，]{0,2})第([一二三四五六七八九十百\d]+)(?:[名位的]|[,，。；]|$)/);
    const rank = rankM ? rankM[1] : (RANK_OVERRIDE[name] || '');
    const rankTxt = rank ? '异火榜第' + rank + '。' : '';
    const clean = (j.abstract || j.desc || '')
      .replace(/天蚕土豆[^，。；]*《斗破苍穹》[^，。；]*/g, '')
      .replace(/《斗破苍穹》(及其衍生作品)?中的?(一种|之一)?(虚拟)?(角色|人物|势力|宗门|组织|种族|地域)/g, '')
      .replace(/是，/g, '').replace(/，{2,}/g, '，').replace(/^，/g, '').trim();
    yihuoEntries.push({ n: name, s: rankTxt + cutBySentence(clean, 130), m: YIHUO_MEMBER[name] || '', rank });
    continue;
  }
  if (FACTIONS.has(name)) { facText[name] = cutBySentence((j.abstract || j.desc || ''), 80); continue; }
  if (name === '斗破苍穹') continue; // 作品词条本体只作书级摘要，不是人物
  // 人物
  const t1 = T1[name] || null;
  if (!t1 && !/^[\u4e00-\u9fa5·]{2,6}$/.test(name)) { dropped.push(name); continue; }
  // oneLiner：T1 手工 > 词条摘要首句（剥模板腔与名字前缀）
  let oneLiner = t1 ? t1.liner : '';
  if (!oneLiner) {
    const sents = (j.abstract || j.desc || '').split(/(?<=[。！？])/).filter(Boolean);
    const core = sents.filter(s => !/所著|衍生作品|登场作品|角色之一|人物之一/.test(s));
    oneLiner = stripNamePrefix(core[0] || sents[0] || '', name);
  }
  oneLiner = cutBySentence(oneLiner, 110);
  const realm = t1 ? t1.cultivation.match(/^(斗帝|斗圣|斗尊|斗宗|斗皇|斗王|斗灵|大斗师|斗师|斗者|斗之气)/)?.[1] || '' : (REALM_OVERRIDE[name] || realmOfText(text));
  const gender = t1 ? t1.gender : ((text.match(/她/g) || []).length > (text.match(/他/g) || []).length ? '女' : '男');
  const faction = (t1 && t1.faction) || T2_FACTION[name] || factionInText(text);
  const tier = t1 ? t1.tier : (T2_TIER[name] || (text.length >= 250 ? 2 : 3));
  chars.push({
    name, tier,
    aliases: EXTRA_ALIAS[name] || [],
    importance: tier === 1 ? 'protagonist' : (tier === 2 ? 'major' : 'supporting'),
    identity: (t1 && t1.identity) || cutBySentence((j.abstract || j.desc || '').replace(new RegExp('^' + name + '[，,、\\s]*'), ''), 90),
    faction, generation: realm,
    cultivation: (t1 && t1.cultivation) || (realm ? realm + '（词条载）' : ''),
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
// 势力文本反查未覆盖的 T2_FACTION（词条写了但名字对不上时警告）
for (const [k, v] of Object.entries(T2_FACTION)) if (!chars.find(c => c.name === k)) warn.push('T2_FACTION 无对应人物: ' + k);
for (const k of Object.keys(T1)) if (!raws[k]) warn.push('T1 无词条: ' + k);
if (dropped.length) warn.push('非中文/超长名丢弃: ' + dropped.join(','));

// 排序：tier 升序、信息量降序
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


// id / pinyin / oneLinerSafe / seal
const idCount = {};
for (const c of chars) {
  const pid = py(c.name);
  idCount[pid] = (idCount[pid] || 0) + 1;
  c.id = idCount[pid] > 1 ? pid + idCount[pid] : pid;
  c.pinyin = pid;
  c.oneLinerSafe = safeLiner(c.oneLiner);
  c.seal = sealSvg(c);
}
// 关系 id 回填
const byName = Object.fromEntries(chars.map(c => [c.name, c]));
for (const c of chars) for (const r of c.relationships) { const t = byName[r.name]; if (t) r.id = t.id; }


// ============ 势力/阶梯/统计 ============
const facCount = {};
for (const c of chars) if (c.faction) facCount[c.faction] = (facCount[c.faction] || 0) + 1;
const factionEntities = FAC_CARDS.map(([name, stance, stanceTxt, one, core]) => ({
  id: py(name), name, stance, stanceTxt,
  one: facText[name] || one, core,
  members: facCount[name] || core.filter(n => byName[n]).length,
  stages: [],
})).filter(f => f.members > 0 || f.core.length);
const factions = [...new Set([chars.map(c => c.faction).filter(Boolean), ...FAC_CARDS.map(f => f[0])].flat())];
const genList = [...new Set(chars.map(c => c.generation).filter(Boolean))];
// 阶梯顺序
genList.sort((a, b) => REALM_ORDER.indexOf(a) - REALM_ORDER.indexOf(b));
const bkBook = raws['斗破苍穹'];
const tiers = { 1: 0, 2: 0, 3: 0 };
chars.forEach(c => tiers[c.tier]++);

const book = {
  id: 'doupocangqiong',
  title: '斗破苍穹',
  author: '天蚕土豆',
  updatedAt: TODAY,
  chapterCount: 1623, // 官方连载章数（档案章号上限 1448）
  summary: (bkBook ? (bkBook.abstract || bkBook.desc) : '').slice(0, 400) || '天蚕土豆所著玄幻小说：萧炎携异火自乌坦城起步，一路逆袭终成斗帝。',
  factions, generations: genList,
  stats: { tiers },
  factionEntities,
  systemPage: { realms: [], xianji: [] }, // v1 占位，gen-system doupocangqiong 重写为 v2
  characters: chars,
};

// ============ 异火图鉴 ============
yihuoEntries.sort((a, b) => cn2num(a.rank) - cn2num(b.rank));
fs.writeFileSync(path.join(__dirname, 'yihuo.json'), JSON.stringify(yihuoEntries, null, 1), 'utf8');

// ============ 输出 ============
const DST = path.join(__dirname, '..', '..', 'plugin', 'data', 'doupocangqiong.json');
fs.writeFileSync(DST, JSON.stringify(book));
console.log(`✓ ${DST} (${(fs.statSync(DST).size / 1024).toFixed(0)}KB)`);
console.log(`人物 ${chars.length}：tier1 ${tiers[1]} / tier2 ${tiers[2]} / tier3 ${tiers[3]}`);
console.log(`势力卡 ${factionEntities.length} / 异火图鉴 ${yihuoEntries.length}`);
console.log(`境界组 ${genList.join(' → ') || '（无）'}`);
const noRealm = chars.filter(c => !c.generation).map(c => c.name);
if (noRealm.length) console.log('无境界词：', noRealm.join(','));
console.log('\nbuild notes:');
warn.forEach(w => console.log(' ', w));
