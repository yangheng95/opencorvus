# 归档搜索桌面和真实查询

基线使用 `39833/ui` 和隔离开发服务 `39832`。

- [四条原始归档](01-baseline-archive-ready.png)、[输入期间显示零和加载](02-baseline-typed-loading.png)、[最终两条匹配](03-baseline-matching-shared.png)。
- [尾随空格触发相同查询](04-baseline-trailing-space-reloads.png)、[Escape 恢复原列表和焦点](05-baseline-clear-restores-archive.png)、[真实基线查询回执](baseline-query-evidence.json)。

候选使用 `39835/ui` 和隔离开发服务 `39834`。

- [加载期间等待结果](07-candidate-typing-loading-without-count.png)、[准确显示两个项目的匹配](08-candidate-matching-shared.png)、[尾随空格保留匹配](09-candidate-trailing-space-keeps-results.png)。
- [替换后只显示新查询](10-candidate-only-new-query.png)、[清除待发送输入后恢复首屏及焦点](11-candidate-clear-queued-query.png)、[真实零结果](12-candidate-confirmed-zero.png)。
- [中文读取错误保留输入](13-candidate-chinese-error-without-count.png)、[重试保留诊断](14-candidate-chinese-retry-pending.png)、[中文及符号字面搜索成功](15-candidate-chinese-exact-query.png)、[命令面板项目查询](16-candidate-command-palette-projects.png)。
- [正式接口请求与精确会话读取](candidate-query-evidence.json)、[隔离数据状态](candidate-storage-evidence.json)。
