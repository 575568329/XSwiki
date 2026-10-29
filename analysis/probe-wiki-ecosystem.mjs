// 批量探测候选小说的 GitHub wiki 生态
// GitHub search API 未认证限流 10 次/分 → 7s 间隔；产出 collection-probe.json
import fs from 'node:fs';

const CANDIDATES = [
  '夜无疆', '剑烛大荒', '请勿高考时渡劫', '武道', '青山', '急急如律令',
  '没钱修什么仙', '让仙门再次伟大', '1984：从川菜馆开始', '神宠供应商', '夜夜行歌',
  '捞尸人', '以神通之名', '有仙则名', '家父汉武帝', '希腊：我真不是半神',
  '九君齐天', '剑主', '我哪会修仙啊', '登神长阶',
  '异度旅社', '黎明之剑', '堑壕大栓与魔法', '独守要塞三年，我成了长夜领主',
  '神秘复苏', '灵境行者', '斗破苍穹', '遮天', '完美世界',
  '神话版三国', '万历明君', '北望江山', '深空彼岸', '圣墟', '大奉打更人', '赘婿',
];

const UA = 'novel-wiki-collector/1.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = [];

for (const name of CANDIDATES) {
  let repos = [];
  try {
    const url = 'https://api.github.com/search/repositories?q=' + encodeURIComponent(name) + '&sort=stars&per_page=8';
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' } });
    if (res.status === 200) {
      const j = await res.json();
      repos = (j.items || []).map(r => ({
        full: r.full_name, stars: r.stargazers_count,
        desc: String(r.description || '').slice(0, 90),
        hit: r.full_name.includes(name) || String(r.description || '').includes(name),
      }));
    } else {
      console.log(name, 'HTTP', res.status, res.headers.get('x-ratelimit-remaining'));
    }
  } catch (e) { console.log(name, 'ERR', String(e).slice(0, 60)); }
  const relevant = repos.filter(r => r.hit);
  out.push({ name, wiki: relevant.length > 0, repos: (relevant.length ? relevant : repos).slice(0, 3) });
  console.log(`${relevant.length ? '✓' : '-'} ${name}: ${relevant.length} 命中${relevant.length ? ' → ' + relevant.slice(0, 2).map(r => r.full + '(' + r.stars + '★)').join(' / ') : ''}`);
  await sleep(7000); // 10 req/min 限流
}
fs.writeFileSync('D:/cursorObject/小说Wiki/analysis/collection-probe.json', JSON.stringify(out, null, 1), 'utf8');
console.log('\n有 wiki 生态:', out.filter(o => o.wiki).length, '/', out.length);
