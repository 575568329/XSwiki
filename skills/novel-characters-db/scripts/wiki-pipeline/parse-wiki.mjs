// 诡秘之主：解析 wiki 仓库（scaret/lord-of-mysteries-skill）-> guimi-parsed.json
// 产出：途径序列表 + 人物结构化字段 + 第二部判定 + 内容丰富度，供 build 人工审核
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, 'repo');
const DIR = p => path.join(REPO, p);
const rd = f => fs.readFileSync(f, 'utf8').replace(/\r\n?/g, '\n');

// ---------- 1) 途径序列表 ----------
// a) 目录型：途径/<组名>/序列N - XXX.md
// b) 单文件型：途径/<组名>.md 的 "### 序列N - 名（别名）"
const pathwayDir = DIR('途径');
const seqTable = {};        // 组名 -> {9:'占卜家',...,0:'愚者'}
const seqAlt = {};          // 组名 -> {9:['海眷者',...]}  官方异名
const pathInfo = {};        // 组名 -> {trueGod, aka, lead}
const SEQ_LINE = /^###\s*序列\s*(\d)\s*[:：\-—]\s*([^\n（(（]+)/gm;
const parseSeqText = raw => {
  const seqs = {}, alts = {};
  for (const m of raw.matchAll(SEQ_LINE)) {
    seqs[m[1]] = m[2].trim();
    alts[m[1]] = [...m[0].matchAll(/[（(]([^）)]+)[）)]/g)].map(x => x[1]);
  }
  return { seqs, alts };
};
const grabInfo = raw => {
  const head = raw.split(/^## /m)[0] || '';
  return {
    trueGod: (head.match(/对应真神[“"]([^”"]+)[”"]/) || head.match(/当前真神为([^\s，。,]{2,12})/) || [])[1] || '',
    aka: (head.match(/又称[“"]([^”"]+)[”"]途径/) || [])[1] || '',
    lead: head.replace(/^#+\s*/gm, '').replace(/\n+/g, ' ').slice(0, 250),
  };
};
for (const d of fs.readdirSync(pathwayDir)) {
  const full = path.join(pathwayDir, d);
  if (fs.statSync(full).isDirectory()) {
    const g = d;
    const detail = path.join(full, '序列详情.md');
    const { seqs, alts } = fs.existsSync(detail) ? parseSeqText(rd(detail)) : { seqs: {}, alts: {} };
    if (!Object.keys(seqs).length) {
      for (const f of fs.readdirSync(full)) {
        const m = f.match(/^序列(\d) - (.+)\.md$/);
        if (m) seqs[m[1]] = m[2];
      }
    }
    if (Object.keys(seqs).length) {
      seqTable[g] = seqs; seqAlt[g] = alts;
      const idx = path.join(full, '_index.md');
      pathInfo[g] = fs.existsSync(idx) ? grabInfo(rd(idx)) : { trueGod: '', aka: '', lead: '' };
    }
  } else if (d.endsWith('.md')) {
    const g = d.replace(/\.md$/, '');
    if (g === '非凡途径' || g === '神之途径' || g === '对应塔罗牌') continue;
    const raw = rd(full);
    const { seqs, alts } = parseSeqText(raw);
    if (Object.keys(seqs).length >= 5) {
      seqTable[g] = seqs; seqAlt[g] = alts; pathInfo[g] = grabInfo(raw);
    }
  }
}

// ---------- 2) 角色索引：name -> 途径组 ----------
const idxText = rd(DIR('角色/_index.md'));
const nameToPath = {};
let curGroup = '';
for (const line of idxText.split('\n')) {
  const g = line.match(/^## (.+)$/);
  if (g) { curGroup = g[1].trim(); continue; }
  const n = line.match(/^- \[(.+?)\]/);
  if (n) nameToPath[n[1]] = curGroup;
}

// ---------- 3) 解析角色 md ----------
const cleanMd = s => s
  .replace(/\[([^\]]+?)\]\([^)]*\)/g, '$1')
  .replace(/^#+ ?/gm, '')
  .replace(/^> ?/gm, '')
  .replace(/\*\*|__|~~/g, '')
  .replace(/^\s*[-*] /gm, '· ')
  .replace(/\n{3,}/g, '\n\n').trim();

function section(text, title) {
  const m = text.match(new RegExp(`^## ${title}\\s*\\n([\\s\\S]*?)(?=^##(?!#)\\s)`, 'm'));
  return m ? cleanMd(m[1]) : '';
}

const chars = [];
const rolesDir = DIR('角色');
for (const f of fs.readdirSync(rolesDir)) {
  if (!f.endsWith('.md') || f === '_index.md') continue;
  const name = f.replace(/\.md$/, '');
  const raw = rd(path.join(rolesDir, f));
  const pathwayGroup = nameToPath[name] || '';

  const aliases = new Set();
  const zun = raw.match(/^## 尊名\s*\n([\s\S]*?)(?=^##(?!#)\s)/m);
  if (zun) for (const m of zun[1].matchAll(/^[-*]?\s*["“]([^"”：\n]{2,20})["”]：/gm)) aliases.add(m[1].trim());
  const mainId = raw.match(/^## 主要身份\s*\n([\s\S]*?)(?=^##(?!#)\s)/m);
  const identHead = mainId ? cleanMd(mainId[1].split(/\n### /)[0] || '').slice(0, 150) : '';
  const identNames = mainId ? [...mainId[1].matchAll(/^### (.+)$/gm)].map(m => m[1].replace(/[“”"]/g, '').trim()) : [];
  for (const a of identNames) if (a && a !== name) aliases.add(a);
  // 化名句式："主要化名有：X、Y、Z"
  const huaming = raw.match(/化名[有是为]?[:：]([^。\n]{4,80})/);
  if (huaming) for (const p of huaming[1].split(/[、，,]/)) {
    const w = p.replace(/[等。\.]/g, '').trim();
    if (w.length >= 2 && w.length <= 12) aliases.add(w);
  }

  const seqRefs = [...raw.matchAll(/序列\s*([0-9])\s*["“]?([^\s，。、"”()（）]{2,10})?["”]?/g)]
    .map(m => ({ seq: parseInt(m[1]), name: (m[2] || '').trim() }));
  const volRefs = [...raw.matchAll(/第([一二三四五六七八九十]+)卷/g)].map(v => {
    const CN = { 一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10 };
    return v[1][0] === '十' ? 10 : CN[v[1][0]] || 0;
  });

  chars.push({
    name,
    pathwayGroup,
    aliases: [...aliases].slice(0, 20),
    identHead,
    identNames: identNames.slice(0, 8),
    appearance: section(raw, '外貌').slice(0, 220),
    personality: section(raw, '性格').slice(0, 180),
    family: section(raw, '家庭').slice(0, 450),
    quotes: [...raw.matchAll(/^> ?["“](.+?)["”]/gm)].map(m => m[1]).slice(0, 6),
    seqRefs,
    headQuote: cleanMd((raw.split(/^## /m)[0] || '')).slice(0, 220),
    textLen: raw.length,
    vol19: volRefs.filter(v => v >= 9).length,
    vol18: volRefs.filter(v => v >= 1 && v <= 8).length,
    coi: (raw.match(/宿命之环/g) || []).length + (raw.match(/卢米安/g) || []).length,
  });
}
chars.sort((a, b) => b.textLen - a.textLen);

// ---------- 4) 势力文件摘要 ----------
const factions = [];
for (const f of fs.readdirSync(DIR('势力与组织'))) {
  if (!f.endsWith('.md')) continue;
  const raw = rd(path.join(DIR('势力与组织'), f));
  factions.push({ name: f.replace(/\.md$/, ''), textLen: raw.length, lead: cleanMd(raw).slice(0, 180) });
}
factions.sort((a, b) => b.textLen - a.textLen);

fs.writeFileSync(path.join(__dirname, 'guimi-parsed.json'), JSON.stringify({ seqTable, seqAlt, pathInfo, chars, factions }, null, 1));
console.log(`途径 ${Object.keys(seqTable).length} 组；角色 ${chars.length}（已映射途径 ${chars.filter(c => c.pathwayGroup).length}）；势力 ${factions.length}`);
console.log('\n=== 途径序列表 ===');
for (const [g, s] of Object.entries(seqTable)) {
  const row = Array.from({length:10},(_,i)=>s[i]||'—').reverse();
  const info = pathInfo[g] ? `（真神:${pathInfo[g].trueGod || '?'} 别称:${pathInfo[g].aka || '-'}）` : '';
  console.log(`${g.padEnd(7)} ${row.join('→')} ${info}`);
}
console.log('\n=== 未映射途径的角色 ===');
chars.filter(c => !c.pathwayGroup).forEach(c => console.log(' ', c.name, c.textLen));
console.log('\n=== 第二部嫌疑（coi>1）===');
chars.filter(c => c.coi > 1).forEach(c => console.log(' ', c.name, 'coi:' + c.coi));
console.log('\n=== 内容最丰富的 30 人 ===');
chars.slice(0, 30).forEach(c => console.log(` ${String(c.textLen).padStart(6)} ${c.name} [${c.pathwayGroup || '?'}] ${c.aliases.slice(0, 4).join('/')}`));
