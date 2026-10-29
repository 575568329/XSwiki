// 提取 fanren-wiki index.html 里的 DATA 数据结构
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, 'repo', 'public', 'index.html'), 'utf8');

const start = html.indexOf('const DATA = {}');
const end = html.indexOf('const REFS', start);
const seg = html.slice(start, end);
const keys = [...seg.matchAll(/DATA\.([a-zA-Z0-9_]+) = \[/g)].map(m => m[1]);
console.log('篇章 keys:', keys.length, keys.join(', '));

// 按 key 切段统计
let total = 0;
for (const k of keys) {
  const i = seg.indexOf(`DATA.${k} = [`);
  const j = seg.indexOf('\n];', i);
  const body = seg.slice(i, j);
  const n = (body.match(/\{n:/g) || []).length;
  total += n;
  console.log(' ', k, n);
}
console.log('合计条目:', total);

// 样例
const s = seg.indexOf('DATA.qixuanmen = [');
console.log('\n样例:', seg.slice(s + 18, s + 700).slice(0, 640));
