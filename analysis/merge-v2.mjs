// v2 数据合并: cards-v2(24卡精修) + factions-v2(势力实体) -> 书目JSON，并同步 plugin-src/public/data
// 前置: W1/W2 子代理产出齐; 跑完再重跑 gen-system.mjs（境界口径吃到新cultivation）与 gen-seals.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'plugin', 'data', 'xuanjianxianzu.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// 1) cards-v2 合入人物
let n1 = 0, bad = [];
const dir = path.join(__dirname, 'cards-v2');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  let c2;
  try { c2 = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { bad.push(f + ':JSON坏'); continue; }
  const t = data.characters.find(c => c.name === c2.name);
  if (!t) { bad.push(f + ':找不到' + c2.name); continue; }
  for (const k of ['oneLiner', 'toProtagonist', 'visualLine', 'role', 'stages', 'cultivation']) {
    if (c2[k] !== undefined) t[k] = c2[k];
  }
  // oneLinerSafe 重算（新 oneLiner 可能仍含剧透词）
  const SPOILER_RE = /(陨落|身死|战死|被杀|所杀|殒命|死亡|死了|坐化|兵解|败亡|同归于尽|自尽|身亡)/;
  const safe = ol => {
    if (!ol || !SPOILER_RE.test(ol)) return ol || '';
    const parts = ol.split(/，|。|；/).filter(Boolean);
    const s = parts.filter(p => !SPOILER_RE.test(p));
    return s.length ? s.slice(0, 3).join('，') : '身份信息详见人物卡';
  };
  t.oneLinerSafe = safe(t.oneLiner);
  n1++;
}

// 2) factions-v2 合入
let n2 = 0;
const ff = path.join(__dirname, 'factions-v2.json');
if (fs.existsSync(ff)) {
  const facts = JSON.parse(fs.readFileSync(ff, 'utf8'));
  if (Array.isArray(facts) && facts.length) {
    // 挂成员数
    for (const f of facts) f.members = data.characters.filter(c => c.faction === f.name).length;
    data.factionEntities = facts;
    n2 = facts.length;
  }
}

fs.writeFileSync(FILE, JSON.stringify(data));
console.log(`cards-v2 合入 ${n1} 张（异常: ${bad.length ? bad.join('; ') : '无'}）；势力实体 ${n2} 个`);

// 3) 同步 plugin-src/public/data（Vue 版前端的数据源）
const SRC = path.join(__dirname, '..', 'plugin', 'data');
const DST = path.join(__dirname, '..', 'plugin-src', 'public', 'data');
fs.mkdirSync(DST, { recursive: true });
for (const f of ['xuanjianxianzu.json', 'index.json', 'images.json']) {
  try { fs.copyFileSync(path.join(SRC, f), path.join(DST, f)); } catch (e) { console.log('sync', f, e.message); }
}
try { fs.cpSync(path.join(SRC, 'images'), path.join(DST, 'images'), { recursive: true }); } catch (e) {}
console.log('已同步 plugin-src/public/data');
