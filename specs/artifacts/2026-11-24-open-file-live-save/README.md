# 同一项目文件跨标签页保存的桌面证据

基线 `41806/ui/` 提供 `main-BjF2PpWt.js`。三个标签页在服务正常在线时打开同一个 `checklist.txt`。

- [第一标签保存后包含新版第三行](baseline-writer-saved.jpg)
- [第二个干净标签仍显示旧的两行](baseline-clean-reader-stale.jpg)
- [第三个标签保留未保存编辑，尝试保存前只有未保存状态](baseline-dirty-reader-no-notice.jpg)
- [尝试保存旧版后原冲突提示、比较动作与草稿](baseline-dirty-save-conflict.jpg)

候选 `main-CSsBVckX.js` 使用相同本机地址和同一测试项目，增加一份独立参考文件对照。

- [写入页继续显示已保存的第四行](candidate-writer-saved.jpg)
- [干净读页自动显示同一第四行](candidate-clean-reader-updated.jpg)
- [草稿页在保存前显示磁盘变化提示并保留草稿](candidate-dirty-reader-warned.jpg)
- [对照文件保持两行原文](candidate-independent-reference.jpg)
- [实际磁盘和草稿的逐行比较](candidate-disk-and-draft-comparison.jpg)
- [仍用原基线保存时的实际冲突和保留内容](candidate-dirty-save-conflict.jpg)
- [真实保存、磁盘读取和最终文件证据](observed-outcome.json)
