// 数据完整性断言（诡秘之主书目 JSON）
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('D:/cursorObject/小说Wiki/plugin/data/guimizhizhu.json', 'utf8'));
let bad = 0;
const assert = (cond, msg) => { if (!cond) { console.log('× ' + msg); bad++; } };

assert(d.id === 'guimizhizhu', 'id');
assert(d.title === '诡秘之主' && d.author === '爱潜水的乌贼', '书名作者');
assert(d.characters.length === 310, '人物数 ' + d.characters.length);
const ids = new Set();
for (const c of d.characters) {
  assert(c.id && !ids.has(c.id), 'id 重复/缺失: ' + c.id);
  ids.add(c.id);
  assert(c.name && c.tier && c.seal && c.seal.includes('<svg'), '基础字段缺: ' + c.name);
  assert(Array.isArray(c.aliases) && Array.isArray(c.relationships), '数组字段: ' + c.name);
  if (c.generation) assert(d.generations.includes(c.generation), 'generation 不在书目列表: ' + c.name + ' ' + c.generation);
  for (const r of c.relationships) if (r.id) assert(ids.has(r.id) || d.characters.some(x => x.id === r.id), '关系悬空: ' + c.name + '->' + r.name);
}
// 关系 id 回填率（tier1）
const t1 = d.characters.filter(c => c.tier === 1);
const relTotal = t1.reduce((s, c) => s + c.relationships.length, 0);
const relFilled = t1.reduce((s, c) => s + c.relationships.filter(r => r.id).length, 0);
console.log(`tier1 关系回填: ${relFilled}/${relTotal}`);
// 拼音搜索
const k = d.characters.find(c => c.name === '克莱恩·莫雷蒂');
console.log('克莱恩 pinyin:', k.pinyin);
// 体系页
assert(d.systemPage.realms.length === 5, 'realms 5级');
assert(d.systemPage.xianji.length === 22, 'xianji 22途径: ' + d.systemPage.xianji.length);
assert(d.factionEntities.length >= 15, '势力卡 ' + d.factionEntities.length);
// 体积
const size = fs.statSync('D:/cursorObject/小说Wiki/plugin/data/guimizhizhu.json').size;
console.log(`体积: ${(size / 1024).toFixed(0)}KB（玄鉴 1.4MB 量级之下，可接受）`);
// 双书目 index
const idx = JSON.parse(fs.readFileSync('D:/cursorObject/小说Wiki/plugin/data/index.json', 'utf8'));
console.log('index.json:', idx.join(', '));
console.log(bad ? `\n${bad} 个断言失败` : '\n✓ 全部断言通过');
