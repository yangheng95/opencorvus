# 定时任务草稿项目发现的真实证据

- [初次等待](01-baseline-targets-pending.png)和[实际截断](02-baseline-targets-failed.png)期间，项目区域都显示暂无已注册项目。
- [输入名称](03-baseline-error-cleared-by-draft.png)后，失败反馈和恢复入口一起消失，真实项目仍未读到。
- 另一次用现有入口[重试](04-baseline-targets-retry-pending.png)后，保留的查询[匹配真实项目](05-baseline-targets-recovered.png)，可以[实际选中该项](06-baseline-target-selected.png)。
- [基线真实回执](baseline-authoring-evidence.json)包含真实发现、扣留、截断、重试和独立接口校验。
- 英文候选记录[等待](07-candidate-en-pending.png)、[目标附近的错误](08-candidate-en-failed.png)、[输入后反馈仍在](09-candidate-en-draft-preserved.png)、[原位重试](10-candidate-en-retrying.png)、[搜索焦点](11-candidate-en-recovered.png)和[键盘选中目标](12-candidate-en-target-selected.png)。
- 简体中文记录[等待](13-candidate-zh-pending.png)、[读取失败](14-candidate-zh-failed.png)、[第一次重试](15-candidate-zh-retrying.png)、[再次重试时继续编辑](16-candidate-zh-user-focus-pending.png)和[读回后保持输入焦点](17-candidate-zh-user-focus-recovered.png)。
- 独立服务读回[真实空结果](18-candidate-confirmed-empty.png)。项目与模型资料错误[独立呈现](19-candidate-projects-independent.png)。保留项目的[重读等待](20-candidate-projects-retained-pending.png)、[读取失败](21-candidate-projects-retained-failed.png)和[恢复当前结果](22-candidate-projects-retained-recovered.png)都显示同一个已选项目。
- [候选实际回执](candidate-authoring-evidence.json)记录独立资源的真实读回、原位重试及空结果。[隔离数据库](desktop-database-evidence.json)记录三套环境的定义和执行事实。

截图均由本人复核。[根因、影响与方案](../../records/2026-11/2026-11-12-scheduled-authoring-project-discovery.md)
