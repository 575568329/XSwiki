// 小说Wiki - 主逻辑（无框架，纯浏览器端）
/* global utools, services */
const $main = document.getElementById('main');
const $bookName = document.getElementById('bookName');
const $bookMeta = document.getElementById('bookMeta');

let state = {
  bookId: null, keyword: '', filter: null, // {type:'faction'|'generation', value}
  view: 'list', current: null, history: [], cursor: 0, items: [],
  books: [], factions: [], generations: [],
};

const TIER_LABEL = { 1: '核心', 2: '重要', 3: '次要' };
const IMP_LABEL = { protagonist: '主角', major: '主要', supporting: '配角', minor: '边缘' };

// ---------- 热更新 ----------
function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
}

async function runSync(manual) {
  if (!services.checkUpdates) return;
  const btn = document.getElementById('btnSync');
  if (manual && btn) { btn.classList.add('busy'); btn.textContent = '⟳ 检查中…'; }
  try {
    const r = await services.checkUpdates(manual);
    if (r && r.updated) {
      state.books = services.getBooks();
      const names = [...(r.added || []), ...(r.changed || [])];
      toast('数据已更新：' + names.slice(0, 3).join('、') + (names.length > 3 ? ' 等' : ''));
      // 若当前书数据已变，回到列表重载；多书回书目页
      if (state.view === 'detail' || state.view === 'list') { state.view = state.books.length > 1 ? 'books' : 'list'; state.filter = null; }
      render();
    } else if (manual) {
      toast((r && r.skipped === 'offline') ? '服务器不可达，已使用本地数据' : '已是最新数据');
    }
  } catch (e) { if (manual) toast('检查失败：' + (e.message || e)); }
  finally { if (manual && btn) { btn.classList.remove('busy'); btn.textContent = '⟳ 更新'; } }
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

window.addEventListener('load', init);

// 浏览器直开(开发预览)时的降级: 无 preload 就 fetch 数据，并模拟 services
let fallbackImages = null; // 有立绘的 id 集合
async function initBrowserFallback() {
  const SERVER = 'http://127.0.0.1:8300';
  // 优先读 manifest（构建期生成），否则退回单文件
  let files;
  try {
    const r = await fetch('data/index.json');
    files = await r.json();
  } catch { files = ['data/xuanjianxianzu.json']; }
  const books = [];
  for (const f of files) {
    try { books.push(await (await fetch(f.startsWith('data/') ? f : 'data/' + f)).json()); } catch {}
  }
  // 从 Cache API 恢复热更新下载过的书（离线重启仍可用）
  try {
    const cc = await caches.open('novel-chars');
    const st = JSON.parse(localStorage.getItem('updState') || '{}');
    const cachedIds = new Set(books.map(b => b.id));
    for (const [file, rec] of Object.entries(st.files || {})) {
      try {
        const m = file.match(/^(.+)\.json$/);
        const cached = await cc.match(`${SERVER}/${file}`);
        if (!cached) continue;
        const j = await cached.json();
        if (!cachedIds.has(j.id)) books.push(j);
      } catch (e) {}
    }
  } catch (e) {}
  if (!books.length) throw new Error('no data');
  try { fallbackImages = new Set(await (await fetch('data/images.json')).json()); } catch { fallbackImages = new Set(); }
  window.services = makeFallbackServices(books);
}

function makeFallbackServices(books) {
  const project = c => ({
    id: c.id, name: c.name, aliases: c.aliases, tier: c.tier, importance: c.importance,
    oneLiner: c.oneLiner, faction: c.faction, generation: c.generation, identity: c.identity,
    cultivation: c.cultivation, mentions: c.mentions, chapterCount: c.chapterCount, seal: c.seal,
    firstChapter: c.firstChapter, lastChapter: c.lastChapter, status: c.status, portrait: c.portrait, oneLinerSafe: c.oneLinerSafe,
  });
  const findBook = id => books.find(b => b.id === id);
  return {
    getBooks: () => books.map(b => ({
      id: b.id, title: b.title, author: b.author, summary: b.summary, chapters: b.chapterCount,
      stats: { total: b.characters.length }, factions: b.factions, generations: b.generations,
    })),
    search: (id, kw) => {
      const book = findBook(id); if (!book) return [];
      const k = (kw || '').trim().toLowerCase();
      if (!k) return book.characters.slice(0, 50).map(project);
      const hits = [];
      for (const c of book.characters) {
        let score = 0;
        if (c.name.toLowerCase().includes(k)) score = 100;
        else if ((c.aliases || []).some(a => a.toLowerCase().includes(k))) score = 80;
        else if ((c.pinyin || '').includes(k)) score = 60;
        else if ((c.oneLiner || '').includes(kw)) score = 30;
        if (score) hits.push([score + Math.min(c.mentions || 0, 3000) / 300, c]);
      }
      hits.sort((a, b) => b[0] - a[0]);
      return hits.slice(0, 80).map(([, c]) => project(c));
    },
    getCharacter: (id, cid) => {
      const book = findBook(id);
      const c = book && book.characters.find(x => x.id === cid);
      if (!c) return null;
      const referrers = [];
      if (book) for (const o of book.characters) for (const r of o.relationships || [])
        if (r.id === cid) referrers.push({ fromId: o.id, fromName: o.name, relation: r.relation });
      const c2 = { ...project(c), persona: c.persona, relationships: c.relationships, timeline: c.timeline, evidence: c.evidence, referrers: referrers.slice(0, 30) };
      if (fallbackImages && fallbackImages.has(cid)) c2.portrait = `data/images/${cid}.png`;
      return c2;
    },
    listByFaction: (id, f) => { const b = findBook(id); return b ? b.characters.filter(c => c.faction === f).map(project) : []; },
    listByGeneration: (id, g) => { const b = findBook(id); return b ? b.characters.filter(c => c.generation === g).map(project) : []; },
    // 浏览器预览版热更新（Cache API 实现同一协议）
    async checkUpdates(manual) {
      const SERVER = 'http://127.0.0.1:8300';
      const st = JSON.parse(localStorage.getItem('updState') || '{}');
      if (!manual && st.lastCheck && Date.now() - st.lastCheck < 30 * 60000) return { updated: false, skipped: 'ttl' };
      const cc = await caches.open('novel-chars');
      let m;
      try {
        const h = st.etag ? { 'If-None-Match': st.etag } : {};
        let res = await fetch(SERVER + '/manifest.json', { headers: h, cache: 'no-store' });
        if (res.status === 304) { st.lastCheck = Date.now(); localStorage.setItem('updState', JSON.stringify(st)); return { updated: false, skipped: 'etag' }; }
        if (!res.ok) return { updated: false, skipped: 'net-' + res.status };
        m = await res.json();
        st.etag = res.headers.get('etag') || undefined;
      } catch (e) { st.lastCheck = Date.now(); localStorage.setItem('updState', JSON.stringify(st)); return { updated: false, skipped: 'offline' }; }
      st.lastCheck = Date.now();
      st.files = st.files || {};
      const added = [], changed = [];
      for (const bk of m.books || []) {
        const rec = st.files[bk.file];
        if (rec && rec.size === bk.size && rec.sha === bk.sha256) continue;
        try {
          const res = await fetch(`${SERVER}/${bk.file}?v=${bk.version}-${bk.sha256.slice(0,10)}`);
          if (!res.ok) continue;
          const buf = await res.arrayBuffer();
          // 简易 sha (FNV) 浏览器端没有 sha256 原生同步——用长度+version 校验即可满足预览
          if (buf.byteLength !== bk.size) continue;
          const j = JSON.parse(new TextDecoder().decode(buf));
          await cc.put(SERVER + '/' + bk.file, new Response(buf, { headers: { 'Content-Type': 'application/json' } }));
          st.files[bk.file] = { size: bk.size, sha: bk.sha256 };
          const cur = findBook(bk.id);
          if (cur) { changed.push(j.title); Object.assign(cur, j); } else { added.push(j.title); books.push(j); }
        } catch (e) { /* 单本失败继续 */ }
      }
      localStorage.setItem('updState', JSON.stringify(st));
      return { updated: !!(added.length || changed.length), added, changed, version: m.version };
    },
  };
}

function init() {
  const start = () => {
    state.books = services.getBooks();
    if (!state.books.length) return renderEmptyData();
    if (state.books.length === 1) return enterBook(state.books[0].id, state.books[0]);
    state.view = 'books';
    render();
  };
  if (window.services && window.services.getBooks) {
    start();
  } else if (location.protocol.startsWith('http')) {
    $main.innerHTML = '<div class="loading"><div class="spin"></div>正在加载数据…</div>';
    initBrowserFallback().then(start).catch(renderEmptyData);
  } else {
    renderEmptyData();
  }
  document.getElementById('btnHome').onclick = () => {
    state.view = state.books.length > 1 ? 'books' : 'list';
    state.filter = null;
    render();
  };
  $bookName.onclick = () => { if (state.books.length > 1) { state.view = 'books'; render(); } };
  const btnSync = document.getElementById('btnSync');
  if (btnSync) btnSync.onclick = () => runSync(true);
  setTimeout(() => runSync(false), 1200); // 启动静默检查（TTL 受控）
  bindKeys();
  setupSubInput();
}

function renderEmptyData() {
  $bookName.textContent = '小说Wiki';
  $bookMeta.textContent = '';
  $main.innerHTML = '<div class="empty">暂无书目数据<br><small>请先运行 analysis 管线生成 plugin/data/*.json</small></div>';
}

function enterBook(id, meta) {
  state.bookId = id;
  state.view = 'list'; state.keyword = ''; state.filter = null; state.current = null;
  const box = document.getElementById('searchBox'); if (box) box.value = '';
  $bookName.textContent = meta.title;
  $bookMeta.textContent = `${meta.author || ''} · ${meta.stats.total} 人物 · ${meta.chapters || '?'} 章`;
  state.factions = meta.factions || [];
  state.generations = meta.generations || [];
  render();
}

function setupSubInput() {
  // 页面内搜索框（显性操作）
  const box = document.getElementById('searchBox');
  if (box) {
    box.addEventListener('input', () => { state.keyword = box.value; state.view = 'list'; state.filter = state.keyword ? state.filter : null; render(); });
    box.addEventListener('keydown', e => { if (e.key === 'Escape') { box.value = ''; state.keyword = ''; render(); } });
  }
  if (typeof utools === 'undefined' || !utools.setSubInput) return;
  utools.setSubInput(({ text }) => {
    state.keyword = text;
    if (box && document.activeElement !== box) box.value = text;
    state.view = 'list'; render();
  }, '搜索人物名 / 别名 / 拼音');
}

function bindKeys() {
  document.addEventListener('keydown', e => {
    if (state.view !== 'list' || !state.items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      state.cursor = Math.max(0, Math.min(state.items.length - 1, state.cursor + (e.key === 'ArrowDown' ? 1 : -1)));
      const el = $main.querySelector(`.item[data-i="${state.cursor}"]`);
      $main.querySelectorAll('.item.kbd').forEach(n => n.classList.remove('kbd'));
      if (el) { el.classList.add('kbd'); el.scrollIntoView({ block: 'nearest' }); }
    } else if (e.key === 'Enter') {
      const it = state.items[state.cursor];
      if (it) openDetail(it.id);
    } else if (e.key === 'Escape' && state.view === 'detail') {
      state.view = 'list'; render();
    }
  });
}

// ---------- 渲染 ----------
function render() {
  if (state.view === 'detail') return renderDetail();
  if (state.view === 'books') return renderBooks();
  renderList();
}

function renderBooks() {
  const cards = state.books.map(b => `
    <div class="bookcard" data-id="${esc(b.id)}">
      <div class="btitle">${esc(b.title)}</div>
      <div class="bmeta">${esc(b.author || '')} · ${b.stats.total} 人物 · ${b.chapters || '?'} 章</div>
      <div class="bsum">${esc((b.summary || '').slice(0, 90))}…</div>
    </div>`).join('');
  $bookName.textContent = '小说Wiki';
  $bookMeta.textContent = `共 ${state.books.length} 部`;
  $main.innerHTML = `<div class="booklist">${cards}</div>`;
  $main.querySelectorAll('.bookcard').forEach(el => el.onclick = () => {
    const meta = state.books.find(b => b.id === el.dataset.id);
    enterBook(el.dataset.id, meta);
  });
}

function renderList() {
  if (!window.services) return renderEmptyData();
  const kw = state.keyword.trim();
  let items;
  if (state.filter) {
    items = state.filter.type === 'faction'
      ? services.listByFaction(state.bookId, state.filter.value)
      : services.listByGeneration(state.bookId, state.filter.value);
  } else {
    items = services.search(state.bookId, kw);
  }
  state.items = items; state.cursor = 0;

  const filterChips = buildFilterChips();
  const listHtml = items.length ? items.map((c, i) => `
    <div class="item" data-i="${i}" data-id="${esc(c.id)}">
      ${c.seal ? `<span class="mini-seal">${c.seal}</span>` : `<span class="tdot t${c.tier || 3}"></span>`}
      <span class="nm">${esc(c.name)}</span>
      ${(c.aliases && c.aliases.length) ? `<span class="al">${esc(c.aliases.slice(0, 3).join(' · '))}</span>` : ''}
      <span class="ol">${esc(c.oneLinerSafe || c.oneLiner || c.identity || '')}</span>
      <span class="num">${IMP_LABEL[c.importance] || ''} · ${c.chapterCount || 0}章 · ${fmtNum(c.mentions || 0)}次</span>
    </div>`).join('') : `<div class="empty">没有匹配的人物</div>`;

  $main.innerHTML = `
    <div class="filters">${filterChips}</div>
    <div class="list">${listHtml}</div>
    <div class="foot-note">${items.length} 位人物${kw ? ` · 搜索“${esc(kw)}”` : ''}</div>`;
  $main.querySelectorAll('.item').forEach(el => el.onclick = () => openDetail(el.dataset.id));
  $main.querySelectorAll('.chip[data-f]').forEach(el => el.onclick = () => {
    if (!el.dataset.f) { state.filter = null; } else {
      const [type, value] = el.dataset.f.split(':');
      state.filter = state.filter && state.filter.value === value ? null : { type, value };
    }
    render();
  });
}

function buildFilterChips() {
  const chips = ['<span class="chip' + (state.filter ? '' : ' on') + '" data-f="">全部</span>'];
  for (const g of (state.generations || []).slice(0, 20)) {
    const on = state.filter && state.filter.type === 'generation' && state.filter.value === g;
    chips.push(`<span class="chip${on ? ' on' : ''}" data-f="generation:${esc(g)}">${esc(g)}</span>`);
  }
  for (const f of (state.factions || []).slice(0, 15)) {
    const on = state.filter && state.filter.type === 'faction' && state.filter.value === f;
    chips.push(`<span class="chip${on ? ' on' : ''}" data-f="faction:${esc(f)}">${esc(f)}</span>`);
  }
  return chips.join('');
}

function openDetail(id) {
  state.current = id;
  state.view = 'detail';
  render();
}

function renderDetail() {
  const c = services.getCharacter(state.bookId, state.current);
  if (!c) { state.view = 'list'; return renderList(); }
  const sect = (title, count, bodyHtml, open) => `
    <div class="sect${open ? ' open' : ''}">
      <div class="hd"><span class="arr">▶</span>${title}${count != null ? `<span class="cnt">(${count})</span>` : ''}</div>
      <div class="bd">${bodyHtml}</div>
    </div>`;

  const relsHtml = (c.relationships || []).length ? '<div class="rels">' + c.relationships.map(r =>
    `<div class="rel"><a data-id="${esc(r.id || '')}">${esc(r.name)}</a><span class="rr">${esc(r.relation || '')}</span></div>`).join('') + '</div>'
    : '<div class="empty">暂无</div>';

  const refHtml = (c.referrers || []).length ? '<div class="rels">' + c.referrers.map(r =>
    `<div class="rel"><a data-id="${esc(r.fromId)}">${esc(r.fromName)}</a><span class="rr">视TA为：${esc(r.relation)}</span></div>`).join('') + '</div>' : '';

  const tlHtml = (c.timeline || []).length ? '<div class="tl">' + c.timeline.map(t =>
    `<div class="ev"><span class="ch">第${t.chapter}章</span><div class="tx">${esc(t.event)}</div></div>`).join('') + '</div>' : '<div class="empty">暂无</div>';

  const evHtml = (c.evidence || []).length ? c.evidence.map(e => `<blockquote>${esc(e)}</blockquote>`).join('') : '<div class="empty">暂无</div>';
  const noteHtml = c.persona ? [
    c.persona.appearance && `<p><b>外貌</b>　${esc(c.persona.appearance)}</p>`,
    c.persona.personality && `<p><b>性格</b>　${esc((c.persona.personality || []).join(' · '))}</p>`,
    c.persona.motivation && `<p><b>动机</b>　${esc(c.persona.motivation)}</p>`,
    c.persona.arc && `<p><b>轨迹</b>　${esc(c.persona.arc)}</p>`,
  ].filter(Boolean).join('') : '';

  $main.innerHTML = `
    <span class="back">← 返回列表</span>
    <div class="detail">
      <div class="detail-top">
        ${c.portrait ? `<img class="portrait" src="${esc(c.portrait)}" alt="${esc(c.name)}" onerror="this.remove()">` : (c.seal ? `<div class="portrait seal-avatar">${c.seal}</div>` : '')}
        <div style="flex:1;min-width:0;">
          <h1>${esc(c.name)}
            ${(c.aliases || []).length ? `<span class="al">${esc(c.aliases.slice(0, 5).join(' · '))}</span>` : ''}
            <span class="badge purple">${TIER_LABEL[c.tier] || '次要'}</span>
            ${c.status ? `<span class="badge gray">${esc(c.status)}</span>` : ''}
          </h1>
          <div class="oneliner">${esc(c.oneLiner || '')}</div>
          <div class="kv">
            ${c.gender ? `<span><b>性别</b>${esc(c.gender)}</span>` : ''}
            ${c.identity ? `<span><b>身份</b>${esc(c.identity)}</span>` : ''}
            ${c.faction ? `<span><b>势力</b>${esc(c.faction)}</span>` : ''}
            ${c.generation ? `<span><b>世代</b>${esc(c.generation)}</span>` : ''}
            ${c.cultivation ? `<span><b>修为</b>${esc(c.cultivation)}</span>` : ''}
            ${c.firstChapter ? `<span><b>出场</b>第${c.firstChapter}章</span>` : ''}
            ${c.lastChapter ? `<span><b>至</b>第${c.lastChapter}章</span>` : ''}
            <span><b>提及</b>${fmtNum(c.mentions || 0)}次 / ${c.chapterCount || 0}章</span>
          </div>
        </div>
      </div>
      ${sect('人物侧写', null, noteHtml || '<div class="empty">暂无</div>')}
      ${sect('关系网', (c.relationships || []).length, relsHtml, true)}
      ${refHtml ? sect('被指向', c.referrers.length, refHtml) : ''}
      ${sect('剧情线', (c.timeline || []).length, tlHtml)}
      ${sect('原文摘录', (c.evidence || []).length, evHtml)}
    </div>`;
  $main.querySelector('.back').onclick = () => { state.view = 'list'; render(); };
  $main.querySelectorAll('.rel a[data-id]').forEach(el => el.onclick = () => {
    if (el.dataset.id) openDetail(el.dataset.id);
  });
  $main.querySelectorAll('.sect > .hd').forEach(hd => hd.onclick = () => hd.parentElement.classList.toggle('open'));
  $main.scrollTop = 0;
}

function fmtNum(n) { return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n); }

// uTools 事件
if (typeof utools !== 'undefined') {
  utools.onPluginEnter(({ code, type, payload }) => {
    if (type === 'over') { state.keyword = payload || ''; }
    setupSubInput();
    state.view = state.books.length > 1 && !state.keyword ? 'books' : 'list';
    render();
  });
}
