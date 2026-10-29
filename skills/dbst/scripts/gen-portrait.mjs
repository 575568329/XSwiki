#!/usr/bin/env node
// dbst 参考实现 —— doubao2api 小说成名场景/立绘管线（生成+去水印一条龙）
// 依赖：仅 Node 内置模块 + tools/doubao2api/.venv（PIL 用于压参考图、remove_wm.py 去水印）
// 注意：依赖项目根下的 tools/，通过 junction 调用时已用 realpath 解析回真实路径
//
// 用法：
//   node gen-portrait.mjs health
//   node gen-portrait.mjs t2i --prompt "写实古装人像，全身立绘：…" --out output/某人-定妆
//   node gen-portrait.mjs i2i --ref output/某人-定妆_nowm.jpg --prompt "参考图中的人物，严格保持…" --out output/某人-场景
// 产物：<out>.raw.png（带水印原图） + <out>_nowm.jpg（去水印成品）

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// junction 会把路径指向 ~/.zcode/skills/...，realpath 拉回项目内真实位置
const THIS_FILE = fs.realpathSync(fileURLToPath(import.meta.url));
const ROOT = path.resolve(THIS_FILE, '../../../..'); // skills/dbst/scripts/ → 项目根
const BASE = process.env.DOUBAO2API_BASE || 'http://127.0.0.1:9090';
const PY = path.join(ROOT, 'tools', 'doubao2api', '.venv', 'Scripts', 'python.exe');
const REMOVE_WM = path.join(ROOT, 'tools', 'doubao2api', 'remove_wm.py');

function requireEnv() {
  if (!fs.existsSync(PY)) {
    throw new Error(`找不到 doubao2api venv: ${PY}\n先按 SKILL.md §一 部署并启动服务`);
  }
}

async function api(endpoint, body) {
  // Node fetch 发 UTF-8 无编码问题；不要改回 curl -d 直传中文（Windows 下会坏）
  const res = await fetch(BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${endpoint} HTTP ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  }
  return j;
}

async function health() {
  const r = await fetch(BASE + '/auth/status');
  const j = await r.json();
  const ok = j.logged_in === true && j.is_ready_flag === true;
  console.log(ok
    ? '服务就绪（已登录）'
    : `未就绪: logged_in=${j.logged_in} is_ready_flag=${j.is_ready_flag} → 浏览器开 http://127.0.0.1:9090/admin 扫码面板登录`);
  if (!ok) process.exitCode = 1;
}

// 参考图压到 1024px JPEG（~100KB 级）：原图 2.4MB 直传会报豆包 params invalid
function resizeRef(src) {
  const dst = src.replace(/\.[^.]+$/, '') + '.ref1024.jpg';
  execFileSync(PY, ['-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
w = 1024
if im.width > w:
    im = im.resize((w, int(im.height * w / im.width)))
im.save(sys.argv[2], "JPEG", quality=85)
`, src, dst]);
  return dst;
}

// 去右下角"豆包AI生成"水印；patch=羽化覆盖无痕（推荐），crop=裁底部保底
function stripWatermark(file, mode = 'patch', cleanPath = '') {
  execFileSync(PY, [REMOVE_WM, file, '--mode', mode], { stdio: 'inherit' });
  const produced = file.replace(/\.[^.]+$/, '') + '_nowm.jpg';
  if (cleanPath && produced !== cleanPath) fs.renameSync(produced, cleanPath);
  return cleanPath || produced;
}

async function generate(endpoint, body, out) {
  const data = await api(endpoint, body);
  const d = data.data && data.data[0] || {};
  const raw = out + '.raw.png';
  // 正常返回 b64_json；clean 路径失败时回退 url（带签名公开地址，直接 GET）
  if (d.b64_json) {
    fs.writeFileSync(raw, Buffer.from(d.b64_json, 'base64'));
  } else if (d.url) {
    console.warn('clean 路径失败，回退签名 URL 下载（含水印，稍后 remove_wm 处理）');
    const buf = Buffer.from(await (await fetch(d.url)).arrayBuffer());
    fs.writeFileSync(raw, buf);
  } else {
    throw new Error('响应无 b64_json/url: ' + JSON.stringify(data).slice(0, 200));
  }
  const clean = stripWatermark(raw, 'patch', out + '_nowm.jpg');
  console.log('完成: ' + clean);
  return clean;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = (name, def) => {
    const i = rest.indexOf('--' + name);
    return i >= 0 && i + 1 < rest.length ? rest[i + 1] : def;
  };

  if (cmd === 'health') return health();

  const prompt = arg('prompt');
  const out = arg('out', 'portrait-' + Date.now());
  if (!prompt) {
    console.error('缺少 --prompt。用法见文件头注释或 SKILL.md §二');
    process.exitCode = 1;
    return;
  }

  if (cmd === 't2i') {
    requireEnv();
    await generate('/v1/images/generations', {
      prompt,
      size: arg('size', '864x1152'),
      response_format: 'b64_json',
    }, out);
  } else if (cmd === 'i2i') {
    requireEnv();
    const ref = arg('ref');
    if (!ref || !fs.existsSync(ref)) {
      console.error('i2i 需要 --ref 指向已选定的定妆图（人物一致性唯一手段）');
      process.exitCode = 1;
      return;
    }
    const small = resizeRef(ref);
    await generate('/v1/images/edits', {
      prompt,
      size: arg('size', '864x1152'),
      response_format: 'b64_json',
      images: ['data:image/jpeg;base64,' + fs.readFileSync(small).toString('base64')],
    }, out);
  } else {
    console.error('未知命令。用法: gen-portrait.mjs health | t2i --prompt … | i2i --ref … --prompt …');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('失败:', e.message);
  process.exitCode = 1;
});
