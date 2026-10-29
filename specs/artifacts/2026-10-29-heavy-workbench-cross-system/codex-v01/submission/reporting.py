"""Original incident narrative and executable runbook built from measured run facts."""

import sqlite3
from pathlib import Path


def build_reports(output, summary):
    tenants = summary["correct_totals"]
    legacy = summary["legacy"]
    audit = summary["audit"]
    total = sum(tenants.values())
    lost = total - sum(legacy["first"].values())
    impact = "\n".join(
        f"| {t} | 240 | {legacy['first'][t]:,} | {v:,} | +{v-legacy['first'][t]:,} | {legacy['restart_once'][t]:,} | {legacy['restart_twice'][t]:,} | {legacy['restart_twice'][t]-v:+,} |"
        for t, v in tenants.items())
    with sqlite3.connect(output / "verification/databases/ledger.sqlite") as db:
        process_range = db.execute("SELECT MIN(first_processed_at),MAX(first_processed_at) FROM ledger").fetchone()
    incident = f"""# H05 虚构支付汇总事故报告

本次离线修复把三租户的账本恢复为每租户 240 个业务事件、52,680 个整数最小货币单位，合计 **720 个身份、158,040 单位**。原始样例服务首次处理漏记 **{lost:,} 单位（正确金额的 66.67%）**；同一进程重放看似稳定，但真实重启后重新入账。所有金额均为题目给定的最小货币单位；币种、结算状态、实际客户资金损失未知，不能把本次账面差额说成外部支付损失。

这是原创模拟数据的本地事故复现。报告中的“旧金额”是对原始代码和所给档案运行的实测结果，原生产系统当时运行几次、何时发现、是否发出款项均未知。执行日期以工具记录为准，证据目录为 [verification](verification/README.md)。外部双人独立审查尚待进行，本执行者没有代签，也没有宣称具备最终双评合格资格。

## 业务影响与修复口径

| 租户 | 正确身份数 | 旧首次金额 | 修复金额 | 首次修复调整 | 旧重启重放一次 | 旧重启重放两次 | 两次重启对正确值偏差 |
|---|---:|---:|---:|---:|---:|---:|---:|
{impact}
| 合计 | 720 | {sum(legacy['first'].values()):,} | {total:,} | +{lost:,} | {sum(legacy['restart_once'].values()):,} | {sum(legacy['restart_twice'].values()):,} | 0 |

表格最后一列说明，旧服务三次会话后总额恰好为 158,040，租户仍分别多 11,022、少 5,415、少 5,607。仅核对总金额会错过这种跨租户抵消。依据是 [impact.csv](verification/impact.csv)、[旧服务观测](verification/legacy/observations.json) 和实际 SQLite（本地事务数据库）库；未将推算当作真实生产历史。

原始档案有 {audit['records']} 次传输、{audit['business_identities']} 个联合身份、{audit['extra_transmissions']} 次额外传输，重复身份共 103 个，每个尝试两次。alpha/beta/gamma 分别收到 275/274/274 次，正确身份各 240。重复传输并不是 103 个新业务收入；同一 event_id 在不同租户则是独立业务收入。

根目录 [ledger.csv](ledger.csv)、[duplicates.csv](duplicates.csv)、[totals.csv](totals.csv) 从修复服务的第一遍持久数据库直接导出。duplicates 的 attempts 只统计原始档案一次，103 行均为 2；后续演练流量放在独立数据库中，避免污染业务报告口径。[replay.csv](replay.csv) 两行是第一遍和另一个进程对同一持久事实副本作第二遍全量重放，均为 720 / 158040。diagnostics 四表使用相同列合同，仅是中间可审计表。

## 时间线与证据含义

| 时间或顺序 | 证据与实际含义 | 已知边界 |
|---|---|---|
| {audit['received_at_min']} 至 {audit['received_at_max']} | 原始 records.csv 的 received_at 最小/最大；逐行见 [source-timeline.csv](verification/source-timeline.csv) | 字段是收到时间，不能冒充业务发生时间或服务处理时间 |
| CSV 第 2 行 gamma/E0132，02:12；第 3 行 beta/E0028，00:28 | 原始文件相邻顺序已回退；全档案相邻回退 {audit['adjacent_received_at_regressions']} 次 | 文件顺序是本次首次重放的处理顺序，真实生产到达序列未知 |
| CSV 第 3、15、301、759 行 | beta/E0028、alpha/E0028、gamma/E0028、alpha/E0028；金额均 128 | 第 15/301 行是别的租户业务，759 是 alpha 的重传 |
| context.json clock=2026-10-29T00:00:00+08:00 | 输入作者给出的模拟资料时钟 | 不是可核实的事故发现、恢复或上线时间 |
| {summary['started_at']} 至 {summary['finished_at']} | 本次隔离复现运行，命令 UTC（Coordinated Universal Time，协调世界时）起止在 commands.json | 本地演练时间，不是旧生产时间 |
| {process_range[0]} 至 {process_range[1]} | 修复后第一遍账本的首次处理时间；由服务在事务中记录 | 包括运行时开销，不等于 received_at |

旧生产检测、处置、负责人到场、部署、资金动作和每一业务发生时间均没有来源，记为未知。命令 [commands.json](verification/commands.json) 记录真实 PID（Process Identifier，进程标识）、argv、工作目录、退出码与原始输出路径；阶段因果按进程执行先后成立，不能由文件时间戳推测原事故事实。

## 根因与为什么旧重放没有根治

1. **错误的业务身份使租户相互抢占。** `inputs/legacy_service.py:17-19` 只查并加入 `event_id`，没有 tenant。beta/E0028 在 CSV 第 3 行先到，全局 seen 因此压制第 15 行 alpha 和第 301 行 gamma 的两个合法事件；同一进程只给 beta 加 128。合法 alpha 第 759 行重传也继续受压制。每租户应有 E0000 至 E0239，共 720 个联合身份，旧集合只有 240 个全局字符串。输入行号在 input-audit.json 可核查，按原顺序的丢弃归因在 legacy/legacy-omission-attribution.json；这是代码归因与实测 totals 交叉验证，旧库本身没有身份账本。
2. **持久金额与易失去重没有共同事务。** 旧构造函数第 14 行清空 seen，第 22 行向持久 totals 加金额。SQLite 的 with db 事务只覆盖那次金额变动。原始代码真实执行首次合计 52,680、同进程重放仍 52,680、关闭重开后合计 105,360、再关闭重开合计 158,040。重启丢失去重事实，而金额保留。同进程成功重放不能证明恢复安全。
3. **失败窗口与并发共享根因。** 旧第 19 行在数据库提交前标记 seen。隔离库用 SQLite trigger 产生真实 `injected-write-failure`，随后移除触发器、在同进程重投同事件，实测 seen 有 E0132，金额表仍为空。另四个独立进程共同重投 gamma/E0132，各自持有集合，实测入账 4×232=928，正确为 232。代码预期已被演练证实；原生产是否发生过同类数据库异常或并发重投仍未知。

按 received_at 排序只能改变谁先占全局 event_id；只给内存 seen 加 tenant 仍经不起重启；只给金额写入加事务仍不能持久化 seen。故修复必须落在共同数据路径，而不是给导入/重放各写一份纠偏逻辑。

## 共同实现与完整性

[service.py](service.py) v1.0.0、数据库 schema（结构）v1 以 `(tenant,event_id)` 为复合主键。原样保留 E0000 等字符串身份，amount 以整数存储。每个 ingest 都先 BEGIN IMMEDIATE 获取同一数据库写锁，读取既有金额，再插入新身份或增加已有身份 attempts，最后 COMMIT；金额冲突返回 AMOUNT_CONFLICT，输入非法返回 INVALID_EVENT，存储失败回滚后可重试。每条事件单独提交，导入中途失败不会撤销已确认事件；恢复重放通过持久身份收敛。

唯一金额事实是 ledger.amount，totals 是对该表 SUM 的数据库视图，没有平行累计表。一次插入同时发布身份与金额，回滚同时撤销；视图和账本共享提交边界。导出和监测用一致读取事务，防止并发写入时读到跨时点数据。SQLite 显式设置 synchronous=FULL、journal_mode=DELETE，实际配置在每次 snapshot.storage 中记录，演练状态保存在 databases/。这证明本机进程崩溃与竞争下的结果，不代替真实断电或远程文件系统认证。

旧库只有总额，不能在原表上推导所有身份。版本化 migrate 命令先用 SQLite backup API（Application Programming Interface，应用程序接口）保留原库，再从完整原始事件新建 v1 库，逐身份与逐租户核对并输出新旧调整。演练将旧首次库全部 schema/数据 SQL（Structured Query Language，结构化查询语言）导出与备份逐句比较，完整保留原用户数据。没有删除原库、清库或将旧金额加到新金额。缺少事件档案时 MIGRATION_REQUIRED 应阻断重建并升级人工调查，不猜测金额。

## 共享入口审计与实测

| 入口/终态 | 实现与真实结果 | 证据 |
|---|---|---|
| 直接 ingest / import / replay | 同一 Service.ingest；第一遍 823 尝试得 720 身份，第二进程全量重放新增 0、duplicate 823 | fixed-pass1 / fixed-pass2-new-process 的原始输出；unit-contracts |
| 正常 close 后重启 | 前 411 条单独进程退出，后 412 条另进程继续，最终 720 / 158040，逐身份 attempts 等于档案次数 | restart-before / restart-after；checks.json |
| 提交前非正常退出 | 真实 worker 在 COMMIT 执行前退出 73；重开看到 0 身份/0 金额，重放恢复完整 | crash-before.json、crash-before-reopen、crash-before-recovered |
| 提交后确认丢失 | 完成 ingest 后退出 74，外部调用没有成功响应；重开有 1 身份/232，重投后完整账本且该身份尝试多一次 | crash-after.json、crash-after-reopen、crash-after-recovered |
| 并发竞争 | 四个已到 barrier 的独立进程各重放全部 823 条；3292 尝试，金额仍 158040、身份720，逐身份 attempts 为原次数×4 | barriers/fixed-concurrency、fixed-concurrency-0..3、four-process-race-full-state |
| 顺序改变 | 完全反序、按 received_at 排序分别建新库，逐身份金额与 attempts 完全一致 | reversed-state、received-order-state |
| 多租户/多数据库 | 240 个相同 event_id 在三租户独立存在；各种演练分别使用独立库，新增双库同身份不同金额正向契约 | joint identity / database isolation 单元契约、多个库逐项核对 |
| 历史升级 | v0首次金额备份后重建v1，720 / 158040；原库全部 schema/数据保留 | migration.json、legacy-archive-preserves-schema-and-all-data |
| 切换与回滚终态 | 暂停后快照前缀，客户端实际指向 candidate 接收后缀；恢复旧快照并重放后缀后再切换，均为同一720/158040事实 | rollout/observations.json、post-switch-facts、rollback-caught-up-facts |
| 告警 | 重复率告警、缺失账本 critical、完整单次业务 healthy 都通过真实 monitor CLI（Command Line Interface，命令行接口） | monitoring.json、退出2/2/0及原始输出 |

此样例没有网络服务、后台队列、调度器、Task/Mission/Session occurrence 或外部资金提交入口。不存在可审计的其他生产入口；没有将局部通过外推到这些未知系统。全部可用入口、重启/重试/异常终态/并发与租户隔离均在共享 ingest 上收敛。非界面测试 {summary['checks_passed']} 条集成核对及单元契约，真实子命令 {summary['commands_executed']} 次；详细结果以 checks.json 和命令退出码为准。

## 监测、责任动作与残余风险

[monitor-policy.json](monitor-policy.json) 为唯一操作告警配置：每租户 lifetime 重复率 `(SUM(attempts)-COUNT(identity))/SUM(attempts)` 大于 10% 为 warning；对同一档案时间范围核对总金额绝对差额>0、缺失+额外身份>0 或金额冲突>0 为 critical。monitor 有告警退出 2，健康退出 0，输入/存储错误退出 1。每批 replay 另输出 batch_duplicate_rate，计划重放应标记维护批次，避免把预期100%去重误判新故障；不能停用账本对账。

原始流量 lifetime 重复率为 {audit['extra_transmissions']/audit['records']:.6%}，三个租户都实际触发 warning，账本差额为零。缺失前缀库对完整档案触发 critical；完整唯一事件库触发 healthy。对账除合计还比较 identity，单元契约验证金额抵消时仍识别一缺一多。此工具只输出可执行告警，没有冒充已接入企业通知服务。

| 责任角色 | 必须完成的动作 | 验收凭据/时点 |
|---|---|---|
| 服务维护人 | 上线共同 ingest 和 v1 schema，保留审核过的构建，禁止回滚到缺陷 v0 | 发布前复跑本题真实路径，记录代码版本/命令 |
| 财务/业务对账负责人 | 核对三租户52,680及逐身份账本，确认档案范围、币种与外部结算口径 | 切换前签认账本差异和修复调整；当前无人签字 |
| 值班运维 | 暂停入口、SQLite备份、切换、重复率与对账告警，恢复后先追平再启用 | runbook步骤、快照完整性、active-client状态 |
| 两名独立审查者 | 各自清洁复跑、审读业务差额与风险，记录独立结论和问题 | 本次之后；当前待审，执行者不得代签 |

未验证：真实外部资金、网络/用户鉴权、磁盘断电、跨主机锁、长期负载、档案范围外的丢失消息、SQLite 64位聚合极限。当前负载只验证 823 条档案及四进程 3292 条竞争。档案本身的完整性没有外部事实可证明，恢复是相对所给输入正确；真实上线必须由业务负责人补齐外部交易对账。SQLite 单写者串行可能限制真实吞吐，超时应作为可重试存储错误处理；不得用内存去重降级绕过持久路径。

## 方法来源与可复现性

只使用输入随包 source-notes.md 提供的 SQLite, Atomic Commit，<https://sqlite.org/atomiccommit.html> 的有限方法事实：事务原子性与持久性是恢复设计依据，应在目标环境演练。没有联网，没有编造页码、论文结果或引用它作为本业务验证。其他来源笔记主题不相关，未用于推导结论。

从未经改写的 inputs 运行 `python reproduce.py --inputs INPUT --output NEW_OUTPUT`，会实际加载原始 legacy_service.py，重新制造旧错误，再启动修复服务和所有验证过程，生成业务四表、诊断四表、库、原始日志和本报告；不读取过去的业务结果或任何评分类文件。输出目录必须不存在。外部复跑与双评状态不得以执行者生成的文件存在替代。
"""
    (output / "incident.md").write_text(incident, encoding="utf8")
    runbook = r"""# H05 本地上线与恢复手册

适用范围：所给虚构 CSV 支付汇总服务、本地 SQLite、固定代码 service.py v1.0.0 / schema v1。以下 `$Root` 设为当前交付目录，`$Inputs` 设为原始输入目录，`$Work` 设为新建演练目录。命令在 PowerShell 运行；所有路径由操作人明确选择。没有真实资金动作、外部发布或用户应用操作。本手册不是企业生产上线已完成的声明。

## 1. 切换前准备

服务维护人确认原始事件范围完整，业务负责人核对币种、原始档案范围及三租户差异。当前样例每租户240身份/52680单位，总720/158040；金额最小单位，不自行除以100。外部财务签字当前未知且未完成。运维保留只读原始档案和旧库，验证备份、文件磁盘空间、系统 Python/SQLite版本；此样例未验证网络盘，不将数据库置于网络共享。

```powershell
$Root = (Get-Location).Path
$Inputs = Join-Path $Root 'inputs'
$Work = Join-Path $Root 'operator-drill-new'
python (Join-Path $Root 'reproduce.py') --inputs $Inputs --output $Work
if ($LASTEXITCODE -ne 0) { throw '停止：复现或核对失败，查看最后命令输出' }
Get-Content (Join-Path $Work 'verification/summary.json')
Get-Content (Join-Path $Work 'verification/checks.json')
```

输出目录应不存在；切勿通过清空旧库来解决错误。复跑必须从原始 CSV 开始，检查逐身份/金额/尝试次数，人工阅读 incident.md 与三租户 totals.csv；验证不能只看文件存在或总金额。完整复跑包含已知的告警2与故障73/74，reproduce 只有全部符合预期才退出0。

## 2. 自动历史重建（v0 -> v1）

暂停全部导入/重放生产入口并等待已发请求结束；记录最后确认的档案游标和提交点，保持暂停期间新增消息在可靠档案中。暂停应由真正拥有该入口的运维完成，本演练只使用自己的子进程。旧库持久 totals 无法恢复业务身份，必须从完整档案重建；不得把 totals 直接迁移为 ledger，也不得把旧总额叠加到新账。

```powershell
$Legacy = Join-Path $Work 'verification/legacy/legacy-first.sqlite'
$NewDb = Join-Path $Work 'operator-migrated.sqlite'
$Archive = Join-Path $Work 'operator-legacy-archive.sqlite'
python (Join-Path $Root 'service.py') migrate --legacy-database $Legacy --events (Join-Path $Inputs 'records.csv') --database $NewDb --archive $Archive
if ($LASTEXITCODE -ne 0) { throw '停止：迁移失败，保留原库、备份和失败候选供调查' }
python (Join-Path $Root 'service.py') export --database $NewDb --output (Join-Path $Work 'operator-export')
python (Join-Path $Root 'service.py') monitor --database $NewDb --expected (Join-Path $Inputs 'records.csv') --policy (Join-Path $Root 'monitor-policy.json')
```

候选与备份必须是新路径；已存在返回 DESTINATION_EXISTS。旧格式库直接传给 replay 会返回 MIGRATION_REQUIRED。migrate 备份 schema 与全部数据后新建 v1 并重建，源库不会被清空；失败候选不能启用。migrate stdout 有旧金额、新金额和调整，交业务负责人签认。样例正常重复率>10%所以 monitor 预期退出2/warning，逐租户 reconciliation 的 missing/extra/amount_conflicts/amount_delta 都应为0。critical、输入/存储错误或任何身份差异必须停止切换。

## 3. 备份、切换与可执行客户端验证

仍暂停写入时用 SQLite backup，而不是复制可能正被写入的数据库文件。备份命令会运行 integrity_check。保留已核对的 v1 库及当前可执行代码，再指向新库。

```powershell
$Safe = Join-Path $Work 'operator-pre-switch.sqlite'
python (Join-Path $Root 'service.py') backup --source $NewDb --destination $Safe
if ($LASTEXITCODE -ne 0) { throw '停止：备份失败' }
$Pointer = Join-Path $Work 'operator-active.json'
$NextPointer = Join-Path $Work 'operator-active.new'
@{ database=$NewDb; service_version='1.0.0'; generation='candidate' } | ConvertTo-Json | Set-Content -LiteralPath $NextPointer -Encoding utf8
python -c 'import os,sys; os.replace(sys.argv[1], sys.argv[2])' $NextPointer $Pointer
python (Join-Path $Root 'exercise_worker.py') active-client --pointer $Pointer
```

样例客户端每次启动只读取一个 active.json 并连接其 database，切换使用同目录替换，不能同时向两个库写。确认720/158040且三租户一致后才恢复写入口。演练没有真实服务路由，因此本地指针替换不能冒充完成生产部署；真实入口配置还须由其维护人实施。reproduce 中更强的步骤是先以411条前缀建库，快照切换后真实接收412条后缀，再恢复追平，证明切换后的新身份也被保留。

## 4. 回滚与恢复（保留切换后业务）

停止入口、等待当前事务结束，记录切换后已确认与待重投档案边界。只恢复已核验的 v1 快照，保留当前库供审计，不能恢复缺陷v0代码。回滚到快照而不追平会漏记切换后业务，禁止直接启用未追平快照。以下 `$Tail` 必须覆盖快照以后所有事件；重叠安全，缺失不安全。样例可用完整档案重放，得到相同业务身份和金额；attempts 因重放增加符合定义。

```powershell
$Recovered = Join-Path $Work 'operator-recovered.sqlite'
$Tail = Join-Path $Inputs 'records.csv'
python (Join-Path $Root 'service.py') restore --source $Safe --destination $Recovered
if ($LASTEXITCODE -ne 0) { throw '停止：恢复失败' }
python (Join-Path $Root 'service.py') replay --database $Recovered --events $Tail
if ($LASTEXITCODE -ne 0) { throw '停止：追平失败' }
python (Join-Path $Root 'service.py') monitor --database $Recovered --expected (Join-Path $Inputs 'records.csv') --policy (Join-Path $Root 'monitor-policy.json')
```

检查 monitor 输出每租户金额/身份差异为0，再用第3节相同指针替换动作将 database 改为 `$Recovered`，启动 active-client 验证后恢复入口。账本对账为critical时保留暂停、保留所有库和原始档案，由服务维护人与业务负责人调查；不得靠修改CSV总计、删租户或跳过异常事件达成验收。本次演练恢复点为完成备份时的已提交事务；重放完整档案后相对该档案已确认业务丢失量为0，不承诺未经测试的生产恢复秒数或真实磁盘断电恢复点。

## 5. 重启、失败、并发处置

正常重启直接连接同一 v1 数据库继续 replay；进程恢复后以可靠档案重投未确认事件。每事件的 BEGIN IMMEDIATE/COMMIT 在一个连接内；新身份与金额共同提交，重复只增加 attempts。数据库锁超时/磁盘错误退出1，保留输入并重试，绝不能改走内存去重。AMOUNT_CONFLICT 表示同一业务身份金额不一致，保留原账、暂停该批、交业务核查；不得覆盖原金额。INVALID_EVENT 修正输入来源后从档案重投。导入不是整文件原子事务，失败前已提交的部分由联合身份保护。

reproduce 真实运行四个进程各823条竞争并验证720/158040、3292尝试；旧服务并发重复实测928而正确232。crash-before 退出73并恢复0/0，crash-after退出74并恢复1/232，再重放均收敛720/158040。不要在真实生产人为注入这些故障，exercise_worker 的崩溃注入只限本隔离演练。

## 6. 值班监测与停止阈值

```powershell
python (Join-Path $Root 'service.py') monitor --database $NewDb --expected (Join-Path $Inputs 'records.csv') --policy (Join-Path $Root 'monitor-policy.json')
$MonitorExit = $LASTEXITCODE
if ($MonitorExit -eq 1) { throw '停止：监测本身错误，查看原始stderr' }
# 退出2须读取JSON severity。critical停止入口，warning调查重投率。
```

唯一配置 monitor-policy.json：每租户 lifetime 重复率>0.10 warning；金额差额绝对值>0、缺失+额外身份>0、金额冲突>0 critical；SQLite完整性异常也critical。完整业务基线中alpha为35/275，beta/gamma为34/274，均触发warning。批次 replay 输出本批duplicate_rate，用于区分维护重放和新消息异常，计划维护登记起止/输入游标，仍核对业务差额。monitor 的 expected 档案必须与库覆盖同一时间范围；错配档案会产生错误告警判断。当前没有外部通知连接，值班系统可按退出码/JSON接入；不声称已发送任何通知。

## 7. 审核、交付与证据保留

本次的原始命令、退出码和真实输出在 verification/commands.json 与 commands/，所有逐身份核对在 checks.json，旧/新数据库与SQLite备份在 databases/。保留这套证据以及完整原始输入，不得以源码摘要或自算校验和替代行为验证。外部两名独立审查者应分别在新目录运行 reproduce，比较四业务表、逐身份检查真实库、审读事故影响、切换恢复和未知边界，各自写下真实结论；当前执行者的最终交付不包含他们的签名。
"""
    (output / "runbook.md").write_text(runbook, encoding="utf8")
