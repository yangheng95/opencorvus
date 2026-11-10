# 文件搜索在途重试的证据

第 214 批。本批只在自有的隔离项目与开发服务操作。实际服务生成搜索响应，隔离转发器只对指定查询改变验证参数或扣留响应，不生成搜索结果。

[规格与根因](../../records/2026-11/2026-11-10-explorer-search-retry-pending.md)。

- 对照：[基线在途仍显示可点的 Retry](baseline-en-confirmed-retry-pending.png)，[首轮成功后错误卡焦点丢失](candidate-en-success-loses-feedback-focus.png)。
- 最终英文：[正在重试且保留诊断](final-en-retrying-held-error.png)，[再次失败仍在原处](final-en-updated-error.png)，[等待期间以键盘阅读诊断](final-en-keyboard-reading-held-diagnostic.png)，[恢复时焦点返回搜索框](final-en-results-and-focus.png)，[打开真实文件和正文](final-en-opened-bravo.jpg)，[旧结果交付后保留唯一新匹配](final-en-narrow-result-after-old-response.png)。
- 最终中文：[忙碌按钮持焦](final-zh-busy-action-focused.png)，[成功后搜索框持焦](final-zh-results-and-focus.png)，[对话框持焦时不抢焦点](final-zh-keeps-outside-focus.png)，[清除查询回原目录](final-zh-root-restored.png)。
- [真实运行回执](receipt.json)配对浏览器搜索的服务编号、响应及交付时间，保存正式接口结构检查、原样本、隔离数据库和正常退出证据。带本机目录的原图留在隔离位置；上述局部图已经人工复核。
