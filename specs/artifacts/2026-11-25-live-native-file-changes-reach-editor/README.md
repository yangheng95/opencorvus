# 文件监视通知与编辑器实时核对证据

真实开发服务在自建 Windows 项目开启现有实验目录监视器。文件只含本次创建的示例文本。

- [原文件](baseline-editor-original.png)、[实际外部更改后的旧内容](baseline-stale-after-native-event.png)与[手动重载后的新磁盘行](baseline-manual-reload-confirms-disk.png)记录同一打开编辑器。
- [外部再次写入时的未保存草稿](baseline-draft-quiet-after-disk-change.png)显示旧盘基线和草稿，仍只有未保存状态。
- [原生与工作记录通知](baseline-watcher-events.jsonl)、[第一次真实磁盘读取](baseline-native-file-read.json)和[第二次真实磁盘读取](baseline-disk-v3.json)核对源路径、作用项目、磁盘新文本与真实请求。

候选继续使用同样的自建目录及现有目录监听。

- [干净编辑器自动更新](candidate-clean-editor-updates.png)、[草稿及时收到提示](candidate-draft-disk-change.png)及[比较原磁盘和草稿](candidate-comparison-disk-and-draft.png)。[对应外部文件回读](verified-primary-native-read.json)记录实际正文。
- [另一项目同名文件](candidate-other-project-keeps-own-file.png)与[同项目另一文件改动后的 Git 状态](candidate-git-reacts-to-sibling-file.png)记录读取范围。[另一文件回读](verified-reference-native-read.json)保留精确路径。
- [应用内正常保存](candidate-application-save.png)、[真实文件通知](verified-file-events.jsonl)及[最终磁盘与 Git 查询](verified-final-disk-and-git.json)核对保存、监视和独立项目。
