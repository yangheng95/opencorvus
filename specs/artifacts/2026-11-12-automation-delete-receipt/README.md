# 定时任务删除回执的桌面与正式接口证据

基线 `39811/ui` 连接已重启的隔离服务 `39809`，只截断已提交的选中删除回执。

- [两条同末段名项目的实际列表](01-baseline-delete-list-before.png)，[确认文字覆盖规则](02-baseline-delete-confirmation.png)。
- [已删除定义仍显示为启用](03-baseline-deleted-row-appears-active.png)，[再次确认仍保留旧行](04-baseline-repeated-delete-still-shows-row.png)，[实际 404 诊断](05-baseline-delete-404-diagnostics.png)。
- [真实请求、回执与正式列表](baseline-delete-evidence.json)，[只读数据库对账](baseline-delete-database.json)。
