# 同名草稿侧栏提示桌面验收

## 基线

- [指针打开南区后，提示只有原题、时间和项目](baseline-en-south-pointer-summary.png)
- [键盘聚焦下一行，北区提示与南区无法区分](baseline-en-north-keyboard-summary.png)
- [按回车打开北区后看到独立身份及原请求](baseline-en-opened-north-original.png)
- [最近列表的跨项目同名草稿提示](baseline-en-peer-recent-summary.png)

本人在 Windows Chrome 1280×800 视口操作并逐图复核 `40324/ui/` 的 `main-83MckJTr.js`。 [正式查询和原会话读回](baseline-sidebar-draft-receipts.json)

## 候选版

- [英文指针打开南区时显示南区原请求](candidate-en-south-pointer-preview.png)
- [英文键盘预览北区时仍停留在南区会话](candidate-en-north-keyboard-preview.png)
- [回车进入已预览的原北区会话](candidate-en-opened-north-original.png)
- [英文最近列表预览跨项目的独立请求](candidate-en-peer-recent-preview.png)
- [回车打开另一项目的正式原会话](candidate-en-opened-peer-original.png)
- [中文键盘预览北区的保存文字与原日期](candidate-zh-north-before-selection.png)
- [中文键盘返回南区的不同预览](candidate-zh-south-project-preview.png)
- [中文最近列表预览原跨项目草稿](candidate-zh-peer-recent-preview.png)
- [长草稿在两行截断并显示创建时间及项目](candidate-zh-long-request-two-lines.png)
- [打开同一长草稿后显示完整两段](candidate-zh-long-request-full-original.png)

本人在 Windows Chrome 1280×800 视口操作并逐图复核 `40326/ui/` 的 `main-PPcSIc8f.js`。 [交互后的原项目回执](candidate-sidebar-draft-receipts.json) · [长草稿正式回执](candidate-long-draft-receipt.json)
