<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { store, book } from '../store';
import { svc } from '../api';
import { roleOf, realmCls, elemAccent, fmtNum } from '../helpers';
import Icon from './Icon.vue';

const pageSize = ref(+(localStorage.getItem('cq.pageSize') || 10));
const filter = ref(null); // {t:'gen'|'fac', v}
const page = ref(1);
const FOLD = 9; // 每个维度默认展示的 chip 数，超出折叠

const all = computed(() => {
  if (!book.value) return [];
  const k = store.kw.trim().toLowerCase();
  if (!k) return svc.get().allCharacters(store.bookId);
  return svc.get().search(store.bookId, store.kw.trim());
});
const filtered = computed(() => {
  if (!filter.value) return all.value;
  const f = filter.value;
  return all.value.filter(c => f.t === 'fac' ? c.faction === f.v : c.generation === f.v);
});
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)));
watch(() => [store.kw, filter.value, pageSize.value], () => { page.value = 1; });
watch(page, () => { const m = document.getElementById('main'); if (m) m.scrollTop = 0; });
const rows = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));

const isXj = computed(() => store.bookId === 'xuanjianxianzu');
const dimLabel = computed(() => isXj.value ? '世代' : '途径');
// chips 数据驱动：世代/途径维 + 势力维（势力名单取自势力实体卡，保证有卡可看）
const genChips = computed(() => (book.value?.generations || []).map(g =>
  isXj.value ? g.replace('李家', '').replace('（', '·').replace('）', '') : g));
const facChips = computed(() => ((book.value && svc.get().getMeta(store.bookId).factions) || [])
  .map(f => f.name).filter(n => n && n !== '神祇'));
const genFold = ref(true), facFold = ref(true);
const genShown = computed(() => genFold.value ? genChips.value.slice(0, FOLD) : genChips.value);
const facShown = computed(() => facFold.value ? facChips.value.slice(0, FOLD) : facChips.value);
watch(() => store.bookId, () => { filter.value = null; genFold.value = facFold.value = true; });

function clickChip(t, v) {
  if (!t) filter.value = null;
  else filter.value = (filter.value && filter.value.v === v) ? null : { t, v };
}

// ===== 分页器：页码省略（Ant 风格）+ 自定义条数下拉（自绘，替代原生 select）=====
const sizeOpen = ref(false);
const SIZES = [10, 30, 50, 100];
function setPageSize(n) {
  pageSize.value = n;
  localStorage.setItem('cq.pageSize', String(n));
  sizeOpen.value = false;
}
function onDocClick(e) {
  if (!e.target.closest('.pg-size')) sizeOpen.value = false;
}
onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));

// 页码序列：首尾常驻 + 当前页邻域，间隔打省略号
const pageList = computed(() => {
  const total = pages.value, cur = page.value;
  if (total <= 7) return Array.from({ length: total }, (_, i) => ({ n: i + 1, t: String(i + 1), on: i + 1 === cur }));
  const set = [...new Set([1, 2, cur - 1, cur, cur + 1, total - 1, total])]
    .filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const n of set) {
    if (n - prev > 1) out.push({ n: -prev, t: '…', gap: true });
    out.push({ n, t: String(n), on: n === cur });
    prev = n;
  }
  return out;
});
function go(n) {
  if (n < 1 || n > pages.value || n === page.value) return;
  page.value = n;
}
</script>

<template>
  <div v-if="!book" class="loading"><div class="spin"></div>加载数据…</div>
  <template v-else>
    <div class="filters">
      <span class="f-dim">{{ dimLabel }}</span>
      <span class="chip" :class="{ on: !filter }" @click="clickChip(null)">全部 {{ all.length }}</span>
      <span v-for="g in genShown" :key="g" class="chip"
        :class="{ on: filter && filter.t === 'gen' && filter.v === g }"
        @click="clickChip('gen', g)">{{ g }}</span>
      <span v-if="genChips.length > FOLD" class="chip fold" @click="genFold = !genFold">{{ genFold ? `展开 +${genChips.length - FOLD}` : '收起' }}</span>
    </div>
    <div class="filters" style="margin-top:-6px">
      <span class="f-dim">势力</span>
      <template v-if="facChips.length">
        <span v-for="f in facShown" :key="f" class="chip"
          :class="{ on: filter && filter.t === 'fac' && filter.v === f }"
          @click="clickChip('fac', f)">{{ f }}</span>
        <span v-if="facChips.length > FOLD" class="chip fold" @click="facFold = !facFold">{{ facFold ? `展开 +${facChips.length - FOLD}` : '收起' }}</span>
      </template>
      <span v-else class="f-dim" style="opacity:.6">（本卷暂无势力筛选）</span>
    </div>
    <div class="list">
      <div v-for="c in rows" :key="c.id" class="item" :style="{ '--acc': elemAccent(c).c }" @click="store.detailId = c.id">
        <span class="rvdot" :class="realmCls(c)" :title="c.cultivation || '序列未知'"></span>
        <span class="nm">{{ c.name }}</span>
        <span v-if="c.aliases && c.aliases[0]" class="al">{{ c.aliases[0] }}</span>
        <span class="bdg" :class="'role-' + roleOf(c)[0]">{{ roleOf(c)[1] }}</span>
        <span class="ol">{{ c.oneLinerSafe || c.oneLiner }}</span>
        <span class="num">{{ c.firstChapter ? '首现' + c.firstChapter + '章 · ' : '' }}{{ fmtNum(c.mentions) }}{{ c.firstChapter ? '次' : ' 资料分' }}</span>
      </div>
      <div v-if="!rows.length" class="loading">没有匹配的人物</div>
    </div>

    <div class="pager">
      <span class="pg-total">共 <b>{{ filtered.length }}</b> 人</span>
      <div class="pg-pages">
        <button class="pg-btn nav" :disabled="page <= 1" title="上一页" @click="go(page - 1)"><Icon name="chevron-left" :size="14"/></button>
        <template v-for="p in pageList" :key="p.n">
          <span v-if="p.gap" class="pg-gap">…</span>
          <button v-else class="pg-btn" :class="{ on: p.on }" @click="go(p.n)">{{ p.t }}</button>
        </template>
        <button class="pg-btn nav" :disabled="page >= pages" title="下一页" @click="go(page + 1)"><Icon name="chevron-right" :size="14"/></button>
      </div>
      <div class="pg-size">
        <button class="pg-btn size-btn" @click.stop="sizeOpen = !sizeOpen">{{ pageSize }} 条/页 <span class="caret"><Icon name="chevron-down" :size="10"/></span></button>
        <div v-if="sizeOpen" class="pg-pop">
          <div v-for="n in SIZES" :key="n" class="pg-opt" :class="{ on: n === pageSize }" @click="setPageSize(n)">{{ n }} 条 / 页</div>
        </div>
      </div>
    </div>
  </template>
</template>
