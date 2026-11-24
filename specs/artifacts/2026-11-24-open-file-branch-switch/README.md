# 分支切换和已打开文件的真实桌面证据

基线 `41780/ui/` 加载 `main-DPV2Gw9j.js`。两个专用标签页操作同一测试项目。

- [环境信息已确认切到 review](baseline-branch-switched.jpg)。
- [另一标签页已打开且没有草稿的文件仍显示 main 正文](baseline-editor-stale-after-switch.jpg)。
- [两次切换、文件保存冲突和正式事件流事实](baseline-branch-requests-and-events.json)。

最终 `41782/ui/` 加载 `main-D7c9dwp_.js`，使用相同工作台宽度。

- [干净文件跟随切换显示 review 原文](final-review-auto-updated.jpg)。
- [切回 main 后的提示及未保存备注](final-dirty-notice.jpg)，[磁盘版和带备注草稿的比较](final-disk-and-draft-comparison.jpg)。
- [409 冲突和保留草稿](final-save-conflict-without-duplicate.jpg)。
- [首次候选时对照项目同名文件仍属于自身](candidate-control-project-unchanged.jpg)。
- [最终切换通知、请求、文件和数据库事实](final-branch-requests-and-events.json)。
