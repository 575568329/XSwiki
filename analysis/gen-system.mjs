// W2.5 体系页数据生成（v2，多书通用）：node gen-system.mjs [bookId...]
// 不带参数处理 plugin/data 下所有有配置的书目。每本书一份配置：
//   theme        每书主题类（前端 .sys-wrap.theme-* 接强调色）
//   ladder       主阶梯（realms 统一 低→高 存储与渲染），classify 把人物归入唯一 key
//   extraLadders 独立体系（如玄鉴释修六阶，与仙修不对称，不进主阶梯）
//   codex        图鉴（玄鉴=仙基，诡秘=途径；desc 含 → 的预解析为 seqs 徽章）
// 输出合并进 plugin/data/<bookId>.json 顶层 systemPage，随后跑 sync-data.mjs 同步三份副本。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'plugin', 'data');

// —————————— 玄鉴仙族 ——————————
// 主阶梯口径（2026-10-22 修为体系页核对）：六境 胎息→练气→筑基→紫府→金丹→道胎；
// 真人/真君是金丹证果位之称，归金丹；仙人独立于六境之上；凡人在六境之外。
// 释修不进主阶梯（不对称体系），由 extraLadders 单独成阶。
const XUANJIAN_LADDER = [ // 低 → 高
  { key: 'rv-mortal', name: '凡人' },
  { key: 'rv-taixi', name: '胎息（养轮）' },
  { key: 'rv-lianqi', name: '练气（服气）' },
  { key: 'rv-foundation', name: '筑基' },
  { key: 'rv-zifu', name: '紫府' },
  { key: 'rv-jindan', name: '金丹（真君·真人之称）' },
  { key: 'rv-daotai', name: '道胎（元婴）' },
  { key: 'rv-immortal', name: '仙人' },
];

function xuanjianRealmOf(c) {
  // 严格字段（cultivation/identity/v2stages）优先；notes 仅兜底认明确境界表述
  const strict = [c.cultivation || '', c.identity || ''].join(' ');
  const stageRv = (c.stages || []).map(s => s.cultivationAt || '').join(' ');
  const loose = stageRv + ' ' + (c.rosterNotes || []).map(n => n.note).join(' ');
  if (c.name === '陆江仙') return 'rv-immortal';
  if (/(仙人|仙君)/.test(strict)) return 'rv-immortal';
  if (/道胎/.test(strict)) return 'rv-daotai';
  if (/(真君|玄君)/.test(strict) || /(金丹|金性|大真人)/.test(strict + ' ' + stageRv)) return 'rv-jindan';
  if (/紫府/.test(strict + ' ' + stageRv)) return 'rv-zifu';
  if (/筑基/.test(strict + ' ' + stageRv)) return 'rv-foundation';
  if (/练气/.test(strict + ' ' + stageRv)) return 'rv-lianqi';
  if (/胎息|灵初轮|玉京轮|青元轮|周行轮|承明轮|玄景轮/.test(strict + ' ' + stageRv)) return 'rv-taixi';
  // notes 兜底: 仅认'境界词+层/期/巅峰/【仙基】'的明确表述
  if (/(紫府|筑基|胎息|练气)[一二三四五六七八九十]?层|[筑紫][基府](初期|中期|后期|巅峰)/.test(loose)) {
    if (/紫府/.test(loose)) return 'rv-zifu';
    if (/筑基/.test(loose)) return 'rv-foundation';
    if (/胎息|轮/.test(loose)) return 'rv-taixi';
    return 'rv-lianqi';
  }
  if (/凡人/.test(strict)) return 'rv-mortal';
  return null;
}

// 释修归组：只认人物自己的首段描述（cultivation/identity/首条备注）里的释教身份词。
// 旧口径扫全部备注，把"备注里提到释修人物"的仙修/妖修（狼妖、闻武、江雁等）误带进组
// （39 人里近半是噪声）；新口径宁缺毋滥，漏掉的个别人后续走 baike-fix 补。
const SHIXIU_ID_RE = /(释修|和尚|僧人|僧侣|住持|大德|度牒|摩诃|世尊|怜愍)/;
const XIANXIU_GRADE_RE = /(紫府|筑基|练气|胎息)[一二三四五六七八九十]*层|[筑紫][基府](初期|中期|后期|巅峰)/;

function shixiuMembersOf(c) {
  const firstNote = ((c.rosterNotes || [])[0] || {}).note || '';
  const firstSeg = [c.cultivation || '', c.identity || '', firstNote].join(' ').trim();
  const m = SHIXIU_ID_RE.exec(firstSeg);
  if (!m) return false;
  // 释教身份词须出现在介绍开头（身份定语位置，前 20 字）；"所斩…释修仅一名"这类
  // 后文转述不算。宁缺毋滥，漏掉的个别人走 baike-fix 补。
  if (m.index > 20) return false;
  if (XIANXIU_GRADE_RE.test(firstSeg)) return false; // 首段有明确仙修境界的不算
  if (c.name === '陆江仙') return false;
  return true;
}

// 释修分阶：位阶词须出现在某段备注开头（或括注"（X级/位阶）"），避免把
// "在南世尊之下"这类转述误当位阶。低 → 高：僧侣 → 法师 → 怜愍 → 摩诃 → 法相 → 世尊。
const SHIXIU_STAGES = [ // 低 → 高
  { key: 'sx-senglv', name: '僧侣·未详' },
  { key: 'sx-fashi', name: '法师' },
  { key: 'sx-lianmin', name: '怜愍' },
  { key: 'sx-mohe', name: '摩诃' },
  { key: 'sx-faxiang', name: '法相' },
  { key: 'sx-shizun', name: '世尊' },
];
const GRADE_TO_KEY = { 世尊: 'sx-shizun', 摩诃: 'sx-mohe', 法相: 'sx-faxiang', 怜愍: 'sx-lianmin', 法师: 'sx-fashi' };

function shixiuStageOf(c) {
  const segs = [c.cultivation || '', c.identity || '', ...(c.rosterNotes || []).map(n => n.note || '')]
    .filter(Boolean).slice(0, 3);
  for (const s of segs) {
    const m = /^[^，。；：]*?(世尊|摩诃|法相|怜愍|法师)/.exec(s.trim());
    if (m) return GRADE_TO_KEY[m[1]];
  }
  const paren = /（[^）]*?(怜愍|摩诃)[级位阶]*[^）]*）/.exec(segs.join('│'));
  if (paren) return GRADE_TO_KEY[paren[1]];
  return 'sx-senglv';
}

const XUANJIAN = {
  theme: 'xianzu',
  ladder: {
    title: '境界阶梯',
    sub: '由低到高 · 数字为已收录人数 · 点击人名查看档案',
    realms: XUANJIAN_LADDER,
  },
  extraLadders: [{
    key: 'shixiu',
    title: '释修阶位',
    name: '释修（僧侣→世尊）',
    sub: '与仙修不对称的独立体系 · 同为由低到高',
    stages: SHIXIU_STAGES,
    memberOf: shixiuMembersOf,
    stageOf: shixiuStageOf,
  }],
  codex: { title: '仙基图鉴', sub: '已证实的仙基种类与首位证得者', kind: 'xianji' },
};

function buildXuanjian(data) {
  const realms = XUANJIAN_LADDER.map(l => ({ ...l, count: 0, reps: [], _pool: [] }));
  const realmByKey = new Map(realms.map(r => [r.key, r]));
  const shixiu = SHIXIU_STAGES.map(l => ({ ...l, count: 0, reps: [], _pool: [] }));
  const stageByKey = new Map(shixiu.map(r => [r.key, r]));
  for (const c of data.characters) {
    const k = xuanjianRealmOf(c);
    if (k && realmByKey.has(k)) {
      const r = realmByKey.get(k);
      r.count++;
      r._pool.push(c);
    }
    if (shixiuMembersOf(c)) {
      const s = stageByKey.get(shixiuStageOf(c));
      s.count++;
      s._pool.push(c);
    }
  }
  const top = pool => pool.sort((a, b) => (b.mentions || 0) - (a.mentions || 0)).slice(0, 4)
    .map(c => c.name + (c.name === '陆江仙' ? '(器灵)' : ''));
  for (const r of realms) r.reps = top(r._pool);
  for (const s of shixiu) s.reps = top(s._pool);
  for (const r of [...realms, ...shixiu]) delete r._pool;

  // 仙基图鉴（百科口径 2026-10-22）: ①"仙基『X』"显式 ②境界词+【X】；排除"箓【X】"箓名
  const BAD_END = /[山洞宫岳门府峰]$/;
  const REALM_WORDS = /^(筑基|紫府|练气|胎息|金丹|真人|仙人|圆满|突破)$/;
  const xianjiMap = new Map();
  for (const c of data.characters) {
    const notes = (c.rosterNotes || []).map(n => n.note).join(' ') + ' ' + (c.cultivation || '') + ' ' + (c.identity || '');
    const cands = [];
    for (const m of notes.matchAll(/仙基(?:之名)?[『「'‘]([^』」'’]{2,6})[』」'’]/g)) cands.push(m[1].trim());
    for (const m of notes.matchAll(/(?:筑基|紫府|灵修|巅峰|后期|中期|前期|假紫府)【([^】]{2,6})】/g)) cands.push(m[1].trim());
    for (const name of cands) {
      const idx = notes.indexOf('【' + name + '】');
      const pre = idx > 0 ? notes[idx - 1] : '';
      if (!name || BAD_END.test(name) || REALM_WORDS.test(name) || name.includes('真人') || pre === '箓') continue;
      if (!xianjiMap.has(name)) xianjiMap.set(name, { name, member: '', desc: '' });
      const e = xianjiMap.get(name);
      if (!e.member && (c.mentions || 0) > 50) e.member = c.name;
      if (!e.desc) e.desc = (c.cultivation || '').includes(name) ? (c.cultivation || '') : notes.slice(Math.max(0, notes.indexOf(name) - 10), notes.indexOf(name) + 20).replace(/\s+/g, '');
    }
  }
  const entries = [...xianjiMap.values()].filter(x => x.member).slice(0, 20);

  return {
    version: 2,
    theme: XUANJIAN.theme,
    ladder: { title: XUANJIAN.ladder.title, sub: XUANJIAN.ladder.sub, realms },
    extraLadders: [{
      key: 'shixiu', name: '释修（僧侣→世尊）', title: '释修阶位',
      sub: '与仙修不对称的独立体系 · 同为由低到高',
      stages: shixiu,
    }],
    codex: { title: XUANJIAN.codex.title, sub: XUANJIAN.codex.sub, entries },
  };
}

// —————————— wiki 型书目（配置驱动）：加一本 = WIKI_BOOKS 加一个配置项 ——————————
// 幂等：阶梯/图鉴同时兼容 v1（realms/xianji）与 v2（ladder.realms/codex.entries）形态，重复运行不丢数据
const prevRealms = sp => (sp && (sp.ladder && sp.ladder.realms || sp.realms)) || [];
const prevCodex = sp => (sp && (sp.codex && sp.codex.entries || sp.xianji)) || [];

const FANREN_LADDER = [ // 低 → 高
  { key: 'rv-mortal', name: '凡人' },
  { key: 'rv-lianqi', name: '练气' },
  { key: 'rv-foundation', name: '筑基' },
  { key: 'rv-jindan', name: '结丹' },
  { key: 'rv-yuanying', name: '元婴' },
  { key: 'rv-huashen', name: '化神' },
  { key: 'rv-lianxu', name: '炼虚' },
  { key: 'rv-heti', name: '合体' },
  { key: 'rv-dacheng', name: '大乘' },
  { key: 'rv-zhenxian', name: '真仙（金仙·太乙·大罗）' },
];
const FANREN_GEN_KEY = { 凡人: 'rv-mortal', 练气: 'rv-lianqi', 筑基: 'rv-foundation', 结丹: 'rv-jindan', 元婴: 'rv-yuanying', 化神: 'rv-huashen', 炼虚: 'rv-lianxu', 合体: 'rv-heti', 大乘: 'rv-dacheng', 真仙: 'rv-zhenxian' };

// —————————— 斗破苍穹（百科范式，build-doupo.mjs 产出）——————————
// 斗气阶梯：斗之气(1-9段)→斗者→…→斗帝；generation 恰为境界词，genKey 直查
const DOUPO_LADDER = [ // 低 → 高
  { key: 'rv-mortal', name: '凡人' },
  { key: 'rv-douzhi', name: '斗之气（1-9段）' },
  { key: 'rv-douzhe', name: '斗者' },
  { key: 'rv-doushi', name: '斗师' },
  { key: 'rv-dadou', name: '大斗师' },
  { key: 'rv-douling', name: '斗灵' },
  { key: 'rv-douwang', name: '斗王' },
  { key: 'rv-douhuang', name: '斗皇' },
  { key: 'rv-douzong', name: '斗宗' },
  { key: 'rv-douzun', name: '斗尊' },
  { key: 'rv-dousheng', name: '斗圣' },
  { key: 'rv-doudi', name: '斗帝' },
];
const DOUPO_GEN_KEY = { 斗之气: 'rv-douzhi', 斗者: 'rv-douzhe', 斗师: 'rv-doushi', 大斗师: 'rv-dadou', 斗灵: 'rv-douling', 斗王: 'rv-douwang', 斗皇: 'rv-douhuang', 斗宗: 'rv-douzong', 斗尊: 'rv-douzun', 斗圣: 'rv-dousheng', 斗帝: 'rv-doudi' };

// —————————— 大奉打更人（百科范式，build-dafeng.mjs 产出）——————————
// 品级轴：诸体系（武夫/术士/佛门/道门/巫师/蛊师/妖族）通用品级，九品→一品→超品
const DAFENG_LADDER = [ // 低 → 高
  { key: 'rv-p9', name: '九品' },
  { key: 'rv-p8', name: '八品' },
  { key: 'rv-p7', name: '七品' },
  { key: 'rv-p6', name: '六品' },
  { key: 'rv-p5', name: '五品' },
  { key: 'rv-p4', name: '四品' },
  { key: 'rv-p3', name: '三品' },
  { key: 'rv-p2', name: '二品' },
  { key: 'rv-p1', name: '一品' },
  { key: 'rv-p0', name: '超品' },
];
const DAFENG_GEN_KEY = { 九品: 'rv-p9', 八品: 'rv-p8', 七品: 'rv-p7', 六品: 'rv-p6', 五品: 'rv-p5', 四品: 'rv-p4', 三品: 'rv-p3', 二品: 'rv-p2', 一品: 'rv-p1', 超品: 'rv-p0' };

// —————————— 黎明之剑（百科+原文提取，build-liming.mjs 产出）——————————
// 魔法/骑士位阶 MVP：凡人→超凡者→传奇→神代存在（词条文本只支撑到"传奇骑士"级）
const LIMING_LADDER = [ // 低 → 高
  { key: 'rv-mortal', name: '凡人' },
  { key: 'rv-foundation', name: '超凡者（骑士·法师）' },
  { key: 'rv-zifu', name: '大法师·圣序' },
  { key: 'rv-zhenren', name: '传奇' },
  { key: 'rv-immortal', name: '神代存在' },
];
const LIMING_GEN_KEY = { 凡人: 'rv-mortal', 超凡者: 'rv-foundation', 大法师: 'rv-zifu', 传奇: 'rv-zhenren', 神代存在: 'rv-immortal' };

// —————————— 我加载了神秘学面板（纯兜底范式，build-shenmi.mjs 产出）——————————
// 七阶位阶（ch29 原文：新入者→从业者→小精通→大精通→达人→大师→隐席），隐席无在世者
const SHENMI_LADDER = [ // 低 → 高
  { key: 'rv-mortal', name: '凡人（门外）' },
  { key: 'rv-sm1', name: '新入者' },
  { key: 'rv-sm2', name: '从业者' },
  { key: 'rv-sm3', name: '小精通' },
  { key: 'rv-sm4', name: '大精通' },
  { key: 'rv-sm5', name: '达人' },
  { key: 'rv-sm6', name: '大师' },
  { key: 'rv-sm7', name: '隐席' },
];
const SHENMI_GEN_KEY = { 新入者: 'rv-sm1', 从业者: 'rv-sm2', 小精通: 'rv-sm3', 大精通: 'rv-sm4', 达人: 'rv-sm5', 大师: 'rv-sm6', 隐席: 'rv-sm7' };

function cutGeneric(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const m = [...cut.matchAll(/[。！？]/g)];
  return m.length && m[m.length - 1].index > 30 ? cut.slice(0, m[m.length - 1].index + 1) : cut + '…';
}
function parseSeqs(desc) {
  if (!desc) return null;
  const parts = String(desc).split('→').map(x => x.trim()).filter(Boolean);
  if (parts.length < 4) return null;
  return parts.map(p => {
    const m = p.match(/^序列s*(d+)s*(.*)$/);
    return m ? { n: m[1], name: m[2] || '' } : { n: '', name: p };
  });
}

const WIKI_BOOKS = {
  guimizhizhu: {
    theme: 'guimi',
    ladder: { title: '序列阶梯', sub: '由低到高 · 数字为已收录人数 · 点击人名查看档案' },
    passthroughLadder: true, // 阶梯人数沿用 build-guimi 产出的 5 段序列带
    codex: { title: '途径图鉴', sub: '非凡途径 · 序列 9 → 0 完整阶梯', from: 'xianji' },
  },
  fanrenxiuxianzhuan: {
    theme: 'fanren',
    ladder: { title: '境界阶梯', sub: '由低到高 · 数字为已收录人数 · 点击人名查看档案' },
    realms: FANREN_LADDER,
    genKey: g => FANREN_GEN_KEY[g],
    codex: { title: '功法图鉴', sub: 'fanren-wiki 收录的功法法术', from: 'file', file: 'fanren/gongfa.json', limit: 40 },
  },
  doupocangqiong: {
    theme: 'doupo',
    ladder: { title: '斗气阶梯', sub: '由低到高 · 数字为已收录人数 · 点击人名查看档案' },
    realms: DOUPO_LADDER,
    genKey: g => DOUPO_GEN_KEY[g],
    codex: { title: '异火图鉴', sub: '异火榜名录 · 按榜上排名排序', from: 'file', file: 'doupo/yihuo.json', limit: 24 },
  },
  dafengdagengren: {
    theme: 'dafeng',
    ladder: { title: '品第阶梯', sub: '诸体系通用品级 · 由低到高 · 点击人名查看档案' },
    realms: DAFENG_LADDER,
    genKey: g => DAFENG_GEN_KEY[g],
    codex: { title: '法器图鉴', sub: '词条可锚定的法器与神通', from: 'file', file: 'dafeng/fqi.json', limit: 16 },
  },
  limingzhijian: {
    theme: 'liming',
    ladder: { title: '位阶阶梯', sub: '由低到高 · 数字为已收录人数 · 点击人名查看档案' },
    realms: LIMING_LADDER,
    genKey: g => LIMING_GEN_KEY[g],
    codex: { title: '魔能图鉴', sub: '刚铎遗产与塞西尔魔能技术', from: 'file', file: 'liming/mnjs.json', limit: 16 },
  },
  wojiazaileshenmixuemianban: {
    theme: 'shenmi',
    ladder: { title: '位阶阶梯', sub: '帷幕后世界七阶 · 由低到高 · 点击人名查看档案' },
    realms: SHENMI_LADDER,
    genKey: g => SHENMI_GEN_KEY[g],
    codex: { title: '神秘学图鉴', sub: '帷幕后世界的概念与术式', from: 'file', file: 'shenmi/concepts.json', limit: 16 },
  },
};

function buildWikiBook(cfg, data) {
  let realms;
  if (cfg.passthroughLadder) {
    realms = prevRealms(data.systemPage).map(r => ({ ...r }));
  } else {
    realms = cfg.realms.map(l => ({ ...l, count: 0, reps: [], _pool: [] }));
    const byKey = new Map(realms.map(r => [r.key, r]));
    for (const c of data.characters) {
      const r = byKey.get(cfg.genKey ? cfg.genKey(c.generation) : null);
      if (r) { r.count++; r._pool.push(c); }
    }
    const top = pool => pool.sort((a, b) => (b.mentions || 0) - (a.mentions || 0)).slice(0, 4).map(c => c.name);
    for (const r of realms) { r.reps = top(r._pool); delete r._pool; }
  }
  let entries = [];
  if (cfg.codex.from === 'file' && cfg.codex.file) {
    const f = path.join(__dirname, cfg.codex.file);
    if (fs.existsSync(f)) {
      entries = JSON.parse(fs.readFileSync(f, 'utf8')).slice(0, cfg.codex.limit || 40)
        .map(a => ({ name: a.n, desc: cutGeneric(a.s || a.t || '', 150), member: a.m || '' }));
    }
  } else if (cfg.codex.from === 'xianji') {
    entries = prevCodex(data.systemPage).map(x => ({ ...x, seqs: parseSeqs(x.desc) }));
  }
  return {
    version: 2,
    theme: cfg.theme,
    ladder: { title: cfg.ladder.title, sub: cfg.ladder.sub, realms },
    extraLadders: [],
    codex: { title: cfg.codex.title, sub: cfg.codex.sub, entries },
  };
}

// —————————— 装配 ——————————
// 书目元数据注册表：加一本新书（wiki 型）= WIKI_BOOKS 加配置 + 这里加一行元数据，前端零改动
const BOOK_META = {
  xuanjianxianzu: { sigil: '鉴', familyLabel: '世家' },
  guimizhizhu: { sigil: '秘', familyLabel: '途径' },
  fanrenxiuxianzhuan: { sigil: '凡', familyLabel: '境界' },
  doupocangqiong: { sigil: '斗', familyLabel: '境界' },
  dafengdagengren: { sigil: '奉', familyLabel: '品第' },
  limingzhijian: { sigil: '黎', familyLabel: '位阶' },
  wojiazaileshenmixuemianban: { sigil: '神', familyLabel: '位阶' },
};
const BUILDERS = {
  xuanjianxianzu: buildXuanjian,
  ...Object.fromEntries(Object.entries(WIKI_BOOKS).map(([id, cfg]) => [id, data => buildWikiBook(cfg, data)])),
};

const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BUILDERS);
for (const bookId of targets) {
  const build = BUILDERS[bookId];
  if (!build) { console.error('未知书目或无体系页配置:', bookId); process.exitCode = 1; continue; }
  const FILE = path.join(DATA_DIR, bookId + '.json');
  if (!fs.existsSync(FILE)) { console.log(`[${bookId}] 数据文件尚未生成，跳过`); continue; }
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  data.systemPage = build(data);
  data.theme = data.systemPage.theme; // 书目级主题（前端 body.theme-* / 书架卡片），切书零组件改动
  Object.assign(data, BOOK_META[bookId] || {}); // sigil / familyLabel（前端印章字与纵表 Tab 文案）
  fs.writeFileSync(FILE, JSON.stringify(data));
  console.log(`\n[${bookId}] systemPage v2 已写入`);
  console.log(`  主阶梯: ${data.systemPage.ladder.realms.map(r => `${r.name}${r.count}`).join(' → ')}`);
  for (const xl of data.systemPage.extraLadders) {
    console.log(`  ${xl.title}: ${xl.stages.map(s => `${s.name}${s.count}`).join(' → ')}（共 ${xl.stages.reduce((n, s) => n + s.count, 0)} 人）`);
  }
  console.log(`  图鉴: ${data.systemPage.codex.entries.length} 条（${data.systemPage.codex.title}）`);
}
