# 记忆页两个同名项目的桌面验收

## 基线

- [现有主侧栏识别两个不同父目录](baseline-en-sidebar-project-suffixes.png)
- [设置选择器在不同部分之前截断两条路径](baseline-en-picker-clips-distinction.png)
- [方向键高亮第二行时仍无法由路径区分](baseline-en-second-highlight-still-ambiguous.png)
- [选中后才看到完整南区目录](baseline-en-visible-directory-only-after-choice.png)

本人在 Windows Chrome 1280×800 视口操作并复核 `40336/ui/` 的 `main-sP6B_RIw.js`。 [两个项目和原空聊天的正式回执](baseline-memory-picker-receipts.json)

## 候选

- [英文展开时已可识别两个同名项目](candidate-en-opened.jpg)
- [下方向键高亮南区](candidate-en-south-highlight.jpg)
- [回车确认后显示完整南区路径](candidate-en-south-selected.jpg)
- [返回应用后仍是原北区聊天](candidate-en-returned-chat.jpg)
- [简体中文显示两个原始目录区别段](candidate-zh-opened.jpg)
- [鼠标选中南区后显示完整路径](candidate-zh-south-selected.jpg)
- [重新展开后用上方向键高亮北区](candidate-zh-north-highlight.jpg)
- [Escape 收起并恢复焦点，南区仍选中](candidate-zh-escape-focus.jpg)

本人于 2026-11-22 在 Windows 桌面应用内置浏览器的 1280×720 视口操作并复核 `40338/ui/` 的 `main-CXavjC5-.js`。 [候选正式回读](candidate-memory-picker-receipts.json)
