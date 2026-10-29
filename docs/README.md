# docs 索引

> 新会话/新人从这里进。**换一本书加数据 → 先读《数据获取统计》§〇 决策流程**，方法细节在 skill `novel-characters-db`（可直接调用）。

| 文档 | 内容 | 什么时候读 |
|---|---|---|
| [数据获取统计.md](数据获取统计.md) | **新书接入决策流程（§〇）** + 三条取数通道（wiki 仓库+百科API / wiki 站 / 原文抓取）+ 原文→结构化全链管线 + 热更新 + 视觉资产定案 | 加新书、重跑数据、了解数据从哪来 |
| [热榜收集清单.md](热榜收集清单.md) | 2026-10 网络热度小说榜单（分梯队+建议取数通道） | 挑下一本收录的书 |
| [聊天记录整理.md](聊天记录整理.md) | 项目历史会话索引（4 主会话+54 子代理）、八轮演进史、用户约束、遗留待办 | 接手项目、找"当初为什么这么做" |
| [热更新设计.md](热更新设计.md) | 不发版加书的架构（manifest+sha256+ETag）、部署 runbook（§六）、E2E 记录 | 部署数据服务器、加书后同步 |
| [展示设计.md](展示设计.md) | 前端设计 v1-v5、四 Tab 布局、双主题体系、实施记录 §21-26 | 改前端、加新视图 |
| [百科核对报告.md](百科核对报告.md) | 百度百科三方向核对结果与 25+ 处修正明细 | 怀疑数据有错、做下一轮核对 |
| [发版清单.md](发版清单.md) | uTools 上架总方案：拦路项、文件清理、目录纪律、数据存储、合规风险、13 项拍板清单（五角色审阅版） | 准备发版、动 plugin.json/preload/config、清理文件 |
| [埋点设计.md](埋点设计.md) | 匿名使用统计方案：复用同机 tracker-server:9420 + ObjectConsole 看板，插件端 ~100 行 | 要看用户操作数据、接埋点 |

## 一分钟上手（加新书）

1. 判定取数通道：docs/数据获取统计.md §〇（wiki 生态 → 百科核对 → wiki 站补体系 → 原文兜底）
2. 跑管线：`analysis/`（通道 C）或 `analysis/guimi/`（通道 A）参考实现；skill `novel-characters-db` 有完整步骤
3. 构建纪律：`build-data` → `baike-fix` → `merge-v2` → `gen-system` → `gen-seals` → `hygiene-fix` → `sync-data`（数据三副本+manifest）→ `sync-plugin`（插件资产四件 → dist+public）
   - **图片不归这两个脚本管**：`plugin/data/images/` 手动同步 `plugin-src/public/data/images/` 后 vite build（立绘不参与热更新，server/data 无 images）
   - 一次性中间产物进 `analysis/_archive/`（2026-10-29 起的归档纪律），管线脚本输入（book_source.txt/book_*.html/candidates.json 等）**不是**垃圾，勿归档
4. 验证：`node --test "tests/*.test.mjs"` 全绿 → `plugin-src && npm run build` → 浏览器过一遍四 Tab（`node plugin-src/preview-dist.js` → 5177）

## 相关位置

- skill：`skills/novel-characters-db/`（junction 到 ~/.zcode/skills；ec-skills 仓库有同步副本）
- 数据三副本：`plugin/data/`（唯一编辑源）→ `plugin-src/public/data/`（dev）→ `server/data/`（热更新包），`node analysis/sync-data.mjs` 同步
- 历史聊天记录：`~/.zcode/cli/db/db.sqlite`（session/message/part 表；整理稿见聊天记录整理.md）
