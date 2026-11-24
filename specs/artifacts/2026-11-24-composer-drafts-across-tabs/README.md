# 两个标签页写入草稿的桌面证据

基线服务 `41804/ui/` 提供 `main-BMcmOYAm.js`。前两个页面先打开，然后分别操作不同的真实测试对话。第三个干净页面核验持久结果。

- [Alpha 输入区和 Draft 标识](baseline-alpha-before-reopen.jpg)
- [Beta 输入区和 Draft 标识](baseline-beta-before-reopen.jpg)
- [第三页重新打开 Alpha，输入框为空](baseline-alpha-empty-after-reopen.jpg)
- [第三页重新打开 Beta，原句仍在](baseline-beta-present-after-reopen.jpg)

候选构建在同一个地址恢复升级前的草稿，并在关闭输入页后从新页面查看两条不同草稿。

- [迁移后 Beta 原句](candidate-migrated-beta.jpg)
- [新标签打开 Alpha](candidate-reopened-alpha.jpg)
- [新标签打开 Beta](candidate-reopened-beta.jpg)
- [清理 Alpha 草稿后 Beta 仍保持](candidate-beta-after-alpha-cleared.jpg)

最终构建在专用服务重启后完成同一地址的重读以及再写入两份草稿的复验。

- [服务重启后 Beta 原句](final-beta-after-restart.jpg)
- [重新打开后的最终 Alpha 草稿](final-reopened-alpha.jpg)
- [重新打开后的最终 Beta 草稿](final-reopened-beta.jpg)
- [启动实例、会话状态和本地数据库结果](observed-outcome.json)
