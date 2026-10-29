// services 桥接层：uTools 用 preload（Node fs），浏览器/dev 用 fetch 降级 —— 两环境同一套调用
let impl = null;

async function makeFallback() {
  let files;
  try { files = await (await fetch('data/index.json')).json(); }
  catch { files = ['data/xuanjianxianzu.json']; }
  const books = [];
  for (const f of files) {
    try { books.push(await (await fetch(f.startsWith('data/') ? f : 'data/' + f)).json()); } catch {}
  }
  if (!books.length) throw new Error('no data');
  let images = [];
  try { images = await (await fetch('data/images.json')).json(); } catch {}
  const imgSet = new Set(images);
  let prompts = {};
  try { prompts = await (await fetch('data/prompts.json')).json(); } catch {}
  let archives = {};
  try { archives = await (await fetch('data/archives.json')).json(); } catch {}
  const project = c => ({
    id: c.id, name: c.name, aliases: c.aliases, tier: c.tier, importance: c.importance,
    oneLiner: c.oneLiner, faction: c.faction, generation: c.generation, identity: c.identity,
    cultivation: c.cultivation, mentions: c.mentions, chapterCount: c.chapterCount,
    firstChapter: c.firstChapter, lastChapter: c.lastChapter, status: c.status,
    toProtagonist: c.toProtagonist, visualLine: c.visualLine, role: c.role, stages: c.stages,
    seal: c.seal, oneLinerSafe: c.oneLinerSafe,
  });
  const findBook = id => books.find(b => b.id === id);
  return {
    getBooks: () => books.map(b => ({
      id: b.id, title: b.title, author: b.author, summary: b.summary, chapters: b.chapterCount,
      theme: b.theme, sigil: b.sigil, familyLabel: b.familyLabel, updatedAt: b.updatedAt,
      stats: { total: b.characters.length, tiers: b.stats?.tiers || {} }, factions: b.factions, generations: b.generations,
    })),
    search: (id, kw) => {
      const bk = findBook(id); if (!bk) return [];
      const k = (kw || '').trim().toLowerCase();
      if (!k) return bk.characters.slice(0, 50).map(project);
      const hits = [];
      for (const c of bk.characters) {
        let score = 0;
        if (c.name.toLowerCase().includes(k)) score = 100;
        else if ((c.aliases || []).some(a => a.toLowerCase().includes(k))) score = 80;
        else if ((c.pinyin || '').includes(k)) score = 60;
        else if ((c.oneLiner || '').includes(kw.trim())) score = 30;
        if (score) hits.push([score + Math.min(c.mentions || 0, 3000) / 300, c]);
      }
      hits.sort((a, b) => b[0] - a[0]);
      return hits.slice(0, 80).map(([, c]) => project(c));
    },
    getCharacter: (id, cid) => {
      const bk = findBook(id);
      const c = bk && bk.characters.find(x => x.id === cid);
      if (!c) return null;
      const referrers = [];
      if (bk) for (const o of bk.characters) for (const r of o.relationships || [])
        if (r.id === cid) referrers.push({ fromId: o.id, fromName: o.name, relation: r.relation });
      return { ...project(c), persona: c.persona, relationships: c.relationships, timeline: c.timeline, evidence: c.evidence, referrers: referrers.slice(0, 30), portrait: imgSet.has(cid) ? `data/images/${cid}.png` : null, promptText: prompts[cid] || null, archiveText: archives[cid] || null };
    },
    // 纵表/势力页直接读全书（浏览器侧一次性拿全量更省事）
    allCharacters: (id) => { const bk = findBook(id); return bk ? bk.characters : []; },
    getMeta: (id) => { const bk = findBook(id); return { factions: (bk && bk.factionEntities) || [], systemPage: (bk && bk.systemPage) || null }; },
    // 浏览器降级热更新（Cache API，同 preload 协议）
    async checkUpdates(manual) {
      const SERVER = 'http://127.0.0.1:8300';
      const st = JSON.parse(localStorage.getItem('updState') || '{}');
      if (!manual && st.lastCheck && Date.now() - st.lastCheck < 30 * 60000) return { updated: false, skipped: 'ttl' };
      const cc = await caches.open('novel-chars');
      let m;
      try {
        const h = st.etag ? { 'If-None-Match': st.etag } : {};
        const res = await fetch(SERVER + '/manifest.json', { headers: h, cache: 'no-store' });
        if (res.status === 304) { st.lastCheck = Date.now(); localStorage.setItem('updState', JSON.stringify(st)); return { updated: false, skipped: 'etag' }; }
        if (!res.ok) return { updated: false, skipped: 'net-' + res.status };
        m = await res.json(); st.etag = res.headers.get('etag') || undefined;
      } catch (e) { st.lastCheck = Date.now(); localStorage.setItem('updState', JSON.stringify(st)); return { updated: false, skipped: 'offline' }; }
      st.lastCheck = Date.now(); st.files = st.files || {};
      const added = [], changed = [];
      for (const bk of m.books || []) {
        const rec = st.files[bk.file];
        if (rec && rec.size === bk.size && rec.sha === bk.sha256) continue;
        try {
          const res = await fetch(SERVER + '/' + bk.file + '?v=' + bk.version + '-' + bk.sha256.slice(0, 10));
          if (!res.ok) continue;
          const buf = await res.arrayBuffer();
          if (buf.byteLength !== bk.size) continue;
          const j = JSON.parse(new TextDecoder().decode(buf));
          await cc.put(SERVER + '/' + bk.file, new Response(buf, { headers: { 'Content-Type': 'application/json' } }));
          st.files[bk.file] = { size: bk.size, sha: bk.sha256 };
          const cur = books.find(b => b.id === j.id);
          if (cur) { changed.push(j.title); Object.assign(cur, j); } else { added.push(j.title); books.push(j); }
        } catch (e) {}
      }
      localStorage.setItem('updState', JSON.stringify(st));
      return { updated: !!(added.length || changed.length), added, changed, version: m.version };
    },
  };
}

export const svc = {
  async init() {
    if (impl) return;
    if (window.services && window.services.getBooks) {
      const base = window.services;
      const all = [];
      impl = {
        getBooks: base.getBooks,
        search: base.search,
        getCharacter: base.getCharacter,
        // preload 无全量接口时退化为按势力聚合（后续在 preload 补 allCharacters）
        getMeta: base.getMeta || (() => ({ factions: [], systemPage: null })),
        checkUpdates: base.checkUpdates ? (m) => base.checkUpdates(m) : async () => ({ updated: false, skipped: 'no-server' }),
        allCharacters: base.allCharacters || ((bookId) => {
          const out = [];
          for (const f of (base.getBooks().find(b => b.id === bookId)?.factions || [])) out.push(...base.listByFaction(bookId, f));
          return out;
        }),
      };
      return;
    }
    impl = await makeFallback();
  },
  get() { return impl; },
};
