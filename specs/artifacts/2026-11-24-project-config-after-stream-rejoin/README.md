# 实时流恢复后的项目配置桌面证据

基线 `main-BbSZv9MO.js` 来自同一个隔离服务。写入页直接使用 `41872/ui/`，观察页通过只中断本机实时连接的 `41876/ui/`。普通请求保持在线。

- [断开观察页实时连接时，直连页已保存 Ask me](baseline-writer-saved-during-gap.jpg)
- [实际实时流恢复，观察页仍显示旧权限](baseline-rejoined-but-reports-prior-mode.jpg)
- [重新打开整页后才读到当前权限](baseline-document-reload-recovers-current-mode.jpg)

候选 `main-sNkT02-b.js` 使用相同的两个实际端口，重新执行实时连接中断及恢复。[验收与服务请求](../../records/2026-11/2026-11-24-project-config-after-stream-rejoin.md#实施和复验)

- [恢复之前，观察页保留未提交草稿和上次接受的状态](candidate-before-rejoin-with-draft.jpg)
- [实时流恢复即读到 Ask me，原页面及草稿继续保留](candidate-rejoined-current-mode-with-draft.jpg)
- [另一项目仍显示自己的 Full access](candidate-other-project-remains-current.jpg)
