// 斗破苍穹 百科词条第二批扩采：异火榜 / 势力 / 补缺名（第一批在 probe-p0.mjs）
// 原始词条照旧只落盘 raw-baike/，控制台只打名字与命中
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'raw-baike');
fs.mkdirSync(OUT, { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SEEDS = [
  // 异火榜主火（图鉴线）
  '青莲地心火', '陨落心炎', '骨灵冷火', '三千焱炎火', '九幽金祖火', '金帝焚天炎', '红莲业火', '海心焰', '陀舍古帝焰', '帝焰',
  // 人物补缺/扩充
  '天火尊者（斗破苍穹）', '萧玉', '青鳞', '慕青鸾', '古河', '云棱', '法犸', '陀舍古帝', '药老',
  // 势力/地域
  '云岚宗', '魂族', '古族', '萧族', '药族', '灵族', '雷族', '炎族', '石族',
  '丹塔', '星陨阁', '花宗', '冰河谷', '万蝎门', '魔炎谷', '天蛇府', '米特尔家族', '中州', '黑角域',
];
const roster = [];
let hit = 0;
for (const name of SEEDS) {
  const safe = name.replaceAll('/', '_');
  const dst = path.join(OUT, safe + '.json');
  try {
    if (!fs.existsSync(dst)) {
      const url = 'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key='
        + encodeURIComponent(name) + '&bk_length=60000';
      const j = await fetch(url, { headers: UA }).then(r => r.json());
      fs.writeFileSync(dst, JSON.stringify(j, null, 1));
    }
    const j = JSON.parse(fs.readFileSync(dst, 'utf8'));
    const ok = !!j.key;
    if (ok) hit++;
    roster.push({ seed: name, key: j.key || null, ok, desc: (j.desc || '').slice(0, 50) });
    console.log(`${ok ? '✓' : '×'} ${name}${ok ? ' -> ' + j.key : ''} ${(j.desc || '').slice(0, 40)}`);
  } catch (e) { roster.push({ seed: name, ok: false, err: String(e).slice(0, 60) }); console.log('× ERR', name, String(e).slice(0, 50)); }
  await sleep(300);
}
fs.writeFileSync(path.join(__dirname, 'baike-roster-batch2.json'), JSON.stringify(roster, null, 1));
console.log(`\n==== 第二批：${hit}/${SEEDS.length}`);
