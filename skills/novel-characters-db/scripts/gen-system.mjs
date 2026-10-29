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

// —————————— 诡秘之主 ——————————
// 主阶梯（低→高）沿用 build-guimi 的 5 段序列带；途径图鉴 desc 的序列链在此预解析，
// 前端不再自带按书 hack。
function parseSeqs(desc) {
  if (!desc) return null;
  const parts = String(desc).split('→').map(s => s.trim()).filter(Boolean);
  if (parts.length < 4) return null;
  return parts.map(p => {
    const m = p.match(/^序列\s*(\d+)\s*(.*)$/);
    return m ? { n: m[1], name: m[2] || '' } : { n: '', name: p };
  });
}

function buildGuimi(data) {
  const prev = data.systemPage || {};
  return {
    version: 2,
    theme: 'guimi',
    ladder: {
      title: '序列阶梯',
      sub: '由低到高 · 数字为已收录人数 · 点击人名查看档案',
      realms: prev.realms || [],
    },
    extraLadders: [],
    codex: {
      title: '途径图鉴',
      sub: '非凡途径 · 序列 9 → 0 完整阶梯',
      entries: (prev.xianji || []).map(x => ({ ...x, seqs: parseSeqs(x.desc) })),
    },
  };
}

// —————————— 装配 ——————————
const BUILDERS = {
  xuanjianxianzu: buildXuanjian,
  guimizhizhu: buildGuimi,
};

const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BUILDERS);
for (const bookId of targets) {
  const build = BUILDERS[bookId];
  if (!build) { console.error('未知书目或无体系页配置:', bookId); process.exitCode = 1; continue; }
  const FILE = path.join(DATA_DIR, bookId + '.json');
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  data.systemPage = build(data);
  fs.writeFileSync(FILE, JSON.stringify(data));
  console.log(`\n[${bookId}] systemPage v2 已写入`);
  console.log(`  主阶梯: ${data.systemPage.ladder.realms.map(r => `${r.name}${r.count}`).join(' → ')}`);
  for (const xl of data.systemPage.extraLadders) {
    console.log(`  ${xl.title}: ${xl.stages.map(s => `${s.name}${s.count}`).join(' → ')}（共 ${xl.stages.reduce((n, s) => n + s.count, 0)} 人）`);
  }
  console.log(`  图鉴: ${data.systemPage.codex.entries.length} 条（${data.systemPage.codex.title}）`);
}
