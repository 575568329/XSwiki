// 人物立绘生成 v2：CogView-4 全身立绘(720x1440) + glm-4.5v 视觉质检 + 不合格自动重试
// 用法: export ZHIPUAI_API_KEY=... && node gen-images.mjs
// 策略（用户拍板）: 每人1张，QA<7分重试1次，取高分
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ZHIPUAI_API_KEY;
if (!KEY) { console.error('缺少 ZHIPUAI_API_KEY'); process.exit(1); }
const MODEL = process.env.COGVIEW_MODEL || 'cogview-3-flash';
const SIZE = '768x1344'; // 全身立绘(免费模型支持)
const PASS = 7;          // QA 及格线
const tasks = JSON.parse(fs.readFileSync(path.join(__dirname, 'portrait-prompts.json'), 'utf8'));
const IMG = path.join(__dirname, '..', 'plugin', 'data', 'images');
fs.mkdirSync(IMG, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function gen(prompt) {
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, size: SIZE }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const j = await res.json();
  const url = j.data?.[0]?.url;
  if (!url) throw new Error('无图片url');
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

// 视觉质检: 返回 {score, brief}（评分锚点固定，减少打分波动）
async function qa(buf, t) {
  const b64 = buf.toString('base64');
  const q = `这是AI生成的小说人物全身立绘（目标：写实古装人像）。目标人设：${t.gender === '女' ? '女性' : '男性'}修士，${t.prompt.split('：')[1] || ''}。
按以下锚点严格打分（总分10）：
- 基础5分（写实质感非动漫 + 全身构图头到脚完整），任一不满足各扣2分
- 出现任何文字/书法/印章/水印：扣3分
- 手指畸形/肢体崩坏：扣2分
- 核心人设特征（按目标人设核对）：每缺失或错误还原一项扣1.5分
最后单独一行输出：评分：X/10`;
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'glm-4.5v',
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64 } },
        { type: 'text', text: q },
      ] }],
    }),
  });
  const j = await res.json();
  if (!j.choices) throw new Error('QA失败: ' + JSON.stringify(j).slice(0, 120));
  const txt = j.choices[0].message.content;
  const m = txt.match(/评分[:：]\s*(\d+(?:\.\d+)?)\s*\/\s*10/);
  return { score: m ? parseFloat(m[1]) : 0, brief: txt.split('\n').slice(0, 4).join(' ').slice(0, 150) };
}

(async () => {
  const filter = process.argv[2] || '';
  const todo = tasks.filter(t => !fs.existsSync(path.join(IMG, `${t.id}.png`)) && t.id.includes(filter));
  console.log(`待生成 ${todo.length}/${tasks.length}（模型${MODEL} ${SIZE} 及格线${PASS}分）`);
  const report = [];
  for (const t of todo) {
    try {
      let buf = await gen(t.prompt);
      let { score, brief } = await qa(buf, t);
      let used = 1;
      if (score < PASS) {
        process.stdout.write(`  ${t.name} 首张${score}分，重试… `);
        await sleep(1000);
        const buf2 = await gen(t.prompt);
        const r2 = await qa(buf2, t);
        used = 2;
        if (r2.score > score) { buf = buf2; score = r2.score; brief = r2.brief; }
      }
      fs.writeFileSync(path.join(IMG, `${t.id}.png`), buf);
      report.push({ name: t.name, id: t.id, score, used });
      console.log(`✓ ${t.name} ${score}分(${used}张)`);
    } catch (e) {
      report.push({ name: t.name, id: t.id, error: e.message, used: 0 });
      console.log(`✗ ${t.name}: ${e.message}`);
      if (String(e.message).includes('401')) { console.error('key无效中止'); break; }
    }
    await sleep(1200);
  }
  // 汇总 + manifest
  const ok = report.filter(r => !r.error);
  fs.writeFileSync(path.join(__dirname, 'gen-report.json'), JSON.stringify(report, null, 1));
  const ids = fs.readdirSync(IMG).filter(f => f.endsWith('.png')).map(f => f.replace('.png', ''));
  fs.writeFileSync(path.join(__dirname, '..', 'plugin', 'data', 'images.json'), JSON.stringify(ids));
  console.log(`\n完成: 成功${ok.length} 失败${report.length - ok.length} 平均分${(ok.reduce((s, r) => s + r.score, 0) / Math.max(ok.length, 1)).toFixed(1)}`);
  const low = ok.filter(r => r.score < PASS);
  if (low.length) console.log('仍不及格(可手动重跑续传):', low.map(r => `${r.name}${r.score}分`).join(', '));
})();
