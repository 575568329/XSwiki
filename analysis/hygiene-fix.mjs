// 数据卫生回补（幂等，直接修 plugin/data 现有 JSON，之后跑 sync-data.mjs 同步）：
// ① 拼音索引：别名里的（…）括注是 roster 噪声，剥掉后重建（build-data.mjs 同规则已修，下次全量重建即复现）
// ② oneLinerSafe：SPOILER_RE 补了 刺杀|牺牲，已生成的安全句回补重算
// ③ 诡秘 generation（天使/神祇词条缺失、或预分配与 cultivation 序列名不符如罗塞尔）：按序列名反查途径图鉴，唯一命中才回填/纠偏（build-guimi.mjs 同规则已修）
// 用法：node hygiene-fix.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'plugin', 'data');
const SPOILER_RE = /(陨落|身死|战死|被杀|所杀|殒命|死亡|死了|坐化|兵解|败亡|重伤不治|同归于尽|自尽|身亡|刺杀|牺牲)/;
const safeOneLiner = one => {
  if (!one || !SPOILER_RE.test(one)) return one || '';
  const parts = one.split(/，|。|；/).filter(Boolean);
  const safe = parts.filter(p => !SPOILER_RE.test(p));
  return safe.length ? safe.slice(0, 3).join('，') : '身份信息详见人物卡（含剧情）';
};

for (const file of fs.readdirSync(DATA).filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'images.json' && f !== 'manifest.json')) {
  const p = path.join(DATA, file);
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let nPy = 0, nSafe = 0, nGen = 0;
  const formal2seqs = new Map();
  for (const x of (d.systemPage?.codex?.entries || [])) {
    const seqs = String(x.desc || '').split('→').map(s => s.trim()).filter(Boolean);
    if (seqs.length >= 4) formal2seqs.set(x.name, seqs);
  }
  for (const c of d.characters || []) {
    const cleanAliases = (c.aliases || []).map(a => String(a || '').replace(/[（(][^）)]*[）)]/g, '').trim()).filter(Boolean);
    const tok = x => pinyin(x, { toneType: 'none', type: 'array' }).join('').replace(/[^a-z0-9]/g, '');
    const py = [c.name, ...cleanAliases].map(tok).filter(Boolean).join(',');
    if (py !== c.pinyin) { c.pinyin = py; nPy++; }
    if (!c.aliases || cleanAliases.length !== c.aliases.length) c.aliases = cleanAliases;
    const safe = safeOneLiner(c.oneLiner);
    if (safe !== c.oneLinerSafe) { c.oneLinerSafe = safe; nSafe++; }
    if (c.cultivation) {
      const m = /^序列(\d) (.+)$/.exec(c.cultivation);
      if (m) {
        // 神祇本尊兜底：序列0 神名 = 途径正式名去“途径”后缀（欧弥贝拉=大地母神；wiki 表里该位叫“母亲”）
        const byName = m[1] === '0' && m[2] + '途径' !== c.generation && formal2seqs.has(m[2] + '途径') ? m[2] + '途径' : null;
        const inGen = (formal2seqs.get(c.generation) || []).some(s => s.startsWith(`序列${m[1]} `) && s.includes(m[2]));
        if (!inGen) {
          const hits = [...formal2seqs].filter(([, seqs]) => seqs.some(s => s.startsWith(`序列${m[1]} `) && s.includes(m[2])));
          if (hits.length === 1) { c.generation = hits[0][0]; nGen++; }
          else if (byName) { c.generation = byName; nGen++; }
        }
      }
    }
  }
  fs.writeFileSync(p, JSON.stringify(d));
  console.log(`[${d.id}] 拼音重算 ${nPy} / 安全句回补 ${nSafe} / 途径回填 ${nGen}`);
}
