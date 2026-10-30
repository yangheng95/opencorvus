# L04已有应用迁移与恢复：完整成品及历史资格

## Recall

用户要求十个真正重型全链路任务、rubric、独立agent审查、OpenCorvus与Codex实跑比较，数小时应来自有效业务依赖；旧H05两方旧标准100已触发升级。用户最新要求“从便宜的实验开始做”，没有设置总token/总墙钟限额。六个昂贵资格容器保持Paused，S06只证明微型管线，不计入十题。[长程Recall](2026-10-29-heavy-workbench-long.md)与[九题独立审查](../../artifacts/2026-10-29-heavy-workbench-long/evaluator/nine-case-review/H04.md)是前置依据。

当前旧H04只有600订单CSV/已指定目标三表，事务转换即可完成主要核，没有已有数据库、真实版本、写入ACK或切换边界。新任务要测试持久数据版本演进，与H05跨系统副作用区别；不能只加行数/报告/故障名称。独立建议先真实小构造O1=USD12.34、R1=-2.34及快照后ACK O2=CNY5.00，再做数据库/版本/epoch共同提交和受控进程恢复。

已查主仓tracked定义/调用及现行case目录：尚无l04-migration/L04资格实现，相关材料是旧H04与九题建议，不能冒充新执行器已存在。Windows字面glob搜索不能证明全仓结果，已改用git grep/rg文件过滤。当前宿主Python3.14/SQLite3.50.4可用；查[SQLite事务官方文档](https://www.sqlite.org/lang_transaction.html)与[WAL文档](https://www.sqlite.org/wal.html)。本资格明确使用本地rollback journal（DELETE）及synchronous FULL、显式事务和合作旧写者；不要求WAL/零停写/网络文件系统或物理断电。

## 问题深度与影响面

直接触发是旧题缺持久状态与并发切换能力，根因是CSV输入将身份、迁移史和ACK事实都消除了；一个新建库事务无法检验已确认数据保存。旧路径不涉及旧写者或提交后响应丢失，故此前局部通过不能证明安全升级。新资格只构造合成数据库/公开协议、隔离参考与独立SQL检查，不修改生产Task/Mission/Session调度、数据库迁移、Provider/工具、UI、发布或用户服务；不会以benchmark注入故障推断生产共享队列有问题。故障仅作用于本资格自行启动并记录PID的子进程。

公共事实必须先单一化：schema_migrations历史最大版本是唯一schema版本，control中的epoch是写者generation、不是版本影子；旧/新写者都在同一写事务内检查epoch。事务迁移同时提交数据、当前版本历史与epoch变化。历史raw数据只用于不可变归档/隔离，不保留第二套活跃协议/双写；目标只使用v2接口，旧写者以明确stale_epoch退场。

风险包括把金额汇总一致当逐身份保留、按邮箱猜合并、executescript隐式提交破坏事务、备份恢复丢升级后写、无日志却要求不停写无损，以及伪造故障位置。用权威身份映射、Decimal精确两位金额、真实数据库/稳定写者、明确短暂停写能力与真实进程控制边界解决；参考允许SQLite事务的正确简单实现，不以算法简单扣分。

## 实施前协议与便宜验收

1. 外部根`D:/opencorvus-benchmark-runs/l04-migration-qualification-20261029`，生成关闭连接的真实v1.sqlite、schema/migration史、权威customer映射与可执行legacy_writer.py。数据为明示合成，含相同邮箱不同权威身份、两legacy ID的合法同一客户别名、USD/CNY订单与退款、孤儿/未映射/金额非法记录。可安全映射和应隔离的原因公开，不能自行猜身份或静默丢原数据。
2. v1写者以BEGIN IMMEDIATE检查epoch3，再提交订单和稳定write_receipts，只有commit后才输出ACK。v2迁移目标有真实客户/别名、整数金额、退款外键、非负fee_minor及隔离原件；所有源数据必须可按稳定身份追踪。schema_migrations升级记录一次、epoch从3变4在同一事务。原迁移史保留，重复upgrade返回already_current，不再递增epoch。
3. 私有建设性参考先实现upgrade/read/write新接口。公开故障能力是在真实before_commit或after_commit处发出JSON checkpoint并等待stdin释放；评估侧只在确认自有PID/该事件后终止这个子进程，不使用sleep或操作用户进程。另一连接实际查看当时schema/epoch，防止把日志位置当提交事实。
4. 三组新副本：正常升级与升级前ACK O2保留；before_commit进程中断后真实v1状态/再次升级/继续v2写；after_commit响应前中断后真实v2状态/幂等重试/继续写。另在迁移持锁时启动独立旧写者，释放提交后应收到stale_epoch，不生成虚假成功。每组都核对逐entry ID、customer、币种、金额、退款关系、隔离raw、实际版本/epoch/ACK收据，并执行合法v2 fee写及明确冲突响应。
5. 完整源码新目录再冷跑，独立agent单层审查/复核原件，禁止再委托。先证实这几秒级能力真实可达，再补完整重型现场/版本与应用回归/操作手册/恢复决策、原子rubric和错误对照；微型资格不能宣布L04冻结、数小时或十题完成。没有新LLM候选、GPU、整数长求解或用户进程操作。

所有新spec/产物归根目录specs并同步索引；本任务修改范围提交，正常fetch/merge/完整待推集合审查/push，保留其他任务工作区。

首轮真实构造5.86秒完成正常/before_commit中断/after_commit响应丢失/旧写者跨切换4场景，43个真实子进程、217个正向事实/具名错误核对；source/PID/数据库与控制事件均落盘。它从已知seed生成了原库再运行，只作初轮构造。主方审读发现运行器仍把输入生成与执行耦合，不利于冻结原库的source-only复跑；因此删除运行器对seed生成的依赖，新增必需--input目录，仅复制v1.sqlite/authority/provenance，seed脚本只负责独立准备fixture，旧已执行源/数据库不覆盖。修后必须用同一冻结原库重跑真实场景，独立agent再另目录完整冷跑；不能仅靠源文件存在代替。

修后同一冻结原库主方6.15秒通过，独立冷跑核心10.47秒也通过4场景；另独立SQL按原库/authority重建112项通过。但独立真实反例发现两个写入口共同接受op_key:null：SQLite普通TEXT PRIMARY KEY未显式NOT NULL，且WHERE op_key=NULL不匹配，重发变entry_conflict/constraint_error，换entry_id又accepted形成第二条NULL收据。旧自检只取合法字符串身份，没有暴露共享缺口；不能拿原217项通过掩盖这个真实失败。反例在独立目录两个副本/6次真实CLI，原冷跑DB不覆盖。

修复前横向审计覆盖本资格全部v1/v2入口、正常/重复/冲突/提交后恢复/旧写者串并行切换，均只有这两个写函数和同一稳定收据表；四场景每次独立路径/库，无公共全局状态。脚本全部为本资格私有Python/SQLite，仅导入标准库，没有生产Task/Mission/Session或共享队列primitive调用，代码/路径据此排除产品调度根因，不把共享于两个写者的问题降为单个case。根因为入口没有稳定身份类型合同和表层允许NULL，需同时修API与v2持久约束。

实施前修复方案：新增唯一l04_request.py共同验证两写者的非空字符串op_key/entry_id、整数epoch及各版本字段，返回invalid_request/field；不复制两份身份规则。旧原库和已发布version1历史不改，v2在同一迁移事务内将write_receipts升级为显式NOT NULL/非空身份并保留原收据，entries.entry_id同样具备约束。已有无法判定的空/NULL收据身份或entry身份返回unresolved_receipt_identity/unresolved_entry_identity，迁移中止、原数据/版本/epoch保留待对账，禁止猜造op_key。补真实两写入口8个非法身份/类型错误、实际SQL身份约束和两个旧模糊身份中止对照；修后完整小资格再实跑，独立只复核新增修复与必要冷跑。新协议同步这些边界。

queued控制只独立观察到进程在紧邻BEGIN之前发出write_attempt、跨切换后stale；不能把它夸大为已读取SQLite内部等待队列。事务内检查epoch的真实代码、提交边界的独立SQL及结果共同支持当前合同，但不认证全部并发调度。当前仍非重型题冻结。

修复横向覆盖所有v2稳定TEXT主键：customers、entries、write_receipts均显式NOT NULL/非空；quarantine组合键原已NOT NULL。原v1库/迁移史不重写，v2收据约束在事务内自动升级并保留合法收据。修后run-c加入共享输入guard、8个真实CLI错误及两个模糊身份按合同中止；run-d再覆盖客户主键，核心7.18秒、53子进程/245事实通过。是4个成功升级场景和2个保留原库的明确中止场景，不能说6次全部升级成功。当前四源和实际版本快照、原失败都保留，公开writer与shared helper成对同步。SQLite TEXT主键允许NULL的事实另由[官方CREATE TABLE合同](https://www.sqlite.org/lang_createtable.html)及独立真实反例共同证明，不凭DDL字面值推定运行安全。

最终独立复核已完成：只带修后四源和冻结三输入的新目录实跑核心11.0913秒（外部调用11.2479秒），6场景/53进程/245项通过；另从原库/authority独立构造112项SQL及27项修复检查通过。真实重放旧NULL原请求6次都为invalid_request/op_key，两个应中止场景完整sqlite_master和所有原表逐行保持，8条实际SQLite身份约束错误合同通过。审查只终止其原始Popen句柄的自有PID，原失败不覆盖，不运行Provider/GPU/solver/UI，也不再委托。完整报告/机器结论在cases/L04/evaluator/independent-review，认可范围仅本微型协议和当前已知构造。

下一步不能重复本小资格凑工作量：补完整重型场景的既有应用/迁移史、原始数据/权威判据、版本与业务回归、恢复/前向修复的真实决策和交付链，先让完整参考和具名错误实现进入同一独立checker，再写原子rubric并冻结。当前未有正式候选/对照/小时级，无专家盲评或成熟认证；新长任务的无活动设置要按实际活动定义，不能搬用这个小资格的单子进程超时作为总任务额度。

## 最新完整成品Recall：2026-10-30 UTC / 本地10-31

用户纠偏“题没开发完，测试也没测试，跑题”最高优先：本轮直接补L04整题，不再重旧微型/通用框架。实施前读取AGENTS/本记录/长程最新Recall/H04整题建议、全旧schema/四源及消费者搜索，并落cases/L04/evaluator/BUILD-PLAN。仅本case输入/软件/检查器/报告和spec索引；未触生产调度/数据库/Provider/UI/发布，也未操作用户进程。旧公开微型七文件和已确认NULL缺陷原件保historical-micro-input.zip/旧qualification，不作当前fallback。

当前L04/0.2.0-dev完整13public：实际app-v1.sqlite、权威身份、已交付schema/历史、真实旧应用、完整数据/执行/输出/环境/业务来信和唯一公开exercise_app.py。源→原应用读写/ACK/用户NUL批注→备份→commit前/后真实进程中断/原请求恢复→两个旧写者跨切换→新费用/退款/新写失ACK→拒旧备份数据回卷/前向修复→继续write/get→真实SQL/分币种账/实际四面板图/运维与自含reproduce全部完成。

主根D:/opencorvus-benchmark-runs/l04-full-case-20261031，唯一最终handover-submission与handover-base/money/identity（weak为handover-weak相应三输入）。各正式新输入实际native0、四营业链+两明确身份中止完成；金额控制O1+317最小单位，身份控制legacy12→C-GAMMA，同总额不能掩盖逐客户错映射。原v1历史/audit/notes/ACK逐原文保留，原退款按父/客户/币种与整组上限分类，不猜邮箱。新费用独立于本金，恢复旧备份会丢新ACK/fee，实际仅retain_v2前向修复并继续营业，不伪无损降级。

真实错误programme按邮箱合并、截断金额、错退款链接、版本先提交、旧备份覆盖，均入同checker。缓存authority三输入真实native0，base正确但身份控制M03/M04关键失败。它们未有全控制/独立内容评级者总分保持null；没有把检查数当样本。主/weak原三输入都真实出图并由主方/独审view，弱报告虽然数值正确却伪保证所有现实并发/掉电/任意降级。

一次集中独审D:/opencorvus-benchmark-runs/l04-whole-case-independent-review-20261031独立原SQLite/Decimal逐行、新请求/完整ACK、notes/audit/版本/实际PID/恢复核算；最多另一次真实自含reproduce基例19.3405秒自然0，原inspect/log/exit/SQL/源输入先ZIP后精确cleanup。初评H05实际fail、主其它Hpass；弱额外H02fail，不连坐。原source-initial/check_l04.py在真实探针前已捕获，初评/失败保留。

三实质阻断集中修闭合：新写901→902并改audit/export原M04/M09假通过，现从原request独立递推每笔实际DB字段、明确M04fail；只改真实DB O1原JSON不动旧M02/M04/M15假通过，现同一snapshot只读SQLite URI核实际库并绑快照/导出，同探针明确M04fail；复建命令依赖private run_l04，现唯一执行器移public、参考交付reproduce.py只消费public+本submission，无私有评估挂载。report真实降uid/gid65534，只读555/444副本；原事实留容器内部700区，report终态后才导出，保存真实首行UID/权限/原DB。不扩通用调度/评估框架或任意OS安全平台。

另保两真实作者构造错误：首entry歧义NULL被旧audit NOT NULL触发器拒绝（未调用候选），修为空身份后首完整基例重跑，原native/trace保；published SQL先INDEX后TABLE且含内部表导致真实executescript错误，候选前改table→index→trigger/滤sqlite_，实际新DB/合法写/trigger通过，原SQL/失败保留。old cold使用旧SQL文档不冒称新SQL执行；原app-v1和version1历史未改。最初图fee同本金同轴不可读及v2构造日期均已改为分面板/真实native窗口UTC，旧源/图/原执行均保留。DATA最后只把既已审查/实测的实际UTC窗口说清，不改行为/数据/权重或阈值。

18:57:54Z单层整题最终无阻断，允许仅开发metadata冻结；最终主H01–05pass，weak仅H02fail。随后主方真实check_l04 CLI接registered-inputs/rubric及原三run_roots+独立五评级：主exit0/100/21pass/allcritical/goodtrue；weakexit2/96/H02criticalfail/goodfalse。不是人工手填/Inspect完成分/LLM成绩。FREEZE/status/输入名metadata定稿，21叶100/critical/90线不变。

Git内whole-case-tests保完整可读成品/源码/原命令/实际评分/独审；originals.zip约21.5MB含所有主/独立原件、原capture与数据库，不用hash/叶数/文件数作功能门。操作命令见外部register-and-grade.py及Git中的handover-reviewed-command.json、handover-weak-reviewed-command.json。自含复建：Linux owner容器、readonly完整public与submission、新out，python /source/reproduce.py --input /raw --output /results/run。当前所有新增L04进程/容器均自然终态/封存清理；六旧昂贵资格真实仍Paused，不恢复。结束范围提交、正常fetch/merge/审全待推/必要check/push，保护用户overlay/视频图片删除/索引排序/Bun。

套件现8/10开发合同、候选有效小时0/10，非职业真人/统计成熟；剩完整L05/L01和已触发L02/L06新版本必须继续。当前L02/L06双100终态旧线不改，不重API/旧矩阵/旧资格/旧solver。下一直接L05完整现场/多sender/持久恢复/自由逻辑导出/监测/运营交付/同checker错误程序/一次整审，不再重L04或旧L05小例凑量。只有全目标真实达成才停心跳。
