---
name: novel-characters-db
# 本副本为【项目内自包含版】，位于本项目 skills/novel-characters-db/，已 junction 注册到 ~/.zcode/skills，
# 本项目任何会话可直接调用。通用家族仓库版在 D:/Study/ec-skills/skills/（junction 到 ~/.claude 与 ~/.ecode/skills）。
# 两份以本项目版为准做增量，稳定后回灌 ec-skills（2026-10-23 已回灌：wiki/百科范式 + 新坑）。
# 本项目最新参考实现 = 本项目 analysis/ 目录（scripts/ 为其快照，wiki-pipeline/ 对应 analysis/guimi/）。
description: |
  从网络小说构建可查询的人物/设定数据库（uTools 插件形态）。两条取数范式：
  ①wiki 镜像仓库 + 百度百科开放 API（省一个量级，有 wiki 生态的书首选）；
  ②盗版书源全文抓取 + 章节真伪校验 + 姓氏 n-gram 人名普查 + 抽样窗口 roster 子代理扫描 + 归并去噪 + 核心人物画像卡 + 拼音索引。
  含多体系设定页生成、印章 SVG 头像、热更新（manifest+sha256 不发版加书）。
  Use when asked to 拆小说人物、建人物库、小说角色数据库、小说wiki、人物查询插件、角色画像批量生成、小说设定整理。
---

# novel-characters-db — 网络小说人物/设定数据库构建

把一部网络小说"分解"成结构化数据库：名字/别名/道号、身份/修为(境界或序列)/势力/世代、关系网、按章号剧情线、原文证据，
最终可搜索查询（uTools 插件 / 任意前端）。已有两部实战书目：玄鉴仙族（792 人，571 万字全文范式）、诡秘之主（310 人，wiki 范式）。

## 〇、先选取数通道（成本差一个数量级）

**新书判定顺序（命中即停）**：① GitHub/Fandom 搜"`{书名} wiki`、`{书名} skill`"有镜像仓库 → 通道 A；② 再用百科开放 API 批量拉词条卡交叉核对（通道 A 自带）；③ 有人工 wiki 站补体系设定 → 通道 B；④ 都没有、或要章号/剧情线/原文证据/龙套 → 通道 C 原文抓取自己提取（书源列表 `https://www.luoxx.top/book_source.txt`，77 源含选择器规则）。多数书 A+B 组合，纯冷门书才 C。

| 通道 | 适用 | 成本 | 产出 |
|---|---|---|---|
| **A. wiki 镜像仓库 + 百科开放 API** | 书有 Fandom wiki / LLM 生态同步库 | 极低（0 个扫描子代理） | 词条结构化段落，缺章号/剧情线 |
| **B. 权威 wiki 站点定向抓取** | 有人工维护的 wiki 站 | 低 | 体系/设定补充 |
| **C. 盗版书源全文抓取** | 要全量人物/龙套/剧情线/evidence | 高（roster 扫描 ~30 子代理） | 全本 txt + 章号定位 |

实战：诡秘之主走 A（`scaret/lord-of-mysteries-skill` 645 词条）、凡人修仙传走 A（`Lizhenghe-Chen/fanren-wiki`，资料站七库数据内嵌 index.html，括号配对提取+跨篇 baseName 合并）、玄鉴仙族走 C（24 窗 roster）。
两通道可混用：全文抓正文，百科/wiki 做权威核对。

### 通道 A 要点

**百度百科开放接口（无风控，curl/node fetch 直连，内网也通）**：

```
https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key={名字}&bk_length=60000
```

返回 infobox+abstract；歧义名靠 desc 字段校验剔除（"阿蒙"命中吕蒙）。批量+断点见 `scripts/wiki-pipeline/grab-baike.mjs`。
（百科**主站** curl/WebFetch 是 403，才需要浏览器自动化；开放接口覆盖 90% 场景。）

**wiki 仓库解析三坑**（`scripts/wiki-pipeline/parse-wiki.mjs`、`build-guimi.mjs`）：
- CRLF 的 `\r` 让非多行 `$` 和 `.` 全失效（JS `.` 不匹配 `\r`）——读入先 `replace(/\r\n?/g,'\n')`；段落前瞻写 `(?=^##(?!#)\s)`，`^## ` 会截断 `###`
- 模板字符串里正则要写 `\\s`（字面量正则不受影响）
- 称号重复词条（"五海之王"纳斯特 等）不是重定向，手工 MERGE 表归并；redirect 文件自动跳过

系列书过滤：wiki 会混入第二部内容，按"新途径整组剔除 + EXCLUDE 名单"处理。
字段映射：generation=途径/体系正式名（**正式名=序列 0 名**）、cultivation="序列N 名"、mentions=textLen、evidence=wiki 名台词、timeline 空。

### 通道 B 要点

体系/设定页以人工 wiki 为权威源（玄鉴=9433.com.cn），抓单页存 md 归档即可。

## 通道 C 流水线总览

```
① 书源探测 → ② 全本抓取 → ③ 章节真伪校验/修复 → ④ 结构化(chapters.json)
→ ⑤ 人名普查(n-gram) → ⑥ 抽样窗口 roster 扫描(子代理) → ⑦ 交叉归并+人工复核
→ ⑧ 核心人物 dossier + 画像卡(子代理) → ⑨ 构建数据(拼音/世代/势力/分级) → ⑩ 前端/插件
```

先建工作目录（独立 analysis/ + npm init，`cheerio iconv-lite pinyin-pro` 走 npmmirror），原文与中间产物不进 git。

## ① 书源探测（内网/风控环境）

公司网关常按 URL 分类拦盗版站：**http 返回 2578 字节"URL过滤"页（HTTP 200！），https 被掐 TLS（curl 35）**。判断可达必须做内容级验证：`size>5000 且 不含拦截页关键词`，http/https 都要试。拿一份何以笙箫默书源（77 源 JSON，含各站 CSS 选择器规则 + base64 广告过滤正则）批量扫描，命中后逐站搜书。GBK 站点 searchkey 要 GBK 编码。同一书多源留 2-3 个做交叉验证（关键！）。

## ② 抓取

`fetch-novel.mjs`：书页取目录 → 并发池抓正文 → `store.ndjson` 追加式落盘（**断点续传**，重跑只补缺）→ 组装 txt。要点：
- UA 带 Chrome 串；失败退避重试 4 次；并发 ≤6（对 WP 系站点友好）
- 正文选择器以书源规则为起点，**实际页面结构可能变了**（如 UU小说实际是 `#content` 而非规则里的 `.box_box`）——先 curl 一章人工核对
- gzip：node fetch 自动解压，curl 要 `--compressed`

## ③ 章节真伪校验（最重要的一步，别信盗版站）

`verify-chapters.mjs` 检四类问题，**全都要查**：

| 问题 | 特征 | 检测法 | 修复 |
|---|---|---|---|
| 假章（内容错位复制） | 书包站 866-895 章标题对、正文是 838-865 的复制 | 章节中段 1k 字符 md5 去重 | 从第二书源重抓该区间 |
| 占位章 | "正在手打中，请稍等片刻"，正文仅 100-200 字 | 正则扫全文 | 多源重抓；上游共缺则接受并记录 |
| 跳章/重号 | 章号解析后找 gap/dup | 目录序号比对 | 他源补或登记 |
| 防盗字符替换 | 的→旳、有/没互换 | 稀有字频率统计 | 量小(<100/500万字)可不管；量大需映射还原 |

相邻章衔接抽查（每 200 章读末句→首句）兜底。盗版生态常见"所有源都缺同一段"（如玄鉴 1460-1496），那是正版独有，接受并写进 README。

## ④ 结构化

`assemble.mjs`：目录按章号排序（中文数字→阿拉伯要写转换）→ 广告行清洗 → `raw/chapters.json`（[{no,title,url,text}]）。

## ⑤ 人名普查（确定性全量覆盖）

`extract-names.mjs`，姓氏 n-gram 两趟：
- 3 字名 ABC：`count(ABC)≥12 且 count(ABC)/count(AB)≥0.5`
- 2 字名 AB：`standalone = count(AB) − Σ以AB开头的3字名 ≥ 15`
- 补充：显式命名标记（道号/名为/唤作/自称）

**家族字辈稀释坑**：字辈家族（李曦明/李曦峻 共享"李曦"前缀）会把每个 3 字名的占比稀释到 <0.5，系统性漏检。补救：roster 确认的名字回头全文直扫补统计。**2 字字辈前缀（李曦/李周）不是人物**，要丢弃。

## ⑥ roster 扫描（LLM 抽样深扫）

`build-samples.mjs`：全书均分 24 窗口（每窗 ~4 万字 ≈ 8 章，标【第X章 标题】）。
每窗口派一个子代理按 `references/roster-prompt.md` 扫描，产出 `{name, aliases, note, quotes, chapters}`。

**限速坑**：子代理并发 >10 会触发账户限速（1302）。安全节奏：**3-6 并发/批**，失败的小批量重试，别一次全派。单窗扫描耗时 8-25 分钟。

note 要求"密集记录"——后一趟（画像）看不到原文，全靠 note。修仙/家族文重点记：境界、功法、道统、辈分、师徒/亲缘。

## ⑦ 归并 + 人工复核

`merge-roster.mjs`：roster × 普查交叉 → `candidates.json`（confirmed / minedOnly）。
人工复核三件事（写成 `review-data.mjs` 规则文件）：
1. **minedOnly 去噪**：高频词/称号/地名/物品混在人名里。抽"独立出现"的上下文句判断
2. **幽灵卡**：字辈 2 字前缀、化身穿马甲、称号单列 → MERGE_SAME 归并或 DROP
3. **世代/势力标签归一**：roster 花式写法 → 抽字辈字符映射到 canonical 标签

## ⑧ 核心人物画像（tier1）

`dossier.mjs` 定向素材：首现 3 章全句 + 高密度 12 章各抽 6 句 + 末现 2 章 → 每人 ~15KB 摘录文件。
子代理按 `references/profile-prompt.md` 逐人写卡（4 人/代理）：硬约束 **只用素材证据、不确定留空、timeline 按章号升序、evidence 逐字引用**。产出校验：JSON 合法/timeline 有序/evidence 长度。

## ⑨ 构建 + 核对 + 全链重跑纪律

`build-data.mjs`：卡片(t1) + roster确认(t2/t3 按提及次数分层) + mined保留(t3) → 拼音索引（**正名+所有别名都要建**，否则"weiwang"搜不到封号）→ id 去重 → 关系 id 回填 → 书目 JSON。

**权威源核对**：百科词条=读者精校友好源。跑 `baike-check.mjs` 三方向核对（族谱/势力/体系），偏差产出 `baike-fix.mjs` 幂等修正集（build-data 后必跑）。

**全链重跑纪律（已踩坑）**：`build-data` 重跑会覆盖下游产物，之后必须依次重跑：
`merge-v2.mjs`（画像卡+势力实体）→ `gen-system.mjs`（体系页+书目 theme）→ `gen-seals.mjs`（印章）→ `baike-fix.mjs`（百科修正）→ `hygiene-fix.mjs`（拼音去噪/防剧透/途径回填，幂等）→ `sync-data.mjs`（同步 public/data + server/data + manifest）。
**编辑源只有 plugin/data/**——发现其他副本更新时要先回灌编辑源再改（诡秘 systemPage 曾在 dist 副本里比编辑源新，直接重生成差点丢数据）。

**多体系（gen-system.mjs）**：每本书自己的境界体系（修仙六境/途径序列…），systemPage 数据驱动；亚体系（如释修）独立成阶梯时，身份词匹配必须出现在介绍**开头 20 字内**（身份定语位置），否则"备注提到XX"的噪声全被误带（39 人口径 → 真实 20 人）。

## ⑩ 前端/插件

参考实现：uTools 插件，两版并存——plugin/（无构建零依赖，已冻结）与 plugin-src/（Vue3+Vite+singlefile ~205KB，新功能只进这版）。结构：**书架首页**（BookShelf，书目卡片：书名/作者/简介/人物/核心/章节/势力数 + 📖 续读/开始阅读入口）→ 点书卡进四 Tab（人物/世家(途径)/势力/体系），header ⌂ 返回书架。
**原文阅读**：2026-10-23 按用户拍板整体移除（本地个人版定位，规避分发版权风险；TextReader 组件/文本块/textIndex 已删）。原文抓取管线仍保留用于通道 C 人物提取（roster 需要全文），只是不入库不展示；恢复阅读功能的方法见 build-text.mjs 头部注释与会话记录。
**多书多主题全部数据驱动**：书目 JSON 顶层 `theme` 字段（gen-system 生成）→ App.vue watch 切 `body.theme-*`（**书架首页固定用专属 theme-home「书阁·砚青」，与书目基调解耦**）；体系页 systemPage v2（ladder/extraLadders/codex）由 SystemLadder 通用渲染器消费，亚体系（释修等）走 extraLadders 独立成节；筛选项从 generations/factionEntities 动态生成。坑：
- SystemLadder 的 v1 兼容守卫**先判 version===2 再判顶层 realms**（v2 的 realms 在 ladder 里，顺序反了 v2 永远进 loading——已踩）
- 每书主题：CSS 变量双套（:root=玄鉴古镜月华 / body.theme-guimi=诡秘灰雾之夜），组件只准用变量禁止硬编码色值；新书加主题=加一个 `body.theme-X` 变量块+书目 JSON theme 字段
- uTools 主窗 ~750px 宽：100vh 布局 + #main 内部滚动；深色 UI **禁用原生 select/日期控件**（白底刺眼+DPI 错位），自绘
- 预览服务器必须 `Cache-Control: no-store`（singlefile 无内容寻址，旧缓存会让"修好的 bug 还在"）
- Vue 子组件 onMounted 早于父 boot() → bookId 空，一律 `watch(bookId, immediate)`
- 卡片装饰伪元素禁用 `position:sticky`（钉在滚动区顶端盖文字）
- stats.tiers 的 key 是 JSON 字符串（"1"），取值 `tiers[1] ?? tiers['1']`

## 热更新（不发版加书）

manifest（sha256）+ 书目 JSON 放服务器；插件启动静默检查（TTL 30min + ETag 304，单次 ~300B）→ 变更才下载（sha 校验+原子写 `~/.utools-novel-characters/`）→ 内置 data/ 永远兜底，断网全功能。
**数据 URL 必须内容寻址 `?v=版本-sha前10位`**——纯版本号会被 HTTP 长缓存命中旧文件。加书：本地跑管线 → gen-manifest → 拷 server/ 上服务器 → 插件自动同步。

## 视觉资产（已定案）

默认**印章 SVG**（gen-seals.mjs：姓氏+势力配色+字辈小注），全库 ~130KB。**AI 生图已放弃**（2026-10-23 拍板）：免费模型做不出合适的人物图，未找到稳定好方法，前端立绘 UI 已隐藏。实测留档（将来有新模型再复活）：
- cogview-3-flash 免费：单张 ~4 核心要素容量、有概念盲区、竖幅默认胸像需三重锚定（头顶上部/双脚踩地/占高 2/3）；cogview-4 付费 0.2 元/张遵循较强
- Pollinations 不可用（长 prompt 跑偏+水印）；豆包网页 Seedream 质量最强（1664×2496）但需登录、年龄偏大需强制年轻化
- 视觉质检：glm-4.5v API + base64 直传（MCP analyze_image 只能拉智谱可达域名，第三方 URL 全 1210；`glm-4.5v-flash` 模型名不存在）
- 提示词三层：统一基调段（全书不变）+ 人物锚段（同人复用）+ 场景段（按章节场景可换）

## 平台/环境坑（跨项目有效）

- **GLM 1301 内容安全过滤**：小说原文大段进上下文会触发（两次打断过会话）——**用脚本处理原文，主上下文只放代码与统计**
- **GLM 1210 图片输入错误**：截图/图片直接进会话上下文也可能触发 provider 报错，同样废掉整个会话——**UI 验证优先 DOM 断言（evaluate），确需看视觉时一次只发一张、发完即止**
- 子代理限速 1302：并发 >10 触发；3-6/批，失败小批量重试
- Git Bash 中文路径 cd 不稳：node 脚本内处理中文路径最稳；后台任务路径参数用 ASCII
- 内网：npm 401 → npmmirror；盗版站 URL 分类拦截 → 内容级验证

## 成本参考（两书实战）

| | 玄鉴仙族（通道 C） | 诡秘之主（通道 A） |
|---|---|---|
| 规模 | 1636 章 / 571 万字 / 792 人 | 645 wiki 词条 / 310 人 |
| 抓取 | 71 秒（并发 4）+ 修复 | clone 仓库 + 百科 API 批量 |
| LLM 扫描 | ~30 子代理调用，每窗 40-90 万 token | 0 扫描子代理（T1 28 人主会话精修） |
| 画像卡 | 6 子代理 × 4 人 | T1 内嵌 editorial |
| 产物 | 420KB 书目 JSON（含剧情线/evidence） | 420KB 书目 JSON（无章号/timeline 空） |

全程最大风险：通道 C 是限速，通道 A 是词条质量——宁可串行分批，不要一次并发 16 个。
