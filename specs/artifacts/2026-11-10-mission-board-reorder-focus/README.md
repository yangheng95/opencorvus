# 多步任务卡片重排焦点的证据

[规格与真实接口回执](../../records/2026-11/2026-11-10-mission-board-reorder-focus.md)。以下是隔离开发桌面页面的手动交互截图，裁切到任务和焦点区域。按键、辅助名称和响应回执在规格中记录；截图显示实际焦点框、卡片位置、滚动结果及请求文案。

- [基线：已保存，列表仍在等待](01-baseline-list-before-refresh.png)：原 `Meeting notes` 编辑按钮持焦。
- [基线：真实列表到达并重排](02-baseline-list-reordered-focus-lost.png)：`Meeting notes` 和新正文已移到首位，实际焦点落到网页主体。
- [基线：列看板刷新后](03-baseline-board-reordered-focus-lost.png)：原滚动位置留在下方，新首卡 `Release checklist` 已在可见区外，焦点落到网页主体。
- [候选：英文列表更新后](04-candidate-list-reordered-focus-retained.png)：`Invoice overview` 升到首位，同一编辑按钮保有可见焦点。
- [候选：简体中文列看板更新后](05-candidate-zh-board-reordered-focus-visible.png)：`Meeting notes` 的新首卡及具焦按钮回到可见区。
- [候选：等待真实响应时移到搜索](06-candidate-search-focus-before-release.png)：搜索已持焦，`Release checklist` 仍在第三。
- [候选：真实响应放行后](07-candidate-search-focus-after-release.png)：`Release checklist` 已在首位，搜索仍持焦。
