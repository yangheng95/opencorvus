# 382 工具结果恢复调查证据

[Recall、执行方案与范围](../source-result-recovery-plan-382.md)。本轮只完成有实存储证据的根因调查，生产恢复问题尚未修复；没有UI自动化、UI改动、真实Provider请求或凭据复制。

使用正式 `packages/opencorvus/script/run-tests.ts` 和项目测试预载。实际 ReadTool 读取管理临时目录中的项目外文件，真实 withTaskToolInvocation/PermissionAuthority 持久化结果；Ask me 经 Asked/reply 批准这一个本轮文件读取。两种模式每例都实际执行1次，receipt中的输出和Source来自该ReadTool，不合成来源。

| Probe | 正确契约结果 | 实际证据 |
| --- | --- | --- |
| Source写入中断，Full access | fail | completed Tool、包含Source的成功receipt、Source为空，重试Open ToolPart not found；恢复返回0 |
| Source写入中断，Ask me | fail | 同样丢失Source；恢复返回1并退役请求，Source仍为空 |
| receipt之后/Tool完成之前，Full access | fail | 成功receipt保留，原Tool被恢复器写成error/process-execution-interrupted |
| receipt之后/Tool完成之前，Ask me | fail | 相同错误终态；后续权限恢复把请求作为已有Tool错误退役 |

Source probe 原313e55 exit1（0pass/2fail/4断言），receipt-cut 原79409 exit1（0pass/2fail/4断言）。`source-commit-probe.test.ts.gz` 与 `receipt-cut-probe.test.ts.gz` 保存执行源；完整日志保留。第一轮模块解析失败只是探针位置不在workspace package，改用准确相对源码导入后原验收已重跑，原始工具故障日志单独保留。

四份 `*-stages.json.gz` 保存每个边界的实际 Message、Part、Permission ledger、receipt、工具调用次数和恢复返回值；不是只记录最后错误。Source写入错误来自绑定当前Session和source-file的明确故障注入。receipt-cut没有写入故障注入，只把实际成功结果尚未传给processor的持久状态交给生产恢复函数。本轮没有声称操作系统进程崩溃、完整权限重启或视觉验收。

Task-root/dispatch/Mission/Session生产调用已横向检索；Task/Mission实际运行与旧activation围栏、并行恢复和真正进程重启仍待后续验收。不能仅把Tool+Source包进事务：当前普通恢复会将仍有成功receipt的running Tool记成error，事务修改必须与这个共同根因一并修复。没有添加第二套Source事实或重执行流程。

唯一代码改动是381正向测试显式传入其真实toolInput；原运行时已有相同规范输入。原29306正式runner exit0，7测试15断言通过；docs:check 345ops/25groups、architecture-index 18文档通过。生产代码尚未修改。下轮依据这些失败事实继续实施。
