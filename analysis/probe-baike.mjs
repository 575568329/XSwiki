// 候选书目的百度百科作品词条探测（收录成本下限评估：有作品词条→人物词条生态大概率成熟）
import fs from 'node:fs';

const BOOKS = [
  '夜无疆', '剑烛大荒', '请勿高考时渡劫', '没钱修什么仙？', '让仙门再次伟大',
  '1984：从川菜馆开始', '神宠供应商', '夜夜行歌', '捞尸人', '以神通之名',
  '有仙则名', '家父汉武帝', '希腊：我真不是半神', '九君齐天', '登神长阶',
  '异度旅社', '黎明之剑', '神秘复苏', '灵境行者', '斗破苍穹',
  '遮天', '圣墟', '完美世界', '大奉打更人', '赘婿', '神话版三国', '深空彼岸',
];
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
const out = [];
for (const name of BOOKS) {
  try {
    const url = 'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=' + encodeURIComponent(name) + '&bk_length=2000';
    const j = await (await fetch(url, { headers: { 'User-Agent': UA } })).json();
    // 命中判定：desc/abstract 含"小说"且含书名
    const text = String(j.description || '') + String(j.abstract || '');
    const hit = text.includes(name) && /小说|网文|玄幻|仙侠|都市|科幻|历史/.test(text);
    out.push({ name, baike: hit, abstract: hit ? text.slice(0, 60) : '' });
    console.log(`${hit ? '✓' : '-'} ${name}`);
  } catch (e) { out.push({ name, baike: false, err: String(e).slice(0, 50) }); console.log('-', name, 'ERR'); }
}
fs.writeFileSync('D:/cursorObject/小说Wiki/analysis/collection-baike.json', JSON.stringify(out, null, 1), 'utf8');
console.log('\n百科有作品词条:', out.filter(o => o.baike).length, '/', out.length);
