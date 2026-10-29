# Sources 操作与默认桌面看板

对应[调查和结果](../../records/2026-10/2026-10-30-source-and-board-desktop.md)。单agent真实开发serve /ui，两个独立runtime共用固定60min admission，零Provider；13张原图均实际呈现并人工查看，不是UI自动化或截图基线测试。

| 原图 | 实际内容 |
| --- | --- |
| [799-01](799-01-board-before.png) | 1280×720、默认280px侧栏，改前Completed卡片右侧被裁切 |
| [799-02](799-02-sources-before.png) | 基线展开来源组，阅读位置尚在消息顶部 |
| [799-03](799-03-source-open-before.png) | 基线点击44:26来源后，真实文件定位第44行 |
| [799-04](799-04-board-after.png) | 英文候选五列完整；指针停留导致左栏导航Tooltip可见 |
| [799-05](799-05-board-wide-after.png) | 收起侧栏后卡片自然扩展 |
| [799-06](799-06-board-zh-after.png) | 简体中文、默认侧栏的完整五列 |
| [799-07](799-07-board-narrow-after.png) | 将左栏加宽至373px后的原横向滚动边界 |
| [799-08](799-08-board-narrow-scrolled.png) | 窄区域向右滚动后完整结果列可达 |
| [799-09](799-09-sources-zh-after.png) | 中文展开来源，滚动调整前的阅读位置 |
| [799-10](799-10-sources-all-after.png) | 滚动向下后模型原文中的结果表格，来源组已在上方离屏 |
| [799-11](799-11-sources-readable-after.png) | 调整到八条实际来源和复制入口完整可读的位置 |
| [799-12](799-12-source-open-after.png) | 中文来源点击44:26，文件面板与窄主对话来源组 |
| [799-13](799-13-board-final.png) | 返回看板的最终中文默认展开布局 |

原始构建与类型检查日志、原结果JSON分别保留frontend-build和overlay-typecheck文件。原始日志含ANSI颜色和尾随空白，最初被git diff --check提示；改以UTF-8 output JSON字符串逐字无损保存，解码后与原始输出完全一致，不清洗日志内容。before/after-data-review.json来自实际关闭库逐表逐行及附件/文件/Git校验；before/after-retirement.json记录公开shutdown、精确进程身份与物理/输出/请求结算及副本清退；两份provider-audit为真实零请求。来源复制结果8行与页面行列对应，剪贴板已恢复原空值。没有保存凭据、模型目录或原数据库内容。

本轮修复仅看板CSS最小列宽184→160。Sources为原功能实际复核；没有URL摘录/侧聊继承或全产品无缺陷结论。模型配置提示来自有意不复制auth的只读运行，原已认证用户实例没有被操作。
