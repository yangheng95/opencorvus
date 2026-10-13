# Task / Mission 持续目标真实恢复证据

对应[本轮 Recall 与验收定义](../../records/2026-10/2026-10-13-continuous-goal-crash-recovery.md)。

- [基线目标合同](baseline-goal-contracts.log)：`43a596c26` 上原核心13、独立15、并发进程1，合计29项通过；不作为真实 Provider 崩溃验收。
- [主 agent 调用链复核](parent-review.md)：启动发现、Mission 恢复参与者、完成与计量事实的判定依据。
- [检查器正向合同复跑](parent-checker-tests.log)：主 agent 独立复跑4项、6断言通过。
- [根类型检查](root-typecheck.log)：8个工作区类型检查全部通过。

| 运行 | 结果 | 真实请求 | 关键证据 |
| --- | --- | --- | --- |
| Task run1 | 通过；主 agent 补强独立复核 | 11 | [结果](task-run1/result.json)、[物理中断](task-run1/crash-cut.json)、[最终事实](task-run1/final-facts.json)、[二次复核](task-run1/parent-evidence-review.json) |
| Mission run1 | 失败，保留原结果；检查器错误地强制要求新增恢复消息 | 14 | [失败结果](mission-run1/result.json)、[真实退出后事实](mission-run1/crashed-facts.json)、[失败时事实](mission-run1/failed-facts.json) |
| Mission run2 | 修正检查器后完整复测通过 | 19 | [结果](mission-run2/result.json)、[真实退出后事实](mission-run2/crashed-facts.json)、[恢复准入](mission-run2/recovery-admission.json)、[二次复核](mission-run2/parent-evidence-review.json) |

三个独立 run 共44次真实 `openai/gpt-6.1-sol` 流式请求。每 run 上限32次，崩溃前后累计；各自有限目标的预算为800000 tokens/3自动轮次。成功的 Task 和 Mission 均保持同一目标、原续跑记录、原控制输入及1次自动轮次，恢复后真实结算并完成原模式合同；目标账本累计分别为212143与225103 tokens。硬中断未返回 usage 的远端消耗仍为 unknown，不能把这些目标账本数字当作全部服务端计费消耗。

主 agent 使用[独立证据复核脚本](review-evidence.mjs)重新核对保留的JSON，并人工阅读[Task正文](task-run1/transcripts.json)和[Mission正文](mission-run2/transcripts.json)，确认六项标准已实际交付。Mission 正常结束还绑定公共 accepted outcome、精确 `panel_complete_mission` receipt 与随后完成的 final stop。模型自述“未发生中断”与物理事实不符，未被用作验收依据；既有错误历史默认投影边界详见[主 agent 复核](parent-review.md)与[本轮记录](../../records/2026-10/2026-10-13-continuous-goal-crash-recovery.md)。

各 run 的 `settlement.json` 保留物理进程退出、最后监听端口关闭和auth/models副本清理结果；Task run1两代服务复用同端口，第一项检测时新服务仍活着，最终检测关闭。检查器已改为所有子进程退出后再统一检查去重端口。本轮没有修改生产恢复实现，修正了检查器的因果身份、取样事务、最终回复收束和无活动投影，并同步既有架构语义。

覆盖已接受自动轮次的真实响应中断与正式启动恢复；未扩展恢复中再次崩溃、提交前崩溃、Mission子Task崩溃及多项目同时物理故障。没有UI改动或UI自动化。
