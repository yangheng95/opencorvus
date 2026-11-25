# 保存快照比较的实页与存储回执

## 基线

- [真实快照和六条原比较](legacy-snapshot-evidence.json)，[正式会话读回的原始数据](baseline-public-snapshot.json)。
- [新增文本只显示未知提示](baseline-saved-text-without-preview.png)，[零字节文本的原状态](baseline-empty-file-unclassified.png)，[二进制文件的原状态](baseline-binary-file-unclassified.png)。

## 候选版桌面

- [新增文本和两行原文](candidate-added-text.png)，[零字节新增文本](candidate-empty-text.png)，[同一路径修改的两个版本](candidate-modified-text.png)，[已删除文件的历史正文](candidate-deleted-text.png)。
- [二进制明确为非文本](candidate-binary.png)，[隐藏非文本后为 5 项](candidate-text-filter.png)，[从原有空文件修改](candidate-previously-empty.png)，[读取当前文件](candidate-current-file.png)。
- [迁移的旧会话保留未知提示](candidate-migrated-legacy.png)。

## 候选版数据

- [真实 Git 树重放并发布的当前记录](candidate-snapshot-evidence.json)，[重启后两个公开端点的回执](candidate-public-snapshots.json)，[当前与迁移后的持久文件](candidate-physical-migration.json)。
- [带 Unicode 和制表符的真实 Git 路径输出](candidate-legacy-git-path-observation.json)。
