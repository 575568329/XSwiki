<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { store, isSp } from '../store';
import { svc } from '../api';
import { roleOf, realmCls, elemAccent, facHue, relType, fmtNum } from '../helpers';
import { buildLocalGraph } from '../lib/familyGraph';

import StageBand from './StageBand.vue';
import Icon from './Icon.vue';

const c = ref(null);
const openSect = ref({ stg: true, rel: true, persona: false, tl: false, ev: false });
watch(() => store.detailId, async id => {
  c.value = id ? svc.get().getCharacter(store.bookId, id) : null;
  if (c.value) openSect.value = { stg: true, rel: true, persona: false, tl: false, ev: false };
  document.body.classList.toggle('overlay-open', !!id); // 滚动锁：overlay 打开时背景不滚
}, { immediate: true });
onUnmounted(() => document.body.classList.remove('overlay-open'));

const ea = computed(() => c.value ? elemAccent(c.value) : { c: '', g: '' });
const fc = computed(() => c.value ? facHue(c.value) : '');
const stages = computed(() => (c.value && c.value.stages) || []);
const role = computed(() => c.value ? roleOf(c.value) : ['', '']);
const rels = computed(() => (c.value && c.value.relationships || []).slice(0, 12));
const relGraph = computed(() => (c.value && rels.value.length ? buildLocalGraph(c.value) : null));

function edgePath(pts) {
  if (!pts || pts.length < 2) return '';
  const a = pts[0], b = pts[pts.length - 1];
  if (pts.length === 2 && Math.abs(a.y - b.y) < 2) return `M${a.x},${a.y} L${b.x},${b.y}`;
  let d = `M${a.x},${a.y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i], my = (p0.y + p1.y) / 2;
    d += ` C${p0.x},${my} ${p1.x},${my} ${p1.x},${p1.y}`;
  }
  return d;
}

function toggle(k) { openSect.value[k] = !openSect.value[k]; }
function openRel(id) { if (id) store.detailId = id; }
</script>

<template>
  <div v-if="c" id="detailWrap" @click.self="store.detailId = null">
    <div class="detail" :style="{ '--elem-c': ea.c, '--fac-c': fc }">
      <span class="dclose" @click="store.detailId = null"><Icon name="x" :size="14"/></span>
      <div class="detail-top">
        <div v-if="store.showPortrait" class="portrait-frame">
          <span class="pc pc1"></span><span class="pc pc2"></span>
          <img v-if="c.portrait" class="portrait" :src="c.portrait" @click="store.lightboxSrc = c.portrait">
          <span v-if="c.portrait && (c.promptText || c.archiveText)" class="pprompt" title="查看立绘生成提示词与着装档案" @click="store.promptView = { name: c.name, prompt: c.promptText, archive: c.archiveText }">立绘档案</span>
          <div v-else class="portrait-empty">{{ c.visualLine ? '立绘 · 基调待定' : '无外貌依据' }}</div>
          <div v-if="ea.g" class="portrait-cap">气韵 · {{ ea.g }}</div>
        </div>
        <div style="flex:1;min-width:0">
          <h1 class="dname">
            {{ c.name }}
            <span v-if="c.aliases && c.aliases.length" class="al">{{ c.aliases.slice(0, 4).join(' · ') }}</span>
            <span class="bdg" :class="'role-' + role[0]">{{ role[1] }}</span>
            <template v-if="c.status">
              <span class="bdg status" :class="{ sp: store.spoiler }" @click.stop="$event.target.classList.toggle('reveal')">{{ c.status }}</span>
              <span class="sp-hint">点击确认</span>
            </template>
          </h1>
          <div class="chain">
            <span v-if="c.generation" class="bdg gen">{{ c.generation }}</span>
            <span v-if="c.faction" class="bdg fac">{{ c.faction }}</span>
            <span v-if="c.cultivation" class="bdg rv">{{ c.cultivation.slice(0, 18) }}</span>
          </div>
          <div class="quick" :data-glyph="ea.g">
            <div class="q1">{{ c.oneLiner || '（速答句待 W1/W3 批次改写）' }}</div>
            <div v-if="c.toProtagonist" class="q2"><b>与主线：</b>{{ c.toProtagonist }}</div>
            <div class="q3">
              <template v-if="c.firstChapter">
                <span>首现 第{{ c.firstChapter }}章</span>
                <span :class="{ sp: isSp(c.lastChapter) }" @click.stop="store.spoiler && $event.target.classList.toggle('reveal')">最近 第{{ c.lastChapter || '?' }}章</span>
                <span>提及 {{ fmtNum(c.mentions) }}次 / {{ c.chapterCount }}章</span>
              </template>
              <template v-else>
                <span>资料丰富度 {{ fmtNum(c.mentions) }}</span>
              </template>
            </div>
          </div>
          <div class="kv">
            <span v-if="c.gender"><b>性别</b>{{ c.gender }}</span>
            <span v-if="c.identity"><b>身份</b>{{ c.identity }}</span>
            <span v-if="c.faction"><b>势力</b>{{ c.faction }}</span>
          </div>
        </div>
      </div>

      <div class="sect" :class="{ open: openSect.stg }">
        <div class="hd" @click="toggle('stg')"><span class="arr"><Icon name="chevron-right" :size="11"/></span>发展脉络
          <span class="cnt">{{ stages.length }} 阶段</span></div>
        <div class="bd">
          <StageBand v-if="stages.length" :character="c" :stages="stages" />
          <div v-else style="color:var(--sub);font-size:var(--fs-cap)">暂无阶段数据（证据不足）</div>
        </div>
      </div>

      <div class="sect" :class="{ open: openSect.rel }">
        <div class="hd" @click="toggle('rel')"><span class="arr"><Icon name="chevron-right" :size="11"/></span>关系网 <span class="cnt">{{ rels.length }}</span></div>
        <div class="bd">
          <div class="relwrap">
            <div class="relgraph">
              <svg v-if="relGraph" class="ft-svg" :viewBox="`0 0 ${relGraph.w} ${relGraph.h}`" preserveAspectRatio="xMidYMid meet">
                <path v-for="e in relGraph.edges" :key="e.id" class="redge" :class="'re-' + (e.type || 'other')" :d="edgePath(e.points)"/>
                <g v-for="n in relGraph.nodes" :key="n.id" class="fnode"
                  :class="{ me: n.kind === 'me', click: n.kind === 'rel' && n.rel.id }"
                  :transform="`translate(${n.x - n.w / 2},${n.y - n.h / 2})`"
                  @click="n.kind === 'rel' && openRel(n.rel.id)">
                  <rect :width="n.w" :height="n.h" rx="13"/>
                  <text :x="n.w / 2" :y="n.h / 2 + 4.5" text-anchor="middle">{{ n.name }}</text>
                </g>
              </svg>
              <div v-else class="rel-hint">暂无关系数据（t2 关系抽取批次产出后填充）</div>
            </div>
            <div class="rel-list">
              <div v-for="r in rels" :key="r.name" class="relrow">
                <span class="reltype" :class="'rt-' + relType(r.relation || '')[0]">{{ relType(r.relation || '')[1] }}</span>
                <a @click="openRel(r.id)">{{ r.name }}</a> <span class="rt">{{ r.relation }}</span>
              </div>
              <div v-if="!rels.length" style="color:var(--sub);font-size:var(--fs-cap)">暂无关系数据（t2 关系抽取批次产出后填充）</div>
            </div>
          </div>
        </div>
      </div>

      <div class="sect" :class="{ open: openSect.persona }">
        <div class="hd" @click="toggle('persona')"><span class="arr"><Icon name="chevron-right" :size="11"/></span>人物侧写</div>
        <div class="bd">
          <template v-if="c.persona && (c.persona.appearance || c.persona.arc)">
            <p v-if="c.persona.appearance"><b>外貌</b>　{{ c.persona.appearance }}</p>
            <p v-if="c.persona.personality && c.persona.personality.length"><b>性格</b>　{{ c.persona.personality.join(' · ') }}</p>
            <p v-if="c.persona.motivation"><b>动机</b>　{{ c.persona.motivation }}</p>
            <p v-if="c.persona.arc"><b>轨迹</b>　{{ c.persona.arc }}</p>
          </template>
          <span v-else style="color:var(--sub)">暂无</span>
        </div>
      </div>

      <div class="sect" :class="{ open: openSect.tl }">
        <div class="hd" @click="toggle('tl')"><span class="arr"><Icon name="chevron-right" :size="11"/></span>剧情线
          <span class="cnt">{{ (c.timeline || []).length }} 条 · 超出进度的已打码</span></div>
        <div class="bd">
          <div class="tl">
            <div v-for="t in c.timeline" :key="t.chapter + t.event" class="ev">
              <span class="ch">第{{ t.chapter }}章</span>
              <div class="tx" :class="{ sp: isSp(t.chapter) }" @click.stop="store.spoiler && $event.target.classList.toggle('reveal')">{{ t.event }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="sect" :class="{ open: openSect.ev }">
        <div class="hd" @click="toggle('ev')"><span class="arr"><Icon name="chevron-right" :size="11"/></span>原文摘录 <span class="cnt">{{ (c.evidence || []).length }}</span></div>
        <div class="bd"><blockquote v-for="(e, i) in c.evidence" :key="i">{{ e }}</blockquote></div>
      </div>
    </div>
  </div>
</template>
