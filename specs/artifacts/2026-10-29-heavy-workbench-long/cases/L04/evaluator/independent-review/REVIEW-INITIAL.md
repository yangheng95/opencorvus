# L04微型迁移资格：初始独立冷复核

2026-10-29。主仓与主方原件只读，只写本新外部目录。没有再次委托、Provider/GPU/求解器、UI或用户进程操作。故障中断仅由原harness对本轮自己启动并持有的Popen子进程句柄执行。

**冻结原输入的四场景可达见证真实通过；独立SQL和实际控制事件核对也通过。另实复现v1/v2共有的NULL op_key收据缺陷，尚不能把当前参考称为完整API契约通过。** 该缺陷不改写四个原正确场景事实；不冻结重型L04、不证明小时级。

## 执行和独立数据结果

本轮只复制run-b保存的三源`legacy_writer.py/reference_api.py/qualify_migration.py`及关闭连接的原始`v1.sqlite/authority/provenance`；没有带主方生成数据库/结果或seed脚本进执行路径。`public-input-identity.json`确认原输入与仓库public同源，writer源也一致；字节身份不是功能正确性门槛。

实际命令：

```text
C:/Python314/python.exe -B source-snapshot/qualify_migration.py --input frozen-input --output cold-run
```

命令实际使用的绝对路径、cwd、exit、stdout/stderr在`commands/full-cold-replay.json`。四个全新库分别做正常升级、before_commit中断、after_commit响应丢失、旧写者跨切换。harness内部10.4717247002秒，外部进程10.7841586997秒，exit0，43个真实子进程、217项原作者事实/具名错误核对通过；不与主方6.15秒作性能排名。

另用独立标准库脚本从原库与authority重建预期，未导入参考API或作者预期表。`independent-sql-audit.json`的112个核对均通过，包括：

- 每个entry的客户、币种、整数金额、退款父单和fee，四个库均精确相同。O1 USD1234、R1 USD−234且引用O1、O_ALIAS CNY250、O_BETA USD700、O_ZERO0、快照后ACK O2 CNY500、新N_FEE USD333/fee7。
- 同邮箱两个权威客户仍分别C-ALPHA/C-BETA；旧7/9合法同一客户别名、12归BETA，target展示事实取authority。别名和旧业务行raw_json完整保留。
- 未映射客户11和五条坏entry按六个稳定身份隔离，原因/完整原行相符，未用总数或总额抵消个别丢失。
- 完整旧迁移史保留，仅新增一次version2，epoch4；原10条audit event的event_id及payload原文本不变。O2仅新增source_schema1事件11，N_FEE仅新增source_schema2事件12，迁移本身没再制造业务audit。
- 两个稳定op_key收据的完整请求和原accepted ACK保留，冲突调用没有覆盖先前已确认事实；新进程读N_FEE fee7成立。
- SQLite integrity和实际外键一致性检查返回正常。

以上是数据/协议局部资格，不是职业交付质量或完整重型场景。

## 故障位置、原子性和进程归属

源码审读确认迁移从BEGIN IMMEDIATE开始，DDL逐条execute而非executescript；数据、目标约束、迁移历史及epoch同事务提交，audit trigger在搬运历史数据后创建。实际checkpoint带本进程PID及connection.in_transaction；外部连接看见的version/epoch是before时1/3、after时2/4，PID与本轮Popen对象相符。终止后重开数据库并重做upgrade/幂等重试、继续真实v2写，最终逐身份核对通过。

`independent-process-audit.json`核对了控制事件：两个中断只针对同一已握手子进程，强制退出非0；正常释放事务的子进程exit0。harness所有kill路径操作children列表或直接传入的Popen句柄，没有读取输入PID再杀进程或全局枚举。

跨切换旧进程确实启动、输出匹配PID的write_attempt，迁移提交后返回stale_epoch/current_epoch4，未生成额外entry/receipt/audit。**现有write_attempt位于BEGIN调用之前，没有独立SQLITE_BUSY/busy-handler握手，因此不能把这一观察夸大为已证明SQLite内部进入等待队列。** 旧写者代码确实在BEGIN内检查epoch；此实现和跨切换结果正确，但若将来测试“把epoch检查挪到事务前”的错误实现，需更强同步或收窄“排队”表述。

本实验是本地SQLite DELETE journal、synchronous FULL下的进程中断，不是物理断电、内核故障、网络文件系统、WAL或零停机认证。也未演练批准的降级/备份回滚政策；新fee无法由v1表达，不能仅恢复旧备份后声称保住升级后资料。

## 实际缺陷：NULL op_key破坏稳定收据

`receipt-key-probe/`是额外副本，未改cold-run四库。用真实CLI在v1、v2各做三次请求：

1. op_key=null且其他业务字段有效，返回accepted。
2. 完整同一请求再发，v1返回entry_conflict、v2返回constraint_error，均不是duplicate。
3. 同一null key改entry_id，仍accepted；各库最终出现两条op_key IS NULL收据。

结果/请求/精确命令保留`receipt-key-probe.json`及`commands/null-key-*`。根因是两侧只检查部分数值字段、没有身份键类型合同；原write_receipts的TEXT PRIMARY KEY未显式NOT NULL，而SQL`WHERE op_key=?`绑定None不会匹配既有NULL行。不能在已经accepted后才把此请求解释为“不受幂等承诺保护”。

修复应在旧/新写入口共同明确必需身份字段并拒绝NULL/非法类型，保持epoch/整请求冲突及持久ACK语义，公共协议同步。是否进一步迁移收据表约束须以保留原收据为前提；本轮不要求为微型构造扩展成完整脏历史清理。修后应先以这六次廉价原探针重验，并保留旧失败原件。

当前可认可的是这份冻结小输入的四条持久迁移/切换路径可达。整题输入/完整应用回归/恢复决策/原子rubric/错误变体/真实受测系统与小时级/专业校准仍未完成，不增加重型case完成数。
