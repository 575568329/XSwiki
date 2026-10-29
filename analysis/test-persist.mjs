// 双会话持久化端到端（模拟 uTools 插件两次打开）
// 用法: node test-persist.mjs session1 | session2 | cleanup
// session1 = 插件打开+检查更新(服务器在线, 应下载测试书) ; session2 = 全新进程+服务器离线(数据必须还在)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(os.homedir(), '.utool-novel-characters').replace('utool', 'utools');
// 模拟 uTools 插件目录（无 package.json，CJS 加载，与 dist 实机一致）
const PRELOAD_DIR = path.join(__dirname, '.test-plugin');
const PRELOAD = path.join(PRELOAD_DIR, 'preload.js');

function setupTestPlugin() {
  fs.mkdirSync(path.join(PRELOAD_DIR, 'data'), { recursive: true });
  const src = path.join(__dirname, '..', 'plugin-src', 'public');
  fs.copyFileSync(path.join(src, 'preload.js'), PRELOAD);
  fs.copyFileSync(path.join(src, 'config.json'), path.join(PRELOAD_DIR, 'config.json'));
  for (const f of ['xuanjianxianzu.json', 'index.json', 'images.json']) {
    fs.copyFileSync(path.join(src, 'data', f), path.join(PRELOAD_DIR, 'data', f));
  }
}
if (process.argv[2] !== 'cleanup') setupTestPlugin();

function loadPreload() {
  // preload.js 给 window.services 赋值 —— 模拟 uTools 环境
  global.window = {};
  require(PRELOAD); // CJS
  return global.window.services;
}

const cmd = process.argv[2];
if (cmd === 'session1') {
  console.log('[会话1] 插件打开，服务器在线，手动检查更新…');
  const svc = loadPreload();
  const r = await svc.checkUpdates(true);
  console.log('[会话1] 结果:', JSON.stringify(r));
  const files = fs.readdirSync(CACHE).filter(f => f.endsWith('.json'));
  console.log('[会话1] 缓存目录:', CACHE);
  console.log('[会话1] 落盘文件:', files.join(', '));
  console.log('[会话1] getBooks:', svc.getBooks().map(b => b.id).join(', '));
  console.log(r.updated && files.includes('demo-novel.json') ? '[会话1] ✓ 下载并持久化成功' : '[会话1] ✗ 失败');
} else if (cmd === 'session2') {
  console.log('[会话2] 全新进程（模拟插件重开），服务器已离线…');
  const svc = loadPreload();
  const books = svc.getBooks();
  console.log('[会话2] getBooks:', books.map(b => `${b.id}:${b.stats.total}人`).join(', '));
  const hit = svc.search('demo-novel', '测试');
  console.log('[会话2] 搜索"测试":', hit.map(c => c.name).join(','));
  // TTL 内静默检查也不应报错
  const r = await svc.checkUpdates(false);
  console.log('[会话2] 静默检查(应ttl跳过):', JSON.stringify(r));
  const r2 = await svc.checkUpdates(true);
  console.log('[会话2] 手动检查(应offline降级):', JSON.stringify(r2));
  const ok = books.find(b => b.id === 'demo-novel') && hit.length;
  console.log(ok ? '[会话2] ✓ 跨会话+断网 数据持久' : '[会话2] ✗ 数据丢失');
} else if (cmd === 'cleanup') {
  for (const f of ['demo-novel.json', 'demo-novel.json.tmp']) {
    try { fs.rmSync(path.join(CACHE, f)); } catch {}
  }
  try {
    const st = JSON.parse(fs.readFileSync(path.join(CACHE, 'state.json'), 'utf8'));
    delete (st.files || {})['demo-novel.json'];
    fs.writeFileSync(path.join(CACHE, 'state.json'), JSON.stringify(st));
  } catch {}
  try { fs.rmSync(path.join(__dirname, '..', 'server', 'data', 'demo-novel.json')); } catch {}
  console.log('已清理测试数据');
} else {
  console.log('用法: node test-persist.mjs session1|session2|cleanup');
}
