// 家谱/关系图布局 —— 移植 xianzu-wiki familyTreeLayout 精髓（dagre TB 分层 + 配偶 union
// 中间节点），适配本库数据形态：每角色自带 relationships[]（name/relation/id/relationType）。
// 与参考的两处差异：无 parent_role 字段（跳过过继弱化边）；世代替换用 generation 原文
// 「李家N世（X字辈）」直读，不做世代编号传播。
import dagre from '@dagrejs/dagre';

// 直系父母：文本必须以 父亲/母亲/父/母 开头 —— 排除「大父（祖父）」「叔祖父」等跨代
// 尊长（按边连会把祖辈压到父辈同层），也排除「大父李通崖的故交前辈」这类
// relationType=parent 的噪声边（文本含尊长词但实为故交）。
const DIRECT_PARENT_RE = /^(父\/母|父亲|母亲|生父|生母|养父|养母|继父|继母)/;
// 直接配偶：只认明写道侣/配偶/妻/夫的边；「嫂（…道侣）」「姑父」等姻亲转述开头即不匹配。
const DIRECT_SPOUSE_RE = /^(道侣|配偶|正妻|妻子|丈夫|夫君|双修|结为道侣)/;
const YS = 58; // 相邻世代行距：奇数层 union 落在两代正中（29px 间隙容下节点高）

export function buildKinMaps(characters) {
  const byId = new Map();
  for (const c of characters || []) if (c && c.id) byId.set(c.id, c);
  const parentsOf = new Map();   // child -> [parentId]
  const childrenOf = new Map();  // parent -> [childId]
  const spousePairs = [];
  const pairSeen = new Set();
  for (const c of byId.values()) {
    for (const r of c.relationships || []) {
      if (!r || !r.id || !byId.has(r.id) || r.id === c.id) continue;
      const t = (r.relation || '').trim();
      if (DIRECT_PARENT_RE.test(t)) {
        if (!(parentsOf.get(c.id) || []).includes(r.id)) {
          (parentsOf.get(c.id) || parentsOf.set(c.id, []).get(c.id)).push(r.id);
          (childrenOf.get(r.id) || childrenOf.set(r.id, []).get(r.id)).push(c.id);
        }
      } else if (DIRECT_SPOUSE_RE.test(t)) {
        const key = [c.id, r.id].sort().join('~');
        if (!pairSeen.has(key)) { pairSeen.add(key); spousePairs.push([c.id, r.id]); }
      }
    }
  }
  return { byId, parentsOf, childrenOf, spousePairs };
}

const unionId = (a, b) => `union:${[a, b].sort().join('-')}`;
const isUnion = id => String(id).startsWith('union:');
const GEN_RE = /李家(\d+)世/;

// 「配偶→union」「union/单亲→子女」两类边；子女两端父母同属一对配偶时只连 union。
function unionAndParentEdges(visited, spousePairs, parentsOf, addEdge) {
  const couples = new Map();
  for (const [a, b] of spousePairs) {
    if (visited.has(a) && visited.has(b)) couples.set(unionId(a, b), [a, b].sort());
  }
  for (const [uid, [a, b]] of couples) { addEdge(a, uid); addEdge(b, uid); }
  for (const child of visited) {
    const ps = (parentsOf.get(child) || []).filter(p => visited.has(p));
    if (!ps.length) continue;
    const handled = new Set();
    for (const [uid, [a, b]] of couples) {
      if (ps.includes(a) && ps.includes(b)) { addEdge(uid, child); handled.add(a); handled.add(b); }
    }
    for (const p of ps) if (!handled.has(p)) addEdge(p, child);
  }
  return couples;
}

function runDagre(nodes, edges, { nodesep = 40, ranksep = 60 } = {}) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep, ranksep });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: n.w, height: n.h });
  for (const e of edges) g.setEdge(e.source, e.target, e.minlen != null ? { minlen: e.minlen } : {});
  dagre.layout(g);
  for (const n of nodes) {
    const p = g.node(n.id);
    if (!p) continue;
    n.x = p.x; n.y = p.y;
  }
  for (const e of edges) {
    const ge = g.edge(e.source, e.target);
    e.points = ge && ge.points && ge.points.length ? ge.points.map(p => ({ x: p.x, y: p.y })) : null;
  }
  let w = 0, h = 0;
  for (const n of nodes) { w = Math.max(w, n.x + n.w / 2); h = Math.max(h, n.y + n.h / 2); }
  return { w: Math.ceil(w), h: Math.ceil(h) };
}

export function genSub(c) {
  const m = /李家(\d+)世（?(.)?字辈）?/.exec(c.generation || '');
  if (m) return `第${m[1]}世` + (m[2] ? `·${m[2]}字辈` : '');
  return c.generation || '';
}

// 整族血亲连通图：先单向上溯祖先，再从「焦点+祖先」整体下探子孙，配偶只作终端节点
// （不从配偶继续扩散其原生家族）。单两段遍历避免姻亲家族被反向连通带进整图。
//
// 布局不用 dagre：本库亲缘边稀疏（父链常断），按边流定层会把断链节点顶到 rank0、
// 世代上下颠倒。改为「世代定层 + 重心迭代排 x」：每人 y 由 generation「李家N世」直接
// 给出（缺失的沿 父母+1/子女-1/配偶同层 松弛推导），x 用上下扫重心+去重叠收敛。
export function buildClanGraph(characters, focusId) {
  const { byId, parentsOf, childrenOf, spousePairs } = buildKinMaps(characters);
  const visited = new Set(byId.has(focusId) ? [focusId] : []);
  let frontier = [...visited];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      for (const p of parentsOf.get(id) || []) {
        if (byId.has(p) && !visited.has(p)) { visited.add(p); next.push(p); }
      }
    }
    frontier = next;
  }
  frontier = [...visited];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      for (const k of childrenOf.get(id) || []) {
        if (byId.has(k) && !visited.has(k)) { visited.add(k); next.push(k); }
      }
    }
    frontier = next;
  }
  for (const [a, b] of spousePairs) {
    if (visited.has(a) && byId.has(b)) visited.add(b);
    if (visited.has(b) && byId.has(a)) visited.add(a);
  }

  const NW = 112, NH = 38, US = 14;
  const nodes = [...visited].map(id => {
    const c = byId.get(id);
    return { id, kind: 'char', name: c.name, sub: genSub(c), tier: c.tier, w: NW, h: NH, x: 0, y: 0 };
  });
  const edgeIds = new Set();
  const edges = [];
  const addEdge = (s, t) => {
    const key = `${s}->${t}`;
    if (edgeIds.has(key) || s === t) return;
    edgeIds.add(key);
    edges.push({ id: key, source: s, target: t });
  };
  const couples = unionAndParentEdges(visited, spousePairs, parentsOf, addEdge);
  for (const [uid] of couples) nodes.push({ id: uid, kind: 'union', name: '', w: US, h: US, x: 0, y: 0 });

  // —— 世代定层（level 单位 = 半行距）——有「李家N世」原文者直接定层；缺失者按
  // 父母+2 → 配偶同层 → 子女-2 的优先级松弛推导；最后做配偶回写：恰有一方带世代
  // 文本时另一方跟齐（嫁入者与配偶同排），双方都有且冲突视为数据矛盾不强行拉平。
  const lvl = new Map(), genLvl = new Set();
  for (const id of visited) {
    const m = GEN_RE.exec((byId.get(id) || {}).generation || '');
    if (m) { lvl.set(id, +m[1] * 2); genLvl.add(id); }
  }
  const mateOf = new Map();
  for (const [a, b] of spousePairs) { mateOf.set(a, b); mateOf.set(b, a); }
  for (let round = 0; round < 3; round++) {
    for (let pass = 0; pass < visited.size + 2; pass++) {
      let progressed = false;
      for (const id of visited) {
        if (lvl.has(id)) continue;
        const ps = (parentsOf.get(id) || []).filter(p => lvl.has(p));
        if (ps.length) { lvl.set(id, Math.max(...ps.map(p => lvl.get(p))) + 2); progressed = true; continue; }
        const sp = mateOf.get(id);
        if (sp != null && lvl.has(sp)) { lvl.set(id, lvl.get(sp)); progressed = true; continue; }
        const cs = (childrenOf.get(id) || []).filter(k => lvl.has(k));
        if (cs.length) { lvl.set(id, Math.min(...cs.map(k => lvl.get(k))) - 2); progressed = true; }
      }
      if (!progressed) break;
    }
    for (const [a, b] of spousePairs) {
      if (!visited.has(a) || !visited.has(b)) continue;
      const ga = genLvl.has(a), gb = genLvl.has(b);
      if (ga === gb) continue;
      if (ga) lvl.set(b, lvl.get(a)); else lvl.set(a, lvl.get(b));
    }
  }
  const maxLvl = Math.max(0, ...[...lvl.values()]);
  for (const n of nodes) {
    if (n.kind === 'char') n.y = (lvl.get(n.id) ?? maxLvl + 2) * (YS / 2);
  }
  for (const [uid, [a, b]] of couples) {
    const un = nodes.find(n => n.id === uid);
    const la = lvl.get(a), lb = lvl.get(b);
    // 同排：圆点落在婚姻线正中（配偶行同层）；双方都有世代文本且冲突时取中点悬浮
    const lu = la == null && lb == null ? maxLvl + 2
      : la != null && lb != null ? (la === lb ? la : (la + lb) / 2)
      : (la ?? lb);
    un.y = lu * (YS / 2);
  }

  // —— x 重心迭代：行内按邻居重心排序 + 左→右去重叠；夫妻与圆点组成三元组原子
  // 放置（保证婚姻线中间不隔第三方），多婚者的次圆点单独贴两配偶中点 ——
  const rows = new Map();
  for (const n of nodes) (rows.get(n.y) || rows.set(n.y, []).get(n.y)).push(n);
  const up = new Map(), down = new Map();
  for (const e of edges) {
    (down.get(e.source) || down.set(e.source, []).get(e.source)).push(e.target);
    (up.get(e.target) || up.set(e.target, []).get(e.target)).push(e.source);
  }
  const byNid = new Map(nodes.map(n => [n.id, n]));
  const initOrder = new Map();
  for (const row of rows.values()) row.forEach((n, i) => initOrder.set(n.id, i));
  const desired = n => {
    const ns = [...(up.get(n.id) || []), ...(down.get(n.id) || [])]
      .map(id => byNid.get(id)).filter(Boolean);
    return ns.length ? ns.reduce((s, p) => s + p.x, 0) / ns.length : null;
  };
  const unionSpouses = new Map(couples);
  const sameRowPair = (a, b) => a && b && Math.abs(a.y - b.y) < 1;
  // —— 联姻组件：同排夫妻（连同圆点）并成链，一人多偶时呈 [甲]●[乙]●[丙]，
  // 整链原子放置，婚姻线中间不隔第三方；异排夫妻的圆点退化为单点贴中点 ——
  const compOf = new Map(), compById = new Map();
  {
    const parent = new Map();
    const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const uni = (a, b) => { parent.set(find(a), find(b)); };
    const rowUids = [];
    for (const [uid, [a, b]] of couples) {
      const A = byNid.get(a), B = byNid.get(b);
      if (!A || !B || !sameRowPair(A, B)) continue;
      for (const id of [a, b, uid]) if (!parent.has(id)) parent.set(id, id);
      uni(a, b); uni(a, uid);
      rowUids.push(uid);
    }
    const adj = new Map();
    for (const uid of rowUids) {
      const [a, b] = unionSpouses.get(uid);
      (adj.get(a) || adj.set(a, []).get(a)).push({ uid, other: b });
      (adj.get(b) || adj.set(b, []).get(b)).push({ uid, other: a });
    }
    const byRoot = new Map();
    for (const uid of rowUids) {
      const root = find(uid);
      (byRoot.get(root) || byRoot.set(root, []).get(root)).push(uid);
    }
    for (const uids of byRoot.values()) {
      // 链序：以度最高的 char 为毂，联姻按 uid 序交替挂右/左
      const deg = new Map();
      for (const uid of uids) for (const p of unionSpouses.get(uid)) deg.set(p, (deg.get(p) || 0) + 1);
      let hub = null, bd = -1;
      for (const [c, d] of deg) if (d > bd) { bd = d; hub = c; }
      const es = (adj.get(hub) || []).slice().sort((x, y) => (x.uid < y.uid ? -1 : 1));
      const rights = [], lefts = [];
      es.forEach((e, i) => (i % 2 === 0 ? rights : lefts).push(e));
      const members = [];
      for (const e of lefts.slice().reverse()) members.push(byNid.get(e.other), byNid.get(e.uid));
      members.push(byNid.get(hub));
      for (const e of rights) members.push(byNid.get(e.uid), byNid.get(e.other));
      const comp = { id: 'cmp:' + uids[0], members };
      compById.set(comp.id, comp);
      for (const m of members) compOf.set(m.id, comp.id);
    }
  }
  const GAP = 16, DOTGAP = 10;
  const midX = n => {
    const [sa, sb] = unionSpouses.get(n.id) || [];
    return sameRowPair(byNid.get(sa), byNid.get(sb))
      ? (byNid.get(sa).x + byNid.get(sb).x) / 2 : null;
  };
  const placeRow = row => {
    // 行内分组：联姻组件整链一组，其余单点
    const gOf = new Map(), groups = [];
    for (const n of row) {
      const cid = compOf.get(n.id) || n.id;
      let gr = gOf.get(cid);
      if (!gr) { gr = { members: [], comp: compById.get(cid) || null }; gOf.set(cid, gr); groups.push(gr); }
      gr.members.push(n);
    }
    const gkey = gr => {
      if (!gr.comp) {
        const n = gr.members[0];
        if (n.kind === 'union') return midX(n) ?? desired(n) ?? n.x;
        return desired(n) ?? n.x;
      }
      const ds = gr.comp.members.map(m => desired(m)).filter(d => d != null);
      return ds.length ? ds.reduce((s, d) => s + d, 0) / ds.length : gr.comp.members[0].x;
    };
    groups.sort((a, b) => (gkey(a) - gkey(b)) || (initOrder.get(a.members[0].id) - initOrder.get(b.members[0].id)));
    let prevR = -1e9;
    for (const gr of groups) {
      if (gr.comp) {
        const ms = gr.comp.members;
        const w = ms.reduce((s, m) => s + m.w, 0) + DOTGAP * (ms.length - 1);
        const ds = ms.map(m => desired(m)).filter(d => d != null);
        let x = ds.length ? ds.reduce((s, d) => s + d, 0) / ds.length - w / 2 : ms[0].x - ms[0].w / 2;
        x = Math.max(x, prevR + GAP);
        let cur = x;
        for (const m of ms) { m.x = cur + m.w / 2; cur += m.w + DOTGAP; }
        prevR = cur - DOTGAP;
        continue;
      }
      const n = gr.members[0];
      if (n.kind === 'union') {
        n.x = Math.max(midX(n) ?? desired(n) ?? n.x, prevR + DOTGAP + n.w / 2);
        prevR = n.x + n.w / 2 + 4;
      } else {
        n.x = Math.max(desired(n) ?? n.x, prevR + GAP + n.w / 2);
        prevR = n.x + n.w / 2;
      }
    }
  };
  const keys = [...rows.keys()].sort((a, b) => a - b);
  for (let it = 0; it < 12; it++) {
    const sweep = it % 2 === 0 ? keys : [...keys].reverse();
    for (const y of sweep) placeRow(rows.get(y));
  }

  // —— 连线（正交）：婚姻边=侧边水平柄引入圆点；下行边=源底→水平总线→子女顶（梳状）——
  for (const e of edges) {
    const s = byNid.get(e.source), t = byNid.get(e.target);
    if (isUnion(e.target)) {
      const dir = t.x >= s.x ? 1 : -1;
      const pts = [{ x: s.x + dir * s.w / 2, y: s.y }];
      if (Math.abs(t.y - s.y) < 1) {
        pts.push({ x: t.x - dir * (t.w / 2 + 2.5), y: t.y });
      } else {
        pts.push({ x: t.x, y: s.y });
        const dy = t.y > s.y ? 1 : -1;
        pts.push({ x: t.x, y: t.y - dy * (t.w / 2 + 2.5) });
      }
      e.points = pts;
    } else {
      // 下行梳：源→水平总线→子女。常规：源底出、子女顶入，总线走两行间隙正中；
      // 反向（数据噪声：子代在上）镜像走上方；同行（噪声：子女与父母同代）
      // 总线沉到行下方间隙，避免横穿同排卡片。
      const sameRow = Math.abs(t.y - s.y) < 2;
      const up = !sameRow && t.y < s.y;
      let pEdge, cEdge, busY;
      if (sameRow) {
        pEdge = s.y + s.h / 2; cEdge = t.y + t.h / 2; busY = pEdge + 10;
      } else if (up) {
        pEdge = s.y - s.h / 2; cEdge = t.y + t.h / 2; busY = (pEdge + cEdge) / 2;
      } else {
        pEdge = isUnion(e.source) ? s.y + s.w / 2 + 2 : s.y + s.h / 2;
        cEdge = t.y - t.h / 2; busY = (pEdge + cEdge) / 2;
      }
      e.points = [{ x: s.x, y: pEdge }, { x: s.x, y: busY }, { x: t.x, y: busY }, { x: t.x, y: cEdge }];
      // 合法直系边恰好相邻一行；同行/反向/跨多行的边源于数据噪声（如尊长误标
      // 父母、世代文本冲突），弱化虚线提示不可靠
      e.weak = Math.abs(Math.abs(t.y - s.y) - YS) > 1;
    }
  }
  let W = 0, H = 0;
  for (const n of nodes) { W = Math.max(W, n.x + n.w / 2); H = Math.max(H, n.y + n.h / 2); }
  return { nodes, edges, w: Math.ceil(W) + NW / 2, h: Math.ceil(H) + NH / 2 + 8 };
}

// 卡内局部关系网：三层语义分层（尊长/师长在上，配偶同辈居中，后辈与其他在下）。
// dagre 不支持 minlen:0，同辈节点不进 dagre——布局后手工排到中心同行（配偶贴右、
// 兄弟左右交替），连线自绘水平线；尊长/后辈走 dagre 分层。关系文本保留在 rel-list。
export function buildLocalGraph(center) {
  const rels = (center.relationships || []).slice(0, 12);
  const TOP = new Set(['parent', 'master']);
  const MID = new Set(['spouse', 'sibling']);
  const me = { id: 'me', kind: 'me', name: center.name, w: Math.max(64, center.name.length * 15 + 20), h: 30, x: 0, y: 0 };
  const nodes = [me], mids = [], edges = [];
  rels.forEach((r, i) => {
    const id = `r${i}`;
    const n = { id, kind: 'rel', rel: r, name: r.name || '?', w: Math.max(52, (r.name || '?').length * 13 + 16), h: 26, x: 0, y: 0 };
    nodes.push(n);
    if (MID.has(r.relationType)) { mids.push(n); return; }
    if (TOP.has(r.relationType)) edges.push({ id, source: id, target: 'me', type: r.relationType, minlen: 1 });
    else edges.push({ id, source: 'me', target: id, type: r.relationType || 'other', minlen: 1 });
  });
  const dim = runDagre(nodes, edges, { nodesep: 16, ranksep: 44 });

  // 同辈手工排位：配偶优先右侧，其余左右交替扩展
  mids.sort((a, b) => (a.rel.relationType === 'spouse' ? -1 : 0) - (b.rel.relationType === 'spouse' ? -1 : 0));
  let curL = me.x - me.w / 2, curR = me.x + me.w / 2;
  mids.forEach((n, i) => {
    n.y = me.y;
    const right = i === 0 || i % 2 === 1;
    if (right) { n.x = curR + 14 + n.w / 2; curR = n.x + n.w / 2; }
    else { n.x = curL - 14 - n.w / 2; curL = n.x - n.w / 2; }
    const dir = n.x >= me.x ? 1 : -1;
    edges.push({ id: 'm' + n.id, source: 'me', target: n.id, type: n.rel.relationType,
      points: [{ x: me.x + dir * me.w / 2, y: me.y }, { x: n.x - dir * n.w / 2, y: n.y }] });
  });

  // 左溢出时整体平移（dagre 边点同步移）
  let minX = 8, W = dim.w, H = dim.h;
  for (const n of nodes) { minX = Math.min(minX, n.x - n.w / 2); W = Math.max(W, n.x + n.w / 2); H = Math.max(H, n.y + n.h / 2); }
  if (minX < 8) {
    const dx = 8 - minX;
    for (const n of nodes) n.x += dx;
    for (const e of edges) for (const p of e.points || []) p.x += dx;
    W += dx;
  }
  return { nodes, edges, w: W + 12, h: H + 16 };
}

// 世家页是否值得显示「族谱图谱」入口：存在任一直系父母或配偶结构边
export function hasKinData(characters) {
  const { parentsOf, spousePairs } = buildKinMaps(characters);
  return parentsOf.size > 0 || spousePairs.length > 0;
}

export const isUnionId = isUnion;
