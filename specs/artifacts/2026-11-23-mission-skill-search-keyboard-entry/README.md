# 多步任务技能搜索的桌面复核

基线与候选分别来自 OpenCorvus 开发服务 `40576/ui/` 和 `40578/ui/` 的独立桌面浏览器页面。图像来自实际浏览器交互，按捕获顺序排列。

| 画面 | 观察 |
| --- | --- |
| [01 基线按下](01-baseline-en-down-stays-in-skill-search.jpg) | 查到 `general`，焦点仍在搜索。 |
| [02 基线第六次 Tab](02-baseline-en-six-tabs-to-matching-skill.jpg) | 经过清空及四个来源按钮后到达 `general`。 |
| [03 基线详情返回](03-baseline-en-return-preserves-query.jpg) | 原查询和 `general` 的焦点正常恢复。 |
| [04 基线按上](04-baseline-en-up-stays-with-two-matches.jpg) | 查到两个来源一致的项目技能，向上键仍停在搜索。 |
| [05 英文首条焦点](05-candidate-en-down-focuses-first-result.jpg) | 向下键直达 `alpha-review`，搜索帮助可见。 |
| [06 英文末条焦点](06-candidate-en-up-focuses-last-result.jpg) | 向上键直达 `zulu-review`。 |
| [07 英文技能详情](07-candidate-en-keyboard-opens-exact-detail.jpg) | 回车打开真实详情，聚焦准确标题。 |
| [08 英文详情返回](08-candidate-en-back-preserves-last-result.jpg) | 原查询及 `zulu-review` 重新聚焦。 |
| [09 英文来源零结果](09-candidate-en-filter-empty-keeps-input.jpg) | 切换内置来源后，显示零结果且方向键仍停在输入。 |
| [10 中文首条焦点](10-candidate-zh-project-filter-first-result.jpg) | 项目来源搜索能直接进入第一条，提示为中文。 |
| [11 中文末条焦点](11-candidate-zh-project-filter-last-result.jpg) | 同一来源和查询按上定位末条，技能说明保留原文。 |
| [12 中文零结果](12-candidate-zh-empty-query-results.jpg) | 无匹配时显示中文说明，用户可继续输入。 |
| [13 中文清空查询](13-candidate-zh-cleared-search-keeps-input.jpg) | 保留项目筛选，恢复两条结果及正常输入焦点。 |
| [14 中文 150% 缩放](14-candidate-zh-150-percent-result-focus.jpg) | 放大后的筛选、提示和焦点仍清晰可见。 |
