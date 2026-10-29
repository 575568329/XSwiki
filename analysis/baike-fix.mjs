// 百度百科核对修正（2026-10-22，词条：玄鉴仙族/63091783 读者精校族谱）
// 在 build-data.mjs 之后运行；幂等（按字段直接覆盖）
// 修正原则：只改百科有明确记载、且与我们数据冲突/补强的字段
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'plugin', 'data', 'xuanjianxianzu.json');
const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const find = name => d.characters.find(c => c.name === name);
const SPOILER_RE = /(陨落|身死|战死|被杀|所杀|殒命|死亡|死了|坐化|兵解|败亡|同归于尽|自尽|身亡|斩杀|寿尽)/;
const safe = ol => (!ol || !SPOILER_RE.test(ol)) ? (ol || '') :
  (p => p.length ? p.slice(0, 3).join('，') : '身份信息详见人物卡')(ol.split(/，|。|；/).filter(Boolean).filter(x => !SPOILER_RE.test(x)));

const FIX = [
  // [人物, 字段, 值, 百科依据]
  ['李阙宛', 'cultivation', '紫府中期【全丹】', '李阙宛（素韫真人）：紫府中期【全丹】，原名李殊宛，青箓【明晦道弦】（旧值筑基+候神殊系roster误记，候神殊百科0次）'],
  ['李阙宛', 'identity', '李家15世阙字辈（原名李殊宛），素韫真人，坐镇大漠巫箓术算', '同上'],

  ['李清虹', 'cultivation', '紫府灵修【霄雷】（龙属之雷）', '李清虹：紫府灵修【霄雷】，龙属之雷，师费望白（我们旧值"仙基玄雷泊"系他人仙基误记）'],
  ['李清虹', 'identity', '李家雷修（11世清字辈），师承费望白，仙基【霄雷】为龙属之雷', '同上'],
  ['李承辽', 'status', '陨落（突破筑基失败身死）', '李承辽：练气九层，子李周巍，突破筑基失败身死'],
  ['李承辽', 'cultivation', '练气九层', '同上'],
  ['李渊蛟', 'status', '陨落（蜃镜洞天被唐摄都斩杀）', '李渊蛟：筑基中期【泾龙王】，被唐摄都斩杀于蜃镜洞天'],
  ['李渊蛟', 'cultivation', '筑基中期【泾龙王】', '同上'],
  ['李曦峻', 'status', '在世（被屠龙蹇委托濮羽秘密救活）', '李曦峻/阜玄子：疑似紫府【寒炁】，被屠龙蹇委托濮羽秘密救活'],
  ['李曦峻', 'cultivation', '疑似紫府【寒炁】', '同上'],
  ['萧归鸾', 'status', '陨落（突破筑基失败身死）', '萧归鸾：练气九层，突破筑基失败身死'],
  ['萧归鸾', 'cultivation', '练气九层', '同上'],
  ['李玄宣', 'cultivation', '练气九层（玉京轮）', '李玄宣：练气九层，灰箓【持盈保泰】，寿尽'],
  ['李玄宣', 'status', '寿尽', '同上'],
  ['李绛迁', 'status', '陨落（死于李周巍，真灵被陆江仙藏下）', '李绛迁：死于李周巍，真灵被陆江仙藏下'],
  ['安鹧宇', 'status', '陨落（死于安鹧言/李通崖）', '安鹧宇：郁家傀儡，死于安鹧言/李通崖'],
  ['李渊修', 'status', '陨落（死于郁慕元）', '李渊修：承明轮，死于郁慕元/郁家江客卿'],
  ['李玄锋', 'status', '坐化（第一次南北大战戮尽十八法师后油尽灯枯）', '李玄锋：第一次南北大战…油尽灯枯，在望月湖坐化'],
  ['杨锐仪', 'cultivation', '紫府后期【上巫】', '杨锐仪（麓韬真人）：紫府后期【上巫】，父杨功曹，大将军'],
  ['李周巍', 'cultivation', '紫府后期【明阳】', '李周巍（明煌真人）：紫府后期【明阳】，枢阳命数，青箓【明璋日月】'],
  ['李曦明', 'cultivation', '紫府中期【明阳】', '李曦明（昭景/谷风真人）：紫府中期【明阳】，江南第一丹师'],
];
let n = 0, miss = [];
for (const [name, k, v] of FIX) {
  const c = find(name);
  if (!c) { miss.push(name); continue; }
  c[k] = v;
  if (k === 'oneLiner') c.oneLinerSafe = safe(v);
  n++;
}
// 势力补漏（族谱核对）
const FAC_FIX = [['乔文鎏','青池宗乔文鎏：紫府后期【少阴】，徒李绛淳（客卿，势力标青池宗）']];
for (const [name, v] of FAC_FIX) { const c = find(name); if (c) { c.faction = '青池宗'; c.identity = (c.identity ? c.identity + '；' : '') + v; n++; } }
// 尹歆雨补入李曦明关系
const xm2 = find('李曦明');
if (xm2 && !(xm2.relationships||[]).find(r=>r.name==='尹歆雨')) {
  xm2.relationships = [...(xm2.relationships||[]), { name:'尹歆雨', relation:'双修道友（况雨真人，紫府前期【修越】）', id: (find('尹歆雨')||{}).id || '' }];
  n++;
}
// identity 类补强
const ID = [
  ['陆江仙', '青玄主，月华元府府主，玄谙真君（器灵之身，至少仙君）', '陆江仙：青玄主，月华元府府主，玄谙真君，境界至少仙君'],
  ['陈冬河', '陈二牛四子，李景恬之夫，李家陈氏元老（筑基前期【浩瀚海】）', '陈冬河：筑基前期【浩瀚海】，陈二牛四子，妻李景恬'],
  ['李尺泾', '李家九世（伯仲叔季之季），青池宗青穗峰剑修，司元白七弟子，"小剑仙"', '李尺泾：筑基前期【湖月秋】，剑仙【明月听合玄阙秋光剑】，司元白七弟子'],
];
for (const [name, v] of ID) { const c = find(name); if (c) { c.identity = v; n++; } else miss.push(name); }
// 关系修正: 李曦明 ↔ 萧元思 是师父不是师姐
const xm = find('李曦明');
if (xm) {
  const r0 = (xm.relationships || []).find(r => r.name === '萧元思');
  if (r0) { r0.relation = '师父（青池宗萧元思，传其丹道，百科：徒李曦明）'; n++; }
}
// 汀兰补本名别名
const tl = find('汀兰');
if (tl && !(tl.aliases || []).includes('易殊袖')) { tl.aliases = [...(tl.aliases || []), '易殊袖']; n++; }

fs.writeFileSync(FILE, JSON.stringify(d));
console.log(`百科修正: ${n} 处${miss.length ? '（未命中: ' + miss.join(',') + '）' : ''}`);
