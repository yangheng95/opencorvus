# 资源管理器查询发布的桌面记录

## 已推送基线

Windows Chrome 连接 `cb4f11933` 的隔离开发服务 `40064/ui/`，实际加载 `main-WipNTHGm.js`。

- [实际项目树](baseline-explorer.png)、[快速查询 inspection](baseline-inspection.png) 和 [快速查询 sample](baseline-sample.png)
- [等价空格后已有结果被 Loading 替换](baseline-same-query-loads-again.png) 和 [真实重复请求完成后的同一结果](baseline-same-result-returned.png)
- [实际键盘动作、网络发送顺序、返回和请求标识](baseline-desktop.json)

## 候选构建

真实 Windows Chrome 连接隔离开发服务 `40066/ui/`，实际加载 `main-D25M82Rn.js`。

- [快速 inspection](candidate-inspection.png)、[清空回到实际树](candidate-escape-tree.png)、[快速 sample](candidate-sample.png)、[等价编辑后的结果](candidate-equivalent-query.png) 和 [直接键盘聚焦](candidate-equivalent-result-keyboard.png)
- [新来源等待](candidate-returning-query-waits.png)、[当前真实响应](candidate-returning-query-accepted.png)、[较早来源晚到](candidate-older-query-returned-later.png) 和 [真实空结果](candidate-genuine-empty.png)
- [真实连接中断](candidate-search-retry.png)、[重试恢复](candidate-explicit-retry-success.png)、[方向键聚焦原文件](candidate-inspection-result-keyboard.png) 和 [回车打开原始文本](candidate-inspection-content.png)
- [文件变动后当前搜索返回新文件](candidate-real-file-change-refresh.png)、[清理后手动刷新恢复原结果](candidate-manual-refresh-after-cleanup.png)、[独立会话的实际树](candidate-independent-tree.png) 和 [独立会话的搜索](candidate-independent-query.png)
- [简中等价编辑](candidate-chinese-equivalent.png) 和 [简中键盘结果](candidate-chinese-keyboard.png)
- [英文真实请求和手势](candidate-desktop-english.json)、[中文真实请求和手势](candidate-desktop-chinese.json) 及 [发送顺序、持久记录和原件比较](candidate-summary.json)

截图已逐张人工复核。
