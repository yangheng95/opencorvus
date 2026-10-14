# 406 Phase P：Ask 成功请求 retirement 时机只读横审

## 范围、结论与原始事实

2026-10-14；当前 HEAD `2d800e4a92a1508f1386be8e01a4d309d08f11d6`。遵从 Root 的独立只读授权，不修改 production、spec、SDK 或共享文档，不新增服务/模型。Phase P authority 实现冻结。查询基于当前工作树，不用旧 archive 的源码代替现状。

**结论：正常 Ask Message 完成没有自动调用 canonical retirement writer 的生产边界。** 当前仅恢复路径调用它，首次 Project 缓存初始化执行一次恢复扫描；普通 HTTP/后续 Prompt/物理 Prompt release 都没有补扫保证。成功请求仍保留 `execution_succeeded` 与真实 result，不会再次成为待 operator 批准的卡片，但会留在 `continuationReady` 的恢复候选。完整 normal retirement 时机是共享缺口，不能因 process02 执行结果通过而关闭。

过程证据：`phase-p/process-evidence01/{live-same-project,live-two-projects}/{a-completed,b-completed}.json` 四份原 Tool 所在 assistant 都有真实 `time.completed`；HTTP prompt 200、Tool completed、durable CSV result、自然 final stop 都已保存，但原完整 ledger 只有 `requested → allowed_once → execution_started → execution_succeeded`。process01 原正式 2 pass / 2 fail / 32 assert，失败是检查器多期待一个尚未发生的 `stale`。Root 批准一处期望改为当前执行事件合同；这不改变本文要审的 retirement 产品保证。

`process02` 原 exec 80030 已实际 join1，3 pass / 1 fail / 58 assert。两组双活和 dead-expired 正式通过；dead-unexpired 行为断言完成后，finally 的 metadata 导出对合法 `unknown` request.body 直接访问 `.model` 抛 TypeError。八 child 已物理/输出/请求结算，Provider stop 已执行，但该 case 后面的 resource.stop/cleanup.json 代码未到，不能声称其独立正常资源收尾完整。正式父退出后该 managed runtime 已由外层删除（只读 Test-Path=false）。这是单独 helper 缺陷，不是 retirement 或生产 outcome 故障；原源 `phase-p/process02-checker-before.ts` 与所有原失败保留。

## 唯一定义和全部直接调用

全仓 `rg retireMessageContinuations|resumeApprovedContinuations|resumePermissionContinuation|approvedMessageContinuations`：

| 定义/调用 | 当前精确行为 |
| --- | --- |
| `permission/authority.ts:443–510 completeExecution` | 正常 result + succeeded + effect release 一事务；仅 `mode === full_access` 同事务追加 stale。Ask 不在此退休，避免 Tool→Message 提交间隙丢恢复入口。 |
| `authority.ts:1282–1307 resumeExactContinuation` | unresumable 或明确 StaleContinuation/TaskRootActivationSuperseded 退休；live 保留；resumed 调唯一 Message writer。 |
| `authority.ts:1310–1327 retireMessageContinuations` | 同步 immediate transaction 验 assistant 已 completed、当前 Project + 精确 Session/Message requested、真实 call/tool 的 outcome 后追加 stale。不是 Timer/Bus subscriber。 |
| `authority.ts:1334–1363 retireContinuation / continuationReady` | stale 幂等查询；写失败只记日志。continuationReady 对成功 outcome 返回 true，failed/unknown 与 deny/cancel/stale 不再执行恢复；不要求 Prompt 活跃。 |
| `session/loop.ts:4791–4817` | 精确 Project/Session 校验后，完成 Message + completed/error Tool 的 fast path 直接调用 resumeExactContinuation；Mission 未完成时先原 Mission recovery。 |
| `session/loop.ts:4820–4875` | 取得真实 physical Prompt，逐调用恢复；`completeRecoveredToolMessage` 非 waiting 后再次 retirement，物理释放后重读本 Message 新批准。 |
| `authority.ts:1416–1442 resumeApprovedContinuations` | Project SQL requested 扫描，逐项 continuationReady → recoverContinuation → SessionLoop；每项故障隔离，原事实保留。 |
| `project/instance.ts:1397–1415` | 唯一生产 resumeApprovedContinuations caller。`input.init && !entry.permissionRecoveryStarted`；flag 在 await 前置 true。新 entry:283 初始化 false；只有 cache 重建才重新首次执行。暖 admission 和继承 lease 不保证再扫。 |

全部 `resumeRequest` 生产 callers 也已搜索：

1. `authority.ts:1228–1229 replyValidated`：真正赢得允许决定且 `waiterCount === 0` 才恢复。正常 Ask 的 live waiter 被唤醒后原执行负责结果，无此 recovery caller。重复 reply 没赢决定，也不会补触发。
2. `authority.ts:1384–1398 recoverContinuation`：仅上表 Project 启动扫描调用。
3. `authority.ts:1674–1680 cancelPendingForSessions`：取消事务并发输给已存在允许决定且无 waiter 时才恢复；不是常规已成功请求的退休入口。

`authorizeAndExecute` 唯一生产调用是 `tool/task-tool-invocation.ts:55` 与 `interactive-artifact/mcp-app-host.ts:327`。前者所有实际 built-in/projected/MCP Tool 在 `session/loop.ts:3802,4348,5645` 共用；build/agent 仅 import 不构成另一个 retirement 实现。MCP task poll/handback 仍落同 authority，未发现独立 success retirement caller。

## Normal Message / Prompt 边界

- `session/processor.ts:1725–1747` 根据当前 Task retention/control 正规判断关闭 Message，然后 `Session.updateMessage`。`beforeAssistantCompletion` 在 `loop.ts:1968` 只保留 structured 输出；不退休 Permission。
- `session/index.ts:1450–1580 upsertMessageRow/updateMessage` 在原 writer 持久化不可变完成状态和 Message Updated outbox；没有 Permission import 或调用。全仓 Message.Event.Updated subscribers 只做 protocol/Task projection、Prompt wake 等，没有隐藏 retirement subscriber。
- `loop.ts:3080–3099 finalizePrompt` 收敛 compaction/accepted occurrence/durable reply；`:3484–3497` finally 调 Prompt finish。均不调 retirement。
- `prompt/state.ts:1041–1144 terminatePromptResources/finish` 关闭 callbacks/status/lifecycle/worktree、释放 exact durable Prompt owner 和本地 registries；没有 Permission callback，也不在释放后重新扫描。
- Task-root 在 `loop.ts:1966–1986` 保留同一 activation Message 跨 Tool/provider steps，真正完成时才关闭；其 canonical 完成同样进入 processor/updateMessage。此时不能在每个 Tool success 先退休，但也不存在完成后的 normal 触发。
- Full access 同事务 stale 是独立现有合同，不应将它复制到 Ask result writer；否则重新打开385曾修过的 Tool→Message crash 缺口。

## 全生产入口与 occurrence/控制矩阵

| 入口/阶段 | 实际共享路径 | 已证明/未知 |
| --- | --- | --- |
| Main/Work 普通 public Session、Side/nonTask child、ACP、CLI run | session route:565 → SessionPrompt；ACP:1648/CLI run:665 用公开 SDK prompt；prompt/index:69–91 → loop → processor | 都没有另一个 retirement owner。406 真实过程只覆盖 public 普通 Session + live same/two Project，不冒实际 ACP/CLI/Side 完整验收。 |
| Global Chat | global-chat-start:355–437 → 正常 InstanceBootstrap + SessionWake；wake:256/472 → prompt/loop | 同样 normal 完成缺触发；不凭 entry 名称推成独立机制。 |
| Control / channel | control/message:131 → SessionPrompt；channel/ingress:211 → ControlMessage | 同一路径，不增加隐藏正常扫描。 |
| Task root / reopen / worker / delegate | orchestrator/agent:917,925,1457；agent/runner:1457 等构造真实 prompt；tool/delegate-agent:172；后者各专业 agent 走 runAgentSession | 精确 activation/Task typed control 与 retention 保留；normal success retirement 没额外 caller。旧 Task 两 process cut 有专门通过证据，不能代表本轮 Task live normal 时机。 |
| Mission normal | SessionWake/SessionPrompt 同 processor | normal 关闭缺同样 retirement；本轮未实际跑 Mission normal。 |
| Mission process restart | loop:4804 优先 mission/process-recovery；该模块:149 起原 closure、exact physical owner、frontier、wake/lease | live/unknown owner 保留；真实 recovery 后以原 Tool completed/error 退休。不能用 generic Prompt 抢 Mission 原 owner。旧385有真实死进程边界通过。 |
| 一个 Message 多 Tool、serial/concurrent approvals | approvedMessageContinuations 精确 Message；physical Prompt + exactContinuation 串行器；release 后重读 | 旧6/39覆盖恢复时并发/释放窗口，不是 normal 事件触发。完成 Message fast path 允许退休旧 Message，即使同 Session 已开始后续 Prompt；这基于原不可变 Message，不等同全 Session dead。 |
| 活 Prompt / 活 peer，Message 未完 | 本地 hasOwnedPrompt / durable physical owner保护 | 不能提前退休；旧 live peer test + 新 Phase P live effect 已证明各自局部合同。若首次扫描见 live，flag仍true；同暖 Instance 后续完成无保证再扫。 |
| 原 Prompt 死，result已存而Message未完 | startup → recoverCompletedToolResult → actual completeRecoveredToolMessage → retirement | 旧385 Task result/part两cut正向通过；不是本轮四case（本轮dead是尚无 result → outcome_unknown）。 |
| Message已完，retirement前退出 | 新cache首次扫描→completed fast path→同writer | 代码明确；旧恢复用例覆盖完成/显式重放，406未新增该具体normal completed cut真实过程。 |
| deny/cancel/execution_failed/outcome_unknown | 已有 decision/terminal 排除 continuationReady | 不需要把真实失败硬改success或补假stale；但同Message其他成功请求仍有normal退休问题。 |
| 同DB并行两个Project/多个目录/多backend | canonical requested.project_id SQL过滤 + loop Session.projectID精确验证；每backend/cache有自己的首次扫描 | 本轮两Project完成证明 result owner隔离；不证明 normal retirement。新backend恰在旧ownerlive时扫描后也不会自动在旧owner完成时再扫。 |
| 删除/retention后启动 | task-api/index:3549 settlement允许已有 execution terminal；session/index:1389,2017真实删除；ledger无cascade | **只读风险推导，未过程复现**：success未退休而原Message/Session后来合法删除，下一扫描Session.get/MessageStore.get抛普通NotFound，recoverContinuation保留开候选；可形成跨重启重复日志/扫描。不能据此称已实证数据丢失。 |

所有正常入口仍受已有配置/Project/Task/Prompt fencing，不推荐按 Chat/Task 名称开旁路。未发现权限泄露或二次执行的本轮实际事实；normal Ask 4条链真实 result完整、后续 attempt 已有成功会恢复原结果而非再次执行。

## 历史根因为何未闭合

- `86fbe0bca`（2026-08-15）隔离故障的 Project 首扫：改为调用前置 recoveryStarted=true、吞并记录错误，以免单条坏数据阻止 Project 所有 admission。它主动避免每次请求重试，不提供 Message完成事件。
- `49028f70c`（2026-08-18）给 Full access 同结果事务追加 stale，加入 live Prompt 保护。注释“首个 owner release 后 scan收敛”描述再次扫描的能力，没有安排该扫描触发。
- `e08017392`（2026-10-13，385）修真实 physical Prompt与全Message结算，加入 retireMessageContinuations。原 spec 明确“Tool成功不能先退休，Message完成后才退休”，但生产接线只更新了 recovery路径两处；normal writer未接入。
- 402删除 deny host gate、406 effect physical owner不改变以上触发链。本次源快照可对照 process01/02 actual-authority.ts，不把 peer loop最近compaction改动当退休修复。

## 现存通过证据的准确界限

Phase P related01正式28/97 = permission-continuation-recovery 8/25、permission-message-settlement 10/22、permission-message-recovery 6/39、process-liveness-owner 4/11；没有新增normal Message完成retirement测试。

- settlement:189–204直接 `resumeExactContinuation`、`completeRecoveredToolMessage` 后**显式调用** retireMessageContinuations，证明 writer安全边界；不证明生产normal时机。
- continuation-recovery:307–346先持live owner、释放后**显式再调用** resumeApprovedContinuations，证明二次scan正确；不能替代自动触发。
- message-recovery:217/302真实流式与并发恢复从已有恢复reader主动开始；证明后续新Tool、owner释放交接与Message完整，不覆盖普通live执行后的新触发。
- 历史385 `session/permission-message-process-recovery.test.ts` 三项/24断言：Task result/part真实退出后正式 Instance scan，Mission死owner且另一Tool待批；原 archive README和verification可核。它证明已有启动恢复，不是所有normal成功立即退休。
- Full access测试和Phase P两模式原合同继续有效，不得拿它替Ask。

## 推荐下一阶段（未授权实施）

将现有 canonical retirement writer 接在**真实完成 Message 的唯一发布/写入边界**，继续读原精确 Message+Tool outcomes；保持 Tool未全完成与 retained Task activation不退休。优先审 Session writer同事务/aftercommit现有primitive与import层次后决定接线，不能直接给每个route/Prompt finish加扫描，不建Timer/队列/新状态或在Provider步骤前退休。当前Session/index无Permission import，新增环的运行期影响尚未设计/验证，故此处不是批准可直接改的完整实施方案。

必要正向验收：public普通Ask自然tool→Messagecomplete的完整ledger/result/Tool/Message全集；同Message两个Tool在首个已完/第二个pending时全集；Task retained同activation最终typed completion；normal Mission；completed Message与retirement之间真实process cut再恢复；warm同Project新输入/串并行两Project/活peer；正规删除后cold reopen的明确完整结果与日志（不以absence核心）。保留旧recovery成功，验证无新增effect/原result身份，而不是伪Message或手动retire后声称自动保证。新生产/测试/过程均待Root落独立Recall授权。
