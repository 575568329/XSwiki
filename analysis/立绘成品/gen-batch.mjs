#!/usr/bin/env node
// 批量生成驱动：读 prompts/<id>.prompt.txt → gen-portrait.mjs i2i（垫 FE-013 风格参考图）→ 自动去水印
// 用法：node gen-batch.mjs <id1> <id2> ...（out 名 = <id>-<slug>，见 SLUGS）
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const GEN = path.join(ROOT, 'skills', 'dbst', 'scripts', 'gen-portrait.mjs');
const REF = path.join(ROOT, 'tools', 'handraw-style', 'images', 'individual', 'FE', 'FE-013.webp');
// 按书垫图：东方书默认 FE-013；西幻书（黎明之剑/诡秘）用 FH-040 中世纪暗黑水墨
const FH = path.join(ROOT, 'tools', 'handraw-style', 'images', 'individual', 'FH', 'FH-040.webp');
const REF_BY_ID = { gaowensaixier: FH, hupo: FH, ruibeikasaixier: FH, hedisaixier: FH };

const SLUGS = {
  liximing: '谒天门',
  lizhouwei: '负伤驰援立天门',
  litongya: '寒云峰断道',
  lijiangqian: '金簪化枪',
  lixuanxuan: '请符大典',
  liyuanjiao: '独斗司徒末',
  lixizhi: '礁海按剑',
  lixijun: '筑基踏雪',
  lujiangxian: '玄池认亲',
  liquewan: '雷湖慑立',
  lixuanfeng: '城头迎客',
  chibuzi: '东海擒灵雀',
  liuchangdie: '雷鼓破阵',
  lisuining: '雪岸独立',
  lixiangping: '青石试弓',
  xiaochuting: '风雨蓑笠行',
  tinglan: '紫玉台茶会',
  liyuanping: '雪野望台阅兵',
  kongheng: '月夜辞湖',
  yangruiyi: '雷暗青铜台阶',
  ningwan: '寒夜抱剑',
  lichijing: '倚山城头',
  chendonghe: '阵前老卒',
  cuijueyin: '大漠悬殿',
  liyuanxiu: '冬雪祭坛',
  limutian: '守镜打盹',
  xiaoguiluan: '雪后静室',
  beihailongwang: '长流山主位',
  anzheyu: '白绸殿宴',
  xiaoyan: '三年之约',
  yaochen: '炼药授课',
  xiaoxuner: '雪夜重逢',
  xiaoyixian: '山顶驭鹰',
  cailin: '蛇人女王',
  ziyan: '古龙化形',
  yunyun: '山野重逢',
  huntiandi: '吞丹',
  xuqian: '犬戎山崖',
  weiyuan: '午门青衣',
  limiaozhen: '白马银枪',
  yuanjingdi: '八卦台',
  jianzheng: '雪夜盘坐',
  shenshu: '镇魔涧',
  wushen: '终末祭台',
  gaowensaixier: '伪神颅骨大典',
  hupo: '墓室初擒',
  ruibeikasaixier: '开国典礼',
  hedisaixier: '魔能列车',
  kelaienmoleidi: '码头月夜',
  ameng: '废树拭镜',
  luosaiergusitafu: '黑皇帝神座',
  dengenshimisi: '走廊致意',
  foersiwoer: '甜点桌',
  xiudiercha: '花园信使犬',
  aimulinhuaite: '猩红酒杯',
  aosaikusi: '白袍天使',
  aerjieweierxun: '暴雨掌心雪',
  jiadeliya: '星光长桥',
  yadang: '尸骨教堂',
  dailikeboge: '推门见光',
  helabogen: '烛下圣像',
  azikeaigesi: '夜墓白花',
  badehaier: '悬崖晨曦',
  lieaodeluo: '遗迹造像',
  meigaoousi: '门口来访者',
  andesenhude: '街口口琴',
  zhenshizaowuzhu: '倒吊神像',
  oumibeila: '祈祷室圣像',
  yinsizangeweier: '遗迹之门',
  paliesisuoluoyaside: '梦境肖像',
  bansenmoleidi: '教堂婚礼',
  meilishamoleidi: '阳光仪式',
  amannixisi: '星空高背椅',
  xuanyewang: '石棺静立',
};

const ids = process.argv.slice(2);
if (!ids.length) { console.error('用法: node gen-batch.mjs <id...>'); process.exit(1); }

for (const id of ids) {
  const promptFile = path.join(HERE, 'prompts', `${id}.prompt.txt`);
  const prompt = fs.readFileSync(promptFile, 'utf8').trim();
  const out = path.join(HERE, `${id}-${SLUGS[id] || id}`);
  console.log(`\n===== [${id}] ${SLUGS[id]} =====`);
  const t0 = Date.now();
  try {
    execFileSync('node', [GEN, 'i2i', '--ref', REF_BY_ID[id] || REF, '--prompt', prompt, '--out', out], { stdio: 'inherit', timeout: 200000 });
  } catch (e) {
    console.error(`[${id}] 第一次失败（${Math.round((Date.now()-t0)/1000)}s）：${e.status || ''}，重试一次`);
    try {
      execFileSync('node', [GEN, 'i2i', '--ref', REF_BY_ID[id] || REF, '--prompt', prompt, '--out', out], { stdio: 'inherit', timeout: 200000 });
    } catch (e2) {
      console.error(`[${id}] 重试仍失败，跳过：${e2.message.slice(0, 200)}`);
      continue;
    }
  }
  console.log(`[${id}] 完成，用时 ${Math.round((Date.now()-t0)/1000)}s -> ${out}_nowm.jpg`);
  for (const raw of [out + '.raw.png', out + '.raw_nowm.jpg']) {
    if (fs.existsSync(raw)) fs.rmSync(raw); // 成品目录只保留无水印 _nowm.jpg
  }
}
console.log('\n全部完成');
