# 同一项目文件跨标签页保存的桌面证据

基线 `41806/ui/` 提供 `main-BjF2PpWt.js`。三个标签页在服务正常在线时打开同一个 `checklist.txt`。

- [第一标签保存后包含新版第三行](baseline-writer-saved.jpg)
- [第二个干净标签仍显示旧的两行](baseline-clean-reader-stale.jpg)
- [第三个标签保留未保存编辑，尝试保存前只有未保存状态](baseline-dirty-reader-no-notice.jpg)
- [尝试保存旧版后原冲突提示、比较动作与草稿](baseline-dirty-save-conflict.jpg)
