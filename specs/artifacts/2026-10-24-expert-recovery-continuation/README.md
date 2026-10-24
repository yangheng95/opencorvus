# 专家团恢复与新操作接续复跑

对应[方案、根因及裁定](../../records/2026-10/2026-10-24-expert-recovery-continuation-audit.md)。本目录仅交付自有隔离后端探针和安全汇总，不含原SQLite、用户原文、凭据或完整私有日志。
最终有界结果见[安全汇总](evidence.json)；独立agent已逐原件裁定机制通过，提交推送另按实际Git记录结算。

从仓库根目录运行，先执行 `bun run --cwd packages/opencorvus prepare:test-runtime`。每次指定全新证据目录；探针只管理自己的隔离进程和工作副本，保留原数据库/文件树，不操作现用服务、模型、凭据或外部发布。正式Manager、真实授权Message、唯一Artifact writer和正式Database.Client进入各自验收边界；不把局部Task夹具称模型或Campaign全链验收。

## 备份与重复升级

```powershell
$env:EXPERT_CONTINUATION_OUTPUT = Join-Path (Get-Location) '.tmp-product-iteration/expert-continuation-same-fresh'
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-expert-recovery-continuation/backup-upgrade-probe.ts outer same-authority
```

`foreign-authority` 改为使用独立正式数据库的真实备份，原commit仍保存在原成功快照；两轮恢复DB和原journal，原unknown归档字节不变，后来显式安装版本保持。不得把原canonical从1倒退到0理解为历史没有提交。

`upgrade` 要求 `EXPERT_CONTINUATION_LEGACY_DB` 指向实际旧版7原件，不接受手改版本号伪造旧库。原件只读，复制到新隔离数据库后两轮恢复原7、双进程在均读到原7的barrier后进入正式opener，并复开；逐原表/原列/rowid及每份正式迁移backup比较。该case裁数据库升级边界，不重放原Task或搬运原绝对业务目录。
原7有正receipt时还可提供 `EXPERT_CONTINUATION_RECEIPT_ARTIFACT`，逐轮核迁移后canonical的原完整envelope、Task与创建时间；本轮同时验收缺receipt的72行及正receipt的75行真实原件。

## 真实故障与重试

以下均从根目录执行，默认每次创建新的workspace `.tmp-product-iteration/expert-recovery-continuation-audit/` 子目录；完整原件留在隔离runtime和私有证据目录。公开controller会进入真实checker，进程退出0须同时满足效果、原字节、回执及物理结算合同。

```powershell
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-expert-recovery-continuation/manager-continuation-probe.ts outer unknown
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-expert-recovery-continuation/manager-continuation-probe.ts outer committed
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-expert-recovery-continuation/publication-continuation-probe.ts outer pending
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-expert-recovery-continuation/feedback-retry-probe.ts outer
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-expert-recovery-continuation/receipt-reappears-probe.ts outer
bun --tsconfig-override=packages/opencorvus/tsconfig.json specs/artifacts/2026-10-24-expert-recovery-continuation/known-archive-db-rollback-probe.ts outer
```

publication探针另支持 `terminal`、`backup`；`target` 需 `PUBLICATION_CURRENT_TARGET_BACKUP` 指向前案正式Manager产生的真实v3完整target备份，验证copy原2后恢复新3，原plan及2/3分别保留。其controller自动调用同目录 `publication-evidence-check.ts`，不是只看子进程0。故障注入的23/24为明确预期硬退出，后继必须实际0并结算。

`feedback-retry-probe.ts` 用正式Core反馈生成candidate、真实用户Message授权和正式execute，原授权在after状态给明确CAS冲突，显式before后同授权完成，再重试同receipt，归档不变；no-op ingress只抑制模型dispatch，不替换Manager或writer。`receipt-reappears`验证DB1→真实DB0→保全target硬退出24→恢复DB1，before先归档再成功清理。`known-archive-db-rollback`验证当前缺receipt时返回unknown、原known归档不改，不将返回值缺陷夸称安装伪成功。

`legacy-pending-recover.ts` 需 `PUBLICATION_LEGACY_PENDING_SOURCE` 指向旧故障生成的自有隔离case；可用 `PUBLICATION_LEGACY_PENDING_MASTER` 指定该case的只读原物理master。所有移动均验证在原managed owner之内，master原字节不变，恢复working保原绝对journal路径；不用于现用数据维护。

`recovery-http-probe.ts` 需 `EXPERT_RECOVERY_HTTP_SOURCE` 指向一个含 `original/result.json` 的上述隔离case；默认期待known archive，可用 `EXPERT_RECOVERY_HTTP_DISPOSITION=commit_receipt_unavailable` 读取unknown。新合法Project通过正式Server.App.request核summary、4096字节分页、完整原journal、404/400及越尾空页，Provider为0。它证明HTTP后端合同，不是UI验收。

## 入口与接续合同

聚焦后端回归：

```powershell
cd packages/opencorvus
bun run test test/expert-squad-recovery-continuation.test.ts test/expert-squad-evolution-mutation.test.ts test/expert-squad-manager-cas.test.ts test/expert-squad-mutation-receipt.test.ts
```

未知保全协议@2保留旧intent、阶段及complete字节，通过追加upgrade/resource-plan自动接续旧pending。资源计划先持久，再copy/rename；expected观察树不可得时明确标记，当前字节保存在distinct observed资源。旧complete @1只表示当时观察，不能泛称历史mutation after完整。

实际历史成功只由长期canonical receipt证明。`committed_revision_changed` 记录历史commit存在而当前包观察不同；不回滚后来版本。`commit_receipt_unavailable` 仍为历史结果未知；保全terminal只裁本次证据保全。新操作先在同一安装owner收敛旧journal，再执行真实CAS和文件效果。

前轮公开[保全故障探针](../2026-10-24-expert-mutation-receipt-recovery/README.md)的target/backup切点现按真实retained阶段名称定位，避免新增版本化plan改变序号后误切另一阶段。历史原日志仍保持原版本。
