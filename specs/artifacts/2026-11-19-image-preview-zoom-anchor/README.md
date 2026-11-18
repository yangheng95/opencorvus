# 图片缩放锚点的真实桌面证据

第 318 批，由本人独立操作；不使用 UI 自动化测试、DOM 断言或像素差异。服务、项目、浏览器配置和图片均为本批隔离样本。未调用模型或使用外部凭据。

- [高分辨率图的整图显示](baseline-large-fit.png)：开发页面 `40102/ui/`，原件 4800×3200，初始约 17%，中心圆圈可见。
- [在中心 Ctrl 滚轮放大一次](baseline-large-wheel-drift.png)：约 42% 时中心圆圈明显移到左侧。截图由本人逐张查看，不以截图比较程序判定。
- [实际原件](coordinate-grid.svg)：5167 字节，真实浏览器下载名称 `coordinate-grid.svg`，下载内容与项目中的原件逐字节相同。SVG（Scalable Vector Graphics，可缩放矢量图形）中的逻辑网格坐标用于人工辨认查看位置。
- [基线输入及原件事实](baseline-original.json)：实际页面、指针位置、下载名称和字节。
- [首次候选补丁存档](candidate.patch)：共享图像缩放位置换算及对应架构说明。首次因桌面 URL 识别中断而仅存档；后续恢复同一补丁并完成下列实际验收，当前实现仍以产品源码为准。
- [停机后的只读数据库事实](runtime-counts.json)：两个隔离库的会话、消息和部件均为零；两个服务监听均已释放。

候选来自新的隔离服务进程 `40104/ui/`，实际资源为 `main-Dj85Jkx_.js`、`main-0fxqRynJ.css`。以下截图全部由本人逐张复核。

- [英文整图](candidate-fit-en.png)、[在中心放大](candidate-center-wheel-en.png)：17% 到 42% 保持同一中心标记。
- [平移后的查看点](candidate-panned-en.png)、[围绕该点放大](candidate-panned-wheel-en.png)：偏离窗口中心的圆圈位置在 42% 到 67% 时保持稳定，随后实际缩回。
- [按钮放大](candidate-button-plus-en.png)、[按钮缩小](candidate-button-minus-en.png)：围绕画布中心变更比例，并回到原查看范围。
- [菜单整图适应](candidate-fit-reset-en.png)、[宽度适应](candidate-fit-width-en.png)、[原始尺寸](candidate-original-size-en.png)：分别约 17%、22%、100%，原始尺寸回到原图起点。
- [关闭后的原入口](candidate-return-focus-en.png)、[Enter 重新打开](candidate-keyboard-reopen-en.png)：Escape 归还入口焦点。
- [中文整图](candidate-fit-zh.png)、[中文中心缩放](candidate-center-wheel-zh.png)、[中文操作菜单](candidate-menu-zh.png)、[键盘执行适应图片](candidate-keyboard-fit-zh.png)：真实设置切换语言后复测。
- [候选下载事实](candidate-original.json)、[实际资源及交互记录](candidate-runtime.json)：浏览器下载仍为 `coordinate-grid.svg`、5167 字节，与实际源文件一致。没有模型请求。

[根因、范围与验收方案](../../records/2026-11/2026-11-19-image-preview-zoom-anchor.md)
