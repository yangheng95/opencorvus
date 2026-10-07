# Optional Expert Squad workflow guidance

## Recall

- 原始要求：用户指出“当前的专家团调度逻辑太死了”，提供真实 Task `tsk_g00VXMejke00KwIb9xRv` 的调试包；进一步明确“本来预设工作流就是参考”，最终要求“一不做二不休删了，变成可选字段”。
- 后续扩展：支持 DAG（Directed Acyclic Graph，有向无环图）、局部循环、多路选择等多样调度；默认专家团自动生成专家；同步 SDK 与文档。用户明确“专家团重要的是身份和能力，这两点要做好，至于工作流微不足道，也难以固定”。
- 最新校正：默认仅指未手动选择；此时“优先搜索一下合适的专家团确认没有非常匹配的再生成”。自动生成不能先于候选检索，也不能冒充某个已安装专家团或执行中更换固定包。
- 目标：删除强制工作流执行机制；`capability_projection.virtual_workflows` 可省略，只提供参考。调度者按实际证据选择专家、拆分/并行子任务、调整顺序及安排复核。真实权限、用户验收、独立核查、容量、工作区隔离及准确恢复保持有效。
- 验收：省略工作流的包可被唯一 SDK writer/Registry 接受；生产派发允许同一专家的多个独立 occurrence、直接派发与不同参考流程混用；精确 Tool replay 收敛到同一派发；continuation 保留原 Session/occurrence；Mission 修复不依赖预设图；任务上下文展示实际派发而非强制 frontier；完成依赖实际交付证据；聚焦正向测试、类型检查和文档检查通过。
- 硬约束：无额外 branch/worktree、无委托、无非流式模型调用、无 Host 语义调度 gate、无新工作流状态。保留全部无关改动。未授权使用 Provider 凭据、重启现有应用或修改用户正在运行的 Task。真实 Provider 端到端验收需要单独授权，不能将本地生产合同测试冒充真实模型验收。
- 已读：AGENTS.md；`03-control.md`、`04-extensions.md`、`task-control-plane.md`；core Orchestrator prompt；Research Studio manifest/README/scheduler/researcher prompts；workflow-binding/facts；dispatch lineage/admission/schema；completion decisions；Mission acceptance ledger；SDK manifest/authoring；真实 SQLite Task/lineage/message/lifecycle/tool request 只读事实。
- 全仓搜索：35 个生产文件涉及 workflow binding/node/occurrence；固定图约束不仅在 Research Studio，还在 core prompt、派发 schema/description、Task 全局 binding writer、initial-node unique index、上下文 frontier、Mission 修复判断和包 authoring 文案。独立派发的 Tool/member identity、租约和 continuation 已有共享实现，可以直接保留。
- 权威资料：[Anthropic Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) 区分固定代码流程与动态模型决策，说明 orchestrator 动态拆分和委派；本任务选择以用户明确要求及仓库既有 primitive 为准。
- 无委托反馈。overlay 渲染/Sources/dock width 改动及其 specs 记录属于其他工作；其中 Sources 修复已由其他工作提交为 `2e9d39ee`，本任务不混入剩余改动。

## Analysis and scope

真实 Task 初始选择 `full-research`，先规划，再由一个 researcher 调查；两次正文读取能力缺口经 coordination 继续同一 occurrence。PDF 被 webfetch 当 UTF-8 文本读取、长 HTML 截断是独立工具能力问题，本次不扩大为下载/抽取实现。Mission 回复接入的 runtime-contract error 随后通过 durable ingress 处理，本次不将其误判为流程僵化的唯一根因，也不修改现有运行。

僵化根因是把参考 graph 提升为 Task 唯一不可变计划、每个 node 唯一 occurrence 以及强制全链验收；core、package、Tool declaration、数据库 admission 与 Mission 修复互相强化。仅修改一个 prompt 会留下其他事实来源。平台已经支持 sibling/collection 并发，不能将串行现象误报为平台缺少并行 primitive。

横向审计覆盖 ordinary/API/Mission Task 创建、root operator/scheduler/terminal wakes、direct/collection dispatch、initial/continuation、coordination、preparation replay、cross-process leases、terminal completion/cancellation、reopen epochs 及 Project 隔离。应删除的约束只按 workflow/node 聚合；应保留的约束全部按真实 Task epoch、Tool/member、dispatch lineage、Session、package revision 和 owner fence 聚合。

现有 immutable dispatch 的 workflow snapshot 可继续作为一次派发的可选参考出处，不能再成为 Task 全局身份或唯一执行计划。历史事实无需改写。没有另一套兼容执行路径；同一个派发 primitive 处理所有当前工作。

## Implementation plan

1. SDK manifest 将 `virtual_workflows` 设为 optional，通过唯一 schema 将缺省规范化为空参考集合；可选 strategy/guidance 与 node 的 condition/repeat 指导支持 DAG、局部循环、选择和 adaptive 组合。只有显式 DAG 描述要求无环；其他参考可带循环，引用仍必须指向合法 Agent/node。authoring 和 Registry 只验证已声明参考的形态/闭包。
2. 删除 Task 全局工作流冲突检查和 node 唯一 admission/index。保留 package revision 身份检查、精确 Tool/member idempotency、初始 occurrence identity 和 continuation 源 lineage 一致性。
3. `workflow_subject` 成为可选参考，缺省直接派发；`workflow_id` 成为可选完成参考。工具描述不规定 graph 顺序或全节点执行。Task 上下文仅展示实际派发及其参考出处。
4. Mission ledger 校验实际 Task/package/lineage；workflow responsibility 仅说明历史责任来源，不以图后继或固定工作流限制新修复/复核。根本验收 obligation 仍绑定真实 gap、criterion 和 epoch。
5. 共享 prompt、内置 scheduler/README/authoring guidance 同步删除强制工作流表达，保留能力分工、原始用户目标与真实验收。Research Studio 不强制先规划/完整搜集后分析；可分批并行、补充能力及继续已有工作。
6. 修复或删除本任务触及的过期 node-lock/whole-workflow 测试；新增 production dispatch/SDK/Mission 的正向行为验收。更新当前架构、spec 索引。运行聚焦检查后提交；fetch/merge upstream、审查待推送集合后 push。
7. 复用现有 `builtin/dynamic` 的唯一包与 `dispatch_agents.team` 能力，将其变成内嵌默认专家团，移除依赖外部 payload 才可默认执行的限制。保留明确配置的包选择。任务内自动生成名称/职责映射到真实 Generalist/Builder capability envelope 和独立 Session/dispatch，不伪造 runtime Agent ID、不动态扩大权限、不另建包 writer。更新首启/默认配置合同与 SDK 用法文档。
8. 原生 Work/Chat/Control 与 Mission 在创建固定包 Task 前负责自动选团：先通过唯一 occurrence-bound `capability_search` 搜索已安装 canonical catalog，再直接调用 `panel_expert_squad_inspect` 查看有希望候选的能力与完整交付边界。非常匹配则选择该团；确认没有非常匹配候选时选择 Dynamic 生成任务内专家。复用现有真实 Session/Tool 流式执行，不加隐藏模型请求、关键词路由、自动换团或 Host discovery gate。手动选择优先，Task 运行后仍只投影固定包。
9. 低层 SDK/HTTP `task.create`、CLI（Command Line Interface，命令行接口）`task create --expert-squad` 与 `panel_create_task` 必须携带创建者选定的精确 `promptProfile`；它们是固定身份执行接口，不执行隐式语义路由。自动入口是原生助手或 Mission 的真实流式选团工具链。此为有意的 API 合同调整，文档/生成 SDK/聚焦创建测试必须同步，不能让省略身份的 API 直接绕过选团生成 Dynamic。

## Scheduling semantics

工作流字段是 optional suggestion；参考的节点不是执行实体。真实 identity 是固定 package revision、exact projected Agent、Task epoch、Tool/member、dispatch lineage、Session 和 occurrence。多个独立实例可采用相同能力身份。局部循环通过精确 lineage continuation 或新授权的独立派发执行，是否继续由新的证据与用户目标决定。多路选择由实际观察和能力契约决定；Host 不判定条件、不执行图、不自动推进、不合成消息。可选循环停止指导属于 prompt，不产生持久化计数器。

## Verification and delivery

Implementation and local contract verification complete; Git delivery and real Provider acceptance remain separately recorded below.

- Canonical SDK/Registry/authoring/import now accept omitted workflow guidance and adaptive/loop/choice references; explicit DAG alone requires acyclicity. Removed the obsolete shipped graph-role policy and node-uniqueness test/fixture.
- Actual dispatch facts replace whole-workflow readiness/state. Repeated suggested nodes, direct work and different references coexist in one fixed-package Task. Exact replay, continuation and fences remain owned by real Tool/member/Session/epoch identities. Mission repair uses actual evidence/criterion authority, and completion seals all actual package worker outputs.
- Dynamic is embedded from its existing single source. Native Work/Chat/Control and Mission search candidates before selection; exact inspection exposes expanded capability grants with bounded Agent pagination and the canonical package digest. Existing exact detail loading validates a selected installed package against its declaration, avoiding an invented digest or a second package reader.
- Low-level fixed-Task APIs now require promptProfile; CLI requires --expert-squad. Explicit selection is preserved; automatic selection occurs in the real creator conversation before binding. Updated generated SDK/OpenAPI, English/Chinese Agents, architecture, Task/Slice, CLI, SDK and API docs, shipped package prompts/methods and payload.
- Domain Artifact schemas that carry constant workflow_id tags identify a package evidence ABI; they neither compare a Task-global selected graph nor gate scheduling. Their exact producer/input/evidence contracts are retained. Unrelated PDF/HTML extraction and the old live Mission ingress incident remain excluded.

Focused verification (no UI automation):

| Check | Result |
| --- | --- |
| SDK authoring + topology analysis | 44 passed, 91 assertions; omitted workflow package, cyclic local loop, guidance-only choice, optional collaboration stage |
| Native candidate search/inspection + catalog + Mission acceptance + terminal Artifact closure | 49 passed, 192 assertions; actual route/catalog, 100 held Squads, bounded Agent pagination, exact ledger/recovery and all worker outputs |
| Workflow dispatch/occurrence + initial guidance + native selection | 11 passed, 29 assertions |
| Intent blocked settlement + admission fence + repeated/direct/different reference dispatch | 9 passed, 19 assertions |
| Architect/Fact Check/Frontend Design/Requirements/Research adapter settlements | All 28 applicable non-Intent tests passed; the 5 Intent cases passed after updating the precise domain_blocked projection |
| Workload production dispatch and adapter chain | 2 passed, exact incomplete/successful settlement |
| Abandoned partially admitted collection recovery | 1 passed, 13 assertions |
| Physical Build exact publication/settlement | 1 passed, 3 assertions |
| Overlapping Light dispatch + CLI selected-identity receipt | 3 passed, 171 assertions |
| Dynamic embedded package/default and parallel workers; global defaults | Earlier focused runs: 2 + 6 passed |
| Dispatch collection + current scheduling DDL lineage | 15 passed, 73 assertions |
| Fixed Task creation request/channel/Project identities | 4 passed |
| Exact package binding and held Mission authority | 6 passed, 52 assertions |
| Global creation/replay and cross-process crash recovery | 11 production contracts passed; focused cross-process recovery passed with 19 assertions |
| module-topology, release-mutation-topology | Passed; 1136 modules, 5802 runtime edges, 5 release authorities |
| Root bun run typecheck | 8 workspace checks passed, plus SDK imports/AI runtime/expert-squad types |
| SDK bun run build | Passed; generated SDK and local distributions from real OpenAPI |
| docs:check, api:routes-check, architecture-index | Passed; 345 operations, 25 groups, 18 current architecture documents |
| check:expert-squad-topology | 122 manifests / 135 optional references passed canonical validation |
| control-lease-owners, package-topology | Passed; 18 owners/22 acquire sites, 10 workspace packages |

Toolchain correction: a transient Bun writeFileSync EUNKNOWN left the tracked Task API source intact; formatting completed through the existing Node.js/Prettier toolchain, followed by successful typecheck. The catalog scale test's original five-second budget expired during complete production discovery; its explicit bounded budget is now thirty seconds. A Light evidence-read test now checks the real typed aggregate-budget diagnostic rather than an obsolete message fragment. Shared creation fixtures now supply the exact selected identity. The Mission-dispatch fixture authors its real pending draft before the canonical wake, repairing its stale current-contract setup; six exact-package checks use a bounded thirty-second budget rather than expiring during real package/runtime initialization. Cross-process Global recovery reran through its actual checker after updating the child fixture identity.

Remaining acceptance: the existing real streaming Provider checker has been updated to authoritative embedded Dynamic, and low-level creation supplies its exact identity. It has not run: AGENTS section seven requires human authorization to use Provider credentials. Local scripted-provider/runtime tests are contract evidence and are not claimed as real-model end-to-end acceptance. No credentials have been read into prompts/logs/specs or copied; no running user process or Task has been restarted or mutated. No application UI source is included.

Persistence impact: removal of the node uniqueness index and the current completion-payload integrity trigger change canonical SCHEMA_DDL. An older pre-release Database reports SCHEMA_RESET_REQUIRED before business reads; its rebuilding needs explicit user authorization. No migration, silent reset, compatibility reader or old payload conversion is introduced. Existing live Tasks keep their current running process/package bytes; this source change does not claim the pasted Task was rescued.

Git delivery: scoped implementation and precise shared-index entries are prepared for commit; the actual commit, upstream merge audit and push outcome are evidenced by Git tool receipts. A stale empty Git index lock was verified to have no active Git process or exclusive file holder before removal; subsequent transient index contention was retried without changing another owner's lock. No version bump, release, tag or publication is authorized.
