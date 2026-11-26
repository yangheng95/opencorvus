# 历史代码比较证据

本批修复短记录列表的固定空白及候选暴露的实际样式级联覆盖。完整根因、失败迭代和验证边界见[规格](../../records/2026-11/2026-11-27-historical-code-review.md)。所有页面截图均由本人通过专用 Chrome 原生交互取得并查看，不是截图基线或自动化断言。

- 修复前：[原两条记录及大量空白](run5-old-code-review.png)、[收起列表](run5-review-list-hidden.png)、[实际当前文件查找](run5-current-code-find.png)、[后续任务真实增量](run5-followup-review-scope.png)、[较低桌面高度](run5-constrained-review.png)。历史比较与当前文件本来就没有串版。
- 失败候选：[run6 列表零高](run6-zero-height-record-list.png)、[run7 级联覆盖仍零高](run7-zero-height-specificity.png)；对应 `run6-short-list-review.png` / `run7-short-list-review.png` 是相同失败画面，不能当作验收通过。[实际计算样式及匹配规则](run7-layout-style-inspection.json) 是失败后的只读开发调查。
- 最终本人视觉通过：[两条记录正常且代码扩大](run8-short-list-review.png)、[筛选/键盘选择原测试](run8-filtered-test-record.png)、[1280×720 桌面](run8-constrained-review.png)、[阅读说明](run8-reading-guide.png)、[真实空筛选](run8-empty-filter.png)、[960 宽栏](run8-wide-review.png)、[英文宽栏](run8-wide-english.png)、[英文窄栏](run8-narrow-english.png)。已恢复中文和默认桌面视窗。
- [最终四份真实原工具比较](run8-recorded-comparison-check.json)：原创建 0→5970/6363 字节、后续修改 5970→7650 / 6363→10107 字节。`run5/6/7-recorded-comparison-check.json` 保留先前服务的相同正向检查；端点通过本身不是视觉通过。
- [10 条原持久事实逐字段保留](task-facts-preserved.json)、[最终实际服务的构建文件身份](run8-served-assets.json)。无可变源码摘要或重算期望代替功能检查。
- [Provider 汇总](provider-summary.json)：四次独立服务合计 8 次真实流式 `gpt-6.1-sol` 预检，全部 200 / settled / eof；没有新增业务 Task，不冒充新一轮业务端到端执行。`run5/6/7/8-model-request-audit.json` 为脱敏请求元数据，`run5/6/7/8-runtime.json` 为正常结清退出码 0 及成对凭据副本退役收据。
- [类型检查](overlay-types.log)、[最终构建](overlay-build.log) 仅为辅助静态证据。超过 80 条的虚拟列表未取得本批实页证据，代码保留其原分配路径。
