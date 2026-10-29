<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { store, book, boot, persistSettings } from './store';
import { svc } from './api';
import CharacterList from './components/CharacterList.vue';
import Icon from './components/Icon.vue';
import CharacterCard from './components/CharacterCard.vue';
import FamilyTable from './components/FamilyTable.vue';
import FactionGrid from './components/FactionGrid.vue';
import SystemLadder from './components/SystemLadder.vue';
import BookShelf from './components/BookShelf.vue';
import { openBook, goHome } from './store';

const gearOpen = ref(false);
const bookOpen = ref(false);
const syncing = ref(false);
async function runSync() {
  if (syncing.value) return;
  syncing.value = true;
  try {
    const r = await svc.get().checkUpdates(true);
    if (r && r.updated) {
      store.books = svc.get().getBooks();
      const names = [...(r.added||[]), ...(r.changed||[])];
      toast('数据已更新：' + names.slice(0,3).join('、') + (names.length>3?' 等':''));
      store.detailId = null;
    } else {
      toast((r && r.skipped === 'offline') ? '服务器不可达，已用本地数据' : '已是最新数据');
    }
  } catch (e) { toast('检查失败'); }
  finally { syncing.value = false; }
}
const toastMsg = ref('');
let toastTimer = null;
function toast(msg) { toastMsg.value = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => toastMsg.value = '', 1800); }
window.__toast = toast;

// 复制立绘档案文本：uTools 用 utools.copyText，浏览器走 clipboard API，再兜底 execCommand
const pmTab = ref('prompt');
const pmIsArchive = computed(() => {
  const pv = store.promptView;
  if (!pv) return false;
  if (pmTab.value === 'archive') return !!pv.archive;
  return !pv.prompt && !!pv.archive; // 只有档案时默认展示档案
});
const pmText = computed(() => {
  const pv = store.promptView;
  if (!pv) return '';
  return pmIsArchive.value ? pv.archive : (pv.prompt || '');
});
watch(() => store.promptView, () => { pmTab.value = 'prompt'; });
async function copyPrompt() {
  const t = pmText.value;
  if (!t) return;
  try {
    if (typeof utools !== 'undefined' && utools.copyText) utools.copyText(t);
    else await navigator.clipboard.writeText(t);
    toast('提示词已复制到剪贴板');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    let ok = false;
    try { ta.focus(); ta.select(); ta.setSelectionRange(0, t.length); ok = document.execCommand('copy'); } catch {}
    ta.remove();
    toast(ok ? '提示词已复制到剪贴板' : '复制失败，请手动选取文本');
  }
}

const TABS = [
  { v: 'list', label: '人物' }, { v: 'family', label: '世家' },
  { v: 'faction', label: '势力' }, { v: 'system', label: '体系' },
];
// 纵表 Tab 文案与印章字按书数据（book.familyLabel / book.sigil，gen-system 写入）
const familyLabel = computed(() => book.value?.familyLabel || '途径');
const sigil = computed(() => store.view === 'home' ? '阁' : (book.value?.sigil || '书'));
watch(() => store.view === 'home' ? 'home' : (book.value?.theme || ''), t => {
  for (const c of [...document.body.classList]) if (c.startsWith('theme-')) document.body.classList.remove(c);
  if (t) document.body.classList.add('theme-' + t);
}, { immediate: true });

function toggleSpoiler() {
  store.spoiler = !store.spoiler;
  document.body.classList.toggle('hide-spoiler', store.spoiler);
  persistSettings();
}
// 显性搜索按钮：跳到人物列表（输入框已有过滤逻辑），空词时只聚焦输入框
function doSearch() {
  if (store.kw.trim()) store.tab = 'list';
  document.getElementById('searchBox')?.focus();
}
function setProgress(e) {
  store.progress = Math.max(0, Math.min(book.value?.chapters || 1604, parseInt(e.target.value) || 0));
  persistSettings();
  toast('阅读进度已设为第 ' + store.progress + ' 章');
}

onMounted(async () => {
  await boot();
  document.body.classList.toggle('hide-spoiler', store.spoiler);
  document.addEventListener('click', e => { if (!e.target.closest('#gearPop') && !e.target.closest('#gearBtn')) gearOpen.value = false; if (!e.target.closest('#bookPop') && !e.target.closest('#bookName')) bookOpen.value = false; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (store.promptView) store.promptView = null;
      else if (store.lightboxSrc) store.lightboxSrc = null;
      else if (store.detailId) store.detailId = null;
    }
  });
  // 启动静默热更新检查（TTL 受控）
  if (svc.get().checkUpdates) setTimeout(async () => {
    try {
      const r = await svc.get().checkUpdates(false);
      if (r && r.updated) { store.books = svc.get().getBooks(); toast('人物库已更新'); }
    } catch (e) {}
  }, 1500);
  // uTools 子输入框
  if (typeof utools !== 'undefined' && utools.setSubInput) {
    utools.setSubInput(({ text }) => { store.kw = text; store.tab = 'list'; }, '搜索人物名 / 别名 / 拼音');
    utools.onPluginEnter(({ payload }) => {
      if (payload) { store.kw = String(payload); store.tab = 'list'; }
    });
  }
});
watch(() => store.spoiler, v => document.body.classList.toggle('hide-spoiler', v));
</script>

<template>
  <header>
    <div class="mirror-sigil">{{ sigil }}</div>
    <span id="bookName" @click="store.view === 'book' && (bookOpen = !bookOpen)">{{ store.view === 'home' ? '小说Wiki' : (book ? book.title : '加载中…') }}<span v-if="store.view === 'book' && store.books.length > 1" class="caret"><Icon name="chevron-down" :size="11"/></span></span>
    <div v-if="bookOpen && store.view === 'book'" id="bookPop">
      <div v-for="b in store.books" :key="b.id" class="bk-item" :class="{on: b.id === store.bookId}" @click="openBook(b.id); bookOpen = false">{{ b.title }} · {{ b.stats.total }}人</div>
    </div>
    <nav v-if="store.view === 'book'" class="tabs">
      <div v-for="t in TABS" :key="t.v" class="tab" :class="{ on: store.tab === t.v }" @click="store.tab = t.v">{{ t.v === 'family' ? familyLabel : t.label }}</div>
    </nav>
    <template v-if="store.view === 'book'">
      <input id="searchBox" v-model="store.kw" type="text" placeholder="搜索人物 / 别名 / 拼音…">
      <button id="searchBtn" title="搜索" @click="doSearch"><Icon name="search" :size="15"/></button>
    </template>
    <button v-if="store.view === 'book'" id="homeBtn" title="返回书架" @click="goHome"><Icon name="home" :size="15"/></button>
    <button id="syncBtn" :class="{ busy: syncing }" title="检查数据更新" @click="runSync"><Icon name="refresh" :size="15"/></button>
    <button id="gearBtn" title="阅读设置" @click.stop="gearOpen = !gearOpen"><Icon name="settings" :size="15"/></button>
    <div v-if="gearOpen" id="gearPop">
      <h4>阅读设置</h4>
      <div class="row"><span class="switch" :class="{ on: store.spoiler }" @click="toggleSpoiler"></span> 防剧透模式</div>
      <div class="row"><span class="switch" :class="{ on: store.showPortrait }" @click="store.showPortrait = !store.showPortrait"></span> 显示人物立绘</div>
      <div class="row">我读到第 <input type="number" min="0" :max="book?.chapters || 1604" :value="store.progress" @change="setProgress"> 章
        <span style="color:var(--faint)">(0=未设置)</span></div>
      <div class="row" style="margin:0">剧透内容按此进度打码，修改后即时生效</div>
    </div>
  </header>

  <div id="main">
    <div v-if="store.view === 'home'" class="view on"><BookShelf /></div>
    <template v-else>
      <div class="view" :class="{ on: store.tab === 'list' }"><CharacterList /></div>
      <div class="view" :class="{ on: store.tab === 'family' }"><FamilyTable /></div>
      <div class="view" :class="{ on: store.tab === 'faction' }"><FactionGrid /></div>
      <div class="view" :class="{ on: store.tab === 'system' }"><SystemLadder /></div>
    </template>
  </div>

  <CharacterCard v-if="store.detailId" />
  <div v-if="store.lightboxSrc" id="lightbox" @click="store.lightboxSrc = null"><img :src="store.lightboxSrc"></div>
  <div v-if="store.promptView" id="promptModal" @click.self="store.promptView = null">
    <div class="pm-box">
      <div class="pm-hd">立绘档案<span class="pm-name">{{ store.promptView.name }}</span><span class="pm-x" title="关闭" @click="store.promptView = null"><Icon name="x" :size="13"/></span></div>
      <div v-if="store.promptView.prompt && store.promptView.archive" class="pm-tabs">
        <span :class="{ on: pmTab === 'prompt' }" @click="pmTab = 'prompt'">生成提示词</span>
        <span :class="{ on: pmTab === 'archive' }" @click="pmTab = 'archive'">着装档案</span>
      </div>
      <pre class="pm-body" :class="{ md: pmIsArchive }">{{ pmText }}</pre>
      <div class="pm-ft">
        <span>{{ pmIsArchive ? '生图人物依据 · 按原文逐条标注章号' : '生图模型收到的完整提示词 · 独立盲审过审版' }}</span>
        <button @click="copyPrompt">复制当前页</button>
      </div>
    </div>
  </div>
  <div id="toast" :class="{ on: toastMsg }">{{ toastMsg }}</div>
</template>
