# 定时任务编辑回执的桌面与正式接口证据

基线 `39808/ui` 连接真实隔离服务 `39806`，仅截断指定且已提交的编辑回执。

- [编辑原项目和重复规则](01-baseline-edit-original-definition.png)，[已提交编辑仍显示未确认](02-baseline-committed-edit-appears-unsaved.png)，[原样保存收到版本冲突](03-baseline-repeat-edit-version-conflict.png)。
- [同一定义的两个实际回执、当前状态和未来 Fire](baseline-edit-receipt-evidence.json)。

候选 `39810/ui` 连接独立服务 `39809`，WebSocket 返回 101。本人用桌面键鼠操作并逐张查看截图。透明代理在两个项目各截断一次已经提交的编辑回执。

- 英文项目：[编辑原名称与范围](04-candidate-en-edit-before-save.png)，[未确认反馈及原输入](05-candidate-en-edit-unconfirmed.png)，[切换设置后保留编辑](06-candidate-en-edit-after-settings-navigation.png)，[原样确认后原项目详情](07-candidate-en-edit-original-definition.png)。
- 中文项目：[编辑另一同名项目及 2099 年规则](08-candidate-zh-edit-scope-and-calendar.png)，[中文未确认反馈](09-candidate-zh-edit-unconfirmed.png)，[换名重用请求的冲突](10-candidate-zh-changed-edit-conflict.png)，[实际 409 诊断](11-candidate-zh-structured-edit-conflict.png)，[还原后打开原定义](12-candidate-zh-edit-original-project.png)，[竞争写入后保留输入](13-candidate-zh-competing-edit-preserved.png)，[重开最新版本并正常保存](14-candidate-zh-latest-edit-normal-receipt.png)。
- [真实请求、回执、两个项目、竞争写入及定时历史](candidate-edit-receipt-evidence.json)。代理回合记录含隔离业务字段及独立的请求追踪标识。检查器使用运行中的 `/doc` 校验正式请求、列表与历史响应。
- [服务重启后重放三个明确编辑](candidate-restart-evidence.json)仍返回各自接收的版本。中文项目的旧回执和后续当前版同时可读，改写同一请求仍收到结构化 409。[只读数据库对账](candidate-database-evidence.json)确认六个定义版本、六个历史 Fire、两个当前投递前沿、零执行尝试、任务和模型请求。
