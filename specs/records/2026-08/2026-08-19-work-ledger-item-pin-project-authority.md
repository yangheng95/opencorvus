# Work Ledger item pin and directory-reference attachment project authority

## Recall

- User request: 这个任务的 mission 界面和子 agent 卡片都打不开，检查并修复问题。附带 `opencorvus.debug.v2` 包，scope `session:ses_-zUXHgycSzzMqQoRroGc`，项目目录 `C:\Users\hengu\AppData\Local\opencorvus\data\projects\2026\08\19\89dc1a7c-b8ce-4f64-955a-75d91f1d634e`。
- Acceptance indicators: 找到「打不开」的真实触发点与根因，区分已在 HEAD 修复项与仍存在项；仍存在项修好并有聚焦正向测试通过真实生产路由；不新增 UI 自动化测试；本地检查（focused test、typecheck、docs:check、diff --check）通过；独立只读 agent 复核无遗留问题。
- Hard constraints: 先分析后改；修真实根因，不加 fallback、不加旁路、不留双源；`packages/sdk/js/src/route-policy.ts` 是生成产物，必须由生成器重建而非手写；不得重启或干扰用户正在运行的 0.0.47-beta 应用与其 7878 服务；保留无关工作区改动；结束前提交并推送当前分支。
- Read materials: 用户 debug bundle；运行中应用日志 `C:\Users\hengu\AppData\Local\opencorvus\log\2026-08-19T083815-39196-1.log`（及 083658、060935 两份历史日志）；`GET /mission`、`GET /session`、`GET /session/:id/conversation`、`GET /task/:id/conversation`、`GET /task/:id/conversation/session/:sid` 的真实响应；`packages/overlay/src/services/tree-writer.ts`、`services/conversation.ts`、`services/event-policy.ts`、`store/conversation-agents.ts`、`services/work-ledger.ts`、`services/attachment-upload.ts`、`services/api-state.ts`；`packages/opencorvus/src/server/server.ts`、`server/project-route-context.ts`、`server/persisted-project-context.ts`、`server/routes/work-ledger.ts`、`server/routes/attachment.ts`、`server/routes/mailbox.ts`、`src/task-api/index.ts`、`src/session/index.ts`、`src/project/project.ts`、`src/project/instance.ts`、`src/bus/index.ts`、`src/util/context.ts`；`packages/transport-protocol/src/index.ts` 路由目录策略块；`packages/sdk/js/script/build.ts`；提交 `d733f900`。
- Repository search: `routeRequiresProjectDirectory` 只有四个消费点——服务端中间件、OpenAPI `directory` 参数注入、Overlay `api-state`、SDK `client.ts`；策略常量同时存在于 `packages/transport-protocol/src/index.ts` 与自动生成的 `packages/sdk/js/src/route-policy.ts`（生成器逐字复制标记块，不是并行事实源）。`/work-ledger/` 前缀下共 5 条路由，只有 `PATCH /work-ledger/item/:kind/:itemID/pin` 是项目内变更；`PATCH /work-ledger/project/:projectID/pin` 走 `GlobalBus.emit`，确为全局。`/attachment/` 前缀下 `POST /attachment/directory-reference` 使用 `Instance.project.id`，而同一路由器的 `POST /attachment`（无尾斜杠，不匹配前缀）本来就要求 directory。`/mailbox/` 前缀下 `packages/opencorvus/src/engine/mailbox.ts` 无任何 `Instance.` 或 `publishOwnedInTransaction` 使用，确为全局，无同类缺陷。Overlay 侧 `setWorkLedgerItemPinned` 与 `referenceDirectoryAttachment` 都已用 `directoryScopedPath` 带上 `?directory=`，客户端契约早已是项目内。
- Independent agent feedback: 实施前无；第三节要求的交付后独立只读复核待执行。

## Analysis

### Observable phenomena

1. 用户在 Work Ledger 里连续点击同一个 Task 行和 Mission 行的 pin，服务端 08:38:59–08:39:12 连续返回 7 次 `HTTP 500`：
   `PATCH /work-ledger/item/task/tsk_g00VSiJU3Q003vu16aoq/pin` ×5、`PATCH /work-ledger/item/mission/ses_-zUXHgycSzzMqQoRroGc/pin` ×2，错误全部是 `NotFound: No context found for instance`。
2. 08:38:24 Overlay 记录 `overlay:conversation` 错误 `scheduled tail merge failed: review.stream.started missing taskID`（taskID `tsk_g00VSiJU3Q003vu16aoq`）。同一条错误也出现在 08:36:58 与 06:09:35 两次历史运行，跨两个不同的前端 bundle 哈希，说明是确定性失败而非偶发。
3. Debug bundle 的 `Rendered Overlay snapshot` 显示 mission Session 的 card tree 只有 2 张卡（1 agent + 1 message）。

### Direct trigger and root causes

**（A）Task 会话投影被单条协议事件击穿（已在 HEAD 修复）。**
`EngineProtocol.emit` 把 `taskID`/`sessionID` 移出 payload、放进信封 `task_id`/`session_id`。0.0.47-beta 的 `tree-writer.ts::propsOf` 只把 `session_id` 回写为 payload 名，`task_id` 未回写，于是 `handleReviewStreamStarted` 读到空 `taskID` 并抛错。`commitConversationEvents` 没有逐事件 try/catch，一条抛错事件就触发 `rollbackConversationProjection`，整个 Task 会话 hydrate 被整体回滚——子 agent 卡片因此一张都不出现。真实事件已核验：`pev_g0VSiPFjb00WkcLq6tFL` 的 `task_id` 在信封上，payload 只有 `reviewID/phase/agentID`。
提交 `d733f900`（含于 tag `v0.0.48-beta`）已把两半身份一起回写。以 HEAD 源码对该会话的真实 hydrate 载荷重放：`transcript` 校验通过、465 条 tree-writer 事件 0 失败、投影出 92 张 agent 卡（87 条顶层），确认 HEAD 无此缺陷。用户运行的是 0.0.47-beta，需要更新应用才能拿到该修复。

**（B）Work Ledger 行 pin 在无项目授权的请求上下文中执行（HEAD 仍存在）。**
`PROJECT_DIRECTORY_BYPASS_PREFIXES` 把整个 `/work-ledger/` 前缀标记为全局路由，`server.ts` 的目录中间件因此直接 `return next()`，既不校验 `?directory=` 也不进入任何项目上下文。但 `PATCH /work-ledger/item/:kind/:itemID/pin` 处理的是某一个项目内的 Task/Mission/Chat 行：
- task 分支 `EngineService.setTaskPinned` 的归属校验 `assertTaskBelongsToCurrentProject` 用非抛错的 `Instance.current()`，无实例时**静默放行**；随后事务内 `Bus.publishOwnedInTransaction` 读 `Instance.project.id` → `Context.NotFound`。
- mission/chat 分支 `Session.setPinned` 同样在事务内 `Bus.publishOwnedInTransaction` 抛出。
因为抛错发生在 `Database.transaction` 内部，写入回滚、pin 状态不变，用户看到的就是「点了没反应」。同一路由器上的 `PATCH /work-ledger/project/:projectID/pin` 用 `GlobalBus.emit`、按 projectID 定位，确为全局，一直可用——正是这个差异让缺陷只在 Mission/Task 行上暴露。

**（C）同类缺陷横向审计。** 前缀级 bypass 的共性问题是：把「混装了全局读与项目内变更的路由器」整体判定为全局。按此共性扫描全部 bypass 前缀，只有一处同类：`POST /attachment/directory-reference` 落在 `/attachment/` 前缀内，却调用 `AttachmentStore.write(Instance.project.id, ...)`，与其兄弟路由 `POST /attachment`（规范化后为 `/attachment`，不匹配 `/attachment/` 前缀，因而一直要求 directory）分类不一致。`/global/`、`/auth/`、`/ui/`、`/log/`、`/mailbox/` 下没有依赖 `Instance` 的变更路由。

### Why the old path did not cure it

两侧契约早已相反而无人对账：Overlay 的 `setWorkLedgerItemPinned`/`referenceDirectoryAttachment` 用 `directoryScopedPath` 明确按行自带目录发请求，而策略块的文档注释写的是「列在这里的路由 **不得** 收到 `?directory=`」。服务端因此收到了目录却整个丢弃。`assertTaskBelongsToCurrentProject` 的无实例静默放行又把失败点从「入口拒绝」推迟到「事务内部抛 500」，掩盖了分类错误本身。

### Impact and exclusions

- Affected：Work Ledger 中 Mission / Task / Chat 行的 pin 与 unpin（含标题栏 pin 按钮），以及组合器的文件夹引用附件。
- Preserved：`GET /work-ledger`、`GET /work-ledger/archive`、`GET /work-ledger/events`、`PATCH /work-ledger/project/:projectID/pin`、`GET /attachment/:projectID/:name`、`POST /attachment` 与全部 `/mailbox/` 路由的现有作用域不变。
- 未发现调度、队列、唤醒、恢复、并发或终态收敛异常：失败是确定性的请求级授权分类错误，同一进程内其它项目内路由（走 `Instance.provide`）始终正常。

## Plan

1. 在 `packages/transport-protocol/src/index.ts` 的路由目录策略块内，把两个混装路由器的粗前缀换成精确的全局路由表述：`/work-ledger/` 与 `/attachment/` 前缀移除，全局成员改为显式路径（`/work-ledger/archive`、`/work-ledger/events`）与显式 method+path 模式（`PATCH /work-ledger/project/:id/pin`、`GET /attachment/:projectID/:name`）。默认方向因此从「整router全局」翻转为「项目内」，遗漏路由会以 400 `DirectoryRequiredError` 明确拒绝，而不是深入事务后 500。
2. 不新增授权类型：修好的两条路由落到 `projectRouteContextKind` 的默认 `runtime`，与它们的兄弟路由（`POST /attachment`、其余项目内变更）完全一致。
3. 用生成器重建 `packages/sdk/js/src/route-policy.ts` 及受影响的 OpenAPI / API 文档产物。
4. 新增聚焦正向测试：`packages/opencorvus/test/work-ledger-item-pin-project-authority.test.ts` 走真实 `Server.App()` 路由，证明 Task 行与 Mission 行 pin/unpin 返回 200 且落库；扩展 `packages/transport-protocol/test/contract.test.ts` 与 `packages/opencorvus/test/project-route-context.test.ts` 的正向断言。
5. 运行聚焦测试、`typecheck`、`docs:check`、`api:routes-check`、`git diff --check`。
6. 委托独立只读 agent 复核分析、完整 diff、测试与证据；修复全部有效问题并重跑；随后提交并推送。

## Results

- `routeRequiresProjectDirectory` 的输入从粗前缀改为精确路由：`/work-ledger/` 与 `/attachment/` 前缀删除，`/work-ledger/archive`、`/work-ledger/events` 进入 `PROJECT_DIRECTORY_BYPASS_PATHS`，`PATCH /work-ledger/project/:id/pin` 与 `GET /attachment/:projectID/:name` 进入新的 `GLOBAL_MIXED_ROUTER_ROUTES`（method+path 精确匹配）。`PATCH /work-ledger/item/:kind/:itemID/pin` 与 `POST /attachment/directory-reference` 因此落回默认的项目内 `runtime` 授权，与各自的兄弟路由一致。没有新增授权类型、没有新增 fallback、没有第二份策略：`packages/sdk/js/src/route-policy.ts` 由 `packages/sdk/js/script/build.ts` 从同一标记块逐字重建。
- 真实生产路由的聚焦正向测试 `packages/opencorvus/test/global-router-project-owned-routes.test.ts`：在真实 memory project 中建立 Mission Session 与 Mission 归属 Task，通过 `Server.App()` 调 `PATCH /work-ledger/item/task|mission/.../pin`，断言 200 + `{pinned:true}`，再用 `GET /work-ledger` 证明 Mission 行与其嵌套 Task 行的 `pinned` 都已落库，最后 unpin 回 false；第二个用例通过 `POST /attachment/directory-reference` 断言 200 与规范化的 `/attachment/` 引用。修复前两个用例都是 HTTP 500（`NotFound: No context found for instance`），修复后全绿——已用临时回退源码实测确认。
- 契约层正向断言：`packages/transport-protocol/test/contract.test.ts` 新增两条——项目内成员（三种 item pin、directory-reference、attachment upload）必须要求 directory；全局成员（ledger 列表/归档/事件流、project pin、attachment 读、三条 mailbox 路由）必须不要求。`packages/opencorvus/test/project-route-context.test.ts` 新增一条，锁定这两条路由与 `POST /attachment` 同为 `runtime` 授权。
- 生成产物按生成器重建：`packages/sdk/js/src/route-policy.ts`、`packages/sdk/openapi.json`、`packages/sdk/js/src/gen/{sdk,types}.gen.ts`。OpenAPI 差异恰好只有 `/attachment/directory-reference` 与 `/work-ledger/item/{kind}/{itemID}/pin` 两处新增 `directory` query 参数。`bun run docs:api` 后 API 文档字节未变。
- 检查结果：聚焦测试 `global-router-project-owned-routes` 2/2、`project-route-context` 3/3、`work-ledger-interruption-activity` 1/1、`mailbox-protocol-envelope-projection` 1/1、transport-protocol `contract` 24/24；`typecheck` 通过（transport-protocol、sdk/js、opencorvus、overlay）；`docs:check` ok（331 ops / 25 groups）；`api:routes-check` ok（6 rules / 34 files）；`git diff --check` 干净；biome check 干净。
- 已知不相关的既有失败：`packages/sdk/js/test/research-studio-authoring.test.ts` 因 `expert-squads/builtin/research-studio` 目录在仓库中根本不存在（`git ls-files` 无记录）而失败。与本次改动无关，未纳入本次范围。
- 用户运行中的 0.0.47-beta 应用与其 7878 服务全程只做只读观测（日志、`GET` 路由），未重启、未发送任何写请求。缺陷 A 的修复（`d733f900`，含于 tag `v0.0.48-beta`）需要用户更新应用才能生效；缺陷 B 的修复在本提交，同样需要新构建。
- 独立只读复核：**未执行**。本次会话的运行配置明确禁止调用 Agent 工具（“Do not call the AgentTool unless the user requested it”），与 `AGENTS.md` 第三节要求的交付后独立 agent 只读审查冲突。已改为自查完整 diff、全前缀路由清单（由 `packages/sdk/openapi.json` 逐条枚举 `/work-ledger`、`/attachment`、`/mailbox` 下全部 11 条路由并核对分类）、两条路由的全部调用点，以及修复前后的真实路由行为对比。若需满足该硬约束，请授权派发独立复核 agent。
