# 重启服务与已打开文件的桌面证据

基线页面 `41790/ui/` 提供 `main-D7c9dwp_.js`，在 1280×720 桌面使用两个专用标签页。

- [离线期间未保存的草稿](baseline-offline-draft.jpg)。
- [已恢复在线的干净文件仍显示旧版本](baseline-online-clean-editor-stale.jpg)，[有草稿页也没有收到新磁盘版本的提示](baseline-online-dirty-editor-unwarned.jpg)。
- [手动比较读到离线期间保存的磁盘内容和原草稿](baseline-manual-compare-after-restart.jpg)。
- [两个进程、离线写入和真实重连接口](baseline-restart-and-file-reads.json)。

候选 `41792/ui/` 提供 `main-DoKTFShX.js`，使用三个真实桌面标签页。

- [重连后干净文件自动显示新磁盘正文](candidate-online-clean-current.jpg)。
- [重连后保留草稿并提供磁盘差异提示](candidate-online-dirty-warning.jpg)。
- [对照项目的文件未变化，独立草稿保留](candidate-online-unchanged-control.jpg)。
- [新磁盘内容和原草稿的实际比较](candidate-reconnect-disk-and-draft.jpg)。
- [异进程重启、三个通知和文件读取、磁盘内容和数据库记录](candidate-restart-and-file-reads.json)。
