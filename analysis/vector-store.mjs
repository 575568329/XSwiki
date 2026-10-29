// [已弃用 2026-10-22] 实测结论：读者查询以名字/别名/拼音精确匹配为主，JSON内存检索已足够；
// 向量检索仅在生成期有价值且可用 notes 全文 indexOf 替代。本脚本仅作决策留档，勿进发布链路。
// 轻量语义检索: embedding-3 + JSON存向量 + 暴力余弦（千级规模足够，无需向量数据库）
// 用法:
//   export ZHIPUAI_API_KEY=... && node vector-store.mjs build    # 建索引(人物rosterNotes+档案)
//   node vector-store.mjs query "用枪的女修"                       # 语义查询
// 产出: raw/vector-index.json  [{id,name,text,vec}]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ZHIPUAI_API_KEY;
const IDX = path.join(__dirname, 'raw', 'vector-index.json');
const DATA = path.join(__dirname, '..', 'plugin', 'data', 'xuanjianxianzu.json');

async function embed(texts) {
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'embedding-3', input: texts }),
  });
  if (!res.ok) throw new Error(`embed HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const j = await res.json();
  return j.data.map(d => d.embedding);
}

const cos = (a, b) => { let s = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; } return s / (Math.sqrt(na) * Math.sqrt(nb)); };

async function build() {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const docs = [];
  for (const c of data.characters) {
    // 检索文本: 名字+别名+档案句+notes(截400字)
    const notes = (c.rosterNotes || []).map(n => n.note).join(' ').slice(0, 400);
    const p = c.persona || {};
    const text = [c.name, ...(c.aliases || []).slice(0, 5), c.oneLiner || '', c.identity || '', c.faction || '', c.cultivation || '', p.appearance || '', (p.personality || []).join(' '), notes].filter(Boolean).join(' | ');
    if (text.length > 20) docs.push({ id: c.id, name: c.name, tier: c.tier, text: text.slice(0, 800) });
  }
  console.log(`待嵌入 ${docs.length} 条`);
  const out = [];
  const B = 32; // 每批条数
  for (let i = 0; i < docs.length; i += B) {
    const batch = docs.slice(i, i + B);
    const vecs = await embed(batch.map(d => d.text));
    batch.forEach((d, k) => out.push({ ...d, vec: vecs[k] }));
    process.stdout.write(`\r${Math.min(i + B, docs.length)}/${docs.length}`);
    await new Promise(r => setTimeout(r, 300));
  }
  fs.writeFileSync(IDX, JSON.stringify(out));
  console.log(`\n索引完成: ${out.length} 条 -> ${IDX} (${(fs.statSync(IDX).size / 1048576).toFixed(1)}MB)`);
}

async function query(q, topN = 8) {
  const idx = JSON.parse(fs.readFileSync(IDX, 'utf8'));
  const [qv] = await embed([q]);
  const t0 = Date.now();
  const hits = idx.map(d => ({ d, s: cos(qv, d.vec) })).sort((a, b) => b.s - a.s).slice(0, topN);
  console.log(`“${q}” (${Date.now() - t0}ms):`);
  for (const { d, s } of hits) console.log(`  ${(s).toFixed(3)}  [t${d.tier}] ${d.name}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'build') build().catch(e => { console.error(e.message); process.exit(1); });
else if (cmd === 'query') query(rest.join(' ')).catch(e => { console.error(e.message); process.exit(1); });
else console.log('用法: node vector-store.mjs build | query "..."');
