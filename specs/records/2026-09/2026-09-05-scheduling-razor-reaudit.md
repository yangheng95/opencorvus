# 当前调度算法剃刀复审

## Recall

- 用户原始要求：多个 agent 拆解当前项目调度算法，特别分析过度工程、系统设计矛盾、不符合剃刀原则的部分，迭代直到找不出新的问题。
- 验收：至少三条独立只读审查线；主 agent 逐项核验当前代码和生产调用链；去重并保留反证；新增问题后继续交叉复查，完整一轮所有审查面均无新增有效根因后达到本次静态审计饱和。饱和不等于证明系统无缺陷。
- 范围：调度实现只读分析，交付本报告及索引；不修改生产实现，不运行真实 Provider（模型服务提供方）、不访问用户运行数据库、不操作用户进程或窗口、不运行 UI（User Interface，用户界面）自动化测试。
- 工作区：`D:/myhexin-local/opencorvus`，分支 `v0.0.55beta`，初始 HEAD `5f367d1f30d802e3927914158c6e6722e6485736`，upstream `origin/v0.0.55beta`。已有修改 `packages/opencorvus/src/session/index.ts`、`packages/web/src/content/expert-squad-distribution.generated.ts`、`packages/web/src/content/public-market-zh-01-35.ts` 全部排除提交。
- 已读资料：仓库 `AGENTS.md`、当前 `task-control-plane.md` 与 `03-control.md`、2026-08-30 调度剃刀审计、2026-09-02 Cut 8c 整改、根 `package.json` 文档检查声明。历史报告仅作检索线索，不沿用其缺陷结论。
- 全仓搜索：枚举 scheduler、engine、orchestrator、mission、session、runtime、server 的调度/执行轮次/控制/dispatch 文件；当前入口不局限于 scheduler 目录。后续按定义与调用点反向补齐。
- 独立 agent 反馈：方案初稿时无；已委托 queue_audit（时间与事件调度/容量）、lifecycle_audit（执行/恢复/终态）、orchestration_audit（模型编排/派发/协调）。全部只读，禁止再次委托。

## 执行方案

1. 建立当前事实权威、生产入口、正常/终态、重试/重启、串并行/多项目覆盖矩阵。
2. 三条独立审查线分别给出机制拆解与候选，主 agent 核验代码位置、根因与删除方向。
3. 将有效根因合并成问题台账，区分确定代码缺陷、结构债务和运行证据未知；不以代码行数或文件数量作为过度工程证据。
4. 交换清单进行反证与遗漏搜索；每次新增根因后重新进入完整复查轮。
5. 完成文档检查和一名未参与报告写作的独立 agent 只读交付审查，修正有效问题后复核。
6. 只提交报告与索引；按仓库规则 fetch、合并 upstream、核对全部待推送提交、通过正常 hook 后 push；记录任何精确阻塞。

## 当前机制拆解

| 层次 | 真正负责的事 | 必须保留的边界 |
| --- | --- | --- |
| 用户/HTTP/Tool/Mission 输入 | 接受不可变请求、分配执行 epoch 与精确输入身份 | Task、Mission、Session 的产品和生命周期不同，不能仅因分层而合并 |
| Task-root ingress 与 reducer | 从输入、真实决策、结果和有效租约推导下一步 | 顺序、终态、同轮决策集合、事实完整性都由此校验 |
| TaskControlDriver 与 Scheduler | 提供提示、心跳、重入和有限时间唤醒 | 可丢失的提示不替代持久事实；物理所有权覆盖异步工作全程 |
| Orchestrator / dispatch | 模型决定工作；Host 验证精确 lineage、权限、冲突与外部效果 | 流式输出、真实消息、写前请求、结果收据不可删除 |
| Automation / Event | 时间规则与事件匹配产生各自来源的 Fire（触发轮次） | 两者的来源与幂等身份不同，但物理容量和终态原则应一致 |
| 物理容量与执行租约 | 限制并行效果、支持取消/重启、围住过期所有者 | 限流不是另一个业务队列；持有租约不是业务完成证据 |

当前主要矛盾不是缺少调度框架，而是几个边界被反复重新实现：发现待执行项与等待执行完成混在一起；ready 的最早唤醒与 fault 的最早重试混在一起；不可变历史的追加与当前赢家查询混在一起；临时的工具决策预占与已成功的决策混在一起。继续添加状态表或补偿调度器会扩大这些矛盾。

## 本次实际审查覆盖

以下全部是当前源码、调用链和契约的静态复查；局部实跑仅限明确标出的项，不是线上或端到端覆盖。

| 审查面 | 生产入口 | 正常与终态 | 重试与重启 | 串并行与多 Project | 局部运行证据 |
| --- | --- | --- | --- | --- | --- |
| Task | Task API、root ingress、Project bootstrap、driver | dispatch、terminal conversation、reopen、cancel、Host fault | deadline/heartbeat、activity reconciliation、dispatch recovery | 共享 scan 槽、分页游标、独立 Project context；取消独立 owner | S2 真实 driver 内存 clock/scan/timer |
| Mission | startup、Project heartbeat、Mission wake | accepted/owned/live、completion/closure、retention | process recovery、exact wake receipt、closed reservation | 四项页、Prompt/Project owner、独立取消收敛 | 无服务实跑 |
| Session | SessionLoop、SessionWake、Tool wrapper、scheduler delivery | Tool decision、真实结果、Prompt completion、deleted fence | interrupted Tool/Prompt、same occurrence、descriptor | 流式并行 Tool、exclusive Tool、Session/Task lineage 隔离 | S4 真实 coordinator；其余静态 |
| Automation | scheduled poll、manual API/Tool、delay、multi-target | attempt/run/receipt、restore/successor、pause/delete、target disposition | logical Fire retry、lease expiry、Tool replay、启动 due | definition frontier、global permit、每目标 permit 转交、Project scope | S3/S8 真实 Recurrence；S5 合成索引 SQL |
| Event | Bus accepted event、EventService、recovery discovery | exact queue head、success/disposition、definition removal、Session tombstone | retry_wait、lease recovery、head handoff、restart scan | 同 definition FIFO（First In First Out，先入先出）、per-fire pending、Project context | 无服务实跑 |
| Scheduler Message/共享机制 | protocol delivery、recipient 与 Project frontier、Scheduler tick | delivery settlement、shutdown ownership、lease claim/renew/release | wake completion、coalesced tick、durable recovery | 页内与跨页、跨 Project 发现、运行上下文期限 | S5 同义 SQL 微型实验；清单 checker |

## 问题台账

源代码位置中的 `src/` 均相对 `packages/opencorvus/`。所有行号均相对本次核验的工作树，相关调度/控制/工具实现与初始 HEAD 一致。源文件未由本任务修改；Session.get 的相关行为也已用 `git show HEAD:...` 复核，存在于初始 HEAD。P2 表示确定的正确性/活性缺陷或可证实的规模成本，未用生产事故数据升为 P1。共 11 个独立台账项：8 个算法/运行路径问题（S1-S5、S7、S8、S10），1 个可删减结构债务（S6），1 个公共契约矛盾（S9），1 个当前架构文档矛盾（D1）。S5 内的其他历史读取实例仅作同类收敛线索，不另加计数。

### S1 / P2 — 页内补位不等于全局补位：发现层仍等待最慢执行

- 证据：`src/scheduler/automation-service.ts:1289-1333` 读取一次 due 页后等待 `settledWork` 全部完成，`globalRunning` 阻止新轮；`automation-projection.ts:1060-1073` 限制页长。`src/engine/host-recovery.ts:134-165,171-210` 的 Mission 四项页与 `task-control-driver.ts:321-399` 的心跳/启动页等待全部 request 完成。`src/protocol/scheduler-message.ts:419-550` 在 recipient 页与 Project 页均等待整批完成后推进游标，其中恢复 wake 等待 completion。
- 触发：一页里最后一个执行很慢，其余已完成，下一页或后来到期的工作仍需等待。Automation 的扫描互斥范围为全局，Scheduler Message 外层还涉及后续 Project；Task/Mission driver 的相关屏障在各自 Project 内。
- 根因：发现游标的推进依赖物理执行的完成，安全所有权和发现进度被绑在同一个 Promise 屏障。
- 旧路径未根治：现有 `settledWork` 已正确做到页内哪个 worker 空闲就取下一项，但输入是固定数组，不能补下一页；容量限制本身并不能解决发现饥饿。这是旧 B5 的当前残留，并非把已修复的页内屏障重报。
- 最小收敛：沿用现有容量与持久 frontier；将“该提示已被有界执行所有者接纳”与“执行已完成”分开，补位时继续读取下一项。必须为每个运行效果保留独立有效 Project/runtime owner，不能简单 detach 到已经结束的上下文。
- 反证/边界：单页有限任务且均快速完成时不表现；Event 恢复扫描不等待整页执行，排除同类屏障，但有 S6。当前证据为生产调用链静态核验，无完整多项目长任务实跑，不声称永久饿死或已测得用户延迟。

### S2 / P2 — 退避有多个互相覆盖的入口，声明的 pacing 不成立

- 证据：`src/engine/task-control-driver.ts:449-484` 将普通 `wakeAt` 与 `penalize` 的时间取最小值；`requestWithAdmission:240-284` 不检查已有退避；`arm:511-530` 再用 `maximumWakeDelay` 截断。Mission 在 `host-recovery.ts:157-160` 配置 1 秒最大 wake 和 1 秒心跳。
- 触发/实证：真实 TaskControlDriver 纯内存执行 `{wakeAt:25,noProgress:true}` 后得到 `failures=1,wakeAt=25`，没有遵守默认 1000ms 退避；同一时刻再 request 会再次扫描。使用 60000ms 退避与 Mission 同款 1000ms maximumWake 时，错误后实际只安排到 1000ms。
- 根因：最早 readiness 时间是上界要求，retry-not-before 是下界要求；用同一个最小时间和同一截断策略表示二者，后者必然可被前者覆盖。`task-control-plane.md:407` 却声明 no-progress 永不进入最短周期重试。
- 旧路径未根治：增加 failures 指数计数只改变候选时间，没有让它约束所有同事实重扫入口。
- 最小收敛：一个明确的故障重试下界同时用于 admission 与 timer；区分心跳重复观察与真正改变故障前提的新事实。不能粗暴禁止全部新事实立即重试，也不能让心跳替代退避权威。
- 边界：真实类的局部行为已复现；生产 `task-root-ingress-delivery.ts:1790-1823` 可以组合 `noProgress` 和其他待恢复 wake。没有测用户数据库读频率，不把所有主动 request 都判为错误。

### S3 / P2 — 有限 recurrence 的正常结束被写成执行失败

- 证据：`src/scheduler/recurrence.ts:24-38,41-63` 接受 COUNT/UNTIL，耗尽却抛 `InvalidAutomationRecurrenceError`；`automation-service.ts:1974-2027` 在本轮成功结果收据写入之前计算下一次时间；`2692-2727` 的最终失败收敛也再次调用 `nextRun`。
- 触发/实证：真实 Recurrence helper 对 `DTSTART:20300101T000000Z` 加 `RRULE:FREQ=DAILY;COUNT=1`，以及等价 UNTIL 规则，接受并返回首个时间 `1893456000000`；从末次之后计算均抛 no future occurrence。
- 根因：把 `next occurrence` 建模成必然存在的 number，合法空集合被误判为非法规则；调度后继的计算又成了当前外部效果结算的前置条件。
- 后果：最后一次有效工作完成后无法正常写成功收据，进入失败重试；达到次数上限后同一异常还会发生在终局失败事务内部、写失败收据前，导致事务回滚。已有下游精确身份可能保护外部效果不重复，因此本报告不声称已经重复调用 Provider。
- 最小收敛：规则语法无效与规则已正常耗尽应有不同结果；本轮效果照常结算，只有存在下一次时才发布后继。延续一个 Fire 身份，不新建补偿任务。
- 验证边界：helper 已实跑，完整 Automation effect→receipt→restart 为代码路径证据，未运行服务。

### S4 / P2 — 失败兄弟调用回滚了成功兄弟调用的决策

- 证据：`src/tool/execution-mode.ts:101-131,140-161` 为每个调用保存 prior，然后失败时回写共享 `#decisionCommand`。`src/session/loop.ts:384-403` 的工具包装共用 coordinator；`src/engine/task-root-ingress-reducer.ts:174-181,207-211` 将混合决策归为 `host_fault/decision_ambiguous`。
- 触发/实证：A、B 并行 `dispatch_agent`，A 的 prior 为空；B 成功，A 随后失败把 claim 清空；第三个 `no_action` 被接受。真实类纯内存输出成功兄弟结果、清空后的 decision，以及 mixed decision admitted。
- 根因：局部失败用旧快照回滚共享状态，缺少精确调用所有权。它不是正常 rollback；成功兄弟事实已不可撤销。
- 旧路径未根治：跨 Provider step 从持久 receipts 重建 coordinator 解决的是重建问题，不能保护同一个流里未换 step 的并行调用。后端 reducer 能阻止错误继续，但此时已把普通可拒绝冲突升级为需要处理的 Host 故障。
- 最小收敛：失败只能撤销自身尚未完成的预占；已成功的 decision 不能被旧调用覆盖。保留 durable reducer 作为事实完整性校验，不添加另一套业务状态机。
- 同根反向验证：A/B 都失败、按 A→B 结束时会留下从未成功的 dispatch 占位；ordinary 在 exclusivePending 分支拒绝时还可能保留提前写入的占位。这些都是同一个调用所有权问题，不新增计数。
- 边界：局部真实类复现；SDK 的流处理允许并行执行工具并继续接收调用。尚未用真实模型制造该输出顺序。
- 生产后果的条件：coordinator 回调成功与 processor 完成持久 Tool Part 是不同边界；只有成功 B 与后续 C 的真实 receipts 都落库，reducer 才得到混合决策。复现仅证明准入错误，持久链后果由生产接线推导。按真实 no_action 的 `turn_control_exclusive` 与 immediate-park metadata 重跑后仍被错误接纳。

### S5 / P2 — 当前租约查询为历史列表执行相关反连接

- 证据：`src/engine/control-lease.ts:24-68` 的单 target 查询复用批量查询，外层枚举历史 lease，逐行用 `NOT EXISTS later` 排除旧行，最后 `.all()`；Automation projection、claim、assert、renew、release 都使用这个当前查询。
- 实证：使用对应三个真实索引与同义 SQL 的独立内存 SQLite，对一个 target 的 100 / 1000 / 3000 条历史只返回一条赢家，却需要 42,663 / 4,026,013 / 36,078,013 个虚拟机步骤；相同排序的 `ORDER BY time_activated DESC,id DESC LIMIT 1` 返回相同赢家，步骤为 31 / 23 / 23。仅为查询微型实验，不能当成真实数据库吞吐量测量。
- 根因：把一个当前赢家查询泛化成所有历史候选的相互比较；现有索引虽用于定位 target，却没有使相关子查询的 OR 比较成为有效范围 seek。
- 旧路径未根治：页长限制最多限制 target 数量，不能限制一个 target 的历史长度。追加不可变历史是必要的，当前投影每次重复扫描全部历史不是必要的。
- 最小收敛：使用现有复合排序索引直接查询每个 target 的赢家；批量入口也应对固定 target 集合做有界 seek。保留当前事务和精确租约 fence，不另建 mutable current 表。
- 相邻线索：`task-lifecycle.ts:20-59` 当前态全 epoch 读取和启动全 Task 遍历仍有线性成本；这里只记录覆盖，尚无独立负载实验，不另计根因或生产性能问题。
- 另一个当前历史读取实例：`automation-service.ts:2777-2807` 的 failure writer 先读全部 definition revision、全部历史 runs，再逐条投影和筛选；调用已持有 exact pending Fire 身份。建议改为 exact Fire 的 runs/receipts 查询。本项只证明历史读取成本，不声称已错写其他 Fire。
- 主 agent 在 Bun SQLite 3.53.0 独立重跑相同实验：100/1000/3000 条历史约为 0.46/35.32/328.71ms；直接 seek 约 0.15/0.06/0.04ms，均返回相同赢家。单次时间包含准备/执行开销，步骤数和查询计划证据优先于耗时。

### S6 / P2（结构债务）— Event 已有持久队列，却按每个待执行 Fire 建第二条内存等待链

- 证据：`src/scheduler/event-service.ts:551-555` 每个 accepted pending fire 立即 enqueue；`755-790` 在等待同 job 前序和物理 permit 之前创建 `RuntimeExecutionSettlement.reserve`，并向 `running` 与 `jobTails` 注册 Promise 链。`727-750` 的恢复则按 definition head 发现，体现真实调度单位其实是 definition 当前头项。
- 触发：同一 Event job 连续收到 N 个独立事件，头项缓慢时，后续 N 条 Fire 已有 durable queue_position，却仍各持有进程内 Promise/closure/reservation。多个 definition 的恢复也会在一次同步遍历中全部进入内存排队。
- 根因：待执行事实被过早提升为物理执行所有者；permit 只限制开始执行数，没有限制等待链长度。
- 旧路径未根治：有界 SQL 页和有界执行容量都没有约束总 pending admission。无需用更多状态跟踪修复双重排队。
- 最小收敛：每个当前 head/definition 保留可合并的提示，持久队列保留原顺序；仅给有界获准的执行建立物理 reservation，完成后从事实读取后继。
- 边界：代码可证 N 条注册随 accepted fire 增长；未测实际堆内存、延迟或退出耗时，不声称已发生内存耗尽。

### S7 / P2 — Event 对已删除目标没有吸收终态

- 证据：`src/scheduler/event-service.ts:1176` 的 Session.get 遇到持久删除返回 NotFound，`:944` 进入 `scheduleRetry`，`:1389-1421` 只追加无次数终点的 `retry_wait`。`event.sql.ts:140-162` 的 disposition 有 causal_cycle/cooldown/job_disabled/mission_closed，没有 target_deleted；`event-projection.ts:154-172` 只有非 retry 终态推进 head。
- 触发：已有 Event definition 或 pending Fire 的目标 Session 已有 canonical `session.deleted` tombstone，且 Fire 尚无可恢复 wake Message，此时明确走 scheduleRetry。已有 reconciledMessageID 则在恢复 wake 分支再次 Session.get，失败落入 settlementError；本项不把这些出口一概称为同一个 scheduleRetry。也不把暂时缺失、跨 Project 路径故障或所有 NotFound 都视为永久删除。
- 根因：永久业务事实不可执行仍被归入瞬态基础设施重试，重试循环没有能改变目标删除事实的步骤。
- 旧路径未根治：Mission closed 已有明确 disposition，但该边界未覆盖普通 Session 删除。Automation 在 `automation-service.ts:2354-2363` 有同义 target_deleted 分支，Event 没有横向对齐。
- 最小收敛：从 canonical tombstone 证明目标删除后，为 exact Fire 写一个明确吸收 disposition，释放 head；仍保留 transient fault 的重试契约，不吞全部 NotFound。
- 边界：Session.get 相关代码存在于 HEAD，不依赖共享工作区 Session 格式修改。当前为完整静态控制链证据，未对用户 Session 执行删除实验。

### S8 / P2 — 自定义时区映射改变了 recurrence 的有效集合

- 证据：`src/scheduler/recurrence.ts:45-60,77-101` 剥离 TZID（Time Zone Identifier，时区标识）后在浮动墙钟时间生成，再经 Luxon 映射真实时刻。夏令时跳过的不存在时间被归一化成另一个时间，而不是从 recurrence 集合删除。
- 实证：`DTSTART;TZID=America/New_York:20260307T023000` / `RRULE:FREQ=DAILY;COUNT=3`，after 为 `2026-03-07T08:00:00Z`，真实 helper 返回 `2026-03-08T07:30:00Z`，即本地 03:30；原规则要求 02:30。
- 契约：[RFC 5545 §3.3.10](https://www.rfc-editor.org/rfc/rfc5545#section-3.3.10) 规定 recurrence 生成的无效日期/不存在本地时间应忽略且不计入次数。不能用 §3.3.5 对单个 DATE-TIME 的解释代替 recurrence 集合规则。
- 根因/旧路径：为消除宿主时区漂移引入手动转换，却未保持有效 occurrence 与 COUNT 的语义。它与 S3 不同：S8 是时间集合选择错误，S3 是合法结束缺少结果分支。
- 最小收敛：选择一个明确满足命名时区 recurrence 契约的实现/转换入口，并以夏令时跳跃、次数、截止、宿主时区变化验证。不能用另一份定时状态或简单偏移补丁修补。
- 边界：真实 helper 与标准对照已验证；未执行真实定时任务，也未泛化为所有时区错误。

### S9 / P2（公共契约）— 暂停任务的手动运行承诺与 active-only 准入矛盾

- 证据：`src/tool/schedule.ts:64` 说明 run 立即执行并保持 active/paused 状态；`src/server/routes/global.ts:282` 是公开 API 入口，`tool/schedule.ts:193` 是 Tool 入口。`automation-service.ts:1007-1014,1356-1359` 的 API 路径因 paused 被 claim 拒绝，却返回 already running；Tool 路径 `:955` 到 `automation-fire-frontier.ts:44`，在 active-only 断言被拒绝。
- 根因：定时发现是否启用，与一次显式手动执行能否接纳，被同一个 active-only frontier 前置条件捆绑；工具说明又承诺一个更宽的运行语义。
- 影响：模型按公开工具语义执行时会得到矛盾错误，两种入口还返回不同原因。未发现明确公开约定裁决暂停时是否允许手动运行，因此本报告确认的是语义与错误契约失配，不替用户裁决最终产品行为。
- 最小收敛：给 timer eligibility 与 manual command 一个一致明确的契约，再同步工具说明、API 错误和准入。若允许手动执行，复用现有 exact Fire/receipt 并保持 paused；若明确禁止，使用真实 paused 错误并删除更宽承诺。不能通过临时自动 resume 再 pause 绕行，更不能新建平行手动调度器。
- 边界：静态生产接线核验，未修改任务状态或运行用户 Automation。

### S10 / P2 — 手动 Fire 的续跑语义被入口参数重新定义

- 证据：`src/scheduler/automation-service.ts:984,1015` 的手动入口执行 `reschedule=false`；同一个持久 Fire 在后台 due 重试入口 `:1323` 被无条件按 `reschedule=true` 执行。正常手动完成在 `:2004-2012` 恢复原 scheduled frontier；后台成功在 `:1974-2003` 或全目标已终态分支 `:1839-1860` 则按当前时间计算下一次并发布后继。
- 触发 A：已有 10:00 的 pristine scheduled Fire；09:59 手动 Fire 暂时占据该 definition frontier，失败后 10:01 经后台重试成功。正常手动完成会把原 10:00 Fire 恢复为可执行；恢复入口却计算 10:01 后的 nextRun，跳过原待执行 scheduled Fire。`automation-fire-frontier.ts:144-179` 明确保存并恢复原 pristine Fire，排除了“手动本来就应该重置定时”的解释。
- 触发 B：同一 manual Tool occurrence 再次调用 `runNowFromTool`，`:854-914` 读取同一 Fire，但 `:984,1546` 又把本次 now 当 scheduledDue；`:2116-2143` 严格比对原 Fire due，因本次时间变化返回 changed immutable occurrence。`scheduler/tool-recovery.ts:100-145` 验证原输入 digest 后调用 `executeScheduleToolInput`，也会进入该函数；Fire 已终态时直接返回原投影，未终态且通过 busy/owner 检查并重获租约时可进入 fresh-now 分支。不能把全部未终态恢复都说成只读投影，也不声称所有重放必然通过准入。
- 根因：origin 与 due 已是不可变事实，执行代码仍用入口的 boolean 与本次时钟派生身份/后继策略。正常路径、后台恢复与同 Tool 重入因此不保持同一执行语义。失败收敛 `:2711-2718` 反而读取 fire.origin 区分 restore，说明不需要新增持久字段。
- 最小收敛：执行 exact Fire 时只读取其持久 origin/due；入口负责接受新轮次，不能重新解释已接受轮次。删除平行 `reschedule` 身份推导，以同一事实决定 successor/restore；保留既有 Fire/attempt/receipt。
- 边界：完整静态调用链和事务核验，未注入服务崩溃或执行真实手动任务。与 S9 不同：S9 是 paused 准入/公开说明；S10 在 active definition 下也会发生，是重入 provenance 漂移。

### D1 / P2（架构文档）— 两份当前权威仍指导两种生命周期

- `specs/current/architecture/03-control.md:108-141` 要求 retryTask/replanTask、operator retry/replan intent；`:257-264` 把最近 task.updated 后的 terminal 与 Task row status/time_completed/error 一致当作权威。
- `task-control-plane.md:55-79` 明确按 execution epoch 和 protocol lifecycle 归约，普通 operator Message 可打开下一轮且没有独立 retry/replan；当前 `engine/engine.sql.ts:136-146` 没有那些 Task 状态字段，`task-lifecycle.ts:20-79,150-167` 从生命周期事实归约。
- 当前 architecture README 将两份文档都列为 current authority。全仓生产源码搜索没有 retryTask/replanTask 定义或调用。旧 C1 的“TaskQueueService 文档引用已清掉”不等于其他生命周期表述也已对齐。
- 影响：维护者若按旧章继续修调度，会重造被删除的 intent/状态权威和恢复同步机制。这里是已证文档矛盾，不声称旧 API 仍在运行。
- 最小收敛：03-control 只保留输入路由与职责概述，生命周期细节链接到 task-control-plane 单一权威，并删除旧 row/retry/replan 教程。本次只记录建议，不改架构契约。

## 已排除与应保留的复杂度

- Task/Mission/Session 分层、Automation/Event 的来源分离、write-ahead request/outcome、执行 epoch、exact lineage、围栏租约、Project owner 与重启恢复不是因为文件多就应删除的机制。
- 四种不可变 Agent Coordination 事实不是四套当前状态；当前 reducer 已收敛，旧 mutable request/action 问题不重报。
- Tool choice/filter 旧 B1 与 synthetic dispatch collection 旧 A1 已修复，不列当前问题。
- dispatch_agents 的 8 项载荷上限与大于 8 的执行预算未证明逻辑矛盾：物理预算不是单次工具必须派发同样数量的承诺。LLM 可合理分组，schema 可见边界。累计检查点成本有上限，不夸为无界问题。
- Task priority 在 `engine/model.ts:187-189` 明确是展示元数据，不当作调度优先级失效。
- 没有用户数据库、实际并发负载或真实 Provider 证据时，不断言事故频率、模型质量、跨项目数据泄露或重复外部效果。

## 迭代记录

1. 第一轮三条独立线拆解；主 agent 回到定义/调用点/当前架构核验。旧问题按当前实现排除；S1 多入口合并，S2 多个 pacing 表现合并，S3/S4 与 D1 首先成立。
2. 第二轮交换候选反证并扩展相邻入口：补充 S5 租约查询成本、S6 Event 等待链、S7 永久删除重试；S8 在 recurrence 时区与有限集合语义交叉检查中新增。O2（8 项上限）经反证移出问题台账。此时尚未饱和，继续全范围复查。
3. 第三轮基于完整 S1-S8/D1 清单复查。编排与生命周期线零新增独立根因；调度线新增 S9 手动运行契约矛盾，并补充 S5 failure writer 历史读取实例。新增 S9 后尚未宣布饱和，继续第四轮全范围交叉审查。
4. 第四轮以 S9 为新输入。调度与编排线零新增；生命周期线顺着 manual/recovery 发现 S10。主 agent 回查 immutable Fire、pristine restore 与 success/failure 分支后确认，继续第五轮。全新交付 reviewer 同期开始证据校对，纠正 S3 抛错事务位置和 S4 reducer 行号；这些是报告修正，不计新算法根因。
5. 第五轮三条审查线均以完整 S1-S10/D1 为输入重新反证：queue_audit、orchestration_audit、lifecycle_audit 各自新增独立根因 0、撤销误报 0；S10 通用 Tool recovery 的非终态再入链得到澄清，属于同根证据加强。满足本次“一整轮全审查面零新增”的静态饱和条件。
6. 全新 delivery_review 未参与分析或报告写作，完成两轮交付审查；第一轮提出的有效报告问题全部修正，第二轮内容审查通过，剩余有效发现 0。reviewer 独立重跑真实 exclusive/immediate-park 的 S4，仍得到错误接纳结果。它未宣称生产修复或端到端验收通过。

结论：本次完成五轮、三条独立审查线的迭代与额外全新交付复核，清单固定为 11 项。本次饱和只表示在覆盖范围和证据预算内没有再找到新根因，不等于形式化证明没有其他问题；所有列出的实现问题仍待后续修复。

## 验证与交付进度

- `bun run check:control-state-redundancy`：通过，53 张表、7 类事实分类。
- `bun run check:control-lease-owners`：通过，18 个 owner、22 个 acquire 位置已声明。
- 两项检查只是当前清单/结构规则证据；通过并未反证 S1-S8 的实际语义问题。
- 真实类/helper 的纯内存复现和等价 SQL 微型实验用于证明局部契约，不称端到端验证；完整调度运行链、真实模型和用户负载未执行。
- 主 agent 独立执行附录脚本重现 S2、S3、S4、S8 的相同结果；`bun run docs:check` 通过（339 operations、25 groups）。
- 交付 reviewer 完成两轮全新只读审查：第一轮要求修正 S3 事务位置、S4 exclusive 与持久边界、S7 分支限定、S10 行号并补覆盖矩阵。主 agent 均已核验修正；最终内容审查通过，剩余有效发现 0。
- `bun run check:architecture-index`：通过，16 份当前架构文档已索引，全部链接有效。审计文档与索引差异检查通过。
- 并行任务正在修改 Dynamic manifests/generated、测试、版本/lock/CHANGELOG 与索引里的 release 条目，均排除本次提交。一次文档检查观察到生成 API 文档的临时排版差异，后续读取恢复为 HEAD 原内容，重跑 `docs:check` 已通过；本任务没有覆盖或接管那些文件。
- Git 交付范围固定为本报告与两个索引中的审计入口，其他共享工作区改动均排除。提交/推送发生于报告内容冻结之后，其实际结果以 Git 历史与本轮最终交付消息为准；本记录不预先声称推送通过。

## 局部复现命令

以下脚本只导入生产算法并使用内存时钟/回调，不启动服务、不访问用户数据库、不调用 Provider。工作目录为仓库 `packages/opencorvus`。S4 的 callback-success 仅表示回调完成，不代表真实 dispatch 已落库。

```powershell
$auditCode = @'
import { TaskControlDriver } from './src/engine/task-control-driver.ts';
import { ToolTurnExecutionCoordinator } from './src/tool/execution-mode.ts';
import { withImmediateParkToolResultControl } from './src/session/tool-result-control.ts';
import { Recurrence } from './src/scheduler/recurrence.ts';
let scans=0;
const d=new TaskControlDriver({scan:async()=>{scans++;return {activated:0,wakeAt:25,noProgress:true}},now:()=>0,setTimer:()=>({cancel(){}})});
await d.request('audit');console.log(JSON.stringify({case:'S2',scans,snapshot:d.snapshot()}));d.dispose();
const c=new ToolTurnExecutionCoordinator();let rejectFirst;
const first=c.run('ordinary',()=>new Promise((_,reject)=>{rejectFirst=reject}),{command:'dispatch_agent',commits:true}).catch(e=>e.message);
const second=await c.run('ordinary',async()=>'callback-success',{command:'dispatch_agent',commits:true});rejectFirst(Error('first failed'));await first;
const claim=c.committedDecision??null;const mixed=await c.run('turn_control_exclusive',async()=>({output:'admitted',metadata:withImmediateParkToolResultControl({})}),{command:'no_action',commits:true});console.log(JSON.stringify({case:'S4',second,claim,mixed}));
for(const suffix of ['COUNT=1','UNTIL=20300101T000000Z']){const rule='DTSTART:20300101T000000Z\nRRULE:FREQ=DAILY;'+suffix;const first=Recurrence.nextRun(rule,Date.parse('2029-12-31T00:00:00Z'));try{Recurrence.nextRun(rule,first+1)}catch(e){console.log(JSON.stringify({case:'S3',suffix,first,error:e.name,data:e.data}))}}
const rule='DTSTART;TZID=America/New_York:20260307T023000\nRRULE:FREQ=DAILY;COUNT=3';console.log(JSON.stringify({case:'S8',next:new Date(Recurrence.nextRun(rule,Date.parse('2026-03-07T08:00:00Z'))).toISOString()}));
'@
bun -e $auditCode
```

主 agent 复现输出摘要：S2 `wakeAt=25,failures=1`；S4 `claim=null,mixed.output=admitted` 并包含真实 immediate_park 控制 metadata；S3 两个规则均首个时间 `1893456000000` 后抛 `InvalidAutomationRecurrenceError`；S8 返回 `2026-03-08T07:30:00.000Z`。

S5 的等价查询微型实验在内存 SQLite 中建立与源表对应的索引，不复制运行数据：

```powershell
$auditSQL = @'
import { Database } from 'bun:sqlite';
const db=new Database(':memory:');
db.exec('CREATE TABLE engine_control_activation_lease(id TEXT PRIMARY KEY,target TEXT NOT NULL,target_id TEXT NOT NULL,owner_occurrence_id TEXT NOT NULL,time_activated INTEGER NOT NULL,expires_at INTEGER NOT NULL); CREATE INDEX engine_control_activation_owner_idx ON engine_control_activation_lease(target,target_id,owner_occurrence_id); CREATE INDEX engine_control_activation_target_idx ON engine_control_activation_lease(target,target_id,time_activated,id); CREATE INDEX engine_control_activation_expiry_idx ON engine_control_activation_lease(expires_at);');
const sql='SELECT * FROM engine_control_activation_lease AS lease WHERE lease.target=? AND lease.target_id IN (?) AND NOT EXISTS (SELECT 1 FROM engine_control_activation_lease AS later WHERE later.target=lease.target AND later.target_id=lease.target_id AND (later.time_activated>lease.time_activated OR (later.time_activated=lease.time_activated AND later.id>lease.id))) ORDER BY lease.target_id,lease.time_activated DESC,lease.id DESC';
const seek='SELECT * FROM engine_control_activation_lease WHERE target=? AND target_id=? ORDER BY time_activated DESC,id DESC LIMIT 1';
console.log(JSON.stringify({sqlite:db.query('select sqlite_version() as version').get(),plan:db.query('EXPLAIN QUERY PLAN '+sql).all('automation','same')}));
for(const n of [100,1000,3000]){db.exec('DELETE FROM engine_control_activation_lease');const ins=db.prepare('INSERT INTO engine_control_activation_lease VALUES (?,?,?,?,?,?)');db.transaction(()=>{for(let i=0;i<n;i++)ins.run(String(i).padStart(8,'0'),'automation','same','owner'+i,i,i+1)})();const start=performance.now();const rows=db.query(sql).all('automation','same');const scanMS=performance.now()-start;const second=performance.now();const winner=db.query(seek).get('automation','same');console.log(JSON.stringify({n,scanMS,seekMS:performance.now()-second,count:rows.length,sameWinner:rows[0].id===winner.id}));}db.close();
'@
bun -e $auditSQL
```

## 后续修复的验收边界

建议先处理 S4 的决策所有权、S3/S7 的正常/永久终态，再处理 S1/S2 的共享发现与退避；随后以现有索引和 head 机制收敛 S5/S6。S8 应先锁定时区契约，S9 应先明确公共语义，D1 与相应实现文档一起去除重复权威。这是最小变更顺序建议，本次没有实施修复。

| 项目 | 修复后必须进入的真实路径 |
| --- | --- |
| S1 | 隔离多页、多 Project 输入，一个慢项与多个快项，证明快项结束后下一页立即取得空槽，取消与 shutdown 保持 owner 完整 |
| S2 | 真正 driver/heartbeat/recovery 接线下的持久失败与 no-progress；观察重试间隔，也验证新事实和取消的及时性 |
| S3/S8 | finite COUNT/UNTIL、夏令时 gap/fold、宿主时区变化；真实 Fire terminal receipts、无后继、重启仍收敛 |
| S4 | 原生流式 SessionLoop 中错峰 A/B/C Tool 调用，观察真实 Part、decision、ingress 结果以及各失败出口 |
| S5 | 原生产查询/事务、多个 target/同时间身份排序/保留历史规模，比较赢家与查询计划；exact Fire 失败结算只消费其自身 runs |
| S6 | Event 接收与重启两入口的长 backlog，观察有界 pending reservation 和正确 FIFO，不只测 permit.active |
| S7 | 隔离数据库明确 tombstone 与 transient miss 两种情况，验证 exact Fire disposition、head 推进、重启一致 |
| S10 | 相同 manual Fire 的正常完成、后台失败重试、重启与同 Tool occurrence 再入；跨原 scheduled due 后仍恢复相同 pristine Fire，不由新 now 改写身份 |
| S9/D1 | API、Tool 与当前架构/错误契约同时校对；如果产品选择支持 paused manual，证明精确手动轮次后状态仍 paused |

这张表是后续修复所需证据，不代表本次分析已经完成这些端到端验收。
