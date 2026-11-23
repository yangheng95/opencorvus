# 导航提示与标题菜单的桌面实拍

隔离 OpenCorvus 开发页面，1280×720，原图由本人逐张复核。[规格](../../records/2026-11/2026-11-23-navigation-tooltip-workspace-layer.md)

| 基线实拍 | 实际画面和焦点 |
| --- | --- |
| [01 独立导航提示](01-baseline-rail-tooltip-standalone.jpg) | Tasks 提示完整可读。 |
| [02 导航提示遮住帮助](02-baseline-tooltip-covers-help.jpg) | 鼠标留在 Tasks，键盘打开 Help，提示遮住部分菜单。 |
| [03 关于焦点仍可达](03-baseline-focus-on-obscured-about.jpg) | 按 End 到 About，提示盖住聚焦项文字。 |
| [04 普通模态对照](04-baseline-tooltip-when-mission-dialog-is-open.jpg) | 多步任务表单正确持有焦点且可读。 |
| [05 独立视图菜单对照](05-baseline-view-menu-without-active-tooltip.jpg) | Chats 的这一次操作姿态提示未出现，View 正常可读。 |
| [06 定时入口复现](06-baseline-scheduled-tooltip-over-help-about.jpg) | Scheduled 提示遮住当前已聚焦的 About。 |
| [07 更多菜单对照](07-baseline-rail-more-menu-clears-scheduled-tooltip.jpg) | 进入更多菜单后焦点在 Archive，先前 Scheduled 提示已消失。 |

| 候选实拍 | 实际画面和焦点 |
| --- | --- |
| [08 英文普通缩放任务提示](08-candidate-en-100-standalone-hint.jpg) | 100% 时 Tasks 提示完整读得清。 |
| [09 英文菜单与提示相交](09-candidate-en-100-help-about-readable.jpg) | Help 的 About 聚焦，文字及边界完整。 |
| [10 英文实际关于页](10-candidate-en-about-opens-actual-settings-page.jpg) | 按 Enter 打开真实目标设置。 |
| [11 中文独立菜单](11-candidate-zh-150-help-without-active-hint.jpg) | 150% 时无可见提示的对照，焦点在关于项。 |
| [12 中文任务独立提示](12-candidate-zh-150-standalone-task-hint.jpg) | 指针仍在任务按钮，说明完整显示。 |
| [13 中文任务同时显示菜单](13-candidate-zh-150-overlap-menu-visible.jpg) | 任务提示和帮助交叉，前台菜单完整，关于聚焦。 |
| [14 中文定时独立提示](14-candidate-zh-150-standalone-scheduled-hint.jpg) | 定时设置里的原悬停说明完整显示。 |
| [15 中文定时同时显示菜单](15-candidate-zh-150-scheduled-hint-below-help.jpg) | 定时提示仍在，帮助及关于焦点清楚。 |
| [16 中文实际关于页](16-candidate-zh-about-opens-with-schedule-hover.jpg) | 键盘动作打开中文关于设置。 |
| [17 中文独立更多菜单](17-candidate-zh-more-menu-keeps-actual-focus.jpg) | 更多菜单正常绘制，归档获得原焦点。 |
