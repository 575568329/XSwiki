// 探针：用 gen-system.mjs 的 realmOf 口径取出释修组，看其位阶表述分布
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('D:/cursorObject/小说Wiki/plugin/data/xuanjianxianzu.json', 'utf8'));

function realmOf(c) {
  const strict = [c.cultivation || '', c.identity || ''].join(' ');
  const stageRv = (c.stages || []).map(s => s.cultivationAt || '').join(' ');
  const loose = stageRv + ' ' + (c.rosterNotes || []).map(n => n.note).join(' ');
  if (c.name === '陆江仙') return 'rv-immortal';
  if (/(仙人|仙君)/.test(strict)) return 'rv-immortal';
  if (/道胎/.test(strict)) return 'rv-daotai';
  if (/(真君|玄君)/.test(strict) || /(金丹|金性|大真人)/.test(strict + ' ' + stageRv)) return 'rv-jindan';
  if (/紫府/.test(strict + ' ' + stageRv)) return 'rv-zifu';
  if (/筑基/.test(strict + ' ' + stageRv)) return 'rv-foundation';
  if (/练气/.test(strict + ' ' + stageRv)) return 'rv-lianqi';
  if (/胎息|灵初轮|玉京轮|青元轮|周行轮|承明轮|玄景轮/.test(strict + ' ' + stageRv)) return 'rv-taixi';
  if (/释修|摩诃|世尊|僧侣|和尚|法师|怜愍位/.test(loose) && !/(紫府|筑基|练气|胎息)[一二三四五六七八九十]*层|[筑紫][基府](初期|中期|后期|巅峰)/.test(loose)) return 'rv-shixiu';
  if (/(紫府|筑基|胎息|练气)[一二三四五六七八九十]?层|[筑紫][基府](初期|中期|后期|巅峰)/.test(loose)) {
    if (/紫府/.test(loose)) return 'rv-zifu';
    if (/筑基/.test(loose)) return 'rv-foundation';
    if (/胎息|轮/.test(loose)) return 'rv-taixi';
    return 'rv-lianqi';
  }
  if (/凡人/.test(strict)) return 'rv-mortal';
  if (/(释修|僧侣|和尚|僧人|法师|摩诃|法相|世尊)/.test(c.identity || '') || /(摩诃|法相|世尊|怜愍位)/.test(c.cultivation || '')) return 'rv-shixiu';
  return null;
}

const monks = data.characters.filter(c => realmOf(c) === 'rv-shixiu');
console.log('释修组:', monks.length, '人\n');
for (const c of monks) {
  const notes = (c.rosterNotes || []).map(n => n.note).join(' │ ').slice(0, 60);
  console.log(c.name.padEnd(6), '| cultivation:', (c.cultivation || '∅').slice(0, 30).padEnd(32), '| identity:', (c.identity || '∅').slice(0, 14).padEnd(16), '|', notes);
}
