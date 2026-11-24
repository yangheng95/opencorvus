# 已安装专家团详情起始位置的桌面证据

基线是独立开发服务 `41550/ui/` 的真实桌面截图。所有截图均经本人目视复核。英文 100%，简体中文 160%。

| 基线 | 观察 |
| --- | --- |
| [英文重开 12](baseline-en-reopening-project-package.jpg) | 列表偏移 13.33 像素留在详情，设置标题此时仍完整。 |
| [英文深行重开 13](baseline-en-deep-reopen-native-scroll-to-top.jpg) | 原生焦点把此前屏外的返回按钮带入视区，详情从零起。 |
| [中文返回原行](baseline-zh-return-to-exact-package-row.jpg) | 真实筛选及 07 物理身份保持，列表偏移 61.33 像素。 |
| [中文指针重开](baseline-zh-pointer-reopen-clips-setting-title.jpg) | 标题部分离屏，包身份及返回按钮可读。 |
| [中文回车重开](baseline-zh-keyboard-reopen-clips-setting-title.jpg) | 同一裁切稳定复现，原返回按钮获得焦点。 |

[基线界面实测](baseline-desktop-focus.json)与[真实目录、详情和数据](baseline-catalog-proof.json)。

候选是 `41552/ui/` 的同样桌面范围，以下原图均已人工查看。

| 候选 | 观察 |
| --- | --- |
| [英文回车重开](candidate-en-keyboard-reopen-at-top.jpg) | 标题回到顶部，保持 Package Details、准确包 12 和返回焦点。 |
| [中文返回原行](candidate-zh-return-to-exact-package-row.jpg) | 准确 07 和扩展包筛选保持，列表以原行继续浏览。 |
| [中文指针重开](candidate-zh-pointer-reopen-shows-complete-title.jpg) | 完整标题、包 07 及所选能力包详情显示在首屏。 |
| [中文回车重开](candidate-zh-keyboard-reopen-shows-complete-title.jpg) | 完整标题和返回按钮的键盘焦点可见。 |
| [继续阅读原文](candidate-zh-retained-tab-allows-reading-original.jpg) | 实际滚到 07 的 README、选择指引和声明副标题。 |
| [首次打开相邻包](candidate-zh-new-package-opens-overview.jpg) | 08 顶部显示原概览、来源、版本和项目选择。 |
| [续页移交焦点](candidate-zh-real-continuation-focuses-first-new-package.jpg) | 真实第二页第一项 16 获得焦点。 |

[候选界面实测](candidate-desktop-focus.json)与[正式目录、详情和数据](candidate-catalog-proof.json)。
