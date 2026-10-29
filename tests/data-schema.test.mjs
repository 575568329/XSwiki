// 数据资产质量测试：两本书目 JSON 的 schema 完整性 + 内容质量 + 回归守护
// 回归背景：W5 后 build-data 重跑曾覆盖丢失 factionEntities / cards-v2 字段 —— 数字守护防再发
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = f => JSON.parse(fs.readFileSync(`${ROOT}/plugin/data/${f}`, 'utf8'));
const xj = load('xuanjianxianzu.json');
const gm = load('guimizhizhu.json');
const fr = load('fanrenxiuxianzhuan.json');
const SPOILER_RE = /(陨落|身死|战死|被杀|所杀|殒命|死亡|死了|坐化|兵解|败亡|同归于尽|自尽|身亡|刺杀|牺牲)/;

function assertCommonSchema(d, label) {
  test(`[${label}] 书级字段完整`, () => {
    for (const k of ['id', 'title', 'author', 'updatedAt', 'chapterCount', 'summary', 'factions', 'generations', 'stats', 'factionEntities', 'systemPage', 'characters'])
      assert.ok(d[k] !== undefined && d[k] !== null, `缺字段 ${k}`);
    assert.ok(Array.isArray(d.characters) && d.characters.length > 100, '人物数异常');
    assert.match(String(d.updatedAt), /^\d{4}-\d{2}-\d{2}$/, 'updatedAt 应为 YYYY-MM-DD');
    assert.ok(d.summary.length >= 30, 'summary 过短');
  });

  test(`[${label}] 人物卡基础字段与 id 唯一`, () => {
    const ids = new Set();
    for (const c of d.characters) {
      assert.ok(c.id, 'id 缺失: ' + c.name);
      assert.ok(!ids.has(c.id), 'id 重复: ' + c.id);
      ids.add(c.id);
      for (const k of ['name', 'tier', 'aliases', 'mentions', 'pinyin', 'oneLinerSafe'])
        assert.ok(c[k] !== undefined, `字段 ${k} 缺失: ${c.name}`);
      assert.ok([1, 2, 3].includes(c.tier), 'tier 非法: ' + c.name);
      assert.ok(c.seal && c.seal.includes('<svg') && c.seal.includes('</svg>'), '印章 SVG 非法: ' + c.name);
      assert.match(c.pinyin, /^[a-z0-9]+(,[a-z0-9]+)*$/, '拼音应为小写字母逗号列表: ' + c.name);
      assert.ok(Array.isArray(c.relationships) && Array.isArray(c.evidence) && Array.isArray(c.timeline), '数组字段类型: ' + c.name);
      // 上限 30：主角级人物道号/尊称可合法堆积（陆江仙 25 个：玄鉴/盈昃/安淮天/帝宣玄神元君…）
      assert.ok(c.aliases.length <= 30, '别名超上限: ' + c.name);
    }
  });

  test(`[${label}] generation ⊆ 书目 generations（筛选不落空）`, () => {
    const gs = new Set(d.generations);
    for (const c of d.characters)
      if (c.generation) assert.ok(gs.has(c.generation), `${c.name} 的 generation "${c.generation}" 不在书目列表`);
  });

  test(`[${label}] tier1 关系 id 全部可回跳`, () => {
    const byId = new Map(d.characters.map(c => [c.id, c]));
    for (const c of d.characters.filter(x => x.tier === 1))
      for (const r of c.relationships) {
        assert.ok(r.name && r.relation, '关系字段缺失: ' + c.name);
        if (r.id) assert.ok(byId.has(r.id), `悬空关系 id: ${c.name} -> ${r.name} (${r.id})`);
      }
  });

  test(`[${label}] oneLiner 卫生：无换行/无 markdown 残留/长度受控`, () => {
    for (const c of d.characters) {
      assert.ok(!/[\r\n]/.test(c.oneLiner || ''), 'oneLiner 含换行: ' + c.name);
      assert.ok(!/^-|^\*|^#/.test(c.oneLiner || ''), 'oneLiner 以 markdown 符号开头: ' + c.name);
      assert.ok((c.oneLiner || '').length <= 130, 'oneLiner 超长: ' + c.name);
    }
  });

  test(`[${label}] 防剧透：oneLinerSafe 不含死亡类词`, () => {
    for (const c of d.characters) {
      assert.ok(!SPOILER_RE.test(c.oneLinerSafe || ''), 'oneLinerSafe 泄剧透: ' + c.name + ' -> ' + c.oneLinerSafe);
    }
  });

  test(`[${label}] systemPage v2 结构（ladder/extraLadders/codex）`, () => {
    const sp = d.systemPage;
    assert.equal(sp.version, 2, 'systemPage 应为 v2（漏跑 analysis/gen-system.mjs）');
    assert.ok(sp.theme, '缺每书主题类');
    assert.ok(Array.isArray(sp.ladder.realms) && sp.ladder.realms.length >= 5, '主阶梯层数不足');
    // 统一低→高存储：首层人数 ≤ 末层无硬约束，但仙人/真神等顶层必有 count 字段
    for (const r of sp.ladder.realms) {
      assert.ok(r.key && r.name, 'realm 字段缺失');
      assert.ok(Array.isArray(r.reps), 'realm.reps 应为数组');
    }
    assert.ok(Array.isArray(sp.extraLadders), 'extraLadders 应为数组');
    for (const xl of sp.extraLadders) {
      assert.ok(Array.isArray(xl.stages) && xl.stages.length >= 2, '独立体系阶数不足');
      for (const s of xl.stages) assert.ok(s.key && s.name && Array.isArray(s.reps), '独立体系阶字段缺失');
    }
    assert.ok(Array.isArray(sp.codex.entries) && sp.codex.entries.length >= 10, '图鉴条目不足');
    for (const x of sp.codex.entries) {
      assert.ok(x.name && x.desc, 'codex 字段缺失');
      if (x.member) assert.ok(d.characters.some(c => c.name === x.member), '图鉴代表人物不在库: ' + x.member);
    }
  });

  test(`[${label}] 势力实体卡结构`, () => {
    assert.ok(Array.isArray(d.factionEntities) && d.factionEntities.length >= 10, '势力卡不足');
    for (const f of d.factionEntities) {
      assert.ok(f.name && f.stance && f.one, '势力卡字段缺失: ' + JSON.stringify(f).slice(0, 60));
      assert.ok(['protagonist', 'ally', 'neutral', 'foe'].includes(f.stance), 'stance 非法: ' + f.name);
    }
  });
}

assertCommonSchema(xj, '玄鉴仙族');
assertCommonSchema(gm, '诡秘之主');
assertCommonSchema(fr, '凡人修仙传');

// ---- 玄鉴专属守护 ----
test('[玄鉴] 回归守护：792 人 / 13 势力卡 / 24 张 v2 卡字段', () => {
  assert.equal(xj.characters.length, 792);
  assert.equal(xj.factionEntities.length, 13, '势力实体卡丢失（build-data 后漏跑 merge-v2）');
  const t1 = xj.characters.filter(c => c.tier === 1);
  assert.equal(t1.length, 24);
  assert.ok(t1.every(c => typeof c.toProtagonist === 'string' && c.toProtagonist.length > 0), 't1 卡 toProtagonist 丢失（cards-v2 未合入）');
  assert.ok(t1.every(c => Array.isArray(c.stages)), 't1 卡 stages 丢失');
});

test('[玄鉴] 字辈世代齐全', () => {
  assert.equal(xj.generations.length, 22);
  const gs = new Set(xj.generations);
  for (const z of ['木', '曦', '周', '绛', '阙']) assert.ok([...gs].some(g => g.includes(z + '字辈')), '缺字辈: ' + z);
});

// ---- 诡秘专属守护 ----
test('[诡秘] 回归守护：310 人 / tier 28-65-217 / 22 途径', () => {
  assert.equal(gm.characters.length, 310);
  assert.deepEqual(gm.stats.tiers, { 1: 28, 2: 65, 3: 217 });
  assert.equal(gm.generations.length, 22);
  assert.equal(gm.systemPage.codex.entries.length, 22);
  assert.equal(gm.systemPage.ladder.realms.length, 5);
  assert.equal(gm.systemPage.ladder.realms.at(-1).count, 9, '真神级人数应为 9（七神+克莱恩+罗塞尔）');
  // 途径图鉴序列链在生成侧预解析（玄鉴无序列链为 null）
  assert.ok(gm.systemPage.codex.entries[0].seqs && gm.systemPage.codex.entries[0].seqs.length >= 8, '途径序列链未预解析');
});

test('[诡秘] 序列徽章卫生：cultivation 匹配途径序列表', () => {
  const formal2seqs = {};
  for (const x of gm.systemPage.codex.entries) {
    const m = x.desc.split('→').map(s => s.trim());
    formal2seqs[x.name] = m;
  }
  for (const c of gm.characters) {
    if (!c.cultivation) continue;
    const m = c.cultivation.match(/^序列(\d) (.+)$/);
    assert.ok(m, 'cultivation 格式异常: ' + c.name + ' ' + c.cultivation);
    // 神祇本尊特例：序列0 神名 = 途径正式名去“途径”后缀（欧弥贝拉=大地母神，wiki 表里该位叫“母亲”）
    if (m[1] === '0' && c.generation && m[2] === c.generation.replace(/途径$/, '')) continue;
    const seqs = formal2seqs[c.generation] || [];
    assert.ok(seqs.some(s => s.startsWith(`序列${m[1]} `) && s.includes(m[2])), `序列名不在途径表中: ${c.name} [${c.generation}] ${c.cultivation}`);
  }
});

test('[诡秘] 塔罗会代号可搜（别名含代号）', () => {
  for (const [name, code] of [['克莱恩·莫雷蒂', '愚者'], ['奥黛丽·霍尔', '正义'], ['阿尔杰·威尔逊', '倒吊人'], ['休·迪尔查', '审判'], ['安德森·胡德', '世界']]) {
    const c = gm.characters.find(x => x.name === name);
    assert.ok(c, '缺人物: ' + name);
    assert.ok(c.aliases.includes(code), `${name} 缺代号别名 "${code}"`);
  }
});

test('[凡人] 回归守护：233 人 / 三界阶梯 / 韩立在库', () => {
  assert.equal(fr.characters.length, 233);
  assert.equal(fr.generations.length, 10);
  assert.equal(fr.theme, 'fanren');
  assert.ok(fr.characters.some(c => c.name === '韩立' && c.tier === 1));
  assert.ok(fr.systemPage.codex.entries.length >= 30, '功法图鉴不足');
  assert.ok(fr.systemPage.ladder.realms.at(-1).count >= 40, '真仙档人数异常');
});

// ---- 数据文件与索引/清单一致 ----
test('index.json 与 plugin/data 目录一致', () => {
  const idx = JSON.parse(fs.readFileSync(`${ROOT}/plugin/data/index.json`, 'utf8'));
  const files = fs.readdirSync(`${ROOT}/plugin/data`).filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'images.json' && f !== 'prompts.json' && f !== 'archives.json').map(f => 'data/' + f);
  assert.deepEqual(idx.sort(), files.sort());
});

test('server/data manifest 的 sha256/size 与实际文件一致（热更新包完整性）', () => {
  const m = JSON.parse(fs.readFileSync(`${ROOT}/server/data/manifest.json`, 'utf8'));
  const bookFiles = fs.readdirSync(`${ROOT}/plugin/data`).filter(f => f.endsWith('.json') && !['index.json', 'images.json', 'prompts.json', 'archives.json', 'manifest.json'].includes(f));
  assert.ok(m.version > 0 && Array.isArray(m.books) && m.books.length === bookFiles.length, 'manifest 书目数应与 data 目录一致');
  for (const b of m.books) {
    const buf = fs.readFileSync(`${ROOT}/server/data/${b.file}`);
    assert.equal(b.size, buf.length, 'size 不符: ' + b.file);
    assert.equal(b.sha256, createHash('sha256').update(buf).digest('hex'), 'sha256 不符: ' + b.file);
    assert.ok(b.version, '缺版本: ' + b.file);
  }
});
