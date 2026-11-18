# 图片缩放锚点的真实桌面证据

第 318 批，由本人独立操作；不使用 UI 自动化测试、DOM 断言或像素差异。服务、项目、浏览器配置和图片均为本批隔离样本。未调用模型或使用外部凭据。

- [高分辨率图的整图显示](baseline-large-fit.png)：开发页面 `40102/ui/`，原件 4800×3200，初始约 17%，中心圆圈可见。
- [在中心 Ctrl 滚轮放大一次](baseline-large-wheel-drift.png)：约 42% 时中心圆圈明显移到左侧。截图由本人逐张查看，不以截图比较程序判定。
- [实际原件](coordinate-grid.svg)：5167 字节，真实浏览器下载名称 `coordinate-grid.svg`，下载内容与项目中的原件逐字节相同。SVG（Scalable Vector Graphics，可缩放矢量图形）中的逻辑网格坐标用于人工辨认查看位置。

[根因、范围与验收方案](../../records/2026-11/2026-11-19-image-preview-zoom-anchor.md)
