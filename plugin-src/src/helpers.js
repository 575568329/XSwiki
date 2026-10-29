// 内容驱动的主题映射：元素气韵 + 势力色 + 境界 + 戏份（从卡片文本描述推导，卡片细微差异的来源）
export const FAC_HUE = {
  // 玄鉴仙族
  '李家':'#2f7e79','明阳道统':'#c08a2d','太阴一府':'#6f93c4','青池宗':'#4a8ba6','金羽宗':'#bd8f2c','萧家':'#6b8f5e','杨家':'#b3423a','越国朝廷':'#8a6d4b','北寰宗':'#5b6b8c','郁家':'#946b4a','袁家':'#7d6b9a','孔家':'#4d7ea8','崔家':'#5f8a6b','修越宗':'#6e8f5a','费家':'#a1746b',
  // 诡秘之主
  '塔罗会':'#8b74c9','黑夜女神教会':'#3d4d6b','值夜者':'#2c3e55','军情九处':'#4a6b5f','愚者教会':'#b3923f','心理炼金会':'#7a5ca8','风暴之主教会':'#2e6b8a','蒸汽与机械之神教会':'#8a6d4b','知识与智慧之神教会':'#3f7a5e','永恒烈阳教会':'#b3763a','大地母神教会':'#5e7a3f','战神教会':'#8a3f3f','奥古斯都家族':'#9a7d3f','亚伯拉罕家族':'#5b6b9a','白银城':'#7a8a99','灵教团':'#5e5e75','魔女教派':'#8a3f6b','极光会':'#4f6b6e','铁血十字会':'#7a4a3f','神祇':'#6b6b8a','因蒂斯共和国':'#a1746b','真实造物主':'#7a3f4f',
};

export function elemAccent(c) {
  const t = `${c.cultivation||''} ${c.identity||''} ${(c.persona&&c.persona.appearance)||''} ${(c.aliases||[]).join('')}`;
  if (/愚者|诡秘|灰雾|秘偶|占卜/.test(t)) return { c:'#8b74c9', g:'诡' };
  if (/黑夜|暗|影|夜/.test(t)) return { c:'#3d4d6b', g:'夜' };
  if (/器灵|铜镜|玄鉴|镜/.test(t)) return { c:'#2f7e79', g:'鉴' };
  if (/雷/.test(t)) return { c:'#8b74c9', g:'雷' };
  if (/剑/.test(t)) return { c:'#57977b', g:'剑' };
  if (/明阳|金瞳|金眸|金光|金血|火|日|烈阳|太阳/.test(t)) return { c:'#c08a2d', g:'阳' };
  if (/太阴|月|冰|水|海|风暴/.test(t)) return { c:'#6f93c4', g:'月' };
  if (/蒸汽|机械|工匠/.test(t)) return { c:'#8a6d4b', g:'工' };
  if (/巫|箓|卜|命运/.test(t)) return { c:'#8a6d4b', g:'巫' };
  if (/丹|药/.test(t)) return { c:'#a1746b', g:'丹' };
  if (/妖|龙|蛇/.test(t)) return { c:'#4d7ea8', g:'妖' };
  return { c:'#8c8f96', g:'' };
}
export function facHue(c) {
  for (const k in FAC_HUE) if ((c.faction||'').includes(k.replace('道统','').replace('朝廷',''))) return FAC_HUE[k];
  return '#b08d3f';
}
export function roleOf(c) {
  if (c.tier === 1) return ['core','核心'];
  if ((c.mentions||0) >= 800) return ['core','核心'];
  if ((c.mentions||0) >= 100) return ['support','重要'];
  if ((c.mentions||0) >= 20) return ['episodic','出场过'];
  return ['mention','仅提及'];
}
// 通用境界阶梯表：generation 恰为境界名的书（凡人/斗破）直接映射，无需按书分支
// 斗气阶梯置顶（'大斗师'不受 startsWith('斗师') 误配——首字不同）
const CN_REALM_CLS = [['隐席', 'rv-sm7'], ['大师', 'rv-sm6'], ['达人', 'rv-sm5'], ['大精通', 'rv-sm4'], ['小精通', 'rv-sm3'], ['从业者', 'rv-sm2'], ['新入者', 'rv-sm1'], ['超品', 'rv-p0'], ['一品', 'rv-p1'], ['二品', 'rv-p2'], ['三品', 'rv-p3'], ['四品', 'rv-p4'], ['五品', 'rv-p5'], ['六品', 'rv-p6'], ['七品', 'rv-p7'], ['八品', 'rv-p8'], ['九品', 'rv-p9'], ['斗帝', 'rv-doudi'], ['斗圣', 'rv-dousheng'], ['斗尊', 'rv-douzun'], ['斗宗', 'rv-douzong'], ['斗皇', 'rv-douhuang'], ['斗王', 'rv-douwang'], ['斗灵', 'rv-douling'], ['大斗师', 'rv-dadou'], ['斗师', 'rv-doushi'], ['斗者', 'rv-douzhe'], ['斗之气', 'rv-douzhi'], ['真仙', 'rv-zhenxian'], ['大乘', 'rv-dacheng'], ['合体', 'rv-heti'], ['炼虚', 'rv-lianxu'], ['化神', 'rv-huashen'], ['元婴', 'rv-yuanying'], ['结丹', 'rv-jindan'], ['筑基', 'rv-foundation'], ['练气', 'rv-lianqi'], ['凡人', 'rv-mortal']];
export function realmCls(c) {
  const t = c.cultivation || '';
  const g = c.generation || '';
  for (const [n, cls] of CN_REALM_CLS) if (g === n || g.startsWith(n)) return cls;
  // 诡秘之主：序列 0=真神 1-2=天使 3-4=圣者（金） 5-7=中序列 8-9=低序列
  const seq = (t.match(/序列(\d)/) || [])[1];
  if (seq !== undefined) {
    const n = +seq;
    if (n === 0) return 'rv-immortal';
    if (n <= 2) return 'rv-zhenren';
    if (n <= 4) return 'rv-zifu';
    if (n <= 7) return 'rv-foundation';
    return 'rv-mortal';
  }
  // 凡人修仙传等修仙书：generation 已归一到最高境界（顶部通用表已处理）
  if (g === '真仙') return 'rv-zhenxian';
  if (g === '大乘') return 'rv-dacheng';
  if (g === '合体') return 'rv-heti';
  if (g === '炼虚') return 'rv-lianxu';
  if (g === '化神') return 'rv-huashen';
  if (g === '元婴') return 'rv-yuanying';
  if (g === '结丹') return 'rv-jindan';
  if (g === '筑基') return 'rv-foundation';
  if (g === '练气') return 'rv-lianqi';
  if (/仙位|道胎|器灵/.test(t)) return 'rv-immortal';
  if (/大真人|真人|真君/.test(t)) return 'rv-zhenren';
  if (/紫府|金丹/.test(t)) return 'rv-zifu';
  if (/筑基/.test(t)) return 'rv-foundation';
  if (/胎息/.test(t)) return 'rv-taixi';
  if (/练气|凡人/.test(t)) return 'rv-mortal';
  return 'rv-none';
}
export function stgColor(st) {
  const rv = st.cultivationAt || st.rv || "";
  if (/仙|道/.test(rv)) return 'var(--rv-immortal)';
  if (/大真人/.test(rv)) return 'var(--rv-zhenren)';
  if (/紫府/.test(rv)) return 'var(--rv-zifu)';
  if (/筑基/.test(rv)) return 'var(--rv-foundation)';
  if (/胎息/.test(rv)) return 'var(--rv-taixi)';
  return 'var(--pri)';
}
export function relType(r) {
  // 婚姻先于亲缘：“妻子/丈夫”里的“子/夫”会被亲缘正则抢先误分；
  // 情缘先于敌对师徒：“红颜知己/青梅竹马”不含关键字会落“其他”
  if (/妻|夫|婚|连襟/.test(r)) return ['marriage','婚姻'];
  if (/伴侣|青梅竹马|红颜|恋人|挚爱|情人|倾心|情愫/.test(r)) return ['lover','情缘'];
  // 敌对先于师徒：“弑师之敌/叛徒弟子”里的“师/徒”会被师徒正则抢先误分
  if (/死敌|敌|仇|杀|对立|背叛|叛/.test(r)) return ['foe','敌对'];
  if (/师|徒/.test(r)) return ['master','师徒'];
  if (/父|母|兄|弟|姐|妹|哥|子|女|叔|伯|姑|舅|甥|侄|祖|孙|宗亲|族|家/.test(r)) return ['kinship','亲缘'];
  if (/成员|会首|同会|同伴|同事|旧识|旧同事|挚友|好友|朋友|搭档|伙伴|盟友|盟主|信仰|引路|引路人|合作/.test(r)) return ['ally','同伴'];
  return ['other','其他'];
}
export const fmtNum = n => n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n || 0);

// 势力名 → 专属色（FactionGrid 实体卡用，与 facHue 同表）
export function facHueByName(name) {
  const fake = { faction: name };
  return facHue(fake);
}
