<script setup>
import { computed, ref } from 'vue';
import { store, book } from '../store';
import { svc } from '../api';
import { realmCls } from '../helpers';
import FamilyTree from './FamilyTree.vue';
import { hasKinData } from '../lib/familyGraph';

// 双形态：玄鉴=世代行式纵表（从 generation 动态分组，字辈同行同世）；其他书=途径卡片分组
const XUANJIAN = 'xuanjianxianzu';
const HEADS = ['李木田', '李项平', '李玄宣', '李渊蛟', '李曦城', '李周巍'];
const isXj = computed(() => store.bookId === XUANJIAN);

// P3：族谱图谱视图（有直系/配偶结构边时才出现切换）
const view = ref('table');
const all = computed(() => book.value ? svc.get().allCharacters(store.bookId) : []);
const kin = computed(() => hasKinData(all.value));
const heads = computed(() => isXj.value ? HEADS : []);

const rows = computed(() => {
  if (!book.value) return [];
  const all = svc.get().allCharacters(store.bookId);
  if (isXj.value) {
    // 按 generation「李家N世（X字辈）」动态分组——字辈≠世代（长/项/通/尺同为9世），
    // 硬编码表会漏字辈且世数错位（百科核对结论：全谱系 7-18 世）
    const groups = new Map();
    for (const c of all) {
      const m = /李家(\d+)世（?(.)?字辈）?/.exec(c.generation || '');
      if (!m) continue;
      const key = m[1] + '|' + (m[2] || '');
      if (!groups.has(key)) groups.set(key, { gen: +m[1], zb: m[2] || '', mem: [] });
      groups.get(key).mem.push(c);
    }
    return [...groups.values()]
      .sort((a, b) => a.gen - b.gen || (a.zb < b.zb ? -1 : 1))
      .map(r => {
        r.mem.sort((a, b) => a.tier - b.tier || (b.mentions || 0) - (a.mentions || 0));
        return { key: r.gen + r.zb, label: r.zb, sub: '李家' + r.gen + '世',
          mem: r.mem.slice(0, 14), total: r.mem.length,
          main: r.mem.some(c => HEADS.includes(c.name)) };
      });
  }
  return (book.value.generations || []).map(g => {
    const mem = all.filter(c => c.generation === g);
    mem.sort((a, b) => a.tier - b.tier || (b.mentions || 0) - (a.mentions || 0));
    return { key: g, label: g, sub: g, mem, total: mem.length, main: false };
  });
});
const headTitle = computed(() => {
  if (isXj.value) return '世家族谱 · 人物分组';
  return (book.value?.familyLabel || '途径') + ' · 人物分组';
  const gens = rows.value.map(r => +(execGen(r.sub)?.[1] || 0)).filter(Boolean);
  return gens.length ? `李家 · ${Math.min(...gens)}-${Math.max(...gens)}世` : '李家族谱';
});
const execGen = s => /(\d+)世/.exec(s || '');
const headNote = computed(() => isXj.value
  ? '✦ 家主 · 圆点色 = 境界（金 = 紫府及以上）· 左缘竖线 = 家主世系'
  : '按' + (book.value?.familyLabel || '途径') + '归组 · 圆点色 = 层次 · 核心成员排前 · 点击人名查看档案');
</script>

<template>
  <div v-if="!book" class="loading"><div class="spin"></div>加载…</div>
  <template v-else>
    <div class="family-head">
      <h2>{{ headTitle }}</h2>
      <span class="cnt">{{ headNote }}</span>
      <span v-if="kin" class="ft-tabs">
        <span :class="{ on: view === 'table' }" @click="view = 'table'">字辈纵表</span>
        <span :class="{ on: view === 'tree' }" @click="view = 'tree'">族谱图谱</span>
      </span>
    </div>

    <!-- 族谱图谱（P3）：世代定层 + 夫妻三元组排布，正交连线 -->
    <FamilyTree v-if="view === 'tree' && kin" :key="store.bookId"
      :characters="all" :heads="heads" :initial-focus="isXj ? '李木田' : ''" />

    <!-- 玄鉴：字辈行式 -->
    <template v-if="isXj && view === 'table'">
      <div v-for="r in rows" :key="r.key" class="gen-row" :class="{ 'main-line': r.main }">
        <div class="gen-label"><div class="g1">{{ r.label }}</div><div class="g2">{{ r.sub }}</div></div>
        <div class="gen-members">
          <span v-for="c in r.mem" :key="c.id" class="gm" :class="{ faded: c.tier === 3 }" @click="store.detailId = c.id">
            <span class="rvdot" :class="realmCls(c)"></span>{{ c.name }}<span v-if="HEADS.includes(c.name)" class="star">✦</span>
          </span>
          <span v-if="r.total > r.mem.length" class="gm more">+{{ r.total - r.mem.length }} 人</span>
          <span v-if="!r.total" style="color:var(--faint);font-size:var(--fs-cap)">（本代成员待字辈推断补全）</span>
        </div>
      </div>
    </template>

    <!-- 其他书：途径卡片分组 -->
    <div v-else-if="view === 'table'" class="path-grid">
      <div v-for="r in rows" :key="r.key" class="path-card">
        <div class="pc-hd">
          <span class="pc-name">{{ r.label }}</span>
          <span class="pc-cnt">{{ r.total }} 人</span>
        </div>
        <div class="pc-members">
          <span v-for="c in r.mem.slice(0, 12)" :key="c.id" class="gm" :class="{ faded: c.tier === 3 }" :title="c.cultivation || ''" @click="store.detailId = c.id">
            <span class="rvdot" :class="realmCls(c)"></span>{{ c.name }}
          </span>
          <span v-if="r.total > 12" class="gm more">+{{ r.total - 12 }} 人</span>
          <span v-if="!r.total" class="pc-empty">暂无已确认成员</span>
        </div>
      </div>
    </div>
  </template>
</template>
