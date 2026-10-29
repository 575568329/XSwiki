// 人名普查：姓氏 n-gram 挖掘 + 显式命名标记提取 + 全量统计
// 输出: raw/name-stats.json  [{name, total, chapters:[...first..last], chapterCount, source}]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapters = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw', 'chapters.json'), 'utf8'));

// 常见姓氏（含本书重点：李/陆）
const SURNAMES = '李陆王张陈刘杨赵黄周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金郝孔白崔康毛秦顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文严陶施洪翟安颜倪牛温芦季俞章鲁葛伍韦申尤毕聂丛焦向柳邢路岳齐沿梅莫庄辛管祝左涂谷祁时舒耿牟卜詹关苗凌费纪靳盛童欧甄项曲成游阳裴席卫查屈鲍位覃霍翁隋植甘景蒲包计伏暨相帅饶';
const SUR = new Set([...SURNAMES]);

// ---------- Pass 1: 姓氏开头的 n-gram 计数 ----------
const grams = new Map(); // gram -> {total, chSet:Set}
const addG = (g, chIdx) => {
  let e = grams.get(g);
  if (!e) { e = { total: 0, ch: new Set() }; grams.set(g, e); }
  e.total++; e.ch.add(chIdx);
};
for (const c of chapters) {
  const t = c.text;
  for (let i = 0; i < t.length; i++) {
    if (!SUR.has(t[i])) continue;
    for (let n = 2; n <= 4 && i + n <= t.length; n++) {
      addG(t.slice(i, i + n), c.no);
    }
  }
}

// ---------- Pass 2: 名字判定（自长向短消解） ----------
// 3字名 ABC 合法: count(ABC)>=12 且 count(ABC)/count(AB)>=0.5
// 2字名 AB 合法: standalone(AB) = count(AB) - Σ count(以AB开头的3字名) >= 12
const names3 = [];
for (const [g, e] of grams) {
  if (g.length !== 3) continue;
  const ab = g.slice(0, 2);
  const abe = grams.get(ab);
  if (!abe) continue;
  if (e.total >= 12 && e.total / abe.total >= 0.5) names3.push(g);
}
const names3Set = new Set(names3);
const extOf = new Map(); // 2gram -> sum of 3name counts
for (const g3 of names3) {
  const p = g3.slice(0, 2);
  extOf.set(p, (extOf.get(p) || 0) + grams.get(g3).total);
}
const names2 = [];
for (const [g, e] of grams) {
  if (g.length !== 2) continue;
  const standalone = e.total - (extOf.get(g) || 0);
  if (standalone >= 15) names2.push(g);
}

// ---------- Pass 3: 显式命名标记（道号/法号/名为/唤作/自称 等） ----------
const MARK = /[名号称唤]为?(?:「|『|“)?([\u4e00-\u9fa5]{2,4})(?:」|』|”)?/g;
const marked = new Map();
for (const c of chapters) {
  let m; MARK.lastIndex = 0;
  while ((m = MARK.exec(c.text))) {
    const w = m[1];
    if (!marked.has(w)) marked.set(w, 0);
    marked.set(w, marked.get(w) + 1);
  }
}

// ---------- Pass 4: 全文精确定位（对候选名做章节分布） ----------
// 候选 = names2 + names3 + marked(高频) ；最终输出统一统计
const candidates = new Set([...names2, ...names3]);
for (const [w, n] of marked) if (n >= 5 && w.length >= 2) candidates.add(w);

const result = [];
for (const name of candidates) {
  const dist = [];
  let total = 0;
  for (const c of chapters) {
    let idx = 0, cnt = 0;
    while ((idx = c.text.indexOf(name, idx)) !== -1) { cnt++; idx += name.length; }
    if (cnt) { total += cnt; dist.push(c.no); }
  }
  if (total < 10 || dist.length < 3) continue; // 全文阈值
  result.push({
    name, total,
    chapterCount: dist.length,
    first: dist[0], last: dist[dist.length - 1],
    chapters: dist.length > 60 ? null : dist, // 长列表省略
    kind: names3Set.has(name) ? 'surname3' : (names2.includes(name) ? 'surname2' : 'marked'),
  });
}
result.sort((a, b) => b.total - a.total);
fs.writeFileSync(path.join(__dirname, 'raw', 'name-stats.json'), JSON.stringify(result, null, 0));
console.log(`候选总数: ${result.length}  (3字姓名:${names3.length} 2字姓名:${names2.length} 标记名:${marked.size})`);
console.log('Top 60:');
for (const r of result.slice(0, 60)) console.log(`  ${r.name}  总频:${r.total}  章数:${r.chapterCount}  首现:第${r.first}章  ${r.kind}`);
