// 从画像卡生成人物立绘提示词（写实古装人像 · 全身立绘 统一基调）
// 基调: 2026-10-22 用户拍板 —— 写实古装人像/全身/1张+不合格重试
// 产出 analysis/portrait-prompts.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'plugin', 'data', 'xuanjianxianzu.json'), 'utf8'));

// 统一基调（所有人物完全一致，只换人物段）
const TONE = '中国古装写实人物全身像，全身远景构图，单人站姿，人物从头到脚完整呈现：头顶位于画面上部、双脚踩地位于画面底部，全身与鞋履完整可见，占画面高度三分之二以上，写实摄影级质感，真实面部结构与皮肤纹理，电影级自然光影，明代服饰形制考据，深色淡雅背景微带水墨云雾远山，构图庄重简洁';
const NO_TEXT = '，画面纯净，背景与服装上没有任何书法字、题诗、题字、落款、印章、签名、水印';

// 人物特征清洗：去人名括号、去"（讹）"类标注、压缩长度
function cleanDesc(c) {
  const p = c.persona || {};
  let parts = [];
  if (p.appearance) parts.push(p.appearance);
  if (c.identity) parts.push(c.identity.replace(/（[^）]*）/g, '').slice(0, 40));
  let s = parts.join('，')
    .replace(/（[^）]*）/g, '')     // 括号注释全去（含名字、讹传）
    .replace(/[『』「」"]/g, '')
    .replace(/李家|黎泾李氏/g, '')
    .slice(0, 80);
  if (!s || s.length < 6) s = (c.gender === '女' ? '女修士，束发道袍' : '男修士，束发道袍，腰间佩剑');
  return s;
}

const tasks = [];
for (const c of data.characters.filter(x => x.tier === 1)) {
  const desc = cleanDesc(c);
  const g = c.gender === '女' ? '女性' : c.gender === '男' ? '男性' : '';
  tasks.push({
    id: c.id, name: c.name, gender: c.gender || '男',
    prompt: `${TONE}：${g}修士，${desc}${NO_TEXT}`,
    aspect: '1:2',
    outfile: `plugin/data/images/${c.id}.png`,
  });
}
fs.writeFileSync(path.join(__dirname, 'portrait-prompts.json'), JSON.stringify(tasks, null, 1));
console.log(`生成 ${tasks.length} 条提示词（写实古装·全身立绘基调）`);
tasks.slice(0, 2).forEach(t => console.log('-', t.name, '::', t.prompt.slice(0, 120) + '…'));
