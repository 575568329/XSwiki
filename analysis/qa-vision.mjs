// 立绘视觉质检: 直调 glm-4.5v (base64直传, 无需图床)
// 用法: export ZHIPUAI_API_KEY=... && node qa-vision.mjs [人物id ...] 不带参数=质检全部已有立绘
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ZHIPUAI_API_KEY;
if (!KEY) { console.error('缺少 ZHIPUAI_API_KEY'); process.exit(1); }
const IMG = (p = '') => path.join(__dirname, '..', 'plugin', 'data', 'images', p);

const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, 'portrait-prompts.json'), 'utf8'));
const byId = new Map(prompts.map(p => [p.id, p]));

const args = process.argv.slice(2);
const files = args.length ? args.map(a => a.endsWith('.png') ? a : a + '.png')
  : fs.readdirSync(IMG()).filter(f => f.endsWith('.png'));

for (const f of files) {
  const id = f.replace('.png', '');
  const p = byId.get(id);
  const b64 = fs.readFileSync(IMG(f)).toString('base64');
  const q = `这是AI生成的小说人物立绘。目标人设：${(p ? p.prompt.split('：').pop() : id)}。
请严格评价：1)画风 2)关键特征逐项核对 3)瑕疵（多指/畸形/水印/乱入文字）4)统一基调适配度，1-10打分。简洁分点，别客气。`;
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
  const out = j.choices ? j.choices[0].message.content : ('ERROR ' + JSON.stringify(j).slice(0, 200));
  console.log(`\n===== ${p ? p.name : id} (${f}) =====\n${out}`);
  fs.writeFileSync(path.join(__dirname, 'qa', `${id}.md`), out);
}
