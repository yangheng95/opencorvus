# Host 设计缺陷分析：过度工程如何制造了它想预防的故障

日期：2026-08-17。依据：当日 8 起生产故障的根因 + 近期 memory 里另外 2 起 + 仓库量化扫描。源码“已修/已删”描述均为当前未提交工作树观察，不是本次文档提交的交付证据；实现必须在各自切片重新验证、独立审查并提交。
对照系：pi（badlogic/pi-mono）一类极简 agent host 的设计哲学。

## 一、经验证据：故障是谁造成的

当日及近期共 10 起已定位根因的故障。**10/10 的根因是 host 自己引入的防护机制，0 起来自它们声称要防御的对象**（模型乱来、并发写坏数据、事实被篡改）。

| #   | 故障表现                                    | 根因所在的"防护机制"                                                                              |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Mission 每 12s 重读同一 artifact，84 轮不止 | `promptMessagePrefix` 上下文策展：切片隐藏后到消息，连带切掉本轮全部工作，prompt 逐字节冻结 29 步 |
| 2   | 任何消息都加载不出来（>180s 挂起）          | Instance 租约机器：read/write 模式升降级形成等待环，项目打开死锁                                  |
| 3   | 失败任务发消息无法恢复                      | 任务终态状态机 + `withTerminalTaskAuthority` 工具封锁：agent 回话但什么都不执行                   |
| 4   | OpenAI 每次工具调用致命失败                 | `tool_part_request` 不可变触发器 + 错误分类taxonomy 交互：metadata 分歧从偶发变必死               |
| 5   | 编排器无限重试风暴（1415 次）               | 确定性不变量 throw 被 `classify()` 判为可重试：错误分类当控制流                                   |
| 6   | 终态会话工具协调绑定丢失                    | WeakMap 侧带状态：对象一复制，绑定悄无声息蒸发                                                    |
| 7   | `browser_preview_capture` 编排器不可用      | 手工维护的能力投影表漏登记：静默失能                                                              |
| 8   | 压缩摘要杀死任务                            | compaction 与 task-root fence 规则冲突                                                            |
| 9   | Windows 启动必炸                            | 遗留 supervisor 目录让恢复路径 throw：恢复代码当执法者，brick 两次                                |
| 10  | 分离异步在关闭租约上 fault                  | fire-and-forget 继承 instance 租约的作用域规则                                                    |

这个比例不是运气差。每道闸门都是针对一个**想象中的故障**加的（"模型可能看到不该看的消息"、"事实可能被改写"、"两个写者可能竞争"、"终态任务可能被误触"）。想象中的故障基本没发生过；防御它们的机制包办了全部真实故障。

## 二、量化扫描（packages/opencorvus/src）

- 总量：**253,405 行 / 1,033 个 .ts 文件**
- 自定义 Error 类：**112 个**，散布 79 个文件
- "Authority" 出现 **910 次**，156 个文件——权限/授权是全库最高频的抽象之一
- "epoch" 出现 **292 次**，32 个文件
- 锁/租约词汇出现 **524 次**，39 个文件；`project/instance.ts` 单文件 152 次
- WeakMap **27 个**，18 个文件——不可序列化、不进 debug bundle、复制即丢的侧带状态
- 关键文件规模：`session/loop.ts` 3,882 行；`task-api/index.ts` 3,585；`orchestrator/tools.ts` 2,685（大半是手工能力表）；`engine/task-root-ingress-delivery.ts` 2,081；`project/instance.ts` 1,820

对照：pi 的核心循环是几百行——完整消息数组 → LLM → 执行工具 → 追加。它**没有内置权限系统**（"runs with the permissions of the user and process that launched it"），需要边界就上容器；会话就是追加式文件；崩溃恢复就是重读文件。

## 三、六类结构性缺陷

### 1. Host 策展模型的视野（事故 #1、#3、#7）

`promptMessagePrefix` 在读取时裁剪历史；`terminal-conversation-authority.ts` 整个文件的职责是决定"终态对话配得上哪些工具"；`orchestrator/tools.ts` 用手工表枚举可投影工具。每个策展点都是"模型的视野"与"持久化真相"可以分叉的地方——而分叉恰好是 agent 循环无法自愈的故障类别，**因为模型看不见自己看不见的东西**。冻结 prompt 是确定性死循环，不是模型犯傻。

pi 的答案：prompt 就是会话文件本身，逐字。**该不该看的问题在写入时决定（不写进这个会话），不在读取时裁剪。**

### 2. 状态的发明速度快于出口的发明速度（事故 #3、#8）

292 处 epoch、吸收态 `blocked/integrity_conflict`、需要 Retry/Replan 专用词汇才能离开的终态。规则应当是：**每引入一个状态，必须同时交付离开它的普通用户动作**。pi 实质上只有两个状态：等输入、在跑。

（2026-08-17 已部分修复：操作者消息即恢复终态任务，Replan 已删除。`blocked/integrity_conflict` 等吸收态尚未按同一标准审计。）

### 3. Host 防御它自己（事故 #4、#5）

SQLite 触发器对着 host 自己 throw；112 个 Error 类；`classify()` 沿 cause 链爬行决定可重试性。**当写入者和执法者是同一个进程，把确定性冲突抛进语义重试只会把 bug 升级成宕机。**相同 identity 且相同 payload 的重放可以幂等折叠；分歧写入必须结算为 exact operation HostFault。外部 effect 执行前必须已有 durable request；若 outcome 缺失，由 request/outcome 缺口投影 unknown/reconciliation_required，不另写状态，只能追加至多一个权威 exact outcome。不能靠“首写获胜”或日志猜结果。

### 4. 用模式锁而不是单写者做并发（事故 #2、#10）

read/write 模式、upgrade/downgrade、`demoteWhen`、`pumpLock`——1,820 行。死锁的直接成因是模式升级制造了等待环，而**每项目一个串行写队列（单写者）在结构上无法表达等待环**。整个模式格子、超时 flag、争用描述器都随之不再需要。

### 5. 恢复路径是全系统最严格的代码，而它必须是最宽容的（事故 #9）

启动扫描遇脏状态 throw，brick 了两次。恢复代码的合同：隔离 exact operation/occurrence + 上报，不能阻断无关 Task/Project。若歧义涉及不可逆 effect，该 effect 仍须 fail closed，不能为了“永不阻断”猜测结果。

### 6. 侧带状态不可见（事故 #6）

27 个 WeakMap 承载工具协调绑定、决策声明。它们不进序列化、不进 debug bundle、对象一复制就消失。可影响跨函数权限、执行或恢复的事实必须进入唯一可诊断的 descriptor/持久事实；纯局部缓存不得被提升为 authority。

## 四、根本诊断

缺陷不是"代码太多"，而是：**派生状态可以与持久真相矛盾的位置太多，且闸门作用在派生副本上。**

讽刺的是，opencorvus 的地基和 pi 是同源的——protocol store 就是追加式事件日志，这部分是对的、也是本质复杂度（多项目、多 agent、桌面 UI、可审计 artifact 都需要它）。缺陷全部在日志之上那些"二次猜测日志"的层：带吸收态的 reducer、被 authority 包装的投影、靠切片拼装的 prompt、手工维护的能力表。

pi 的稳定性来源可以精确表述为：**几乎没有可以出错的状态。** 真相是一个追加文件；模型看到全部；循环靠重读文件即可重启。稳定不是简陋的副产品，是"哪些状态是必须的"这个问题被想清楚之后，对其余一切说不。

## 五、去工程化优先级

1. **Prompt 装配 = 会话原文**。除 compaction 外删除一切读取时裁剪。消息该不该被某会话看见，在路由/写入时决定。（#1 已修，但修法仍是更聪明的过滤器；终局是没有过滤器。）
2. **Instance 锁收敛为每项目单写者队列**。删除模式升降级、`demoteWhen`、争用超时 flag。
3. **任务继续工作收敛为 occurrence + 用户边界**。completed/failed 是旧 occurrence 的历史投影；新用户消息自然打开新 occurrence。只有 cancelled/deleted 阻止新工作。不可逆 effect 仍直接验证 exact occurrence/epoch，不能拿 status 代替。
4. **错误政策按真实来源结算**：HostFault（exact operation 一次结算、不做语义重试）、Provider/transport 结果、用户/权限/工具业务结果。模型可见的结构错误必须带 expected/received；删除靠 body 关键字或深层 cause 猜重试性的控制流。
5. **不可变性去全局 throw 化**：相同写入按同一幂等身份折叠；分歧写入结算为 exact occurrence HostFault。可能改变不可逆 effect 的分歧必须 fail closed，不能只记日志后继续；触发器最多做真实持久边界的最后防线。
6. **消灭 WeakMap 侧带**：协调绑定成为工具描述符上的显式可序列化字段。
7. **删除平行能力表**：工具唯一注册事实直接投影可用集合；只有发布或跨进程协议真实需要时才从同一注册表生成静态产物，生成物不能反向成为运行时 authority。
8. **审计方法**：枚举所有状态、gate、fence 和 retry 分类，问它来自哪个真实参与者/进程外事实、保护哪个不可逆边界、普通用户或外部事件如何离开、属于哪个 exact occurrence。无事实且无真实边界、无出口或错误冻结整个 Task/Project 的机制删除。

## 六、对"极简"的公平边界

pi 是单用户 CLI；opencorvus 是多项目、多 agent、带 Windows 进程管理和桌面 UI 的产品。事件日志、持久 artifact、崩溃恢复是本质复杂度，不在批判之列。pi 的"无权限系统"翻译到这里不是"不要边界"，而是：**隔离放在进程/容器边界，不放在每轮对话的 authority 包装器里。**

---

# 附录：第二轮隐患扫描（2026-08-17，Phase 1-4 未提交工作树切片之后）

第一轮解剖的是已出事故的器官；这一轮找**下一个事故最可能发生的地方**。普查数字先行：

- 模块级内存 `Map` 注册表：**193 个 / 112 个文件**
- "receipt"（收据/凭证模式）：**1,147 处 / 112 个文件**
- "reservation"（预订/预留模式）：**135 处 / 17 个文件**——连事件总线 publish 都先 reserve 再 settle
- `function assert*` 守卫函数：**257 个 / 107 个文件**
- ambient context 层（AsyncLocalStorage / Context.create）：**26 层**——instance 一族独占 5 层

## H1 — 内存吸收态：进程内的"终态任务"（预测性最高）

`session/prompt/state.ts:737-745`，代码自己的注释："A failed cleanup is process-local quarantine evidence… prevent a new prompt generation from overwriting the owner **until the runtime is restarted**."

取消清理失败（`releaseManagedWorktreeSessionOwner` 抛错）→ receipt 进入 `outcome: "failed"` → 250ms 自旋重试；若失败是**确定性的**（Windows 文件锁正是这种），重试永不成功，该会话对一切新 prompt 抛 `BusyError`——直到用户重启应用。这与"终态任务不可恢复"是同一个病，但下沉了一层：状态在内存里，debug bundle 看不见，操作者只看到"会话没反应"。它违反“Host fault 局部结算”和“继续工作产生新 occurrence”：RAM 状态没有出口，却冻结了全部后续 prompt。**预测的事故表象：某个会话突然永远 Busy，重启后自愈，无人能归因。**

处方：清理失败 → 隔离 + 上报 + **下一次 start 时重试清理**（把出口挂在普通用户动作上），删除"直到重启"语义。

## H2 — 一个 Session 的"谁可以做什么"由 8 个并行内存注册表共同裁决

仅 `session/prompt/state.ts` 一个文件：`statesByDirectory`、`cancellationReceipts`、`messageOwnersBySession`、`taskRootIngressOwners`、`rootSessionDestructiveScopes`、`rootSessionProcessShutdownHandoffs`、`promptStartReservations`、`promptSettlementReservations`，外加 `promptOwnerCapture` ALS。每一个都必须与持久状态一致、且彼此一致；没有一个能活过重启；没有一个进 debug bundle。冻结 prompt 事故正是其中一个注册表（attached reply targets）与持久顺序分叉的结果——**这个家族还有 7 个成员没出过事，不是因为它们更正确。**

处方：并入进行中的状态审计（Phase 6）——对 193 个模块级 Map 逐个问："它与哪条持久事实冗余？进程崩溃后它如何重建？"合法答案只有两种：**从持久事实重建**，或**删除**。

## H3 — 收据经济：host 在自己函数之间用 capability 收据传权

1,147 处 receipt、135 处 reservation。典型：`prepareUserMessage` → `consumePreparedUserMessage` → `persistMaterializedUserMessage` → `consumePersistedUserMessageReceipt`，每一步用 WeakMap 身份校验一次性收据（"Unrecognized materialized user message"）。这是"执法不对自己"的函数级违宪：写入者和执法者是同一进程时，收据防不住恶意（没有恶意），只防得住重构——每张收据都是一条会在重构中被遗忘/复制/丢失的隐形通道，与 WeakMap 绑定蒸发（事故 #6）同构。事故 #6 的家族在这里，成员上千。

处方：不搞大爆炸替换；立规矩——**新代码不得引入 consume-once 收据**，改用显式参数 + 精确幂等 identity；只有 identity 与 payload 都一致才折叠，分歧按 exact operation HostFault 结算。存量随触碰逐个还原为普通参数。

## H4 — 26 层 ambient context，fire-and-forget 一次全丢

一次请求的真实运行栈：runtime-root → db effect-owner → instance lease/lifecycle/activity → instance-context → instance-lifecycle-context → session context → scheduler task-owner → prompt owner capture → capability/skill 事务标记……任何 `void (async () => …)()` 分离点静默丢失全部 26 层。这类事故已经发生过一次（memory：detached work faults on closed lease）。

处方：立规则并 lint——**跨分离边界必须显式携带 `(directory, sessionID, taskID)` 并重新 `provide`**；ambient 穿透只允许在同一 await 链内。

## H5 — Worktree 所有权临界区：报警器已经在响

每次 prompt start 都 `WorktreeOwnershipCriticalSection.acquire`，每次 finish 都 `releaseManagedWorktreeSessionOwner`（失败进 H1 的隔离）。已知事实：worktree ownership 的 `algorithm-batch-one` 测试**在干净 HEAD 上就失败，并 halt 整个测试套件**——回归防线对整个仓库失效已有时日，被当作背景噪音。H5 与 H1 组合就是下一个事故的完整剧本：Windows 文件锁 → release 确定性失败 → 内存隔离 → 会话 Busy 到重启。

处方：**先修红着的测试**（它 halt 套件，等于全仓库无 CI 信号），再审计临界区保护的真实共享资源。只有证明不保护共享可变 Worktree/文件系统边界后才能删除；否则获取失败必须局部拒绝该 operation，记录可见诊断并释放无关工作，不能“记日志后继续”进入临界区。

## 排序结论

H5→H1 是一条已经上膛的事故链；H2/H3 是事故 #1/#6 的未爆家族；H4 已经爆过一次。与第一轮同一个元规律：**这些机制没有一个防御过真实发生的威胁，而它们自己构成了全部威胁面。**
