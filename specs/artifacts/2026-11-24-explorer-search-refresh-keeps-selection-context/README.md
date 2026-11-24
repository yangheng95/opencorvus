# 文件搜索刷新中的选区提示和焦点证据

- 英文 100% [刷新前实际选区与按钮焦点](baseline-en-mixed-selection-before-refresh.jpg)、[刷新在途时提示与按钮消失](baseline-en-pending-refresh-removes-selection-action.jpg)、[响应后提示恢复且焦点仍在页面主体](baseline-en-refresh-restores-action-without-focus.jpg)。[实际位置和焦点](baseline-en-selection-positions.json)。
- 公开搜索的 [36 条原始文件](baseline-files.json)、[正式服务的 37 条在途响应](baseline-held-search-response.json)及[原始响应实际送达](baseline-released-search-response.json)。

| 候选桌面复核 | 页面与实际测量 |
| --- | --- |
| 英文 100% 的原选区、在途提示和请求超时交接 | [刷新前](candidate-en-selection-before-refresh.jpg) · [在途](candidate-en-pending-keeps-focus-and-layout.jpg) · [错误和查询框焦点](candidate-en-timeout-returns-focus-to-search.jpg) · [实际位置](candidate-en-selection-positions.json) |
| 简体中文 160% 的原选区、在途按钮和错误 | [刷新前](candidate-zh-before-refresh.jpg) · [在途](candidate-zh-pending-keeps-focus-and-layout.jpg) · [搜索失败和焦点](candidate-zh-expired-read-returns-focus-to-query.jpg) |
| 中文成功收包、回车只清除结果外所选及新查询 | [按钮带焦点恢复可用](candidate-zh-success-restores-action-with-focus.jpg) · [清理后的原选择和输入焦点](candidate-zh-clears-only-outside-selection.jpg) · [新查询](candidate-zh-new-query-recomputes-outside-selection.jpg) · [R-39 原文](candidate-zh-opens-exact-new-file.jpg) · [实际位置](candidate-zh-selection-positions.json) |

[基线刷新后原件](baseline-files-after-refresh.json) · [候选英文超时](candidate-en-timed-out-response.json) · [候选中文超时](candidate-zh-timed-out-response.json) · [中文实际送达 39 条响应](candidate-zh-released-search-response.json) · [真实下载及源文件身份](candidate-files.json)

[调查规格](../../records/2026-11/2026-11-24-explorer-search-refresh-keeps-selection-context.md)。
