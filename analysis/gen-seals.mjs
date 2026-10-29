// 印章头像生成器: 每人物一枚古风印章 SVG（内联进书目 JSON，零外部文件）
// 设计: 圆角方印 + 势力/层级配色 + 姓氏(末字)大字 + 世代/势力小字 + 印章磨损纹理感(半透明边框)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'plugin', 'data', 'xuanjianxianzu.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// 配色: 势力主色（古风低饱和）
const FACTION_COLOR = {
  '李家': ['#3d4a5c', '#c9d4e0'],      // 黛青
  '青池宗': ['#2f5d52', '#cfe8df'],    // 碧青
  '金羽宗': ['#8a6d2f', '#f0e2bd'],    // 鎏金
  '修越宗': ['#54428e', '#ddd4f0'],    // 紫垣
  '明阳': ['#a2482e', '#f2d9c9'],      // 赤阳
  '北寰宗': ['#34597a', '#d0e0ee'],    // 玄北
  '太阴一府': ['#4a4a63', '#d9d9e6'],  // 太阴
};
const TIER_COLOR = { 1: ['#6b3fa0', '#e8dcf5'], 2: ['#2f5d8a', '#d6e4f0'], 3: ['#5a5a5a', '#e2e2e2'] };
const pickColor = c => FACTION_COLOR[c.faction] || TIER_COLOR[c.tier] || TIER_COLOR[3];

function sealSvg(c) {
  const [bg, fgLight] = pickColor(c);
  // 大字: 姓氏（复姓取前2字，单字姓取姓；无姓取名字首字）
  const name = c.name || '';
  const big = name.length >= 3 ? name[0] : name.slice(0, name.length > 1 ? 1 : 1);
  // 小字: 世代的字辈 > 势力 > tier
  const zibei = (c.generation.match(/（(.)字辈）/) || [])[1];
  const small = zibei || (c.faction && c.faction.slice(0, 2)) || (c.tier === 1 ? '核心' : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="14" fill="${bg}"/>
<rect x="5.5" y="5.5" width="89" height="89" rx="10" fill="none" stroke="${fgLight}" stroke-width="1.6" opacity="0.55"/>
<rect x="9" y="9" width="82" height="82" rx="8" fill="none" stroke="${fgLight}" stroke-width="0.8" opacity="0.3"/>
<text x="50" y="${small ? 60 : 66}" font-size="${big.length > 1 ? 34 : 46}" fill="#ffffff" text-anchor="middle" font-family="KaiTi,STKaiti,'Noto Serif SC',serif" font-weight="700">${big}</text>
${small ? `<text x="50" y="82" font-size="13" fill="${fgLight}" text-anchor="middle" font-family="KaiTi,STKaiti,serif" opacity="0.9">${small}</text>` : ''}
</svg>`;
}

let n = 0;
for (const c of data.characters) {
  c.seal = sealSvg(c);
  n++;
}
fs.writeFileSync(FILE, JSON.stringify(data));
console.log(`已为 ${n} 人生成印章 SVG，总增量 ${(JSON.stringify(data).length / 1024).toFixed(0)}KB（整库）`);
