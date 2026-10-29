<script setup>
// 体系页 · 通用渲染器：结构完全由书目数据 systemPage v2 驱动（analysis/gen-system.mjs 生成），
// 每本书一套 theme 类（.theme-xianzu / .theme-guimi…）接各书强调色，换书零组件改动。
//   ladder       主阶梯（realms 低→高）
//   extraLadders 独立体系（玄鉴释修六阶等，各自成节）
//   codex        图鉴（仙基/途径；entries 预解析 seqs 徽章）
// v1 旧数据（顶层 realms/xianji）走适配器兜底，热更新旧包不至于白屏。
import { computed } from 'vue';
import Icon from './Icon.vue';
import { store } from '../store';
import { svc } from '../api';

// v1 兼容：desc 含 → 时拆为小徽章流（v2 数据已在生成侧预解析）
function parseSeq(desc) {
  if (!desc) return null;
  const parts = String(desc).split('→').map(s => s.trim()).filter(Boolean);
  if (parts.length < 4) return null;
  return parts.map(p => {
    const m = p.match(/^序列\s*(\d+)\s*(.*)$/);
    return m ? { n: m[1], name: m[2] || '' } : { n: '', name: p };
  });
}

const sp = computed(() => {
  const raw = svc.get().getMeta(store.bookId).systemPage;
  if (!raw) return null;
  if (raw.version === 2) return raw;
  if (!Array.isArray(raw.realms)) return null;
  // v1 适配：玄鉴旧数据为高→低，其余书按低→高；释修卡若混在主阶梯里摘出为独立节
  const isXj = store.bookId === 'xuanjianxianzu';
  const all = isXj ? [...raw.realms].reverse() : raw.realms;
  const realms = all.filter(r => r.key !== 'rv-shixiu');
  const shixiu = all.filter(r => r.key === 'rv-shixiu');
  return {
    version: 1,
    theme: isXj ? 'xianzu' : 'guimi',
    ladder: { title: '境界阶梯', sub: '由低到高 · 数字为已收录人数 · 点击人名查看档案', realms },
    extraLadders: shixiu.length ? [{
      key: 'shixiu', title: '释修阶位', name: '释修（僧侣→世尊）',
      sub: '与仙修不对称的独立体系 · 同为由低到高', stages: shixiu,
    }] : [],
    codex: {
      title: isXj ? '仙基图鉴' : '途径图鉴',
      sub: isXj ? '已证实的仙基种类与首位证得者' : '非凡途径 · 序列 9 → 0 完整阶梯',
      entries: (raw.xianji || []).map(x => ({ ...x, seqs: parseSeq(x.desc) })),
    },
  };
});

// 每节阶梯统一为 { key, title, sub, stages }
const ladders = computed(() => {
  if (!sp.value) return [];
  const out = [{ key: 'main', title: sp.value.ladder.title, sub: sp.value.ladder.sub, stages: sp.value.ladder.realms }];
  for (const xl of sp.value.extraLadders || []) {
    out.push({ key: xl.key, title: xl.title || xl.name, sub: xl.sub || '', stages: xl.stages });
  }
  return out;
});

// 点击人名：名字→id 直开档案；未收录者退回搜索列表
const idByName = computed(() => {
  const m = new Map();
  for (const c of svc.get().allCharacters(store.bookId)) m.set(c.name, c.id);
  return m;
});
function openPerson(raw) {
  const name = String(raw || '').replace(/\([^)]*\)$/, '').trim();
  const id = idByName.value.get(name);
  if (id) { store.detailId = id; return; }
  store.kw = name;
  store.tab = 'list';
}
</script>

<template>
  <div v-if="!sp" class="loading"><div class="spin"></div>加载体系数据…</div>
  <div v-else class="sys-wrap" :class="'theme-' + (sp.theme || 'xianzu')">
    <section v-for="lad in ladders" :key="lad.key">
      <div class="sys-block-head">
        <h3>{{ lad.title }}</h3>
        <span class="sd">{{ lad.sub }}</span>
      </div>
      <div class="ladder-h">
        <div v-for="r in lad.stages" :key="r.key" class="rung2" :class="{ empty: !r.count }" :style="{ '--rc': `var(${r.key})` }">
          <span class="r2-arrow"><Icon name="chevron-right" :size="12"/></span>
          <div class="r2-name"><span class="r2-dot"></span>{{ r.name }}</div>
          <div class="r2-count">{{ r.count }}<small>人</small></div>
          <div class="r2-reps">
            <span v-for="p in r.reps.slice(0, 3)" :key="p" class="rep-chip" @click="openPerson(p)">{{ p }}</span>
            <span v-if="!r.reps.length" style="font-size:11px;color:var(--faint)">暂无代表</span>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="sys-block-head">
        <h3>{{ sp.codex.title }}</h3>
        <span class="sd">{{ sp.codex.sub }}</span>
      </div>
      <div class="xj-grid2">
        <div v-for="x in sp.codex.entries" :key="x.name" class="xj-card">
          <div class="xj-hd">
            <span class="xj-name">{{ x.name }}</span>
            <span v-if="x.member" class="xj-member" :title="x.member" @click="openPerson(x.member)">{{ x.member }}</span>
          </div>
          <div v-if="x.seqs" class="seq-chips">
            <span v-for="(s, i) in x.seqs" :key="i" class="seq-chip" :class="{ top: s.n === '0' }">
              <b v-if="s.n">{{ s.n }}</b>{{ s.name }}
            </span>
          </div>
          <div v-else class="xj-desc">{{ x.desc }}</div>
        </div>
      </div>
    </section>
  </div>
</template>
