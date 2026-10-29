// 诡秘之主：批量抓取百度百科开放接口词条卡（infobox + abstract）
// 用法: node grab-baike.mjs [名字文件] ；名字一行一个，# 开头为注释
// 输出: raw-baike/<name>.json（原始返回），failed.txt 记录未命中
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'raw-baike');
fs.mkdirSync(OUT, { recursive: true });

const namesFile = process.argv[2] || path.join(__dirname, 'names.txt');
const names = fs.readFileSync(namesFile, 'utf8').split('\n').map(s => s.trim())
  .filter(s => s && !s.startsWith('#'));

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, fail = [];
for (const name of names) {
  const dst = path.join(OUT, name.replaceAll('/', '_') + '.json');
  if (fs.existsSync(dst)) { ok++; continue; }
  try {
    const url = 'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key='
      + encodeURIComponent(name) + '&bk_length=60000';
    const j = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
    }).then(r => r.json());
    if (!j.key) { console.log('× miss:', name, JSON.stringify(j).slice(0, 100)); fail.push(name); }
    else {
      fs.writeFileSync(dst, JSON.stringify(j, null, 1));
      console.log('✓', name, '->', j.key, '| desc:', (j.desc || '').slice(0, 60));
      ok++;
    }
  } catch (e) { console.log('× ERR:', name, e.message); fail.push(name); }
  await sleep(300);
}
if (fail.length) fs.writeFileSync(path.join(__dirname, 'failed.txt'), fail.join('\n'));
console.log(`\ndone: ${ok}/${names.length}, miss: ${fail.length}`);
