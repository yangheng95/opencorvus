# 两个标签页修改外观偏好的桌面证据

基线使用 `41808/ui/` 与 `main-CSsBVckX.js`。先打开两个标签页，然后在各页只改一项，分别在新开页核对结果。

- [第一标签切换到简体中文](baseline-first-tab-chinese.jpg)
- [第二个原标签改主题之前，新开的验证标签已读到简体中文](baseline-confirmed-chinese-before-second-edit.jpg)
- [第二个原标签只改主题为亮色](baseline-second-tab-light.jpg)
- [主题改变后，新开的标签显示亮色及已退回的英文](baseline-reopen-light-but-language-reverted.jpg)

候选 `main-h3Osq4OV.js` 在同一浏览器地址迁移并验证两种保存顺序。

- [升级后读取旧版留下的英文和浅色](candidate-migrated-light-english.jpg)
- [先改语言、另页再改主题，新开页显示简体中文和深色](candidate-reopen-chinese-dark.jpg)
- [先改主题、另页再改语言，新开页显示英文和浅色](candidate-reopen-english-light.jpg)
- [同项目的新标签仍恢复未发送的原草稿](candidate-existing-draft-storage-still-restores.jpg)
- [真实页面的设置回读和运行记录](observed-outcome.json)
