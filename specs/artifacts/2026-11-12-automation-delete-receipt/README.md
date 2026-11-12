# 定时任务删除回执的桌面与正式接口证据

基线 `39811/ui` 连接已重启的隔离服务 `39809`，只截断已提交的选中删除回执。

- [两条同末段名项目的实际列表](01-baseline-delete-list-before.png)，[确认文字覆盖规则](02-baseline-delete-confirmation.png)。
- [已删除定义仍显示为启用](03-baseline-deleted-row-appears-active.png)，[再次确认仍保留旧行](04-baseline-repeated-delete-still-shows-row.png)，[实际 404 诊断](05-baseline-delete-404-diagnostics.png)。
- [真实请求、回执与正式列表](baseline-delete-evidence.json)，[只读数据库对账](baseline-delete-database.json)。

候选 `39813/ui` 连接 `39812`。本人逐张检查真实隔离桌面截图。

- 英文列表的[精确名称确认](06-candidate-en-named-confirmation.png)、[取消后原列表](07-candidate-en-cancel-returns-to-list.png)、[截断后删除待确认](08-candidate-en-delete-unconfirmed.png)、[键盘重试等待](09-candidate-en-one-retry-in-progress.png)与[已删除且焦点回列表](10-candidate-en-confirmed-deletion.png)。
- 中文另一项目的[原详情](11-candidate-zh-exact-project-before-delete.png)、[原名称确认](12-candidate-zh-named-confirmation.png)、[实际版本竞争](13-candidate-zh-delete-version-conflict.png)、[只读后显示最新内容](14-candidate-zh-latest-before-explicit-delete.png)和[最新名称确认](15-candidate-zh-confirm-latest-name.png)。[删除成功但列表读取中断](16-candidate-zh-confirmed-delete-refresh-failure.png)只显示仍存在的计划。[列表恢复后的保留详情](17-candidate-zh-retained-project-and-instruction.png)显示原项目及指令。
- [候选真实回合、并发编辑和正式接口](candidate-delete-receipt-evidence.json)、[重启后的原回执与结构化错误](candidate-restart-evidence.json)、[删除记录、历史触发与唯一当前前沿](candidate-database-evidence.json)。检查器使用运行中服务的接口描述验证正式响应，数据库只读对账。
