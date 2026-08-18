# 状态审计扫荡（Host 拨乱反正 Phase 6）

> 校准说明：本清单服从正式计划 [`2026-08-17-minimal-host-reform-plan-calibration.md`](../specs/records/2026-08/2026-08-17-minimal-host-reform-plan-calibration.md)；[host-reform-plan.md](host-reform-plan.md) 仅展开设计理由。删除 Task 级吸收态不授权 Host 在冲突事实中任意选赢家。尚未越过外部边界的 Host fault 在 exact operation/occurrence 一次持久结算；可能已经执行的 effect 则由既有 durable request 与缺失 outcome 唯一投影 reconciliation_required，不另写状态。无关工作继续，只有真实因果依赖可以等待权威 outcome。

> 状态：**首轮完成**（engine + orchestrator 全量；mission/session 状态机留待下一轮）。
> 生成：2026-08-17。上游：正式计划的 State/gate sweep；说明稿 [host-reform-plan.md](host-reform-plan.md) Phase 6。校准后的六条宪法为裁决依据。
> 方法：对每个状态 enum / status union / gate 问四问——**①哪个真实参与者或进程外事实产生它？②它保护哪个不可逆 effect 或用户权限边界？③哪个普通用户动作或真实外部事件能离开它？④它属于哪个 exact occurrence？** 无事实且无真实边界、无出口，或错误冻结整个 Task/Project 的机制删除。当前工作树命令 `rg -o "isTaskTerminal|deriveTaskStatus" packages/opencorvus/src -g "*.ts"` 实测 **82 个匹配/20 个文件**；附录 B 按同一口径记录这些匹配，逐处判「展示投影 / 原始事实校验 / 捏造闸门」。
> 本文档是**删除清单**：编号 + 优先级 + 勾选框，格式对齐 [code-smell-report.md](code-smell-report.md)。审计基于 2026-08-17 主检出（含未提交工作区变更）的行号。

## 总判

engine 的状态面比预想干净：绝大多数 status 是协议事件的纯投影，符合“事实只有一处”；Interaction / 协调请求 / build-observation cleanup 都是「事实推导 + 有出口」的合法状态。真正的捏造状态集中在**两处**：

1. **`blocked/integrity_conflict`**——计划点名的头号吸收态，实锤：它吸收整条任务 FIFO，普通用户消息排在它身后永远不被激活，唯二出口是 Retry（epoch 碰撞）和手工修数据库；而它的「事实推导」全部来自 host 对自己 bug 的执法谓词。它同时违反“事实投影不是独立授权”“Host fault 局部结算”和“继续工作产生新 occurrence”。
2. **`closing`/`close_requested` 家族**——死机器。`task.close.requested` / `task.closed` 在全仓**没有任何生产者**（只有读取方、迁移白名单和 overlay 事件策略），reducer、task-status、scan 三处各带一条永远走不到的分支，scan 注释自己承认「本 runtime 不存在 closing 的 converger」。更糟：若历史库真有一条 close_requested，该任务连 cancel 都做不到——第二条 boundary request 会让生命周期投影直接 throw。

当前 82 个匹配的逐文件清点见附录 B。旧版 `68 + 9 + 6 + 5` 分类和“84 处”不是同一计数口径，已撤销；实施每个删除切片时按 exact 调用点重新记录保留/删除数量，不能把本说明稿当成已验证源码交付。

## 优先级建议

- **P0（下一迭代内）**：STA-01。它就是事故类 #8（吸收态）的现行犯，且当前唯一出口 Retry 正是记忆里多次反馈「模型本身是错的」的那个面。**已于 2026-08-17 落地。**
- **P1**：STA-02/03 与 STA-01 同根（对自己执法），可同一分支处理；STA-04 依赖 STA-01 落地后收口；STA-05/06 是独立小删。**当前状态：STA-02 ✅、STA-06 ✅、STA-03 ◐（两处删除、两处保留并说明）；STA-04 已解锁——Retry 曾是 blocked 的唯一出口，现已无需要它的状态。**
- **P2**：语义再表达与词表收敛，穿插进行。

---

## P0

### STA-01 `blocked/integrity_conflict`：吸收整条 FIFO 的自我执法投影 ✅

- **位置**：[engine/task-root-ingress-reducer.ts:93](../packages/opencorvus/src/engine/task-root-ingress-reducer.ts)（状态定义）、:297（`conflict()` 先于一切判定）、:366（同 ingress 两条未决 Interaction 也判 blocked）；[engine/task-root-ingress-delivery.ts:1119](../packages/opencorvus/src/engine/task-root-ingress-delivery.ts)（注释自述「`blocked` holds the whole FIFO」）、:1578（scan 遇 blocked 即 `stopTask` 返回，后续 ingress 永不激活）；[engine/task-root-ingress-integrity.ts](../packages/opencorvus/src/engine/task-root-ingress-integrity.ts)（读侧 `TaskRootIngressIntegrityError` → blocked）。
- **四问审判**：
  - ①普通用户动作出口：**无**。新操作者消息被接受为新 ingress，但按 epoch+sequence 排在 blocked 之后，scan 到头即停——发消息不解锁。surfaced gate 给出的出口是「Retry 任务以碰撞 epoch」或「修复它点名的冲突证据」：前者不是普通动作（且是待废除的 Retry 模型），后者是开发者拿 SQL 控制台。活跃任务（无 terminal 事件可 Retry）一旦 blocked 是纯死锁。
  - ②持久事实推导：形式上有——但看 `conflict()` 的每一条臂：policy ID 漂移、同 (epoch,kind) 重复生命周期行、同 epoch 双 terminal、无效 decision 集、单 request 多 outcome、turn 无对应 lease。**全部是 host 自身写入不变量的破坏检测**，没有一条对应用户可理解的业务事实。它把本应局部结算的 Host fault 变成了永久停摆的用户投影值。
- **违宪**：违反“事实投影不是独立授权”“Host fault 局部结算”和“继续工作产生新 occurrence”；status 被 scan 当闸门，扣住全部后续执行。
- **删除方向**：`blocked` 作为 Task/FIFO 驻留状态整体删除，并逐臂分类。尚未产生外部 request 的 Host 不变量错误收敛成 exact operation/occurrence 的 **durable Host fault settlement + 日志 + 计数**，持久结算后释放不相关 FIFO。外部 effect 执行前必须已有 durable request；若 outcome 缺失，该 request/outcome 缺口唯一投影 `reconciliation_required`，不另写 unknown 状态，只有真实因果依赖等待至多一个权威 exact outcome。不影响外部副作用的重复观察只有在 identity 与 payload 都相同时才能折叠；可能改变 effect、Interaction 对象或业务决定的歧义必须 fail closed，禁止按最早时间或最小 ID 猜赢家。只有显式用户/操作者输入可建立新 occurrence；有歧义的 effect identity 永不复用。
- **测试痕迹**：`classifyTaskRootIngressWake` 的 `operator_gated/infrastructure_fact` 类、`surfaceOperatorGatedTaskRootIngress` 的 blocked 文案、[orchestrator/agent.ts:245-303](../packages/opencorvus/src/orchestrator/agent.ts) 两处「integrity conflict 不终态化任务」的特判随之简化。
- **已落地（2026-08-17）**：见 [`2026-08-17-task-root-host-fault-releases-head-of-line.md`](../specs/records/2026-08/2026-08-17-task-root-host-fault-releases-head-of-line.md)。三点比审计原判更精确：
  1. **真正吸收 FIFO 的闸门不在 scan，而在 `acquireTaskRootIngressLease` 事务里**——它重算每个前序 ingress，只放行 `resolved/terminal_inapplicable/exhausted`。只改 scan 无效（探针实测：scan 已走到后继 ingress 且投影为 `ready`，acquire 仍返回 false）。现收敛为单一谓词 `taskRootIngressReleasesHeadOfLine`，durable 闸门与 scan 共用一个定义。
  2. **放行是安全的**，因为 `readTaskRootIngressEvidence` 以本 ingress 的 activation lease 为起点，脏证据不会被后继 ingress 继承；且归约在任何 decision 被读成决定之前就返回 fault，所以放行只放弃一个 ingress，不会在违规下执行副作用。
  3. **`conflict()` 六臂里有两臂在复述数据库保证**（同 (epoch,kind) 重复行、同 epoch 双 terminal）——`protocol_event` 的三条 partial unique index 已使其不可能，故删除而非改造；STA-03 的四处 throw 里同样的两处（双 terminal、双 request）同批删除。
     剩余四臂各自命名（`policy_drift` / `decision_ambiguous` / `outcome_ambiguous` / `turn_without_activation`），加 `evidence_violation` 与 `interaction_ambiguous`，投影为 `host_fault` 并**不 memoize**（可被后续 append 修复）。反证探针：把 `host_fault` 从放行谓词里去掉，新测试立即复现 wedge。

---

## P1

### STA-02 `closing`/`close_requested` 家族：无生产者的死状态机 ✅

- **位置**：[engine/task-lifecycle.ts:6-7](../packages/opencorvus/src/engine/task-lifecycle.ts)（`task.closed` / `task.close.requested` 事件类型）、:96（`closing` 投影臂）；[engine/task-status.ts:20,45,52](../packages/opencorvus/src/engine/task-status.ts)（`"closing"` 词表成员）；[engine/task-root-ingress-reducer.ts:19,101,349-352](../packages/opencorvus/src/engine/task-root-ingress-reducer.ts)（`close_requested` fact kind 与 `closing` 投影臂）;[engine/task-root-ingress-delivery.ts:1489-1497](../packages/opencorvus/src/engine/task-root-ingress-delivery.ts)（scan 对 closing 承认「No converger exists for this boundary in this runtime」，只能 surface + 15s 轮询到永远）、:1164。
- **证据**：全仓（含 sibling 包）`grep` 无任何 `task.close.requested` 或 `task.closed` 的 append 调用；仅存读取方、[storage/fact-kernel-migration.ts:876-877](../packages/opencorvus/src/storage/fact-kernel-migration.ts) 迁移白名单、overlay 事件策略。`task.completed/failed` 在 [engine/task-root-fact-store.ts:261](../packages/opencorvus/src/engine/task-root-fact-store.ts) 被映射为 fact kind `"closed"`——所以 `closed` 这个 kind 是活的（别名），死的是 `close_requested` 与两个 `closing` 投影臂。
- **四问审判**：无当前生产者、无独立不可逆边界、无普通出口，也没有可归属的活 occurrence。若历史库存在一条 `task.close.requested`，用户连 cancel 都不行：第二条 boundary request 让 [task-lifecycle.ts:89](../packages/opencorvus/src/engine/task-lifecycle.ts) 直接 throw「conflicting lifecycle requests」，投影读路径整体炸掉。**四问皆不能给出合法所有者 = 教科书式捏造状态。**
- **删除方向**：从活代码删除 `closing` 全部分支（task-lifecycle 投影臂、task-status 词表、reducer 臂、scan 特判、`surfaceUnconvergedTaskBoundary` 的 closing 面），不保留兼容 reader、双读或旧状态别名执行路径。
- **已落地（2026-08-17）**：见 [`2026-08-17-retired-task-close-lifecycle-vocabulary.md`](../specs/records/2026-08/2026-08-17-retired-task-close-lifecycle-vocabulary.md)。补充证据：`git log -S` 与逐 revision `git grep` 证明两个类型在**任何**历史版本都没有 append 点（随 `627146cc` 的 reader 一起进来，从未有生产者），迁移自身的 legacy 生命周期合成也只写 `task.{cancelled,failed,completed}`——所以不存在可分类的历史行，原方向要求的"原子迁移"没有对象。两条 partial unique index 谓词同批收窄；**按用户决定不写数据迁移**，既有数据库走现成的 schema-drift 重置路径（beta 期重置比新增第二套升级机制便宜）。当前架构契约 `specs/current/architecture/task-control-plane.md` 同批收敛。

### STA-03 生命周期投影对脏事实 throw：执法对自己 ◐

- **位置**：[engine/task-lifecycle.ts:14](../packages/opencorvus/src/engine/task-lifecycle.ts)（epoch 缺失 throw）、:61（无 open 事实 throw）、:66（同 epoch 双 terminal throw）、:89（双 request throw）。
- **判定**：这不是状态而是状态的执法臂，但与 STA-01 同根：ingress reducer 把同类分歧归 `blocked`（错在吸收），这里更糟——直接 throw，让该任务**所有**投影读路径（store 投影、看板、task-api）全部炸掉，等同 memory 里两次「recovery brick」的形状。“Host fault 局部结算”要求把故障收缩到 exact occurrence；它不授权按最早时间猜一个 terminal 事实继续副作用。
- **删除方向**：四处 throw 不再逃逸到项目/Task 级重试，但也不以“保守取值”猜业务事实。与 STA-01 同批收敛为 exact occurrence Host fault：纯重复观察按同一幂等身份折叠；双 terminal、双 request 或缺少 open 等语义歧义使该 occurrence fail closed、一次结算并释放无关工作。
- **部分落地（2026-08-17，随 STA-01 同批）**：:66（同 epoch 双 terminal）与 :89（双 request）两处 throw **删除**——`protocol_event_task_epoch_terminal_idx` 与 `_boundary_request_idx` 已使这两种行在库层不可写入，投影再复述一遍只是在全产品共用的读路径上多挂一个抛点（正是「一行不可能的数据打掉该 Task 所有视图」的来源）。剩余两处（:14 缺 `execution_epoch`、:61 无 open 事实）**保留**：它们不是闸门而是「投影无值可返」——没有 open 事实就没有 epoch，返回任何状态都是发明状态。若要进一步收敛，须先给 Task 建立「投影不可计算」的表达方式，属独立切片。

### STA-04 Retry intent 面：blocked 的唯一出口，也是待废除的模型 ✅

- **位置**：[orchestrator/event.ts:14](../packages/opencorvus/src/orchestrator/event.ts)（`kind: retry`；`replan` 当前仅作历史读取）；[engine/task-intent-open.ts:29-41](../packages/opencorvus/src/engine/task-intent-open.ts)；[task-api/index.ts:3515](../packages/opencorvus/src/task-api/index.ts)（`TaskControlIntentLifecycleConflictError`：retry 只收 terminal 任务——投影闸门）;[workbench/board.ts:567](../packages/opencorvus/src/workbench/board.ts)（`canRetry` UI 推导）。
- **判定**：memory 与计划一致判定「显式用户/操作者消息应开启新 occurrence，Retry/Replan 专用模型本身是错的」。当前未提交工作树在 [task-api/index.ts:3574-3583](../packages/opencorvus/src/task-api/index.ts) 出现 reopen-on-message 过渡切片，但尚不是已交付证据。Retry 作为并行的第二套恢复入口是冗余模型。**删除顺序受限**：当前 Retry 的 epoch 碰撞仍是 blocked 任务唯一的用户侧解法，必须在 STA-01 落地（blocked 消失）之后收口，否则删掉的是最后一把钥匙。
- **删除方向**：STA-01 之后，恢复入口收敛为「消息开启新 occurrence」单一出口；`retry` intent、其准入闸门（:3515）与 `canRetry` 推导一并删除。历史 `retry/replan` 通过一次原子迁移归一为当前 occurrence/fact 契约，迁移后删除兼容 schema/reader，不留第二入口。
- **已落地（2026-08-18）**：见 [`2026-08-18-operator-message-is-the-only-resume.md`](../specs/records/2026-08/2026-08-18-operator-message-is-the-only-resume.md)。三个只读子 agent 调查后**推翻了「为 cancelled 保留 Retry」的初始方案**：
  1. 全仓 `.md` **没有任何文档**说 cancelled 靠 Retry 恢复，该说法只存在于一句源码注释；而受权威约束的 `specs/current/architecture/task-control-plane.md` 把取消定义为 **epoch 级**（`terminal_inapplicable` 针对「a cancelled, closed, or superseded epoch」，`reopened(epoch+1)` 无 cancelled 例外），永久 reopen 栅栏只挂在 `task.deleted` 上。`docs/` 说明稿把 cancelled/deleted 绑成一类，与被跟踪契约冲突，按校准以 specs 为准。
  2. `host-design-critique.md` 自己的规则：「每引入一个状态，必须同时交付离开它的普通用户动作」，并点名 Retry/Replan 专用词汇就是缺陷本身。附录 B 把 cancelled 排除钦定为规则、STA-04 又要求删净 Retry，两者并存则 cancelled 无任何出口——审计内部矛盾。
  3. 市场调研：Claude Code / Cursor / Devin / Codex **无一** 区分「用户自己 stop」与「自然结束」，都是发消息即续；Devin 反向演进为 sleep/wake 永远可恢复；Cursor 的显式 Resume 只针对系统级停止（工具调用上限、断连）。
     另外查出两处实际缺陷：`requireTask` 不拦 deleted，所以旧实现**已经**会给已删除任务加 epoch（栅栏挂错了边界，现改为直接检查 `task.deleted`）；`retirePendingTaskRootIngressesForOperatorIntentInTransaction` **根本不写任何东西**（纯读，fixture 还丢弃返回值），即 fixture 那次调用一直是空操作。`taskIntent` 的 supersession 记账也因 Phase 1「prompt 即完整 transcript」而冗余。

### STA-05 Scheduler 消息 authority 闸门：投影拒信 + throw ⬜

- **位置**：[protocol/delivery.ts:83-88](../packages/opencorvus/src/protocol/delivery.ts)（`SchedulerMessageAuthorityError`：调度消息要求 `isTaskActive`）、:741-745（源任务同款）。
- **判定**：`isTaskActive` 是投影，被用作递送执法并 throw，违反“事实投影不是独立授权”。调度唤醒撞上刚结算的任务是正常竞态，不是 authority 违规；throw 进的是调度器的重试路径（Phase 4 治理的重试风暴形状）。注意与 :748-749 的 epoch 游标区分：后者由持久事实推导、做数据一致性锚，合法。
- **删除方向**：删除 `isTaskActive` 投影闸门和 `SchedulerMessageAuthorityError`。调度消息保留其真实 protocol 身份：若目标 occurrence 已失效，追加明确的 stale/superseded delivery receipt；若新 occurrence 仍可接受该消息，则走普通 ingress。禁止静默 drop，也不借 Phase 1 的 prompt 过渡队列掩盖 protocol settlement。

### STA-06 终态任务禁 package tools：第三层执法 ✅

- **位置**：[task-artifact/store.ts:350](../packages/opencorvus/src/task-artifact/store.ts)（`if (isTaskTerminal(task)) throw "Task is terminal and cannot execute package tools"`）。
- **判定**：这是 completed/failed 投影驱动的第三层执法；入口 terminal 准入和 `projectTerminalConversationTools` 也仍是 Phase 2 待删的过渡 gate，不能用两层过渡 gate 证明这一层安全。真正需要保护的是 artifact 版本、ownership、permission 和 exact occurrence effect identity。
- **删除方向**：删除该 terminal status 检查；若 package Tool 有不可逆 effect，改为直接验证 artifact/version、ownership、permission 与当前 occurrence 原始事实。不得降级为“log 后继续”，也不得依赖终态 Tool 表兜底。
- **已落地（2026-08-17）**：见 [`2026-08-17-terminal-package-tool-gate-removal.md`](../specs/records/2026-08/2026-08-17-terminal-package-tool-gate-removal.md)。`assertTaskScope` 保留的是操作系统能在执行中挪动的物理边界（project ownership / project root / task runtime root），Artifact 侧由 version、ownership、publication sequence 和 committed-snapshot 校验负责；新增正向契约测试：带 terminal 事实的延续 occurrence 可发布，而 project root 被挪动仍拒绝。全仓无任何测试断言过这条终态拒绝。

---

## P2

### STA-07 对 completed/failed 任务请求 cancel 即 throw：可幂等化 ⬜

- **位置**：[task-api/index.ts:2757-2763](../packages/opencorvus/src/task-api/index.ts)（`TaskCancellationLifecycleConflictError`）。
- **判定**：occurrence 模型下 completed/failed 是旧执行的历史结算；cancel 一个已结算、无在途执行的 occurrence，抛冲突错误制造了一个调用方必须特判的分支。已带 expected/received，属轻罪。
- **方向**：若没有新活 occurrence，返回明确幂等 no-op；若新消息已经开启新 occurrence，cancel 作用于该当前 occurrence。不要把 cancellation 事实追加到已经结算的旧 occurrence，也不让旧 completed/failed 投影阻止取消真实在途工作。

### STA-08 跨任务 Artifact 导入要求源任务整体 terminal：锚偏粗 ⬜

- **位置**：[engine/cross-task-artifact-import.ts:213-215](../packages/opencorvus/src/engine/cross-task-artifact-import.ts)。
- **判定**：同文件 :232/:293/:340 的 completion-decision + `time_completed` 校验是合法数据版本锚（钦定游标模式）；但 :213 额外要求**整个任务** terminal 才可导入，粗于需要——artifact 版本本身是不可变持久事实。重开源任务（epoch+1）后导入其已结算 artifact 会被此闸拦下。
- **方向**：评审后放宽为「以 artifact 版本/completion decision 为锚」，删任务级 terminal 前置；若有反例（防读到在途写入），注释说明后保留。

### STA-09 状态词表漂移：同一概念三套词 ⬜

- **位置**：[engine/model.ts:308](../packages/opencorvus/src/engine/model.ts)（`ProgressSnapshot.status` 含 `created`，词表五值）；:865（`TaskConversationSessionView.status` 六值 `pending/running/idle/completed/error/skipped`）；对照 [engine/task-status.ts:16](../packages/opencorvus/src/engine/task-status.ts) 的四值 `DerivedTaskStatus`。
- **判定**：均为投影/记录字段，不执法，合宪；但三套近义词表是 code-smell 头号病症（同一概念 N 遍各自漂移）的状态版。`created` 尤其无对应推导事实（快照写入方随手标注）。
- **方向**：随重构收敛词表；`ProgressSnapshot.status` 若无消费方区分 `created`，并入 `active`。

### STA-10 死 import ×5：Phase 2 残渣（当前未提交工作树观察）

- `deriveTaskStatus` 曾仅剩 import 行、无任何使用：orchestrator/architect-stage.ts、orchestrator/requirements-stage.ts、orchestrator/delivery-slice-contract-tools.ts、engine/state.ts、browser-preview/persist.ts。当前未提交工作树显示五处删除，但它们不属于本次文档提交；应随对应源码切片重新验证、独立审查并提交，本文不宣称 typecheck 或交付完成。

---

## 附录 A：状态机总表（四问判定）

| 状态机                                                                                                                        | 状态                                                  | ①普通出口                                                    | ②持久事实                               | 判定                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------- |
| TaskLifecycleProjection（[task-lifecycle.ts:44](../packages/opencorvus/src/engine/task-lifecycle.ts)）                        | active                                                | 完成/失败/取消                                               | 协议事件                                | 保留                                            |
| 〃                                                                                                                            | cancelling                                            | 取消收敛（15s 有限唤醒）                                     | `task.cancellation.requested`           | 保留                                            |
| 〃                                                                                                                            | **closing**                                           | **无（无生产者；legacy 行连 cancel 都炸）**                  | **无**                                  | **删（STA-02）**                                |
| 〃                                                                                                                            | completed/failed/cancelled                            | 消息即重开（cancelled 除外，用户自己的出口）                 | terminal 事件                           | 保留（颜色）                                    |
| TaskRootIngressProjection（[reducer.ts](../packages/opencorvus/src/engine/task-root-ingress-reducer.ts)）                     | ~~blocked/integrity_conflict~~ → host_fault（6 因）   | 放行队首；后继 ingress 越过它继续，新消息重做该工作          | host 自身写入不变量（逐因命名）         | **已改（STA-01）**：不驻留、不吸收 FIFO         |
| 〃                                                                                                                            | exhausted（3 因）                                     | 新消息越过它继续                                             | turn 计数/lease 计数/deadline vs policy | 保留                                            |
| 〃                                                                                                                            | terminal_inapplicable / resolved                      | 吸收即结算（memo）                                           | lifecycle/decision 事实                 | 保留                                            |
| 〃                                                                                                                            | leased                                                | lease 到期（有限唤醒）                                       | activation lease 行                     | 保留                                            |
| 〃                                                                                                                            | reconcile_required                                    | 用户应答 reconciliation Interaction                          | 无 outcome 的 activity request          | 保留                                            |
| 〃                                                                                                                            | waiting                                               | 用户应答/resumeAt 到期                                       | 未决 Interaction 行                     | 保留                                            |
| 〃                                                                                                                            | cancelling                                            | 同上收敛                                                     | 同上                                    | 保留                                            |
| 〃                                                                                                                            | **closing**                                           | 同 STA-02                                                    | 同 STA-02                               | **删（STA-02）**                                |
| 〃                                                                                                                            | ready                                                 | FIFO 激活                                                    | 以上皆非                                | 保留                                            |
| DerivedTaskStatus / TerminalTaskStatus / terminalReason                                                                       | 4+3 值                                                | —（纯投影词表）                                              | lifecycle 投影                          | 保留                                            |
| Interaction.status（[model.ts:280](../packages/opencorvus/src/engine/model.ts)）                                              | pending→answered/rejected/expired                     | 用户应答/拒绝；expiry 由 resumeAt 事实推导；abandonment 扫除 | interaction 行 + durable effect         | 保留                                            |
| 协调请求/动作（[agent-coordination.ts:43,51](../packages/opencorvus/src/engine/agent-coordination.ts)）                       | pending→responded/cancelled；pending→completed/failed | 编排器决策（coordination ingress 驱动）；任务取消级联        | artifact 版本                           | 保留                                            |
| build-observation cleanup（[build-observation-cleanup.ts:27](../packages/opencorvus/src/engine/build-observation-cleanup.ts)) | active/pending/retained/complete                      | 重试扫除                                                     | receipt 行 reduce                       | 保留                                            |
| TaskIntent（[orchestrator/event.ts:14](../packages/opencorvus/src/orchestrator/event.ts)）                                    | retry / replan                                        | —                                                            | 已接受 ingress 行（不可变）             | 一次迁移后删除旧 intent 与兼容 reader（STA-04） |
| 其余（MailboxView、cancellation Actor/Source/Surface、wake_status、OperatorSteer reason、ingressKind、severity 等）           | —                                                     | —（事实/命令/错误分类，非可驻留状态）                        | —                                       | 保留                                            |

## 附录 B：`isTaskTerminal`/`deriveTaskStatus` 82 个匹配清点（20 文件）

| 文件                                                                                                                                                                                 | 处数 | 判定                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [task-api/index.ts](../packages/opencorvus/src/task-api/index.ts)                                                                                                                    | 20   | 投影 6（:1063,:1306-1311,:3084,:3092,:3317,:3725）；删除/归档结算流 4（:593,:2321,:2393,:3174——删除前先取消的编排，动作驱动非拒绝）；钦定游标 3（:3322,:3374,:3429）；钦定 reopen 规则 2（:3579-3580）；**闸门 2**（:2757→STA-07，:3515→STA-04）；import 2 |
| [orchestrator/agent.ts](../packages/opencorvus/src/orchestrator/agent.ts)                                                                                                            | 8    | terminal 专用入口与投影需按 Phase 2 重审；旧 occurrence 写幂等护栏保留 exact effect/decision fence、去 status 依赖；含 import                                                                                                                              |
| [engine/cross-task-artifact-import.ts](../packages/opencorvus/src/engine/cross-task-artifact-import.ts)                                                                              | 6    | 游标 3（:232,:293,:340）；**闸门 1**（:213→STA-08）；import 2                                                                                                                                                                                              |
| [orchestrator/task-lifecycle-tools.ts](../packages/opencorvus/src/orchestrator/task-lifecycle-tools.ts)                                                                              | 6    | terminal status 拒绝按 Phase 2 横向待删、改验 exact occurrence；其余为幂等、展示投影与 import，实施切片逐处重算                                                                                                                                            |
| [engine/task-status.ts](../packages/opencorvus/src/engine/task-status.ts)                                                                                                            | 4    | 定义模块本体                                                                                                                                                                                                                                               |
| [engine/store.ts](../packages/opencorvus/src/engine/store.ts)                                                                                                                        | 4    | 投影 3（:1333,:1405,:1502）；import 1                                                                                                                                                                                                                      |
| [orchestrator/loop.ts](../packages/opencorvus/src/orchestrator/loop.ts)                                                                                                              | 4    | terminal 专用入口准入按 Phase 2 待删；其余为投影/import，实施切片逐处重算                                                                                                                                                                                  |
| [engine/describe.ts](../packages/opencorvus/src/engine/describe.ts)                                                                                                                  | 3    | 投影 2；import 1                                                                                                                                                                                                                                           |
| [engine/terminal-lifecycle-reference.ts](../packages/opencorvus/src/engine/terminal-lifecycle-reference.ts)                                                                          | 3    | 钦定游标基础设施（:23,:73）；import 1                                                                                                                                                                                                                      |
| [worktree/index.ts](../packages/opencorvus/src/worktree/index.ts)                                                                                                                    | 3    | 死主清理授权 2（:1073,:1199，task-status 注释明许的 cleanup 用途）；import 1                                                                                                                                                                               |
| [workbench/board.ts](../packages/opencorvus/src/workbench/board.ts)                                                                                                                  | 3    | 投影 2（:563-567 的 `canRetry` 随 STA-04 消亡；:725）；import 1                                                                                                                                                                                            |
| [protocol/delivery.ts](../packages/opencorvus/src/protocol/delivery.ts)                                                                                                              | 3    | **闸门 2**（:85,:743→STA-05）；import 1                                                                                                                                                                                                                    |
| mission/projection.ts、work-ledger/projection.ts、tool/analytics.ts、tool/task-run-evidence-host.ts、server/routes/mission.ts、engine/completion-decision.ts、task-artifact/store.ts | 各 2 | 投影/游标/流程选择或待删 terminal gate + import；`task-artifact/store.ts` 对应 STA-06                                                                                                                                                                      |
| engine/model.ts                                                                                                                                                                      | 1    | 文档注释                                                                                                                                                                                                                                                   |

## 附录 C：本轮范围外、下一轮候选

- mission/execution-closure.ts 的 closing/closed 状态机（有生产者，属 mission 面，未审）。
- session/ 的 SessionStatus 与 prompt 状态（Phase 1 已动过一半）。
- 112 个 Error 类的二分法收敛（Phase 4 遗留，计划已注明随本期扫荡推进）。
