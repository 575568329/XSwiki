// 归并: roster-*.json (LLM抽样) + name-stats.json (程序普查) -> candidates.json
// 输出分组: confirmed(roster确认) / mined(程序挖出待人工复核)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = path.join(__dirname, 'roster-work');
const RAW = p => path.join(__dirname, 'raw', p);

// 1) 加载 roster
const rosters = [];
for (const f of fs.readdirSync(W).filter(f => /^roster-\d+\.json$/.test(f))) {
  try { rosters.push(JSON.parse(fs.readFileSync(path.join(W, f), 'utf8'))); } catch (e) { console.log('bad', f, e.message); }
}
console.log('roster 文件数:', rosters.length);

// 2) 归并角色: 名字/别名精确匹配
const byName = new Map(); // key -> entry
const keyOf = s => (s || '').trim();
function addToRoster(r, chunkIdx, chapterNos) {
  const k = keyOf(r.name);
  let e = byName.get(k);
  if (!e) { e = { name: r.name, aliases: new Set(), notes: [], quotes: [], chunks: new Set(), chapters: new Set(), llm: true }; byName.set(k, e); }
  for (const a of r.aliases || []) if (a && a !== e.name) e.aliases.add(a);
  if (r.note) e.notes.push({ chunk: chunkIdx, note: r.note });
  for (const q of r.quotes || []) e.quotes.push(q);
  e.chunks.add(chunkIdx);
  for (const c of chapterNos || r.chapters || []) e.chapters.add(c);
}
for (const R of rosters) for (const r of R.characters || []) addToRoster(r, R.chunk, r.chapters);

// 别名折叠: 某人的别名 == 另一条目的名字 => 合并（记录候选供人工复核而非直接并）
const entries = [...byName.values()];
const aliasMerge = [];
for (const e of entries) {
  for (const a of e.aliases) {
    const target = byName.get(keyOf(a));
    if (target && target !== e) aliasMerge.push({ keep: e.name, absorb: a, alsoName: true });
  }
}

// 3) 程序普查数据
const stats = JSON.parse(fs.readFileSync(RAW('name-stats.json'), 'utf8'));
const statByName = new Map(stats.map(s => [s.name, s]));

// roster 名 + 别名都映射到全文统计
const statFor = names => {
  for (const n of names) { const s = statByName.get(n); if (s) return s; }
  return null;
};

// 4) confirmed: roster条目(或其任一别名)在全文有分布
const confirmed = [];
for (const e of entries) {
  const s = statFor([e.name, ...e.aliases]);
  confirmed.push({
    name: e.name,
    aliases: [...e.aliases],
    llmChunks: [...e.chunks].sort((a, b) => a - b),
    notes: e.notes,
    quotes: [...new Set(e.quotes)].slice(0, 6),
    stats: s ? { total: s.total, chapterCount: s.chapterCount, first: s.first, last: s.last } : null,
  });
}
confirmed.sort((a, b) => (b.stats?.total || 0) - (a.stats?.total || 0));

// 5) mined-only: 程序挖出但 roster 未确认的（3字姓名为主 + 高频2字）
const rosterNames = new Set();
for (const e of entries) { rosterNames.add(e.name); for (const a of e.aliases) rosterNames.add(a); }
const STOP2 = new Set(['时间','出来','道友','上来','金色','成了','白色','毕竟','于是','时候','方的','雷霆','金光','弟子','位真','方才','许多','成就','安排','龙属','何况','位大','位真人','氏','了一声','出来','道人','下来','出来','过去','出来','大师','出手','一声','天道','下来','一声','真人','修士','出来','上去','出来','族长','出来','前辈','出来','老祖','出来','长老','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来','出来']);
const minedOnly = stats.filter(s => !rosterNames.has(s.name))
  .filter(s => s.kind === 'surname3' ? (s.total >= 60 && s.chapterCount >= 10)
    : s.kind === 'surname2' ? (s.total >= 300 && s.chapterCount >= 60 && !STOP2.has(s.name))
    : (s.total >= 200 && s.chapterCount >= 60))
  .map(s => ({ name: s.name, kind: s.kind, total: s.total, chapterCount: s.chapterCount, first: s.first, last: s.last }));
minedOnly.sort((a, b) => b.total - a.total);

fs.writeFileSync(path.join(__dirname, 'candidates.json'), JSON.stringify({
  confirmedCount: confirmed.length,
  aliasMergeCandidates: aliasMerge,
  confirmed,
  minedOnly,
}, null, 1));
console.log(`confirmed(roster确认): ${confirmed.length}  alias合并候选: ${aliasMerge.length}  mined-only待复核: ${minedOnly.length}`);
console.log('mined-only 前80 (需人工去噪):');
minedOnly.slice(0, 80).forEach(s => console.log(`  ${s.name} ${s.kind} 频${s.total} 章${s.chapterCount} 首${s.first}`));
