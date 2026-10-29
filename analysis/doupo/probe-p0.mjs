// 斗破苍穹 P0 深探测（2026-10-23，接续 session_d11bc1c 收录队列）
// ① 语料库探测：fundgao/xiuxian 仓库结构，斗破苍穹完整度（只取路径/计数，正文不进上下文）
// ② 百科人物名单：主力角色种子名单批量探测词条覆盖（原始词条落盘 analysis/doupo/raw-baike/）
// 遵守 docs/热榜收集清单.md 修订4：原文/词条正文只落盘，上下文只回填统计
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'raw-baike');
fs.mkdirSync(OUT, { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GH = 'https://api.github.com';

// ---------- ① 语料库：GitHub 仓库结构 ----------
const corpus = { repo: 'fundgao/xiuxian', ok: false };
try {
  const meta = await fetch(`${GH}/repos/fundgao/xiuxian`, { headers: UA }).then(r => r.json());
  corpus.meta = { stars: meta.stargazers_count, size_mb: +(meta.size / 1024).toFixed(1), branch: meta.default_branch, pushed: meta.pushed_at };
  console.log('repo:', meta.full_name, '| stars:', meta.stargazers_count, '| size(MB):', corpus.meta.size_mb, '| pushed:', meta.pushed_at);

  // 根目录找斗破相关目录（文件名只落盘）
  const root = await fetch(`${GH}/repos/fundgao/xiuxian/contents/`, { headers: UA }).then(r => r.json());
  const rootNames = root.map(x => `${x.type}:${x.name}`);
  fs.writeFileSync(path.join(__dirname, 'corpus-root.json'), JSON.stringify(rootNames, null, 1));
  console.log('root entries:', rootNames.length, '->', rootNames.filter(n => n.startsWith('dir')).slice(0, 30).join(', '));

  // 逐个候选目录名试
  const cand = root.filter(x => x.type === 'dir' && /斗破|doupo|douyu|btth/i.test(x.name));
  corpus.candidates = [];
  for (const d of cand) {
    const items = await fetch(`${GH}/repos/fundgao/xiuxian/contents/${encodeURIComponent(d.path)}`, { headers: UA }).then(r => r.json());
    const files = Array.isArray(items) ? items : [];
    const stat = { dir: d.path, entries: files.length, sample: files.slice(0, 5).map(f => f.name), total_kb: Math.round(files.reduce((s, f) => s + (f.size || 0), 0) / 1024) };
    corpus.candidates.push(stat);
    console.log('dir:', d.path, '| entries:', stat.entries, '| total(KB):', stat.total_kb, '| sample:', stat.sample.join(' ; ').slice(0, 120));
  }
  corpus.ok = corpus.candidates.length > 0;
  if (!corpus.ok) console.log('!! 根目录无斗破目录，看 corpus-root.json 手工定位');
} catch (e) { corpus.err = String(e).slice(0, 120); console.log('GH ERR:', corpus.err); }
fs.writeFileSync(path.join(__dirname, 'corpus-probe.json'), JSON.stringify(corpus, null, 1));

// ---------- ② 百科人物名单 ----------
const SEEDS = [
  // 主角团/核心
  '萧炎', '药尘', '萧薰儿', '美杜莎', '彩鳞', '云韵', '小医仙', '紫妍', '海波东',
  // 家族/早期
  '纳兰嫣然', '萧战', '萧鼎', '萧厉', '雅妃', '云山', '纳兰桀',
  // 迦南学院/魂殿线
  '韩枫', '天火尊者', '邙天尺', '林修崖', '柳擎', '苏千',
  // 远古八族/终局
  '魂天帝', '古元', '烛坤', '萧玄', '虚无吞炎', '净莲妖火',
  // 势力
  '迦南学院', '魂殿', '炎盟', '远古八族',
];
const roster = [];
let hit = 0;
for (const name of SEEDS) {
  const dst = path.join(OUT, name + '.json');
  try {
    if (!fs.existsSync(dst)) {
      const url = 'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key='
        + encodeURIComponent(name) + '&bk_length=60000';
      const j = await fetch(url, { headers: UA }).then(r => r.json());
      fs.writeFileSync(dst, JSON.stringify(j, null, 1));
    }
    const j = JSON.parse(fs.readFileSync(dst, 'utf8'));
    // 命中判定：词条 key 存在，且拒绝明显同名的无关词条（游戏角色/电视剧条目也先记下，构建时人工筛）
    const ok = !!j.key;
    if (ok) hit++;
    roster.push({ seed: name, key: j.key || null, ok, desc: (j.desc || '').slice(0, 50) });
    console.log(`${ok ? '✓' : '×'} ${name}${ok ? ' -> ' + j.key : ''} ${(j.desc || '').slice(0, 40)}`);
  } catch (e) { roster.push({ seed: name, ok: false, err: String(e).slice(0, 60) }); console.log('× ERR', name, String(e).slice(0, 50)); }
  await sleep(300);
}
fs.writeFileSync(path.join(__dirname, 'baike-roster.json'), JSON.stringify(roster, null, 1));
console.log(`\n==== 汇总：语料库 ${corpus.ok ? '✓ ' + (corpus.candidates || []).length + ' 个候选目录' : '✗ 需手工定位'} | 百科词条 ${hit}/${SEEDS.length}`);
