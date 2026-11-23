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

| 候选实拍 | 实际画面和焦点 |
| --- | --- |
| [07 导航提示正常](07-candidate-prompt-visible-before-handoff.jpg) | 原 Tasks 提示出现，主页面为 Missions。 |
| [08 帮助菜单可读](08-candidate-help-remains-readable-before-search.jpg) | 在焦点进入设置前，原菜单渲染和导航提示共存。 |
| [09 英文搜索完全可读](09-candidate-en-active-search-fully-visible.jpg) | 搜索接管焦点，提示卸载，输入轮廓及占位都可见。 |
| [10 英文实际匹配](10-candidate-en-query-visible-with-results.jpg) | 输入 `MCP`、清除按钮和真实结果均可见。 |
| [11 首次 Escape](11-candidate-first-escape-clears-retains-focus.jpg) | 查询清空，仍在 About 并聚焦搜索。 |
| [12 第二次 Escape](12-candidate-second-escape-returns-workspace.jpg) | 回到工作台和 Help 触发器。 |
| [13 正常悬停恢复](13-candidate-fresh-hover-restores-navigation-hint.jpg) | 重新悬停后 Tasks 提示原文可读。 |
| [14 中文 150% 搜索](14-candidate-zh-150-search-entirely-visible.jpg) | 中文输入及焦点完整。 |
| [15 中文搜索焦点期间重新悬停](15-candidate-zh-150-held-search-focus-remains-visible.jpg) | 鼠标进入任务按钮区域，搜索保持可用。 |
| [16 中文查询](16-candidate-zh-150-query-and-clear-visible.jpg) | 查询值、清除、导航提示及已匹配项可见。 |
| [17 中文鼠标清除](17-candidate-zh-150-pointer-clear-returns-input.jpg) | 点击后查询恢复空值，焦点回到原输入。 |
| [18 方向键聚焦结果](18-candidate-zh-up-focuses-last-result.jpg) | 上方向键聚焦最后一个真实匹配项。 |
| [19 打开实际目标](19-candidate-zh-opens-real-result-page.jpg) | Enter 打开当前隔离项目的 MCP 连接。 |
