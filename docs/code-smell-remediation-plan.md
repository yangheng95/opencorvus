# OpenCorvus 技术债整改方案

> 配套文档：[code-smell-report.md](code-smell-report.md)（441 条编号问题）。本文件是"怎么修"，报告是"有什么问题"。每个整改项引用报告里的问题 ID。
> 生成：2026-08-16 · 修订：优先级调整为**框架架构债优先**。

## 优先级定调：架构债是主线

这是一个仍在快速迭代、尚未公网发布的框架（v0.0.45beta），威胁模型是本地开发者工具。因此整改的**第一主线是框架架构债**，不是安全，也不是零散 bug：

- **地基决定上层**：分层失效、循环依赖、同一概念多套实现——这些不理顺，后面修的安全、性能、bug 都是在歪结构上打补丁，而且歪架构会**持续再生产**新的 bug 与漏洞（本次报告里大量"复制已漂移""投影逐行查询""测试钩子进生产"都是结构没立住的直接后果）。
- **架构重构是其他修复的载体**：一旦动到某模块做分层/拆分，该模块里的真 bug、性能 N+1、测试钩子污染就该**顺手一起收割**，而不是单开阶段重复进入同一批代码。
- **安全 / 性能 / bug 不消失，改为并行副线**：它们中改动小、独立的（尤其那条 RCE 链）单开一条轻量 PR 线尽早清掉，但不占用架构主线的注意力与排期。安全后置于架构主线 ≠ 无限期拖延——它成本低、可随时穿插。

> 一句话：**先把骨架正过来，边正骨架边收割途经的 bug/性能/污染，安全等杂项另起一条低成本并行线随时清。**

## 执行原则（贯穿所有阶段）

1. **动结构之前先有测试网**：大规模挪代码/拆文件/断依赖必然有回归风险。当前测试 runner 首败即停（TST-01），未修好之前"测试通过"不可信——这是阶段 0 的前置硬条件。
2. **每个 PR 可独立回滚**：一次一类问题，风险改动挂 flag。架构类 PR 尤其要小步——一次断一个环、拆一个文件。
3. **每消除一类结构问题，配一条自动化防线**：断一处循环依赖就加一条 no-restricted-imports，删一处 `ForTest` 就加一条禁止生产代码出现 ForTest 的规则。否则 AI 迭代会把同样的问题再写回来（这是本仓最需要的机制）。
4. **架构 PR 顺手收割**：动到的模块里若有报告已记的真 bug / 性能 / 测试污染，在同一批次一并修，PR 里注明收割了哪些 ID。
5. **改动伴随度量**：依赖环用 SCC 规模度量（只降不升）；性能改造前后记查询次数。

## 阶段总表

| 阶段 | 目标 | 内容 | 阻塞关系 |
|---|---|---|---|
| **阶段 0** | 前置地基 | 恢复测试信任 + 画出目标分层模型 + 给核心模块补契约测试 | 阶段 1 的前置 |
| **阶段 1（主线）** | **框架架构债** | 断循环依赖立分层 → 统一重复概念 → 拆上帝文件 → 消除仪式性抽象；同步落地防复发基建 | 阶段 0 |
| **阶段 2** | 随重构收割 | 工具级重复收敛 / 真 bug / 性能 N+1——挂靠在阶段 1 动到的模块上 | 与阶段 1 同批推进 |
| **副线 S（并行）** | 安全 | RCE 链等，独立低成本 PR，随时穿插，不占主线 | 仅依赖阶段 0 |
| **阶段 3** | 清扫 | 死代码 / 注释 / 命名 / 类型 | 无 |

---

# 阶段 0：前置地基

架构重构不能盲拆，先把"安全网"和"目标图"备齐。

## 0.1 恢复测试信任（0.5 天）

**问题** TST-01：`packages/opencorvus/script/run-tests.ts:43-46` 首个失败文件即 `break`，配合预存失败 `algorithm-batch-one`（记忆 [[preexisting-worktree-ownership-test-failure]]），其后所有测试从不执行。
**方案**：改为收集全部结果统一判定退出码，默认跑完全部，保留 `--bail` 显式开关；`algorithm-batch-one` 的预存失败先用 allowlist 标为已知失败（它其实是 HST-01 worktree 互斥的表现，阶段 1 修完复验）；TST-25 的 `--timeout=0` 改为合理每用例上限。
**验证**：`bun run test`（记忆 [[no-bare-bun-test]]：必须走 `bun run test`）跑完全部 ~275 文件并汇总失败清单。

## 0.2 确立目标分层模型（1~2 天，纸面工作）

先在 `CODEBASE_STRUCTURE.md` 补一节"分层约束"，画出**目标依赖方向**，作为阶段 1 所有拆分的准绳：

- **底座层**（不得反向依赖高层）：`util` / `id` / `storage` / `protocol` / `control` / `config` / `bus`。
- **领域层**：`engine` / `session` / `task-api` / `orchestrator` / `scheduler` / `mission`。
- **应用层**：`server` / `cli` / 各 agent 模块 / `overlay`。
- **共享契约**：跨端类型统一走 `@opencorvus-ai/transport-protocol`。
- **artifact 概念**：明确单一存储抽象（现有 4 套需收敛，见 1-B）。

依赖度实测佐证（报告 DEP 区）：`project/engine/session/storage/config/agent` 六个模块同时进"被依赖最多"和"依赖别人最多"两榜——这就是分层失效的坐标，是阶段 1 的靶心。

## 0.3 给核心模块补契约测试（3~5 天，与 0.2 并行）

优先给**阶段 1 要动的模块**补测试：`workbench/`、`interactive-artifact/`、`acp/`、`pty/`、`system-terminal/` 当前零覆盖（TST-02~05）；以及要拆的 `session/loop`、`task-api`、`artifact-catalog` 的行为契约。没有这层，后面拆文件/挪 sql 无法验证等价。

---

# 阶段 1（主线）：框架架构债

> 这是整改的核心。四条子线，建议大致按 A→B→C 顺序（A 立分层是 B/C 的前提），D 穿插。每断一处环、拆一个文件都是独立小 PR。

## 1-A 断循环依赖、立分层

42% 后端文件锁在一个静态强连通分量里（DEP-01）。四步拆，每步让一批环成批断裂：

1. **sql 定义下沉**（DEP-03、SES-03）：`storage/schema.ts` 聚合 19 个上层 `*.sql.ts`，使 storage 反依赖 16 个高层模块，而它们又 import `storage/db.ts`。把各 `*.sql.ts` 移入 storage 或独立 schema 包，schema 注册改反向登记。**这一步收益最大**——storage 是最底的底座，切断后一大批环断裂。
2. **protocol / control 瘦身**（DEP-04、DEP-05）：protocol 反依赖 11 个高层、control 反依赖 9 个。让二者只保留传输/存储原语与消息 schema，投影/执行语义上移到调用方。
3. **打破 project↔task-api 主环**（DEP-02）：`project/bootstrap.ts ↔ task-api/index.ts` 双向静态互引，下沉为二者共依赖的接口模块（别再靠 `await import` 掩盖）。
4. **底层工具去 project 依赖**（DEP-15）：`util`/`bus`/`env`/`format`/`file` 反依赖 `project`，改依赖注入或参数传入。
5. **卫星 agent 契约化**（DEP-11、ORC-12）：14 个 agent 模块靠 25+ 处 `await import` 打破对 `dispatch-turn-projection` 的环——把投影提为独立契约模块，双方静态依赖它，删掉规避性动态 import。
6. **收尾 barrel 契约**（ENG-03）：`@/engine` 注释声称禁止深导入，实际 384 处违约——补全 barrel 或删注释，并加 lint 固化。

**每步配套**：把依赖环检测（Tarjan SCC）脚本纳入 CI，SCC 规模阈值只降不升。

## 1-B 统一重复概念（架构层的重复，不是清理）

同一概念多套实现，本质是**概念模型没理清**，属架构债核心而非杂项清理：

1. **artifact 存储收敛**（ART 区总评）：同一"产物"语义有 4 套独立存储（`engine_artifact` 表 / `task-artifact` 磁盘快照 / `interactive_artifact` 表 / `work-artifact` 走 AttachmentStore），`artifact-catalog` 只统一了前两套，后两套还共用 `Identifier("artifact")` 前缀却互不可见。确立单一 artifact 存储抽象，其余作为其上的视图/适配。这是 artifact 概念群一切重复与 bug 的根。
2. **跨端共享领域模型下沉**（DEP-08/09/23/24）：`TraceEvent`、会话/消息视图（placement 必填性已漂移）、`message.*` 事件判定表、`AutomationTarget`、`NetworkProxyTestResult` 前后端各写一份且部分已漂移——统一到 `@opencorvus-ai/transport-protocol`。
3. **正名概念污染**（ORC-06）：`scheduler` 一词承载三义（orchestrator 智能体 / 定时器目录 / 参与者协议消息）——智能体语义改回 orchestrator，协议语义改 participant/inbox。`work-ledger` 实为侧边栏历史列表与 artifact 无关，一并正名。
4. **核心机制去多实现**（属架构，不是工具级重复）：控制租约（ENG-01、ORC-03/04：control-lease 已有正版却被手写 24+ 处绕过）、单飞锁（ORC-14：45 处手写 Map）、结算门（ORC-20：三套并行）——收敛到单一机制。

## 1-C 拆上帝文件

按"阻塞架构 / 有 bug / 高频改动"排序，纯搬迁+改导入不改行为（先有 0.3 的测试）：

1. `session/loop.ts`（4033 行，SES-01，且与 engine 双向耦合是 1-A 的一环）→ turn 编排 / 工具解析 / 预算估算 / 权限重建。
2. `task-api/index.ts`（3704 行、两个同名 namespace，ORC-01，是 DEP-02 主环一端）→ task-lifecycle / cancellation / interaction / board-query。
3. `artifact-catalog/index.ts`（2306 行，ART-04，随 1-B 的存储收敛一起做）→ cursor / query / read / publish。
4. `storage/db.ts` `assertCurrentDataIntegrity`（428 行 13 段复制，INF-01/02）→ 数据表驱动 + 移出开库热路径。
5. `expert-squad/prompt-profile-resolver.ts`（4120 行，AGT-03）→ projection / catalog / diagnostics。
6. `mcp/index.ts`、`orchestrator/tools.ts`、`orchestrator/agent.ts::processInvocation`、`acp/agent.ts`、`work-artifact/presentation.ts`、`channel-runtime/core.ts`。
7. overlay 侧：`tree-writer.ts`（3723 行）、`main.tsx`、`TaskDirBar.tsx`（OVL-01/06、R3B-05）。

## 1-D 消除仪式性过度抽象（穿插）

动到相关模块时顺手降级：control-plane-tool DI 单例（TOL-13，只有一份实现）、session prompt 5 套 brand+WeakMap 收据（PRO-07，仅服务 3 个调用点）、14 个恒等转发包装（PRO-12）、为一次 mkdir 建 namespace（HST-23）、恒等函数与恒定返回（INF-24）、architect 复刻 zod 的 190 行手写校验器（ENG-04）。

---

# 阶段 2：随架构重构收割（与阶段 1 同批推进）

> 不单独排期——挂靠在阶段 1 动到的模块上，进同一个 PR 或紧邻 PR。

## 2-A 工具级重复收敛（趁 codemod）

阶段 1 已经在动这些文件，顺势建 `packages/util` 共享层并 codemod 替换。**先合并已漂移的（潜伏 bug），再合并纯重复**：

| 共享函数 | 现状 → 目标 | ID |
|---|---|---|
| `errorMessage` | 前后端 30+ 份+200+ 处内联 → 1 份 | OVL-09/R3A-24/R3B-04 |
| `canonicalDigestSource`/`stableJSON` | 4 份**已分歧**（影响 SHA-256）→ 走现有正版 | ART-01 |
| `escapeXml` | 2 份，一份漏转义（**已是 bug**）→ 1 份 | R3C-07 |
| `isRecord`/`isAbortError`/`isEnoent` | 7/4/8 份 → 各 1 份 | R3B-10/INF-14 |
| `withCleanup`/`withPageActivityGuard`/`keyedMutex`/`atomicWriteFile`/`upsertByID`/`classes`/`safeEqual` | 各 2~11 份 → 各 1 份 | ART-06/DEP-07/R3A-10 等 |

## 2-B 真 bug（趁动到模块顺手修）

会产生**错误结果**的缺陷（均过第 3 轮复核 CONFIRMED），每条配一个复现测试。多数正好落在阶段 1 要动的模块里：

| ID | 缺陷 | 挂靠 |
|---|---|---|
| HST-01 | worktree 临界区两套 key 归一化，Windows 互斥失效 | 1-A worktree/ownership |
| SRV-02 | 任务终态后 live-replay Map 内存泄漏 | 1-A protocol 瘦身 |
| ENG-14 | 复制查询丢 `status!=="active"`，已终结任务通过所有权断言 | 1-B 租约收敛 |
| AGT-01 | `contract_audit` 验收 scorer 全仓零调用 → false-green 验收 | 1-C acceptance |
| R3D-01/PRO-01 | memory `project_context` 权重 0 → 被索引却永远搜不到；排序 kind 分层废掉 bm25 | 独立小修 |
| R3C-02 | LINE 群消息回私聊 | 独立小修 |
| R3C-03/04 | orchestrator 权限集算完丢弃 / 用户 permission 静默丢弃 | 1-A agent 契约化 |
| R3C-19 | matrix `whoami` 缺 user_id → 机器人处理自己消息成回环 | 独立小修 |
| INF-08 | `inferFamily` 恒返回 "build"，门禁 family 匹配失效 | 独立小修 |
| INF-12 | `parseConfig` 不做 `{env:}`/`{file:}` 替换，读写路径不一致 | 独立小修 |
| HST-02/03 | 手写假 diff（依赖里有 `diff` 包）+ 死字段 | 独立小修 |
| R3B-08 | `rewindDisabled=()=>canRewind()` 语义反转，回退功能永不执行 | 独立小修 |

> 标"独立小修"的不依赖架构重构，可随时并入副线快速清。

## 2-C 性能 N+1（趁投影层重构）

统一病根：**投影逐行开查询 + 列表逐行调投影**。改造模式：投影批量化（`inArray` 一次拉齐）/ 过滤分页下推 SQL+建索引 / 血缘走递归 CTE（`engine/store.ts:270` 已有样板）/ 轮询只取最新 N 条。按热度：

- C1 看板/Mission/任务列表：`taskItems` 逐行调 `listInteractions` ≈ 25 万查询/请求 → 批量化+`engine_interaction_request` 建 `task_id` 索引+SSE signature 改摘要（PERF-01/02/03、R3A-04）。
- C2 三个 1 秒轮询：automation/scheduler-message/event-projection 每秒全表扫多遍且随历史增长 → 只投最新 run、状态落列+索引（PERF-04/05/07、R3A-03）。
- C3~C5 游标端点/其余列表/写热路径（PERF-06/08~20、R3A-01/02/05）。

改造在 1-C 拆 `task-api`/`artifact-catalog`/`session` 时顺势做（投影函数正好被搬动）。PR 贴改造前后查询数。

---

# 副线 S（并行）：安全

> 独立于架构主线，改动小、可随时穿插——**建议架构重构一启动就另派一条线尽早清掉**，因为二者不互相阻塞。定位为副线是就"注意力主次"而言，不是"能拖就拖"。

**S-1 RCE 链（一个 PR 一起改，单修任一条断不了链）**：
- SEC-03 `server/server.ts:809`：移除"无密码即 next()"，启动生成随机 token 写 0600，overlay/CLI 从同文件读（前后端协同）。
- SEC-04 `server/cors.ts:19-23`：删 Host↔Origin 互证，改校验 Host 头属于 loopback 白名单。
- SEC-05 `cli/network.ts:49-53`：`--mdns` 不再隐式绑 0.0.0.0；非回环绑定强制要求密码。
- SEC-01 `channel-runtime/adapters/feishu.ts:194`：verificationToken 缺失即拒绝启动 + 补 `X-Lark-Signature`（timingSafeEqual）。
- SEC-02 `file/index.ts:906`：`readSource` 补路径授权（首选：限已持久化 citation 记录过的绝对路径；兜底：限项目/worktree 根集+敏感文件黑名单）。

**S-2 收尾项**：SEC-06 log/export 鉴权+脱敏（连带 session 全量落日志、oauth 明文 clientSecret 改哈希 R3A-25）、SEC-07 Tauri capability 收窄、SEC-08 open_path/url 白名单、SEC-09 停止打印用户消息、SEC-10 上传体积上限、SEC-11 路径前缀补 sep、SEC-12 tauri pubkey。

---

# 阶段 3：清扫（穿插，低风险）

- **死代码**：整目录删 `evidence/`（AGT-08）、`task-context/`（ART-08）、`acceptance/checks/walkthrough/`（AGT-02）、`util/` 7 个零引用文件（INF-04）；~1000 行死 CSS（R3B-01~03/19）；空 flag 常量、零引用 barrel、`*ForTest`。删前 `grep` 二次确认（注意 `export *` 间接引用）。
- **注释与命名污染**：删百科式缩写注释 40+、考古注释、移植残留产品名（`openclaw.ai`、"Codex Scheduled Automations"）、中文歇后语（ORC-24）；修破碎/挂错注释。
- **类型偿还**：`: any` 541 / `as any` 212 / `as unknown as` 67，按模块随阶段 1 拆分一起收；分模块渐进开 `tsconfig` 严格项（SES-23）；优先边界层 any（config/auth/解析层）。

---

# 防复发基建（与阶段 1 同步落地，关键）

> AI 迭代会把消除的问题重新写回。每类整改必须配自动化防线——对本仓这是**成败关键**。

**Lint / biome**：
- no-restricted-imports：禁 `@/engine/*` 等深导入（配合 1-A）；禁底座层（util/bus/env/format/protocol/control）导入 project/领域层；禁绕过 transport-protocol 两端各写共享类型。
- no-restricted-syntax：禁本地重定义已收敛函数名（errorMessage/isRecord/stableJSON…）；禁 `error instanceof Error ? error.message : String(error)` 内联。
- 自定义规则：非 `*.test.ts`/`test/` 文件出现 `ForTest` 标识符即报错；空 `catch {}` 必须显式注释或接日志。

**CI 门禁**：
- 依赖环 SCC 脚本入 CI，规模阈值只降不升。
- 测试全跑不 bail（阶段 0 后），跳过测试（TST-09）显式告警计数。
- `check:css-tokens`（仓库已有）入 CI；prettier/biome format 全覆盖（修 R3A-25 逃过格式化的文件）。

**架构约束文档**：0.2 产出的分层模型写入 `CODEBASE_STRUCTURE.md`，作为 review 依据。

---

# 排期与里程碑

| 里程碑 | 内容 | 退出标准 |
|---|---|---|
| **M0** | 阶段 0 | 测试跑全套；目标分层模型定稿；核心模块契约测试就位 |
| **M1** | 1-A（sql 下沉+protocol/control 瘦身）+ 依赖环入 CI | SCC 规模显著下降；底座层不再反依赖高层；lint 深导入门禁生效 |
| **M2** | 1-B（artifact 存储收敛+共享领域模型+概念正名）+ 2-A 收割 | artifact 单一抽象；跨端类型统一；已漂移的重复合并完毕 |
| **M3** | 1-C 拆上帝文件 + 2-B/2-C 顺手收割 | 前 5 个上帝文件拆分；途经的真 bug/性能各有测试转绿 |
| **副线 S**（与 M1~M2 并行） | 安全 RCE 链 + 收尾 | 5 条链封堵，安全回归通过 |
| **M4（穿插）** | 阶段 3 + 1-D | 死代码清零；any 分模块收敛；仪式性抽象降级 |

**收敛判据**：报告问题按 ID 勾销；架构类高严重度（DEP/上帝文件/概念重叠约 40 条）清零 = 主线达成；其余靠防复发基建守住不回潮。

---

# 附录：整改项标准 PR 模板

```
标题：[1-A] DEP-03 storage/schema sql 下沉，断 storage→高层反向依赖

问题：<报告 ID + 一句话>
根因：<为什么会这样>
改动：<文件:行，改了什么>
收割：<本 PR 顺手修的其他 ID，若有>
验证：<契约测试；SCC 规模/查询数 前后对比>
防线：<配套的 lint/CI 规则>
风险与回滚：<影响面；如何回滚>
```
