<template>
  <svg class="ic" :width="size" :height="size" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" v-html="ICONS[name]"></svg>
</template>

<script setup>
// Tabler Icons 展示壳：path 数据来自 lib/icons.js（构建期内嵌，离线可用），
// 线条粗细/颜色走 CSS（.ic），不写死 stroke-width 属性，便于主题统一定笔。
import { ICONS } from '../lib/icons.js';

defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 15 },
});
</script>
