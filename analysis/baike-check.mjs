// 百科三方向核对: 世家(族谱结局) / 势力(归属) / 体系(境界+仙基) / t1角色卡字段
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bk = fs.readFileSync(path.join(__dirname, 'baike-genealogy.md'), 'utf8');
const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'plugin', 'data', 'xuanjianxianzu.json'), 'utf8'));

// ========== 一、世家：族谱条目 vs 我们的人物 ==========
const NAME_ALT = '唦摩里|公孙柏范|谯岳|燕虎|妙水|白猿|宗彦|富解|万旗|杜斗|柿儿|阿会剌|卢婉容|万天仇|木芽鹿|严筷|任屏儿|任平安|南漳库|南潭沉|池眺宗|芮琼措|陆江仙|窦氏|尹歆雨|尹觉戏|廉渥|乔文鎏|上官弥|宁婉|迟步梓|唐元乌|司元白|于羽威|袁湍|萧元思|崔决吟|费望白|张允|刘白|廉栋|陈胤|白子羽';
const gene = new RegExp(`^(李[^\\s：:（(]{1,4}|${NAME_ALT}|[田陈柳徐许丁蒲庄贺任][^\\s：:（(]{1,3})（[^）]*）：(.+)$`, 'gm');
const baike = new Map();
let m;
while ((m = gene.exec(bk))) {
  const name = m[1].trim();
  if (!baike.has(name)) baike.set(name, []);
  baike.get(name).push(m[2]);
}
console.log('== 世家族谱 ==');
console.log('百科族谱条目:', baike.size);

const SPOILER = /(被[^，。；]{1,12}(杀死|斩杀|害死|所杀|击杀|咒杀)|死于[^，。；]{1,14}|身死|自尽|已死|陨落|坐化|寿尽|油尽灯枯|同归于尽|斩杀于|而亡|咒杀|突破[^，。；]{1,8}失败身死)/;
const matched = [], mismatch = [], newInBaike = [];
for (const [name, descs] of baike) {
  const ours = d.characters.find(c => c.name === name || (c.aliases || []).includes(name));
  if (!ours) { newInBaike.push(name); continue; }
  matched.push(name);
  const bkDead = (descs.join('')).match(SPOILER);
  const ourDead = (ours.status || '') + (ours.oneLiner || '') + (ours.stages || []).map(s => s.situation || '').join('') + ((ours.rosterNotes || []).map(n => n.note).join(''));
  const ourSaysDead = /(陨落|身死|被杀|所杀|斩杀|殒命|坐化|自尽|死于|寿尽)/.test(ourDead);
  const ourSaysAlive = ours.status === '在世';
  if (bkDead && ourSaysAlive && !ourSaysDead) mismatch.push(`${name}: 百科[${bkDead[0]}] 我们标在世`);
  if (!bkDead && ours.status && /陨落/.test(ours.status) && !/救活/.test(ourDead)) mismatch.push(`${name}: 我们标陨落 百科无死亡记载`);
}
console.log(`命中我们库: ${matched.length} | 百科有而库无: ${newInBaike.length} | 结局冲突: ${mismatch.length}`);
mismatch.slice(0, 20).forEach(x => console.log('  ✗', x));
console.log('  百科新增前25:', newInBaike.slice(0, 25).join(','));

// ========== 二、势力：核心归属抽检 ==========
console.log('\n== 势力归属抽检 ==');
const SPOT = [
  ['李曦治', '青池宗', '究天阁'], ['萧元思', '青池宗', '青穗峰'], ['迟步梓', '青池宗', '步梓峰'],
  ['宁婉', '青池宗', '宗主/秋湖真人'], ['杨锐仪', '宋国/杨', '大将军'], ['李周巍', '宋国段', '魏王'],
  ['卫悬因', '赵国', '玄楼真人/国师'], ['刘长迭', '客卿', '远变真人/阵师'], ['乔文鎏', '客卿', '三疑真人'],
  ['崔决吟', '客卿', '清凤真人'], ['李乌梢', '客卿', '假紫府妖物'],
];
for (const [name, grp, hint] of SPOT) {
  const c = d.characters.find(x => x.name === name);
  const inBaike = bk.includes(name);
  const ourFac = c ? c.faction : '（无此人物）';
  const ok = c ? '✓' : '✗缺';
  console.log(`  ${ok} ${name}: 我库势力[${ourFac}] 百科组[${grp}] 百科条目${inBaike ? '有' : '无'}`);
}

// ========== 三、体系：境界阶梯 & 仙基 vs 百科【】全集 ==========
console.log('\n== 体系（境界+仙基）==');
// 百科【X】全集及出现次数
const bracket = new Map();
for (const mm of bk.matchAll(/【([^】]{2,8})】/g)) bracket.set(mm[1], (bracket.get(mm[1]) || 0) + 1);
console.log('百科【】术语数:', bracket.size);
// 我们仙基表 vs 百科
const sys = d.systemPage || { xianji: [] };
for (const x of sys.xianji || []) {
  const n = bracket.get(x.name);
  console.log(`  ${n ? '✓' : '?'} 仙基[${x.name}]→${x.member} 百科出现${n || 0}次`);
}
// 百科高频【X】而我们没收录的（>3次即重要）
const ours = new Set((sys.xianji || []).map(x => x.name));
const missing = [...bracket.entries()].filter(([k, v]) => v >= 3 && !ours.has(k) && !/^(明阳|真炁|渌水|厥阴|晞炁|庚金|离火|少阳|归土|修越|府水|玉真|戊土|宣土|库金|煞炁|邃炁|身夔|上仪|少阴|牝水|集木|寒炁)$/.test(k));
console.log('  百科高频但未入仙基表(可能为果位/箓):', missing.slice(0, 10).map(x => x[0] + '(' + x[1] + ')').join(','));

// 境界口径: 百科出现的境界词
const realmWords = ['练气', '胎息', '筑基', '紫府', '金丹', '神通', '神丹', '法相', '道胎', '仙君', '真君', '真人'];
console.log('  百科境界词出现:', realmWords.map(r => r + ':' + (bk.match(new RegExp(r, 'g')) || []).length).join(' '));
