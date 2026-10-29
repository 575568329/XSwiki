<script setup>
// 书架首页：全部书目卡片（书名/作者/简介/人物数/章节数/势力与世代数/收录时间），
// 数据来自 store.books（getBooks 汇总的书目 meta）。点卡片进入该书。
import { store, openBook } from '../store';

const fmtDate = s => { try { return String(s || '').slice(0, 10); } catch { return ''; } };
</script>

<template>
  <div class="shelf">
    <div class="shelf-head">
      <h3>书架</h3>
      <span class="sd">共 {{ store.books.length }} 部作品 · 点击书卡进入</span>
    </div>
    <div class="shelf-grid">
      <div v-for="b in store.books" :key="b.id" class="shelf-card" @click="openBook(b.id)">
        <div class="sc-top">
          <span class="sc-title">{{ b.title }}</span>
          <span class="sc-author">{{ b.author }}</span>
        </div>
        <p class="sc-summary">{{ b.summary }}</p>
        <div class="sc-stats">
          <span class="sc-num"><b>{{ b.stats.total }}</b>人物</span>
          <span class="sc-num"><b>{{ b.stats.tiers?.[1] ?? b.stats.tiers?.['1'] ?? 0 }}</b>核心</span>
          <span class="sc-num"><b>{{ b.chapters || 0 }}</b>章</span>
          <span class="sc-num"><b>{{ (b.factions || []).length }}</b>势力</span>
          <span class="sc-num"><b>{{ (b.generations || []).length }}</b>{{ b.familyLabel || '途径' }}</span>
        </div>
        <div class="sc-foot">收录至 {{ fmtDate(b.updatedAt) }}</div>
      </div>
      <div v-if="!store.books.length" class="loading"><div class="spin"></div>加载书目…</div>
    </div>
  </div>
</template>
