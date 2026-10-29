const fs = require('fs');
const raw = fs.readFileSync('repo/角色/克莱恩·莫雷蒂.md', 'utf8').replace(/\r\n?/g, '\n');
const re = new RegExp('^## 外貌\\s*\\n([\\s\\S]*?)(?=^##(?!#)\\s)', 'm');
const m = raw.match(re);
console.log('match:', m ? m[1].slice(0, 60) : 'NULL');
const re2 = new RegExp('^## 尊名\\s*\\n([\\s\\S]*?)(?=^##(?!#)\\s)', 'm');
console.log('尊名:', raw.match(re2) ? 'OK' : 'NULL');
// 尊名段的别名正则
const zun = raw.match(re2);
if (zun) {
  const als = [...zun[1].matchAll(/^[-*]?\s*["“]([^"”：\n]{2,20})["”]：/gm)].map(x => x[1]);
  console.log('尊名条目:', als);
  const als2 = [...zun[1].matchAll(/^[-*]?\s*([^:\n：]{2,15})：/gm)].map(x => x[1].trim());
  console.log('无引号条目:', als2);
}
