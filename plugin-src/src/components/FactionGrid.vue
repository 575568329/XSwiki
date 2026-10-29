<script setup>
import { ref, watch } from 'vue';
import { store } from '../store';
import { svc } from '../api';
import { facHueByName } from '../helpers';

const factions = ref([]);
watch(() => store.bookId, async () => {
  await svc.init();
  if (!store.bookId) return;
  factions.value = svc.get().getMeta(store.bookId).factions || [];

}, { immediate: true });
const isSp = s => store.spoiler && s > store.progress;
</script>

<template>
  <div>
    <div v-if="!factions.length" style="margin:40px 0;text-align:center;color:var(--gray);font-size:var(--fs-cap)">
      暂无势力实体数据
    </div>
    <div class="fac-grid">
      <div v-for="f in factions" :key="f.id" class="fac-card" :style="{ '--fc': facHueByName(f.name) }">
        <h3>{{ f.name }} <span class="stance" :class="'st-' + f.stance">{{ f.stanceTxt }}</span></h3>
        <div class="fo">{{ f.one }}</div>
        <div v-if="f.stages && f.stages.length" class="fac-stg">
          <div v-for="st in f.stages" :key="st.title" class="fs-row">
            <span class="fs-ch">{{ st.s }}-{{ st.e }}</span>
            <span :class="{ sp: isSp(st.s) }" @click.stop="store.spoiler && $event.target.classList.toggle('reveal')">
              <span class="fs-t">{{ st.title }}</span> · {{ st.sit }}</span>
          </div>
        </div>
        <div class="fac-core" v-if="f.core && f.core.length">
          <span v-for="n in f.core" :key="n" class="rep-chip" @click.stop="store.kw = n; store.tab = 'list'">{{ n }}</span>
        </div>
        <div class="fm">成员 <b>{{ f.members }}</b> 人</div>
      </div>
    </div>
  </div>
</template>
