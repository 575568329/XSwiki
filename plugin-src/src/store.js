// 全局响应式状态：书目/Tab/搜索/阅读进度/防剧透 —— 一处修改，全 App 联动
import { reactive, computed } from 'vue';
import { svc } from './api';

export const store = reactive({
  loaded: false,
  books: [],
  bookId: null,
  view: 'home', // 'home'=书架首页 | 'book'=进入某本书
  tab: 'list',
  kw: '',
  detailId: null,
  lightboxSrc: null,
  promptView: null, // {name, text} 立绘生成提示词弹窗（CharacterCard 角标触发）
  // 阅读设置（按书持久化）
  spoiler: true,
  progress: 0,
  showPortrait: true, // 立绘已恢复（2026-10-23 首批 7 张成名场景/立绘上线）：有图的卡片显示图，无图走印章降级；齿轮有开关
});

export const book = computed(() => store.books.find(b => b.id === store.bookId) || null);
export const isSp = ch => store.spoiler && ch > store.progress;

export function openBook(id) {
  if (store.bookId !== id) { store.bookId = id; loadSettings(); }
  store.tab = 'list';
  store.view = 'book';
}
export function goHome() { store.view = 'home'; store.detailId = null; }

export function persistSettings() {
  try {
    localStorage.setItem(`cq.${store.bookId}.spoiler`, JSON.stringify(store.spoiler));
    localStorage.setItem(`cq.${store.bookId}.progress`, String(store.progress));
  } catch {}
}
export function loadSettings() {
  try {
    store.spoiler = JSON.parse(localStorage.getItem(`cq.${store.bookId}.spoiler`) ?? 'true');
    store.progress = +(localStorage.getItem(`cq.${store.bookId}.progress`) || 0);
  } catch {}
}

export async function boot() {
  await svc.init();
  store.books = svc.get().getBooks();
  if (store.books.length) {
    const keep = store.books.find(b => b.id === store.bookId);
    store.bookId = (keep || store.books[0]).id;
    loadSettings();
  }
  store.loaded = true;
}
