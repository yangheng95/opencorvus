# 382 成功工具结果的恢复断点

本轮为共享机制调查，尚未修改生产恢复行为。按 [Recall 与方案](../../artifacts/2026-10-05-connection-workspace-authority/source-result-recovery-plan-382.md) 单 agent 执行，保留工作区其他改动。

真实 ReadTool、权限授权、持久化和 Session 恢复函数确认两个问题，均影响 Full access 与 Ask me：

| 持久化断点 | 当前恢复结果 | 原成功事实 |
| --- | --- | --- |
| Tool outcome 已完成，Source 写入失败 | 原工具保持 completed，但重试被拒绝，Source 没有恢复 | Permission result 仍持有实际 source-file，真实读取各执行1次 |
| Permission result 已提交，Tool outcome 尚未提交 | 普通恢复将工具写成 process-execution-interrupted error | 同一精确 invocation 已有 execution_succeeded 和完整输出、来源 |

四个正确行为的正向 probe 合同均失败；这不是模型自述、标题推断或UI截图推断。首个探针模块路径错误已修复后重新执行，工具失败与产品失败分开归档。详见 [完整阶段数据与日志](../../artifacts/2026-10-05-connection-workspace-authority/source-result-recovery-382/README.md)。

全仓生产调用显示同一 Session 恢复函数被 Task-root 过期 activation、遗失的 dispatch worker、Mission 进程恢复、普通 Session loop 及 prompt lifecycle adapter 使用。不能把上述结果定为某个专家团局部异常。Task-root 恢复还必须处理旧 activation 写入围栏：现有 accepted-activity settlement 要求原 Provider/Tool outcome 全部闭合，不能直接放开 Source/所有终态 Part。

下一阶段须共同修正完整工具结果提交与成功 receipt 的恢复投影，保留原执行身份、结果和来源，不能重新执行外部效果；先覆盖 Task/Mission/Session、串并行、终态/重启和项目隔离，再交付生产修改。当前尚未证明真实OS崩溃或真实Provider恢复，未做UI更改。381测试的必传toolInput已补齐并运行原聚焦合同，不把这项小修当作本轮恢复问题已解决。
