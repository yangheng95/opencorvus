# 全图预览操作菜单的桌面证据

第 302 批使用真实 Windows Chrome 和项目开发服务。样本沿用[全图边角证据](../2026-11-12-image-preview-full-frame/README.md)。

- [Tab 到关闭按钮](baseline-tab.png)
- [Shift+F10 后仍在预览](baseline-shift-f10.png)
- [下一次 Tab 到图像滚动区](baseline-tab-body.png)
- [继续 Tab 到缩小](baseline-tab-zoom.png)
- [对实际图像右键打开操作菜单](baseline-context-menu.png)

## 候选验收

| 桌面实拍 | 可见行为 |
| --- | --- |
| [英文页头菜单](candidate-enter-menu-en.png) | Enter 打开，首项有焦点，`1:1` 与文案分开 |
| [整图适应](candidate-fit-image-en.png) | 45% 显示四个角标，操作按钮重新取得焦点 |
| [适应宽度](candidate-fit-width-en.png) | 实际切回 100%，保持顶部对齐 |
| [图上右键](candidate-rightclick-125-en.png) | 125% 下在指针处显示同一组操作 |
| [英文键盘顺序](candidate-tab-actions-en.png) | 从下载按钮 Shift+Tab 到可见的操作按钮焦点 |
| [英语文件栏焦点归还](candidate-file-return-en.png) | Escape 后原图触发器的焦点环 |
| [简体中文操作菜单](candidate-enter-menu-zh.png) | 从键盘进入，四项操作均为当前语言 |
| [键盘选中原始尺寸](candidate-original-focused-zh.png) | 方向键到原始尺寸，仍显示 125% |
| [执行原始尺寸](candidate-original-100-zh.png) | 显示 100% 并聚焦操作按钮 |
| [关闭中文草稿预览](candidate-draft-return-zh.png) | 两次 Escape 后草稿缩略图保持焦点 |
| [重开中文预览](candidate-draft-reopen-zh.png) | Enter 打开原图，焦点回到操作按钮 |

[高图原件](source-tall-markers.png)、[小图原件](../2026-11-12-image-preview-full-frame/source-panel-small.png)与[真实开发接口和浏览器下载记录](candidate-runtime.json)。以上截图逐张人工复核。
