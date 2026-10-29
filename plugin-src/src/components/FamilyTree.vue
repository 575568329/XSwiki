<script setup>
// 世家页 · 族谱图谱（P3）：整族血亲连通图。世代定层 + 夫妻三元组排布（familyGraph），
// 连线为正交折线（婚姻横柄 + 下行梳状总线）。点击人名开档案；家主锚点一键换中心。
// 数据缺直系边时给空态提示。
import { ref, computed, watch, nextTick } from 'vue';
import { store } from '../store';
import { realmCls } from '../helpers';
import { buildClanGraph, buildKinMaps } from '../lib/familyGraph';

const props = defineProps({
  characters: { type: Array, default: () => [] },
  heads: { type: Array, default: () => [] },   // 家主锚点人名
  initialFocus: { type: String, default: '' },
});

const focusName = ref(props.initialFocus || props.heads[0] || '');
const zoom = ref(1);
const scrollEl = ref(null);

const byId = computed(() => { const m = new Map(); for (const c of props.characters) m.set(c.id, c); return m; });
const focusId = computed(() => { const hit = props.characters.find(c => c.name === focusName.value); return hit ? hit.id : null; });
const graph = computed(() => (focusId.value ? buildClanGraph(props.characters, focusId.value) : null));
const hasKin = computed(() => { const m = buildKinMaps(props.characters); return m.parentsOf.size > 0 || m.spousePairs.length > 0; });

// 图宽超出容器时自动缩到适宽（放大镜可再调）；immediate：初始 graph 已就绪也要跑一次
watch(graph, async g => {
  await nextTick();
  if (!g || !scrollEl.value) return;
  const cw = scrollEl.value.clientWidth - 24;
  zoom.value = Math.min(1.1, Math.max(0.42, +(cw / g.w).toFixed(2)));
}, { immediate: true });
function setZoom(d) { zoom.value = Math.min(2, Math.max(0.35, +(zoom.value + d).toFixed(2))); }

function pathOf(pts) {
  if (!pts || pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x !== pts[i - 1].x || pts[i].y !== pts[i - 1].y) d += ` L${pts[i].x},${pts[i].y}`;
  }
  return d;
}
function nodeById(id) { return byId.value.get(id) || {}; }
</script>

<template>
  <div v-if="!hasKin" class="ft-empty">本书暂无结构化亲缘数据（直系父母/配偶边为空），仅提供字辈纵表。</div>
  <template v-else>
    <div class="ft-bar">
      <span class="ft-cap">族谱中心</span>
      <span v-for="h in heads" :key="h" class="ft-chip" :class="{ on: h === focusName }" @click="focusName = h">{{ h }}</span>
      <span class="ft-zoom">
        <button @click="setZoom(-0.15)">−</button><b>{{ Math.round(zoom * 100) }}%</b><button @click="setZoom(0.15)">＋</button>
      </span>
      <span class="ft-leg"><i class="ln"></i>血亲 <i class="un"></i>配偶联结 · 点圆点色辨境界 · 点击人名查看档案</span>
    </div>
    <div v-if="graph" ref="scrollEl" class="ft-scroll">
      <svg class="ft-svg" :width="graph.w * zoom" :height="graph.h * zoom" :viewBox="`0 0 ${graph.w} ${graph.h}`">
        <path v-for="e in graph.edges" :key="e.id" class="ft-edge" :class="{ weak: e.weak }" :d="pathOf(e.points)" />
        <circle v-for="n in graph.nodes.filter(n => n.kind === 'union')" :key="n.id" class="ft-union"
          :cx="n.x" :cy="n.y" :r="n.w / 2 + 1.5" />
        <g v-for="n in graph.nodes.filter(n => n.kind === 'char')" :key="n.id" class="ft-node"
          :class="{ faded: n.tier === 3, me: n.id === focusId }"
          :transform="`translate(${n.x - n.w / 2},${n.y - n.h / 2})`" @click="store.detailId = n.id">
          <rect class="body" :width="n.w" :height="n.h" rx="8" />
          <circle class="rvdot" :class="realmCls(nodeById(n.id))" :cx="14" :cy="n.h / 2" r="4" />
          <text class="nm" :x="24" :y="n.sub ? 16 : n.h / 2 + 4">{{ n.name }}</text>
          <text v-if="n.sub" class="sb" :x="24" :y="30">{{ n.sub }}</text>
        </g>
      </svg>
    </div>
  </template>
</template>
