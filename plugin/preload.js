const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// 数据目录: plugin/data/*.json (构建期由 analysis 管线生成，首装快照)
const DATA_DIR = path.join(__dirname, 'data');
// 远端热更新缓存目录（可写、跨版本保留）
const CACHE_DIR = path.join(os.homedir(), '.utools-novel-characters');
// 配置: 数据服务器与检查间隔
let CFG = { dataServer: '', checkTtlMin: 30 };
try { CFG = { ...CFG, ...JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')) }; } catch (e) {}

let cache = null;

// 加载: 缓存目录(远端下载的)覆盖内置快照
function loadBooks() {
  if (cache) return cache;
  const byId = new Map();
  const readFrom = (dir) => {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          if (j && j.id && Array.isArray(j.characters)) byId.set(j.id, j); // 缓存后读，覆盖内置
        } catch (e) { /* bad file */ }
      }
    } catch (e) { /* dir missing */ }
  };
  readFrom(DATA_DIR);
  readFrom(CACHE_DIR);
  cache = [...byId.values()];
  return cache;
}
function reload() { cache = null; }

// 立绘提示词/着装档案表: data/prompts.json + data/archives.json（<id>: 文本），角色卡片"立绘档案"弹窗数据源
let auxCache = null;
function loadAux(name) {
  if (!auxCache) auxCache = {};
  if (auxCache[name]) return auxCache[name];
  try { auxCache[name] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); } catch (e) { auxCache[name] = {}; }
  return auxCache[name];
}

function stateFile() { return path.join(CACHE_DIR, 'state.json'); }
function readState() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; } }
function writeState(s) { try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(s)); } catch (e) {} }

async function fetchBuf(url, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    return { status: res.status, etag: res.headers.get('etag'), buf: res.status === 200 ? Buffer.from(await res.arrayBuffer()) : null };
  } finally { clearTimeout(t); }
}

// 热更新检查: manifest(ETag) -> 逐书 sha256 比对 -> 增量下载(原子写)
// manual=true 跳过 TTL。返回 {updated, added:[title], version, skipped?}
async function checkUpdates(manual) {
  if (!CFG.dataServer) return { updated: false, skipped: 'no-server' };
  const st = readState();
  const now = Date.now();
  if (!manual && st.lastCheck && now - st.lastCheck < (CFG.checkTtlMin || 30) * 60000) {
    return { updated: false, skipped: 'ttl' };
  }
  let m;
  try {
    const r = await fetchBuf(CFG.dataServer + '/manifest.json', st.etag ? { 'If-None-Match': st.etag } : {});
    if (r.status === 304) { st.lastCheck = now; writeState(st); return { updated: false, skipped: 'etag' }; }
    if (r.status !== 200 || !r.buf) { st.lastCheck = now; writeState(st); return { updated: false, skipped: 'net-' + r.status }; }
    m = JSON.parse(r.buf.toString('utf8'));
    st.etag = r.etag || undefined;
    st.lastCheck = now;
  } catch (e) { st.lastCheck = now; writeState(st); return { updated: false, skipped: 'offline' }; }

  // 逐书比对: state.files 记账 {file:{size,sha}}；内置快照同尺寸同哈希则免下载
  const bundled = new Map(loadBooks().map(b => [b.id, b]));
  const bundledFileSize = new Map(); // id -> 内置文件字节数
  try {
    for (const f of fs.readdirSync(DATA_DIR)) {
      if (!f.endsWith('.json')) continue;
      try { const j = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); if (j.id) bundledFileSize.set(j.id, fs.statSync(path.join(DATA_DIR, f)).size); } catch (e) {}
    }
  } catch (e) {}
  st.files = st.files || {};
  const added = [], changed = [];
  for (const bk of m.books || []) {
    const rec = st.files[bk.file];
    if (rec && rec.size === bk.size && rec.sha === bk.sha256) continue;         // 已记账未变
    const cur = bundled.get(bk.id);
    const cachedExists = fs.existsSync(path.join(CACHE_DIR, bk.file));
    if (!cachedExists && cur && bundledFileSize.get(bk.id) === bk.size) {        // 内置即最新，仅记账
      st.files[bk.file] = { id: bk.id, size: bk.size, sha: bk.sha256 };
      continue;
    }
    try {
      const r = await fetchBuf(`${CFG.dataServer}/${bk.file}?v=${bk.version}-${bk.sha256.slice(0,10)}`);
      if (r.status !== 200 || !r.buf) continue;
      const sha = crypto.createHash('sha256').update(r.buf).digest('hex');
      if (sha !== bk.sha256) continue; // 校验失败拒绝落盘
      const j = JSON.parse(r.buf.toString('utf8'));
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      const tmp = path.join(CACHE_DIR, bk.file + '.tmp');
      fs.writeFileSync(tmp, r.buf);
      fs.renameSync(tmp, path.join(CACHE_DIR, bk.file));
      st.files[bk.file] = { id: bk.id, size: bk.size, sha: bk.sha256 };
      (cur ? changed : added).push(j.title || bk.id);
    } catch (e) { /* 单本失败不影响其他 */ }
  }
  if (added.length || changed.length) { reload(); st.version = m.version; }
  writeState(st);
  return { updated: !!(added.length || changed.length), added, changed, version: m.version };
}

window.services = {
  getBooks() {
    const books = loadBooks();
    return books.map(b => ({
      id: b.id, title: b.title, author: b.author, summary: b.summary,
      chapters: b.chapterCount, theme: b.theme, sigil: b.sigil, familyLabel: b.familyLabel, updatedAt: b.updatedAt,
      stats: { total: b.characters.length, tiers: b.stats?.tiers || {} },
      factions: b.factions || [],
      generations: b.generations || [],
    }));
  },
  // 体系/势力/原文页元数据（此前缺失会导致 uTools 实机这几页为空，浏览器预览走 fetch 降级才正常）
  getMeta(bookId) {
    const b = loadBooks().find(x => x.id === bookId);
    if (!b) return { factions: [], systemPage: null };
    return { factions: b.factionEntities || [], systemPage: b.systemPage || null };
  },
  // 全量人物（世代表/族谱用）
  allCharacters(bookId) {
    const b = loadBooks().find(x => x.id === bookId);
    return b ? b.characters.map(c => project(c)) : [];
  },
  // 热更新（UI 用于启动静默检查与手动"检查更新"按钮）
  checkUpdates,
  getDataServer() { return CFG.dataServer; },
  // 关键词搜索: 命中 name/aliases/identity/faction, 支持 pinyin 前缀
  search(bookId, keyword) {
    const books = loadBooks();
    const b = books.find(x => x.id === bookId);
    if (!b) return [];
    const kw = (keyword || '').trim().toLowerCase();
    if (!kw) {
      return b.characters.slice(0, 50).map(c => project(c));
    }
    const hits = [];
    for (const c of b.characters) {
      let score = 0;
      if (c.name.toLowerCase().includes(kw)) score = 100 - (c.name.toLowerCase().indexOf(kw)) * 0.1;
      else if ((c.aliases || []).some(a => a.toLowerCase().includes(kw))) score = 80;
      else if ((c.pinyin || '').includes(kw)) score = 60;
      else if ((c.oneLinerSafe || c.oneLiner || '').includes(keyword.trim())) score = 30;
      if (score > 0) hits.push([score + Math.min(c.mentions || 0, 3000) / 300, c]);
    }
    hits.sort((x, y) => y[0] - x[0]);
    return hits.slice(0, 80).map(([, c]) => project(c));
  },
  getCharacter(bookId, id) {
    const b = loadBooks().find(x => x.id === bookId);
    const c = b && b.characters.find(x => x.id === id);
    if (!c) return null;
    // 立绘: data/images/{id}.png 存在则展示（构建期由生图管线产出）
    try { if (fs.existsSync(path.join(DATA_DIR, 'images', `${c.id}.png`))) c.portrait = `data/images/${c.id}.png`; } catch (e) {}
    // 立绘提示词/着装档案: 对应 JSON 有该角色则透出（卡片"立绘档案"弹窗）
    const ptxt = loadAux('prompts.json')[c.id];
    if (ptxt) c.promptText = ptxt;
    const atxt = loadAux('archives.json')[c.id];
    if (atxt) c.archiveText = atxt;
    // 关系反查: 谁的关系里提到我
    const referrers = [];
    if (b) for (const o of b.characters) {
      for (const r of o.relationships || []) {
        if (r.id === id) referrers.push({ fromId: o.id, fromName: o.name, relation: r.relation });
      }
    }
    return { ...c, referrers: referrers.slice(0, 30) };
  },
  listByFaction(bookId, faction) {
    const b = loadBooks().find(x => x.id === bookId);
    if (!b) return [];
    return b.characters.filter(c => (c.faction || '') === faction).map(c => project(c));
  },
  listByGeneration(bookId, gen) {
    const b = loadBooks().find(x => x.id === bookId);
    if (!b) return [];
    return b.characters.filter(c => (c.generation || '') === gen).map(c => project(c));
  },
};

function project(c) {
  return {
    id: c.id, name: c.name, aliases: c.aliases, tier: c.tier,
    importance: c.importance, oneLiner: c.oneLiner, faction: c.faction,
    generation: c.generation, identity: c.identity, cultivation: c.cultivation,
    mentions: c.mentions, chapterCount: c.chapterCount, seal: c.seal, oneLinerSafe: c.oneLinerSafe,
    firstChapter: c.firstChapter, lastChapter: c.lastChapter, status: c.status,
    // 立绘排期/主角线（玄鉴仙族专用字段，世代表/纵表徽标用）
    toProtagonist: c.toProtagonist, visualLine: c.visualLine, role: c.role, stages: c.stages,
  };
}
