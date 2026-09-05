# Scheduling razor remediation

## Recall

- 用户原始要求：在五轮调度算法审计确认 S1-S10/D1 共 11 项后，开始修复。
- 基线：`a2c63df5293a49165b7608527696e0b4ccca1704`，当前分支 `v0.0.55beta`，上游 `origin/v0.0.55beta`。不另建分支或工作树。
- 授权范围：实现、聚焦正向测试、隔离运行验证、文档、独立只读审查、范围清晰的提交与普通推送。真实 Provider 凭据、用户数据库、用户运行窗口/进程、发布不在范围内。
- 工作区排除：开始时已存在的 release/version/lock/CHANGELOG、Dynamic/Evolution manifests/generated、engine/git.ts、session/index.ts、相关 Git/领域/恢复测试、Web content 和索引中的 release 条目全部为并行任务所有。每次编辑前检查差异，不接管这些文件。
- 已读：仓库 AGENTS.md；2026-09-05-scheduling-razor-reaudit.md 全文及 Recall；当前 task-control-plane、03-control 和调度历史 Cut8/8c；当前 tool execution coordinator、control lease query、recurrence、Automation origin/frontier/projection、Event receipt schema。
- 全仓搜索：所有 ToolTurnExecutionCoordinator 调用/测试；Recurrence.nextRun 全部调用、reschedule 与 active/paused 准入；Automation frontier 的 SQL 约束；TaskControlDriver、Scheduler Message 与 Mission discovery；Event fire/live/recovery/head/receipt。具体证据已在审计台账，修改前继续核对调用闭包。
- 独立 agent 反馈：沿用本轮前的三线五轮只读审计。实现由 Automation、Event、Scheduler/Orchestrator 三个限定范围 agent 与主 agent 分工；未参与实现的 delivery_review 只读审查，多轮复现和纠正页尾饥饿、运行中新事实遗漏、revision 读取故障热循环、exact Fire permit 泄漏和 teardown 准入等待环。最新复审仍在执行，结论以文末最终交付台账为准。

## 根因和影响面

审计记录为完整现象、触发、根因、旧路径未根治、反证和未知项的基线。本计划不以 checker 或局部 mock 替代真实生产入口验证。

| 切面 | 已证根因与影响 | 选定单一实现方向 | 必须保留 |
| --- | --- | --- | --- |
| S4 | parallel Tool 失败用 prior snapshot 改写共享 claim；错误接纳混合决策或留下幽灵占位 | 一个 committed decision 加精确在途 claim；只撤销当前调用，并覆盖准入拒绝出口 | assistant 级决策完整性、真实 exclusive 控制结果、持久 receipts |
| S5 | 当前 lease 使用历史相关反连接；failure writer 全历史投影 | 用现有排序索引取当前赢家；exact Fire 限定失败 runs | transaction、fence、历史事实与多 target 隔离 |
| S2 | readiness 上界与 fault retry 下界混成最小时间 | 独立的进程内 retry-not-before 同时约束重复扫描 admission 与 timer；新事实输入明确可重试 | 取消即时性、Project context、有限唤醒 |
| S3/S8 | 无未来 occurrence 被当语法错误；手动时区变换未保留有效集合/COUNT | 一个 total recurrence 结果与严格时区集合语义；合法耗尽正常结算、清 frontier | RFC 5545、宿主时区独立、原 Fire 身份 |
| S9/S10 | timer eligibility 与 manual command 混同；重入由 boolean/now 重释 origin/due | 遵守已公开的 paused manual run：保持 paused；执行只读 exact Fire origin/due 决定 successor/restore | 一套 Fire/attempt/run/receipt、原 scheduled sibling、稳定 Tool identity |
| S7 | 永久 Session tombstone 被 transient retry 捕获 | 明确 target_deleted disposition，终态推进 exact head | 真实 tombstone 检查、暂时故障重试、Mission opened fence |
| S1/S6 | 有界固定页等待完成才能发现；Event 持久 backlog 再复制成无限 Promise | 复用有界物理 admission，将发现与完成分离；按空槽持续发现，Event 仅接纳可运行 head | key 内 FIFO、独立 runtime/Project owner、shutdown/cancel settlement |
| D1 | 两份当前文档仍教不同 lifecycle | 03-control 链接单一 task-control-plane，删除旧 row/retry/replan 描述 | 当前公开输入路由和 epoch 权威 |

契约闭包调整：`nextRun` 合法为空需要同步 SDK、API 与 Overlay 类型，以及列表下一次时间计算的 null 过滤；因此增加一次真实 `/ui` 人工交互和截图复核，不运行 UI 自动化。当前 DDL 与 transfer checker 同步修改，未操作用户数据库，也不添加旧 schema 兼容 reader。

## 实施与验收顺序

1. 修 S4 与 S5 的小范围共享 primitive，运行真实 coordinator/reducer 接线、current lease/SQL 正向测试。
2. 修 S2；以实际 driver 和 heartbeat 入口验证故障重试、no-progress、正常新事实、取消与多 Project。
3. 同步收敛 S3/S8/S9/S10 与 S5 exact Fire writer，改齐全部生产调用、projection、schema/DDL、Tool 和 API 契约；有限规则/DST/manual/重试/终态正向验证必须进 Automation 真正 executor/receipt 路径。
4. 修 S7/S6 和 S1 全部发现入口，验证多页快慢混排、Event backlog、Session deletion、跨 Project、重启与取消；不以纯队列 fixture 冒充服务路径。
5. 更新当前架构与本记录，运行文档、类型、route/schema/control/topology 相关检查。独立审查完整差异、运行证据和未完成边界，修正并复审到零有效发现。
6. 仅提交本任务路径/hunks；每次推送前 fetch/merge upstream，检查完整待推送提交集合并通过正常 hook。记录精确结果，保留所有并行改动。

## 验证台账

### 实现闭包

| 项目 | 当前实现与正向证据 |
| --- | --- |
| S1 | Automation 与 Scheduler Message 使用单 owner、有界 workers、按空槽动态发现；同一 drain 运行中，新输入、后来到期、后出现 Project 可继续入场。Task heartbeat 只保留未接纳页项，发现 scope 先退出，每个物理 scan 独立持有 Project scope；Mission recovery 用有界 lazy source。真实 65+2 recipient、65 Automation、跨 Project、慢首项、重启测试验证 receipt。 |
| S2 | fault retry-not-before 与 readiness 独立；重复 hint 不冲掉退避，canonical revision 变化才证明新输入。运行中新事实获得下一 pass，读取 revision 失败也受退避约束。真实 driver、timer、heartbeat 35 项组合通过。 |
| S3 | Recurrence.nextRun 对合法耗尽返回 null；终态 receipt 不回滚，清 frontier；新 revision 计算不使用旧 revision 更早的完成时间。第五次执行前失败、finite terminal、新旧 revision 历史与 strict transfer 正向验收。 |
| S4 | 一个 committed decision 加每调用精确 claim；失败只撤回自己的 claim。真实流式 Orchestrator 两种并行交错、第三种决策 typed conflict、数据库重开后 reducer/receipt 一致，3 项通过。 |
| S5 | 复用现有 target/time/ID 索引 seek 当前 lease，批量调用一个 SQL；EXPLAIN 测试直接调用生产 SQL 构造器。Automation failure writer 限定 exact Fire，而非全 revision 历史。 |
| S6 | Event durable backlog 只发 discovery hint；仅可运行 head 持有 physical permit，不再构造每 Fire Promise/reservation/jobTail。共享 Instance 先关闭准入再广播取消，之后新登记的 draining-owner background 即时取消；已入场 callback 完整结算。 |
| S7 | canonical Session tombstone 产生 target_deleted 终态 receipt，并推进 exact definition head；临时错误保留 retry。真实 Event backlog/deletion/restart/teardown 测试。 |
| S8 | 一个 rrule 补丁，沿用已有 Luxon；严格本地字段 roundtrip 在 COUNT/BYSETPOS 前排除 gap，fold 取最早 instant，UNTIL 和显式日期集使用确切 instant。删除旧 floating helper。无 COUNT 的 after/between 查询在 RFC offset 保守窗口外跳过历史转换，完整 BYSETPOS 集合与 COUNT 路径保持原语义。 |
| S9 | paused manual 在 API、Tool、claim、DDL、retry、receipt、projection 一致可执行且保持 paused。隔离真实页面 Pause→Run now 最终显示 Paused / Succeeded / Next run Never。 |
| S10 | executor 只读 exact Fire origin/due；manual retry 保留 Fire；终态恢复原 pristine scheduled sibling，缺失时必须证明 recurrence 耗尽；Tool replay 复用原 due，不以新 now 改写身份。 |
| D1 | 03-control 删除旧 Retry/Replan 与 Task row 生命周期，链接唯一 task-control-plane；修订 heartbeat、startup、Automation/Event 当前契约。 |

### 复审中新问题与处理

1. heartbeat 部分页拒绝后重复快前缀：只保留未接纳项，真实 tail 最终接纳。
2. discovery scope 等待下一 scan scope 与 teardown 互等：离开发现 scope 后逐个获得独立 owner；不等待整个 Turn 才翻页。
3. async iterator 在 next 返回后取消、generator 收尾和发现异常：统一 worker settlement 与 iterator.return；支持消费结果而不累积成功历史。
4. 新事实在旧 scan 失败期间到达，错误地被记为已观察版本：以每个实际 scan 的 revision 为准；revision 读取失败走同一退避。
5. Automation 初次查询 exact Fire 抛错泄漏已交接 permit：查询进入统一 try/finally；后续命令实际获得 permit。
6. Event retry timer、嵌套 Scheduler initialized owner 在 teardown 开始后登记 background：先登记现有 teardown park，再广播取消；晚登记者共享准入取消；exclusive refresh/bootstrap 仍能安装新 state 恢复。同步 abort listener 和异步 draining owner 两个时序均通过。
7. fresh SessionWake 漏传 caller signal：接回已有 reservation 取消路径，真实 Mission delivery/receipt 与 teardown 测试通过。
8. S8 历史候选转换成本：独立复现 MINUTELY 一个月 45,120 候选约 1369ms；增加无 COUNT 查询的保守历史剪枝后，同查询实际为284ms，输出保持2025-02-01T00:01:00Z。不增加缓存或第二个求解器；COUNT 仍需逐项统计有效历史，不宣称常数复杂度。

### 依赖安装与可重复性

- `rrule@2.8.1` 维持原 BSD-3-Clause 许可，ESM 与 ES5/CommonJS 使用同一修复；补丁仅复用仓库现有 Luxon 3.6.1。考察的另两种 recurrence 库未满足 gap/COUNT 语义，因此未引入。
- Bun 不会从 patched package.json 重新构建依赖边；根工作区显式声明同一 catalog 的 Luxon，保证隔离安装时 rrule 可解析它，不形成第二个版本或策略面。
- 私有 registry 初次 lock 安装 ConnectionClosed，改用官方 `https://registry.npmjs.org` 完成 lock 更新及独立 clean install。没有依赖版本升级。
- 已有 node_modules/rrule 指向并行 benchmark 的 junction；没有修改其目标。验证使用本工作区独立安装目录，保留外部 benchmark 依赖。

### 已完成验证（组合有重叠，不将计数相加）

| 命令/验收 | 结果与边界 |
| --- | --- |
| `bun test test/task-control-liveness.test.ts test/scheduling-razor-primitives.test.ts` | 35 pass，73 assertions；真实 driver/heartbeat/lease SQL/coordinator，包含故障与新事实。 |
| `bun test test/orchestrator-streamed-dispatch-settlement.test.ts` | 3 pass，15 assertions；真实流式 Orchestrator、持久 Part/receipt、重开 DB，受控末端 Provider。 |
| `bun test test/scheduler-recurrence-contract.test.ts` | 12 pass，29 assertions；Bun ESM + Node CommonJS，三个宿主时区，COUNT/UNTIL/gap/fold/日期集/剪枝窗口。 |
| `bun test test/scheduler-automation-remediation.test.ts` | 9 pass；真实 SQLite、claim/executor/receipt/transfer，末端 wake 使用局部适配器。 |
| `bun test test/scheduler-task-root-message-schema.test.ts --timeout 120000` | 8 pass，105 assertions；跨页与跨 Project 实际 materialization、fresh Mission cancellation、nested teardown。删除旧负向断言后对应 closure 单例再过。 |
| Event/Instance 聚焦组合 | Event6文件36 pass；最终 Instance/Event/initializer/refresh20 pass，追加生命周期8 pass；共享关闭修复后原 Scheduler 死锁单例通过。 |
| Mission process recovery / SessionLoop authority / cancellation | Mission6个真实跨进程用例通过；SessionLoop9与取消3个用例通过。 |
| `OPENCORVUS_SCHEDULED_E2E_VISUAL_HOLD=1 bun run script/scheduled-automations-e2e.ts` | 隔离真实 HTTP 服务、SQLite、两个新 Git Project、worktree 与本地流式 checker Provider；result.json outcome=passed，findings=[]。run_id=20260905143825-5941cc78。 |
| 真实 `/ui/` 人工验收 | 使用本任务新建后台浏览页，端口53330；有限规则列表与详情正确显示 Never。人工暂停后运行，持久 succeeded receipt 与 Paused 状态可见；截图已实际查看。无 UI 自动化。 |
| `bun run typecheck`（根） | SDK/runtime/expert-squad 检查及8 package typecheck全部通过，66.98秒。 |
| SDK build、`bun run docs:api` | 成功；生成变更仅 SDK/OpenAPI nullable 契约，API 文档生成未产生额外 diff。 |
| docs:check / api:routes-check / architecture-index / control-lease-owners | 全部通过；339 ops、34 route files、16架构文档、18 owners/22 acquire sites。 |
| Overlay `bun run build:vite` | 通过；实际 `/ui` 使用该产物。现有大chunk/重复import构建提示不作为视觉验收替代。 |

### 证据边界与剩余工作

- 真实模型/真实 Provider 质量未验收；全部模型请求使用隔离本地流式 checker，不读取用户凭据。
- 额外 UI manual 的第一次 Provider activity 出现180秒 idle，日志 `activity retry`（attempt=1, cls=idle, lastHeartbeat=first-byte）后第二次成功。数据库证明主要延迟在 Provider activity 内，两次 attempt 后真实成功；UI 的30秒请求提示超时，重新读取可见 Succeeded。该观察不能描述成无异常的 UI 端到端完成，也不能据此判为调度死锁；流传输首次停顿原因未确定，保留独立诊断边界。
- Task wait 两处夹具已改用真实 claim 投影（不是 raw definition），新增 exact Fire/attempt/lease 正向断言；完整12 tests、28 assertions通过，生产入口无需放宽校验。
- 最后更新 checker，增加 finite paused manual 真实 API/Session/流式输出/receipt 验收；最终运行 `20260905145911-0dd53a9f` 在约71秒完成，outcome=passed、findings=[]，唯一 activity retry 是预定注入的 project-two HTTP503。日志位于系统临时目录 `opencorvus-scheduling-razor-final-e2e.log`，独立 result.json 保留请求和身份记录。
- 最终独立 reviewer 对 Event/Instance/Scheduler 再跑22 tests、133 assertions全部通过；复核全部调度自有代码，0新增有效发现、0未解决已确认代码问题。该结论不把已说明的 Provider/UI 观察扩大为无异常验收。
- 最终 Automation/recurrence/claim/Tool recovery/Task wait 五文件组合：69 pass、0 fail、315 assertions，140.75秒。最终根 typecheck 8 packages通过（57.41秒）。package/module/release-mutation topology检查均通过。
- 触及测试中的旧负向断言改齐：Event 查询精确 canonical ID 集合，排队 Fire 明确 pending，compaction 共存场景绑定真正决策 assistant ID，frontier 全量相等，transfer 逐条验证 owner/expiry。三文件56 pass（662 assertions），独立反馈补强两处 exact 契约后对应两文件29 pass（57 assertions）。未改变生产代码。
- 所有确认的调度代码问题与交付检查已完成；范围提交与正常推送的具体交付标识见本任务提交记录。并行 release/version、Git/domain/Session retention 工作不在本次提交内。
