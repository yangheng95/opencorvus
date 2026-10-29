# L04 最终 D 修复：独立局部资格复核

认可本次微型迁移/恢复合同的修复与可达性；未发现该范围的新实质阻断。**不批准重型 L04 冻结，不证明数小时有效工作，不形成候选系统分数或成熟 benchmark 认证。**

## 独立实际执行

2026-10-29，使用 `C:/Python314/python.exe`。只复制主方 `run-d-storage-identity-final/executed-source/` 四份执行源码与已冻结 `inputs/v1/` 三份原始输入，未复制任何主方生成结果、升级后数据库或参考预期结果。公开原库/authority/provenance、公开 legacy_writer/shared helper 与本次快照直接逐字节身份一致，仅用于来源定位，不作为功能验收。

实际命令完整保存在 `commands/full-cold-replay.json`：

```text
C:/Python314/python.exe -B D:/opencorvus-benchmark-runs/l04-migration-independent-review-20261029/repair-review/source-snapshot/qualify_migration.py --input D:/opencorvus-benchmark-runs/l04-migration-independent-review-20261029/repair-review/frozen-input --output D:/opencorvus-benchmark-runs/l04-migration-independent-review-20261029/repair-review/cold-run
```

退出 0，核心 **11.091258800122887 秒**，整个 Python 调用 **11.247920100111514 秒**；6 个场景、53 个真实子进程、245 项 harness 核对通过。耗时仅是本机本次资格运行事实，不用于性能/成本排名。

六个场景是正常、真实 before_commit 进程中断、真实 after_commit 响应前中断、旧 token 跨切换、无法识别的旧 NULL 收据身份中止、无法识别的旧空 entry 身份中止。

## 超出作者自检的独立证据

执行 `../repair_independent_audit.py`，未导入私有 reference 的转换函数或作者期望表；只复用自己此前的纯 SQL/进程记录审读函数，并显式选择本次新目录。

- 从冻结原库与 authority 独立构造逐 entry 客户、币种、整数金额、退款父关系和 fee；4 个成功迁移场景共 **112 项 SQL 核对通过**。每库 7 条有效 entry、6 条隔离、2 个权威客户、3 条合法别名、12 个 audit、2 条 ACK 收据；完整 raw、原迁移史、原 event ID/payload 和完整 ACK 请求/响应保存。金额不是只比合计。
- 额外 **27 项修复核对通过**。其中 6 次真实 CLI 直接重放历史失败探针的原请求文件：v1/v2 各“首次 / 同请求重发 / 同 NULL key 换 entry”。全部返回 `{"status":"invalid_request","field":"op_key"}`；两份探针数据库全部 schema/表行均保持。旧版 6 次真实失败原件没有重写。
- 对两个中止场景，用冻结原库在独立内存数据库加入同一明确脏身份，再逐项比较 `sqlite_master` 和每个表的全部行；真实冷跑的中止结果完整相同，version1/epoch3，明确返回 `unresolved_receipt_identity` / `unresolved_entry_identity`。这证明当前两类构造的整体保存，不泛化为任意脏库都已覆盖。
- 在自己的新数据库副本直接执行 **8 条 SQLite 正向错误合同**：receipt/customer/entry 的 NULL 或空白身份，quarantine 两个组合身份的 NULL。返回预定 NOTNULL/CHECK 错误；每个事务 rollback，副本全表保持。
- 独立审读 53 条本次子进程记录。真实 before_commit PID 69636 时，另一连接看到 version1/epoch3、事务打开；真实 after_commit PID 95832 时看到 version2/epoch4、事务关闭。仅终止这两个原始 Popen 句柄，恢复后逐身份 SQL 仍通过。另一 held transaction 被 stdin 释放，旧写者实际返回 `stale_epoch/current_epoch4`。

原始观察、响应、命令、数据库和所有细项位于 `cold-run/`、`independent-sql-audit.json`、`independent-process-audit.json`、`repaired-null-probe.json`、`independent-abort-audit.json`、`independent-storage-audit.json`、`independent-repair-checks.json`。

## 根因修复的审读结论

`l04_request.py` 是当前 v1/v2 共同的请求完整性事实来源；非空字符串身份及各 schema 的明确字段类型在数据库写入前检查，NULL/空白 key 不再进入收据查询。没有用单入口补丁掩盖共享问题。

`reference_api.py` 的 upgrade 用 BEGIN IMMEDIATE 和逐条 execute，源收据/entry 身份在改表前检查；合法收据复制、旧表替换、目标数据/约束、历史 version2 和 epoch3→4 在同一事务内完成。receipts/entries/customers 显式 NOT NULL 和非空约束；原 v1 输入及已存在迁移史没有被改写。迁移加载不会制造第二轮旧业务 audit，新 v2 写入产生一次 source_schema2 audit。两入口 epoch 检查位于取得写事务后。

## 保留的边界

`write_attempt` 事件在 BEGIN 前打印。独立证据证明进程进入该调用位置、跨切换后被 epoch 栅栏拒绝；没有独立观察 SQLite 内部 busy 队列，不称内核排队已证实。真实故障仅是本地 DELETE journal / synchronous FULL 下的进程中断，不证明断电、网络文件系统、WAL、任意调度或零停机。

这是合成微型建设性参考及局部协议资格，没有真实受测 LLM、专业专家校准、完整运维决策、正式长题 rubric 或小时级候选执行。未调用 Provider、GPU、solver、UI、用户服务，也未恢复六个暂停容器；未再次委托。主仓只读，所有本次写入都在本独立审查外部目录。仍需主方另行建设和校准完整 L04，不能把 245 或 112/27 项局部检查计数当题目难度。
