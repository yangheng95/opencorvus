# 实时流恢复后的项目配置桌面证据

基线 `main-BbSZv9MO.js` 来自同一个隔离服务。写入页直接使用 `41872/ui/`，观察页通过只中断本机实时连接的 `41876/ui/`。普通请求保持在线。

- [断开观察页实时连接时，直连页已保存 Ask me](baseline-writer-saved-during-gap.jpg)
- [实际实时流恢复，观察页仍显示旧权限](baseline-rejoined-but-reports-prior-mode.jpg)
- [重新打开整页后才读到当前权限](baseline-document-reload-recovers-current-mode.jpg)
