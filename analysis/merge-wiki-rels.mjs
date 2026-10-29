// 吸收 xianzu-wiki 的结构化关系边（186条, type: parent/spouse/master/sibling）
// 策略: 两端人物都在我库的边 → 合并进对应人物的 relationships（去重：同名同向跳过）
// 同时给关系打 relationType（设计文档 P3 的 schema）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wiki = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'reference-xianzu-wiki', 'frontend', 'public', 'data.json'), 'utf8'));
const FILE = path.join(__dirname, '..', 'plugin', 'data', 'xuanjianxianzu.json');
const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// 名字索引（正名+别名 → 人物）
const idx = new Map();
for (const c of d.characters) {
  if (!idx.has(c.name)) idx.set(c.name, c);
  for (const a of c.aliases || []) if (!idx.has(a)) idx.set(a, c);
}

const TYPE_CN = { parent: '父/母', spouse: '道侣/配偶', master: '师徒', sibling: '兄弟姐妹' };
let added = 0, skipped = 0, edges = [];
for (const r of wiki.relationships) {
  const from = wiki.characters.find(c => c.id === r.from_id);
  const to = wiki.characters.find(c => c.id === r.to_id);
  if (!from || !to) continue;
  const f = idx.get(from.name), t = idx.get(to.name);
  if (!f || !t || f.id === t.id) continue;

  // 边的方向语义 → 以 from 视角写一条关系
  let relation, target = t;
  if (r.type === 'parent') {
    // from 的 parent 是 to → 写在 from 卡上：target 是 to
    relation = (r.parent_role === 'father' ? '父亲' : r.parent_role === 'mother' ? '母亲' : '父/母') + (r.note ? `（${r.note}）` : '') + '【wiki】';
  } else if (r.type === 'spouse') {
    relation = '道侣/配偶【wiki】';
  } else if (r.type === 'master') {
    // 语义: from 的 master 是 to
    relation = '师父【wiki】';
  } else if (r.type === 'sibling') {
    relation = '兄弟姐妹【wiki】';
  } else continue;

  // 去重: from 卡已有指向同 target 名的关系
  const dup = (f.relationships || []).some(x => x.name === target.name);
  if (dup) { skipped++; continue; }
  f.relationships = [...(f.relationships || []), { name: target.name, relation, id: target.id, relationType: r.type }];
  added++;
  edges.push(`${f.name} →${r.type}→ ${t.name}`);
}

// relationType 回填: 既有关系按关键词分类（父子/夫妻/师徒/敌对）
const KW = [
  ['sibling', /(兄|弟|姐|妹|堂兄|堂弟|族兄|族弟)/],
  ['parent', /(父|母|大父|祖父|外祖)/],
  ['spouse', /(妻|夫|道侣|双修|妾)/],
  ['master', /(师|徒|弟子)/],
  ['foe', /(敌|仇|对手|斩杀|杀死)/],
];
for (const c of d.characters) {
  for (const r of c.relationships || []) {
    if (r.relationType) continue;
    for (const [t, re] of KW) if (re.test(r.relation)) { r.relationType = t; break; }
    if (!r.relationType) r.relationType = 'ally';
  }
}

fs.writeFileSync(FILE, JSON.stringify(d));
console.log(`wiki 关系吸收: 新增 ${added} 条（跳过重复 ${skipped}）`);
console.log('样例:', edges.slice(0, 10).join(' | '));
console.log('全库关系 relationType 已回填');
