// 诡秘之主：构建书目 JSON（wiki 仓库 + 百科摘要 -> plugin/data/guimizhizhu.json）
// 前置: node parse-wiki.mjs 生成 guimi-parsed.json；raw-baike/ 有百科摘要
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, 'guimi-parsed.json'), 'utf8'));
const TODAY = '2026-10-22';

// ============ editorial 配置 ============
const PATH_FORMAL = {
  占卜家途径: '愚者途径', 学徒途径: '门途径', 偷盗者途径: '错误途径',
  不眠者途径: '黑夜途径', 收尸人途径: '死神途径', 猎人途径: '红祭司途径',
  水手途径: '暴君途径', 歌颂者途径: '太阳途径', 阅读者途径: '白塔途径',
  秘祈人途径: '倒吊人途径', 窥秘人途径: '隐者途径', 怪物途径: '命运之轮途径',
  罪犯途径: '深渊途径', 律师途径: '黑皇帝途径', 仲裁人途径: '审判者途径',
  刺客途径: '魔女途径', 耕种者途径: '大地母神途径', 通识者途径: '完美者途径',
  战士途径: '黄昏巨人途径', 药师途径: '月亮途径', 观众途径: '空想家途径',
  囚犯途径: '被缚者途径',
};
const PATHS_COI = ['宿命之环途径', '超星主宰途径', '不定之雾途径', '不熄的呓语途径', '原初饥饿途径', '衰败君王途径', '高维俯视者途径', '命运女神途径', '堕落母神途径', '欲望母树途径'];
const EXCLUDE = new Set(['神灵', '神衹', '福生玄黄天尊', '卢米安·李']);
const MERGE = {
  '“五海之王”纳斯特': '纳斯特·所罗门', '“噩梦之龙”阿勒苏霍德': '阿勒苏霍德',
  '“疯船长”康纳斯·维克托': '康纳斯·维克托', '“屠杀者”吉尔希艾斯': '吉尔希艾斯',
  '“地狱上将”路德维尔': '路德维尔', '“血之上将”塞尼奥尔': '塞尼奥尔',
  '“巧言者”米索尔·金': '米索尔·金', '“无血者”希斯·道尔': '希斯·道尔',
  '“圣言天使”斯提弗': '斯提弗', '“血色荆棘”亨特利': '亨特利',
};

// tier1 精修（事实源：wiki 仓库 + 百科摘要 raw-baike/）
const T1 = {
  '克莱恩·莫雷蒂': { faction: '塔罗会', gender: '男', cultivation: '序列0 愚者', status: '在世（晋升序列0“愚者”，深眠于灰雾之上）', identity: '塔罗会创立者“愚者”先生，本名周明瑞（穿越者）', rel: [['班森·莫雷蒂', '哥哥'], ['梅丽莎·莫雷蒂', '妹妹'], ['奥黛丽·霍尔', '塔罗会成员“正义”'], ['阿尔杰·威尔逊', '塔罗会成员“倒吊人”'], ['戴里克·伯格', '塔罗会成员“太阳”'], ['埃姆林·怀特', '塔罗会成员“月亮”'], ['伦纳德·米切尔', '廷根同事·塔罗会成员“星星”'], ['休·迪尔查', '塔罗会成员“审判”'], ['佛尔思·沃尔', '塔罗会成员“魔术师”'], ['嘉德丽雅', '塔罗会成员“隐者”'], ['安德森·胡德', '塔罗会成员“世界”'], ['阿蒙', '死敌（“错误”天使）'], ['邓恩·史密斯', '值夜者队长（上司）'], ['阿兹克·艾格斯', '导师（历史系教授）']] },
  '奥黛丽·霍尔': { faction: '塔罗会', gender: '女', cultivation: '序列4 操纵师', status: '在世', identity: '霍尔伯爵之女，塔罗会“正义”，心理炼金会评议团委员', rel: [['克莱恩·莫雷蒂', '信仰对象“愚者”先生'], ['嘉德丽雅', '神秘学引路人'], ['霍尔伯爵', '父亲'], ['苏茜', '爱犬（非凡动物）']] },
  '阿尔杰·威尔逊': { faction: '塔罗会', gender: '男', cultivation: '序列3 海王', status: '在世（后脱离风暴教会，出任海神教会教皇）', identity: '风暴教会“幽蓝复仇者”号船长，塔罗会“倒吊人”', rel: [['克莱恩·莫雷蒂', '“愚者”先生（会首）'], ['夏塔丝', '船员（海族）']] },
  '戴里克·伯格': { faction: '塔罗会', gender: '男', cultivation: '序列4 无暗者', status: '在世', identity: '神弃之地白银城居民，塔罗会“太阳”', rel: [['克莱恩·莫雷蒂', '“愚者”先生（信仰与交易对象）'], ['科林·伊利亚特', '白银城长老']] },
  '埃姆林·怀特': { faction: '塔罗会', gender: '男', cultivation: '序列7 吸血鬼', status: '在世', identity: '血族新贵，塔罗会“月亮”', rel: [['克莱恩·莫雷蒂', '“愚者”先生（会首）']] },
  '伦纳德·米切尔': { faction: '塔罗会', gender: '男', cultivation: '序列6 安魂师', status: '在世', identity: '值夜者出身的诗人，塔罗会“星星”，体内栖有帕列斯', rel: [['克莱恩·莫雷蒂', '廷根旧同事·“愚者”先生'], ['帕列斯·索罗亚斯德', '体内寄宿的古老存在'], ['邓恩·史密斯', '值夜者队长（上司）']] },
  '休·迪尔查': { faction: '塔罗会', gender: '女', cultivation: '序列5 惩戒骑士', status: '在世', identity: '军情九处法官·上校，塔罗会“审判”', rel: [['佛尔思·沃尔', '挚友（合租搭档）'], ['克莱恩·莫雷蒂', '“愚者”先生（会首）']] },
  '佛尔思·沃尔': { faction: '塔罗会', gender: '女', cultivation: '序列5 旅行家', status: '在世', identity: '作家兼侦探，塔罗会“魔术师”，门途径', rel: [['休·迪尔查', '挚友（合租搭档）'], ['克莱恩·莫雷蒂', '“愚者”先生（会首）']] },
  '嘉德丽雅': { faction: '心理炼金会', gender: '女', cultivation: '序列4 神秘学家', status: '在世', identity: '“隐者”女士，心理炼金会高层', rel: [['克莱恩·莫雷蒂', '“愚者”先生（会首）'], ['奥黛丽·霍尔', '引路人与学生']] },
  '安德森·胡德': { faction: '塔罗会', gender: '男', cultivation: '序列4 铁血骑士', status: '在世', identity: '佣兵“剑术天才”，塔罗会“世界”', rel: [['克莱恩·莫雷蒂', '“愚者”先生（会首）']] },
  '邓恩·史密斯': { faction: '黑夜女神教会', gender: '男', cultivation: '序列6 安魂师', status: '陨落（廷根大爆炸中对抗因斯·赞格威尔）', identity: '廷根市值夜者小队队长', rel: [['克莱恩·莫雷蒂', '队员（下属）'], ['伦纳德·米切尔', '队员（下属）'], ['老尼尔', '队中文书']] },
  '班森·莫雷蒂': { faction: '', gender: '男', cultivation: '', status: '在世', identity: '克莱恩的哥哥，贝克兰德政府公务员', rel: [['克莱恩·莫雷蒂', '弟弟'], ['梅丽莎·莫雷蒂', '妹妹']] },
  '梅丽莎·莫雷蒂': { faction: '', gender: '女', cultivation: '', status: '在世', identity: '克莱恩的妹妹，贝克兰德技术大学学生', rel: [['克莱恩·莫雷蒂', '哥哥'], ['班森·莫雷蒂', '哥哥']] },
  '阿兹克·艾格斯': { faction: '', gender: '男', cultivation: '', status: '在世', identity: '霍伊大学历史系教授，戴青铜面具的神秘学者', rel: [['克莱恩·莫雷蒂', '学生（受其照拂）']] },
  '罗塞尔·古斯塔夫': { faction: '因蒂斯共和国', gender: '男', cultivation: '序列0 黑皇帝', status: '陨落（遭永恒烈阳教会与贵族联手刺杀）', identity: '罗塞尔大帝，本名黄涛（第二位穿越者），因蒂斯共和国缔造者', rel: [['贝尔纳黛·古斯塔夫', '女儿']] },
  '因斯·赞格威尔': { faction: '铁血十字会', gender: '男', cultivation: '', status: '陨落（廷根事件）', identity: '叛逃的前值夜者，封印物“0-08”持有者', rel: [['邓恩·史密斯', '旧识（敌对）']] },
  '阿蒙': { faction: '神祇', gender: '男', cultivation: '序列1 时之虫', status: '败亡（“错误”唯一性被愚者所夺）', identity: '“错误”天使·欺诈导师，亚当之弟', rel: [['亚当', '兄长'], ['克莱恩·莫雷蒂', '死敌']] },
  '亚当': { faction: '神祇', gender: '男', cultivation: '', status: '在世', identity: '造物主长子，隐秘舞台的幕后观察者', rel: [['阿蒙', '弟弟'], ['克莱恩·莫雷蒂', '布局者与对手']] },
  '阿曼妮西斯': { faction: '神祇', gender: '女', cultivation: '序列0 黑夜', status: '在世（黑夜女神）', identity: '黑夜女神·隐秘之母，执掌黑夜、隐秘与厄运权柄', rel: [] },
  '列奥德罗': { faction: '神祇', gender: '男', cultivation: '序列0 暴君', status: '在世（风暴之主）', identity: '风暴之主，执掌海洋与风暴权柄', rel: [] },
  '奥赛库斯': { faction: '神祇', gender: '男', cultivation: '序列0 太阳', status: '在世（永恒烈阳）', identity: '永恒烈阳，执掌光明与烈阳权柄', rel: [] },
  '蒸汽与机械之神': { faction: '神祇', gender: '男', cultivation: '序列0 完美者', status: '在世', identity: '蒸汽与机械之神，工业时代的知识与技艺之神', rel: [] },
  '赫拉伯根': { faction: '神祇', gender: '男', cultivation: '序列0 白塔', status: '在世（知识与智慧之神）', identity: '知识与智慧之神，白塔之主', rel: [] },
  '欧弥贝拉': { faction: '神祇', gender: '女', cultivation: '序列0 大地母神', status: '在世（大地母神）', identity: '大地母神，执掌生命、丰收与大地权柄', rel: [] },
  '巴德海尔': { faction: '神祇', gender: '男', cultivation: '序列0 黄昏巨人', status: '在世（战神）', identity: '战神，黄昏巨人途径的真神', rel: [] },
  '真实造物主': { faction: '神祇', gender: '男', cultivation: '', status: '陨落（本体被镇压，残余势力延续作乱）', identity: '“堕落造物主”，远古太阳神疯狂面的聚合', rel: [] },
  '帕列斯·索罗亚斯德': { faction: '', gender: '男', cultivation: '', status: '在世', identity: '栖宿于伦纳德体内的古老存在，索罗亚斯德家族先祖', rel: [['伦纳德·米切尔', '寄宿宿主']] },
  '梅高欧丝': { faction: '真实造物主', gender: '女', cultivation: '', status: '陨落（廷根事件）', identity: '真实造物主阵营的核心角色', rel: [] },
};

// 塔罗会代号（别名搜索的关键词）
const T1_CODE = { '克莱恩·莫雷蒂': '愚者', '奥黛丽·霍尔': '正义', '阿尔杰·威尔逊': '倒吊人', '戴里克·伯格': '太阳', '埃姆林·怀特': '月亮', '伦纳德·米切尔': '星星', '休·迪尔查': '审判', '佛尔思·沃尔': '魔术师', '嘉德丽雅': '隐者', '安德森·胡德': '世界' };

// tier1 手工速答句（oneLiner，列表防剧透由 oneLinerSafe 规则处理）
const T1_LINER = {
  '克莱恩·莫雷蒂': '穿越者周明瑞，占卜家途径一路晋升至序列0“愚者”，灰雾之上塔罗会的创立者与见证者',
  '奥黛丽·霍尔': '霍尔伯爵之女、塔罗会“正义”，观众途径序列4操纵师，人称“贝克兰德最耀眼的宝石”',
  '阿尔杰·威尔逊': '风暴教会船长、塔罗会“倒吊人”，暴君途径序列3海王，终执海神权柄',
  '戴里克·伯格': '神弃之地白银城的少年，塔罗会“太阳”，太阳途径序列4无暗者',
  '埃姆林·怀特': '血族新贵、塔罗会“月亮”，月亮途径非凡者',
  '伦纳德·米切尔': '值夜者诗人、塔罗会“星星”，黑夜途径序列6安魂师，体内栖宿着古老存在帕列斯',
  '休·迪尔查': '前赏金猎人、塔罗会“审判”，军情九处法官·上校，仲裁人途径序列5惩戒骑士',
  '佛尔思·沃尔': '作家兼侦探、塔罗会“魔术师”，门途径序列5旅行家',
  '嘉德丽雅': '“隐者”女士，心理炼金会高层，隐者途径序列4神秘学家',
  '安德森·胡德': '佣兵“剑术天才”，塔罗会“世界”，猎人途径序列4铁血骑士',
  '邓恩·史密斯': '廷根市值夜者小队队长，黑夜途径序列6安魂师，克莱恩非凡之路的引路人',
  '班森·莫雷蒂': '克莱恩的哥哥，贝克兰德政府公务员，撑起莫雷蒂家的长兄',
  '梅丽莎·莫雷蒂': '克莱恩的妹妹，节俭懂事的技术大学学生',
  '阿兹克·艾格斯': '霍伊大学历史系教授，戴青铜面具的神秘学者，与死神途径渊源极深',
  '罗塞尔·古斯塔夫': '罗塞尔大帝，本名黄涛（第二位穿越者），以“完美者”途径推动工业革命，终转黑皇帝途径',
  '因斯·赞格威尔': '叛逃的前值夜者，封印物“0-08”的持有者，廷根事件的元凶',
  '阿蒙': '“错误”天使·欺诈导师，远古太阳神次子，克莱恩最大的死敌',
  '亚当': '造物主长子，隐秘舞台的幕后观察者',
  '阿曼妮西斯': '黑夜女神·隐秘之母，七大正神之一，执掌黑夜、隐秘与厄运权柄',
  '列奥德罗': '风暴之主，七大正神之一，执掌海洋与风暴权柄',
  '奥赛库斯': '永恒烈阳，七大正神之一，执掌光明与烈阳权柄',
  '蒸汽与机械之神': '七大正神之一，工业时代的知识与技艺之神',
  '赫拉伯根': '知识与智慧之神，七大正神之一，白塔之主',
  '欧弥贝拉': '大地母神，七大正神之一，执掌生命、丰收与大地权柄',
  '巴德海尔': '战神，七大正神之一，黄昏巨人途径的真神',
  '真实造物主': '“堕落造物主”，远古太阳神疯狂面的聚合，极光会所崇拜的对象',
  '帕列斯·索罗亚斯德': '栖宿于伦纳德体内的古老存在，索罗亚斯德家族的先祖',
  '梅高欧丝': '真实造物主阵营的核心角色，廷根事件的关键人物',
};

// 势力卡（stance: protagonist/ally/neutral/foe，克莱恩视角）
const FAC_CARDS = [
  ['塔罗会', 'protagonist', '主角组织·灰雾之上的隐秘聚会', '克莱恩以“愚者”身份于灰雾之上创立，成员以塔罗牌为代号，等价交换情报与非凡资源。', ['克莱恩·莫雷蒂', '奥黛丽·霍尔', '阿尔杰·威尔逊']],
  ['黑夜女神教会', 'ally', '七大正统教会之一·隐秘与厄运', '鲁恩国教，值夜者镇压非凡失控；克莱恩非凡之路的起点。', ['邓恩·史密斯', '伦纳德·米切尔']],
  ['值夜者', 'ally', '黑夜女神教会的非凡者小队', '处理失控与邪教案件的非凡者队伍，廷根小队是故事开端。', ['邓恩·史密斯', '老尼尔']],
  ['军情九处', 'ally', '鲁恩王国的非凡情报机构', '掌“国内安全与反间谍”，休·迪尔查现任法官。', ['休·迪尔查']],
  ['愚者教会', 'ally', '“愚者”先生的信仰组织', '由塔罗会推动建立、信仰“愚者”的新兴教会。', ['克莱恩·莫雷蒂']],
  ['心理炼金会', 'ally', '研究心理与神秘学的隐秘组织', '幕后是亚当；嘉德丽雅任高层，奥黛丽为评议团委员。', ['嘉德丽雅', '奥黛丽·霍尔']],
  ['风暴之主教会', 'neutral', '七大正统教会之一·海洋与风暴', '阿尔杰的出身阵营，后与其渐行渐远。', ['阿尔杰·威尔逊']],
  ['蒸汽与机械之神教会', 'neutral', '七大正统教会之一·工业与技艺', '贝克兰德工业时代的守护者，与技术、封印物管理关系密切。', []],
  ['知识与智慧之神教会', 'neutral', '七大正统教会之一·知识与实践', '教会藏书与学识冠绝各国，白塔途径的信仰组织。', []],
  ['永恒烈阳教会', 'neutral', '七大正统教会之一·光明与烈阳', '因蒂斯主要信仰；曾主导刺杀罗塞尔大帝。', []],
  ['大地母神教会', 'neutral', '七大正统教会之一·生命与丰收', '鲁恩与因蒂斯民间信仰深厚。', []],
  ['战神教会', 'neutral', '七大正统教会之一·战争与力量', '弗萨克主要信仰，崇尚武力。', []],
  ['奥古斯都家族', 'neutral', '鲁恩王室', '乔治三世在位；与诸教会共治鲁恩。', ['乔治三世']],
  ['亚伯拉罕家族', 'ally', '门途径的古老家族', '“门”先生伯特利·亚伯拉罕的家族，与塔罗会关系友好。', ['伯特利·亚伯拉罕']],
  ['白银城', 'ally', '神弃之地的人类聚居地', '戴里克的故乡，在黑暗中守护“城市”与希望。', ['戴里克·伯格', '科林·伊利亚特']],
  ['灵教团', 'neutral', '崇拜灵界与亡灵的隐秘组织', '与收尸人途径关系密切，行事神秘。', []],
  ['魔女教派', 'foe', '崇拜原初魔女的隐秘组织', '魔女途径的信奉者，常以美色与诡计作乱。', ['特莉丝']],
  ['极光会', 'foe', '崇拜真实造物主的邪教', '疯狂与堕落的传播者，重要反派组织。', []],
  ['铁血十字会', 'foe', '好战的隐秘组织', '因斯·赞格威尔关联的反派势力。', ['因斯·赞格威尔']],
];
// 印章配色（势力主色，古风低饱和）
const FAC_COLOR = {
  塔罗会: ['#4a3f63', '#ddd4ee'], 黑夜女神教会: ['#2c2c3a', '#c9c9dd'], 值夜者: ['#33334a', '#cfcfe2'],
  军情九处: ['#34597a', '#d0e0ee'], 愚者教会: ['#3d4a5c', '#c9d4e0'], 心理炼金会: ['#54428e', '#ddd4f0'],
  风暴之主教会: ['#1f4a5e', '#c5e2ee'], 蒸汽与机械之神教会: ['#5a4a2f', '#ead9b8'], 知识与智慧之神教会: ['#2f5a44', '#cfe8da'],
  永恒烈阳教会: ['#a2622e', '#f2ddc0'], 大地母神教会: ['#4a5e2f', '#e0edc5'], 战神教会: ['#6e2f2f', '#eec9c9'],
  奥古斯都家族: ['#8a6d2f', '#f0e2bd'], 亚伯拉罕家族: ['#42506e', '#ccd6ea'], 白银城: ['#56636e', '#dde5ea'],
  灵教团: ['#41414f', '#d6d6e2'], 魔女教派: ['#5e2f4a', '#ecc9dd'], 极光会: ['#2f5e56', '#c9e8e0'], 铁血十字会: ['#6e3a2f', '#eed5c9'],
  神祇: ['#3a3a52', '#d5d5e8'],
};
const TIER_COLOR = { 1: ['#6b3fa0', '#e8dcf5'], 2: ['#2f5d8a', '#d6e4f0'], 3: ['#5a5a5a', '#e2e2e2'] };
// 途径图鉴代表人物
const PATH_REP = {
  愚者途径: '克莱恩·莫雷蒂', 门途径: '佛尔思·沃尔', 错误途径: '帕列斯·索罗亚斯德', 黑夜途径: '伦纳德·米切尔',
  死神途径: '阿兹克·艾格斯', 红祭司途径: '安德森·胡德', 暴君途径: '阿尔杰·威尔逊', 太阳途径: '戴里克·伯格',
  白塔途径: '艾德雯娜·爱德华兹', 倒吊人途径: 'A先生', 隐者途径: '嘉德丽雅', 命运之轮途径: '威尔·昂赛汀',
  深渊途径: '杰森·贝利亚', 黑皇帝途径: '纳斯特·所罗门', 审判者途径: '休·迪尔查', 魔女途径: '特莉丝',
  大地母神途径: '弗兰克·李', 完美者途径: '罗塞尔·古斯塔夫', 黄昏巨人途径: '科林·伊利亚特', 月亮途径: '埃姆林·怀特',
  空想家途径: '奥黛丽·霍尔', 被缚者途径: '莎伦',
};

// ============ 工具 ============
const firstSentence = s => (s || '').split(/(?<=[。！？])/)[0].slice(0, 90);
// 句子级截断：不把句子切半个，结尾贴省略号
const cutBySentence = (s, max) => {
  s = (s || '').replace(/\r?\n+/g, ' ').trim();
  if (s.length <= max) return s;
  const parts = s.slice(0, max).split(/(?<=[。！？；])/).filter(Boolean);
  return (parts.length > 1 ? parts.slice(0, -1).join('') : s.slice(0, max)).trim() + '……';
};
const SPOILER_RE = /(陨落|身死|战死|被杀|所杀|殒命|死亡|死了|坐化|兵解|败亡|同归于尽|自尽|身亡|刺杀|牺牲)/;
const safeLiner = ol => {
  if (!ol || !SPOILER_RE.test(ol)) return ol || '';
  const parts = ol.split(/，|。|；/).filter(Boolean);
  const s = parts.filter(p => !SPOILER_RE.test(p));
  return s.length ? s.slice(0, 3).join('，') : '身份信息详见人物卡';
};
const sealSvg = c => {
  const [bg, fg] = FAC_COLOR[c.faction] || TIER_COLOR[c.tier] || TIER_COLOR[3];
  const big = (c.name || '?')[0];
  const small = c.generation ? c.generation.replace('途径', '') : (c.faction || '').slice(0, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="14" fill="${bg}"/>
<rect x="5.5" y="5.5" width="89" height="89" rx="10" fill="none" stroke="${fg}" stroke-width="1.6" opacity="0.55"/>
<rect x="9" y="9" width="82" height="82" rx="8" fill="none" stroke="${fg}" stroke-width="0.8" opacity="0.3"/>
<text x="50" y="60" font-size="46" fill="#ffffff" text-anchor="middle" font-family="KaiTi,STKaiti,'Noto Serif SC',serif" font-weight="700">${big}</text>
${small ? `<text x="50" y="82" font-size="13" fill="${fg}" text-anchor="middle" font-family="KaiTi,STKaiti,serif" opacity="0.9">${small}</text>` : ''}
</svg>`;
};

// ============ 加载 ============
const charsRaw = parsed.chars.slice();
// —— 神祇目录解析（七神/天使/旧日/外神），结构与 parse-wiki 的 chars 对齐 ——
const cleanMdB = s => (s || '').replace(/\[([^\]]+?)\]\([^)]*\)/g, '$1').replace(/^#+ ?/gm, '').replace(/^> ?/gm, '').replace(/\*\*/g, '').replace(/\n{3,}/g, '\n').trim();
const secB = (text, re) => { const m = text.match(re); return m ? cleanMdB(m[1]) : ''; };
const godDir = path.join(__dirname, 'repo', '神祇');
for (const f of fs.readdirSync(godDir)) {
  if (!f.endsWith('.md')) continue;
  const name = f.replace(/\.md$/, '');
  if (EXCLUDE.has(name)) continue;
  const raw = fs.readFileSync(path.join(godDir, f), 'utf8');
  if (/^#\s*重定向/m.test(raw)) continue; // 重定向文件已记录，跳过
  const aliases = new Set();
  for (const m of raw.matchAll(/^[-*]?\s*["“]([^"”：\n]{2,20})["”]：/gm)) aliases.add(m[1].trim());
  const zuncheng = secB(raw, /^## 称号\s*\n([\s\S]*?)(?=^##(?!#)\s)/m);
  for (const a of zuncheng.split(/[-·、\n]/).map(s => s.replace(/[“”"]/g, '').trim()).filter(Boolean)) if (a.length <= 12) aliases.add(a);
  const seqRefs = [...raw.matchAll(/序列\s*([0-9])\s*["“]?([^\s，。、"”()（）]{2,10})?["”]?/g)]
    .map(m => ({ seq: parseInt(m[1]), name: (m[2] || '').trim() }));
  const lead = cleanMdB((raw.split(/^## /m)[0] || '')).replace(new RegExp('^' + name + '[，,、\\s（(]*'), '').slice(0, 150);
  const pathGod = secB(raw, /^## 途径\s*\n([\s\S]*?)(?=^##(?!#)\s)/m);
  const gname = name.replace(/[.。]/g, '·');
  charsRaw.push({
    name: gname, pathwayGroup: '其他角色', source: '神祇',
    aliases: [...aliases].slice(0, 20),
    identHead: lead,
    identNames: [],
    appearance: cutBySentence(secB(raw, /^## 外貌\s*\n([\s\S]*?)(?=^##(?!#)\s)/m), 220),
    personality: cutBySentence(secB(raw, /^## 性格\s*\n([\s\S]*?)(?=^##(?!#)\s)/m), 180),
    family: '',
    quotes: [...raw.matchAll(/^> ?["“](.+?)["”]/gm)].map(m => m[1]).slice(0, 6),
    seqRefs, headQuote: lead, textLen: raw.length,
    vol19: 0, vol18: 0, coi: 0,
    pathGod: pathGod.slice(0, 40),
  });
}
// 神祇目录 T1 名字归一（去掉间隔号差异）
for (const k of Object.keys(T1)) T1[k.replace(/[.。]/g, '·')] = T1[k];

const baike = {};
for (const f of fs.readdirSync(path.join(__dirname, 'raw-baike'))) {
  if (!f.endsWith('.json')) continue;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw-baike', f), 'utf8'));
    if ((j.desc || '').includes('诡秘') || (j.abstract || '').includes('诡秘')) baike[j.key] = j;
  } catch {}
}
// 重定向解析
const redirects = {};
for (const src of ['角色', '神祇']) {
  const dir = path.join(__dirname, 'repo', src);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = t.match(/^#\s*重定向\s*\[([^\]]+)\]/m);
    if (m) redirects[f.replace(/\.md$/, '')] = m[1];
  }
}

// ============ 组装人物 ============
const warn = [];
const out = [];
for (const c of charsRaw) {
  if (EXCLUDE.has(c.name)) { warn.push('剔除 ' + c.name); continue; }
  if (PATHS_COI.includes(c.pathwayGroup)) { warn.push('第二部 ' + c.name); continue; }
  if (redirects[c.name]) { warn.push('重定向 ' + c.name + ' → ' + redirects[c.name]); continue; }
  if (MERGE[c.name]) { warn.push('称号归并 ' + c.name + ' → ' + MERGE[c.name]); continue; }

  const t1 = T1[c.name] || null;
  const pathFormal = PATH_FORMAL[c.pathwayGroup] || '';
  const isGod = c.source === '神祇';
  // cultivation：tier1 手工；wiki seqRefs 匹配该途径序列表
  let cultivation = t1 ? t1.cultivation || '' : '';
  if (!cultivation) {
    const seqs = parsed.seqTable[c.pathwayGroup] || {};
    const names2seq = Object.fromEntries(Object.entries(seqs).map(([n, v]) => [v, n]));
    const hits = (c.seqRefs || []).filter(r => r.name && names2seq[r.name]);
    if (hits.length) {
      const freq = {};
      hits.forEach(h => { const k = h.seq + '|' + h.name; freq[k] = (freq[k] || 0) + 1; });
      const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0].split('|');
      cultivation = `序列${best[0]} ${best[1]}`;
    }
  }
  // 无途径组的词条（天使/神祇类）按 cultivation 序列名反查途径表兜底（如阿蒙->错误途径）
  let generation = pathFormal;
  if (!generation && cultivation) {
    const gm2 = /^序列(d) (.+)$/.exec(cultivation);
    if (gm2) {
      const groups = Object.entries(parsed.seqTable).filter(([, seqs]) => seqs[gm2[1]] === gm2[2]);
      if (groups.length === 1) generation = PATH_FORMAL[groups[0][0]] || '';
    }
  }
  // oneLiner：tier1 手工 > 百科摘要 > wiki 身份 > 首段；剥离模板腔与 markdown 残留
  const bk = baike[c.name];
  let oneLiner = '';
  if (t1 && T1_LINER[c.name]) oneLiner = T1_LINER[c.name];
  if (!oneLiner && bk) {
    const sents = ((bk.abstract || bk.desc || '').replace(/\n/g, '')).split(/(?<=[。！？])/).filter(Boolean);
    const core = sents.filter(s => !/所著|衍生作品|登场作品|有声|配音|广播剧|动画由|卡牌由/.test(s));
    oneLiner = (core[0] || sents[0] || '').replace(new RegExp('^' + c.name + '[（(，,、\\s]*[^）)]*）?[，,、]?'), '').trim();
  }
  if (!oneLiner) oneLiner = c.identHead || '';
  if (!oneLiner) oneLiner = firstSentence((c.headQuote || '').replace(new RegExp('^' + c.name + '[，,、\\s]*'), ''));
  oneLiner = (oneLiner || '').replace(/\r?\n+/g, ' ').replace(new RegExp('^' + c.name + '，?'), '').trim()
    .replace(/^[\s>*#·—-]+/, '').replace(/[*#]+$/g, '').replace(/\*+/g, '').replace(/ {2,}/g, ' ').trim();
  if (oneLiner.length > 110) oneLiner = oneLiner.slice(0, 108) + '…';
  if (!oneLiner) oneLiner = [c.pathGod, pathFormal && pathFormal + '非凡者'].filter(Boolean)
    .map(s => (s || '').replace(/\r?\n+/g, ' ').replace(/^[\s>*#·—-]+/, '').trim()).filter(Boolean).join('，');
  // gender：tier1 手工 > 代词
  let gender = (t1 && t1.gender) || '';
  if (!gender) {
    const she = (c.wiki || {}).she || 0, he = (c.wiki || {}).he || 0;
  }
  // aliases：wiki 尊名/化名 + 西名短称 + tier1 代号
  const aliases = [...new Set((c.aliases || []).map(a => a.replace(/[.。]/g, '·').replace(/^[“”"]|[“”"]$/g, '').trim())
    .filter(a => a && a !== c.name && a.length >= 2 && a.length <= 16))];
  if (c.name.includes('·')) {
    const short = c.name.split('·')[0];
    if (short.length >= 2) aliases.unshift(short);
  }
  const code = T1_CODE[c.name];
  if (code) aliases.unshift(code);
  // tier
  const tier = t1 ? 1 : (c.textLen >= 700 ? 2 : 3);
  // persona：tier1/2 用 wiki 外貌/性格
  let persona = null;
  const pers = (c.personality || '').split(/[，,；;。]/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 12);
  if (tier <= 2) persona = {
    appearance: cutBySentence(c.appearance || '', 160) || '',
    personality: pers.slice(0, 5),
    motivation: '',
    arc: (c.identNames || []).length ? '身份：' + c.identNames.slice(0, 4).join('、') : '',
  };
  if (tier === 3) persona = null;

  out.push({
    id: '',
    name: c.name,
    tier,
    aliases: [...new Set(aliases)].slice(0, 18),
    importance: tier === 1 ? 'protagonist' : (c.textLen >= 2000 ? 'major' : 'supporting'),
    identity: (t1 && t1.identity) || c.identHead || '',
    faction: (t1 && t1.faction) || (isGod ? '神祇' : ''),
    generation,
    cultivation,
    status: (t1 && t1.status) || '',
    oneLiner,
    persona,
    relationships: ((t1 && t1.rel) || []).map(([name, relation]) => ({ name, relation, id: '' })),
    timeline: [],
    evidence: (c.quotes || []).slice(0, 3),
    mentions: c.textLen,
    chapterCount: 0, firstChapter: 0, lastChapter: 0,
    gender,
    oneLinerSafe: '',
    seal: '',
  });
}
// gender 代词启发（wiki 文本 她/他）
for (let i = 0; i < out.length; i++) {
  if (out[i].gender) continue;
  const raw = charsRaw.find(c => c.name === out[i].name);
  // parse 时未存代词，用 family/appearance 估计太弱；直接留空
}

// ============ 势力成员反查分派 faction（wiki 势力 md 的成员段内链） ============
{
  const byName0 = Object.fromEntries(out.map(c => [c.name, c]));
  const facDir = path.join(__dirname, 'repo', '势力与组织');
  for (const f of fs.readdirSync(facDir)) {
    if (!f.endsWith('.md')) continue;
    const fname = f.replace(/\.md$/, '');
    // 势力卡名对齐（wiki 文件名 -> 卡名一致的直接用）
    const raw = fs.readFileSync(path.join(facDir, f), 'utf8');
    if (/^#\s*重定向/m.test(raw)) continue;
    const memSec = raw.match(/^##\s*成员[\s\S]*?$/m);
    const memberNames = new Set();
    // 全文内链人名匹配本库角色（限制在人物小节标题或列表行，减少误挂）
    for (const m of raw.matchAll(/^[-*\d.\s]*\[*([^\]\n|（(]{2,12})\]?\([^)]*\)/gm)) {
      const nm = m[1].replace(/[“”"]/g, '').replace(/[.。]/g, '·').trim();
      if (byName0[nm]) memberNames.add(nm);
    }
    const facName = FAC_CARDS.some(x => x[0] === fname) ? fname : '';
    for (const nm of memberNames) {
      const c = byName0[nm];
      if (c && !c.faction && facName) c.faction = facName;
    }
  }
}

// 排序：tier 升序、戏份降序（列表默认展示头部核心人物）
out.sort((a, b) => a.tier - b.tier || b.mentions - a.mentions);

// ============ id / pinyin / oneLinerSafe / seal ============
const idCount = {};
for (const c of out) {
  let pid = pinyin(c.name, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').replace(/[^a-z0-9]/g, '');
  idCount[pid] = (idCount[pid] || 0) + 1;
  c.id = idCount[pid] > 1 ? pid + idCount[pid] : pid;
  c.pinyin = pid;
  c.oneLinerSafe = safeLiner(c.oneLiner);
  c.seal = sealSvg(c);
  delete c.wiki;
}

// ============ 关系 id 回填 ============
const byName = Object.fromEntries(out.map(c => [c.name, c]));
for (const c of out) for (const r of c.relationships) {
  const t = byName[r.name];
  if (t) r.id = t.id;
}

// ============ 体系页 ============
const seqLevel = n => n >= 8 ? 0 : n >= 5 ? 1 : n >= 3 ? 2 : n >= 1 ? 3 : 4;
const LEVELS = [
  { key: 'rv-mortal', name: '低序列（9-8）' }, { key: 'rv-foundation', name: '中序列（7-5）' },
  { key: 'rv-zifu', name: '圣者（4-3）' }, { key: 'rv-zhenren', name: '天使（2-1）' }, { key: 'rv-immortal', name: '真神（0）' },
];
const realmBuckets = LEVELS.map(() => []);
for (const c of out) {
  const m = (c.cultivation || '').match(/序列(\d)/);
  if (m) realmBuckets[seqLevel(+m[1])].push(c);
}
const realms = LEVELS.map((L, i) => ({
  key: L.key, name: L.name,
  count: realmBuckets[i].length,
  reps: realmBuckets[i].sort((a, b) => b.tier - a.tier || b.mentions - a.mentions).slice(0, 6).map(c => c.name),
}));
const xianji = Object.entries(PATH_FORMAL).map(([wiki, formal]) => {
  const seqs = parsed.seqTable[wiki] || {};
  const chain = Array.from({ length: 10 }, (_, i) => 9 - i).map(n => `序列${n} ${seqs[n] || '—'}`).join(' → ');
  return { name: formal, desc: chain, member: PATH_REP[formal] || '' };
});
xianji.sort((a, b) => Object.values(PATH_FORMAL).indexOf(a.name) - Object.values(PATH_FORMAL).indexOf(b.name));

// ============ 势力 ============
const facCount = {};
for (const c of out) if (c.faction) facCount[c.faction] = (facCount[c.faction] || 0) + 1;
const factionEntities = FAC_CARDS.map(([name, stance, stanceTxt, one, core]) => ({
  id: pinyin(name, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').replace(/[^a-z0-9]/g, ''),
  name, stance, stanceTxt, one, core,
  members: facCount[name] || 0, stages: [],
})).filter(f => f.members > 0 || f.core.length);
const factions = [...new Set([Object.keys(facCount).filter(k => k !== '神祇'), '神祇'].flat())];

// ============ 书级 ============
const bkBook = baike['诡秘之主'];
const book = {
  id: 'guimizhizhu',
  title: '诡秘之主',
  author: '爱潜水的乌贼',
  updatedAt: TODAY,
  chapterCount: 1399,
  summary: (bkBook ? (bkBook.abstract || bkBook.desc) : '').slice(0, 400) || '爱潜水的乌贼创作的西方幻想长篇小说：穿越者周明瑞成为克莱恩·莫雷蒂，在蒸汽与机械的时代一步步晋升序列，最终登临“愚者”神座。',
  factions,
  generations: [...new Set(Object.values(PATH_FORMAL))],
  stats: { tiers: { 1: out.filter(c => c.tier === 1).length, 2: out.filter(c => c.tier === 2).length, 3: out.filter(c => c.tier === 3).length } },
  factionEntities,
  systemPage: { realms, xianji },
  characters: out,
};

// ============ 输出 ============
const DST = path.join(__dirname, '..', '..', 'plugin', 'data', 'guimizhizhu.json');
fs.writeFileSync(DST, JSON.stringify(book));
const size = (fs.statSync(DST).size / 1024).toFixed(0);
console.log(`✓ ${DST} (${size}KB)`);
console.log(`人物 ${out.length}：tier1 ${book.stats.tiers[1]} / tier2 ${book.stats.tiers[2]} / tier3 ${book.stats.tiers[3]}`);
console.log(`势力 ${factions.length}（卡 ${factionEntities.length}）、途径 ${book.generations.length}`);
// 同步 plugin-src
const PS = path.join(__dirname, '..', '..', 'plugin-src', 'public', 'data');
fs.mkdirSync(PS, { recursive: true });
fs.copyFileSync(DST, path.join(PS, 'guimizhizhu.json'));
const idxPath = path.join(__dirname, '..', '..', 'plugin', 'data', 'index.json');
const idx = new Set(JSON.parse(fs.readFileSync(idxPath, 'utf8')));
idx.add('data/guimizhizhu.json');
fs.writeFileSync(idxPath, JSON.stringify([...idx]));
fs.copyFileSync(idxPath, path.join(PS, 'index.json'));
console.log('✓ 已同步 plugin-src/public/data + index.json:', [...idx].join(', '));
console.log('\nbuild notes:');
warn.forEach(w => console.log(' ', w));
