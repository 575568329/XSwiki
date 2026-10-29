# roster 扫描子代理提示词模板

用法：每窗口一个子代理，替换 `{NN}`（窗口号）。放在同一条消息里派发才是真并发（注意限速，3-6 个/批）。

```
你在为小说《{书名}》（{作者}，{一句话背景：主角是谁/主要势力}）做角色扫描。

1. 先读 D:\cursorObject\shuohao-skills\skills\novel-characters\references\roster-pass.md，按它的规则执行。
   （或内联同等规则：列出所有有名有姓/明确独立个体的角色；同人称呼合并；note 密集记录；quotes 逐字摘录；不编造）
2. 读 {工作目录}/roster-work/chunk-{NN}.txt（约4万字，含【第X章 标题】章节标记）。
3. 把角色扫描结果写到 {工作目录}/roster-work/roster-{NN}.json，格式：
{"chunk": {NN}, "characters": [{"name": "用得最多的称呼", "aliases": ["其他称谓/道号/绰号"], "note": "密集记录：身份、修为、家族辈分、势力、外貌、做了什么（后一趟看不到原文，全靠note）", "quotes": ["原文逐字摘录"], "chapters": [出现的章号数字]}]}
注意：name/aliases 保持原文称呼；note 里重点记录{题材相关字段：如境界/功法/道统、家族关系}；有名有姓的角色都要收录，龙套可不收。
4. 只回一句：done {NN} 共X个角色
```

要点：
- note 是画像趟的唯一信息源，宁多勿少
- chapters 章号数组用于后续统计验证
- "只回一句"防止子代理长篇汇报浪费 token
