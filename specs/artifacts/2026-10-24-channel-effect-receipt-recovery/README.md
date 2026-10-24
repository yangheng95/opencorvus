# Channel effect/receipt 真实故障验收

对应方案：[Channel 入站效果与回执恢复](../../records/2026-10/2026-10-24-channel-effect-receipt-recovery.md)。本目录只保留可复跑探针和安全汇总，不提交数据库、用户原文、凭据或私有数据库路径。原始自有 runtime、旧 v6 输入和逐进程日志保存在方案所列本地 `.tmp-product-iteration` 目录，独立裁定直接读取原件。

从仓库根目录运行，使用已有 Bun 和项目依赖。无模型、Provider 凭据、外部消息或 UI 自动化。脚本 bootstrap 自有隔离 runtime，保留证据目录；回收前应保留所需升级原件。真实授权效果是正式 PermissionAuthority 执行的本地 callback，不声称实际网络抓取。

```powershell
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-channel-effect-receipt-recovery/channel-restart-v7-probe.ts outer question
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-channel-effect-receipt-recovery/channel-restart-v7-probe.ts outer permission
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-channel-effect-receipt-recovery/channel-concurrent-recovery-probe.ts outer question
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-channel-effect-receipt-recovery/channel-concurrent-recovery-probe.ts outer permission
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-channel-effect-receipt-recovery/channel-restart-v7-probe.ts outer activity
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-channel-effect-receipt-recovery/channel-concurrent-recovery-probe.ts outer activity
```

restart 探针在正式 Channel 效果返回、outcome 提交前 `process.exit(23)`，随后新进程同库恢复。concurrent 探针先同样硬退出，再启动3个独立进程恢复同一原请求，保留每个首次结果；仅明确 processing/SQLite busy 可在所有初始进程退出后以新进程重开，不把 busy 记为成功。checker 核原 accepted、domain facts、唯一真实 outcome 和完整恢复响应。

activity 使用成熟 primitive 准备直接 Task activity acknowledgement gate，再经正式 Channel→Task API 实际确认结果未知；它不注册 Question waiter。此处 effect1 是实际唯一 direct acknowledgement terminal，未生成或执行真正未知的 Provider 活动。硬退出与并发恢复均逐值保留该 direct outcome 原件；前态准备的证据限制与聚焦 Task fixture 相同。

旧升级必须传入真正旧源码生成的 report，其中 `databasePath` 指向原 v6 数据库。探针只读事务读取并 serialize 一致副本到新隔离 runtime，正式 Database opener 升级，逐原表/行/rowid 保留、原备份、重复重开和新请求继续工作。它不会将当前库伪装成 v6。

```powershell
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-channel-effect-receipt-recovery/channel-legacy-upgrade-probe.ts question <original-report.json>
```

mode 可为 settled、gap、question、permission。旧 effect/generation 没有证据时明确 NULL/unknown，原 accepted/outcome 保留；新输入仍可提交。本轮四个旧原件均在修复前实际 v6 运行生成，原状态和旧红例已有证据，不将单元夹具或手动修改版本号当升级。

`evidence.json` 的安全汇总仅报告已核原件和明确范围。聚焦 Control 持久消息投影测试不等于真实模型验收；Question 探针有意不配置 Task-root runner，后台 scanner 的明确 unavailable-runner 日志不作为后续模型完成证据。

`channel-stale-instance-probe.ts outer fixed` 使用两个真实进程：旧进程持有原 Instance，另一进程正式删除、同 ID 重建并接受当前来源；旧 context 随后 replay 当前来源、接受新来源。当前合同分别返回原 owner conflict 与明确 context conflict，新 context 正常提交。`outer red` 仅供保留的修复前代码重现原缺陷；不得把当前失败的 red 期望当产品回归。可使用 `CHANNEL_AUDIT_OUTPUT_DIRECTORY` 指定新的自有证据目录，避免覆盖前序原件。Event create 的独立旧 context 候选也在同一机制真实复现，后续运行代码和验收由 root 负责。

追加的 `automation-legacy-upgrade-probe.ts <before|deleted|recreated|resumed> <original.sqlite>` 读取独立 judge 的真正旧 v6 原件，正式升级和调用 `AutomationService.runDueNow`。探针保留迁移后、恢复前完整 `after-upgrade.sqlite`，报告区分 `migrationStage` 全原表/行/rowid 保留与 `recoveryStage` 原 Run/Fire/Message/Session 保留。当前正式恢复结算旧 generation NULL 为 owner_unresolved，并通过 PublicationRead 遍历原无 delivery、三 phase 已完成的历史来源。四案真实升级及独立 raw 复核均已通过；详见 [升级记录](../../records/2026-10/2026-10-24-legacy-automation-upgrade-acceptance.md)。

最终交付 schema 已追加到8。两个 legacy upgrade 探针当前预期为正式6→8，Channel四案和Automation四案均已重新执行并保留 opener 后完整快照，由独立 judge 再次 raw 复核。旧 `v7` 探针文件名与原日志目录保留真实身份，代表最初版本7阶段；它们不是另一套运行实现，不把早期7结果当最终8证据。
