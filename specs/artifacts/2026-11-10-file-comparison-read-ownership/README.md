# 文件比较读取归属的证据

[规格与真实读取回执](../../records/2026-11/2026-11-10-file-comparison-read-ownership.md)。以下为本人手动操作隔离开发页的实际裁切截图，展示比较窗口和对应编辑器；真实请求身份、按键、等待与退休时序见规格。

- [基线：两次激活之间](04-baseline-between-two-activations.png)：正在读取时，原 `Read disk again` 仍可操作且持焦。
- [基线：最终返回的版本差异](02-baseline-diff-after-refresh.png)：磁盘 A 和原草稿可见，但接受的是第二次读取。
- [基线：关闭后的编辑器](05-baseline-draft-after-closing-comparison.png)：原草稿未写入磁盘，焦点回到比较按钮。
- [候选：英文读取等待](07-candidate-same-read-before-repeat.png)：仍为同一个具焦刷新按钮，显示 Loading…；关闭可用，比较模式保留。
- [候选：同一读取完成](08-candidate-en-original-read-completed.png)：基线 A 与磁盘 B 差异可见，刷新恢复并持焦。
- [候选：英文读取失败](10-candidate-en-failure-ready-to-retry.png)：原诊断可展开，具焦刷新可直接重试。
- [候选：中文读取等待](11-candidate-zh-pending-close-available.png)：忙碌文字本地化，关闭仍可用。
- [候选：中文关闭后的编辑器](12-candidate-zh-closed-editor-draft.png)：草稿仍在，焦点归还比较动作。
- [候选：中文重新打开](13-candidate-zh-reopened-current-disk-and-draft.png)：独立新读的磁盘 B 与原草稿清晰可区分。
