# 项目模式保存与恢复的桌面证据

基线来自 `41810/ui/` 的 `main-h3Osq4OV.js`。两个不同的隔离项目已实际对工作台可见。

- [实际选了 Code 后在新开页进入原项目，模式仍为默认值](baseline-reopened-first-project-default.jpg)
- [原项目选择 Mission 后回到默认模式](baseline-first-project-after-choosing-mission.jpg)
- [应用内日志显示实际的持久化结构化克隆错误](baseline-project-mode-clone-error.jpg)

候选 `main-ba9hilQp.js` 使用相同浏览器地址和两个测试项目。第一项选择先通过新页面回读，再在另一个原有标签写入第二项。

- [第二项目保存为 Work · Mission](candidate-second-project-mission.jpg)
- [第二个原标签切回第一个项目时恢复 Code · Chat](candidate-return-first-project-same-tab.jpg)
- [新开页重新打开第一个项目时保留 Code · Chat](candidate-reopen-first-project-code.jpg)
- [新开页重新打开第二个项目时保留 Work · Mission](candidate-reopen-second-project-mission.jpg)
- [项目身份、实际模式回读和数据库结果](observed-outcome.json)
