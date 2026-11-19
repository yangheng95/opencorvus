# 资源管理器展开宽度验收

## 基线

- [英语打开初段逐字换行](baseline-en-early-open.png) · [英语全宽完成态](baseline-en-settled.png) · [关闭后会话恢复空间](baseline-en-closed.png)
- [中文约 230 像素时换行撑高](baseline-zh-opening-narrow.png) · [中文约 284 像素时恢复两行](baseline-zh-opening-near-floor.png) · [中文稳定完成态](baseline-zh-settled.png)
- [浏览同一实际项目文件](baseline-zh-guide-preview.png)

本人手动操作 `40268/ui/` 的真实桌面并逐图核对。构建入口为 `main-CysxSAvr.js`。中间帧几何为按窗口截图估计，两份真实文件接口响应 200，返回正文分别为磁盘原始 119 和 50 字节。

## 候选

- [英文打开第一段](candidate-en-early-reopen.png) · [英文打开与目录加载](candidate-en-opening-layout.png) · [英文稳定](candidate-en-settled.png) · [实际关闭](candidate-en-closed.png)
- [中文约 230 像素裁边](candidate-zh-opening-narrow.png) · [中文稳定](candidate-zh-settled.png) · [实际分隔条最小宽度](candidate-zh-minimum-width.png)
- [最小宽度展开原树](candidate-zh-minimum-tree.png) · [打开指南](candidate-zh-minimum-guide.png) · [打开相对链接](candidate-zh-minimum-related.png)
- [真实标签溢出菜单](candidate-zh-minimum-overflow.png) · [真实搜索结果](candidate-zh-minimum-search.png) · [命中项焦点](candidate-zh-minimum-result-focus.png) · [回车后文件原文](candidate-zh-keyboard-opened-file.png)
- [关闭再开时原查询已出现](candidate-zh-retained-query-opening.png) · [再次打开完成态](candidate-zh-retained-query-settled.png) · [拖回普通宽度](candidate-zh-restored-width.png) · [清空搜索后原树](candidate-zh-restored-tree.png)

本人手动操作 `40270/ui/` 的真实桌面并逐图核对，构建入口为 `main-HtEAPlma.js`。中文过渡的可比截图中，正文从三行恢复为两行，搜索与文件列表的位置保持在稳定布局的纵向行。真实目录、搜索及文件读取的四次接口调用均为 200，原样本文字在候选与基线之间逐字节一致。
