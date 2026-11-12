# 命令面板等价输入的真实桌面与请求

基线为隔离桌面 `39837/ui`、开发服务 `39836`。

- [原第三项高亮与分页](01-baseline-palette-match-and-continuation.png)、[尾随空格清空结果](02-baseline-palette-space-clears-results.png)、[回执使第一项高亮](03-baseline-palette-highlight-resets.png)、[Enter 实际打开第一项](04-baseline-space-enters-first-work.png)。
- [同一查询、游标及正式会话读取](baseline-palette-evidence.json)。

候选为隔离桌面 `39839/ui`、开发服务 `39838`。

- [追加空格前第三项高亮](05-candidate-before-space-third-highlight.png)、[追加空格后仍高亮第三项](06-candidate-after-space-third-highlight.png)、[Enter 打开原通用工作](07-candidate-enter-original-work.png)。
- [键盘到达续页](08-candidate-page-keyboard-footer.png)、[续页在途保留按钮](09-candidate-continuation-pending.png)、[续页末两条](10-candidate-continuation-last-records.png)。
- [中文读取错误](11-candidate-chinese-failed-search.png)、[同词空格保留原诊断](12-candidate-chinese-equivalent-keeps-diagnostic.png)、[重试等待](13-candidate-chinese-retry-in-progress.png)、[返回原词结果](14-candidate-chinese-retry-original-result.png)、[实质换词](15-candidate-chinese-real-change.png)、[归档使用同一规范规则](16-candidate-archive-normalized-query.png)。
- [正式查询、分页、选中及状态](candidate-palette-evidence.json)、[隔离数据状态](candidate-storage-evidence.json)。
