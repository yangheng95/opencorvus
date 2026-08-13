# CS-001 — Build terminal-fact publication authority

## Recall

- 用户要求持续根修代码气味，CS-001 必须让 Build 的成功物理结果只有在 Host observation 或 typed infrastructure fact 持久化后才可 settlement；旧 observation writer 与 infrastructure fallback 双失败不得再落成 `terminal_success`，并且同一 observation identity 必须能够 exactly-once 恢复。
- 验收指标：真实 Build adapter production path 在 canonical publication write 失败时返回 typed non-success；相同 publication identity 重试后只存在一个 durable fact，并按该 fact 收敛为 `terminal_success` 或 `partial`；无异常的合法结果仍成功。
- 硬约束：一个 publication authority、一个当前 writer 选择，不保留 fallback、双 writer、log-only success 或第二 settlement seam；不改 UI；聚焦正向测试、typecheck、diff-check；不触碰并行 provider/fact-check/overlay/workspace/generated 与共享 spec indexes。
- 已读资料：`AGENTS.md`；连续审计 CS-001；`build/agent.ts`；`orchestrator/build-tool.ts`；`engine/persist.ts`、`artifact.ts`、`engine.sql.ts`、`store.ts`、`dispatch-settlement.ts`、`dispatch-lineage.ts`；`agent/dispatch-outcome.ts`；`specs/current/architecture/task-control-plane.md`；相邻 adapter production-chain tests。
- 全仓搜索：`BuildAgent.run` 是 `recordTaskLevelBuildHostObservation` 的唯一 producer；其 catch 再调用 `recordTaskInfrastructureError`，而该 helper 的 catch 只 log。`RunOutput.infrastructureObservationLocators` 为空时 Build adapter 唯一 consumer 直接返回 `terminal_success`。现有 dispatch settlement 已正确只从 typed outcome 投影 success，无需第二 settlement primitive。Engine Artifact ID 已可由 caller 提供，但两个 writer 都不是 same-identity replay authority。
- 旧路径未根治原因：`partial` 取决于 fallback writer 成功返回 locator；两个独立 append writer 没有共同 occurrence identity，第一写的失败也没有 typed receipt，因此第二写再失败会退化成“没有错误”的空数组。
- 独立 agent 反馈：无；本轮实现完成后由父 agent 安排未参与实现的独立只读审查。

## 根因与影响面

物理 Build Turn、Git workspace observation 和 dispatch settlement 是三个事实。当前代码把 durable terminal fact 当成 best-effort 副作用，adapter 却把“没有 locator”解释为成功。根因不在 settlement consumer，而在 Build producer 没有一个 required publication result。

本项限定在 Build terminal publication：保留现有 `build_host_observation` 与 `task-infrastructure-error` 公共 Artifact 契约，不新增影子表或新 Artifact kind。公共 HTTP/OpenAPI、数据库迁移、其他 adapter 与 UI 不变。为了 exactly-once replay，两个既有 canonical persist 函数接受 caller-owned exact Artifact ID，并在同 ID、同 task/kind/payload 时返回既有事实；identity drift 必须抛错。

## 设计

1. 新增 Build-owned `publishBuildTerminalFact`。一次物理结果在任何持久化前分配一个 observation ID，并把完整 publication input 保留到返回。
2. publication 根据已完成的 Host 采集事实只选择一个 writer：无采集错误时写 `build_host_observation`；存在任何采集错误时写一个聚合的 typed `task-infrastructure-error`。禁止 observation 写失败后改走 infrastructure fallback。
3. publication 返回 discriminated receipt：`terminal_success` 携 exact observation locator，`partial` 携 exact infrastructure locator，`publication_failed` 携 observation ID 与 typed failure、但无伪造 locator。
4. Build adapter 只消费该 required receipt：success -> `terminal_success`；partial -> `partial`；publication_failed -> `partial`（无 locator）。删除 `infrastructureObservationLocators` 空数组推断。
5. 相同 publication input 重试调用同一个 canonical writer。persist 层对 caller-owned ID 做同值幂等读取，保证一个 Artifact、一个 catalog revision、一个 exact locator；不同值复用同 ID 是 typed conflict。
6. production `createBuildTool` 构造期只解析一次可测试的 `runBuild` seam，默认且唯一 production caller 使用 `BuildAgent.run`。不注入 writer 或 settlement seam；writer fault 在 Build-owned publication primitive 边界控制。

## 独立 reviewer 阻断与修复

- reviewer 证明原测试在 adapter fake `runBuild` 中直接调用 publisher，首次 final `partial` 已进入 dispatch settlement；随后测试侧直接调用 publisher制造的 Artifact 不被同父 Tool replay 或 continuation真实消费，因此不构成 recovery。修复后删除 adapter-level `runBuild` seam：聚焦测试必须进入真实 `createBuildTool -> BuildAgent.run -> runAgentSession -> observation -> publisher -> adapter outcome`。仅保留 writer 以下的 fault seam。publisher 在同一个物理 occurrence、返回 BuildAgent/进入 final dispatch settlement 前，以同一 immutable input 和 ID 执行最多两次写入；首写异常、次写成功直接收敛为 `terminal_success`，两次均失败才返回 `publication_failed`。
- reviewer 证明 current-project Build 会先创建 `refs/opencorvus/build-observations/<occurrence>/{base,head}`，Task 删除却只从 `build_host_observation` 枚举 ID；infrastructure fact 或 publication failure 会留下不可枚举私有 refs。修复后只有 observation-success 保留 refs供exact-file reader使用；typed infrastructure partial 与 exhausted publication 均在 BuildAgent 返回前受监督删除两个 refs，cleanup失败自身替换为 typed `publication_failed`，不得静默 settlement。
- reviewer 证明旧测试未进入真实 Build physical path，且未覆盖 exact-ID payload drift。新测试以真实 Base Build Session、真实 Git observation、真实 publication/dispatch settlement运行；只 mock model processor。它验证同 occurrence 两次 writer输入逐字相同、recovery发生在 final terminal settlement前、exhaustion后两条ref均不存在，以及 production写出的ID用不同payload replay会抛 exact publication identity drift且Artifact仍唯一。
- 第二轮 reviewer 证明 ref publication 仍不属于完整 terminal owner：首个 ref 成功后，第二个 ref、Agent Turn、provenance materialization 或 terminal-fact publication 任一步骤抛错，旧控制流都可能在 cleanup owner 建立前退出；一次 cleanup 失败又会永久落成 `partial`，没有 durable occurrence 可供 startup 或 Task 删除恢复；`.git` 消失还被当成 cleanup 成功。最终设计因此把 ownership 前移到首个 ref 写入之前：以 observation ID 持久化一个 `engine_build_observation_cleanup` occurrence，记录 Task、canonical Git directory、进程实例 UUID 和 cleanup 状态。Build Agent 的 ref pin、Turn、provenance、publication 与 cleanup 全部运行在该 owner 下；startup 只接管其它进程实例的 pending owner，不使用可复用 numeric PID 猜测身份。
- observation success 是唯一允许保留 refs 的终态；所有其他终态必须先把同一 occurrence 清理到 durable `complete` receipt，才能返回 adapter。cleanup 暂时失败时 Build execution 不返回可永久 settlement 的 final outcome，而是抛出带 observation ID 的基础设施错误；startup reconciliation 与 Task physical deletion 都调用同一 cleanup owner继续收敛。`.git`/linked-worktree metadata 缺失是 typed cleanup failure，不能伪装成功；只有两个 ref 的 exact deletion 成功才写 receipt。Task 删除在删除 row/cascade 前完成 pending cleanup，避免删除 recovery authority。
- provenance/materialization failure 被纳入同一 try/finally owner，并使用已有 completed Session/Message 构造 typed non-success publication input；无论失败发生在 ref pin、Agent、provenance还是 writer，只要没有成功 observation，均必须先完成/保留同一 cleanup occurrence。
- 最终 reviewer 证明 Task 删除在 owner cleanup 后仍运行旧 `deleteBuildObservationRefs`，形成同一 refs 的第二 authority；owner 集合为空时它还会先观察已经不存在的 repository，导致 false 500，且旧顺序已先 cascade Task row。最终删除路径只枚举 durable owner，并在任何 row/cascade 前逐一 settle；空 owner 集合直接继续，不读取 Git。新 schema 没有 ownerless observation，因而不保留 legacy scanner/fallback。cleanup owner 明确区分当前物理 Build 的 `active` 与失败待恢复的 `pending`；同进程项目关闭/重开可以接管 pending，而不会与仍 active 的 Build竞争。

## 正向验收

- production adapter + canonical publisher：同 identity 连续 publication write failure 返回 `partial` 且不能成为 terminal success；恢复写后返回 terminal success，Artifact Catalog 只有一个 exact Build fact；再次 replay 返回相同 locator且不新增 revision。
- production adapter + canonical publisher：采集异常选择一个 typed infrastructure fact并返回 `partial`，不写平行 observation。
- production path 在 provenance materialization 抛错后仍由同一 observation owner清理 refs并持久 typed non-success；cleanup 首次失败时没有 final dispatch settlement，恢复 owner稍后成功后才允许同 occurrence收敛；linked worktree `.git` 消失保持 pending/error而不写 false receipt。
- project bootstrap 和 Task deletion 对 pending cleanup occurrence 使用同一 reconciler；Task row只在 cleanup receipt完成后物理删除。
- 合法 publication 仍返回 terminal success。
- `bun test --timeout=0 test/build-terminal-fact-publication.test.ts`
- `bun run typecheck`（`packages/opencorvus`）
- task-owned `git diff --check`

## Verification Log

- 实现完成：Build Agent 以 Task + dispatch 派生稳定 terminal-fact observation ID，并在首个 private ref 之前写 durable cleanup owner。Build-owned publisher 在完整 observation 与 typed infrastructure fact 中只选择一个 canonical writer；两个 persist writer 对 caller-owned exact ID 实现同值 replay，既有 Artifact payload/kind/task/label 漂移会失败，infrastructure event 只在首次 insert 时发布。成功 observation 与 cleanup owner 的 `retained` receipt 在同一事务提交。
- `bun test --timeout=0 test/build-terminal-fact-publication.test.ts test/build-observation-ref-cleanup.test.ts` PASS：9 tests / 24 assertions。真实 `createBuildTool -> BuildAgent.run -> runAgentSession -> Git observation -> canonical publisher -> dispatch settlement -> describeTask` 覆盖同 occurrence writer retry、exhaustion partial、exact-ID payload drift、provenance failure；真实移走 `.git` 证明首次 cleanup 写 `pending/error`，项目关闭/重开后 `InstanceBootstrap` 自动恢复同 observation owner；真实 `EngineService.deleteTask` 验证 retained/pending owner 都在 Task row 前收敛，缺失 `.git` 时 Task/owner 保留，恢复后同 owner删除成功；缺失仓库独立合同保持 typed failure。
- reviewer 指定 existing regression：`bun test --timeout=0 test/project-directory-and-worktree-gc.test.ts -t "delete"` PASS：6/6，覆盖没有 cleanup owner 时已缺失 repository 的 Task/Session/Project 删除仍成功且不触发 Git observation。
- `bun run typecheck`（`packages/opencorvus`）PASS；task-owned `git diff --check` PASS。
- 独立只读交付复审：最终 PASS，无未解决 actionable。复审确认 Task 删除只使用 durable cleanup owner，真实 bootstrap 恢复 pending owner，missing `.git` 时保留 Task/owner 并在恢复后沿同一 owner 收敛；此前暴露的缺失仓库 false 500 回归已关闭。
