# PDF 阅读区域键盘焦点的真实桌面截图

独立开发基线服务 40846，使用 [既有八页手册](../2026-11-23-pdf-direct-page-navigation/field-handbook.pdf)。

- [01 英文 100%，放大至 200% 后从 Zoom in 跳过正文进入内链](01-baseline-en-100-tab-skips-scrollable-pdf-reader.jpg)
- [02 英文 100%，借助内链焦点可在同一正文滚动](02-baseline-en-100-page-down-while-link-focused.jpg)
- [03 英文 100%，无内链时隐式焦点显示未命名正文容器](03-baseline-en-100-no-link-page-focus-target.jpg)
- [04 简体中文 160%，Tab 仍跳过正文直接进入作者内链](04-baseline-zh-160-link-page-tab-skips-reading-region.jpg)
- [05 简体中文 160%，现有内链正常打开第 7 页](05-baseline-zh-160-link-opens-original-page-seven.jpg)

## 候选

独立开发服务 40848，真实文件工作台上的英文 100% 和简体中文 160% 原图。

- [06 英文从放大控件用 Tab 进入有名称且可见焦点的正文](06-candidate-en-100-tab-focuses-named-pdf-region.jpg)
- [07 英文在第 1 页正文使用 Page Down 滚动](07-candidate-en-100-page-down-reads-lower-cover.jpg)
- [08 方向键在同一页正文横向滚动](08-candidate-en-100-direction-keys-pan-reading-region.jpg)
- [09 下一次 Tab 到作者内链，由 Enter 打开第 7 页](09-candidate-en-100-native-tab-link-opens-page-seven.jpg)
- [10 中文无内链第 4 页通过相同次序获得阅读焦点](10-candidate-zh-160-no-link-page-has-localized-reading-focus.jpg)
- [11 中文正文使用 Page Down 滚至同一页下方](11-candidate-zh-160-page-down-keeps-page-four-and-scrolls.jpg)
- [12 中文带内链页面仍可依次 Tab 到正文和原作者链接](12-candidate-zh-160-reader-precedes-existing-author-link.jpg)
- [13 内链跳转后正文焦点和真实第 7 页同步](13-candidate-zh-160-link-destination-uses-current-page-label.jpg)
