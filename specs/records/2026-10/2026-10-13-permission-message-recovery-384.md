# 384 权限续行的消息收尾与跨进程所有权

按 [Recall](../../artifacts/2026-10-05-connection-workspace-authority/permission-message-recovery-plan-384.md) 单 agent 继续383明确未覆盖的共享恢复边界，未修改生产行为。

实际ReadTool、Ask me授权、成功receipt和规范数据库确认：同Message第二个Tool还在running时，第一个completed Tool的续行已经将助手Message写为tool-calls/completed。随后ProviderModelNotFoundError来自未配置的合同模型，它发生在错误Message提交之后，不是根因。

第二项使用两个真实OS进程共享隔离数据库：holder通过SessionPromptState持有真实Prompt owner并绑定Message；inspect实际观察exact_live，却仍修改该Message的completed时间。随后原loop才检查物理peer并等待它。前置本进程messageOwner检查无法保护其他进程的真实owner。

修前两个正向合同0通过/2失败。初次peer观察器等待了被测试的活跃owner，120000ms测试超时后runner清理两个自有子进程；修复观察工具，在5000ms边界输出当前事实并退出，23.64秒重跑完整得到两项失败证据。没有真实Provider请求，没有UI改动或UI自动化。详见 [完整日志、原始probe与状态](../../artifacts/2026-10-05-connection-workspace-authority/permission-message-recovery-384/README.md)。

这是所有Permission生产入口共享的物理准入与Message收尾问题。Task/Mission专用恢复虽然具有死亡owner/activation证据，不能证明权限reply和首次项目准入路径安全。383结果事务只保证单个Tool及Sources完整，不决定整个Message结束或多个续行的交接。

下一实施必须一并覆盖：复用Prompt唯一物理owner；同Message全部真实Tool/Provider结果收尾；精确permission上下文结束后才启动下一模型轮；并行决定在owner释放前后的可靠交接；park/handoff、错误、重启、项目隔离及Task/Mission围栏。当前根因已复现，生产修复与完整验收仍未满足，不因两项样例收窄共享影响面。
