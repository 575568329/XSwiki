// 诊断脚本：用真实玄鉴数据跑 buildClanGraph，校验新几何并输出 SVG 供目检
import { readFileSync, writeFileSync } from 'node:fs';
const { buildClanGraph } = await import('file:///D:/cursorObject/%E5%B0%8F%E8%AF%B4Wiki/plugin-src/src/lib/familyGraph.js');

const data = JSON.parse(readFileSync('D:/cursorObject/小说Wiki/server/data/xuanjianxianzu.json', 'utf8'));
const chars = data.characters;
const focusName = process.argv[2] || '李木田';
const focus = chars.find(c => c.name === focusName);
if (!focus) { console.error('找不到焦点角色', focusName); process.exit(1); }

const g = buildClanGraph(chars, focus.id);
const byId = new Map(g.nodes.map(n => [n.id, n]));
const unionIds = new Set(g.nodes.filter(n => n.kind === 'union').map(n => n.id));
console.log(`[${focusName}] 节点: ${g.nodes.length} 边: ${g.edges.length} 画布: ${g.w} x ${g.h}`);

let bad = 0;
// 1) 非有限坐标
for (const n of g.nodes) {
  if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) { console.log('  非有限坐标:', n.id); bad++; }
}
if (!Number.isFinite(g.w) || !Number.isFinite(g.h)) { console.log('  画布尺寸非有限!'); bad++; }

// 2) union 是否落在两配偶之间且水平柄可见
for (const u of g.nodes.filter(n => n.kind === 'union')) {
  const rest = u.id.slice(6);
  const a = chars.find(c => rest.startsWith(c.id + '-') || rest === c.id);
  // id 可能含 -，逐字符匹配两端
  let A = null, B = null;
  for (const c of chars) {
    if (rest.startsWith(c.id + '-')) { A = c; break; }
  }
  if (A) { const tail = rest.slice(A.id.length + 1); B = chars.find(c => c.id === tail); }
  const na = byId.get(A?.id), nb = byId.get(B?.id);
  if (!na || !nb) continue;
  const lo = Math.min(na.x, nb.x), hi = Math.max(na.x, nb.x);
  const inSpan = u.x >= lo - 1 && u.x <= hi + 1;
  const sameRow = Math.abs(na.y - nb.y) < 1;
  const onLine = sameRow ? Math.abs(u.y - na.y) < 1 : true;
  if (!inSpan || !onLine) {
    console.log(`  union ${A.name}/${B.name}: 点x=${u.x.toFixed(0)} 配偶区间=[${lo.toFixed(0)},${hi.toFixed(0)}] 同排=${sameRow} 在婚姻线上=${onLine}`);
    bad++;
  }
}

// 3) 折线段穿过卡片
function segRectHit(p, q, r) {
  const l = r.x - r.w / 2 - 2, rt = r.x + r.w / 2 + 2, tp = r.y - r.h / 2 - 2, bt = r.y + r.h / 2 + 2;
  // 水平/垂直线段与矩形相交精确判断
  if (p.y === q.y) {
    const y = p.y, x1 = Math.min(p.x, q.x), x2 = Math.max(p.x, q.x);
    return y > tp && y < bt && x2 > l && x1 < rt;
  }
  if (p.x === q.x) {
    const x = p.x, y1 = Math.min(p.y, q.y), y2 = Math.max(p.y, q.y);
    return x > l && x < rt && y2 > tp && y1 < bt;
  }
  for (let i = 1; i < 20; i++) {
    const t = i / 20;
    const x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t;
    if (x > l && x < rt && y > tp && y < bt) return true;
  }
  return false;
}
let hits = 0;
for (const e of g.edges) {
  const s = byId.get(e.source), t = byId.get(e.target);
  if (!s || !t || !e.points) continue;
  for (let i = 0; i < e.points.length - 1; i++) {
    for (const n of g.nodes) {
      if (n.id === e.source || n.id === e.target || n.kind === 'union') continue;
      if (segRectHit(e.points[i], e.points[i + 1], n)) {
        hits++;
        if (hits <= 10) console.log(`  边 ${s.name || s.id}→${t.name || t.id} 段${i} 穿过 ${n.name}`);
        break;
      }
    }
  }
}
console.log('  穿卡边数:', hits, '| 异常项:', bad);

// 输出 SVG（按 FamilyTree.vue 新画法：折线）
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function pathOf(pts) {
  if (!pts || pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x},${pts[i].y}`;
  return d;
}
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${g.w}" height="${g.h}" viewBox="0 0 ${g.w} ${g.h}"><rect width="100%" height="100%" fill="#151824"/>`;
for (const e of g.edges) svg += `<path d="${pathOf(e.points)}" fill="none" stroke="#7fd1ff" stroke-width="1.2" ${e.weak ? 'stroke-dasharray="3 3" opacity=".35"' : 'opacity=".85"'}/>`;
for (const n of g.nodes.filter(n => n.kind === 'union')) svg += `<circle cx="${n.x}" cy="${n.y}" r="${n.w / 2 + 1.5}" fill="#e8c37a"/>`;
for (const n of g.nodes.filter(n => n.kind === 'char')) {
  svg += `<g transform="translate(${n.x - n.w / 2},${n.y - n.h / 2})"><rect width="${n.w}" height="${n.h}" rx="8" fill="#232941" stroke="#3a4468"/><text x="24" y="${n.sub ? 16 : n.h / 2 + 4}" fill="#e8ecf7" font-size="12" font-family="sans-serif">${esc(n.name)}</text>${n.sub ? `<text x="24" y="30" fill="#8a93b5" font-size="10" font-family="sans-serif">${esc(n.sub)}</text>` : ''}</g>`;
}
svg += '</svg>';
writeFileSync(`D:/cursorObject/小说Wiki/tests/clan-${focusName}.svg`, svg);
console.log('  SVG: tests/clan-' + focusName + '.svg');
