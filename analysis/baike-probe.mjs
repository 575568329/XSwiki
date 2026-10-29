// 通用百科词条生态探测：node baike-probe.mjs <书名> <输出目录> [种子文件]
// 种子缺省=内置三张名单；词条只落盘，控制台只打名字与命中
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [BOOK, OUTDIR, SEEDFILE] = process.argv.slice(2);
if (!BOOK || !OUTDIR) { console.error('用法: node baike-probe.mjs <书名> <输出目录> [种子文件]'); process.exit(1); }
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, OUTDIR, 'raw-baike');
fs.mkdirSync(OUT, { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const DEFAULT_SEEDS = {
  黎明之剑: ['高文·塞西尔', '赫蒂·塞西尔', '瑞贝卡·塞西尔', '琥珀', '皮特曼', '菲利普·塞西尔', '娜特娅', '薇尔妮卡', '梅高尔', '弗朗西斯', '塞西尔领', '刚铎', '提丰', '圣灵平原', '永眠者', '阴影之主', '/original/黎明之剑'],
  大奉打更人: ['许七安', '许新年', '许平志', '李妙真', '魏渊', '元景帝', '临安公主', '怀庆', '监正', '褚采薇', '杨千幻', '阿苏罗', '度厄', '白姬', '长公主', '打更人', '司天监', '钦天监', '佛门', '巫神教'],
};
let seeds;
if (SEEDFILE) seeds = fs.readFileSync(SEEDFILE, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
else seeds = DEFAULT_SEEDS[BOOK] || [];
if (!seeds.includes(BOOK)) seeds.unshift(BOOK);

const roster = [];
let hit = 0;
for (const name of seeds) {
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
    console.log(`${ok ? '✓' : '×'} ${name}${ok ? ' -> ' + j.key : ''} ${(j.desc || '').slice(0, 38)}`);
  } catch (e) { roster.push({ seed: name, ok: false, err: String(e).slice(0, 60) }); console.log('× ERR', name); }
  await sleep(300);
}
fs.writeFileSync(path.join(__dirname, OUTDIR, 'baike-roster.json'), JSON.stringify(roster, null, 1));
console.log(`\n==== ${BOOK}: ${hit}/${seeds.length}`);
