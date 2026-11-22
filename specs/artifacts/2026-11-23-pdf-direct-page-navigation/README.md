# PDF 直接页码导航的实页证据

Windows 桌面浏览器真实开发页面，截图由实际交互产生并已逐张查看。[方案与结果](../../records/2026-11/2026-11-23-pdf-direct-page-navigation.md)

实页输入为[八页阅读手册](field-handbook.pdf)，含封面到第七页的真实内部链接。

| 原图 | 实际结果 |
| --- | --- |
| [01 静态页码](01-baseline-static-page-indicator.jpg) | 真实手册封面和 `1 / 8`，相邻翻页按钮。 |
| [02 逐页到末页](02-baseline-seven-steps-to-last.jpg) | 键盘七次逐页后到第 8 页，末页按钮有正确边界。 |
| [03 内部链接](03-baseline-embedded-link-still-works.jpg) | 作者链接使封面进入真实第 7 页。 |
| [04 键盘进入页码](04-candidate-keyboard-page-field.jpg) | 阅读控件组中的 Tab 到达实际可编辑页码。 |
| [05 直达末页](05-candidate-jump-to-last-page.jpg) | 输入 8 并回车进入真实末页，焦点仍在页码。 |
| [06 拒绝无效下界](06-candidate-invalid-low-keeps-page.jpg) | 输入 0 显示范围提示，文档仍是原第 8 页。 |
| [07 离焦取消](07-candidate-blur-restores-accepted-page.jpg) | 超上界草稿离焦后恢复为已接受的 8，焦点进入原缩放控件。 |
| [08 修复并跳到中间](08-candidate-repair-jumps-to-middle.jpg) | 拒绝小数后输入 4，实际进入中间页。 |
| [09 缩放与跳页](09-candidate-zoom-retained-on-jump.jpg) | 125% 缩放下实际显示直接打开的第 2 页。 |
| [10 直接回封面](10-candidate-jump-resets-reading-position.jpg) | 原页滚动后跳到封面，阅读位置回到页首。 |
| [11 内部链接仍可用](11-candidate-embedded-link-updates-input.jpg) | 内部链接目标第 7 页同步呈现在新输入框。 |
| [12 中文错误](12-candidate-chinese-invalid-page.jpg) | 非数字页码给出中文范围，原第 8 页保持。 |
| [13 中文直接跳页](13-candidate-chinese-direct-page.jpg) | 输入 06 归一为 6，打开该页。 |
| [14 重开](14-candidate-reopen-resets-page.jpg) | 工作台正常重开实际文件，初始页码和正文返回 1。 |
