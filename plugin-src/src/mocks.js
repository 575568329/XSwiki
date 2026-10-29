// 演示占位数据：W1/W2/W4 批次产出前的阶段脉络/势力实体/体系统计（页面带"示例"标签）
export const MOCK_STAGES = {
  lizhouwei: [
    { id:'stg1', title:'金眸异象', s:476, e:500, sit:'襁褓中金眸盯日、暗金流彩，天生异象被定为世子', rv:'胎息', vis:'婴孩襁褓，金色瞳孔' },
    { id:'stg2', title:'修明阳道统', s:665, e:728, sit:'入明阳道统修《明华煌元经》，龙宫行事隐忍', rv:'筑基', vis:'少年武服，负长戟' },
    { id:'stg3', title:'斗战崛起', s:729, e:1028, sit:'压制管龚霄、识破渌水厥阴之谋，战功冠族', rv:'筑基后期', vis:'持戟披甲，五色离火护体' },
    { id:'stg4', title:'明阳显象', s:1029, e:1159, sit:'金眸昭昭、面上纹路渐亮，受都仙青令节制诸方', rv:'紫府', vis:'金纹浮现面颊，玄甲金戟' },
    { id:'stg5', title:'庭州负伤', s:1160, e:1397, sit:'救援庭州首中紫府霞光，金血染衣险死还生', rv:'紫府', vis:null },
    { id:'stg6', title:'北伐争鼎', s:1398, e:1604, sit:'破灵山、兵临雄关，与孔雀血裔对峙，天门明光加身', rv:'大真人', vis:'王袍金冠，天光贯身' },
  ],
  liximing: [
    { id:'stg1', title:'少年入族', s:307, e:323, sit:'首脉嫡长出生，眸子透亮身体康健，未受父亲根骨影响', rv:'-', vis:'十二三岁少年，靛青道袍' },
    { id:'stg2', title:'沉潜修行', s:324, e:695, sit:'族学修行、名字从日，多年无突破记录（素材空洞期）', rv:'练气~筑基', vis:null },
    { id:'stg3', title:'突破紫府', s:696, e:733, sit:'历时十余年突破紫府，反哺滋养仙鉴，鉴中天地大扩', rv:'紫府', vis:'憨厚中年，紫绶白袍' },
    { id:'stg4', title:'执掌大局', s:734, e:999, sit:'与都仙道邺桧周旋，天门对峙，替家族谋诸道统机缘', rv:'紫府', vis:null },
    { id:'stg5', title:'诸界周旋', s:1000, e:1604, sit:'周旋仙门诸界，暗运明阳大局，李家实际的顶梁柱', rv:'紫府后期', vis:null },
  ],
  liqinghong: [
    { id:'stg1', title:'少年雷修', s:157, e:299, sit:'入族习雷法，明媚爽朗，仙基初显', rv:'练气', vis:'红衣少女' },
    { id:'stg2', title:'玉庭护族', s:300, e:599, sit:'驻玉庭山看护教导族中晚辈，雷法精进', rv:'筑基', vis:'劲装持枪，白毫初现' },
    { id:'stg3', title:'玄雷泊真人', s:600, e:1604, sit:'凝仙基玄雷泊，雷道折寿三成而不悔，坐镇一方', rv:'紫府', vis:'端庄宗师，雷绕发梢' },
  ],
};
export const MOCK_VISUAL = {
  liqinghong: '中年女修，高挑健朗，神态端庄慈严，月白镶棕边劲装束发，琥珀色杏眼含威，眉心一缕白色长毫垂至眉下，手持素杆红缨长枪，发梢衣角隐有细碎银色电光',
  lizhouwei: '青年男修，肩宽体魁，神态睥睨沉雄，玄底金蟒纹王袍束玉冠，暗金色瞳孔中金红流光流转，负手而立',
  liximing: '十二三岁少年修士，身形清瘦，神态沉静好奇，靛青道袍束发，双目乌黑透亮有神（少年期·示例）',
};
export const MOCK_FACT = [
  { id:'lijia', name:'李家', hue:'#2f7e79', stance:'protagonist', stanceTxt:'主角家族', one:'黎泾村凡人家族拾得仙鉴后崛起的修仙世家，全书主线', members:269, core:['李曦明','李周巍','陆江仙'],
    stages:[{title:'凡人村族',s:1,e:24,sit:'黎泾村务农，拾得铜镜，儿郎入青池宗习《接引法》'},{title:'越国仙族',s:300,e:900,sit:'紫府辈出，裂越建魏，位列仙族'},{title:'北伐争鼎',s:1300,e:1604,sit:'李周巍成就大真人，北伐宋廷，与明阳道统共谋大世'}] },
  { id:'qingchizong', name:'青池宗', hue:'#4a8ba6', stance:'ally', stanceTxt:'盟友·后为附庸', one:'越国三宗之首，李家儿郎修行起点，后为李家掌控', members:38, core:['李曦治','袁湍'] },
  { id:'xiaojia', name:'萧家', hue:'#6b8f5e', stance:'ally', stanceTxt:'世交盟友', one:'望月湖畔修仙家族，萧初庭扶持李家千年', members:31, core:['萧初庭','萧归鸾'] },
  { id:'jinyuzong', name:'金羽宗', hue:'#bd8f2c', stance:'neutral', stanceTxt:'中立', one:'越国三宗之一，善御器，主峰悬符箓镇妖邪', members:9, core:[] },
  { id:'mingyang', name:'明阳道统', hue:'#c08a2d', stance:'ally', stanceTxt:'道统·渊源极深', one:'日系大道统，陆江仙暗中促成的全局，李周巍为其当代旗手', members:12, core:['李周巍'] },
  { id:'yangjia', name:'杨家', hue:'#b3423a', stance:'foe', stanceTxt:'敌对·宋廷', one:'阴司杨氏，大宋军方柱石，南北大局中李家的主要对手', members:14, core:['杨锐仪'] },
  { id:'beihuan', name:'北寰宗', hue:'#5b6b8c', stance:'foe', stanceTxt:'敌对', one:'北方大宗，与萧家暗通款曲，多次与李家冲突', members:8, core:[] },
  { id:'yuvguo', name:'越国朝廷', hue:'#8a6d4b', stance:'foe', stanceTxt:'敌对→被取代', one:'凡俗王朝，与三宗共治越国，后为李家所裂', members:11, core:[] },
];
export const REALMS = [
  { key:'rv-immortal', name:'仙位·道胎', n:3, reps:['陆江仙(器灵)','渌水','玉壶少年'] },
  { key:'rv-zhenren', name:'真人·真君', n:6, reps:['李周巍','杨锐仪','萧初庭'] },
  { key:'rv-zifu', name:'紫府（金丹）', n:12, reps:['李曦明','李遂宁','李清虹'] },
  { key:'rv-foundation', name:'筑基', n:18, reps:['李渊蛟','李曦治','李玄宣'] },
  { key:'rv-taixi', name:'胎息', n:14, reps:['窦氏','李项平'] },
  { key:'rv-mortal', name:'练气·凡人', n:34, reps:['李木田','陈二牛'] },
];
export const XIANJI = [
  { n:'玄雷泊', p:'李清虹', d:'雷道仙基，气海化雷池，紫银两气升腾' },
  { n:'松上雪', p:'李曦峻', d:'曦峻仙基，第502章出关所显' },
  { n:'天齐满', p:'刘长迭', d:'刘长迭仙基，得自机缘' },
  { n:'彩彻云衢', p:'李曦治', d:'箓气仙基，虹霞之道' },
  { n:'候神殊', p:'李阙宛', d:'巫箓术算一脉，坐镇大漠' },
  { n:'升阳', p:'李曦明', d:'推仙基入升阳（示例推断）', mock:true },
];
