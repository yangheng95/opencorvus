# 持久投递故障注入复跑

[安全结果汇总](../2026-10-24-durable-effect-receipt-audit.json) 与 [主审计方案](../../records/2026-10/2026-10-24-durable-effect-receipt-audit.md) 说明原始证据和验收限制。探针仅创建自己的隔离 runtime，不打开应用现用数据库、不复制凭据、不使用真实模型、不执行外部发布；本地 Provider 使用流式协议返回确定文本，证明真实 Message、Tool、owner 与 receipt 恢复，不证明模型语义质量。

先确保依赖和项目原生测试 helper 已准备：`bun run --cwd packages/opencorvus prepare:test-runtime`。从根目录执行：

```powershell
# 三种scope分别在原Message提交后硬退出；120秒真实lease到期后继续原Message。
bun specs/artifacts/2026-10-24-durable-effect-receipt-audit/run-automation-owner-probe.ts alive-fresh project session global
# 同样原件，随后正式删除Project、重建，再从原Run恢复。
bun specs/artifacts/2026-10-24-durable-effect-receipt-audit/run-automation-owner-probe.ts deleted-fresh project session global
# Project已分配但Run尚未预留，实际exit23后两真实后继竞争。
bun specs/artifacts/2026-10-24-durable-effect-receipt-audit/run-allocation-owner-probe.ts
```

每次使用新前缀，避免覆盖前次原件。输出保留在忽略的 `.tmp-product-iteration/durable-effect-receipt-audit/automation/`；不把原SQLite、配置、环境或完整原文提交。准备进程在指定生产切点退出23是预期故障，后继必须实际exit0并完成成熟Server物理结算。测试原生runner和故障脚本只管理自己启动的进程。

Bus、Event及规范回复边界的聚焦后端测试：

```powershell
cd packages/opencorvus
bun run test test/bus-publication-owner.test.ts test/bus-delivery-lease-race.test.ts test/scheduler-event-acceptance-replay.test.ts test/scheduler-event-directory.test.ts test/scheduler-event-restart.test.ts test/scheduler-reply-boundary.test.ts
```

旧升级用例必须使用旧源码真实生成且未被当前opener修改的原件；[Channel产物](../2026-10-24-channel-effect-receipt-recovery/README.md) 提供正式升级检查器。不能手改版本号伪装旧库。

新增Task-scoped、owner完整生命周期及失败运行器保全的真实后端回归：

```powershell
bun run test test/algorithm-batch-one.test.ts test/worktree-task-scoped-owner.test.ts test/worktree-readiness-recovery.test.ts test/test-runner-failure.test.ts test/test-runner-selected-files.test.ts
```

最终根因、撤回后重新裁定及原失败库未归档的准确边界见[独立裁定](../../records/2026-10/2026-10-24-durable-effect-receipt-verdict.md)。[Expert产物](../2026-10-24-expert-mutation-receipt-recovery/README.md) 提供正式Manager删除/升级/保全探针。
