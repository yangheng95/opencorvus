# 文件监视通知与编辑器实时核对证据

真实开发服务在自建 Windows 项目开启现有实验目录监视器。文件只含本次创建的示例文本。

- [原文件](baseline-editor-original.png)、[实际外部更改后的旧内容](baseline-stale-after-native-event.png)与[手动重载后的新磁盘行](baseline-manual-reload-confirms-disk.png)记录同一打开编辑器。
- [外部再次写入时的未保存草稿](baseline-draft-quiet-after-disk-change.png)显示旧盘基线和草稿，仍只有未保存状态。
- [原生与工作记录通知](baseline-watcher-events.jsonl)、[第一次真实磁盘读取](baseline-native-file-read.json)和[第二次真实磁盘读取](baseline-disk-v3.json)核对源路径、作用项目、磁盘新文本与真实请求。
