# 归档首读重试焦点实页证据

对应[根因、方案与验收](../../records/2026-11/2026-11-10-archive-first-page-retry-focus.md)。下图为独立真实开发 `/ui` 的 1280×720 原图，已本人目视复核。带本机绝对目录的行图只留隔离目录。

| 场景 | 原图 | 观察 |
| --- | --- | --- |
| 基线首读失败与等待 | [原 Retry](baseline-en-initial-failure.jpg)、[等待](baseline-en-retry-pending-focus-lost.jpg) | 按 Enter 后按钮卸载，焦点落到网页主体；完整响应后仍未交接焦点。 |
| 基线空查询 | [失败](baseline-en-query-failure.jpg)、[恢复](baseline-en-query-empty-focus-lost.jpg) | 保留原搜索词并读到真实无匹配；焦点仍落在网页主体。 |
| 英文首读重试 | [原诊断](candidate-en-initial-details.jpg)、[再次失败](candidate-en-repeat-failure-keeps-retry.jpg)、[等待](candidate-en-pending-keeps-retry.jpg) | 再次失败后焦点仍在 Retry；等待时同一个控件有焦点并显示 `Loading…`。真实有行结果的标题焦点及下一次 Tab 已人工检查，完整目录图仅留本地。 |
| 中文搜索主动移焦 | [失败](candidate-zh-query-error.jpg)、[等待](candidate-zh-query-pending.jpg)、[恢复后仍在搜索框](candidate-zh-query-empty-preserves-search-focus.jpg) | 以同一词重试；等待时主动回搜索框，完整响应接受后焦点留在那里。 |
| 中文空结果交接 | [标题焦点](candidate-zh-empty-heading-focus.jpg) | 重试按钮持焦点到结算，空结果加载后焦点交给「已归档工作」。 |

[公开回执](receipts.json)记录受控截断、完整重试、真实归档行及检索结果、持久身份和自有服务关停。
