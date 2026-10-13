# 持续目标重复恢复证据

方案与冻结预算见 [本轮记录](../../records/2026-10/2026-10-13-continuous-goal-repeated-recovery.md)。

- [主 agent 二次复核](parent-review.md)：共享机制审查、基线和最终复核。
- [合并后Mission进程回归](integrated-mission-driver.log)与[合并后Goal/Task合同](integrated-goal-control.log)：25项92断言通过。
- [独立谱系导出](capture-session-lineage.ts)与[持久化证据复核](review-evidence.mjs)：只读复核三次成功run的物理恢复、公共完成与用量归属。
- [Chat 进程基线](parent-chat-baseline.log)：受控 Provider 集成通过；不等同真实模型验收。

| run | 结果 | 真实请求 | goal tokens |
| --- | --- | --- | --- |
| [Task重复崩溃](task-repeated-run1/result.json) | 两次崩溃、第三正式进程完成 | 12 | 212967 |
| [Mission原失败](mission-repeated-run1/result.json) | 恢复整轮120s期限取消活跃流；保留失败 | 23 | 460083 |
| [Mission修后复测](mission-repeated-run2/result.json) | 两次崩溃、第三代恢复跨原期限后正常完成 | 24 | 365132 |
| [Mission子Task原额度](mission-child-run1/result.json) | Task及goal完成；请求上限阻断Mission收尾，保留失败 | 64 | 3349061 |
| [Mission子Task完整run2](mission-child-run2/result.json) | 同child/epoch恢复，完整Artifact读取与Mission accepted | 50 | 2110219（child1270875） |

- [恢复driver修后](recovery-driver-fixed.log)：10项19断言；[初跑夹具时序失败](recovery-driver-initial.log.gz)完整保留。
- [最终checker合同](checker-final.log)：6项9断言；[typecheck](typecheck-final.log)通过。
- [terminal owner合同](terminal-owner-pass.log)：3项18断言；[matcher初跑诊断](terminal-owner-matcher-diagnostic.log.gz)说明Bun对实际对象的原地修改，生产时间值正常。
- [附带streamed夹具首次失败](focused-with-streamed-failure.log.gz)：父级后续捕获共享domain结算竞争并修复，见parent-review；原失败保留。
- [归档脚本](archive-audits.py)只处理有已退出进程与凭据清理receipt的精确run。每run `audit-snapshots.jsonl.gz` 包含全部原始相对路径与完整JSON，`audit-archive.json`记录逐对象解压验证。原`*-audit`目录因自动删除审批拒绝保留在本地，提交应只选择压缩及关键证据文件。

所有真实run使用配对隔离配置的`openai/gpt-6.1-sol`，请求跨进程累计。硬中断且Provider尚未返回的用量未知；goal预算约束自动续跑准入，不能视为单个执行中请求的硬费用上限。关键crash/admission/facts/transcript/receipt/settlement保留独立文件；父级审查产物保持原样。

共173次真实请求，13个私有服务进程全部退出，五对凭据/模型副本清理、最终端口关闭。五run共9232份审计快照已经完整压缩。child正文8466字节、报告11308字节及完成关联2237字节均由真实读取和公共accepted outcome验证；独立agent与父级均完成人工正文复核。精确覆盖边界及重放命令见本轮记录，原失败结果不回写。
