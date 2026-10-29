// 2字候选上下文抽检: 找"独立出现"(不被已知3字名吸收)的句子样本
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapters = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw', 'chapters.json'), 'utf8'));
const stats = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw', 'name-stats.json'), 'utf8'));

// 已知3字名集合
const known3 = new Set(stats.filter(s => s.kind === 'surname3' && s.total >= 60).map(s => s.name));

const targets = process.argv[2] ? process.argv[2].split(',') : ['李曦','李周','周巍','李玄','李渊','李绛','李清','李阙','李承','李遂','萧初','杨锐','金羽','安鹧','金眸','陈鸯','黎泾','周洛'];

for (const name of targets) {
  // 找到独立出现位置: 前面不是【,后面不是known3的延伸
  const samples = [];
  let standalone = 0;
  outer:
  for (const c of chapters) {
    const t = c.text;
    let i = 0;
    while ((i = t.indexOf(name, i)) !== -1) {
      const after = t.slice(i + name.length, i + name.length + 1);
      const ext = after && known3.has(name + after);
      if (!ext) {
        standalone++;
        if (samples.length < 3) {
          const s = Math.max(0, i - 40), e = Math.min(t.length, i + name.length + 50);
          samples.push(`第${c.no}章: …${t.slice(s, e).replace(/\n/g, ' ')}…`);
        }
      }
      i += name.length;
    }
    if (samples.length >= 3 && standalone > 50) break outer;
  }
  console.log(`\n### ${name}  独立出现≈${standalone}`);
  samples.forEach(s => console.log('  ' + s));
}
