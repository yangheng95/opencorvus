# 资源管理器展开宽度验收

## 基线

- [英语打开初段逐字换行](baseline-en-early-open.png) · [英语全宽完成态](baseline-en-settled.png) · [关闭后会话恢复空间](baseline-en-closed.png)
- [中文约 230 像素时换行撑高](baseline-zh-opening-narrow.png) · [中文约 284 像素时恢复两行](baseline-zh-opening-near-floor.png) · [中文稳定完成态](baseline-zh-settled.png)
- [浏览同一实际项目文件](baseline-zh-guide-preview.png)

本人手动操作 `40268/ui/` 的真实桌面并逐图核对。构建入口为 `main-CysxSAvr.js`。中间帧几何为按窗口截图估计，两份真实文件接口响应 200，返回正文分别为磁盘原始 119 和 50 字节。
