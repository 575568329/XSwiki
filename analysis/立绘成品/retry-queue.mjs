// 自动重试脚本 v2（ESM）：产物文件 mtime 校验判定成功
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const QUEUE = ['pannadiya', 'yilishabai', 'yuwangmushu', 'sailinnawude', 'xilisiaruipisi', 'shalun'];
const NODE = 'C:/Users/fjyu9/AppData/Local/nvm/v22.22.2/node.exe';
const DIR = 'D:/cursorObject/小说Wiki/analysis/立绘成品';
const LOG = DIR + '/retry-queue.log';
const START = Date.now();

function log(msg) {
  fs.appendFileSync(LOG, new Date().toISOString().slice(11, 19) + ' ' + msg + '\n');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function produced(id) {
  const f = `${DIR}/${id}-${id}_nowm.jpg`;
  try { return fs.statSync(f).mtimeMs > START; } catch { return false; }
}

async function main() {
  log('重试队列 v2 启动: ' + QUEUE.join(', '));
  const remaining = [...QUEUE];
  let round = 0;
  while (remaining.length > 0) {
    round++;
    let ok = false;
    try {
      const res = await fetch('http://127.0.0.1:9090/auth/status', { signal: AbortSignal.timeout(5000) });
      const j = await res.json();
      ok = j.logged_in && j.is_ready_flag;
    } catch { ok = false; }
    if (!ok) {
      log('服务不可用，60s 后重试');
      await sleep(60000);
      continue;
    }
    const id = remaining[0];
    log(`r${round} 生成: ${id}`);
    try {
      execFileSync(NODE, ['gen-batch.mjs', id], {
        cwd: DIR, encoding: 'utf8', timeout: 300000
      });
    } catch (e) { /* 输出不可靠，以产物 mtime 为准 */ }
    if (produced(id)) {
      log('产物确认: ' + id);
      remaining.shift();
    } else {
      log(`产物缺失: ${id} → 120s 后重试`);
      await sleep(120000);
    }
    if (round > 40) { log('超过 40 轮，终止'); break; }
  }
  log('队列全部完成');
}
main();
