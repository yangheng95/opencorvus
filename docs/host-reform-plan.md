# Host 拨乱反正方案

日期：2026-08-17。校准依据：[host-design-critique.md](host-design-critique.md) 与正式规格
[`2026-08-17-minimal-host-reform-plan-calibration.md`](../specs/records/2026-08/2026-08-17-minimal-host-reform-plan-calibration.md)。

状态：**校准说明稿，非正式 authority**。唯一正式计划是
[`2026-08-17-minimal-host-reform-plan-calibration.md`](../specs/records/2026-08/2026-08-17-minimal-host-reform-plan-calibration.md)。
本说明稿展开其设计理由和阶段语义；两者冲突时以 `specs` 为准。每个实现切片另在 `specs/records/**`
记录 Recall，并同步替换相关 `specs/current/architecture/**`，不让 `docs` 成为运行时事实源。

## 前提与目标

当前 Host 的主要稳定性问题不是保护不足，而是它为模型、会话和任务捏造了过多状态、闸门、
authority wrapper、侧带注册表和恢复分类。这些机制互相组合后，反而制造了 prompt 冻结、任务吸收态、
死锁、绑定蒸发和无限重试。

本轮不是把这些机制重新包装进更多层、端口和基类，而是删除它们。目标只有一句：

> **Host 传输并持久化真实参与者事实，只在外部与不可逆边界执行最小校验，其余工作由模型和工具在完整可见的会话中自然完成。**

参考 pi 的是设计纪律，不是逐文件复刻：更少的 Host 裁决、更直接的消息流、更小的状态面、故障局部化，
以及只有真实边界才拥有的校验。

## 宪法：六条裁决原则

1. **真实参与者产生消息**——用户、agent、编排器、tool/result 自然写入完整可见的会话；Host 不合成、隐藏或双路投递消息。
2. **事实只有一处**——持久原始事实拥有因果身份；status、列表和颜色只是投影，不得成为平行写入源或独立执行授权。
3. **每次模型请求读取当时完整的规范会话**——唯一允许的读取变换是有明确游标的 compaction；Host 不按 reply target、任务颜色或工作流阶段裁剪上下文。
4. **Host fault 局部结算**——Host 自身不变量、持久化或装配错误只失败当前 operation/occurrence，一次可见、不可语义重试；不得冻结整个 Task，也不得猜测冲突事实的赢家后继续副作用。
5. **边界必须可指认**——只有因果身份、幂等外部 effect、用户权限、操作系统/进程隔离、执行 occurrence fence 和不可逆操作确认可以阻止动作；每个 gate 必须指出它保护的真实边界。
6. **继续工作产生新 occurrence**——completed/failed 是旧 occurrence 的历史事实和 UI 投影。真实的新用户消息自然开启新工作；cancelled/deleted 是用户拥有的明确边界。Host 不为“终态对话”发明专用人格或能力制度。

“投影不做 gate”不等于无校验。不可逆 effect 在提交前必须直接重读原始因果事实、权限、occurrence/epoch 和幂等键；它不能借一个派生 status 代替这些证据。

## Host 的最小正向职责

| 职责     | Host 可以做                                                    | Host 不再做                                      |
| -------- | -------------------------------------------------------------- | ------------------------------------------------ |
| 会话     | 持久化真实消息，按因果顺序提供完整 transcript，执行 compaction | 按 reply target、阶段或 status 隐藏消息          |
| 模型     | 流式转发请求、token、工具调用与 Provider 元数据                | 从模型文本猜状态、替模型选择工作流               |
| 工具     | 暴露环境真实可用工具；验证权限与不可逆确认；幂等执行           | 为任务颜色维护能力表、逐工具包 authority wrapper |
| 事实     | 追加因果事实，投影视图，验证 effect 的精确前置事实             | 把投影写回事实、用投影冻结整个任务               |
| 故障     | 当前 occurrence 一次结算、诊断可见、其他工作继续               | 无限重试、静默 drop、把 Host bug 伪装成用户状态  |
| 生命周期 | 保存用户取消/删除和真实 execution occurrence 边界              | 发明无普通出口的中间态或终态专用会话协议         |
| 并发     | 在真实共享资源边界使用最小且具体的串行化/幂等机制              | 因词汇相似把所有锁、租约、单飞统一成万能原语     |

删除一个机制前只问三件事：它保护哪个进程外或不可逆边界？它能否从原始事实直接验证？删除后真实参与者是否仍能自然观察和继续？第一问无答案，或第二问只能回答“看 status”，默认删除。

## 分期总览

| 期  | 主题                                    | 当前状态                        | 终局退出标准                                                       |
| --- | --------------------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| 1   | 会话原文直达模型                        | 未提交工作树存在过渡切片        | 每次 Provider 请求的消息等于当时规范 transcript（compaction 除外） |
| 2   | occurrence 化继续工作，删除终态能力制度 | 未提交工作树观察到 wrapper 删除 | completed/failed 后新消息走普通入口；无终态专用 Tool 表/处理器     |
| 3   | Instance FIFO 准入 + serving 句柄       | 未提交工作树存在两原语实现      | 无模式升级；并发 open/dispose/serve 有真实运行证据                 |
| 4   | Host fault 局部结算                     | 未提交工作树存在分类切片        | 确定性 Host fault 一次结算；无语义重试风暴                         |
| 5   | 删除侧带与手工能力策展                  | 未提交工作树观察到部分删除      | 工具事实显式可诊断；无 WeakMap authority、无全局手工能力矩阵       |
| 6   | 状态与 gate 扫荡                        | 审计开始                        | 每个保留状态与 gate 都能指出原始事实、真实边界和自然出口           |

顺序不是新的工作流 gate。各切片按事故证据和影响面推进；同一共享机制的问题必须横向覆盖 Task、Mission、Session occurrence、正常/终态、重试/恢复、串并行和多项目隔离。

---

## Phase 1 — 会话原文直达模型

### 目标

每次 Provider 请求都读取该时刻已经持久化的规范 transcript。轮次进行中到达的用户或系统参与者消息也是真实消息；下一次模型请求自然看见它们。除了 compaction，Host 不维护“哪些持久消息这次不许看”的读取策略。

### 当前工作树观察：故障切片存在，但不是本方案交付证据或终局

旧 `promptMessagePrefix` 会按 reply target 截断历史，曾把本轮工作一并切掉，使 prompt 连续 29 步逐字节冻结。当前未提交工作树已删除该 prefix，并引入 `Message.Info.pendingDelivery`、`partitionPendingDelivery` 和 `attachedReplyTargets` 作为过渡修复；这些源码和聚焦测试不属于本次方案校准提交，必须在各自实现切片完成验证、独立审查和提交后才能称为已交付。

这只能证明冻结故障被修复。当前仍在读取时把持久消息分为 visible/deliver，仍依赖 attached-target 内存侧带，因此**不得标记 Phase 1 完成**。

### 剩余删除

- 删除 `pendingDelivery` 作为 prompt 可见性标志，以及 `partitionPendingDelivery` 的读取时裁剪职责。
- 删除 `attachedReplyTargets` 对消息可见性和 reply target 的 authority；reply 关联来自真实 Message 因果边。
- 一个 Provider 请求发出后无需“中途改写”已发送的请求；但任何后续 Provider step/request 必须读取当时完整 transcript。
- UI 与 debug bundle 展示同一套持久消息，不维护模型/界面双路历史。

### 验收

- 正向契约：给定规范 transcript 与 compaction cursor，模型请求消息序列具有唯一明确输出。
- 真实回放：轮次中到达操作者消息、调度消息和 agent 协调消息，下一次 Provider 请求均可见且各回应一次。
- 不以 DOM、源码字符串或 UI 自动化测试代替真实会话回放。

---

## Phase 2 — occurrence 化继续工作，删除终态能力制度

### 目标

completed/failed 描述一个 execution occurrence 的历史结算，不描述“这个 Task 从此只能说话不能做事”。新用户消息通过普通入口建立下一 occurrence/epoch；旧 occurrence 的 effect fence 继续保护旧因果链。用户明确 cancelled/deleted 时才拒绝新工作。

### 当前工作树观察：wrapper 删除存在，但不是本方案交付证据或终局

当前未提交工作树删除了 `withTerminalTaskAuthority`、`TerminalToolAuthorityError`、绑定复制辅助函数和一层重复 throw，并加入操作者消息恢复测试。这些改动若独立验收通过，可消除逐工具 re-wrap 与 WeakMap 绑定蒸发；在实现切片提交前这里只记录观察，不宣称已交付。

当前 `projectTerminalConversationTools` 仍按 terminal + ingress kind 投影缩减 Tool 表，`processTerminalConversation` 仍是专用处理器。这比逐工具 throw 更稳定，但仍是 Host 按 status 策展能力的过渡实现，**不得作为“两态化完成”的证据**。

### 剩余删除

- 只有显式用户/操作者 ingress 能在 completed/failed 后原子追加新 execution occurrence/epoch；该消息随后走普通 Task-root ingress。
- scheduler、agent coordination、恢复和迟到 delivery 必须携带并匹配已经存在的 occurrence；不匹配时持久结算为 stale/superseded，绝不能自行 reopen。
- 删除 `projectTerminalConversationTools` 和 `processTerminalConversation` 的终态专用制度。
- Tool 可用性只由真实环境、安装事实、权限和不可逆确认决定，不由 completed/failed 颜色决定。
- 旧 occurrence 的未决 effect 只能结算自己的精确 outcome；新 occurrence 不复用旧 effect identity。
- `terminal_lifecycle_reference` 若只作为 artifact/version 因果游标则保留并正名；若参与能力或执行 fence 则删除。

### 验收

- completed 和 failed occurrence 接收新用户消息后产生新的普通执行 occurrence，并拥有与普通任务一致的环境 Tool 表。
- cancelled/deleted 返回明确的用户边界结果；旧 occurrence 的迟到 effect 只能幂等结算原请求。
- Task、Mission、Session occurrence 和多项目并行共享同一 occurrence 契约；scheduler delivery、协调和重启恢复只能继续其携带并匹配的既有 occurrence，不能取得 reopen authority。

---

## Phase 3 — Instance FIFO 准入 + serving 句柄

### 当前工作树观察：两原语实现存在，仍待独立实现交付

当前未提交 `project/instance.ts` 删除了 read/write 模式、upgrade/downgrade、`pumpLock`、`demoteWhen` 和锁超时 flag，并呈现以下机制：

- 每 Project 一个可重入的独占 FIFO entry turn，串行 bootstrap、initializer、refresh、rollback、dispose 和 capability preflight；
- serving 句柄只做共享实例引用计数，普通 serving 不互相阻塞；teardown 停止新准入并排空已有 serving；
- detached 工作必须重新 `provide()`，不继承已经关闭的调用方句柄。

该方向符合最小 Host：两个具体机制对应两个不同不变量，不再抽象成通用模式锁或万能 Lease。但只有聚焦验证、完整差异审查和单独提交后才算落地。

### 剩余审计

- 修复会永久为真的 refresh 谓词，避免“每次准入 refresh 一次”成为隐藏抖动。
- 清点所有 detached 生产入口和重启恢复，证明没有继承关闭句柄。
- 保留并发 open/dispose/serve、连续准入下 teardown 不饥饿、跨项目互不阻塞的真实压力证据。

---

## Phase 4 — Host fault 局部结算

### 目标

错误只分为真实外部结果与 Host fault：

- Provider/网络错误仅从 HTTP/transport 元数据分类；
- Host 自身不变量、持久化、装配和程序错误是 `HostFault`，当前 operation/occurrence 一次结算，不进入语义重试；
- 用户拒绝、权限、cancel/delete、工具业务失败是各自真实参与者结果，不伪装成 Host fault。

### 关键安全边界

“不让 Host bug 冻结 Task”不等于“发生冲突后猜一个事实继续”。若冲突可能改变不可逆 effect：

1. 当前 effect fail closed；
2. 若 effect 尚未越过外部边界，持久化精确、脱敏、可见的 Host fault settlement；
3. 每个外部 effect 在执行前必须已有 durable request；若它可能已经越过外部边界但没有 outcome，该 request 的缺口唯一投影为 `unknown/reconciliation_required`，不另写 unknown status/outcome；只能追加至多一个权威查询结果或精确 outcome；
4. 日志和进程内事件仅作诊断，不能替代 durable settlement；持久化失败时不得声称结算完成；
5. 释放不相关 FIFO 和其他 Task；后续显式用户/操作者消息可建立新 occurrence，但不得复用有歧义的 effect identity。

### 当前工作树观察与剩余工作

当前未提交工作树包含 `host-fault.ts` 和工具请求冲突的确定性分类；它意图让 SQLite constraint 不再进入无限 Provider 重试，但不属于本次文档交付证据。后续触发器按真实事故证据逐个分类：追加/幂等/权限边界保留，重复格式校验删除，对 Host 自身写入的执法改成一次 Host fault。禁止无证据批量把所有 constraint 改成“日志后继续”。

### 验收

- 确定性 Host fault 对同一 operation 最多一次执行尝试和一次结算。
- 一个 Task/occurrence 的 Host fault 不阻塞兄弟 Task、其他 Project 或新的合法 occurrence。
- 冲突 effect 没有新的外部副作用；诊断包含 expected/received 和精确因果身份。

---

## Phase 5 — 删除侧带与手工能力策展

- 仅把真正跨函数需要、需要持久化或需要诊断的工具事实放进显式 descriptor；局部实现细节不升级为协议字段。
- 删除作为 authority 的 WeakMap。对象复制不得改变权限、执行模式或协调语义。
- 工具注册表本身是唯一事实源。运行时直接从注册表与真实环境/安装/权限投影本次工具集合，不再维护另一张全局手工能力矩阵。
- 只有发布清单或跨进程协议确实需要静态产物时才由同一注册表生成；生成物不能反向成为运行时 authority。
- `orchestrator/tools.ts` 的拆分以删除策展职责为先，不以把同一矩阵搬进更多文件为目标。

验收：新增一个已安装工具只改其唯一注册事实；普通 Task、新 occurrence、Mission 和恢复路径自然获得一致投影，缺失时返回明确环境/权限事实，而非静默失能。

---

## Phase 6 — 状态与 gate 扫荡

对每个状态、gate、fence、authority 和 retry 分类问四问：

1. 它由哪个真实参与者或进程外事实产生？
2. 它保护哪个不可逆 effect 或用户权限边界？
3. 普通用户或真实外部事件如何离开它？
4. 它属于哪个精确 occurrence，还是错误地冻结了整个 Task/Project？

没有第 1 项且不保护第 2 项的机制删除；没有第 3 项的驻留状态删除；回答不了第 4 项的 Task/Project 级 gate 收缩到 exact operation/occurrence。具体清单见 [state-audit.md](state-audit.md)。

`blocked/integrity_conflict` 的终局不是改名，也不是挑最早事实继续：删除用户 Task 吸收态，把冲突结算为 exact occurrence 的 Host fault；有歧义的副作用 fail closed，后续无关输入继续。

## 执行与验收节奏

- 不新建平行架构分支、feature flag、fallback 或兼容读取路径；每个切片只有一个当前实现。
- 每个非简单切片先在 `specs/records/YYYY-MM/**` 写 Recall、影响面、契约和真实 checker，再实施。
- 每个切片同步更新相关 `specs/current/architecture/**`，删除被替换的旧契约。
- 非 UI 改动必须有聚焦正向测试，并进入真实 checker；涉及真实会话的改动使用隔离开发服务与真实流式 Provider 验收（凭据获得授权时）。
- UI 若受影响，只用真实页面交互、截图和人工视觉复核，不新增或运行 UI 自动化测试。
- 每轮首验通过后由未参与实现的独立 agent 只读审查；有效问题修完后复验、再审查，直到无未解决发现。

## 总退出标准

- 模型在每次请求看到当时完整规范会话，除 compaction 外无读取时消息策展。
- completed/failed 后的真实新消息产生普通新 occurrence；不存在终态专用能力表或处理器。
- Host fault 一次、局部、可见，不消耗语义重试，不冻结 Task，不猜测副作用结果。
- 每个保留 gate 都能指向原始事实、真实边界和 exact occurrence。
- 删除量、状态数、wrapper 数、side-band registry 数和一次请求经过的 Host 裁决点持续下降；不以新增层数、端口数或文件数作为成功指标。
