# 定时任务草稿项目发现的真实证据

- [初次等待](01-baseline-targets-pending.png)和[实际截断](02-baseline-targets-failed.png)期间，项目区域都显示暂无已注册项目。
- [输入名称](03-baseline-error-cleared-by-draft.png)后，失败反馈和恢复入口一起消失，真实项目仍未读到。
- 另一次用现有入口[重试](04-baseline-targets-retry-pending.png)后，保留的查询[匹配真实项目](05-baseline-targets-recovered.png)，可以[实际选中该项](06-baseline-target-selected.png)。
- [基线真实回执](baseline-authoring-evidence.json)包含真实发现、扣留、截断、重试和独立接口校验。

截图均由本人复核。[根因、影响与方案](../../records/2026-11/2026-11-12-scheduled-authoring-project-discovery.md)
