# H05 本地上线与恢复手册

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
