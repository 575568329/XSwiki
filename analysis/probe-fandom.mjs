// Fandom 全站搜索探测：候选小说在 Fandom 是否有 wiki 及词条规模
// https://api.fandom.com/wiki/v1/search?expand=1&q=<书名> → items[{id,title,url,latestRevision}...]
import fs from 'node:fs';

const NAMES = [
  '夜无疆', '剑烛大荒', '请勿高考时渡劫', '没钱修什么仙', '让仙门再次伟大',
  '异度旅社', '黎明之剑', '神秘复苏', '灵境行者', '斗破苍穹', '遮天', '圣墟',
  '完美世界', '大奉打更人', '赘婿', '神话版三国', '深空彼岸', '有仙则名',
  '家父汉武帝', '捞尸人', '凡人修仙传', '诡秘之主', '玄鉴仙族', '夜无疆',
];
const UA = 'novel-wiki-collector/1.0';
const seen = new Set();
const out = [];
for (const name of NAMES) {
  if (seen.has(name)) continue;
  seen.add(name);
  try {
    const url = 'https://api.fandom.com/wiki/v1/search?expand=1&lang=zh&q=' + encodeURIComponent(name);
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const j = await res.json();
    const items = (j.items || []).slice(0, 3).map(x => ({ title: x.title, url: x.url }));
    // 命中判断：标题或 URL 含书名
    const hit = items.find(x => (x.title || '').includes(name) || (x.url || '').toLowerCase().includes(encodeURIComponent(name).toLowerCase()) || decodeURIComponent(x.url || '').includes(name));
    out.push({ name, fandom: !!hit, top: items });
    console.log(`${hit ? '✓' : '-'} ${name}: ${items.map(x => x.title).join(' | ').slice(0, 90) || '无结果'}`);
  } catch (e) { console.log('-', name, 'ERR', String(e).slice(0, 60)); out.push({ name, fandom: false, top: [] }); }
}
fs.writeFileSync('D:/cursorObject/小说Wiki/analysis/collection-fandom.json', JSON.stringify(out, null, 1), 'utf8');
console.log('\nFandom 有 wiki:', out.filter(o => o.fandom).length, '/', out.length);
