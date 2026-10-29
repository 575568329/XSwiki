# 小说Wiki（uTools 插件）

多小说人物/设定 Wiki 平台：书架首页（书目卡片，专属"书阁"主题）→ 每本书一套主题（玄鉴=古镜月华 / 诡秘=灰雾之夜 / 凡人=青竹道韵）→ 人物/世家(途径)/势力/体系四 Tab。

**定位：仅个人本地使用，不分发不上架**（2026-10-23 拍板；原文阅读功能已移除，人物/设定资料保留，管线脚本存档备用）。

书目（7 本 1699 人物，持续新增）：《玄鉴仙族》792 + 《诡秘之主》310 + 《凡人修仙传》233 + 《大奉打更人》126 + 《斗破苍穹》105 + 《黎明之剑》89 + 《我加载了神秘学面板》44。

**加新书 / 数据从哪来**：看 [docs/README.md](docs/README.md) 索引 → [docs/数据获取统计.md](docs/数据获取统计.md) §〇 决策流程；方法论已封装为可调用 skill `novel-characters-db`。

## 功能

- **多书目**：`plugin/data/` 下每本小说一个 JSON，两部以上自动出现书目选择页；头部书名可点返回切换
- **搜索**：支持 人名 / 别名·道号 / 拼音（如 `lxjm`→李曦明、`weiwang`→李周巍），按戏份加权排序；uTools 子输入框与页面内搜索框双入口
- **人物卡**：性别、身份、势力、李家字辈世代（7-18 世族谱：根/木/长通项尺/玄景/渊清/曦月/承明/周行/绛阙/遂语/青元/玉京）、修为、结局状态、出场章节范围、提及次数、AI 立绘（有图即显示）
- **关系网**：可点击跳转的双向关系（"关系网" + "被指向"），tier1 核心人物含父子/师徒/敌对等明细
- **剧情线**：核心人物按章号排列的关键事件时间轴
- **原文摘录**：人物卡附逐字原文证据（最多 3 条）
- **筛选**：按世代 / 势力 一键过滤
- 分级：核心（tier1，24 人全档案）→ 重要（tier2）→ 次要（tier3），共 793 人物

## 人物形象：印章头像（当前方案）+ 可选立绘

**当前方案**：程序生成古风印章 SVG（姓氏+势力配色+字辈小注），793 人共 ~130KB，零生图零版权风格统一，列表与详情页默认展示。

**AI 生图（已实测留档，质量不稳定慎用）**：GLM 文本模型不能生图；cogview-3-flash 免费（容量上限约4要素、冷门概念如白毫无法渲染）；cogview-4 付费 0.2元/张遵循较强；Pollinations 免费无需 key 但 prompt 遵循随机且有水印；豆包网页 Seedream 质量最好（中文理解强、1664x2496）但需登录、年龄倾向偏大（需提示词强制年轻化）。管线脚本保留：gen-portrait-prompts / gen-images / qa-vision（glm-4.5v base64 直传质检，key 用 ZHIPUAI_API_KEY）。图片命名 data/images/{id}.png，有图人物自动用图、无图自动用印章。


## 项目内 Skill

`skills/novel-characters-db/`：本项目方法论的技能化封装（已 junction 注册到 ~/.zcode/skills，项目内会话可直接调用；通用版在 ec-skills 仓库）。scripts/ 为 analysis/ 的快照。

## 数据是怎么来的

```
analysis/                      # 分析工程（数据管线，可复用到其他小说）
├── book_source.txt            # 何以笙箫默书源（77源）
├── fetch_shubao.mjs           # 全本抓取（爱书包 1636章，断点续传）
├── repair.mjs / repair2.mjs   # 假章修复（866-895段重影/占位章，得奇+UU交叉修复）
├── verify-chapters.mjs        # 章节完整性校验（章号/重复/占位/衔接）
├── assemble.mjs               # 目录排序 + 广告清洗 -> raw/chapters.json
├── extract-names.mjs          # 姓氏 n-gram 人名普查（2500+候选）
├── build-samples.mjs          # 24 个抽样窗口（覆盖全书剧情弧）
├── roster-work/               # 子代理 roster 扫描结果（skill: novel-characters）
├── dossier.mjs                # 人物定向素材（首现/高密度/末现章的出场句）
├── cards/                     # 24 张 tier1 画像卡（身份/修为/关系/剧情线/证据）
├── gen-portrait-prompts.mjs   # 画像卡 -> 24 条立绘生图提示词
├── gen-images.mjs             # CogView 批量生图（ZHIPUAI_API_KEY，断点续传）
├── review-data.mjs            # 人工复核规则（keep/drop/同人归并/字辈归一）
├── merge-roster.mjs           # roster × 程序普查 交叉归并
└── build-data.mjs             # 最终构建（拼音索引/世代/势力/分级）-> plugin/data/
plugin/                        # 插件资产唯一编辑源（五件套）
├── plugin.json / preload.js / config.json / logo.png
└── data/                      # 书目 JSON + images/ 立绘 + prompts/archives（构建产物编辑源）
plugin-src/                    # 前端源码（Vue3+vite 单文件构建）
├── dist/                      # uTools 发版目录（官方推荐 dist 打包，唯一发版包）
└── public/                    # vite dev 静态资产（5173）
```

流水线（参考 [shuohao-skills/novel-characters](https://github.com/eternityspring/shuohao-skills) 的 roster/profile 两趟方法论）：

1. **抓取**：书源探测 → 爱书包全本 → 章节校验 → 假章/占位章多源修复（当前遗留 ~36 个占位章、1460–1496 章各盗版源均缺，占全书 2.2%）
2. **普查**：姓氏 n-gram 挖掘 + 道号标记提取 + 全文频次/章节分布验证（发现李家 11 代字辈）
3. **深扫**：24 个抽样窗口由子代理做 roster 扫描（名字/别名/密集笔记）
4. **归并**：roster × 普查交叉验证 + 人工复核（幽灵前缀、化身同人、噪声词清洗）
5. **画像**：核心 24 人定向素材提取 → 画像卡（timeline 按章号、evidence 逐字）
6. **构建**：拼音索引（pinyin-pro，仅构建期）、世代/势力归一、三级分层

## 数据热更新（不发版加书）

详见 docs/热更新设计.md。要点：服务器放 manifest+书目JSON（server/serve.mjs 零依赖服务），插件启动静默检查（TTL 30min+ETag 304，单次 ~300B）、变更才下载（sha256 校验+原子写缓存）、断网全功能可用、内置数据永远兜底。加书流程：本地跑管线 → gen-manifest → 拷 server/ 到服务器 → 插件自动同步。

## 使用

### uTools 安装（开发模式）
1. uTools → 插件应用 → 开发者 → `plugin-src/dist` 目录拖入（发版包即 dist；`plugin/` 只是资产编辑源，不可拖）
2. 关键词：`小说wiki` / `人物` / `角色` / `小说人物`

### 本地预览
```bash
cd plugin-src && node preview-dist.js   # http://127.0.0.1:5177（静态服务 dist）
```

### 同步纪律（改完资产必跑）
```bash
node analysis/sync-data.mjs     # 数据 JSON 三副本（plugin/data → public + server）
node analysis/sync-plugin.mjs   # 插件资产四件（preload/plugin.json/config/logo → dist + public）
```

## 已知限制

- 书源为盗版镜像，正文存在少量防盗字符替换（如 个别"的→旳"、"有/没"互换），不影响人名统计与检索
- 第 1460–1496 章全网盗版源缺失（起点正版独有），36 个"手打中"占位章未修复
- tier3 人物为程序挖掘 + 抽样确认，oneLiner 可能缺失
- 别名/道号覆盖率依赖抽样窗口（24 窗口 ≈ 全书 12%）

## 换一本书

1. `analysis/fetch_shubao.mjs` 改 BOOK_URL（或在 book_source.txt 里找一个可达源）
2. `node fetch_shubao.mjs && node assemble.mjs && node extract-names.mjs`
3. 重建抽样窗口 → roster 扫描 → dossier → cards → `node build-data.mjs`
4. `plugin/data/` 下会生成新的书目 JSON，插件自动加载多书目
