# Task 根输入物理所有者恢复证据

本批已修复根输入在旧进程死亡后等待原租期、活 peer（同机其他后端）被提前结算、执行失败未归还租约，以及初始化前扫描丢失原 Task 重试的问题。最终 run3 原三阶段真实 GPT-6.1 Sol 检查器通过；根因、横向审计及指标定义见[本批规格](../../records/2026-11/2026-11-27-task-ingress-process-owner-recovery.md)。未运行或新增界面自动化测试，未保存授权凭据。

首轮原 checker（检查器）的 passed **已人工拒收**：[准入失败事实](run1-execution-admission-failure.json)证明 219ms 只是空激活，真正执行又等待 120 秒；原审计结果没有改写。run2 明确失败，[原所有者事实](run2-execution-owner-facts.json)和真实等待截图 `run2-recovery-observation.png` 保留；它在身份扫描后丢失执行重试，第二阶段没有模型请求。最终交付仅以修复后的 run3 为完整通过。

[只读基线](baseline-owner-facts.json)来自[上一批原运行](../2026-11-27-real-task-recovery-without-request-ceiling/README.md)：原进程死亡后仍再等 117060ms 才分配根输入后继激活。[最终精确事实](run3-execution-owner-facts.json)保存 PID（进程标识符）、出生身份、轮次、原始 grant（授予）、精确 release（归还）及真实助手/请求/回答；同口径死亡结算到后继激活为 48ms。监听后 1229ms 激活、1548ms 创建助手，其首个实际 Provider 请求在 7927ms，不能把助手创建指标说成模型回答或请求完成耗时。

- [所有者修改前复现](formal-before.log)、[执行准入修改前复现](admission-before.log)、[初始化交接修改前复现](identity-admission-before.log)均保留原失败。[最终所有者检查](identity-admission-after.log)为 10 pass / 28 个断言，[最终五文件检查](focused-identity-final.log)为 75 pass / 153 个断言。物理子进程存活/死亡是真实；Task 数据和模型 runner（运行器）为局部受控夹具，未知观察分支显式使用替身，只证明局部合同。
- [请求汇总](request-accounting.json)、[逐次流式审计](model-request-audit.json)、[原 Task 事实](task-facts.json)：三轮 124 次请求，全部精确 Sol 且流式；最终 run3 为 42 次、记账完整，正常完成、执行中进度、顺序恢复、两次重启取消、唯一终态和原进程清理均通过。实际中断截点的 reading/awaiting_response（读取中/等待响应）保留原状。
- [真实完成决定截图](run3-completed-task.png)：本人在在线开发服务 `/ui` 展开并查看原完成工具回执、成员报告与已完成状态。[首条恢复回答](run3-first-recovery-answer.png)来自第一次重启后的原输入；[两条顺序回答与取消终态](run3-recovered-inputs-and-cancellation.png)来自第二次重启后的在线服务，经过实际滚动及人工视觉复核。

早期 `owner-before.log`、`owner-after-final.log`、`related-tests-after.log`、`focused-final.log`、`focused-admission-final.log` 和 run1/run2 页面保留调查历史；它们不替代最终 75 项检查和 run3 的真实验收。
