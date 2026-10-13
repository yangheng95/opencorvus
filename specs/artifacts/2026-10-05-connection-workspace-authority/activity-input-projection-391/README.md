# 391 历史活动与交接输入

[Recall与影响分析](../activity-input-projection-plan-391.md) · [月度记录](../../../records/2026-10/2026-10-13-activity-input-projection-391.md)。历史活动的两条生产读取现在按真实Message角色选择成员产出，与实时更新一致；原输入保留在完整会话和交接上下文。

[真实委派失败与共享终态调查](delegate-error-audit.md)：第一次Native运行遇Provider过载，并暴露父Tool覆盖错误和错误completed终态；[原始截图](00-provider-failure.png)保留，不算Sources验收成功。

- [01 未刷新完成态](01-live-completed.png)：父进展包含成员说明、read与最终正文；dock展示Source。
- [02 刷新重开](02-reopened.png)：同一会话/输入的进展保持相同内容，交接输入只通过Handoff context读取。
- [03 展开交接](03-handoff-expanded.png)、[04 实际交接任务](04-handoff-authored.png)：原始完整输入可展开并滚动阅读，中文任务文本保留。
- [05 打开Source](05-source-range.png)：真实文件第2—3行被选中。
- [运行核验](runtime-review.json)：after范围7次gpt-6.1-sol流式请求，规范Message/Tool/Source、HTTP/SSE与资源闭合。首次live范围6次传输完成中包含真实业务失败，单独保留。

所有截图经实际页面交互和人工查看；未新增/运行UI自动化。只改后端读取，复用389-final正式前端。4项聚焦活动正向测试与另外14项会话/身份测试通过，原测试输入缺少ledger的失败也保留。`checks/`归档完整脱敏日志、脚本和规范证据；压缩还原比对只检查归档完整性。委派错误终态和原Research Studio长历史仍未完成，整体持续目标保持active。
