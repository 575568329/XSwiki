<script setup>
// 阶段时间带：节点按章节跨度弹性宽度、境界着色、进度游标线、剧透打码、阶段详情
// 数据 schema（cards-v2）: { id, title, chapterStart, chapterEnd, situation, cultivationAt, visual, spoiler }
import { ref, computed, watch } from 'vue';
import { store } from '../store';
import { stgColor } from '../helpers';

const props = defineProps({ character: Object, stages: Array });
const cur = ref(0);
const revealed = ref({});
watch(() => props.character, () => { revealed.value = {} }); // 换人重置：已揭示状态只对当前角色生效
const cursorPos = computed(() => store.progress > 0 ? (4 + (store.progress / 1604) * 92) : null);
const st = computed(() => props.stages[cur.value] || props.stages[0]);
const isSp = s => store.spoiler && s > store.progress;
const descSp = computed(() => isSp(st.value.chapterStart) && !revealed.value[cur.value]);
function revealDesc() { if (isSp(st.value.chapterStart)) revealed.value[cur.value] = true; }
</script>

<template>
  <div>
    <div class="band">
      <div v-if="cursorPos !== null" class="cursor-line" :style="{ left: cursorPos + '%' }"></div>
      <div class="band-track">
        <div v-for="(s, i) in stages" :key="s.id || i" class="stg"
          :class="{ sp: isSp(s.chapterStart), on: i === cur }"
          :style="{ flex: Math.max(1, (s.chapterEnd || s.chapterStart) - s.chapterStart), '--stg-c': stgColor(s) }"
          @click="cur = i">
          <div class="dot"></div>
          <div class="st">{{ s.title }}</div>
          <div class="sc">{{ s.chapterStart === s.chapterEnd ? '第' + s.chapterStart + '章' : '约' + s.chapterStart + '-' + s.chapterEnd }}</div>
        </div>
      </div>
    </div>
    <div class="stg-detail">
      <div class="tt">
        {{ st.title }}
        <span style="color:var(--faint);font-weight:400;font-size:var(--fs-cap);font-family:var(--sans)">第{{ st.chapterStart }}{{ st.chapterEnd > st.chapterStart ? '-' + st.chapterEnd : '' }}章</span>
        <span v-if="st.cultivationAt && st.cultivationAt !== '-'" class="bdg rv">{{ st.cultivationAt }}</span>
        <span v-if="isSp(st.chapterStart)" class="bdg" style="color:#a5423b;border-color:rgba(165,66,59,.3)">{{ descSp ? '进度之后 · 点击显示' : '进度之后' }}</span>
      </div>
      <div class="desc" :class="{ sp: descSp }" @click.stop="revealDesc">{{ st.situation }}</div>
      <div class="meta">
        <span v-if="st.visual">形象锚点：{{ st.visual }}</span>
      </div>
    </div>
  </div>
</template>
