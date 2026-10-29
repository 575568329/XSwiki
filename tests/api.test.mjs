// services 桥接层测试：api.js 的浏览器降级实现（mock fetch，读真实数据文件）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const data = f => JSON.parse(fs.readFileSync(`${ROOT}/plugin/data/${f}`, 'utf8'));

// ---- mock fetch：按文件名回真实数据；images.json 返回 404（走无图分支）----
const realFetch = globalThis.fetch;
globalThis.fetch = async url => {
  const u = String(url);
  const hit = f => u.includes(f);
  const ok = json => ({ ok: true, json: async () => json });
  if (hit('index.json')) return ok(data('index.json'));
  if (hit('xuanjianxianzu')) return ok(data('xuanjianxianzu.json'));
  if (hit('guimizhizhu')) return ok(data('guimizhizhu.json'));
  if (hit('fanrenxiuxianzhuan')) return ok(data('fanrenxiuxianzhuan.json'));
  const m = u.match(/data\/([a-z]+)\.json/);
  if (m && fs.existsSync(`${ROOT}/plugin/data/${m[1]}.json`)) return ok(data(m[1] + '.json'));
  return { ok: false };
};

const { svc } = await import('../plugin-src/src/api.js');

// api.js 以 window.services 探测 uTools 环境；Node 测试无 window → 打空桩走浏览器降级分支
globalThis.window = globalThis;

test.before(async () => { await svc.init(); });

test('init 走浏览器降级分支，getBooks 返回全部书目', () => {
  const books = svc.get().getBooks();
  const idx = JSON.parse(fs.readFileSync(`${ROOT}/plugin/data/index.json`, 'utf8'));
  assert.equal(books.length, idx.length, '书目数应与 index.json 一致');
  const ids = books.map(b => b.id);
  for (const want of ['xuanjianxianzu', 'guimizhizhu', 'fanrenxiuxianzhuan', 'doupocangqiong', 'dafengdagengren', 'wojiazaileshenmixuemianban']) assert.ok(ids.includes(want), '缺书目 ' + want);
  const MIN_CHARS = { dafengdagengren: 120, doupocangqiong: 100, limingzhijian: 85, wojiazaileshenmixuemianban: 40 };
  for (const b of books) {
    assert.ok(b.title && b.author && b.stats.total >= (MIN_CHARS[b.id] || 100), b.id + ' 人物数异常: ' + b.stats.total);
    assert.ok(Array.isArray(b.generations) && Array.isArray(b.factions));
  }
  const dp = books.find(b => b.id === 'doupocangqiong');
  assert.equal(dp.sigil, '斗', '斗破印章字');
  const sm = books.find(b => b.id === 'wojiazaileshenmixuemianban');
  assert.equal(sm.sigil, '神', '神秘学面板印章字');
  assert.equal(sm.familyLabel, '位阶', '神秘学面板纵表 Tab 文案');
  const df = books.find(b => b.id === 'dafengdagengren');
  assert.equal(df.sigil, '奉', '大奉印章字');
  assert.equal(df.familyLabel, '品第', '大奉纵表 Tab 文案');
});

test('search：名/别名/拼音/速答句 分层计分 + mentions 加权排序', () => {
  // 精确名命中
  const r1 = svc.get().search('guimizhizhu', '克莱恩·莫雷蒂');
  assert.ok(r1.length >= 1 && r1[0].name === '克莱恩·莫雷蒂', '精确名应置顶');
  // 别名命中（代号）
  const r2 = svc.get().search('guimizhizhu', '愚者');
  assert.ok(r2.some(c => c.name === '克莱恩·莫雷蒂'), '别名“愚者”应命中克莱恩');
  // 拼音命中
  const r3 = svc.get().search('guimizhizhu', 'kelaien');
  assert.ok(r3.some(c => c.name === '克莱恩·莫雷蒂'), '拼音应命中克莱恩');
  // 速答句关键词
  const r4 = svc.get().search('guimizhizhu', '穿越者周明瑞');
  assert.ok(r4.length >= 1, '速答句关键词应命中');
  // 空关键词返回前 50
  const r5 = svc.get().search('xuanjianxianzu', '');
  assert.ok(r5.length === 50, '空关键词默认 50 条');
});

test('search：玄鉴拼音与别名（weiwang→李周巍）', () => {
  const r = svc.get().search('xuanjianxianzu', 'weiwang');
  assert.ok(r.some(c => c.name === '李周巍'), '拼音 weiwang 应命中李周巍');
});

test('getCharacter：档案字段 + referrers 回链', () => {
  const c = svc.get().getCharacter('guimizhizhu', 'kelaienmoleidi');
  assert.ok(c, '克莱恩档案应存在');
  assert.equal(c.name, '克莱恩·莫雷蒂');
  assert.ok(c.persona, 'persona 应透出');
  assert.ok(Array.isArray(c.relationships) && c.relationships.length >= 10);
  // referrers：其他人物的关系指向克莱恩（班森的哥哥、奥黛丽的信仰对象等）
  assert.ok(Array.isArray(c.referrers) && c.referrers.some(r => r.fromName === '班森·莫雷蒂'), 'referrers 应含班森');
  assert.ok(c.portrait, '克莱恩 2026-10-28 人工验收收货后应有立绘');
  const z = svc.get().getCharacter('guimizhizhu', 'zhengqiyujixiezhishen');
  assert.equal(z.portrait, null, '无人形可画的蒸汽神 portrait 为 null');
});

test('getMeta：势力实体 + 体系页按书透出', () => {
  const g = svc.get().getMeta('guimizhizhu');
  assert.ok(g.factions.length >= 15 && g.factions[0].name);
  assert.equal(g.systemPage.version, 2);
  assert.equal(g.systemPage.ladder.realms.length, 5);
  const x = svc.get().getMeta('xuanjianxianzu');
  assert.ok(x.factions.length === 13, '玄鉴势力卡 13（回归守护）');
  assert.equal(x.systemPage.theme, 'xianzu');
  assert.ok(x.systemPage.extraLadders.some(l => l.key === 'shixiu'), '玄鉴释修独立阶梯缺失');
});

test('allCharacters：全量透出供纵表', () => {
  assert.ok(svc.get().allCharacters('guimizhizhu').length >= 300);
  assert.ok(svc.get().allCharacters('fanrenxiuxianzhuan').length >= 200);
  assert.deepEqual(svc.get().allCharacters('no-such-book'), [], '未知书返回空数组不抛异常');
});

test('斗破苍穹：搜索/档案/斗气阶梯/异火图鉴', () => {
  const s = svc.get();
  const r = s.search('doupocangqiong', '萧炎');
  assert.ok(r.length >= 1 && r[0].name === '萧炎', '精确名应置顶');
  assert.ok(s.search('doupocangqiong', '美杜莎').some(c => c.name === '彩鳞'), '别名美杜莎应命中彩鳞');
  const c = s.getCharacter('doupocangqiong', 'xiaoyan');
  assert.ok(c && c.generation === '斗帝' && c.tier === 1, '萧炎档案：斗帝 tier1');
  assert.ok(c.relationships.length >= 5 && c.relationships.every(x => x.id), '萧炎关系网已回填 id');
  assert.ok(c.mentions > 30000 && c.firstChapter === 1 && c.lastChapter > 1000, '萧炎原文统计口径（兜底核对后）');
  assert.ok(s.getCharacter('doupocangqiong', 'tianhuozunzhe'), '兜底提取角色（天火尊者）在库');
  assert.ok(s.search('doupocangqiong', '海老').some(x => x.name === '海波东'), '尊称别名应命中海波东');
  const deep = s.getCharacter('doupocangqiong', 'xiaoyan');
  assert.ok((deep.stages || []).length >= 4, '萧炎发展脉络阶段');
  assert.ok((deep.timeline || []).length >= 6, '萧炎剧情线');
  assert.ok(deep.persona && deep.persona.appearance, '萧炎人物侧写');
  assert.ok((deep.evidence || []).length >= 2, '萧炎原文摘录');
  assert.ok((deep.relationships || []).length >= 8 && deep.relationships.every(x => x.id), '萧炎关系网扩充并回填');
  const sp = s.getMeta('doupocangqiong').systemPage;
  assert.equal(sp.version, 2, 'systemPage v2');
  assert.equal(sp.theme, 'doupo');
  const grouped = sp.ladder.realms.reduce((n, r2) => n + r2.count, 0);
  assert.ok(grouped >= 25, '斗气阶梯应覆盖 25+ 人，实得 ' + grouped);
  assert.ok(sp.ladder.realms.some(r2 => r2.key === 'rv-doudi' && r2.count >= 5), '斗帝档应有数人');
  assert.equal(sp.codex.entries.length, 10, '异火图鉴 10 条');
  assert.ok(sp.codex.entries.every(e => e.name && e.desc), '异火条目名与描述齐全');
  assert.ok(s.allCharacters('doupocangqiong').length >= 28, '斗破全量人物');
});

test('大奉打更人：搜索/档案/品级阶梯/法器图鉴', () => {
  const s = svc.get();
  const r = s.search('dafengdagengren', '许七安');
  assert.ok(r.length >= 1 && r[0].name === '许七安', '精确名应置顶');
  assert.ok(s.search('dafengdagengren', '魏青衣').some(c => c.name === '魏渊'), '称号魏青衣应命中魏渊');
  const c = s.getCharacter('dafengdagengren', 'xuqian');
  assert.ok(c && c.tier === 1 && c.relationships.every(x => x.id), '许七安档案与关系 id 回填');
  assert.ok(c.mentions > 15000 && c.firstChapter === 1, '许七安原文统计口径');
  assert.ok(s.getCharacter('dafengdagengren', 'huaiqing'), '兜底提取角色（怀庆）在库');
  assert.ok(s.search('dafengdagengren', '许二郎').some(x => x.name === '许新年'), '别称许二郎应命中许新年');
  const dfDeep = s.getCharacter('dafengdagengren', 'xuqian');
  assert.ok((dfDeep.stages || []).length >= 4 && dfDeep.persona && (dfDeep.evidence || []).length >= 2, '许七安五区块深提取');
  const sp = s.getMeta('dafengdagengren').systemPage;
  assert.equal(sp.version, 2, 'systemPage v2');
  assert.equal(sp.theme, 'dafeng');
  const grouped = sp.ladder.realms.reduce((n, r2) => n + r2.count, 0);
  assert.ok(grouped >= 15, '品级阶梯应覆盖 15+ 人，实得 ' + grouped);
  assert.ok(sp.ladder.realms.some(r2 => r2.key === 'rv-p0' && r2.count >= 1), '超品档应有巫神');
  assert.equal(sp.codex.entries.length, 7, '法器图鉴 7 条');
  assert.ok(sp.codex.entries.some(e => e.name === '地书碎片'), '地书碎片在列');
});

test('黎明之剑：搜索/原文提及分层/魔能图鉴', () => {
  const s = svc.get();
  const r = s.search('limingzhijian', '高文');
  assert.ok(r.length >= 1 && r[0].name === '高文·塞西尔', '短名应命中全名');
  const c = s.getCharacter('limingzhijian', 'gaowensaixier');
  assert.ok(c && c.mentions > 10000 && c.chapterCount > 1000, '高文原文提及数应在万级');
  assert.ok(s.getCharacter('limingzhijian', 'beiertila'), '兜底提取角色（贝尔提拉）在库');
  assert.ok(s.search('limingzhijian', '卡珊德').some(x => x.name === '卡珊德拉'), '截断名前缀应命中卡珊德拉');
  const lmDeep = s.getCharacter('limingzhijian', 'gaowensaixier');
  assert.ok((lmDeep.stages || []).length >= 4 && (lmDeep.timeline || []).length >= 5 && lmDeep.persona, '高文五区块深提取');
  const sp = s.getMeta('limingzhijian').systemPage;
  assert.equal(sp.version, 2, 'systemPage v2');
  assert.equal(sp.theme, 'liming');
  assert.ok(sp.ladder.realms.some(r2 => r2.key === 'rv-zhenren' && r2.count >= 1), '传奇档应有高文');
  assert.equal(sp.codex.entries.length, 6, '魔能图鉴 6 条');
  assert.ok(sp.codex.entries.some(e => e.name === '深蓝之井'), '深蓝之井在列');
});

test('立绘提示词：白名单角色透出 promptText，无存档提示词为 null', () => {
  const s = svc.get();
  const c = s.getCharacter('xuanjianxianzu', 'lizhouwei');
  assert.ok(c && c.portrait, '李周巍应有立绘');
  assert.ok(typeof c.promptText === 'string' && c.promptText.length > 100, '李周巍应带最终过审提示词');
  assert.ok(c.promptText.includes('水墨'), '提示词应为水墨古风风格块开头');
  const q = s.getCharacter('xuanjianxianzu', 'liqinghong');
  assert.ok(q && q.portrait, '李清虹应有立绘');
  assert.equal(q.promptText, null, '李清虹无存档提示词应为 null');
  // 无提示词角色动态取证：任一不在 prompts.json 里的诡秘角色应为 null
  const prompts = JSON.parse(fs.readFileSync(`${ROOT}/plugin/data/prompts.json`, 'utf8'));
  const guimi = JSON.parse(fs.readFileSync(`${ROOT}/plugin/data/guimizhizhu.json`, 'utf8'));
  const noPrompt = guimi.characters.find(ch => !prompts[ch.id]);
  if (noPrompt) {
    const g = s.getCharacter('guimizhizhu', noPrompt.id);
    assert.equal(g.promptText, null, `无存档提示词角色 ${noPrompt.name} 应为 null`);
  }
});

test('立绘档案：着装档案透出，双数据源边界正确', () => {
  const s = svc.get();
  const lw = s.getCharacter('xuanjianxianzu', 'lizhouwei');
  assert.ok(typeof lw.archiveText === 'string' && lw.archiveText.includes('# 李周巍'), '李周巍着装档案应透出');
  const q = s.getCharacter('xuanjianxianzu', 'liqinghong');
  assert.ok(q.archiveText && q.archiveText.includes('# 李清虹'), '李清虹有档案无提示词：档案应透出、promptText 仍为 null');
  assert.equal(q.promptText, null, '李清虹无存档提示词应为 null');
  const g = s.getCharacter('guimizhizhu', 'kelaienmoleidi');
  assert.ok(typeof g.archiveText === 'string' && g.archiveText.includes('# 克莱恩'), '克莱恩着装档案应透出');
});


test('我加载了神秘学面板：搜索/位阶阶梯/概念图鉴', () => {
  const s = svc.get();
  const r = s.search('wojiazaileshenmixuemianban', '李察');
  assert.ok(r.length >= 1 && r[0].name === '李察', '主角应置顶');
  const c = s.getCharacter('wojiazaileshenmixuemianban', 'licha');
  assert.ok(c && c.tier === 1 && c.generation === '从业者', '李察：从业者 tier1');
  const sp = s.getMeta('wojiazaileshenmixuemianban').systemPage;
  assert.equal(sp.version, 2, 'systemPage v2');
  assert.equal(sp.theme, 'shenmi');
  assert.equal(sp.ladder.realms.length, 8, '位阶阶梯 8 档（含凡人）');
  const grouped = sp.ladder.realms.reduce((n, r2) => n + r2.count, 0);
  assert.ok(grouped >= 8, '位阶入组 ≥8 人，实得 ' + grouped);
  assert.equal(sp.codex.entries.length, 8, '神秘学图鉴 8 条');
  assert.ok(sp.codex.entries.some(e => e.name === '灵视'), '灵视在列');
});

test.after(() => { globalThis.fetch = realFetch; });
