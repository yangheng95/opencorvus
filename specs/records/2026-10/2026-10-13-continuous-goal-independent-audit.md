# 持续目标独立存储与工具审计

## Recall

- 用户要求：“独立agent测试并修复可能的问题”，对象为已完成的 Chat/Task/Mission 持续目标功能。
- 本审计受主 agent 委托，仅在已授权工作树 `C:/Users/hengu/.codex/worktrees/continuous-goal-mode/opencorvus`、基线 `f507df21d` 工作；不再次委托。主 agent 负责 controller/runtime/restart、索引与汇总验证、提交和推送。
- 范围：`continuous-goal/store.ts`、`schema.ts`、`tool/continuous-goal.ts`、`server/routes/continuous-goal.ts` 的持久化、授权、revision、作用域/计量、取消/归档恢复合同。独立新增 `test/continuous-goal-independent.test.ts`。
- 硬约束：先证据分析与方案落盘再改实现；真实数据库/路由/工具合同；只验证正向明确状态、值和错误合同；不增加或运行 UI（User Interface，用户界面）自动化，不启动额外真实 Provider 消耗，不触及主工作区并行修改。
- 验收：使用隔离 Bun 1.4.0 执行 `packages/opencorvus/script/run-tests.ts test/continuous-goal-independent.test.ts`，确认复现用例从真实失败到通过；覆盖三 owner、重放/修订号、子执行/跨项目授权、归档恢复及在途结算。记录完整日志路径；主 agent 再整体验证。
- 初始 `git status --short` 为空。既有验收记录只作为场景线索，不作为本次正确性证据。

## 已读资料与全仓搜索

- 已读 `AGENTS.md`、`specs/current/architecture/continuous-goal.md`、`task-control-plane.md` 的持久化/生命周期/权限合同、原方案 `2026-10-13-continuous-goal-mode.md` 全文与 Recall。
- 已读四个受审源码、原 `continuous-goal.test.ts`、真实测试运行器与隔离数据库 fixture；追踪 `task-session-lineage.ts`、`engine/store.ts` Mission 精确归属查询、`Session.setArchived`、`EngineService.setTaskArchived`、`UsageLedger.record`、ProtocolStore 和 Task 工具执行权限解析。
- 全 packages 搜索 `resolveGoalOwner|goalOwnerForAgent|goalScopeSessionIDs|createContinuousGoal|updateContinuousGoal|captureContinuousGoalUsage|pauseContinuousGoalForArchive|inheritedContinuousGoal`：所有生产写入口共用 store；native Tool 与 Task projected Tool 共用 execute；路由也使用同一 store；LLM（Large Language Model，大语言模型）流式请求开始捕获计量关联，UsageLedger 同事务插入真实行与关联。
- 原事件记录、owner、预算和错误 schema 没有平行实现；相同功能的 Delivery Slice Goal 已按原方案明确排除。

## 修改前问题深度与影响面

### 待复现 A：归档 owner 被排除导致重叠目标

- 可观察静态事实：`createContinuousGoal` 的重叠检查调用 `resolveGoalOwner(other)`，该函数把已归档 Session/Task 作为 `owner_unavailable` 抛出；创建循环遇到此错误直接跳过。恢复 owner 只恢复可见性，原目标保持 paused；`updateContinuousGoal` 恢复 active 时不检查重叠。
- 触发假设：Mission 有未完成目标，归档 Mission Session；对子 Task 创建独立目标；恢复 Mission 并显式恢复原目标。此时同一 scope 有两个未完成目标，违反当前架构“at most one unresolved goal owns any overlapping scope”。反向为归档子 Task 后给 Mission 创建目标。
- 控制流根因候选：把“当前可执行/可见”当作“持久化目标所有权仍存在”的过滤条件。原归档修复只确保暂停事实，没有验证归档期间的重叠创建。创建和计量均复用相同解析逻辑；若复现成立，不能只在恢复时做局部拦截。
- 影响：Mission 与 Task 两种 owner 有真实跨树重叠；Chat 仅有主 Session 子树，不能通过公共合同为普通子 Session 创建独立 Chat goal，但同一共享逻辑仍须回归。并行目标会使 `inheritedContinuousGoal` 取第一个匹配，目标计量与续跑权限可能歧义。跨项目查询仍有 project identity 过滤；需要测试确认。
- 修复方向：保留统一 owner 身份解析，区分“身份存在”与“允许当前操作”的明确内部选项；未完成目标包括归档 owner 继续占用 scope，只有 complete 或真实删除释放。公共 mutation 仍要求 owner 可用。不增加状态表或兼容路径。

### 其他独立检查

- requestID 重放、同 identity 不同输入、stale expectedRevision、complete 后新目标、迟到计量，均用真实数据库和 HTTP（Hypertext Transfer Protocol，超文本传输协议）路径重新验证。
- Worker 的创建/更新授权、Mission 子 Task 的继承读取与计量继续核对；当前 `get_continuous_goal` 共用 mutation owner 解析，是否与 worker 可读取的公开合同冲突待实测并向主 agent 报告。
- 取消/关闭与同毫秒的事件顺序已有序号合同；此审计测试非 active 修订是否改变停止语义。控制器/物理恢复由主 agent 独立处理，发现越界问题只传证据。
- Schema、接口格式、SDK（Software Development Kit，软件开发工具包）、UI 暂无已确认需更改；若内部修复保持公开 schema，则不生成接口。无版本更新或发布。

## 实施与结果

### 首轮独立验证

- 隔离 Bun 1.4.0、真实 SQLite（Structured Query Language Lite，嵌入式数据库）与 Hono HTTP 路由/原生 Tool：12 项中 10 pass、2 fail、86 assertions。
- 两个失败均为明确错误合同：归档 Mission 后对子 Task POST、归档 Task root Session 后对 Mission POST，均实际返回 200，预期为 409 / `ContinuousGoalError.data.code=overlapping_owner`。
- 日志：`C:/Users/hengu/AppData/Local/Temp/continuous-goal-independent-20261013/before.log`。这是独立新用例的失败证据，不引用此前通过记录。
- 三类 owner 的创建/读取/重放、输入冲突、旧 revision、Worker mutation 拒绝、继承计量、完成后迟到结算及归档恢复已通过。Worker 默认角色不分配目标工具；保持其继承上下文和汇报合同，不扩大工具授权。

### 待复现 B：保留历史的删除被当作可用 owner

- 当前删除事实由 `Session.deletedInTransaction` 读取 `session.deleted`；`EngineService.deleteSession` 对 Mission、带 globalChatStart/panelCreation 的 Chat 和绑定 Task 使用 tombstone（逻辑删除事实）保留 Session 历史行。
- `resolveGoalOwner`、`goalOwnerBoundary` 未读取 Session 删除事实，只有 Task 自身检查 `taskDeletedInTransaction`。因此 Chat/Mission 在删除后仍可能投影 active，并被公开目标路由继续读取/更新。原验收的 owner unavailable 只覆盖行不存在和归档，未覆盖历史保留。
- 影响：Chat/Mission 创建、更新、重放、继承及 controller 扫描；Task 当前 task tombstone 已有检查，但其 root Session 的删除也必须遵守共享事实。删除后的在途 usage 仍应结算到旧目标身份，不能通过删除关联或替换账本遮蔽问题。
- 修复方案：统一使用现有 `Session.deletedInTransaction`；在 owner 身份解析、工具身份准入和边界投影读取同一事实。已删除 owner 不参与重叠阻塞；归档 owner 则继续保留未完成 scope 所有权。公开 schema 和错误码保持不变。
- 分工：主 agent 已同意本审计修改边界开头的 tombstone 判断；Chat process.shutdown 被误判为用户取消的候选由主 agent 取证，本审计不修改取消原因分支。

### 删除复现与实施

- 加入真实 `EngineService.deleteSession` 后，15 项得到 11 pass、4 fail、96 assertions；Chat/Mission 返回 `status=tombstoned, sessionHistoryRetained=true`，但 `readContinuousGoal` 仍投影 `status=active`，并保留 37 token 的真实 usage；Task 删除投影已正确。完整失败日志为 `C:/Users/hengu/AppData/Local/Temp/continuous-goal-independent-20261013/deletion-before.log`。
- 生产修改只在 `continuous-goal/store.ts`：`resolveGoalOwner` 加内部 `includeArchived` 选项，当前操作默认仍要求可用 owner；重叠检查与继承上下文允许读取归档身份。创建及 active 更新共用 `assertExclusiveGoalScope`，在原 immediate transaction 中重读全部未完成目标。
- 归档 owner 的 scope 仍来自现有 `Session.parent_id` 树和 `listAllMissionTasks` 的 project/source/actor/mission ID/canonical Session ID 条件。新增选项没有写入配置、状态或平行所有权。
- `resolveGoalOwner`、`goalOwnerForAgent` 和 `goalOwnerBoundary` 使用现有 `Session.deletedInTransaction` 读取 terminal deletion；Task 自身沿用 `taskDeletedInTransaction`。归档时间按数据库 null 合同判断，值 0 也属于已归档。
- 计量仍由 ProviderUsageEvent 原始行与 `continuous_goal.usage` 关联唯一确定；修复不复制 token 总量、不更改在途捕获。归档期间子 Task 继续继承原 Mission 的 paused 目标，用量结算后恢复仍为同一 identity；真正删除后已捕获的回调仍可把晚到 usage 记回旧 goal。
- `schema.ts`、原生/投影工具和公开路由无需修改。模型语义授权仍来自当前工具描述；子 Worker 获得继承上下文，创建/更新返回明确 `owner_forbidden`。

### 修后证据与覆盖边界

- 验证命令（工作目录 `packages/opencorvus`）：`C:/Users/hengu/AppData/Local/npm-cache/_npx/214ebe133ee6a004/node_modules/bun/bin/bun.exe script/run-tests.ts test/continuous-goal-independent.test.ts`。
- 修后完整结果：**15 pass、0 fail、119 assertions，测试 68.30 秒，runner 70.14 秒，exit=0**。完整日志 `C:/Users/hengu/AppData/Local/Temp/continuous-goal-independent-20261013/after.log`。`git diff --check` 通过。
- 三类 owner 均验证真实 HTTP 创建/读取/更新/重放、同 requestID 异输入 conflict、旧 revision 冲突、原生 Tool 与路由投影一致、Worker 明确 mutation 拒绝、后代计量、完成后新 goal 身份隔离、迟到 usage、时间值 0 的归档拒绝合同、恢复保留 pause、真实保留历史删除和跨项目 GET/POST/PATCH 权限。
- 额外验证两个 scope 方向：Mission Session archive → child Task create 返回 409/overlapping_owner；已 completed Task 经真实 `EngineService.setTaskArchived` archive → Mission create 返回相同合同。两边 restore 后显式 active 更新成功，同 identity、原累计用量保留。Mission archive 期间 child Task 的 41 token 仍准确关联该 Mission goal。
- 本次测试使用真实隔离数据库、production Store/Tool/HTTP handler、Session archive、Task archive 和 Session retained-deletion 实现；owner 创建使用合同夹具，未声称真实模型端到端验收。Chat 删除用公开 Session metadata writer 标记 globalChatStart 保留历史条件，用于进入当前实际 retained-deletion 分支。
- 未运行新的真实 Provider、UI 自动化或视觉验收；未做物理 crash/restart，主 agent 负责控制器与跨进程恢复验证、类型检查、文档检查、索引、最终审查和提交推送。本子任务未提交或推送。
- 结束前 `git status --short` 已核对：本审计只修改 store、新测试及本记录；主 agent 的 runtime 测试、Provider fixture 和索引修改保持原样。本记录受既有 `/specs/` ignore 规则影响，已提醒主 agent 精确 force-add 本文件，而不是修改 ignore 或扩大加入范围。
