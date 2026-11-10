# 目录后台刷新诊断的实页证据

对应[根因和方案](../../records/2026-11/2026-11-10-explorer-directory-refresh-diagnostics.md)。基线实页展示根与展开目录的真实 404 诊断在后台请求开始时被移除，以及再次失败后折叠详情。原图因包含完整本机目录保存在隔离位置。

- 基线：[根等待时诊断消失](baseline-root-diagnostic-removed-while-pending.png)、[子目录再次失败后详情折叠](baseline-child-repeated-error-collapsed.png)。
- 英文根目录：[等待时旧诊断与焦点](candidate-root-poll-and-diagnostic.png)、[再次失败保留详情](candidate-root-new-error-keeps-diagnostic-focus.png)、[成功后搜索框接焦](candidate-root-background-success-focus-search.png)。
- 中文子目录：[等待时保留展开详情](candidate-zh-child-active-poll-keeps-diagnostic.png)、[再次失败仍持焦](candidate-zh-child-new-error-keeps-focus.png)、[读回文件时保留对话输入焦点](candidate-zh-child-success-keeps-composer.png)、[真实空目录与原文件](candidate-zh-empty-folder-and-plan-marker.png)。
- [父目录退休子诊断](candidate-zh-parent-retires-child-feedback.png)、[恢复路径后的显式重试](candidate-zh-explicit-child-retry-focus-search.png)、[请求编号、真实读取、隔离数据与关停回执](receipt.json)。
