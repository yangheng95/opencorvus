# Expert Squad mutation 回执与保全验收

对应[审计、根因与方案](../../records/2026-10/2026-10-24-expert-global-receipt-lifetime-audit.md)。本目录只包含可复跑的自有隔离 backend 探针和安全汇总；不提交 SQLite 原库、用户原文、凭据或本地运行路径。所有原件与逐进程日志由独立 judge 直接读取，位置见方案。

当前交付 schema 是8。旧 v7 原红、旧正回执/缺回执原件和早期8日志只代表各自真实历史阶段；最终 fresh8及正式6→8、7→8验收另列，不改原版本号伪造升级。

从仓库根目录运行。使用项目已有 Bun 与依赖，不使用模型、Provider 凭据、外部发布或 UI 自动化。每案创建自有隔离 runtime，前态采用成熟 Task/Session fixture，真实可见用户 Message、授权 verifier、实际 Evidence Artifact locator、正式 Manager 操作与唯一 Artifact writer。它验证 Manager 的持久边界，不冒充完整模型作者、Campaign 或业务内容的端到端验收。

```powershell
$env:EXPERT_AUDIT_OUTPUT_DIRECTORY = Join-Path (Get-Location) '.tmp-product-iteration/expert-fresh-proof'
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-expert-mutation-receipt-recovery/expert-global-journal-probe.ts outer delete
```

同一探针支持 `EXPERT_AUDIT_SCOPE=global|project`、`EXPERT_AUDIT_OPERATION=promotion|restoration`。`outer tombstone` 进入正式 `EngineService.deleteTask`；普通 Task 删除是保留事实的 tombstone，不能冒称物理 Project cascade。`outer retain` 是保留来源对照。真实 receipt 提交后 `process.exit(23)`，新进程进入正式删除与恢复。当前包仍为实际 v2，原报告被 Project 物理删除时唯一长期 receipt 仍为1。

```powershell
$env:EXPERT_PRESERVATION_DIRECTORY = Join-Path (Get-Location) '.tmp-product-iteration/expert-preservation-proof'
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-expert-mutation-receipt-recovery/expert-preservation-probe.ts outer backup
```

每次运行须选择新的证据目录。模式 `intent`、`target`、`backup`、`terminal` 在成熟 DurablePublicationStore 的真实持久切点硬退出24，再由新进程恢复；`concurrent` 启动两个独立恢复进程。`early` 在原 target 已移至 backup、after 尚在 staging 时硬退出23：保全如实记录 installed target absent，不猜选版本；随后通过成熟 Manager 的一次显式新 import 从原 before 恢复可用包，归档仍完整。

`symlink` 验证用户在硬退出后给已安装目录添加相对链接这一磁盘漂变，归档保留原 `readlink` 字串和完整树。它不是合法可发布包；正式 Registry 拒绝 symlink 的入口合同已单独实跑。探针明确由 test driver 移除当前漂变链接，再执行新的正式 import，归档原链接不变。`backup-restore` 在真实 success receipt 已提交后，将自有 working DB 恢复到同 authority 的真实提交前备份，再进入冷恢复；缺失 receipt 仍是 unknown，不能因此声称历史未提交。

单独的 `expert-symlink-probe.ts` 以 `EXPERT_SYMLINK_PACKAGE_DIRECTORY` 指定自有合法包副本（也可用前案的原backup目录），验证实际相对链接身份及正式Registry拒绝合同；它不将拒绝结果当保全失败。

保全 terminal 的 `committed` 仅表示本次证据保全完成，其 `disposition=commit_receipt_unavailable` 明确原 mutation 成败未知。原 journal 完整字节、before、after/实际 staging 全部归档；原 current journal 在 terminal 持久后才退休。之后的新显式 mutation 不覆盖原证据。

`expert-legacy-upgrade-probe.ts <positive|deleted|before>` 只接受真实旧7运行产生的原件目录，通过 `EXPERT_LEGACY_SOURCE_DIRECTORY` 指定，输出可由 `EXPERT_LEGACY_OUTPUT_DIRECTORY` 指定。必须保留原 journal 的真实绝对安装路径及自有工作 runtime；不可修改版本号、重写旧事实或迁移原只读 master。本轮真实三案在正式 opener 后导出完整迁移阶段快照，并核全原表、行、rowid 与正式 backup。

`expert-recovery-http-probe.ts` 使用 `EXPERT_HTTP_SOURCE_DIRECTORY` 和 `EXPERT_HTTP_UPGRADE_DIRECTORY` 指向上述真实 deleted 案及其升级结果。它从一个新合法 Project 经真实 `Server.App.request` 读取 `GET /expert-squad/mutation-recovery`：列表、4096字节分页原 JSON、missing404、越尾空页200和非法偏移400。原源 Project 已删除，不借用旧执行 context。公开读取每页有界；内部枚举成本为该精确 installation/package 的 O(history)，不扫描其他安装目录。

`evidence.json` 区分真实生命周期、迁移阶段、冷保全与局部 writer 合同。手工 mission/import_lineage 报告用例只证明唯一 writer 过滤，不声称完整跨 Task 的授权/运输链；原 Evolution imported-evidence 回归另走其正式 import API。没有证据支持“全系统从此再无问题”的无界声明。
