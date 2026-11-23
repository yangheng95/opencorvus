# 设置搜索焦点与导航提示的实拍

隔离 OpenCorvus 开发页面，1280×720，每张原图均由本人复核。[规格](../../records/2026-11/2026-11-23-settings-search-dismiss-navigation-tooltip.md)

| 基线实拍 | 实际画面和焦点 |
| --- | --- |
| [01 英文搜索接管焦点](01-baseline-settings-search-covered-by-rail-hint.jpg) | 关于已打开，搜索框实际聚焦，大部分被导航提示盖住。 |
| [02 输入内容](02-baseline-query-typed-behind-hint.jpg) | 已输入 `MCP` 并筛选出设置结果，输入仍不可读。 |
| [03 第一次 Escape](03-baseline-escape-first-while-query-and-tooltip-active.jpg) | 查询已清空，提示仍盖住搜索框。 |
| [04 第二次 Escape](04-baseline-empty-search-escape-dismisses-hint-first.jpg) | 提示被关闭，设置仍打开。 |
| [05 第三次 Escape](05-baseline-next-escape-returns-to-workspace.jpg) | 这次才退出设置并回到初始工作台。 |
| [06 中文 150% 复现](06-baseline-zh-150-focus-partly-covered.jpg) | 该缩放下搜索焦点和输入区域也被提示挡住。 |
