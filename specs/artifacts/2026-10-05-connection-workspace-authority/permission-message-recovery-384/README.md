# 384 权限续行共享恢复缺陷

[Recall 与调查方案](../permission-message-recovery-plan-384.md) · [月度记录](../../../records/2026-10/2026-10-13-permission-message-recovery-384.md)

本轮是根因调查，生产行为尚未修复。两个期望正确行为的后台合同均失败；[原始状态核验](failure-review.json)不会把坏行为当成验收通过。

| 真实输入与边界 | 实际持久化结果 | 正确行为未满足 |
| --- | --- | --- |
| 同Message两次真实Read及成功Permission receipt；第一Tool完成，第二Tool仍running | 第一续行先把Message写为tool-calls/completed，然后尝试启动合同模型；第二Tool仍running | 整条消息应等待其他已接受活动完成，或自然恢复其已有成功结果后再结束 |
| 真实子进程持有SessionPromptOwner，另一进程读取同一数据库并恢复 | OS观察exact_live，原owner仍保持；恢复者却写入Message completed，并在loop等待该活跃owner | 返回live，让真实所有者继续写自己的消息 |

首轮18798跨进程观察器缺少有限观察边界，120000ms超时后runner终止两个自有子进程；原失败日志保留。给inspect进程设5000ms观察上限并在输出当前事实后退出，34448重跑23.64秒完整结束，0通过/2失败。holder通过stdin释放并join；结束时只读进程清单已没有这些worker。没有重启用户服务、使用凭据或运行真实模型。

目录checks以gzip保存两轮完整日志、完整canonical before/after、三个原始probe源文件与归档/checker脚本。probe在当时真实test/session和test/fixture路径运行；归档后移出自动测试发现目录，恢复原路径即可继续修正同一正向合同。文档记录的目标没有改为期望坏行为。旧383两次推送完整输出也保留，证明正常hook通过、远端竞争后fresh merge及正常push。

根因与影响来自共享SessionLoop.resumePermissionContinuation三个收尾分支、本进程messageOwner守卫，以及Permission reply/项目首次准入调用图。并发reply、跨进程决定与owner释放的交接、Task/Mission/current-schema、完整Provider结果、park/handoff与模型续行上下文还须继续实现和验证。仅给单request加忙时跳过可能丢失已经批准的后续执行；不能以一个live判断或更宽终态许可作为修复。

尚未达到：两个新缺陷的生产修复，完整共享恢复边界，真实Provider/页面验收。383已有Sources完整事务修复保持，383刷新失败和381请求预算失败保持原结论。
