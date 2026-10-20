# Task Goal 的真实权限与续跑

修复 Core Task 工具丢失原生权限来源的问题。原 get_continuous_goal 和 read_task_message 在 Ask 下被误判为 projected/external_effect；修复后两个工具实际完成并读回本次 Goal 与 controller 原文。Goal 写入和 Task 完成仍逐次审批。

[持久化事实](results.json)保留基线失败和修复后结果：同一 Task 的 epoch1 completed，基线 Goal 触发 epoch2，但预设12次请求上限使 Task 最终 failed；修复后通过真实 Task 表单创建不同 Goal，自动重开 epoch3，模型输出 TASKGOAL466FIXED、完成 Goal 并通过原 manage_task 完成 Task。未用人工 Goal complete 代替模型判断。最终用量以结算后的 usage facts 为准；截图之间可出现已接受请求的迟到用量。

[原生与 Provider 结算](native-settlement.json)记录每个实际 gpt-6.1-sol 流、凭据/模型目录预检、两个原 native/output/request/launcher 的终态和公开 shutdown。[历史核对](results.json)保留完整 QA412 的原身份、目录与归属，schema2。隔离复制的 auth 与完整 models 成对使用，实际秘密扫描后[退休](private-pair-retirement.json)，不写源凭据、不 refresh。

[人工页面记录](manual-ui.json)中的12张1280×720截图全部通过内置浏览器实际交互并人工查看：

- [首页原输入](initial-draft.png)、[实际 Chat 结果](chat-initial-result.png)：首页发送没有创建 Task，Task 创建资格来自既有公开 API。
- [Task 初次完成审批](task-initial-approval.png)、[初次完成](task-initial-completed.png)、[原 Goal 表单](task-goal-form.png)。
- [基线只读误审批](task-goal-read-approval.png)、[基线 Task 失败](task-goal-before-final.png)。
- [新 Goal 的 Task 作用域](task-goal-final-form.png)、[保留的 Goal 写入审批](task-goal-final-write-approval.png)、[保留的 Task 完成审批](task-final-complete-approval.png)。
- [Task/Goal 均完成](task-goal-final-completed.png)、[离开后重新选择恢复](task-goal-final-restored.png)。

截图还确认审批历史中的大段原始 JSON 占满对话区；这项体验问题尚未修复。本轮没有 UI 源码变化，使用正式464前端；没有运行 UI 自动化。Sources、侧 agent 直播 Rendering、原生目录选择及配置保存性能不具有本轮新资格。下一轮先处理审批信息呈现，保留原有性能失败。
