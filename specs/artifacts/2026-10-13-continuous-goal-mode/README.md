# 持续目标模式验收证据

对应[方案和覆盖边界](../../records/2026-10/2026-10-13-continuous-goal-mode.md)以及[当前架构](../../current/architecture/continuous-goal.md)。全部来自独立 worktree、隔离开发服务和本机已授权 Provider；没有操作用户现有窗口或生产数据库。

- [真实运行结果](real-results.json)：Chat、Task、Mission 各两次自动续跑并 complete；保留实际模型、流式请求、reader 结算和控制器 Message identity。所有请求实际使用 gpt-6.1-sol。tokenBudget 是新自动轮次的准入上限，已接受的轮次可超出。
- [Task 第二个目标](task-reopened-goal.json)和[执行轮次事实](task-occurrences.json)：同一 Task 从已完成的 epoch1 进入 epoch2 后完成。
- [Task 来源标识](task-attribution.png)：goal-controller 身份与实际续跑消息可见，前一个目标的 complete 及正常 Task 完成工具可见。
- [Task 重开完成](task-reopened-completed.png)：同一任务第二轮核对正文及正常完成工具。
- [Chat 最终页面](chat-completed.png)、[Mission 最终页面](mission-completed.png)：真实三轮消息、工具结果与完成产物的人工视觉复核。
- [核心合同最终复跑](core-tests.log)、[同批多进程/用量/原入口检查](related-tests.log)：后者包含已修正的批处理测试数据失败，核心最终结果以单独复跑为准，未隐藏失败。
- [复查服务关闭](review-settlement.json)：最终页面复查新进程的零 Provider 请求、服务结算和凭据对清理。
- [合并后的功能复跑](merged-tests.log)、[全工作区类型检查](workspace-types.log)、[已提交代码拓扑](module-topology.log)：最终集成验证。
- [取消与归档的最终回归](boundaries-final.log)：13项核心合同、60断言，使用真实生命周期 bridge 和 Session/Task 归档入口；[后端类型检查](boundaries-types.log)。

实际 checker：`packages/opencorvus/script/continuous-goal-check.ts`，明确设置 GOAL_CHECK_ALLOW_REAL_PROVIDER、GOAL_CHECK_AUTH_SOURCE、GOAL_CHECK_MODEL、GOAL_CHECK_EVIDENCE、GOAL_CHECK_KIND。首次读取凭据与模型目录后执行真实流式 preflight；GOAL_CHECK_HOLD_UI 仅有限时保留 /ui 供人工检查。GOAL_CHECK_REVIEW_RUN 指向原私有 server.json 时只重开同一历史，模型请求上限为0。

不保留 auth/models 文件、原始模型推理或完整私有 runtime；摘要只选择所需运行身份和计量事实。没有用 DOM、截图基线、哈希或源码文案断言替代功能/视觉验收。完整流式故障注入和真实 Mission 子 Task 场景未穷举，不能从本证据推导已覆盖。
