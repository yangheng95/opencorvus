# Channel 入站效果与回执恢复

## Recall

- 用户要求：横向审计持久投递中效果已发生但缺成功回执，覆盖删除重建、真实进程重启、并发和保留数据升级；先分析根因再实现，由独立子 agent 裁定，不能只报错阻止升级。主 agent 授权本子 agent 实施 Channel 源码、Control 同一结果读取投影及后端聚焦测试；禁止再委托、修改索引、commit/push、使用凭据或模型、操作现用服务。
- 已读 AGENTS.md、父方案 `2026-10-24-durable-effect-receipt-audit.md` Recall、当前 02-data/03-control、Channel 两表/入口/HTTP/Gateway、正式 Project.delete、ControlMessage、Question、Permission ledger、Interaction 源与投影、Bus.withCausation、控制 lease/进程存活 primitive、测试 runner 和原故障切点。全仓 ChannelIngress.reconcile 只有定义及一项人工补写单测，生产调用 0。
- 初始 tracked Channel/Control 无其他改动；保留仓库无关删除和其他任务改动。root 独占 ddl/schema/migrations v7、Bus/Event/Automation 及根索引；迁移 1–6 不改。本子任务新增记录索引由 root 维护。
- 原始证据位于 `.tmp-product-iteration/durable-effect-receipt-audit/channel/`：delete-settled/gap.json、restart-question/permission.json 与子进程日志、channel-stock-private.json、verified-summary.json。checker `check-evidence.ts` 已 exit 0，核真实效果和前后实际字段，而非仅最后错误。
- 验收：使用正式 Channel、Question、Permission、Project.delete、Database opener，故障发生在效果之后 outcome 之前；旧原件以只读 SQLite serialize 复制到自有升级 runtime。必要局部 fixture 只准备 Task，不冒充创建流程或真实模型验收。没有 UI 改动，不运行 UI 自动化。

## 原现象、触发与控制流根因

1. 正式 Channel allow_create=false 请求得到 accepted1/outcome1，正式 Project.delete 却在 database-commit 触发 `SQLITE_CONSTRAINT_TRIGGER: channel_ingress_accepted: immutable input fact`；Project、Channel 原事实和 lease 全部精确回滚。accepted1/outcome0 同样。根因是 accepted.project_id 的 cascade 外键与无条件 immutable no_delete 冲突。删除事实属于原输入审计，不应为了使 cascade 成功丢弃。
2. 正式 Question 回复已提交唯一 question.replied 原 source、精确引用它的 Interaction outcome，waiter 收答案 1 次；或正式 Permission 原本地授权效果执行 1 次，ledger 已 requested/allowed_once/execution_started/execution_succeeded。在 Channel 的 afterEffectBeforeOutcome 实际 process.exit(23)，新进程同 authority 重开后原 request 永久 OutcomeUnknown。根因是 accepted 无 outcome 被直接拒绝，原效果与 accepted 没有持久因果引用，公共 reconcile 仅相信 caller 自述 result。
3. Permission 回复可能在 Channel 读取 pending 后输给其他真实 operator，Authority 只为 winner 发布 Replied。Channel 实际返回 canonical winner，但没有自己 causation 的 terminal。必须在 accepted 同一事务冻结原 interaction，不能仅为效果发布增加 causation 后依旧遗漏这个真实竞争路径。
4. 旧测试只手动调用 reconcile 写 caller 提供的结果，未验证真实效果、真实 owner、lease 或进程重启。原错误将安全拒绝与可恢复的明确 domain 事实混为一谈，旧回执格式自身不能补出未保留的因果关系。
5. 原120秒 effect lease没有续约，正常长 Control 调用返回时也会因 expiry 拒绝写真实 outcome。当前调用的实际返回结果只允许在原 lease 仍是当前同 ID/同 owner 时，在终态事务重新取得当前 lease 并提交；若其他 owner 已接管，旧 fence 仍拒绝。没有重跑效果、超时猜测成功或新增定时器。
6. 独立 judge 反证指出，普通 replay 不得把自然 lease expiry 当作原进程死亡。恢复读取既有 lease_grant 的最后真实授权期限；只有当前 expires_at 被实际 release 缩短才证明调用已交回，否则必须观察原 OS 物理身份，存活仍 processing。原调用异常时若 lease 自然过期，也仅在当前同 ID/同 owner 下取得并立即 release 当前 lease，记录该真实调用已结束，避免活进程错误后恢复永久受阻。

影响面：Channel/Gateway 入站结果合同、Project 删除与相同 ID 新 generation、Control completed turn 的同一结果投影、Question/Permission terminal/source、lease 的跨进程恢复、accepted/outcome schema、v7 保留原行迁移、现有 Channel 测试和当前架构。没有外部消息发布、模型工具选择或 UI 改动。前序720路径只读复审全部可读，716有 Channel 两表，accepted/outcome均0；这不是穷尽外部文件的证明。

## 实施方案与数据合同

- accepted 为唯一原始请求事实。取消其 project_id→Project cascade，保留 accepted/outcome 不可变 trigger 和原唯一索引。新增可空 `project_generation TEXT` 以及 `effect TEXT(JSON)`；旧行两列 NULL 不按当前 owner、文本或时钟猜补。
- 新 writer 从同事务的真实 Project occurrence 冻结 generation。effect 为 `{kind:'interaction',interactionID,taskID,sessionID,requestID,type:'permission'|'question'}` 或 `{kind:'control'}`。确定性选择来自原 binding 和 canonical Interaction 快照，执行只访问该原 interaction。无 binding 且禁止创建、以及不识别的 Permission 回复，是无领域效果的明确结果，与 accepted 同事务保存 outcome。
- 实际执行使用既有 `Bus.withCausation({source:'channel.ingress',occurrenceID:acceptedID})`，不建立平行 processed 表。Interaction 恢复核 accepted.effect、原 immutable request/Protocol Task owner、canonical domain terminal；Question 核精确 terminal source 与因果关系；Permission 读 ledger 的真实 winner，不重跑授权效果。Control 通过同 causation 的真实 Session/user/completed assistant 原 source 及当前 MessageStore 事实读取原 turn，再复用原 buildResult；不按文本、名字、时间或 latest assistant 猜测。
- effect lease 与新请求首次 accepted 同事务取得，owner 使用成熟 runtime process occurrence/liveness。恢复必须在当前 Project generation 内，原进程活跃时返回明确 processing；原进程 OS 身份已死亡或 lease 已正常结束才接管，接管与最后 terminal 检查在同一事务，结果与 lease release 同提交。晚 owner 不能覆盖真实 outcome。
- 删除无事实 caller reconcile。单一自动恢复入口根据持久事实恢复；无法证明的旧来源返回结构化可审阅诊断（原 accepted、owner 状态、原因果 source 身份、lease 状态），保留 unknown，不补旧效果、不写虚假成功、不阻止数据库升级。
- 审阅入口为 `GET /channel/message/:platform/:requestID`，可显式给 `projectID` 读取已删除 Project 的保留原件，省略时使用当前 Project；此参数只用于只读审阅，不能改变恢复/执行 owner。`field=input|effect|outcome` 选择原存储 JSON；`byteOffset` 读取4096原字节 base64页，`afterSource`/`limit` 遍历真实因果 source（默认16、最多32）。409错误只附首个有界页。原 Unicode、附件和 JSON 格式不重写；正常 owner 校验只读 Project 主键，诊断才查询因果历史，避免正常请求引入全量历史扫描。
- root 负责追加 v7 重建 accepted 表保留所有原行/rowid、索引与原 outcome 引用、移除 Project FK；新 fresh DDL 与 schema 同源一致。不得修改已交付迁移 1–6。真实旧 v6 四原件保留供正式 opener 升级验收。

## 验证矩阵与限制

新来源：无效果原子结果、固定 Question/Permission、operator winner 竞争、Control 原 completed turn、效果后抛错/真实硬退出、同进程与独立进程恢复/active lease、Project.delete 后同 ID 新 generation、后续新请求、多 Project。旧来源：v6 no-effect settled/gap、Question/Permission gap 的保留数据升级、原 backup、重复重开、明确未知诊断与新请求可继续。最终以 root 聚焦测试/真实故障原件/独立裁定结算。

当前原 Question 探针没有配置 Task-root runner，独立后台 scan 明确记录 unavailable runner；该事实不影响已验证的 Question terminal/Interaction outcome，也不证明后续模型 Task 执行。若 Control 只使用真实持久消息重建测试，只证明结果投影/恢复，不声称真实模型语义验收。

## 当前验证记录

- 初轮 Channel事实3项/恢复6项通过，真实 server/task-board-validator 后端文件通过；后来新增 expiry/fence/分页合同后须以最终重跑结算，不把初轮数量当完整交付。首次代码错误是 async try/finally 中未 await recover Promise，提前释放 process liveness；已改成 return await 并重跑原红例通过。
- v7 Question/Permission真实效果后硬退出23、新独立进程恢复均通过：accepted/domain source逐值保留，原effect1，真实outcome1，恢复发生在旧lease deadline前，靠OS死亡事实接管而非等超时，恢复lease与outcome同刻release。
- Question/Permission各3个独立进程并发恢复均首次成功，全部返回同一个原canonical结果、唯一outcome1，原accepted和domain事实逐值保留；初次无busy或processing，不把重试掩成初次成功。
- 四个修复前实际v6原件经当前正式opener升级：settled 90表9行、gap 90表8行、Question 90表60行、Permission 90表56行。逐原列/行/rowid保留、整原库backup一致、重复重开authority一致；新两列NULL、旧owner明确unknown，原来源可审阅，另一新channel/thread请求正常。最终当前源码再次逐案exit0（`v7/final-current-upgrade-{mode}.log`），并导出正式opener后、后续请求前的原完整只读快照 `upgrade-{mode}-after-opener.sqlite`，不将DDL中间态当最终验收。
- 后续Bun runner出现Question.reply记录replied但terminal原outbox尚未提交的共享停滞，原facts/log已保留。父任务修过Bus共享batch owner与普通exact延迟drain，另一子任务发现并修MCP/Config冷初始化反向锁序；本子任务未据候选名认定Channel局部根因。自有旧worker按精确命令行/父PID清理，不触碰现用服务。共享冷锁序独立真实确认后完整21项曾通过；新增独立反证分支后的原生matcher饥饿另有下节真实剖析，不能把候选名称混为已证单一根因。
- `channel/final-typecheck.log`、新增有界读取后的`bounded-typecheck.log`均exit0。原共享readiness.ts类型问题以及中途global allocation DDL/registry不一致曾真实阻止检查，均保留原log，由其owner修正；不当作Channel行为已验收。
- 可交付探针与安全汇总在 [Channel artifact目录](../../artifacts/2026-10-24-channel-effect-receipt-recovery/README.md)。本地原JSON、数据库、逐进程和旧红日志保留在Recall指定目录；不提交用户数据库或私有路径。

## 独立复核追加：运行上下文的 Project generation

独立 judge 追加指出，registry generation 与 accepted generation 一致不能替代当前 Instance 自身 generation。当前首次 accepted 从 registry 读取 generation，而原 guard 没有比较 `Instance.projectGeneration`：若另一进程正式删除、同 ID 重建，旧进程仍保留原 serving context，新输入会被登记成新 occurrence，现新来源 replay 也可能进入旧上下文。单进程 delete 会 dispose 本地 context，但不是跨进程证明；不得用非法 SQL 修改 generation 伪造该问题。

追加方案：先用两个隔离真实进程分别持有旧 Instance 和执行正式 delete/recreate，记录新旧 generation、原输入和返回；首次写 accepted 的同一 writer 内比较真实 Instance generation 与 registry，冻结 Instance 的实际 generation，错误采用明确可序列化的 `CHANNEL_INGRESS_PROJECT_CONTEXT_CONFLICT`。所有原 accepted 执行、恢复及终态 writer 还必须比较 accepted 与 Instance generation，避免新 occurrence 的真实已接受来源在旧 context replay。只读 inspect 不受运行 context 限制。聚焦测试与真实原红例均复验，由独立 judge 裁定。

## 横向追加：直接 Task-control Question

生产 `replyUserInteraction` 还支持 `payload.activity_reconciliation` 的直接 control gate：这类 Interaction 不是 Question subsystem 注册的 waiter，没有原 Asked source，实际 ack 直接追加唯一 immutable Interaction outcome，响应中保留 `answers` 与原 `user_input`。Channel 原选择会包括该类 pending question，但恢复一律查询 Question.publicationFacts，效果后 gap 无法恢复。先用成熟 insertEngineInteractionRequest primitive 准备此明确持久前态，走正式 Channel→Task API 的真实 acknowledge_unknown，保留真实 outcome，再原故障切点验证。该前态准备只声明聚焦持久契约，不冒充真正未知 Provider activity 的完整创建流程。

若原红成立，恢复按已有 Interaction request 的 source_kind 单一事实分派：bus_question 继续精确 Asked/terminal causation；direct activity gate 则核真实唯一 direct outcome、实际 Task/Session owner、原 accepted 的确切 Interaction 与输入，以及原 user_input surface/text/structured acknowledgement，读取同一个已发生的原 terminal。直接 acknowledgement 的恢复绝不调用 Question.reply 或再次执行 acknowledgement，不能为了兼容另建 processed 表或给原旧数据猜写 cause。非该明确 gate 的其他 direct question 保持明确unknown，不臆造通用Question source。

该分支已正式红绿：`direct-activity-red.log` 在真实 acknowledgement 已成功、outcome 原行已存在后恢复失败（Asked源为0），修后 `direct-activity-fixed.log` 1项/5断言、exit0。原 immutable direct outcome 的完整原行和 rowid 保留，Channel 真实回执等于原实际输出。当前真实 `process.exit(23)`→新进程恢复与三个独立进程并发均 checker exit0，原accepted/domain事实精确保留、真实outcome1；此处 effect1 指实际唯一 acknowledgement terminal，并不宣称执行了未知 Provider 活动。证据为 `v7/current-restart-activity.log`、`v7/current-concurrent-activity.log` 及各目录原JSON/逐进程日志。

## 原检查器饥饿的真实剖析

完整新矩阵在真实 Question terminal 已提交、Asked Interaction 已出现但 Bus receipt 尚未写时连续耗尽单核，test 60秒计时器、lease renewal 和其他 timer 均不能运行，最终成熟 runner 的独立360秒 watchdog结束该 worker。不能仅凭末状态归因为生产 Question、MCP 或 Task scanner。保留的 `generation-focused-running-facts.jsonl`、`two-boundaries-hung.sqlite`、`profile-hung-initial.sqlite` 与完整计数支持后续独立读取。

原单个 superseded case通过，而按原顺序选择“ordinary replay|a superseded original writer”稳定复现。先用本机 `bun --help` 及小脚本证明 CPU profiler/Inspector 启动选项确实生效，再用自有 ignored wrapper 仅给成熟 runner 的被测 worker 增加观测参数，未改原 runner、测试主体或生产行为。真实 Inspector 的 ScriptProfiler 2秒249/249样本全在 Bun 原生 `toBeInstanceOf`，下一帧是该 superseded case 的 `.rejects.toBeInstanceOf(ControlLeaseFenceLostError)`；原 `profile-inspector-samples.json` 保留完整样本。Inspector表达式行号是Bun转译位置，不能冒充源码绝对行号。

检查器调用修复仅改为先以正常 JavaScript await 得到实际 rejected Error，再做相同同步 instance-of 正向类型断言。前序时钟spy、实际 Channel 请求、真实fence/lease/terminal断言均保留。原两例顺序修后2项/8断言、exit0（`generation-two-await-fixed.log`），生产未为此添加绕行、等待或跳过原例。最终完整矩阵和独立裁定另列，不把两例绿当全部关闭。

## 版本7阶段验收与交付范围

追加迁移8之前，`bun script/run-tests.ts test/channel-ingress-fact-storage.test.ts test/channel-ingress-recovery.test.ts test/server/task-board-validator.test.ts` 的该阶段完整结果是23项/123断言、exit0：事实4项37断言、恢复11项48断言、真实后端Task Board 8项38断言。原日志 `final-complete-focused.log`。该阶段 `bun run typecheck` exit0（`final-complete-typecheck.log`）；根 `bun run check:control-lease-owners` exit0，18 owners/25 acquire sites；唯一声明中Channel三处实际claim与各自真实回执/release合同已更新，未改扫描器掩盖数量变化。

真实硬重启与三独立进程并发的 Question、Permission、direct activity acknowledgement 六案都由当前可交付脚本checker exit0：原accepted/domain事实保留、原效果terminal1、唯一真实outcome1，三个并发worker首次响应相同canonical结果、retry0。Control当前只完成持久消息投影聚焦合同，不声称真实模型语义验收。四旧Channel原件、四旧Automation原件当前真实保留升级全部通过，Automation另有独立raw认可记录。

同一真实stale Instance探针还实证Event create首写漏洞并交root修复。修后新generation正式create正常，旧context create与remove current definition都返回 `SchedulerProjectOwnerError / target_deleted`，实际current definition保留，`v7/stale-event-writers-fixed.log` exit0。该源码和其完整独立验收由root管理，本子任务只提供原红与正式复验。

本子任务当前源码、聚焦测试、原件升级和真实故障矩阵已完成，等待独立judge对最后完整分支作最终裁定；没有证据支持无限扩展未查路径的“全系统再无问题”声明。未操作现用服务、用户窗口、Provider凭据或模型；无UI自动化，无原存量数据库写入。全部tracked改动由root统一提交，本子agent未操作index、commit或push。

## 最终升级目标8

前述版本7验收保留为真实历史阶段。追加Expert Squad长期mutation receipt迁移8后，四个真正旧6 Channel原件再次通过当前正式6→8 opener、全原表/行/rowid与backup保留、历史effect/generation NULL的明确unknown及新request继续工作的合同，四案actual exit0。日志为 `channel/v8/final-upgrade-{settled,gap,question,permission}.log`，报告与迁移完成、运行恢复前完整快照为 `channel/v8/upgrade-{mode}.json`、`upgrade-{mode}-after-opener.sqlite`。独立judge已再次raw复核全部原行/rowid/backup，最终8升级范围通过。另四个Automation原6升级同步重跑至8，详见其独立记录。公开upgrade probe当前目标已更新8，原7文件名与日志不改写成8。

## 最终8组合验收暴露的第二处原生异步matcher饥饿

root完整9文件同序验收的第9个Channel recovery文件，direct acknowledgement及真实stale双进程前两例通过，随后Question例在原Asked/Replied均已提交、原Asked delivery1/receipt0、Interaction outcome0、Channel outcome0时持续单核CPU增长；原60秒test timer没有机会运行。两次独立只读观察事实不推进，原worker ReadOperation13162/Write4492不变，成熟runner最后按360秒inactivity结算，原完整日志 `root-channel-current8-complete.log` 第9 exitunknown/duration371.47秒。原runtime随正式runner结算清理，未导出这轮完整SQLite；不得把此前 `profile-hung-initial.sqlite` 的旧toBeInstanceOf样本冒称本轮原库。

原完整单file加现有profiler/Inspector观测11例48断言全过（`profile-current8-channel.log`），不能据此清除完整组合异常。随后以原完全相同9文件顺序、成熟runner/原60秒与360秒窗口、原test主体，仅添加已验证观测启动参数的 `profile-current8-original-nine.log` 重现同一第3例停顿。此时真实ScriptProfiler采样保存在 `profile-current8-question-inspector.json`：共70条stackTraces，第一条native `toThrow`→本文件转译expr235:68，对应当前源码Question255的pending promise `.rejects.toThrow`；其余为采样打断饥饿后恢复推进的run28、spawn22及SQL等。不是旧249/249形态，禁止写成70/70都native。

Inspector启动后原timer立刻得到机会，Question实际报告60000ms timeout并在active Instance callback内触发真实afterEach disposal guard，下一Permission例为连带SuppressedError，其余后续通过；同序观测轮9pass2fail。这些错误源于已超时但仍活跃的测试scope，不能为使验收过而删除真实Instance guard或改生产Question/Bus恢复。当前可证机制是pending Promise上的原生rejects matcher占住执行，正式call的后续微任务及timer无法完成；实际Question未到预期afterEffect hook，不能把最后receipt0当作生产恢复根因。

最小工具链修复方案：仅将当前同文件四处pending promise `.rejects.toThrow`与一处Permission执行 `.rejects.toBeInstanceOf`换为先正常JavaScript await真实call并捕获实际Error，再同步断言精确Error类型/原消息。保留原请求、原hook、真实effect与receipt、顺序、全部测试及原超时；不使用mock、不跳例、不改生产、不提高超时。随后必须重跑root原完整9文件顺序和原完整Channel聚焦范围，由独立judge检查新结果；当前尚未把此追加轮判为通过。

方案实施后，原完整9文件同序、正式非profiler runner `final-current8-nine-await-fixed.log` actual exit0，35项161断言、9个文件runner均0；原第9文件完整11项52断言全部通过，Question实际3.27秒完成并满足原hook/Error/效果/receipt合同。独立原Channel三文件完整复验 `final-current8-complete-await-fixed.log` actual exit0，23项127断言：事实4/37、恢复11/52、后端Task Board8/38。增加的4条断言是同4个真实Error的精确类型与原消息同时验证，并非放松预期。

按同机制横向审查，本轮已触及的Evolution测试另4处pending `.rejects.toBeInstanceOf`也用真实await捕Error再同步原instance检查，最小patch，不整体格式化旧文件；其业务151断言保持，包含原完整四文件的 `expert-final-focused-await-fixed.log` actual exit0，9项208断言。其他本轮触及runner/test的同类收敛由root负责。本子任务生产源保持冻结，等待独立judge对最后同序复验和Expert范围一起作最终有界裁定。
