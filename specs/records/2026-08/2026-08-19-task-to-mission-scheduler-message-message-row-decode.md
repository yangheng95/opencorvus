# Task-to-Mission scheduler messages decode Message rows that never carry their own identity

## Recall

| Item | Record |
| --- | --- |
| User request | 在 dev 环境走通"生成办公场景的专家团 → 进化专家团"的链路；遇到问题不要着急修，先分析挖掘深层问题。分析交付后用户明确授权："这一轮结束后修了那一行，继续走 Evolution Lab"。 |
| Acceptance criteria | 一次 Task terminal 通知能够真正结算到 Mission Session（`protocol_delivery_receipt` 出现非 `retry_wait` 终态收据，Mission 被唤醒），而不是重试 5 次后 `dead_letter`；同族的 `scheduler_message` 发送路径同样恢复；有聚焦的正向测试锁定契约。 |
| Hard constraints | 不改变 Message 行的持久化形状（`data` 列不含 `id`/`sessionID` 是既有设计）；不新增 fallback 或第二条解码路径；不动用户并行修改的 overlay 文件；隔离 `OPENCORVUS_HOME` 运行，不触碰用户正在使用的 app。 |
| Sources read | `protocol/session-wake-state.ts`、`protocol/delivery.ts`、`protocol/delivery-projection.ts`、`protocol/scheduler-message.ts`、`tool/scheduler-message.ts`、`engine/state.ts`、`engine/control-lease.ts`、`session/index.ts`（`upsertMessageRow` / `persistMessageBundleRows`）、`session/wake.ts`、`session/message.ts`、`session/prompt/parts.ts`、`expert-squads/builtin/evolution-lab/README.md`、`docs/evolution-gate-audit.md`。 |
| Whole-repository search | `grep -rn "Message\.\(User\|Assistant\|Info\)\.\(safe\)\?[Pp]arse("` 命中 `packages/opencorvus/src` 的 10 处解码点，独立审查补出第 11 处 `task-api/task-root-message.ts:107`（`Message.VisibleInfo.parse`，同样要求身份且已正确拼装）。11 处中 9 处按 `{ ...row.data, id, sessionID }` 重新拼装身份（`engine/producer-turn.ts:47`、`engine/task-root-ingress-delivery.ts:458/580/711/877`、`goal-workload-analyst/publication.ts:170`、`memory/project-memory.ts:376`、`session/index.ts:1236`、`task-api/task-root-message.ts:107`），2 处直接解析 `data` 列：`protocol/session-wake-state.ts:27` 与 `protocol/delivery.ts:532`。独立审查另行扫过全部 47 处 `MessageTable.data` 读取点、全部 Part 级解码点与其他表，未发现同形缺陷。测试侧 `grep -rln "wake_reason\|session_wake\|mission_scheduler"` 在 `packages/opencorvus/test` 下没有任何用例让 `schedulerWakeMessageMatchesInTransaction` 返回过 true。 |
| Independent agent feedback | 见"独立审查"一节：只读审查确认根因与三个提交的证据，纠正一处文件引用、一处修复表述、一处解码点计数，并指出两处测试缺口。 |

## 可观察现象

隔离 dev 环境（`OPENCORVUS_HOME` 独立、`openai/gpt-5.6-terra`）里，一个 Mission 创建的 Task 正常完成并安装了它的交付物，但 Mission 永远停在 `inactive`，会话里没有任何新消息，操作者侧没有交付也没有报错。

`protocol_delivery_receipt` 里留下完整轨迹：

```
09:41:42 retry_wait  SchedulerMessageConflictError: Scheduler inbox pib_... session_wake
                     result does not name its exact Message occurrence in the recipient Session.
09:43:42 retry_wait  （同一条错误）
09:45:43 retry_wait  （同一条错误）
09:47:44 retry_wait  （同一条错误）
09:49:44 dead_letter
```

日志里一行都没有；错误只落在收据表。

## 直接触发点

`engine/state.ts:307-330` 在 Task 进入终态时给 Mission Session 入队一条 `notification`。`protocol/scheduler-message.ts` 的 `drainMissionRecipient` 取出它、唤醒 Mission、并在 `commitBundle` 内调用
`settleSchedulerDeliveryInTransaction` 结算。结算前的守卫 `requireDeliveryResultOccurrence`
（`protocol/delivery.ts:625-639`）要求 `schedulerWakeMessageMatchesInTransaction` 为真，否则抛
`SchedulerMessageConflictError`，整个唤醒事务回滚。

## 数据流根因

在运行中的宿主上对该谓词加临时探针，得到判定失败的确切分支：

```
[PROBE] wake-match: Message.User parse failed
  [{"path":["id"],       "message":"expected string, received undefined"},
   {"path":["sessionID"],"message":"expected string, received undefined"}]
[PROBE] wake-match: raw data
  {"author":"orchestrator","role":"user","time":{...},"agent":"mission","model":{...},
   "extra":{"wake_reason":{"source":"scheduler.message","eventID":"pev_...","inboxID":"pib_..."}}}
```

`wake_reason` 完好，`eventID`/`inboxID` 都对。失败发生在它之前的一步：

`session/index.ts:1242` 在写入时显式把身份剥离出 JSON —
`const { id: _id, sessionID: _sessionID, ...nextData } = persistedMessage` —
因为 `id` 和 `sessionID` 是 `message` 表的独立 SQL 列。同一文件 1236 行给出了唯一正确的读回写法：
`Message.Info.parse({ ...existing.data, id: msg.id, sessionID: msg.sessionID })`。

`protocol/session-wake-state.ts:27` 漏掉了这次重新拼装，直接
`Message.User.safeParse(message.data)`。`Message.User` 继承的 `Base` 把 `id` 与 `sessionID` 声明为必填，
而 `data` 列按设计永远不含它们 —— 于是该 `safeParse` **对任何已持久化的行都不可能成功**，谓词恒为 false。
这不是竞态或偶发：每一次合法结算都会失败，重试 5 次后 `dead_letter`。

`protocol/delivery.ts:532` 的 `requireTaskSourceMessageOccurrence` 是同一形状的第二处：
`Message.Assistant.safeParse(message?.data)` 同样恒失败，于是 `sendSchedulerMessage` 在
`input.sourceMessageID` 存在时必抛
`Task scheduler source Message ... has no exact Task ingress occurrence.`。
Task 侧的发送者是 `orchestrator/tools.ts:969-985`：它用 `source = taskSchedulerEndpoint(taskID)`
并永远传 `sourceMessageID: execution.orchestratorMessageID`，所以 Task 编排器主动发给 Mission 或
兄弟 Task 的每一条 `scheduler_message` 在发送侧就被拒绝。（`tool/scheduler-message.ts` 是
Mission 侧发送者，`source.kind` 恒为 `mission_scheduler`，不经过这条守卫。）

## 旧路径为什么没有根治

两处都是重构引入的回归，且都比它们替换掉的写法更弱：

- `session-wake-state.ts`：`0c7b87fb`（2026-08-14）引入该谓词时用的是结构化读取
  `messageData?.extra?.wake_reason`，正确。`66d4ab3c`（2026-08-18）把它换成 zod 解码，
  理由写在同一次提交新增的注释里 —— 让字段改名"编译期失败而不是静默匹配不上"。
  该注释同时预言了失败形状："a silent `false` surfaces as `SchedulerMessageConflictError` on every
  lawful settlement rather than as the rename it actually was"。重构制造了它自己警告的那个静默 false。
- `delivery.ts:532`：`627146cc`（2026-08-15）引入，从一开始就缺身份拼装。

没有被测出来的原因是零覆盖：`packages/opencorvus/test` 下没有任何用例断言过一次成功的 Mission
收件方结算。`protocol-scheduler-message-delivery.test.ts` 不含 `wake_reason` / `session_wake` /
`mission_scheduler`；`mission-task-duplex-contract.test.ts` 只测端点字符串的编解码。
同一个 `requireDeliveryResultOccurrence` 里的 task 收件方分支（`delivery.ts:656-693`）
仍用裸结构读取，因此 Mission→Task 方向一直正常，掩盖了反方向的全失效。

## 影响面

`drainMissionRecipient` 是 Mission Session 接收一切 scheduler 消息的唯一入口。两处叠加的结果是
**Task→Mission 两个方向的通信全部不可用**：宿主自动发出的终态通知（2026-08-18 起）和编排器主动
发出的 `scheduler_message`（2026-08-15 起）。

因此任何跨 Task 的 Mission 编排都无法收敛。Evolution Lab 的包契约明确要求
"Mission is the only cross-Squad coordinator … waits for terminal acceptance, and imports exact
Artifacts into the next Task"，其返回边正是这条回路，所以在修复前 Evolution Lab campaign 在结构上
不可能跑通。（2026-08-12 那批进化 E2E 早于这两次回归，不受此解释。）

## 单一事实来源修复

两处都改为使用与其余 8 处解码点相同的身份拼装，不新增分支、不新增 fallback：

| 位置 | 改动 |
| --- | --- |
| `protocol/session-wake-state.ts` | 查询补选 `session_id` 列，`Message.User.safeParse({ ...message.data, id: message.id, sessionID: message.sessionID })` |
| `protocol/delivery.ts` | 查询补选 `id`/`session_id` 列，`Message.Assistant.safeParse({ ...message.data, id: message.id, sessionID: message.sessionID })` |

`data` 列的持久化形状不变；两处仍然经由 zod 解码，保留 `66d4ab3c` 想要的改名即失败的性质。

## 附带发现（第二轮已修两项，见「第二轮修复」）

- `protocol/delivery.ts:986` 的 `rescheduleSchedulerDelivery` 写完 retry 收据后不释放 control lease，
  而 `engine/control-lease.ts` 根本没有 release 原语（只有 acquire/renew/assert，靠超时回收）。
  于是 `drainMissionRecipient` 的 `min(30s, 500·2^(n-1))` 退避是死代码，实际重试周期恒等于
  `DELIVERY_LEASE_MS = 120_000`。本次观测到的 4 次重试间隔精确为 120s。
- 宿主重启后的恢复路径会杀掉正在运行的 Task：`project.open` 的 `task-control.reconcile`
  阶段在 `instance.ts:919` 的 "instance context preparation" 生命周期仍然活跃时拉起编排器循环，
  编排器首个动作 `Instance.provide` 撞上 `instance.ts:625` 的 `assertNoRecursiveLifecycle`，
  Task 被判 `failed`，而 `[serve] runtime project recovery attempted=1 initialized=1 failures=0`
  自报成功。
- `tool/artifact-catalog.ts:252` 把 jsonc-parser 的 UTF-16 字符偏移拼成 `at byte ${error.offset}`。
  中文负载下两个坐标系可差 70%（实测 22262 字节 / 13064 字符），模型拿到的定位符指向无关位置，
  且报文不含出错片段。同文件族里 `config/config.ts:1961`、`config/paths.ts:217` 转成 line/column，
  `expert-squad/registry.ts:373` 写的是中性的 "at offset"，只有这一处面向模型的写错了单位。

## 验证

聚焦测试 `packages/opencorvus/test/scheduler-wake-message-identity.test.ts`（2 pass / 7 expect）：

- 用例一是此前完全缺失的正向契约：经真实 `Session.updateMessage` → `upsertMessageRow` 落库后，
  `schedulerWakeMessageMatchesInTransaction` 对本投递返回 true，对另一条投递的身份返回 false。
  修复前该断言必红（谓词恒 false）。
- 用例二把持久化不变量断言成明确的错误契约：`Message.Assistant.safeParse(row.data)` 的 issue path
  恰好是 `[["id"],["sessionID"]]`，反向断言重新拼装后解码成功。

既有相关测试全绿：`protocol-scheduler-message-delivery`、`protocol-delivery-fact-storage`、
`mission-process-recovery`、`mission-task-duplex-contract`。`bun run docs:check` ok（331 ops / 25 groups）。
`tsc --noEmit` 在 `packages/opencorvus` 干净（独立审查复跑确认）。

真实路径验收（隔离 `OPENCORVUS_HOME`，`openai/gpt-5.6-terra`，同一个数据库前后对照）：

1. **宿主自动终态通知（`session-wake-state.ts` 半边）。** Task `tsk_g00VSjcbXM00WXPfmbOi` 完成时入队的
   `pib_hUjnQKQ3AwhYocwxUYgH`，在旧代码下留下两条 `retry_wait`；带修复重启后**第一次尝试**即写入
   终态收据 `session_wake`。Mission `11a8c09a96967d49` 随即由 `inactive` 转 `running`，完成终态验收并向
   操作者交付摘要，Mission → Task → Mission 回路闭合。
2. **Task 主动发送（`delivery.ts` 半边）。** 通过 `POST /task/<id>/message` 让该 Task 的编排器调用
   `scheduler_message`，驱动 `orchestrator/tools.ts:969-985` → `sendSchedulerMessage`。事件
   `pev_hhpSTxY1zCemeSwt3Fcj`（`task_scheduler → mission_scheduler`，`source_message_id=msg_hmGFdRNibaE5h4cKiuQ0`）
   成功落库——该事件只在全部 authority 校验通过后才追加，因此这条证据同时证明编排器 assistant 消息
   确实携带 `activationID` 且其租约 `target` 为 `task_root_ingress`。其投递
   `pib_h3tq3vmBXOPCN3ceQWg8` 一次结算为 `session_wake`。
3. **聚合对照。** 同一数据库的 `protocol_delivery_receipt`：修复前 10 条 `retry_wait` + 2 条 `dead_letter`，
   修复后 4 条 `session_wake`，无失败。
4. **管线解锁。** 修复后启动的 Evolution Lab campaign（Mission `5fc1c615197ac8e8`）依次完成
   诊断 Task 与 `evolution-opportunity-analysis` Task，后者由 Mission 读取前者终态 Completion Decision
   后创建并绑定 `builtin/evolution-lab@2026.08.18.1`。这一步在修复前不可达，因为 Mission 永远收不到
   阶段一的终态通知。

`requireTaskSourceMessageOccurrence` 目前只有上述真实路径证据，没有夹具测试；缺口已在独立审查中记录。

## 独立审查

交付后由一个未参与实现的只读 agent 审查了完整差异、测试、spec 与提交证据，结论为根因成立、
修复正确、无同形第三处缺陷（另行扫过 47 处 `MessageTable.data` 读取点、全部 Part 级解码与其他表）。
它补充了一项本记录原先没有的证据：`Message.Assistant` 的 `superRefine`（`session/message.ts:689-700`）
会以第二种独立方式拒绝裸 `data`，因此该诊断是完整的而非部分的。

已按审查修正的问题：

| 严重度 | 发现 | 处理 |
| --- | --- | --- |
| 高 | Task 侧发送者被错误引用为 `tool/scheduler-message.ts:64`（实为 Mission 侧，`source.kind` 恒为 `mission_scheduler`） | 改为 `orchestrator/tools.ts:969-985`；行为结论不变 |
| 中 | 修复表写 `input.sessionID`，实际交付为 `message.sessionID` | 表述改为与代码一致 |
| 中 | 用例二在修复前也会通过，且 `toMatchObject` 是子集匹配，守不住不变量 | 改为断言 `safeParse(row.data)` 的 issue path 恰为 `[["id"],["sessionID"]]` |
| 中 | `验收`/`独立审查` 两处交叉引用悬空，全文没有验收证据 | 补齐本节与上一节 |
| 低 | 「10 处解码点」漏了 `task-api/task-root-message.ts:107` | 计数更正为 11，该处本身正确 |

审查提出的剩余风险：修复让一段自 2026-08-15 起从未执行的代码重新可达
（`delivery.ts:537` 之后的租约查找、`delivery.ts:753-760` 的 epoch 比较）。上述真实路径验收第 2 项
已覆盖该风险；夹具测试仍缺。

## 第二轮修复（2026-08-19，用户指示「修复专家团进化暴露的问题」）

「附带发现」三项中的两项已修，第三项与「追加发现」保留，理由见下。

### 一、control lease 没有归还原语，退避恒等于租约 TTL

`engine/control-lease.ts` 只有 acquire / renew / assert，租约唯一的结束方式是超时。
`rescheduleSchedulerDelivery`（`protocol/delivery.ts`）写完 `retry_wait` 收据后直接返回，
仍持有租约，于是 `drainMissionRecipient` 计算的 `min(30s, 500·2^(n-1))` 从未生效，
真实重试周期恒等于 `DELIVERY_LEASE_MS = 120_000`。本次实测四次重试间隔精确为 120s。

修复：新增 `releaseControlLease`，owner 围栏校验后把该租约行的 `expires_at` **就地置为 now**
（不删除，保留 `projectProtocolDeliveryInTransaction` 用来计数 `attempt` 的租约历史）；
`rescheduleSchedulerDelivery` 在写收据的同一事务内归还租约。

### 二、`artifact_publish` 把字符偏移谎报成字节偏移

`tool/artifact-catalog.ts` 原先拼 `at byte ${error.offset}`，而 jsonc-parser 返回的是
JavaScript 字符串下标。本次实测一份 22262 字节 / 13064 字符的中文 blueprint 报
`at byte 12731`，真实错点在**字符** 12731 —— 模型若按字节去数会落到无关位置，且报文不含任何片段。

修复：改为 `at line L, column C (near "…")`，与 `config/config.ts:1961`、`config/paths.ts:217`
的既有做法一致，并附上错点前后各 40 字符的 `JSON.stringify` 片段，让位置可核对而不必数数。

### 三、保留未修的两项及理由

- **恢复期 Instance 递归杀 Task。** 根因已定位到具体机制：`project/bootstrap.ts:134` 的
  `task-control.reconcile` 跑在 `prepareContext` 的 "instance context preparation" 生命周期内，
  而被恢复的编排器轮次会经由 `expert-squad/prompt-profile-resolver.ts:739/795/801/4061`、
  `config/effective.ts:25` 这类「按目录再进一次实例」的读取助手调用 `Instance.provide`，
  撞上 `project/instance.ts:1152` 的 `assertNoRecursiveLifecycle`。该守卫在
  `assertSameKeyReentryAllowed` 之前无条件拒绝，因此连合法的同租约重入也被拒。
  正确的修法是让守卫区分「递归进入准备阶段」与「复用已准备好的上下文」，这会改动
  一个已经出过多次事故的并发原语；bootstrap 的注释又明确拒绝把恢复移出 project open。
  这需要独立的一次改动和它自己的并发测试，不适合并入本轮。
- **生成的包可以带着不可满足的工具契约出厂。** 见「追加发现」。真正的根因不在生成器：
  平台自己的 `artifact_publish` 接受**宿主铸造的** `source_selection_refs`，而包工具面对的
  `engineArtifacts.publish`（`packages/plugin/src/artifact-catalog.ts:887/967`）只接受
  手工构造的 `ArtifactReadLocator` 对象数组。包被推向一种平台已为自己否决的入参形态
  （见记忆 `host-must-own-derivable-facts`）。修法是让 `engineArtifacts.publish` 也接受
  宿主铸造的 ref，这是 `packages/plugin` 的公开 ABI 变更，且应同步内置包字节，
  同样需要独立一轮。

### 验证

`packages/opencorvus/test/evolution-chain-host-defect-repairs.test.ts`（3 pass / 13 expect）：

- 解析诊断用例给一份「错点之前全是中文」的载荷，断言 column 等于 `error.offset + 1`
  （即字符坐标可直接索引载荷）、字节长度确实大于字符长度、片段里含得到出错处的原文。
- 租约归还用例断言归还后 `expires_at` 就是归还时刻，且另一 owner 在**退避时刻**即可取得租约。
- 第三个用例断言只有记录在案的 owner 能归还自己的租约，他人归还返回 false 且租约不变。

回归：`protocol-scheduler-message-delivery`、`protocol-delivery-fact-storage`、
`scheduler-wake-message-identity`、`scheduler-claim-and-fire-identity`、`scheduler-fact-control`、
`artifact-catalog-cursor`、`artifact-publisher-authority`、`artifact-provider-reference-flow` 全绿；
`packages/opencorvus` 的 `tsc --noEmit` 干净。

## 追加发现：生成的包可以带着不可满足的工具契约出厂（本次不改）

2026-08-19 的同一条链路里，`squad-sdk` 生成并安装的 `office/meeting-minutes-weekly-report`
在真实运行时反复失败。根因不在进化侧，也不在编排侧，而在**生成侧**：

包内 4 个工具中的 3 个这样声明并转发同一个字段：

```ts
// tools/publish-minutes-draft.ts / publish-action-ledger.ts / publish-final-meeting-delivery.ts
source_artifact_locators: S.array(S.string()).min(1)          // 声明为字符串数组
...
context.host.engineArtifacts.publish({ ..., source_artifact_locators: args.source_artifact_locators })
```

宿主侧 `EngineArtifactPublishInputSchema`（`packages/plugin/src/artifact-catalog.ts:887`）要求
`z.array(ArtifactReadLocatorSchema)` —— 对象。工具的入参 schema 让模型传字符串，工具再把它原样
交给只接受对象的宿主 API，**没有任何输入能同时满足两侧**。唯一没有声明该字段的
`publish-meeting-plan.ts` 是四个里唯一能成功的。

失败形态不是"重试一次"，而是模型输出分布解体。同一工具在一个 Task 内的调用序列：

```
["al_odFh-G3OyWrRrk80","al_J7sfeQtu42VqXPxB"]     host-minted locator ref，被拒
[":{"]
[":{","source_artifact_locators_placeholder_fix?","source_artifact_locators?"]
[":{}]}ถวายสัตย์ฯТолуқassistant to=assistant_analysis code 天天中彩票谁 ...json?"]
[":{}]} 银雀assistant to=functions.question ... No. I must reconsider tool call generation ..."]
["{\"source\":\"engine_artifact\",\"artifact_id\":\"art_hUJs...\"}"]   对象 JSON 塞进字符串，仍被拒
```

泰文、西里尔字母、无关中文垃圾，以及泄漏的 chat template 控制符（`assistant to=assistant_analysis`、
`to=functions.question`）。这类不可自纠错误会持续消耗 `semantic_limit`，与
`docs/evolution-gate-audit.md` 判定的"伪装成重试循环的死刑判决"同类。观测到的绕过方式是
最终交付角色放弃包内工具、改走 `artifact_snapshot` 交付 —— 专家团绕过了它自己。

**没有任何一道门拦住它。** 从 `expert_squad_author` 到安装完成，包内工具只经过
`registry.ts:1289` 的 `assertProjectedPackageRef`，即"被引用的文件存在"。工具不被加载、不被
typecheck、其声明的入参类型也不与它转发的宿主 API 比对。仓库的 `check:expert-squad-types`
（`bunx tsc -p expert-squads/tsconfig.json`）只覆盖 `expert-squads/builtin/**`，项目内生成的包不在范围。
于是该包通过了清单校验、引用解析、包加载与投影哈希，运行时每次调用必死。

与可变面分层的关系：`tools/` 属于被搁置的 T5。反馈驱动修订与 Evolution Lab campaign 的可变面
都把它冻结，因此**进化路径无法修复生成阶段留下的这个缺陷**——它只能靠重新生成或作者手工改包。
